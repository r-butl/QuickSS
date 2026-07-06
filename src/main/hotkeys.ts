import { globalShortcut } from 'electron'

export interface CaptureHotkeyHandlers {
  onFullScreen: () => void
  onRegion: () => void
  onCursorToggle: () => void
  onNewThread: () => void
  onToggleOverview: () => void
}

/**
 * Default Accelerator strings for the capture hotkeys (requirement 13).
 * These are defaults only — Task 13 (Settings panel) will make them
 * configurable. `CommandOrControl` is used so the same source works on both
 * macOS and Windows/Linux without per-OS branching. A real conflict check
 * against OS/app-reserved shortcuts requires human verification on real
 * machines — not attempted here.
 */
const ACCELERATORS = {
  fullScreen: 'CommandOrControl+Shift+F',
  region: 'CommandOrControl+Shift+R',
  cursorToggle: 'CommandOrControl+Shift+C',
  newThread: 'CommandOrControl+Shift+N',
  toggleOverview: 'CommandOrControl+Shift+O'
} as const

/**
 * Registers the five global capture hotkeys. `globalShortcut.register`
 * returns `false` on failure (e.g. another app already owns the shortcut)
 * rather than throwing, so each registration's return value is checked and
 * failures are logged via `console.error` without stopping the rest from
 * being registered.
 */
export function registerCaptureHotkeys(handlers: CaptureHotkeyHandlers): void {
  const registrations: Array<[string, () => void]> = [
    [ACCELERATORS.fullScreen, handlers.onFullScreen],
    [ACCELERATORS.region, handlers.onRegion],
    [ACCELERATORS.cursorToggle, handlers.onCursorToggle],
    [ACCELERATORS.newThread, handlers.onNewThread],
    [ACCELERATORS.toggleOverview, handlers.onToggleOverview]
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
 * the app's lifetime.
 */
export function unregisterCaptureHotkeys(): void {
  globalShortcut.unregisterAll()
}
