import { create } from 'zustand'
import type { Guide } from '../../../shared/types'

export type Screen = 'picker' | 'capture' | 'overview' | 'settings'

export interface AppState {
  screen: Screen
  /**
   * The screen active immediately before navigating to `'settings'`, so
   * `closeSettings()` can return the user to wherever they were (capture,
   * overview, or picker) rather than always bouncing back to the picker.
   */
  previousScreen: Screen
  currentGuide: Guide | null
  currentGuidePath: string | null
  openPicker: () => void
  enterGuide: (guidePath: string, guide: Guide) => void
  toggleOverview: () => void
  backToLibrary: () => void
  openSettings: () => void
  closeSettings: () => void
}

export const useAppStore = create<AppState>((set) => ({
  screen: 'picker',
  previousScreen: 'picker',
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
    }),

  openSettings: () =>
    set((state) => ({
      screen: 'settings',
      previousScreen: state.screen === 'settings' ? state.previousScreen : state.screen
    })),

  closeSettings: () =>
    set((state) => ({
      screen: state.previousScreen
    }))
}))
