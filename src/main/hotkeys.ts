import { globalShortcut } from 'electron'
import type { HotkeyBindings } from '../shared/settings'

export interface CaptureHotkeyHandlers {
  onFullScreen: () => void
  onRegion: () => void
  onCursorToggle: () => void
  onNewThread: () => void
  onToggleOverview: () => void
}

/**
 * Registers the five global capture hotkeys using the given `bindings`
 * (Task 11: configurable via the Settings panel - see `src/shared/settings.ts`
 * for the defaults, and `src/main/settings.ts` for how they're persisted).
 * `globalShortcut.register` returns `false` on failure (e.g. another app
 * already owns the shortcut) rather than throwing, so each registration's
 * return value is checked and failures are logged via `console.error`
 * without stopping the rest from being registered.
 */
export function registerCaptureHotkeys(
  bindings: HotkeyBindings,
  handlers: CaptureHotkeyHandlers
): void {
  const registrations: Array<[string, () => void]> = [
    [bindings.fullScreen, handlers.onFullScreen],
    [bindings.region, handlers.onRegion],
    [bindings.cursorToggle, handlers.onCursorToggle],
    [bindings.newThread, handlers.onNewThread],
    [bindings.toggleOverview, handlers.onToggleOverview]
  ]

  for (const [accelerator, handler] of registrations) {
    const ok = globalShortcut.register(accelerator, handler)
    if (!ok) {
      console.error(`Failed to register capture hotkey: ${accelerator}`)
    }
  }
}

/**
 * Unregisters all global shortcuts registered by this app. Wired to
 * `app.on('will-quit')` in `src/main/index.ts` so hotkeys don't leak past
 * the app's lifetime, and also called before re-registering with new
 * bindings when settings change (see `settings:updateHotkeys` in
 * `src/main/ipc.ts`).
 */
export function unregisterCaptureHotkeys(): void {
  globalShortcut.unregisterAll()
}
