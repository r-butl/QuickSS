import type { HotkeyBindings } from './settings';

export const BINDING_LABELS: Record<keyof HotkeyBindings, string> = {
  fullScreen: 'Capture Full Screen',
  region: 'Capture Region',
  cursorToggle: 'Toggle Cursor Visibility',
  newThread: 'New Thread',
  toggleOverview: 'Toggle Overview'
}

export const BINDING_ORDER: Array<keyof HotkeyBindings> = [
  'fullScreen',
  'region',
  'cursorToggle',
  'newThread',
  'toggleOverview'
]