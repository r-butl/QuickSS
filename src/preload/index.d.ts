import { ElectronAPI } from '@electron-toolkit/preload'
import type { GuideApi } from '../shared/guideApi'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    guideApi: GuideApi
  }
}
