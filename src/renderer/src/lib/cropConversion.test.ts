import { describe, expect, it } from 'vitest'
import { displayedCropToAbsolute } from './cropConversion'

describe('displayedCropToAbsolute', () => {
  it('passes coordinates through unchanged when displayed at natural size (1:1, no scaling)', () => {
    const result = displayedCropToAbsolute(
      { x: 100, y: 50, width: 200, height: 150 },
      1920,
      1080,
      1920,
      1080
    )
    expect(result).toEqual({ x: 100, y: 50, width: 200, height: 150 })
  })

  it('scales up coordinates when the image is displayed scaled down (1920x1080 shown at 960x540)', () => {
    const result = displayedCropToAbsolute(
      { x: 100, y: 50, width: 200, height: 150 },
      960,
      540,
      1920,
      1080
    )
    // scale factor is 2x in both dimensions
    expect(result).toEqual({ x: 200, y: 100, width: 400, height: 300 })
  })

  it('scales down coordinates when the image is displayed larger than its natural size', () => {
    const result = displayedCropToAbsolute(
      { x: 100, y: 50, width: 200, height: 150 },
      1920,
      1080,
      960,
      540
    )
    // scale factor is 0.5x in both dimensions
    expect(result).toEqual({ x: 50, y: 25, width: 100, height: 75 })
  })

  it('clamps a crop at the bottom-right edge of the image with no off-by-one/rounding drift', () => {
    // Natural 1920x1080 shown at 960x540 (2x scale). A crop that runs all
    // the way to the displayed edge must map to exactly the natural edge,
    // never one pixel past it.
    const result = displayedCropToAbsolute(
      { x: 860, y: 490, width: 100, height: 50 },
      960,
      540,
      1920,
      1080
    )
    expect(result).toEqual({ x: 1720, y: 980, width: 200, height: 100 })
    expect(result.x + result.width).toBeLessThanOrEqual(1920)
    expect(result.y + result.height).toBeLessThanOrEqual(1080)
  })

  it('handles a non-integer scale factor without drifting past the natural bounds', () => {
    // Natural 1000x1000 shown at 333x333 (an awkward, non-round scale
    // factor of ~3.003x) - a full-frame crop must clamp exactly to the
    // natural image bounds, not overshoot due to rounding.
    const result = displayedCropToAbsolute(
      { x: 0, y: 0, width: 333, height: 333 },
      333,
      333,
      1000,
      1000
    )
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.width).toBeLessThanOrEqual(1000)
    expect(result.height).toBeLessThanOrEqual(1000)
  })

  it('throws if displayed dimensions are non-positive (image not yet loaded)', () => {
    expect(() =>
      displayedCropToAbsolute({ x: 0, y: 0, width: 10, height: 10 }, 0, 0, 1920, 1080)
    ).toThrow()
  })
})
