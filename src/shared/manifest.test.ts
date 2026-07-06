import { describe, expect, it } from 'vitest'
import {
  createGuide,
  createThread,
  addStepToThread,
  parseManifest,
  serializeManifest,
  getContainerStepIds,
  reorderStep,
  moveStep,
  renameThread,
  updateStep,
  updateStepCrop,
  deleteStep,
  type StepContainer
} from './manifest'
import { Guide, Step } from './types'

function makeStep(id: string, overrides: Partial<Step> = {}): Step {
  return {
    id,
    imageFile: `images/${id}.png`,
    caption: `Caption ${id}`,
    description: `Description ${id}`,
    cursor: { x: 0, y: 0, visible: false },
    crop: null,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Builds a Guide with two threads ("A" with steps a1,a2,a3 and "B" with
 * steps b1,b2) plus an unsorted bucket with steps u1,u2 - enough
 * topology to exercise reorder/move across every kind of container pair.
 */
function makeFixtureGuide(): { guide: Guide; threadA: string; threadB: string } {
  let guide = createGuide('Fixture Guide')
  const { guide: g1, thread: threadA } = createThread(guide, 'Thread A')
  const { guide: g2, thread: threadB } = createThread(g1, 'Thread B')
  guide = g2

  for (const id of ['a1', 'a2', 'a3']) {
    guide = addStepToThread(guide, threadA.id, makeStep(id))
  }
  for (const id of ['b1', 'b2']) {
    guide = addStepToThread(guide, threadB.id, makeStep(id))
  }

  // Manually seed the unsorted bucket + its steps (no addStepToThread
  // equivalent for unsorted exists yet - this task adds the first
  // functions that address it).
  guide = {
    ...guide,
    steps: {
      ...guide.steps,
      u1: makeStep('u1'),
      u2: makeStep('u2')
    },
    unsorted: { stepIds: ['u1', 'u2'] }
  }

  return { guide, threadA: threadA.id, threadB: threadB.id }
}

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

    const { thread: t3 } = createThread(g2)
    expect(t3.name).toBe('Thread 3')
  })

  it('uses custom name when provided', () => {
    const guide = createGuide('Test')
    const { thread: t } = createThread(guide, 'Custom Name')
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
    const { thread: t2 } = createThread(g1)

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

describe('getContainerStepIds', () => {
  it('returns a thread container stepIds array', () => {
    const { guide, threadA } = makeFixtureGuide()
    expect(getContainerStepIds(guide, { kind: 'thread', threadId: threadA })).toEqual([
      'a1',
      'a2',
      'a3'
    ])
  })

  it('returns the unsorted container stepIds array', () => {
    const { guide } = makeFixtureGuide()
    expect(getContainerStepIds(guide, { kind: 'unsorted' })).toEqual(['u1', 'u2'])
  })

  it('throws on unknown threadId', () => {
    const { guide } = makeFixtureGuide()
    expect(() =>
      getContainerStepIds(guide, { kind: 'thread', threadId: 'nonexistent' })
    ).toThrowError('Thread with id "nonexistent" not found')
  })
})

describe('reorderStep', () => {
  it('reorders within a thread', () => {
    const { guide, threadA } = makeFixtureGuide()
    const container: StepContainer = { kind: 'thread', threadId: threadA }
    const updated = reorderStep(guide, container, 0, 2)

    expect(getContainerStepIds(updated, container)).toEqual(['a2', 'a3', 'a1'])
  })

  it('reorders within unsorted', () => {
    const { guide } = makeFixtureGuide()
    const container: StepContainer = { kind: 'unsorted' }
    const updated = reorderStep(guide, container, 1, 0)

    expect(getContainerStepIds(updated, container)).toEqual(['u2', 'u1'])
  })

  it('throws on out-of-range fromIndex', () => {
    const { guide, threadA } = makeFixtureGuide()
    const container: StepContainer = { kind: 'thread', threadId: threadA }
    expect(() => reorderStep(guide, container, 10, 0)).toThrowError(/fromIndex 10 out of range/)
    expect(() => reorderStep(guide, container, -1, 0)).toThrowError(/fromIndex -1 out of range/)
  })

  it('throws on out-of-range toIndex', () => {
    const { guide, threadA } = makeFixtureGuide()
    const container: StepContainer = { kind: 'thread', threadId: threadA }
    expect(() => reorderStep(guide, container, 0, 10)).toThrowError(/toIndex 10 out of range/)
    expect(() => reorderStep(guide, container, 0, -1)).toThrowError(/toIndex -1 out of range/)
  })

  it('throws on unknown threadId', () => {
    const { guide } = makeFixtureGuide()
    expect(() =>
      reorderStep(guide, { kind: 'thread', threadId: 'nonexistent' }, 0, 1)
    ).toThrowError('Thread with id "nonexistent" not found')
  })

  it('does not mutate the input Guide', () => {
    const { guide, threadA } = makeFixtureGuide()
    const guideCopy = JSON.parse(JSON.stringify(guide)) as Guide
    const container: StepContainer = { kind: 'thread', threadId: threadA }

    const updated = reorderStep(guide, container, 0, 2)

    expect(guide).toEqual(guideCopy)
    expect(guide).not.toBe(updated)
    expect(guide.threads.find((t) => t.id === threadA)?.stepIds).toEqual(['a1', 'a2', 'a3'])
  })
})

describe('moveStep', () => {
  it('moves a step between two threads', () => {
    const { guide, threadA, threadB } = makeFixtureGuide()
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const to: StepContainer = { kind: 'thread', threadId: threadB }

    const updated = moveStep(guide, 'a2', from, to)

    expect(getContainerStepIds(updated, from)).toEqual(['a1', 'a3'])
    expect(getContainerStepIds(updated, to)).toEqual(['b1', 'b2', 'a2'])
  })

  it('moves a step at a specific toIndex', () => {
    const { guide, threadA, threadB } = makeFixtureGuide()
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const to: StepContainer = { kind: 'thread', threadId: threadB }

    const updated = moveStep(guide, 'a2', from, to, 0)

    expect(getContainerStepIds(updated, to)).toEqual(['a2', 'b1', 'b2'])
  })

  it('moves a step from a thread into unsorted', () => {
    const { guide, threadA } = makeFixtureGuide()
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const to: StepContainer = { kind: 'unsorted' }

    const updated = moveStep(guide, 'a1', from, to)

    expect(getContainerStepIds(updated, from)).toEqual(['a2', 'a3'])
    expect(getContainerStepIds(updated, to)).toEqual(['u1', 'u2', 'a1'])
  })

  it('moves a step from unsorted back into a thread', () => {
    const { guide, threadA } = makeFixtureGuide()
    const from: StepContainer = { kind: 'unsorted' }
    const to: StepContainer = { kind: 'thread', threadId: threadA }

    const updated = moveStep(guide, 'u1', from, to)

    expect(getContainerStepIds(updated, from)).toEqual(['u2'])
    expect(getContainerStepIds(updated, to)).toEqual(['a1', 'a2', 'a3', 'u1'])
  })

  it('move-with-no-destination (unsorted) lands the step in unsorted', () => {
    const { guide, threadA } = makeFixtureGuide()
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const to: StepContainer = { kind: 'unsorted' }

    const updated = moveStep(guide, 'a3', from, to)

    expect(getContainerStepIds(updated, { kind: 'unsorted' })).toContain('a3')
    expect(getContainerStepIds(updated, from)).not.toContain('a3')
  })

  it('reorders in place when from and to are the same container', () => {
    const { guide, threadA } = makeFixtureGuide()
    const container: StepContainer = { kind: 'thread', threadId: threadA }

    const updated = moveStep(guide, 'a1', container, container, 2)

    expect(getContainerStepIds(updated, container)).toEqual(['a2', 'a3', 'a1'])
  })

  it('throws if stepId is not actually in the from container', () => {
    const { guide, threadA, threadB } = makeFixtureGuide()
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const to: StepContainer = { kind: 'thread', threadId: threadB }

    expect(() => moveStep(guide, 'b1', from, to)).toThrowError(
      'Step with id "b1" not found in the specified source container'
    )
  })

  it('throws on out-of-range toIndex', () => {
    const { guide, threadA, threadB } = makeFixtureGuide()
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const to: StepContainer = { kind: 'thread', threadId: threadB }

    expect(() => moveStep(guide, 'a1', from, to, 10)).toThrowError(/toIndex 10 out of range/)
    expect(() => moveStep(guide, 'a1', from, to, -1)).toThrowError(/toIndex -1 out of range/)
  })

  it('throws on unknown threadId in from or to', () => {
    const { guide, threadA } = makeFixtureGuide()
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const badTo: StepContainer = { kind: 'thread', threadId: 'nonexistent' }

    expect(() => moveStep(guide, 'a1', from, badTo)).toThrowError(
      'Thread with id "nonexistent" not found'
    )
  })

  it('does not mutate the input Guide', () => {
    const { guide, threadA, threadB } = makeFixtureGuide()
    const guideCopy = JSON.parse(JSON.stringify(guide)) as Guide
    const from: StepContainer = { kind: 'thread', threadId: threadA }
    const to: StepContainer = { kind: 'thread', threadId: threadB }

    const updated = moveStep(guide, 'a2', from, to)

    expect(guide).toEqual(guideCopy)
    expect(guide).not.toBe(updated)
    expect(guide.threads.find((t) => t.id === threadA)?.stepIds).toEqual(['a1', 'a2', 'a3'])
    expect(guide.threads.find((t) => t.id === threadB)?.stepIds).toEqual(['b1', 'b2'])
  })
})

describe('renameThread', () => {
  it('updates the thread name', () => {
    const { guide, threadA } = makeFixtureGuide()
    const updated = renameThread(guide, threadA, 'Renamed Thread')

    expect(updated.threads.find((t) => t.id === threadA)?.name).toBe('Renamed Thread')
  })

  it('throws on unknown threadId', () => {
    const { guide } = makeFixtureGuide()
    expect(() => renameThread(guide, 'nonexistent', 'New Name')).toThrowError(
      'Thread with id "nonexistent" not found'
    )
  })

  it('does not mutate the input Guide', () => {
    const { guide, threadA } = makeFixtureGuide()
    const guideCopy = JSON.parse(JSON.stringify(guide)) as Guide

    const updated = renameThread(guide, threadA, 'Renamed Thread')

    expect(guide).toEqual(guideCopy)
    expect(guide).not.toBe(updated)
    expect(guide.threads.find((t) => t.id === threadA)?.name).toBe('Thread A')
  })
})

describe('updateStep', () => {
  it('merges caption and description updates', () => {
    const { guide } = makeFixtureGuide()
    const updated = updateStep(guide, 'a1', { caption: 'New Caption' })

    expect(updated.steps['a1'].caption).toBe('New Caption')
    expect(updated.steps['a1'].description).toBe('Description a1')
  })

  it('updates both fields at once', () => {
    const { guide } = makeFixtureGuide()
    const updated = updateStep(guide, 'a1', {
      caption: 'New Caption',
      description: 'New Description'
    })

    expect(updated.steps['a1'].caption).toBe('New Caption')
    expect(updated.steps['a1'].description).toBe('New Description')
  })

  it('throws on unknown stepId', () => {
    const { guide } = makeFixtureGuide()
    expect(() => updateStep(guide, 'nonexistent', { caption: 'x' })).toThrowError(
      'Step with id "nonexistent" not found'
    )
  })

  it('does not mutate the input Guide', () => {
    const { guide } = makeFixtureGuide()
    const guideCopy = JSON.parse(JSON.stringify(guide)) as Guide

    const updated = updateStep(guide, 'a1', { caption: 'New Caption' })

    expect(guide).toEqual(guideCopy)
    expect(guide).not.toBe(updated)
    expect(guide.steps['a1'].caption).toBe('Caption a1')
  })
})

describe('updateStepCrop', () => {
  it('updates the crop rectangle', () => {
    const { guide } = makeFixtureGuide()
    const crop = { x: 1, y: 2, width: 3, height: 4 }
    const updated = updateStepCrop(guide, 'a1', crop)

    expect(updated.steps['a1'].crop).toEqual(crop)
  })

  it('throws on unknown stepId', () => {
    const { guide } = makeFixtureGuide()
    expect(() => updateStepCrop(guide, 'nonexistent', null)).toThrowError(
      'Step with id "nonexistent" not found'
    )
  })

  it('does not mutate the input Guide', () => {
    const { guide } = makeFixtureGuide()
    const guideCopy = JSON.parse(JSON.stringify(guide)) as Guide

    const updated = updateStepCrop(guide, 'a1', { x: 1, y: 2, width: 3, height: 4 })

    expect(guide).toEqual(guideCopy)
    expect(guide).not.toBe(updated)
    expect(guide.steps['a1'].crop).toBeNull()
  })
})

describe('deleteStep', () => {
  it('removes the step from guide.steps and its thread container', () => {
    const { guide, threadA } = makeFixtureGuide()
    const updated = deleteStep(guide, 'a2')

    expect(updated.steps).not.toHaveProperty('a2')
    expect(updated.threads.find((t) => t.id === threadA)?.stepIds).toEqual(['a1', 'a3'])
  })

  it('removes the step from guide.steps and the unsorted container', () => {
    const { guide } = makeFixtureGuide()
    const updated = deleteStep(guide, 'u1')

    expect(updated.steps).not.toHaveProperty('u1')
    expect(updated.unsorted.stepIds).toEqual(['u2'])
  })

  it('throws on unknown stepId', () => {
    const { guide } = makeFixtureGuide()
    expect(() => deleteStep(guide, 'nonexistent')).toThrowError(
      'Step with id "nonexistent" not found'
    )
  })

  it('does not mutate the input Guide', () => {
    const { guide, threadA } = makeFixtureGuide()
    const guideCopy = JSON.parse(JSON.stringify(guide)) as Guide

    const updated = deleteStep(guide, 'a2')

    expect(guide).toEqual(guideCopy)
    expect(guide).not.toBe(updated)
    expect(guide.steps).toHaveProperty('a2')
    expect(guide.threads.find((t) => t.id === threadA)?.stepIds).toEqual(['a1', 'a2', 'a3'])
  })
})
