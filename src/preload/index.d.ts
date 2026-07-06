import { ElectronAPI } from '@electron-toolkit/preload'
import type { GuideApi, SettingsApi } from '../shared/guideApi'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    guideApi: GuideApi
    settingsApi: SettingsApi
  }
}
