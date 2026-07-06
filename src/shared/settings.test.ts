import { describe, expect, it } from 'vitest'
import { DEFAULT_HOTKEYS, defaultSettings, parseSettings, serializeSettings } from './settings'

describe('defaultSettings', () => {
  it('produces valid shape with settingsVersion: 1 and DEFAULT_HOTKEYS', () => {
    const settings = defaultSettings()
    expect(settings.settingsVersion).toBe(1)
    expect(settings.hotkeys).toEqual(DEFAULT_HOTKEYS)
  })

  it('returns a fresh object each call (not a shared reference)', () => {
    const a = defaultSettings()
    const b = defaultSettings()
    expect(a).not.toBe(b)
    expect(a.hotkeys).not.toBe(b.hotkeys)
  })
})

describe('parseSettings and serializeSettings', () => {
  it('round-trips: serialized then parsed equals original', () => {
    const original = defaultSettings()
    original.hotkeys.fullScreen = 'CommandOrControl+Shift+X'

    const serialized = serializeSettings(original)
    const parsed = parseSettings(serialized)

    expect(parsed).toEqual(original)
  })

  it('serializeSettings produces pretty-printed JSON', () => {
    const serialized = serializeSettings(defaultSettings())
    expect(serialized).toContain('\n')
  })

  it('throws clear error on missing settingsVersion', () => {
    const json = JSON.stringify({ hotkeys: DEFAULT_HOTKEYS })
    expect(() => parseSettings(json)).toThrowError('settingsVersion field is missing')
  })

  it('throws clear error on wrong settingsVersion', () => {
    const json = JSON.stringify({ settingsVersion: 2, hotkeys: DEFAULT_HOTKEYS })
    expect(() => parseSettings(json)).toThrowError('settingsVersion must be 1, got 2')
  })

  it('accepts valid settings with settingsVersion: 1', () => {
    const serialized = serializeSettings(defaultSettings())
    const parsed = parseSettings(serialized)
    expect(parsed.settingsVersion).toBe(1)
  })
})
