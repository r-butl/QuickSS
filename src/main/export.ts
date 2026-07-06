import { join } from 'path'
import { BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import { Guide } from '../shared/types'

// `exportGuideAsJson`/`exportGuideAsMarkdown` are pure Guide-transformation
// functions with no Electron/filesystem dependency, so they live in
// `shared/export.ts` (alongside `shared/manifest.ts`) and are re-exported
// here so every export-related IPC handler can still import everything
// from this one module. See that file's doc comments for the
// JSON-includes-unsorted vs Markdown-excludes-unsorted rationale.
export { exportGuideAsJson, exportGuideAsMarkdown } from '../shared/export'

/**
 * Main-process-only holder for the Guide data the hidden print-view window
 * fetches via the `export:getPrintData` IPC handler (`src/main/ipc.ts`) -
 * same "stash it, one-shot fetch it back over IPC" shape as
 * `captureFlow.ts`'s pending-capture holder. Set immediately before the
 * print window is created and cleared once `exportGuideAsPdf` is done with
 * it (success or failure), so it never outlives a single export.
 */
interface PendingPrintData {
  guide: Guide
  guidePath: string
}

let pendingPrintData: PendingPrintData | null = null

export function setPendingPrintData(guide: Guide, guidePath: string): void {
  pendingPrintData = { guide, guidePath }
}

export function getPendingPrintData(): PendingPrintData | null {
  return pendingPrintData
}

export function clearPendingPrintData(): void {
  pendingPrintData = null
}

const PRINT_READY_TIMEOUT_MS = 10_000

/**
 * Waits for the print-view renderer (mounted at `?windowRole=export-print`)
 * to signal it has finished fetching `getPrintData()` and rendering the
 * result, via a one-shot `export:printReady` message sent from
 * `PrintView.tsx` (see `notifyPrintReady` in the preload API). Matched to
 * `webContentsId` so a stray message from some other window can't resolve
 * the wrong export's wait. If the print view instead signals
 * `export:printFailed` (its `getPrintData()` fetch threw), the returned
 * promise rejects instead of resolving, so `exportGuideAsPdf` fails the
 * export rather than silently calling `printToPDF()` on an empty page and
 * writing a blank PDF to disk. Falls back to a timeout, resolved
 * successfully, only if neither signal ever arrives (defensive fallback
 * for an unanticipated renderer failure mode, not the expected path).
 */
function waitForPrintReady(webContentsId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false

    const readyListener = (event: Electron.IpcMainEvent): void => {
      if (event.sender.id !== webContentsId) return
      finish(() => resolve())
    }

    const failedListener = (event: Electron.IpcMainEvent, message: string): void => {
      if (event.sender.id !== webContentsId) return
      finish(() => reject(new Error(`Print view failed to render: ${message}`)))
    }

    const timer = setTimeout(() => finish(() => resolve()), PRINT_READY_TIMEOUT_MS)

    function finish(settle: () => void): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ipcMain.removeListener('export:printReady', readyListener)
      ipcMain.removeListener('export:printFailed', failedListener)
      settle()
    }

    ipcMain.on('export:printReady', readyListener)
    ipcMain.on('export:printFailed', failedListener)
  })
}

/**
 * Renders the Guide (excluding unsorted steps, same rule as
 * `exportGuideAsMarkdown`) to PDF by loading the hidden print-view window,
 * waiting for it to finish loading and rendering, then calling
 * `webContents.printToPDF()`. Reuses the "one bundle, multiple window
 * roles" pattern already established for the command HUD
 * (`src/main/windows/commandWindow.ts`) and preview window
 * (`src/main/windows/previewWindow.ts`), but - unlike those two - this
 * window is one-shot: created, used, and destroyed within a single call
 * rather than hidden-and-reused, since exports are infrequent and don't
 * benefit from a warm window.
 */
export async function exportGuideAsPdf(guide: Guide, guidePath: string): Promise<Buffer> {
  setPendingPrintData(guide, guidePath)

  const win = new BrowserWindow({
    width: 900,
    height: 700,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  try {
    const loadPromise = new Promise<void>((resolve, reject) => {
      win.webContents.once('did-finish-load', () => resolve())
      win.webContents.once('did-fail-load', (_event, errorCode, errorDescription) => {
        reject(new Error(`print view failed to load: ${errorDescription} (${errorCode})`))
      })
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?windowRole=export-print`)
    } else {
      win.loadFile(join(__dirname, '../renderer/index.html'), { search: 'windowRole=export-print' })
    }

    await loadPromise
    await waitForPrintReady(win.webContents.id)

    return await win.webContents.printToPDF({})
  } finally {
    if (!win.isDestroyed()) {
      win.destroy()
    }
    clearPendingPrintData()
  }
}
