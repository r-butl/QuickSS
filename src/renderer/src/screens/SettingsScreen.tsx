import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { comboToAccelerator } from '../lib/accelerator'
import type { HotkeyBindings } from '../../../shared/settings'

const BINDING_LABELS: Record<keyof HotkeyBindings, string> = {
  fullScreen: 'Capture Full Screen',
  region: 'Capture Region',
  cursorToggle: 'Toggle Cursor Visibility',
  newThread: 'New Thread',
  toggleOverview: 'Toggle Overview'
}

const BINDING_ORDER: Array<keyof HotkeyBindings> = [
  'fullScreen',
  'region',
  'cursorToggle',
  'newThread',
  'toggleOverview'
]

/**
 * Settings screen (Task 11): lets the user view and re-bind the five
 * global capture hotkeys. Clicking "Change" for a binding starts listening
 * for the next keydown; the combo is converted to an Electron Accelerator
 * string via `comboToAccelerator` (rejecting combos with no modifier) and
 * saved via `window.settingsApi.updateHotkeys`, which takes effect
 * immediately (the main process re-registers the global shortcut without
 * requiring an app restart).
 */
function SettingsScreen(): React.JSX.Element {
  const closeSettings = useAppStore((state) => state.closeSettings)
  const [hotkeys, setHotkeys] = useState<HotkeyBindings | null>(null)
  const [listeningFor, setListeningFor] = useState<keyof HotkeyBindings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.settingsApi
      .getSettings()
      .then((settings) => setHotkeys(settings.hotkeys))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  useEffect(() => {
    if (!listeningFor) return

    function handleKeyDown(event: KeyboardEvent): void {
      event.preventDefault()

      const accelerator = comboToAccelerator({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey
      })

      if (!accelerator) {
        // No modifier (or an unrecognized key) - ignore and keep listening
        // for a valid combo rather than silently giving up.
        return
      }

      const binding = listeningFor
      if (!binding) return
      setListeningFor(null)
      setError(null)

      const updates: Partial<HotkeyBindings> = {}
      updates[binding] = accelerator

      window.settingsApi
        .updateHotkeys(updates)
        .then((settings) => setHotkeys(settings.hotkeys))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : String(err))
        })
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [listeningFor])

  return (
    <div>
      <header>
        <h1>Settings</h1>
        <button type="button" onClick={closeSettings}>
          Back
        </button>
      </header>

      {error && <p role="alert">{error}</p>}

      <section>
        <h2>Keyboard Shortcuts</h2>
        {hotkeys === null ? (
          <p>Loading...</p>
        ) : (
          <ul>
            {BINDING_ORDER.map((binding) => (
              <li key={binding}>
                <span>{BINDING_LABELS[binding]}</span>
                <code>{hotkeys[binding]}</code>
                <button
                  type="button"
                  onClick={() => setListeningFor(binding)}
                  disabled={listeningFor !== null}
                >
                  {listeningFor === binding ? 'Press a key combination...' : 'Change'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default SettingsScreen
