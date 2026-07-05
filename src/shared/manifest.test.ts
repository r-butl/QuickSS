import { describe, expect, it } from 'vitest'
import {
  createGuide,
  createThread,
  addStepToThread,
  parseManifest,
  serializeManifest
} from './manifest'
import { Guide, Step } from './types'

describe('createGuide', () => {
  it('produces valid shape with manifestVersion: 1', () => {
    const guide = createGuide('My Guide')
    expect(guide.manifestVersion).toBe(1)
    expect(guide.title).toBe('My Guide')
    expect(guide.id).toBeDefined()
    expect(typeof guide.id).toBe('string')
    expect(guide.createdAt).toBeDefined()
    expect(guide.updatedAt).toBeDefined()
    expect(guide.threads).toEqual([])
    expect(guide.unsorted).toEqual({ stepIds: [] })
    expect(guide.steps).toEqual({})
  })

  it('generates unique IDs for different guides', () => {
    const guide1 = createGuide('Guide 1')
    const guide2 = createGuide('Guide 2')
    expect(guide1.id).not.toBe(guide2.id)
  })

  it('sets timestamps to ISO 8601 format', () => {
    const guide = createGuide('Test')
    const createdDate = new Date(guide.createdAt)
    const updatedDate = new Date(guide.updatedAt)
    expect(createdDate.toISOString()).toBe(guide.createdAt)
    expect(updatedDate.toISOString()).toBe(guide.updatedAt)
  })
})

describe('createThread', () => {
  it('auto-names sequentially without explicit name', () => {
    const guide = createGuide('Test Guide')
    const { guide: g1, thread: t1 } = createThread(guide)
    expect(t1.name).toBe('Thread 1')

    const { guide: g2, thread: t2 } = createThread(g1)
    expect(t2.name).toBe('Thread 2')

    const { guide: _g3, thread: t3 } = createThread(g2)
    expect(t3.name).toBe('Thread 3')
  })

  it('uses custom name when provided', () => {
    const guide = createGuide('Test')
    const { guide: _g, thread: t } = createThread(guide, 'Custom Name')
    expect(t.name).toBe('Custom Name')
  })

  it('does not mutate the input Guide', () => {
    const guide = createGuide('Test')
    const guideCopy = JSON.parse(JSON.stringify(guide)) as Guide
    const { guide: newGuide } = createThread(guide)

    expect(guide).toEqual(guideCopy)
    expect(guide).not.toBe(newGuide)
    expect(newGuide.threads.length).toBe(1)
    expect(guide.threads.length).toBe(0)
  })

  it('appends thread to threads array', () => {
    const guide = createGuide('Test')
    const { guide: g1 } = createThread(guide)
    const { guide: g2 } = createThread(g1)

    expect(g2.threads.length).toBe(2)
    expect(g2.threads[0].name).toBe('Thread 1')
    expect(g2.threads[1].name).toBe('Thread 2')
  })

  it('generates unique thread IDs', () => {
    const guide = createGuide('Test')
    const { guide: g1, thread: t1 } = createThread(guide)
    const { guide: _g2, thread: t2 } = createThread(g1)

    expect(t1.id).not.toBe(t2.id)
  })

  it('initializes thread with empty stepIds', () => {
    const guide = createGuide('Test')
    const { thread } = createThread(guide)
    expect(thread.stepIds).toEqual([])
  })

  it('updates the updatedAt timestamp', () => {
    const guide = createGuide('Test')
    const originalUpdatedAt = new Date(guide.updatedAt).getTime()
    const { guide: newGuide } = createThread(guide)
    const newUpdatedAt = new Date(newGuide.updatedAt).getTime()

    expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    expect(newGuide.updatedAt).toBeDefined()
  })
})

