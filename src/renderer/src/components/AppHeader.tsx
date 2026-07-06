import { useAppStore } from '../store/appStore'

/**
 * Shared header for capture/overview screens: shows the current Guide's
 * title, a toggle button between capture and overview mode, a button to
 * return to the picker/library, and a button to open the Settings screen
 * (Task 11).
 */
function AppHeader(): React.JSX.Element {
  const guideTitle = useAppStore((state) => state.currentGuide?.title ?? 'Untitled Guide')
  const screen = useAppStore((state) => state.screen)
  const toggleOverview = useAppStore((state) => state.toggleOverview)
  const backToLibrary = useAppStore((state) => state.backToLibrary)
  const openSettings = useAppStore((state) => state.openSettings)

  return (
    <header>
      <h1>{guideTitle}</h1>
      <button type="button" onClick={toggleOverview}>
        {screen === 'overview' ? 'Switch to Capture' : 'Switch to Overview'}
      </button>
      <button type="button" onClick={backToLibrary}>
        Back to Library
      </button>
      <button type="button" onClick={openSettings}>
        Settings
      </button>
    </header>
  )
}

export default AppHeader
