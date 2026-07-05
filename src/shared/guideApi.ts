import type { Guide } from './types'

/**
 * Shared type contract for the `guideApi` surface exposed by the preload
 * script via `contextBridge`. Lives in `shared/` so both the preload
 * implementation and the renderer's ambient type declarations can import
 * it without either side reaching into the other's process-specific code.
 */
export interface RecentGuideEntry {
  path: string
  title: string
  lastOpenedAt: string
}

export interface GuideResult {
  guidePath: string
  guide: Guide
}

export interface GuideApi {
  create: (title: string, basePath?: string) => Promise<GuideResult>
  open: (guidePath: string) => Promise<GuideResult>
  openViaDialog: () => Promise<GuideResult | null>
  listRecent: () => Promise<RecentGuideEntry[]>
}
