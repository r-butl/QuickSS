import { describe, expect, it } from 'vitest'
import { selectActiveDisplay, computeRegionCrop, ensureThreadForCapture } from './capture'
import { createGuide, createThread } from '../shared/manifest'

function makeDisplay(id: number, bounds: Electron.Rectangle): Electron.Display {
  // Only `id` and `bounds` are used by selectActiveDisplay/computeRegionCrop;
  // the rest of Electron.Display's fields aren't relevant to this pure logic,
  // so a plain object literal covering the fields we touch is cast to the
  // Electron type rather than constructing a fully-populated fake Display.
  return { id, bounds } as Electron.Display
}

describe('selectActiveDisplay', () => {
  it('picks the display whose bounds contain the cursor point (3 displays, cursor in #2)', () => {
    const displays = [
      makeDisplay(1, { x: 0, y: 0, width: 1920, height: 1080 }),
      makeDisplay(2, { x: 1920, y: 0, width: 2560, height: 1440 }),
      makeDisplay(3, { x: 4480, y: 0, width: 1920, height: 1080 })
    ]

    const cursorPoint = { x: 3000, y: 500 }
    const result = selectActiveDisplay(displays, cursorPoint)

    expect(result.id).toBe(2)
  })

  it('falls back to the provided default display when the cursor is outside all bounds', () => {
    const displays = [
      makeDisplay(1, { x: 0, y: 0, width: 1920, height: 1080 }),
      makeDisplay(2, { x: 1920, y: 0, width: 2560, height: 1440 })
    ]

    // Cursor far outside any display's bounds (e.g. mid resolution-change glitch).
    const cursorPoint = { x: 9999, y: 9999 }
    const result = selectActiveDisplay(displays, cursorPoint)

    expect(result.id).toBe(displays[0].id)
  })
})

describe('computeRegionCrop', () => {
  const bounds: Electron.Rectangle = { x: 100, y: 200, width: 1000, height: 700 }

  it('centers an 800x600 box on the cursor when there is room on all sides', () => {
    // Cursor at the exact center of the display bounds.
    const cursorPoint = { x: 100 + 500, y: 200 + 350 }
    const result = computeRegionCrop(cursorPoint, bounds)

    expect(result).toEqual({ x: 100, y: 50, width: 800, height: 600 })
  })

  it('clamps at the left/top edge when the cursor is near the top-left corner', () => {
    const cursorPoint = { x: 100 + 10, y: 200 + 10 }
    const result = computeRegionCrop(cursorPoint, bounds)

    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
  })

  it('clamps at the right/bottom edge when the cursor is near the bottom-right corner', () => {
    const cursorPoint = { x: 100 + 990, y: 200 + 690 }
    const result = computeRegionCrop(cursorPoint, bounds)

    expect(result.x).toBe(bounds.width - 800)
    expect(result.y).toBe(bounds.height - 600)
    expect(result.width).toBe(800)
    expect(result.height).toBe(600)
  })

  it('clamps the width/height too when the display itself is smaller than the region size', () => {
    const smallBounds: Electron.Rectangle = { x: 0, y: 0, width: 640, height: 480 }
    const cursorPoint = { x: 320, y: 240 }
    const result = computeRegionCrop(cursorPoint, smallBounds)

    expect(result).toEqual({ x: 0, y: 0, width: 640, height: 480 })
  })
})

describe('ensureThreadForCapture', () => {
  it('is a no-op when activeThreadId matches an existing thread', () => {
    let guide = createGuide('Test Guide')
    const created = createThread(guide, 'Thread 1')
    guide = created.guide
    const existingThreadId = created.thread.id

    const result = ensureThreadForCapture(guide, existingThreadId)

    expect(result.threadId).toBe(existingThreadId)
    expect(result.guide.threads).toHaveLength(1)
  })

  it('auto-creates "Thread 1" when guide.threads is empty and activeThreadId is null', () => {
    const guide = createGuide('Test Guide')

    const result = ensureThreadForCapture(guide, null)

    expect(result.guide.threads).toHaveLength(1)
    expect(result.guide.threads[0].name).toBe('Thread 1')
    expect(result.threadId).toBe(result.guide.threads[0].id)
  })

  it('does not auto-create a second thread when one already exists and activeThreadId is null', () => {
    let guide = createGuide('Test Guide')
    const created = createThread(guide, 'Thread 1')
    guide = created.guide

    const result = ensureThreadForCapture(guide, null)

    expect(result.guide.threads).toHaveLength(1)
    expect(result.threadId).toBe(created.thread.id)
  })
})
