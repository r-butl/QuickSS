/**
 * Pending-capture state machine (Task 7). Holds the single in-flight
 * capture between the moment a capture hotkey fires and the moment the user
 * confirms or discards it in the preview window.
 *
 * Deliberately has no `electron` import at all: the "show the preview
 * window" and "notify the open preview of a live cursor-visibility change"
 * side effects are injected via `initCaptureFlow` rather than importing
 * `./windows/previewWindow` directly. `src/main/index.ts` wires the real
 * Electron-backed callbacks at startup; unit tests wire fake ones, so this
 * module's state transitions are testable without a real `BrowserWindow`.
 */
export interface PendingCapture {
  imageBuffer: Buffer
  cursor: { x: number; y: number }
  crop: { x: number; y: number; width: number; height: number } | null
  cursorVisible: boolean
}

export interface CaptureFlowCallbacks {
  /** Called after a new capture becomes pending, to show/focus the preview window. */
  showPreview: () => void
  /** Called after `toggleCursorVisible` changes state, with the new value, so the open preview's live overlay can update. */
  onCursorToggled: (cursorVisible: boolean) => void
}

let pendingCapture: PendingCapture | null = null
let callbacks: CaptureFlowCallbacks | null = null

/**
 * Wires the real side-effect callbacks. Must be called once during the
 * app's ready flow (see `src/main/index.ts`), before any hotkey can trigger
 * a capture. Tests call this with fake callbacks instead.
 */
export function initCaptureFlow(cb: CaptureFlowCallbacks): void {
  callbacks = cb
}

/**
 * Records a newly-captured image as the pending capture and asks the
 * injected callback to show the preview window.
 *
 * `cursorVisible` always starts `false`: requirement 7 stores the cursor
 * position unconditionally but treats its on-screen visibility as a
 * per-capture toggle the user opts into (via the cursor-toggle hotkey)
 * rather than an on-by-default overlay. This is a judgment call in the
 * absence of a more explicit default in feature-requirements.md.
 */
export function startPendingCapture(capture: {
  imageBuffer: Buffer
  cursor: { x: number; y: number }
  crop?: { x: number; y: number; width: number; height: number } | null
}): void {
  pendingCapture = {
    imageBuffer: capture.imageBuffer,
    cursor: capture.cursor,
    crop: capture.crop ?? null,
    cursorVisible: false
  }
  callbacks?.showPreview()
}

export function getPendingCapture(): PendingCapture | null {
  return pendingCapture
}

/**
 * Flips the pending capture's `cursorVisible` flag. A genuine no-op (not an
 * error) when nothing is pending - this is wired to a *global* hotkey
 * (requirement 13), so it fires even when the user hasn't just captured
 * anything, and firing "outside" a preview must be silently ignored rather
 * than throwing or logging noise.
 */
export function toggleCursorVisible(): void {
  if (!pendingCapture) return
  pendingCapture = { ...pendingCapture, cursorVisible: !pendingCapture.cursorVisible }
  callbacks?.onCursorToggled(pendingCapture.cursorVisible)
}

export function clearPendingCapture(): void {
  pendingCapture = null
}
