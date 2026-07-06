import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import {
  AppSettings,
  HotkeyBindings,
  defaultSettings,
  parseSettings,
  serializeSettings
} from '../shared/settings'
import { atomicWriteFile } from './persistence'

/**
 * Default location for the settings file, matching Task 1's decision that
 * settings are app-level (not per-Guide): `<userData>/settings.json`.
 * `readSettings`/`writeSettings`/`updateHotkeys` all accept the settings
 * file path as an explicit parameter (defaulting to this function's
 * result), mirroring how `persistence.ts`'s functions take explicit paths
 * rather than reading Electron globals internally - this keeps them
 * testable with real temp directories, without a running Electron app.
 */
function defaultSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

/**
 * Reads and parses the settings file. If it doesn't exist yet (ENOENT),
 * returns `defaultSettings()` without throwing and without writing
 * anything to disk - a settings file is only ever created by an explicit
 * write (e.g. `updateHotkeys`).
 */
export async function readSettings(
  settingsPath: string = defaultSettingsPath()
): Promise<AppSettings> {
  try {
    const contents = await fs.readFile(settingsPath, 'utf-8')
    return parseSettings(contents)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultSettings()
    }
    throw err
  }
}

/**
 * Serializes `settings` and atomically writes it to the settings file,
 * creating the parent directory (userData) if needed.
 */
export async function writeSettings(
  settings: AppSettings,
  settingsPath: string = defaultSettingsPath()
): Promise<void> {
  await fs.mkdir(path.dirname(settingsPath), { recursive: true })
  await atomicWriteFile(settingsPath, serializeSettings(settings))
}

/**
 * Reads current settings, merges `updates` into `hotkeys` (only the
 * provided fields are replaced - unrelated bindings are left untouched),
 * writes the result, and returns the updated settings.
 */
export async function updateHotkeys(
  updates: Partial<HotkeyBindings>,
  settingsPath: string = defaultSettingsPath()
): Promise<AppSettings> {
  const current = await readSettings(settingsPath)
  const updated: AppSettings = {
    ...current,
    hotkeys: { ...current.hotkeys, ...updates }
  }
  await writeSettings(updated, settingsPath)
  return updated
}
