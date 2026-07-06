import { describe, expect, it, vi } from 'vitest'
import type { Guide } from '../shared/types'

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => []
  }
}))

function makeGuide(threads: { id: string; name: string; stepIds: string[] }[]): Guide {
  return {
    manifestVersion: 1,
    id: 'guide-1',
    title: 'Test Guide',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    threads,
    unsorted: { stepIds: [] },
    steps: {}
  }
}

describe('computeStepTally', () => {
  it('returns one entry per thread with counts from stepIds.length, including zero-step threads', async () => {
    const { computeStepTally } = await import('./guideState')

    const guide = makeGuide([
      { id: 't1', name: 'Thread 1', stepIds: ['s1', 's2', 's3'] },
      { id: 't2', name: 'Thread 2', stepIds: [] },
      { id: 't3', name: 'Thread 3', stepIds: ['s4'] }
    ])

    expect(computeStepTally(guide)).toEqual([
      { threadId: 't1', name: 'Thread 1', count: 3 },
      { threadId: 't2', name: 'Thread 2', count: 0 },
      { threadId: 't3', name: 'Thread 3', count: 1 }
    ])
  })

  it('returns an empty array for a Guide with no threads', async () => {
    const { computeStepTally } = await import('./guideState')

    expect(computeStepTally(makeGuide([]))).toEqual([])
  })

  it('recomputes correctly for a later Guide snapshot after a thread gains and another loses steps', async () => {
    const { computeStepTally } = await import('./guideState')

    const before = makeGuide([
      { id: 't1', name: 'Thread 1', stepIds: ['s1', 's2'] },
      { id: 't2', name: 'Thread 2', stepIds: ['s3'] }
    ])

    const after = makeGuide([
      { id: 't1', name: 'Thread 1', stepIds: ['s1'] },
      { id: 't2', name: 'Thread 2', stepIds: ['s3', 's4', 's5'] }
    ])

    expect(computeStepTally(before)).toEqual([
      { threadId: 't1', name: 'Thread 1', count: 2 },
      { threadId: 't2', name: 'Thread 2', count: 1 }
    ])

    expect(computeStepTally(after)).toEqual([
      { threadId: 't1', name: 'Thread 1', count: 1 },
      { threadId: 't2', name: 'Thread 2', count: 3 }
    ])
  })
})

describe('setCurrentGuide / getCurrentGuide / updateCurrentGuide', () => {
  it('stores and returns the current guide, and updateCurrentGuide replaces it in place', async () => {
    const { setCurrentGuide, getCurrentGuide, updateCurrentGuide } = await import('./guideState')

    const guide = makeGuide([{ id: 't1', name: 'Thread 1', stepIds: [] }])
    setCurrentGuide('/guides/test', guide)

    expect(getCurrentGuide()).toEqual({ guidePath: '/guides/test', guide })

    const updatedGuide = makeGuide([{ id: 't1', name: 'Thread 1', stepIds: ['s1'] }])
    updateCurrentGuide(updatedGuide)

    expect(getCurrentGuide()).toEqual({ guidePath: '/guides/test', guide: updatedGuide })
  })

  it('throws if updateCurrentGuide is called before any guide has been set', async () => {
    vi.resetModules()
    const { updateCurrentGuide } = await import('./guideState')

    expect(() => updateCurrentGuide(makeGuide([]))).toThrow()
  })
})
