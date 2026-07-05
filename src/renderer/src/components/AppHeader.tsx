import { useAppStore } from '../store/appStore'

/**
 * Shared header for capture/overview screens: shows the current Guide's
 * title, a toggle button between capture and overview mode, and a button
 * to return to the picker/library.
 */
function AppHeader(): React.JSX.Element {
  const guideTitle = useAppStore((state) => state.currentGuide?.title ?? 'Untitled Guide')
  const screen = useAppStore((state) => state.screen)
  const toggleOverview = useAppStore((state) => state.toggleOverview)
  const backToLibrary = useAppStore((state) => state.backToLibrary)

  return (
    <header>
      <h1>{guideTitle}</h1>
      <button type="button" onClick={toggleOverview}>
        {screen === 'overview' ? 'Switch to Capture' : 'Switch to Overview'}
      </button>
      <button type="button" onClick={backToLibrary}>
        Back to Library
      </button>
    </header>
  )
}

export default AppHeader
