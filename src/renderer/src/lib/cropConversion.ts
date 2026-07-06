/**
 * Pure coordinate-conversion helpers for the crop tool.
 *
 * `react-image-crop` reports crop rectangles in the coordinate space of
 * whatever size the `<img>` element is actually rendered at on screen (its
 * "displayed" size, e.g. `img.width`/`img.height` or the container it's
 * scaled to fit) - not the image's natural/full-resolution pixel
 * dimensions. `Step.crop`, however, must always be stored relative to the
 * ORIGINAL captured image's natural pixel dimensions (see
 * `src/shared/types.ts`), since that's the only coordinate space that stays
 * meaningful regardless of how large a window happens to render the image.
 *
 * These functions convert between the two spaces using simple linear
 * scaling: `naturalDimension / displayedDimension`. Extracted here (rather
 * than inlined in `CropEditor.tsx`) so the conversion math - the trickiest
 * and easiest-to-get-subtly-wrong part of this task - is a plain,
 * exported, unit-testable function.
 */

export interface PixelRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Converts a crop rectangle expressed in displayed-image pixel coordinates
 * into a crop rectangle expressed in the original/natural image's pixel
 * coordinates. Rounds to whole pixels (Step.crop is always integer pixel
 * coordinates) and clamps the result to the natural image bounds so
 * rounding can never push the rectangle outside the source image (e.g. a
 * crop touching the right/bottom edge of the displayed image must not end
 * up at `naturalWidth + 1` after scaling+rounding).
 */
export function displayedCropToAbsolute(
  displayedCrop: PixelRect,
  displayedWidth: number,
  displayedHeight: number,
  naturalWidth: number,
  naturalHeight: number
): PixelRect {
  if (displayedWidth <= 0 || displayedHeight <= 0) {
    throw new Error('displayedCropToAbsolute called with non-positive displayed dimensions')
  }

  const scaleX = naturalWidth / displayedWidth
  const scaleY = naturalHeight / displayedHeight

  const rawX = displayedCrop.x * scaleX
  const rawY = displayedCrop.y * scaleY
  const rawWidth = displayedCrop.width * scaleX
  const rawHeight = displayedCrop.height * scaleY

  const x = clamp(Math.round(rawX), 0, naturalWidth)
  const y = clamp(Math.round(rawY), 0, naturalHeight)
  // Clamp width/height against the remaining space after `x`/`y`, so a
  // rounded-up rectangle at the edge can never extend past the natural
  // image bounds.
  const width = clamp(Math.round(rawWidth), 0, naturalWidth - x)
  const height = clamp(Math.round(rawHeight), 0, naturalHeight - y)

  return { x, y, width, height }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
