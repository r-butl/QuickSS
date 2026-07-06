import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ConfirmCaptureInput,
  ConfirmCaptureResult,
  CreateThreadResult,
  CurrentGuideResult,
  GuideApi,
  GuideResult,
  PendingCaptureResult,
  RecentGuideEntry
} from '../shared/guideApi'

// Typed API wrapping the app's `guide:*` IPC channels. This is the only
// surface the renderer uses to talk to the main process for Guide
// create/open/list operations - no raw `ipcRenderer` access in renderer code.
const guideApi: GuideApi = {
  create: (title: string, basePath?: string): Promise<GuideResult> =>
    ipcRenderer.invoke('guide:create', basePath, title),
  open: (guidePath: string): Promise<GuideResult> => ipcRenderer.invoke('guide:open', guidePath),
  openViaDialog: (): Promise<GuideResult | null> => ipcRenderer.invoke('guide:openViaDialog'),
  listRecent: (): Promise<RecentGuideEntry[]> => ipcRenderer.invoke('guide:listRecent'),
  getCurrent: (): Promise<CurrentGuideResult | null> => ipcRenderer.invoke('guide:getCurrent'),
  createThread: (): Promise<CreateThreadResult> => ipcRenderer.invoke('guide:createThread'),
  onGuideUpdated: (callback: (payload: CurrentGuideResult) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CurrentGuideResult): void =>
      callback(payload)
    ipcRenderer.on('guide:updated', listener)
    return () => ipcRenderer.removeListener('guide:updated', listener)
  },
  requestToggleOverview: (): void => {
    ipcRenderer.send('app:requestToggleOverview')
  },
  onToggleOverviewRequested: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('app:toggleOverview', listener)
    return () => ipcRenderer.removeListener('app:toggleOverview', listener)
  },
  getPendingCapture: (): Promise<PendingCaptureResult | null> =>
    ipcRenderer.invoke('preview:getPending'),
  confirmCapture: (input: ConfirmCaptureInput): Promise<ConfirmCaptureResult> =>
    ipcRenderer.invoke('preview:confirm', input),
  discardCapture: (): Promise<void> => ipcRenderer.invoke('preview:discard'),
  onCursorToggled: (callback: (cursorVisible: boolean) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, cursorVisible: boolean): void =>
      callback(cursorVisible)
    ipcRenderer.on('preview:cursorToggled', listener)
    return () => ipcRenderer.removeListener('preview:cursorToggled', listener)
  }
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
