import type { HotkeyBindings } from '../shared/settings'
import { CaptureHotkeyHandlers, registerCaptureHotkeys, unregisterCaptureHotkeys } from './hotkeys'

/**
 * Holds onto the one set of handler callbacks built in `src/main/index.ts`
 * so that a later settings change (Task 11's `settings:updateHotkeys` IPC
 * handler) can re-register the global hotkeys with new bindings without
 * losing/rebuilding the handler references. `index.ts` calls `initHotkeys`
 * once at startup; `src/main/ipc.ts` calls `reregisterHotkeys` whenever the
 * user changes a keybinding in the Settings screen.
 */
let capturedHandlers: CaptureHotkeyHandlers | null = null

export function initHotkeys(handlers: CaptureHotkeyHandlers, bindings: HotkeyBindings): void {
  capturedHandlers = handlers
  registerCaptureHotkeys(bindings, handlers)
}

/**
 * Unregisters all current global shortcuts and re-registers them with
 * `bindings`, reusing the handlers captured by `initHotkeys`. Throws if
 * called before `initHotkeys` (should never happen in practice - hotkeys
 * are initialized during `app.whenReady()`, before any IPC handler can
 * fire).
 */
export function reregisterHotkeys(bindings: HotkeyBindings): void {
  if (!capturedHandlers) {
    throw new Error('reregisterHotkeys called before initHotkeys')
  }
  unregisterCaptureHotkeys()
  registerCaptureHotkeys(bindings, capturedHandlers)
}
