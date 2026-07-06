import { useEffect, useState } from 'react'
import type { CurrentGuideResult } from '../../../shared/guideApi'

interface ThreadTally {
  threadId: string
  name: string
  count: number
}

function computeTally(current: CurrentGuideResult | null): ThreadTally[] {
  if (!current) return []
  return current.guide.threads.map((thread) => ({
    threadId: thread.id,
    name: thread.name,
    count: thread.stepIds.length
  }))
}

/**
 * Root component for the command HUD window (a separate, content-protected
 * `BrowserWindow` - see `src/main/windows/commandWindow.ts`). Shows a live
 * per-thread step tally for the current Guide plus "New Thread" and
 * "Overview" controls, staying in sync with the main window via the
 * main-process-owned Guide state (`src/main/guideState.ts`) rather than any
 * local renderer state shared across windows.
 */
function CommandHud(): React.JSX.Element {
  const [current, setCurrent] = useState<CurrentGuideResult | null>(null)
  const [isCreatingThread, setIsCreatingThread] = useState(false)

  useEffect(() => {
    window.guideApi.getCurrent().then(setCurrent)

    const unsubscribe = window.guideApi.onGuideUpdated((payload) => {
      setCurrent(payload)
    })

    return unsubscribe
  }, [])

  async function handleNewThread(): Promise<void> {
    if (isCreatingThread) return
    setIsCreatingThread(true)
    try {
      await window.guideApi.createThread()
    } catch (error) {
      console.error('Failed to create new thread:', error)
    } finally {
      setIsCreatingThread(false)
    }
  }

  function handleToggleOverview(): void {
    window.guideApi.requestToggleOverview()
  }

  const tally = computeTally(current)
  const activeThreadId = current?.activeThreadId ?? null

  return (
    <div>
      <p>
        {tally.length === 0
          ? 'No threads yet'
          : tally
              .map((entry) =>
                entry.threadId === activeThreadId
                  ? `${entry.name}: ${entry.count} active`
                  : `${entry.name}: ${entry.count}`
              )
              .join(' · ')}
      </p>
      <button type="button" onClick={handleNewThread} disabled={!current || isCreatingThread}>
        New Thread
      </button>
      <button type="button" onClick={handleToggleOverview} disabled={!current}>
        Overview
      </button>
    </div>
  )
}

export default CommandHud
