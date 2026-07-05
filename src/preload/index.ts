import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { GuideApi, GuideResult, RecentGuideEntry } from '../shared/guideApi'

// Typed API wrapping the app's `guide:*` IPC channels. This is the only
// surface the renderer uses to talk to the main process for Guide
// create/open/list operations - no raw `ipcRenderer` access in renderer code.
const guideApi: GuideApi = {
  create: (title: string, basePath?: string): Promise<GuideResult> =>
    ipcRenderer.invoke('guide:create', basePath, title),
  open: (guidePath: string): Promise<GuideResult> => ipcRenderer.invoke('guide:open', guidePath),
  openViaDialog: (): Promise<GuideResult | null> => ipcRenderer.invoke('guide:openViaDialog'),
  listRecent: (): Promise<RecentGuideEntry[]> => ipcRenderer.invoke('guide:listRecent')
}

// Custom APIs for renderer
const api = {}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    contextBridge.exposeInMainWorld('guideApi', guideApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  // @ts-ignore (define in dts)
  window.guideApi = guideApi
}
