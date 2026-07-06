import type { Guide, Step } from './types'

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

/**
 * Shape returned by `preview:getPending` for the pending-capture preview
 * window. The image is pre-converted to a `data:image/png;base64,...` URL
 * in the main process (`src/main/ipc.ts`) so the renderer can hand it
 * straight to an `<img src>` without touching raw buffers.
 */
export interface PendingCaptureResult {
  imageDataUrl: string
  cursor: { x: number; y: number }
  cursorVisible: boolean
  crop: { x: number; y: number; width: number; height: number } | null
}

export interface ConfirmCaptureInput {
  caption: string
  description: string
}

export interface ConfirmCaptureResult {
  guide: Guide
  step: Step
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
  /** Fetches the currently pending capture, if any, for the preview window. */
  getPendingCapture: () => Promise<PendingCaptureResult | null>
  /** Confirms the pending capture: persists it as a new Step and clears it. */
  confirmCapture: (input: ConfirmCaptureInput) => Promise<ConfirmCaptureResult>
  /** Discards the pending capture with no persistence. */
  discardCapture: () => Promise<void>
  /**
   * Subscribes to live cursor-visibility toggles (from the global
   * cursor-toggle hotkey) while the preview window is open. Returns an
   * unsubscribe function.
   */
  onCursorToggled: (callback: (cursorVisible: boolean) => void) => () => void
}
