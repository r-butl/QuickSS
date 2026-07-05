import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './appStore'
import type { Guide } from '../../../shared/types'

function makeGuide(title: string): Guide {
  const now = new Date().toISOString()
  return {
    manifestVersion: 1,
    id: 'guide-1',
    title,
    createdAt: now,
    updatedAt: now,
    threads: [],
    unsorted: { stepIds: [] },
    steps: {}
  }
}

beforeEach(() => {
  useAppStore.setState({
    screen: 'picker',
    currentGuide: null,
    currentGuidePath: null
  })
})

describe('appStore', () => {
  it('starts on the picker screen with no current guide', () => {
    const state = useAppStore.getState()
    expect(state.screen).toBe('picker')
    expect(state.currentGuide).toBeNull()
    expect(state.currentGuidePath).toBeNull()
  })

  it('enterGuide transitions to capture and sets the guide/path', () => {
    const guide = makeGuide('My Guide')
    useAppStore.getState().enterGuide('/guides/my-guide', guide)

    const state = useAppStore.getState()
    expect(state.screen).toBe('capture')
    expect(state.currentGuide).toEqual(guide)
    expect(state.currentGuidePath).toBe('/guides/my-guide')
  })

  it('toggleOverview flips between capture and overview', () => {
    const guide = makeGuide('My Guide')
    useAppStore.getState().enterGuide('/guides/my-guide', guide)

    useAppStore.getState().toggleOverview()
    expect(useAppStore.getState().screen).toBe('overview')

    useAppStore.getState().toggleOverview()
    expect(useAppStore.getState().screen).toBe('capture')
  })

  it('backToLibrary resets to picker and clears the current guide', () => {
    const guide = makeGuide('My Guide')
    useAppStore.getState().enterGuide('/guides/my-guide', guide)
    useAppStore.getState().toggleOverview()

    useAppStore.getState().backToLibrary()

    const state = useAppStore.getState()
    expect(state.screen).toBe('picker')
    expect(state.currentGuide).toBeNull()
    expect(state.currentGuidePath).toBeNull()
  })

  it('openPicker resets to picker and clears the current guide', () => {
    const guide = makeGuide('My Guide')
    useAppStore.getState().enterGuide('/guides/my-guide', guide)

    useAppStore.getState().openPicker()

    const state = useAppStore.getState()
    expect(state.screen).toBe('picker')
    expect(state.currentGuide).toBeNull()
    expect(state.currentGuidePath).toBeNull()
  })
})
