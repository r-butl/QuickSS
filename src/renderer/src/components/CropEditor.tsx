import { useEffect, useState } from 'react'
import type { SyntheticEvent } from 'react'
import ReactCrop, { type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import type { Step } from '../../../shared/types'
import { displayedCropToAbsolute } from '../lib/cropConversion'

interface CropEditorProps {
  guidePath: string
  step: Step
  onClose: () => void
}

/**
 * Converts a Step's existing absolute-pixel crop (relative to the natural
 * image size) into the displayed-pixel `PixelCrop` `react-image-crop`
 * expects, given the size the image is currently rendered at. Inverse of
 * `displayedCropToAbsolute`. Falls back to the full displayed frame when
 * `crop` is `null` (i.e. no crop applied yet).
 */
function absoluteCropToDisplayed(
  crop: Step['crop'],
  displayedWidth: number,
  displayedHeight: number,
  naturalWidth: number,
  naturalHeight: number
): PixelCrop {
  if (!crop) {
    return { unit: 'px', x: 0, y: 0, width: displayedWidth, height: displayedHeight }
  }

  const scaleX = displayedWidth / naturalWidth
  const scaleY = displayedHeight / naturalHeight

  return {
    unit: 'px',
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY
  }
}

/**
 * Modal overlay for editing a step's crop rectangle. Crop is metadata-only
 * (requirement: the original captured image file is never mutated by any
 * crop operation) - this component only ever calls
 * `window.guideApi.updateStepCrop`, never `writeImage` or any pixel-editing
 * API. "Reset to full frame" sends `crop: null`, which fully restores the
 * original frame with zero data loss (the full-resolution image on disk
 * was never touched in the first place).
 *
 * No modal library is used: `OverviewScreen` conditionally renders this
 * component as a simple fixed-position overlay, controlled by a
 * `useState<string | null>` holding the step id currently being cropped.
 */
function CropEditor({ guidePath, step, onClose }: CropEditorProps): React.JSX.Element {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
  const [displayedSize, setDisplayedSize] = useState<{ width: number; height: number } | null>(null)
  const [crop, setCrop] = useState<PixelCrop | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.guideApi
      .readImage(guidePath, step.imageFile)
      .then((dataUrl) => {
        if (!cancelled) setImageSrc(dataUrl)
      })
      .catch((err: unknown) => {
        console.error('Failed to read step image for cropping:', err)
        if (!cancelled) setError('Failed to load image.')
      })
    return () => {
      cancelled = true
    }
  }, [guidePath, step.imageFile])

  function handleImageLoad(event: SyntheticEvent<HTMLImageElement>): void {
    const img = event.currentTarget
    const natural = { width: img.naturalWidth, height: img.naturalHeight }
    const displayed = { width: img.width, height: img.height }
    setNaturalSize(natural)
    setDisplayedSize(displayed)
    setCrop(
      absoluteCropToDisplayed(
        step.crop,
        displayed.width,
        displayed.height,
        natural.width,
        natural.height
      )
    )
  }

  async function handleSave(): Promise<void> {
    if (!crop || !displayedSize || !naturalSize) return

    const absoluteCrop = displayedCropToAbsolute(
      crop,
      displayedSize.width,
      displayedSize.height,
      naturalSize.width,
      naturalSize.height
    )

    setSaving(true)
    try {
      // Metadata-only: this updates `Step.crop` in the manifest. It never
      // touches the image file on disk (no `writeImage` call anywhere in
      // this component or the `editor:updateStepCrop` IPC handler).
      await window.guideApi.updateStepCrop(step.id, absoluteCrop)
      onClose()
    } catch (err: unknown) {
      console.error('Failed to save crop:', err)
      setError('Failed to save crop.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetToFullFrame(): Promise<void> {
    setSaving(true)
    try {
      // `crop: null` clears the crop entirely, reverting to the full
      // original frame - never a computed full-bounds rectangle, since the
      // full-resolution source image was never modified and needs no
      // "restoring".
      await window.guideApi.updateStepCrop(step.id, null)
      onClose()
    } catch (err: unknown) {
      console.error('Failed to reset crop:', err)
      setError('Failed to reset crop.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 8,
          padding: 16,
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <h2 style={{ margin: 0 }}>Crop step image</h2>

        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

        <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
          {imageSrc ? (
            <ReactCrop crop={crop ?? undefined} onChange={(pixelCrop) => setCrop(pixelCrop)}>
              <img
                src={imageSrc}
                alt={step.caption || 'Step screenshot'}
                onLoad={handleImageLoad}
                style={{ maxWidth: '80vw', maxHeight: '60vh', display: 'block' }}
              />
            </ReactCrop>
          ) : (
            <p>Loading image…</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleResetToFullFrame} disabled={saving}>
            Reset to full frame
          </button>
          <button type="button" onClick={handleSave} disabled={saving || !crop}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

export default CropEditor