describe('addStepToThread', () => {
  it('correctly appends step and updates thread', () => {
    const guide = createGuide('Test')
    const { guide: g1, thread: t1 } = createThread(guide)

    const step: Step = {
      id: 'step-1',
      imageFile: 'images/step-1.png',
      caption: 'Step 1',
      description: 'This is step 1',
      cursor: { x: 100, y: 200, visible: true },
      crop: null,
      createdAt: new Date().toISOString()
    }

    const g2 = addStepToThread(g1, t1.id, step)

    expect(g2.steps['step-1']).toEqual(step)
    expect(g2.threads[0].stepIds).toContain('step-1')
  })

  it('throws clear error on unknown threadId', () => {
    const guide = createGuide('Test')
    const step: Step = {
      id: 'step-1',
      imageFile: 'images/step-1.png',
      caption: 'Step 1',
      description: 'This is step 1',
      cursor: { x: 0, y: 0, visible: false },
      crop: null,
      createdAt: new Date().toISOString()
    }

    expect(() => addStepToThread(guide, 'nonexistent-thread-id', step)).toThrowError(
      'Thread with id "nonexistent-thread-id" not found'
    )
  })

  it('does not mutate the input Guide', () => {
    const guide = createGuide('Test')
    const { guide: g1, thread: t1 } = createThread(guide)

    const step: Step = {
      id: 'step-1',
      imageFile: 'images/step-1.png',
      caption: 'Step 1',
      description: 'Description',
      cursor: { x: 0, y: 0, visible: false },
      crop: null,
      createdAt: new Date().toISOString()
    }

    const g1Copy = JSON.parse(JSON.stringify(g1)) as Guide
    const g2 = addStepToThread(g1, t1.id, step)

    expect(g1).toEqual(g1Copy)
    expect(g1).not.toBe(g2)
    expect(g1.steps).not.toHaveProperty('step-1')
    expect(g2.steps).toHaveProperty('step-1')
  })

  it('adds multiple steps to the same thread', () => {
    const guide = createGuide('Test')
    const { guide: g1, thread: t1 } = createThread(guide)

    const step1: Step = {
      id: 'step-1',
      imageFile: 'images/step-1.png',
      caption: 'Step 1',
      description: 'Description 1',
      cursor: { x: 0, y: 0, visible: false },
      crop: null,
      createdAt: new Date().toISOString()
    }

    const step2: Step = {
      id: 'step-2',
      imageFile: 'images/step-2.png',
      caption: 'Step 2',
      description: 'Description 2',
      cursor: { x: 100, y: 100, visible: true },
      crop: { x: 10, y: 10, width: 200, height: 200 },
      createdAt: new Date().toISOString()
    }

    const g2 = addStepToThread(g1, t1.id, step1)
    const g3 = addStepToThread(g2, t1.id, step2)

    expect(g3.threads[0].stepIds).toEqual(['step-1', 'step-2'])
    expect(g3.steps['step-1']).toEqual(step1)
    expect(g3.steps['step-2']).toEqual(step2)
  })

  it('updates the updatedAt timestamp', () => {
    const guide = createGuide('Test')
    const { guide: g1, thread: t1 } = createThread(guide)
    const originalUpdatedAt = new Date(g1.updatedAt).getTime()

    const step: Step = {
      id: 'step-1',
      imageFile: 'images/step-1.png',
      caption: 'Step 1',
      description: 'Description',
      cursor: { x: 0, y: 0, visible: false },
      crop: null,
      createdAt: new Date().toISOString()
    }

    const g2 = addStepToThread(g1, t1.id, step)
    const newUpdatedAt = new Date(g2.updatedAt).getTime()
    expect(newUpdatedAt).toBeGreaterThanOrEqual(originalUpdatedAt)
    expect(g2.updatedAt).toBeDefined()
  })
})

describe('parseManifest and serializeManifest', () => {
  it('round-trips: serialized then parsed equals original', () => {
    const original = createGuide('Test Guide')
    const { guide: withThread } = createThread(original)

    const step: Step = {
      id: 'step-1',
      imageFile: 'images/step-1.png',
      caption: 'Test Step',
      description: 'A test step',
      cursor: { x: 50, y: 75, visible: true },
      crop: { x: 0, y: 0, width: 800, height: 600 },
      createdAt: new Date().toISOString()
    }

    const withStep = addStepToThread(withThread, withThread.threads[0].id, step)

    const serialized = serializeManifest(withStep)
    const parsed = parseManifest(serialized)

    expect(parsed).toEqual(withStep)
  })

  it('serializeManifest produces valid JSON', () => {
    const guide = createGuide('Test')
    const serialized = serializeManifest(guide)
    expect(() => JSON.parse(serialized)).not.toThrow()
  })

  it('serializeManifest produces pretty-printed JSON', () => {
    const guide = createGuide('Test')
    const serialized = serializeManifest(guide)
    expect(serialized).toContain('\n')
  })
})

describe('parseManifest validation', () => {
  it('throws clear error on missing manifestVersion', () => {
    const json = JSON.stringify({
      id: 'test-id',
      title: 'Test',
      threads: [],
      unsorted: { stepIds: [] },
      steps: {}
    })

    expect(() => parseManifest(json)).toThrowError('manifestVersion field is missing')
  })

  it('throws clear error on wrong manifestVersion', () => {
    const json = JSON.stringify({
      manifestVersion: 2,
      id: 'test-id',
      title: 'Test',
      threads: [],
      unsorted: { stepIds: [] },
      steps: {}
    })

    expect(() => parseManifest(json)).toThrowError('manifestVersion must be 1, got 2')
  })

  it('accepts valid Guide with manifestVersion: 1', () => {
    const guide = createGuide('Test')
    const serialized = serializeManifest(guide)
    const parsed = parseManifest(serialized)

    expect(parsed.manifestVersion).toBe(1)
  })
})
