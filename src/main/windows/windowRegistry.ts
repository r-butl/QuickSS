import type { BrowserWindow } from 'electron'

/**
 * Tracks the single main application window so other main-process modules
 * (namely `ipc.ts`, forwarding `app:toggleOverview` requests from the
 * command HUD) can target it specifically without broadcasting to every
 * open window - broadcasting would cause the command window to receive its
 * own toggle request back.
 */
let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
