import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import CommandHud from './screens/CommandHud'
import PreviewScreen from './screens/PreviewScreen'
import PrintView from './screens/PrintView'

// One renderer bundle, multiple window roles: the main window loads
// `index.html` with no query string (renders `App`), the command HUD window
// (`src/main/windows/commandWindow.ts`) loads the same `index.html` with
// `?windowRole=command` (renders `CommandHud`), the post-capture preview
// window (`src/main/windows/previewWindow.ts`) loads it with
// `?windowRole=preview` (renders `PreviewScreen`), and the hidden
// export-to-PDF print view (`exportGuideAsPdf` in `src/main/export.ts`)
// loads it with `?windowRole=export-print` (renders `PrintView`). A
// handful of roles is simple enough to switch on directly without a router
// library.
const windowRole = new URLSearchParams(window.location.search).get('windowRole')

const RootComponent =
  windowRole === 'command'
    ? CommandHud
    : windowRole === 'preview'
      ? PreviewScreen
      : windowRole === 'export-print'
        ? PrintView
        : App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>
)
