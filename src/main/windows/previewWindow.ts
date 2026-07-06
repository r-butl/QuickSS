import { join } from 'path'
import { BrowserWindow } from 'electron'
import { is } from '@electron-toolkit/utils'

const WINDOW_WIDTH = 900
const WINDOW_HEIGHT = 700

let previewWindow: BrowserWindow | null = null

/**
 * Creates (once) and shows the post-capture preview window: a normal,
 * resizable, framed popup window (not a HUD - this one wants focused
 * interaction: caption/description typing, confirm/discard) that renders
 * the pending capture from `src/main/captureFlow.ts`. Repeated calls while
 * the window already exists just re-show/focus it, matching the command
 * window's reuse pattern (`src/main/windows/commandWindow.ts`).
 *
 * `setContentProtection(true)` immediately after construction, before
 * `show()` - same requirement 6 rationale as the command window: this
 * window must never appear in screenshots/recordings, including ones the
 * app itself captures.
 *
 * On confirm/discard/Esc the window is `hide()`-ed rather than destroyed
 * (see `hidePreviewWindow`), so the next capture reuses the same window
 * instance instead of paying window-creation cost every time - same
 * lifecycle choice as the command window.
 */
export function createOrShowPreviewWindow(): BrowserWindow {
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.show()
    previewWindow.focus()
    return previewWindow
  }

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Must happen before show() - see doc comment above.
  win.setContentProtection(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?windowRole=preview`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { search: 'windowRole=preview' })
  }

  win.on('closed', () => {
    if (previewWindow === win) {
      previewWindow = null
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  previewWindow = win
  return win
}

export function getPreviewWindow(): BrowserWindow | null {
  return previewWindow
}

/**
 * Hides (does not destroy) the preview window, if it exists and is still
 * live. Called after confirm/discard - see `createOrShowPreviewWindow`'s
 * doc comment for the reuse rationale.
 */
export function hidePreviewWindow(): void {
  if (previewWindow && !previewWindow.isDestroyed()) {
    previewWindow.hide()
  }
}
