import * as fs from 'fs/promises'
import * as path from 'path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type {
  ConfirmCaptureInput,
  ConfirmCaptureResult,
  CreateThreadResult,
  CurrentGuideResult,
  EditorActionResult,
  GuideResult,
  PendingCaptureResult,
  PrintData,
  PrintThreadData,
  StepContainer
} from '../shared/guideApi'
import type { Step } from '../shared/types'
import { createGuideFolder, readManifest, writeImage, writeManifest } from './persistence'
import { addRecentGuide, readRecentGuides } from './recentGuides'
import { readSettings, updateHotkeys } from './settings'
import { reregisterHotkeys } from './hotkeyRegistration'
import type { AppSettings, HotkeyBindings } from '../shared/settings'
import {
  addStepToThread,
  createThread,
  deleteStep,
  moveStep,
  renameThread,
  reorderStep,
  updateStep,
  updateStepCrop,
  updateStepCursorVisible
} from '../shared/manifest'
import { ensureThreadForCapture } from './capture'
import {
  getActiveThreadId,
  getCurrentGuide,
  getCurrentGuideResult,
  setActiveThreadId,
  setCurrentGuide,
  updateCurrentGuide
} from './guideState'
import { clearPendingCapture, getPendingCapture } from './captureFlow'
import { createOrShowCommandWindow, hideCommandWindow } from './windows/commandWindow'
import { hidePreviewWindow } from './windows/previewWindow'
import { getMainWindow } from './windows/windowRegistry'
import type { GuideMode } from '../shared/guideApi'
import {
  exportGuideAsJson,
  exportGuideAsMarkdown,
  exportGuideAsPdf,
  getPendingPrintData
} from './export'

export type { GuideResult }

/**
 * Returns the default base folder for new Guides (`Documents/Guides`),
 * creating it if it doesn't already exist. Used so "New Guide" has no
 * friction: no folder-picker prompt for the common case.
 */
async function getDefaultGuidesBasePath(): Promise<string> {
  const basePath = path.join(app.getPath('documents'), 'Guides')
  await fs.mkdir(basePath, { recursive: true })
  return basePath
}

/**
 * Strips characters that are invalid/awkward in filenames on any of the
 * three major platforms, for use in export save-dialog default filenames.
 * Falls back to `"guide"` if the title sanitizes down to nothing (e.g. a
 * title made entirely of punctuation).
 */
