import { useEffect, useRef, useState } from 'react'
import type { PendingCaptureResult } from '../../../shared/guideApi'

/**
 * Root component for the post-capture preview window (a separate,
 * content-protected `BrowserWindow` - see
 * `src/main/windows/previewWindow.ts`). Renders the pending capture (image,
 * cursor marker, crop indicator), collects a caption/description, and lets
 * the user confirm (persisting a new Step) or discard it.
 */
function PreviewScreen(): React.JSX.Element {
  const [pending, setPending] = useState<PendingCaptureResult | null>(null)
  const [caption, setCaption] = useState('')
  const [description, setDescription] = useState('')
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Latest caption/description/submitting-state as refs so the plain
  // `keydown` listener below (attached once on mount) always sees current
  // values without needing to re-attach on every keystroke.
  const captionRef = useRef(caption)
  const descriptionRef = useRef(description)
  const isSubmittingRef = useRef(isSubmitting)

  useEffect(() => {
    captionRef.current = caption
    descriptionRef.current = description
    isSubmittingRef.current = isSubmitting
  })

  useEffect(() => {
    window.guideApi.getPendingCapture().then(setPending)

    const unsubscribe = window.guideApi.onCursorToggled((cursorVisible) => {
      setPending((current) => (current ? { ...current, cursorVisible } : current))
    })

    return unsubscribe
  }, [])

  async function handleConfirm(): Promise<void> {
    if (isSubmittingRef.current) return
    setIsSubmitting(true)
    try {
      await window.guideApi.confirmCapture({
        caption: captionRef.current,
        description: descriptionRef.current
      })
      setCaption('')
      setDescription('')
      setPending(null)
    } catch (error) {
      console.error('Failed to confirm capture:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDiscard(): Promise<void> {
    try {
      await window.guideApi.discardCapture()
    } catch (error) {
      console.error('Failed to discard capture:', error)
    } finally {
      setCaption('')
      setDescription('')
      setPending(null)
    }
  }

  // Plain DOM `keydown` listener (per feature-requirements.md's
  // implementation notes - this is a local window shortcut, not a global
  // hotkey): bare `Enter` confirms, `Escape` discards. `Shift+Enter` is
  // deliberately excluded from confirm so the multi-line description
  // textarea can accept newlines without accidentally submitting.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void handleConfirm()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        void handleDiscard()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!pending) {
    return (
      <div>
        <p>No pending capture.</p>
      </div>
    )
  }

  const cursorMarkerStyle: React.CSSProperties | null =
    pending.cursorVisible && naturalSize
      ? {
          position: 'absolute',
          left: `${(pending.cursor.x / naturalSize.width) * 100}%`,
          top: `${(pending.cursor.y / naturalSize.height) * 100}%`,
          width: 14,
          height: 14,
          marginLeft: -7,
          marginTop: -7,
          borderRadius: '50%',
          background: 'red',
          border: '2px solid white',
          pointerEvents: 'none'
        }
      : null

  const cropOverlayStyle: React.CSSProperties | null =
    pending.crop && naturalSize
      ? {
          position: 'absolute',
          left: `${(pending.crop.x / naturalSize.width) * 100}%`,
          top: `${(pending.crop.y / naturalSize.height) * 100}%`,
          width: `${(pending.crop.width / naturalSize.width) * 100}%`,
          height: `${(pending.crop.height / naturalSize.height) * 100}%`,
          border: '2px dashed lime',
          boxSizing: 'border-box',
          pointerEvents: 'none'
        }
      : null

  return (
    <div>
      <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
        <img
          src={pending.imageDataUrl}
          alt="Pending capture"
          style={{ display: 'block', maxWidth: '100%', maxHeight: '60vh' }}
          onLoad={(event) => {
            const img = event.currentTarget
            setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight })
          }}
        />
        {/*
          The crop indicator here is a read-only display of Task 5's
          default region rectangle - real crop-tool interaction (dragging
          handles to resize/move it) is out of scope for this task and
          belongs to Phase 6/Task 9.
        */}
        {cropOverlayStyle && <div style={cropOverlayStyle} />}
        {/*
          A simple absolutely-positioned marker, not a pixel-perfect OS
          cursor icon - deliberate simplification for a later polish pass.
        */}
        {cursorMarkerStyle && <div style={cursorMarkerStyle} />}
      </div>

      <div>
        <label>
          Caption
          <input type="text" value={caption} onChange={(event) => setCaption(event.target.value)} />
        </label>
      </div>

      <div>
        <label>
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
      </div>

      <div>
        <button type="button" onClick={() => void handleConfirm()} disabled={isSubmitting}>
          Confirm
        </button>
        <button type="button" onClick={() => void handleDiscard()} disabled={isSubmitting}>
          Discard
        </button>
      </div>
    </div>
  )
}

export default PreviewScreen
