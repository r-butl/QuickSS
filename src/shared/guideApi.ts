import type { Guide, Step } from './types'
import type { StepContainer } from './manifest'
import type { AppSettings, HotkeyBindings } from './settings'

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
  /**
   * The thread a new capture's confirm step would attach to right now (see
   * `src/main/guideState.ts`'s `activeThreadId`), or `null` if the guide has
   * no threads yet. Exposed here so the command HUD can mark which thread
   * is "active" in its tally (requirement 2's example format).
   */
  activeThreadId: string | null
}

/**
 * The main window's two Guide-editing screens - kept here (rather than only
 * in the renderer's `appStore.ts` `Screen` union) since `notifyModeChanged`
 * is part of the cross-process `GuideApi` contract.
 */
export type GuideMode = 'capture' | 'overview'

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

/**
 * Shape consumed by the hidden print-view renderer (`PrintView.tsx`,
 * mounted at `?windowRole=export-print`) via `export:getPrintData`.
 * Unsorted-bucket steps are already excluded by the main process (same
 * rule as `exportGuideAsMarkdown` - see `src/main/export.ts`), and each
 * step's image is pre-converted to a `data:image/png;base64,...` URL so
 * the print view renders correctly regardless of where the final exported
 * file ends up on disk.
 */
export interface PrintStepData {
  id: string
  caption: string
  description: string
  imageDataUrl: string
}

export interface PrintThreadData {
  id: string
  name: string
  steps: PrintStepData[]
}

export interface PrintData {
  title: string
  threads: PrintThreadData[]
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
  /**
   * Tells the main process which of the main window's two Guide-editing
   * screens is now active, so it can keep the main window and command HUD
   * mutually exclusive: overview hides the HUD (its quick-capture controls
   * aren't relevant while reviewing), capture hides the main window (that
   * screen has no interactive controls of its own - see `CaptureScreen`'s
   * doc comment). Not sent for the picker/settings screens.
   */
  notifyModeChanged: (mode: GuideMode) => void
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
  /**
   * Updates a step's crop rectangle. `crop: null` clears the crop, fully
   * restoring the full original frame - crop is metadata-only and never
   * mutates the underlying image file.
   */
  updateStepCrop: (stepId: string, crop: Step['crop']) => Promise<EditorActionResult>
  /**
   * Updates a step's cursor-visibility flag. Editable at any time in
   * overview mode (requirement 7), not just during the preview flow.
   */
  updateStepCursorVisible: (stepId: string, visible: boolean) => Promise<EditorActionResult>
  /** Deletes a step from the Guide and whichever container holds it. */
  deleteStep: (stepId: string) => Promise<EditorActionResult>
  /**
   * Reads a Step's image file off disk and returns it as a
   * `data:image/png;base64,...` URL for direct use in an `<img src>`.
   */
  readImage: (guidePath: string, imageFile: string) => Promise<string>
  /**
   * Exports the current Guide as JSON via a save dialog. Resolves to the
   * saved path, or `null` if the user cancelled the dialog.
   */
  exportJson: () => Promise<string | null>
  /** Same as `exportJson`, but as the Markdown "tutorial" template. */
  exportMarkdown: () => Promise<string | null>
  /** Same as `exportJson`, but rendered to PDF via the hidden print view. */
  exportPdf: () => Promise<string | null>
  /**
   * Fetches the current Guide's print-ready data (threads/steps, unsorted
   * excluded, images pre-converted to base64 data URLs). Used only by the
   * hidden print-view renderer (`PrintView.tsx`).
   */
  getPrintData: () => Promise<PrintData>
  /**
   * Sent by the print-view renderer once it has finished fetching
   * `getPrintData()` and rendering the result, so the main process knows
   * it's safe to call `printToPDF()`.
   */
  notifyPrintReady: () => void
  /**
   * Sent by the print-view renderer if fetching/rendering `getPrintData()`
   * fails, so the main process can fail the export instead of silently
   * calling `printToPDF()` on an empty page and producing a blank PDF.
   */
  notifyPrintFailed: (message: string) => void
}

/**
 * Small, separately-exposed API surface for the Settings screen (Task 11),
 * kept apart from `GuideApi` since it addresses an entirely different
 * concern (app-level settings, not Guide content) - exposed via
 * `contextBridge` as `window.settingsApi`.
 */
export interface SettingsApi {
  /** Fetches the current persisted settings (defaults if none saved yet). */
  getSettings: () => Promise<AppSettings>
  /**
   * Merges `updates` into the persisted hotkey bindings and re-registers
   * the global hotkeys immediately (no app restart required). Returns the
   * full updated settings.
   */
  updateHotkeys: (updates: Partial<HotkeyBindings>) => Promise<AppSettings>
}
