import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { readSettings, updateHotkeys, writeSettings } from './settings'
import { DEFAULT_HOTKEYS, defaultSettings } from '../shared/settings'

const tempDirs: string[] = []

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'doctool-settings-'))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('readSettings', () => {
  it('returns defaultSettings() without throwing or writing when the file does not exist', async () => {
    const dir = await makeTempDir()
    const settingsPath = path.join(dir, 'settings.json')

    const settings = await readSettings(settingsPath)

    expect(settings).toEqual(defaultSettings())
    await expect(fs.stat(settingsPath)).rejects.toThrow()
  })

  it('reads back settings previously written', async () => {
    const dir = await makeTempDir()
    const settingsPath = path.join(dir, 'settings.json')
    const custom = {
      ...defaultSettings(),
      hotkeys: { ...DEFAULT_HOTKEYS, fullScreen: 'CommandOrControl+Shift+X' }
    }

    await writeSettings(custom, settingsPath)
    const readBack = await readSettings(settingsPath)

    expect(readBack).toEqual(custom)
  })
})

describe('writeSettings', () => {
  it('creates the parent directory if needed and writes atomically', async () => {
    const dir = await makeTempDir()
    const settingsPath = path.join(dir, 'nested', 'settings.json')

    await writeSettings(defaultSettings(), settingsPath)

    const entries = await fs.readdir(path.join(dir, 'nested'))
    expect(entries).toEqual(['settings.json'])
  })
})

describe('updateHotkeys', () => {
  it('merges only the provided partial fields, leaving unrelated bindings untouched', async () => {
    const dir = await makeTempDir()
    const settingsPath = path.join(dir, 'settings.json')

    await writeSettings(defaultSettings(), settingsPath)
    const updated = await updateHotkeys({ region: 'CommandOrControl+Shift+Z' }, settingsPath)

    expect(updated.hotkeys.region).toBe('CommandOrControl+Shift+Z')
    expect(updated.hotkeys.fullScreen).toBe(DEFAULT_HOTKEYS.fullScreen)
    expect(updated.hotkeys.cursorToggle).toBe(DEFAULT_HOTKEYS.cursorToggle)
    expect(updated.hotkeys.newThread).toBe(DEFAULT_HOTKEYS.newThread)
    expect(updated.hotkeys.toggleOverview).toBe(DEFAULT_HOTKEYS.toggleOverview)

    const readBack = await readSettings(settingsPath)
    expect(readBack).toEqual(updated)
  })

  it('works starting from no existing settings file (defaults + merge)', async () => {
    const dir = await makeTempDir()
    const settingsPath = path.join(dir, 'settings.json')

    const updated = await updateHotkeys({ newThread: 'CommandOrControl+Shift+T' }, settingsPath)

    expect(updated.hotkeys.newThread).toBe('CommandOrControl+Shift+T')
    expect(updated.hotkeys.fullScreen).toBe(DEFAULT_HOTKEYS.fullScreen)
  })
})
