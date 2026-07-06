import { beforeEach, describe, expect, it, vi } from 'vitest'

// captureFlow.ts has no electron import at all (the whole point of the
// injected-callback pattern - see its doc comment), so these tests import
// it directly with no `vi.mock('electron', ...)` needed and no real
// BrowserWindow is ever touched.

describe('captureFlow', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('startPendingCapture stores a pending capture with cursorVisible defaulted to false, crop defaulted to null, and triggers the injected showPreview callback', async () => {
    const { initCaptureFlow, startPendingCapture, getPendingCapture } =
      await import('./captureFlow')
    const showPreview = vi.fn()
    initCaptureFlow({ showPreview, onCursorToggled: vi.fn() })

    const imageBuffer = Buffer.from('fake-png-bytes')
    startPendingCapture({ imageBuffer, cursor: { x: 10, y: 20 } })

    expect(getPendingCapture()).toEqual({
      imageBuffer,
      cursor: { x: 10, y: 20 },
      crop: null,
      cursorVisible: false
    })
    expect(showPreview).toHaveBeenCalledTimes(1)
  })

  it('startPendingCapture preserves an explicit crop rectangle', async () => {
    const { initCaptureFlow, startPendingCapture, getPendingCapture } =
      await import('./captureFlow')
    initCaptureFlow({ showPreview: vi.fn(), onCursorToggled: vi.fn() })

    const crop = { x: 1, y: 2, width: 800, height: 600 }
    startPendingCapture({ imageBuffer: Buffer.from('x'), cursor: { x: 0, y: 0 }, crop })

    expect(getPendingCapture()?.crop).toEqual(crop)
  })

  it('clearPendingCapture resets state to null', async () => {
    const { initCaptureFlow, startPendingCapture, clearPendingCapture, getPendingCapture } =
      await import('./captureFlow')
    initCaptureFlow({ showPreview: vi.fn(), onCursorToggled: vi.fn() })

    startPendingCapture({ imageBuffer: Buffer.from('x'), cursor: { x: 0, y: 0 } })
    clearPendingCapture()

    expect(getPendingCapture()).toBeNull()
  })

  it('toggleCursorVisible flips cursorVisible on the pending capture and notifies the injected callback with the new value', async () => {
    const { initCaptureFlow, startPendingCapture, toggleCursorVisible, getPendingCapture } =
      await import('./captureFlow')
    const onCursorToggled = vi.fn()
    initCaptureFlow({ showPreview: vi.fn(), onCursorToggled })

    startPendingCapture({ imageBuffer: Buffer.from('x'), cursor: { x: 0, y: 0 } })

    toggleCursorVisible()
    expect(getPendingCapture()?.cursorVisible).toBe(true)
    expect(onCursorToggled).toHaveBeenLastCalledWith(true)

    toggleCursorVisible()
    expect(getPendingCapture()?.cursorVisible).toBe(false)
    expect(onCursorToggled).toHaveBeenLastCalledWith(false)
  })

  it('toggleCursorVisible is a no-op (not an error) when nothing is pending', async () => {
    const { initCaptureFlow, toggleCursorVisible, getPendingCapture } =
      await import('./captureFlow')
    const onCursorToggled = vi.fn()
    initCaptureFlow({ showPreview: vi.fn(), onCursorToggled })

    expect(() => toggleCursorVisible()).not.toThrow()
    expect(getPendingCapture()).toBeNull()
    expect(onCursorToggled).not.toHaveBeenCalled()
  })
})
