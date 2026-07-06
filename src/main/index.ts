import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { createNewThread, registerIpcHandlers } from './ipc'
import { unregisterCaptureHotkeys } from './hotkeys'
import { initHotkeys } from './hotkeyRegistration'
import { readSettings } from './settings'
import { captureFullScreen, captureRegion } from './capture'
import { initCaptureFlow, startPendingCapture, toggleCursorVisible } from './captureFlow'
import { createOrShowPreviewWindow, getPreviewWindow } from './windows/previewWindow'
import { getMainWindow, setMainWindow } from './windows/windowRegistry'
import { getCurrentGuide } from './guideState'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  setMainWindow(mainWindow)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  // Wires captureFlow.ts's injected side-effect callbacks to the real
  // Electron-backed preview window. captureFlow.ts itself has no `electron`
  // import (see its doc comment), so this is the one place those two worlds
  // meet.
  initCaptureFlow({
    showPreview: () => {
      createOrShowPreviewWindow()
    },
    onCursorToggled: (cursorVisible) => {
      getPreviewWindow()?.webContents.send('preview:cursorToggled', cursorVisible)
    }
  })

  const settings = await readSettings()
  initHotkeys(
    {
      onFullScreen: () => {
        // No-op if no Guide is currently open (e.g. hotkey pressed from the
        // Picker screen) - there'd be nothing for `preview:confirm` to
        // attach the resulting step to.
        if (!getCurrentGuide()) return
        captureFullScreen()
          .then((result) => startPendingCapture(result))
          .catch((err) => console.error('captureFullScreen failed', err))
      },
      onRegion: () => {
        if (!getCurrentGuide()) return
        captureRegion()
          .then((result) => startPendingCapture(result))
          .catch((err) => console.error('captureRegion failed', err))
      },
      onCursorToggle: () => {
        toggleCursorVisible()
      },
      onNewThread: () => {
        if (!getCurrentGuide()) return
        createNewThread().catch((err) => console.error('createNewThread failed', err))
      },
      onToggleOverview: () => {
        if (!getCurrentGuide()) return
        getMainWindow()?.webContents.send('app:toggleOverview')
      }
    },
    settings.hotkeys
  )

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  unregisterCaptureHotkeys()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