function sanitizeFilename(title: string): string {
  const sanitized = title.replace(/[\\/:*?"<>|]/g, '_').trim()
  return sanitized || 'guide'
}

async function openGuideAtPath(guidePath: string): Promise<GuideResult> {
  const guide = await readManifest(guidePath)
  await addRecentGuide({
    path: guidePath,
    title: guide.title,
    lastOpenedAt: new Date().toISOString()
  })
  return { guidePath, guide }
}

/**
 * Creates a new thread in the current Guide, persists it, updates the
 * in-memory Guide state, and makes it the active thread (so a capture made
 * right after "start a new thread" lands in the thread just started - see
 * requirement 2).
 *
 * Extracted to a plain function (rather than living only inside the
 * `guide:createThread` IPC handler below) so it has exactly one
 * implementation shared by two callers: the IPC handler (used by the
 * command HUD's "New Thread" button) and the `onNewThread` global hotkey
 * handler in `src/main/index.ts`, which calls this function directly - the
 * main process never invokes IPC on itself.
 */
export async function createNewThread(): Promise<CreateThreadResult> {
  const current = getCurrentGuide()
  if (!current) {
    throw new Error('createNewThread called with no current Guide set')
  }

  const { guide: updatedGuide, thread } = createThread(current.guide)
  await writeManifest(current.guidePath, updatedGuide)
  updateCurrentGuide(updatedGuide)
  setActiveThreadId(thread.id)

  return { guide: updatedGuide, threadId: thread.id }
}

/**
 * Registers all `guide:*` IPC handlers. Must be called once during the
 * app's ready flow, before any renderer can invoke these channels.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle('guide:create', async (_event, basePath: string | undefined, title: string) => {
    const resolvedBasePath = basePath ?? (await getDefaultGuidesBasePath())
    const { guidePath, guide } = await createGuideFolder(resolvedBasePath, title)
    await addRecentGuide({
      path: guidePath,
      title: guide.title,
      lastOpenedAt: new Date().toISOString()
    })
    setCurrentGuide(guidePath, guide)
    createOrShowCommandWindow()
    return { guidePath, guide }
  })

  ipcMain.handle('guide:open', async (_event, guidePath: string) => {
    const result = await openGuideAtPath(guidePath)
    setCurrentGuide(result.guidePath, result.guide)
    createOrShowCommandWindow()
    return result
  })

  ipcMain.handle('guide:openViaDialog', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const opened = await openGuideAtPath(result.filePaths[0])
    setCurrentGuide(opened.guidePath, opened.guide)
    createOrShowCommandWindow()
    return opened
  })

  ipcMain.handle('guide:listRecent', async () => {
    return readRecentGuides()
  })

  ipcMain.handle('guide:createThread', async () => {
    return createNewThread()
  })

  ipcMain.handle('guide:getCurrent', async (): Promise<CurrentGuideResult | null> => {
    return getCurrentGuideResult()
  })

  ipcMain.on('app:requestToggleOverview', () => {
    getMainWindow()?.webContents.send('app:toggleOverview')
  })

  // Keeps the main window and command HUD mutually exclusive (see
  // `GuideApi.notifyModeChanged`'s doc comment): overview mode is for
  // reviewing/editing in the main window, capture mode is driven entirely
  // by the HUD and global hotkeys, so only one is ever shown at a time.
  ipcMain.on('app:modeChanged', (_event, mode: GuideMode) => {
    const mainWindow = getMainWindow()
    if (mode === 'overview') {
      hideCommandWindow()
      mainWindow?.show()
    } else {
      mainWindow?.hide()
      createOrShowCommandWindow()
    }
  })

  ipcMain.handle('preview:getPending', async (): Promise<PendingCaptureResult | null> => {
    const pending = getPendingCapture()
    if (!pending) return null

    return {
      imageDataUrl: `data:image/png;base64,${pending.imageBuffer.toString('base64')}`,
      cursor: pending.cursor,
      cursorVisible: pending.cursorVisible,
      crop: pending.crop
    }
  })

  ipcMain.handle(
    'preview:confirm',
    async (_event, input: ConfirmCaptureInput): Promise<ConfirmCaptureResult> => {
      const pending = getPendingCapture()
      if (!pending) {
        throw new Error('preview:confirm called with no pending capture')
      }

      const current = getCurrentGuide()
      if (!current) {
        throw new Error('preview:confirm called with no current Guide set')
      }

      const { guide: guideWithThread, threadId } = ensureThreadForCapture(
        current.guide,
        getActiveThreadId()
      )
      // ensureThreadForCapture may have auto-created "Thread 1" - only mark
      // it active once the write below durably persists it, so a write
      // failure never leaves activeThreadId pointing at an unsaved thread.
      const shouldActivateNewThread = threadId !== getActiveThreadId()

      const id = crypto.randomUUID()
      const step: Step = {
        id,
        imageFile: `images/${id}.png`,
        caption: input.caption,
        description: input.description,
        cursor: { x: pending.cursor.x, y: pending.cursor.y, visible: pending.cursorVisible },
        crop: pending.crop,
        createdAt: new Date().toISOString()
      }

      // Requirement 12: the image must be written to disk BEFORE the
      // manifest is updated to reference it, never the other way around -
      // a crash mid-write must never leave the manifest pointing at a
      // missing file.
      await writeImage(current.guidePath, step.imageFile, pending.imageBuffer)

      const updatedGuide = addStepToThread(guideWithThread, threadId, step)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)
      if (shouldActivateNewThread) {
        setActiveThreadId(threadId)
      }

      clearPendingCapture()
      hidePreviewWindow()

      return { guide: updatedGuide, step }
    }
  )

  ipcMain.handle('preview:discard', async (): Promise<void> => {
    clearPendingCapture()
    hidePreviewWindow()
  })

  ipcMain.handle(
    'editor:reorderStep',
    async (
      _event,
      container: StepContainer,
      fromIndex: number,
      toIndex: number
    ): Promise<EditorActionResult> => {
      const current = getCurrentGuide()
      if (!current) {
        throw new Error('editor:reorderStep called with no current Guide set')
      }

      const updatedGuide = reorderStep(current.guide, container, fromIndex, toIndex)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)

      return { guide: updatedGuide }
    }
  )

  ipcMain.handle(
    'editor:moveStep',
    async (
      _event,
      stepId: string,
      from: StepContainer,
      to: StepContainer,
      toIndex?: number
    ): Promise<EditorActionResult> => {
      const current = getCurrentGuide()
      if (!current) {
        throw new Error('editor:moveStep called with no current Guide set')
      }

      const updatedGuide = moveStep(current.guide, stepId, from, to, toIndex)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)

      return { guide: updatedGuide }
    }
  )

  ipcMain.handle(
    'editor:renameThread',
    async (_event, threadId: string, newName: string): Promise<EditorActionResult> => {
      const current = getCurrentGuide()
      if (!current) {
        throw new Error('editor:renameThread called with no current Guide set')
      }

      const updatedGuide = renameThread(current.guide, threadId, newName)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)

      return { guide: updatedGuide }
    }
  )

  ipcMain.handle(
    'editor:updateStep',
    async (
      _event,
      stepId: string,
      updates: Partial<Pick<Step, 'caption' | 'description'>>
    ): Promise<EditorActionResult> => {
      const current = getCurrentGuide()
      if (!current) {
        throw new Error('editor:updateStep called with no current Guide set')
      }

      const updatedGuide = updateStep(current.guide, stepId, updates)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)

      return { guide: updatedGuide }
    }
  )

  ipcMain.handle(
    'editor:updateStepCrop',
    async (_event, stepId: string, crop: Step['crop']): Promise<EditorActionResult> => {
      const current = getCurrentGuide()
      if (!current) {
        throw new Error('editor:updateStepCrop called with no current Guide set')
      }

      const updatedGuide = updateStepCrop(current.guide, stepId, crop)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)

      return { guide: updatedGuide }
    }
  )

  ipcMain.handle(
    'editor:updateStepCursorVisible',
    async (_event, stepId: string, visible: boolean): Promise<EditorActionResult> => {
      const current = getCurrentGuide()
      if (!current) {
        throw new Error('editor:updateStepCursorVisible called with no current Guide set')
      }

      const updatedGuide = updateStepCursorVisible(current.guide, stepId, visible)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)

      return { guide: updatedGuide }
    }
  )

  ipcMain.handle(
    'editor:deleteStep',
    async (_event, stepId: string): Promise<EditorActionResult> => {
      const current = getCurrentGuide()
      if (!current) {
        throw new Error('editor:deleteStep called with no current Guide set')
      }

      const updatedGuide = deleteStep(current.guide, stepId)
      await writeManifest(current.guidePath, updatedGuide)
      updateCurrentGuide(updatedGuide)

      return { guide: updatedGuide }
    }
  )

  ipcMain.handle(
    'image:read',
    async (_event, guidePath: string, imageFile: string): Promise<string> => {
      const imagePath = path.join(guidePath, imageFile)
      const buffer = await fs.readFile(imagePath)
      return `data:image/png;base64,${buffer.toString('base64')}`
    }
  )

  ipcMain.handle('export:json', async (event): Promise<string | null> => {
    const current = getCurrentGuide()
    if (!current) {
      throw new Error('export:json called with no current Guide set')
    }

    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const defaultPath = path.join(
      current.guidePath,
      `${sanitizeFilename(current.guide.title)}.json`
    )
    const dialogOptions = { defaultPath, filters: [{ name: 'JSON', extensions: ['json'] }] }
    const result = window
      ? await dialog.showSaveDialog(window, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)

    if (result.canceled || !result.filePath) return null

    await fs.writeFile(result.filePath, exportGuideAsJson(current.guide), 'utf-8')
    return result.filePath
  })

  ipcMain.handle('export:markdown', async (event): Promise<string | null> => {
    const current = getCurrentGuide()
    if (!current) {
      throw new Error('export:markdown called with no current Guide set')
    }

    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const defaultPath = path.join(current.guidePath, `${sanitizeFilename(current.guide.title)}.md`)
    const dialogOptions = { defaultPath, filters: [{ name: 'Markdown', extensions: ['md'] }] }
    const result = window
      ? await dialog.showSaveDialog(window, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)

    if (result.canceled || !result.filePath) return null

    await fs.writeFile(result.filePath, exportGuideAsMarkdown(current.guide), 'utf-8')
    return result.filePath
  })

  ipcMain.handle('export:pdf', async (event): Promise<string | null> => {
    const current = getCurrentGuide()
    if (!current) {
      throw new Error('export:pdf called with no current Guide set')
    }

    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const defaultPath = path.join(current.guidePath, `${sanitizeFilename(current.guide.title)}.pdf`)
    const dialogOptions = { defaultPath, filters: [{ name: 'PDF', extensions: ['pdf'] }] }
    const result = window
      ? await dialog.showSaveDialog(window, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)

    if (result.canceled || !result.filePath) return null

    const pdfBuffer = await exportGuideAsPdf(current.guide, current.guidePath)
    await fs.writeFile(result.filePath, pdfBuffer)
    return result.filePath
  })

  ipcMain.handle('export:getPrintData', async (): Promise<PrintData> => {
    const pending = getPendingPrintData()
    if (!pending) {
      throw new Error('export:getPrintData called with no pending print data set')
    }

    const threads: PrintThreadData[] = []
    for (const thread of pending.guide.threads) {
      const steps: PrintThreadData['steps'] = []
      for (const stepId of thread.stepIds) {
        const step = pending.guide.steps[stepId]
        if (!step) continue

        const imagePath = path.join(pending.guidePath, step.imageFile)
        const buffer = await fs.readFile(imagePath)
        steps.push({
          id: step.id,
          caption: step.caption,
          description: step.description,
          imageDataUrl: `data:image/png;base64,${buffer.toString('base64')}`
        })
      }
      threads.push({ id: thread.id, name: thread.name, steps })
    }

    return { title: pending.guide.title, threads }
  })

  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    return readSettings()
  })

  ipcMain.handle(
    'settings:updateHotkeys',
    async (_event, updates: Partial<HotkeyBindings>): Promise<AppSettings> => {
      const updatedSettings = await updateHotkeys(updates)
      // Take effect immediately - no app restart required (requirement 9).
      reregisterHotkeys(updatedSettings.hotkeys)
      return updatedSettings
    }
  )
}
