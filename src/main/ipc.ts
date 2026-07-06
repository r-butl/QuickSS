import * as fs from 'fs/promises'
import * as path from 'path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { GuideResult } from '../shared/guideApi'
import { createGuideFolder, readManifest, writeManifest } from './persistence'
import { addRecentGuide, readRecentGuides } from './recentGuides'
import { createThread } from '../shared/manifest'
import {
  getCurrentGuide,
  setCurrentGuide,
  updateCurrentGuide,
  type CurrentGuideState
} from './guideState'
import { createOrShowCommandWindow } from './windows/commandWindow'
import { getMainWindow } from './windows/windowRegistry'

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
    const current = getCurrentGuide()
    if (!current) {
      throw new Error('guide:createThread called with no current Guide set')
    }

    const { guide: updatedGuide, thread } = createThread(current.guide)
    updateCurrentGuide(updatedGuide)
    await writeManifest(current.guidePath, updatedGuide)

    return { guide: updatedGuide, threadId: thread.id }
  })

  ipcMain.handle('guide:getCurrent', async (): Promise<CurrentGuideState | null> => {
    return getCurrentGuide()
  })

  ipcMain.on('app:requestToggleOverview', () => {
    getMainWindow()?.webContents.send('app:toggleOverview')
  })
}
