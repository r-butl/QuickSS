import type { Guide, Step } from './types'
import type { StepContainer } from './manifest'

export type { StepContainer }

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

/**
 * Shape returned by every `editor:*` IPC handler (Task 8) - just the
 * updated Guide, since the main process is the source of truth and
 * broadcasts `guide:updated` separately anyway.
 */
export interface EditorActionResult {
  guide: Guide
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
  /** Reorders a step within a single thread/unsorted container. */
  reorderStep: (
    container: StepContainer,
    fromIndex: number,
    toIndex: number
  ) => Promise<EditorActionResult>
  /** Moves a step between two containers (thread/unsorted), including into/out of Unsorted. */
  moveStep: (
    stepId: string,
    from: StepContainer,
    to: StepContainer,
    toIndex?: number
  ) => Promise<EditorActionResult>
  /** Renames a thread. */
  renameThread: (threadId: string, newName: string) => Promise<EditorActionResult>
  /** Updates a step's caption/description. */
  updateStep: (
    stepId: string,
    updates: Partial<Pick<Step, 'caption' | 'description'>>
  ) => Promise<EditorActionResult>
  /** Deletes a step from the Guide and whichever container holds it. */
  deleteStep: (stepId: string) => Promise<EditorActionResult>
  /**
   * Reads a Step's image file off disk and returns it as a
   * `data:image/png;base64,...` URL for direct use in an `<img src>`.
   */
  readImage: (guidePath: string, imageFile: string) => Promise<string>
}
