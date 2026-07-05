import * as fs from 'fs/promises'
import * as path from 'path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { GuideResult } from '../shared/guideApi'
import { createGuideFolder, readManifest } from './persistence'
import { addRecentGuide, readRecentGuides } from './recentGuides'

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
    return { guidePath, guide }
  })

  ipcMain.handle('guide:open', async (_event, guidePath: string) => {
    return openGuideAtPath(guidePath)
  })

  ipcMain.handle('guide:openViaDialog', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const result = window
      ? await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
      : await dialog.showOpenDialog({ properties: ['openDirectory'] })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return openGuideAtPath(result.filePaths[0])
  })

  ipcMain.handle('guide:listRecent', async () => {
    return readRecentGuides()
  })
}
