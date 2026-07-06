import { useEffect, useState } from 'react'
import AppHeader from '../components/AppHeader'
import type { CurrentGuideResult } from '../../../shared/guideApi'

function countSteps(current: CurrentGuideResult | null): number {
  if (!current) return 0
  return Object.keys(current.guide.steps).length
}

/**
 * Capture-mode screen for the main window. Capturing itself is driven by
 * global hotkeys (full-screen/region capture, new thread, toggle overview -
 * see `src/main/index.ts`) and the separate command HUD window, not by any
 * UI in this window - so this screen just shows the current Guide's status
 * while the user is capturing, and points them at the HUD/hotkeys for
 * controls. It stays live via the same `guide:updated` subscription used by
 * `OverviewScreen`/`CommandHud` rather than the (routing-only) Zustand copy.
 */
function CaptureScreen(): React.JSX.Element {
  const [current, setCurrent] = useState<CurrentGuideResult | null>(null)

  useEffect(() => {
    window.guideApi.getCurrent().then(setCurrent)
    const unsubscribe = window.guideApi.onGuideUpdated(setCurrent)
    return unsubscribe
  }, [])

  const guide = current?.guide ?? null
  const stepCount = countSteps(current)

  return (
    <div>
      <AppHeader />
      <main>
        {guide ? (
          <>
            <h2>{guide.title}</h2>
            <p>
              {stepCount === 0
                ? 'No steps captured yet.'
                : `${stepCount} step${stepCount === 1 ? '' : 's'} captured across ${guide.threads.length} thread${guide.threads.length === 1 ? '' : 's'}.`}
            </p>
            <p>
              Use the command HUD window's controls, or your configured capture hotkeys, to
              capture full-screen or region screenshots and add them to this guide. Switch to
              Overview to review, reorder, and edit captured steps.
            </p>
          </>
        ) : (
          <p>No guide loaded.</p>
        )}
      </main>
    </div>
  )
}

export default CaptureScreen
