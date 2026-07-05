import { create } from 'zustand'
import type { Guide } from '../../../shared/types'

export type Screen = 'picker' | 'capture' | 'overview'

export interface AppState {
  screen: Screen
  currentGuide: Guide | null
  currentGuidePath: string | null
  openPicker: () => void
  enterGuide: (guidePath: string, guide: Guide) => void
  toggleOverview: () => void
  backToLibrary: () => void
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'picker',
  currentGuide: null,
  currentGuidePath: null,

  openPicker: () =>
    set({
      screen: 'picker',
      currentGuide: null,
      currentGuidePath: null
    }),

  enterGuide: (guidePath, guide) =>
    set({
      screen: 'capture',
      currentGuide: guide,
      currentGuidePath: guidePath
    }),

  toggleOverview: () =>
    set((state) => ({
      screen: state.screen === 'overview' ? 'capture' : 'overview'
    })),

  backToLibrary: () =>
    set({
      screen: 'picker',
      currentGuide: null,
      currentGuidePath: null
    })
}))
