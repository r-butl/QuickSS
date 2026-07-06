/**
 * Pure types + defaults + parse/serialize for the app's persisted settings
 * file (`<userData>/settings.json`). No `fs`/Electron imports here, same
 * purity rule as `src/shared/types.ts` - the actual file I/O lives in
 * `src/main/settings.ts`.
 */

export interface HotkeyBindings {
  fullScreen: string
  region: string
  cursorToggle: string
  newThread: string
  toggleOverview: string
}

export interface AppSettings {
  settingsVersion: 1
  hotkeys: HotkeyBindings
}

/**
 * The exact Accelerator strings Task 5 originally hardcoded in
 * `src/main/hotkeys.ts`. This is now the single source of truth for the
 * defaults - `hotkeys.ts` no longer keeps its own copy.
 */
export const DEFAULT_HOTKEYS: HotkeyBindings = {
  fullScreen: 'CommandOrControl+Shift+F',
  region: 'CommandOrControl+Shift+R',
  cursorToggle: 'CommandOrControl+Shift+C',
  newThread: 'CommandOrControl+Shift+N',
  toggleOverview: 'CommandOrControl+Shift+O'
}

export function defaultSettings(): AppSettings {
  return {
    settingsVersion: 1,
    hotkeys: { ...DEFAULT_HOTKEYS }
  }
}

/**
 * Same validation pattern as `parseManifest` (Task 2): checks
 * `settingsVersion === 1` and throws a clear, named error otherwise.
 */
export function parseSettings(json: string): AppSettings {
  const parsed = JSON.parse(json)

  if (parsed.settingsVersion === undefined) {
    throw new Error('settingsVersion field is missing')
  }

  if (parsed.settingsVersion !== 1) {
    throw new Error(`settingsVersion must be 1, got ${parsed.settingsVersion}`)
  }

  return parsed as AppSettings
}

export function serializeSettings(settings: AppSettings): string {
  return JSON.stringify(settings, null, 2)
}
