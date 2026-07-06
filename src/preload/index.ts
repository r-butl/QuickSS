import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  ConfirmCaptureInput,
  ConfirmCaptureResult,
  CreateThreadResult,
  CurrentGuideResult,
  EditorActionResult,
  GuideApi,
  GuideResult,
  PendingCaptureResult,
  PrintData,
  RecentGuideEntry,
  SettingsApi,
  StepContainer
} from '../shared/guideApi'
import type { Step } from '../shared/types'
import type { AppSettings, HotkeyBindings } from '../shared/settings'

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
  },
  reorderStep: (
    container: StepContainer,
    fromIndex: number,
    toIndex: number
  ): Promise<EditorActionResult> =>
    ipcRenderer.invoke('editor:reorderStep', container, fromIndex, toIndex),
  moveStep: (
    stepId: string,
    from: StepContainer,
    to: StepContainer,
    toIndex?: number
  ): Promise<EditorActionResult> =>
    ipcRenderer.invoke('editor:moveStep', stepId, from, to, toIndex),
  renameThread: (threadId: string, newName: string): Promise<EditorActionResult> =>
    ipcRenderer.invoke('editor:renameThread', threadId, newName),
  updateStep: (
    stepId: string,
    updates: Partial<Pick<Step, 'caption' | 'description'>>
  ): Promise<EditorActionResult> => ipcRenderer.invoke('editor:updateStep', stepId, updates),
  updateStepCrop: (stepId: string, crop: Step['crop']): Promise<EditorActionResult> =>
    ipcRenderer.invoke('editor:updateStepCrop', stepId, crop),
  deleteStep: (stepId: string): Promise<EditorActionResult> =>
    ipcRenderer.invoke('editor:deleteStep', stepId),
  readImage: (guidePath: string, imageFile: string): Promise<string> =>
    ipcRenderer.invoke('image:read', guidePath, imageFile),
  exportJson: (): Promise<string | null> => ipcRenderer.invoke('export:json'),
  exportMarkdown: (): Promise<string | null> => ipcRenderer.invoke('export:markdown'),
  exportPdf: (): Promise<string | null> => ipcRenderer.invoke('export:pdf'),
  getPrintData: (): Promise<PrintData> => ipcRenderer.invoke('export:getPrintData'),
  notifyPrintReady: (): void => {
    ipcRenderer.send('export:printReady')
  },
  notifyPrintFailed: (message: string): void => {
    ipcRenderer.send('export:printFailed', message)
  }
}

// Typed API wrapping the app's `settings:*` IPC channels (Task 11). Kept
// separate from `guideApi` since it addresses a different concern
// (app-level settings, not Guide content) - see `SettingsApi`'s doc comment.
const settingsApi: SettingsApi = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateHotkeys: (updates: Partial<HotkeyBindings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:updateHotkeys', updates)
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
    contextBridge.exposeInMainWorld('settingsApi', settingsApi)
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
  // @ts-ignore (define in dts)
  window.settingsApi = settingsApi
}
