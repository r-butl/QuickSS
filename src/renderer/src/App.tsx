import { useAppStore } from './store/appStore'
import PickerScreen from './screens/PickerScreen'
import CaptureScreen from './screens/CaptureScreen'
import OverviewScreen from './screens/OverviewScreen'

function App(): React.JSX.Element {
  const screen = useAppStore((state) => state.screen)

  switch (screen) {
    case 'capture':
      return <CaptureScreen />
    case 'overview':
      return <OverviewScreen />
    case 'picker':
    default:
      return <PickerScreen />
  }
}

export default App
