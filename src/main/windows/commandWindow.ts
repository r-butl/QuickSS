import { join } from 'path'
import { BrowserWindow, screen } from 'electron'
import { is } from '@electron-toolkit/utils'

const WINDOW_WIDTH = 340
const WINDOW_HEIGHT = 140
const SCREEN_MARGIN = 16

let commandWindow: BrowserWindow | null = null

/**
 * Creates (once) and shows the command HUD window: a small, frameless,
 * always-on-top window that displays the live step tally for the current
 * Guide plus "New Thread" / "Overview" controls. Repeated calls while the
 * window already exists just re-show/focus it rather than creating a
 * duplicate.
 *
 * `setContentProtection(true)` is the core requirement here (requirement
 * 6): the HUD must not appear in screenshots/recordings, including ones the
 * app itself captures. It's set immediately after construction, before the
 * window is shown.
 */
export function createOrShowCommandWindow(): BrowserWindow {
  if (commandWindow && !commandWindow.isDestroyed()) {
    commandWindow.show()
    commandWindow.focus()
    return commandWindow
  }

  const { workAreaSize } = screen.getPrimaryDisplay()
  const x = workAreaSize.width - WINDOW_WIDTH - SCREEN_MARGIN
  const y = workAreaSize.height - WINDOW_HEIGHT - SCREEN_MARGIN

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    x,
    y,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Must happen before show() - see doc comment above.
  win.setContentProtection(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?windowRole=command`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { search: 'windowRole=command' })
  }

  win.on('closed', () => {
    if (commandWindow === win) {
      commandWindow = null
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  commandWindow = win
  return win
}

export function getCommandWindow(): BrowserWindow | null {
  return commandWindow
}
