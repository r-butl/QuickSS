/**
 * Converts a captured keydown combination into an Electron Accelerator
 * string (e.g. `CommandOrControl+Shift+F`). Extracted from
 * `SettingsScreen.tsx` (rather than left inline) so this - the trickiest,
 * easiest-to-get-subtly-wrong part of the keybinding-capture UI - is a
 * plain, exported, unit-testable function (same reasoning as
 * `src/renderer/src/lib/cropConversion.ts`'s coordinate conversion).
 *
 * `CommandOrControl` is used for the Ctrl/Cmd modifier (rather than
 * emitting a platform-specific `Control` or `Command`) so a single saved
 * binding works cross-platform, matching the convention `src/main/hotkeys.ts`
 * already used for the hardcoded defaults.
 *
 * Returns `null` if the combination has no modifier key at all (Ctrl/Cmd,
 * Shift, or Alt) - a bare key like `F` is rejected as too easy to trigger
 * by accident and too likely to collide with normal typing/OS shortcuts.
 * Also returns `null` if the key itself is only a modifier (e.g. pressing
 * just "Shift" fires a keydown with `key === 'Shift'` and no other
 * modifier-worthy key to pair it with).
 */

export interface KeyCombo {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt'])

/**
 * Maps a `KeyboardEvent.key` value to the token Electron's Accelerator
 * parser expects. Single printable characters are upper-cased (Electron
 * expects e.g. `F`, not `f`); everything else is mapped explicitly since
 * `event.key` spells named keys differently than Electron does (e.g.
 * `ArrowUp` vs Electron's `Up`).
 */
function keyToAcceleratorToken(key: string): string | null {
  const namedKeys: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space',
    Escape: 'Esc',
    Delete: 'Delete',
    Backspace: 'Backspace',
    Tab: 'Tab',
    Enter: 'Return'
  }

  if (key in namedKeys) {
    return namedKeys[key]
  }

  // Only plain ASCII letters/digits/punctuation are valid Electron
  // accelerator tokens. Some keyboard layouts produce a composed,
  // non-ASCII `key` for Alt/Alt+Shift combinations (e.g. `Í`) - those must
  // be rejected here rather than passed through, since Electron's
  // accelerator parser throws on non-ASCII input instead of just failing
  // to register.
  if (key.length === 1 && key.charCodeAt(0) < 128) {
    return key.toUpperCase()
  }

  // Function keys (F1-F24) already match Electron's expected token as-is.
  if (/^F\d{1,2}$/.test(key)) {
    return key
  }

  return null
}

/**
 * Builds an Electron Accelerator string from a captured key combination,
 * or returns `null` if the combo has no modifier or isn't a recognized key.
 */
export function comboToAccelerator(combo: KeyCombo): string | null {
  if (MODIFIER_KEYS.has(combo.key)) {
    return null
  }

  const token = keyToAcceleratorToken(combo.key)
  if (!token) {
    return null
  }

  const hasModifier = combo.ctrlKey || combo.metaKey || combo.shiftKey || combo.altKey
  if (!hasModifier) {
    return null
  }

  const parts: string[] = []
  if (combo.ctrlKey || combo.metaKey) {
    parts.push('CommandOrControl')
  }
  if (combo.altKey) {
    parts.push('Alt')
  }
  if (combo.shiftKey) {
    parts.push('Shift')
  }
  parts.push(token)

  return parts.join('+')
}
