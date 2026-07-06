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

export interface CurrentGuideResult {
  guidePath: string
  guide: Guide
}

export interface CreateThreadResult {
  guide: Guide
  threadId: string
}

export interface GuideApi {
  create: (title: string, basePath?: string) => Promise<GuideResult>
  open: (guidePath: string) => Promise<GuideResult>
  openViaDialog: () => Promise<GuideResult | null>
  listRecent: () => Promise<RecentGuideEntry[]>
  /** Main-process-owned current Guide state (see `src/main/guideState.ts`). */
  getCurrent: () => Promise<CurrentGuideResult | null>
  createThread: () => Promise<CreateThreadResult>
  /**
   * Subscribes to `guide:updated` broadcasts sent whenever the main
   * process's current-Guide state changes. Returns an unsubscribe function.
   */
  onGuideUpdated: (callback: (payload: CurrentGuideResult) => void) => () => void
  /**
   * Sent by the command HUD window to ask the main window to toggle its
   * capture/overview screen. Forwarded by the main process to the main
   * window specifically via `onToggleOverviewRequested`.
   */
  requestToggleOverview: () => void
  /** Used by the main window to receive toggle requests forwarded from the command HUD. */
  onToggleOverviewRequested: (callback: () => void) => () => void
}
