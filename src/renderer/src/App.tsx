import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import PickerScreen from './screens/PickerScreen'
import CaptureScreen from './screens/CaptureScreen'
import OverviewScreen from './screens/OverviewScreen'
import SettingsScreen from './screens/SettingsScreen'

function App(): React.JSX.Element {
  const screen = useAppStore((state) => state.screen)
  const toggleOverview = useAppStore((state) => state.toggleOverview)

  // The command HUD window has no capture/overview screens of its own; its
  // "Overview" button asks the main process to forward the request here so
  // this (the main) window's own screen state toggles instead.
  useEffect(() => {
    return window.guideApi.onToggleOverviewRequested(() => {
      toggleOverview()
    })
  }, [toggleOverview])

  switch (screen) {
    case 'capture':
      return <CaptureScreen />
    case 'overview':
      return <OverviewScreen />
    case 'settings':
      return <SettingsScreen />
    case 'picker':
    default:
      return <PickerScreen />
  }
}

export default App
