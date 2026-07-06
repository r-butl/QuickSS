import { useEffect, useState } from 'react'
import type { PrintData } from '../../../shared/guideApi'

/**
 * Hidden print-view renderer, mounted at `?windowRole=export-print` by
 * `exportGuideAsPdf` (`src/main/export.ts`). Not interactive - it only
 * exists to be loaded off-screen and then screenshotted-to-PDF via
 * `webContents.printToPDF()`, so it renders clean, static HTML matching
 * the Markdown export's structure (title, one section per Thread, each
 * step's caption/description/image) and nothing else.
 *
 * Once the fetched data has committed to the DOM, it calls
 * `notifyPrintReady()` so the main process knows it's safe to call
 * `printToPDF()` - see `waitForPrintReady` in `src/main/export.ts`.
 */
function PrintView(): React.JSX.Element {
  const [data, setData] = useState<PrintData | null>(null)

  useEffect(() => {
    let cancelled = false
    window.guideApi
      .getPrintData()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((error: unknown) => {
        console.error('Failed to fetch print data:', error)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (data) {
      window.guideApi.notifyPrintReady()
    }
  }, [data])

  if (!data) {
    return <div />
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 32, color: '#111' }}>
      <h1>{data.title}</h1>
      {data.threads.map((thread) => (
        <section key={thread.id} style={{ marginBottom: 32 }}>
          <h2>{thread.name}</h2>
          {thread.steps.map((step, index) => (
            <div key={step.id} style={{ marginBottom: 24, breakInside: 'avoid' }}>
              <h3>
                Step {index + 1}: {step.caption}
              </h3>
              {step.description ? <p>{step.description}</p> : null}
              <img
                src={step.imageDataUrl}
                alt={step.caption}
                style={{ maxWidth: '100%', border: '1px solid #ccc' }}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

export default PrintView
