import { describe, expect, it } from 'vitest'
import { comboToAccelerator, type KeyCombo } from './accelerator'

function combo(overrides: Partial<KeyCombo>): KeyCombo {
  return { key: 'F', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...overrides }
}

describe('comboToAccelerator', () => {
  it('builds CommandOrControl+Shift+F from Ctrl+Shift+F', () => {
    expect(comboToAccelerator(combo({ key: 'f', ctrlKey: true, shiftKey: true }))).toBe(
      'CommandOrControl+Shift+F'
    )
  })

  it('builds CommandOrControl+Shift+F from Cmd+Shift+F (metaKey, macOS)', () => {
    expect(comboToAccelerator(combo({ key: 'f', metaKey: true, shiftKey: true }))).toBe(
      'CommandOrControl+Shift+F'
    )
  })

  it('does not double up CommandOrControl when both ctrlKey and metaKey are set', () => {
    expect(
      comboToAccelerator(combo({ key: 'f', ctrlKey: true, metaKey: true, shiftKey: true }))
    ).toBe('CommandOrControl+Shift+F')
  })

  it('includes Alt when altKey is set', () => {
    expect(comboToAccelerator(combo({ key: 'r', ctrlKey: true, altKey: true }))).toBe(
      'CommandOrControl+Alt+R'
    )
  })

  it('orders modifiers as CommandOrControl, Alt, Shift, key', () => {
    expect(
      comboToAccelerator(combo({ key: 'n', ctrlKey: true, altKey: true, shiftKey: true }))
    ).toBe('CommandOrControl+Alt+Shift+N')
  })

  it('rejects a combo with no modifier at all', () => {
    expect(comboToAccelerator(combo({ key: 'f' }))).toBeNull()
  })

  it('rejects a bare Shift-only combo (shift with no other key)', () => {
    expect(comboToAccelerator(combo({ key: 'Shift', shiftKey: true }))).toBeNull()
  })

  it('rejects a bare Control-only combo', () => {
    expect(comboToAccelerator(combo({ key: 'Control', ctrlKey: true }))).toBeNull()
  })

  it('upper-cases single-character keys', () => {
    expect(comboToAccelerator(combo({ key: 'o', ctrlKey: true }))).toBe('CommandOrControl+O')
  })

  it('maps named keys to their Electron Accelerator tokens', () => {
    expect(comboToAccelerator(combo({ key: 'ArrowUp', ctrlKey: true }))).toBe('CommandOrControl+Up')
    expect(comboToAccelerator(combo({ key: ' ', ctrlKey: true }))).toBe('CommandOrControl+Space')
    expect(comboToAccelerator(combo({ key: 'Escape', ctrlKey: true }))).toBe('CommandOrControl+Esc')
  })

  it('accepts function keys as-is', () => {
    expect(comboToAccelerator(combo({ key: 'F5', ctrlKey: true }))).toBe('CommandOrControl+F5')
  })

  it('returns null for unrecognized keys', () => {
    expect(comboToAccelerator(combo({ key: 'Unidentified', ctrlKey: true }))).toBeNull()
  })
})
