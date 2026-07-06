import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { RecentGuideEntry } from '../../../shared/guideApi'

/**
 * Picker screen: create a new Guide (default location, no folder-picker
 * prompt) or open an existing one (via a folder dialog, or by clicking a
 * recently-opened entry). Renders on app launch and whenever the user
 * returns "back to library".
 */
function PickerScreen(): React.JSX.Element {
  const enterGuide = useAppStore((state) => state.enterGuide)
  const openSettings = useAppStore((state) => state.openSettings)
  const [title, setTitle] = useState('')
  const [recentGuides, setRecentGuides] = useState<RecentGuideEntry[]>([])
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.guideApi
      .listRecent()
      .then(setRecentGuides)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  async function handleCreate(): Promise<void> {
    if (!title.trim() || isBusy) return
    setIsBusy(true)
    setError(null)
    try {
      const result = await window.guideApi.create(title.trim())
      enterGuide(result.guidePath, result.guide)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleOpenViaDialog(): Promise<void> {
    if (isBusy) return
    setIsBusy(true)
    setError(null)
    try {
      const result = await window.guideApi.openViaDialog()
      if (result) {
        enterGuide(result.guidePath, result.guide)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsBusy(false)
    }
  }

  async function handleOpenRecent(guidePath: string): Promise<void> {
    if (isBusy) return
    setIsBusy(true)
    setError(null)
    try {
      const result = await window.guideApi.open(guidePath)
      enterGuide(result.guidePath, result.guide)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div>
      <header>
        <h1>Documentation Capture Tool</h1>
        <button type="button" onClick={openSettings}>
          Settings
        </button>
      </header>

      {error && <p role="alert">{error}</p>}

      <section>
        <h2>New Guide</h2>
        <input
          type="text"
          value={title}
          placeholder="Guide title"
          onChange={(event) => setTitle(event.target.value)}
          disabled={isBusy}
        />
        <button type="button" onClick={handleCreate} disabled={isBusy || !title.trim()}>
          Create
        </button>
      </section>

      <section>
        <h2>Open Guide</h2>
        <button type="button" onClick={handleOpenViaDialog} disabled={isBusy}>
          Open Guide...
        </button>

        <h3>Recent</h3>
        {recentGuides.length === 0 ? (
          <p>No recent guides yet.</p>
        ) : (
          <ul>
            {recentGuides.map((entry) => (
              <li key={entry.path}>
                <button
                  type="button"
                  onClick={() => handleOpenRecent(entry.path)}
                  disabled={isBusy}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default PickerScreen
