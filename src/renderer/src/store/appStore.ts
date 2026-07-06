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
  /**
   * These two fields reflect the Guide at entry time (whatever was passed
   * to `enterGuide` on "New Guide"/"Open Guide") and exist only for screen
   * routing - deciding which screen to show, not what to show on it. They
   * are NOT kept live as the Guide changes afterward. `CaptureScreen`,
   * `OverviewScreen`, and `CommandHud` all treat the main process's
   * `getCurrent()`/`guide:updated` (see `src/main/guideState.ts`) as the
   * authoritative source for live Guide content - don't read `currentGuide`
   * here for anything that needs to stay in sync.
   */
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
