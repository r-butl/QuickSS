import { globalShortcut } from 'electron'
import { DEFAULT_HOTKEYS, type HotkeyBindings } from '../shared/settings'

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
 * `globalShortcut.register` returns `false` for some failures (e.g. another
 * app already owns the shortcut) but *throws* for a malformed accelerator
 * string (e.g. non-ASCII characters that slipped into a saved binding), so
 * each registration is wrapped in `tryRegister` below. A failure of either
 * kind falls back to that binding's built-in default rather than leaving
 * the hotkey unregistered or letting the exception escape and abort the
 * rest of app startup (see `src/main/index.ts`'s `app.whenReady()` handler,
 * which would never reach `createWindow()` if this threw).
 */
export function registerCaptureHotkeys(
  bindings: HotkeyBindings,
  handlers: CaptureHotkeyHandlers
): void {
  const registrations: Array<[keyof HotkeyBindings, () => void]> = [
    ['fullScreen', handlers.onFullScreen],
    ['region', handlers.onRegion],
    ['cursorToggle', handlers.onCursorToggle],
    ['newThread', handlers.onNewThread],
    ['toggleOverview', handlers.onToggleOverview]
  ]

  for (const [binding, handler] of registrations) {
    const accelerator = bindings[binding]
    if (tryRegister(accelerator, handler)) continue

    console.error(
      `Failed to register capture hotkey "${binding}": "${accelerator}" is not a valid ` +
        `accelerator. Falling back to the default binding "${DEFAULT_HOTKEYS[binding]}".`
    )

    const fallback = DEFAULT_HOTKEYS[binding]
    if (!tryRegister(fallback, handler)) {
      console.error(`Failed to register default capture hotkey "${binding}": "${fallback}".`)
    }
  }
}

function tryRegister(accelerator: string, handler: () => void): boolean {
  try {
    return globalShortcut.register(accelerator, handler)
  } catch (err) {
    console.error(`globalShortcut.register threw for "${accelerator}":`, err)
    return false
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
