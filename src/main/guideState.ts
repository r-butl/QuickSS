import { BrowserWindow } from 'electron'
import type { Guide } from '../shared/types'

export interface CurrentGuideState {
  guidePath: string
  guide: Guide
}

export interface ThreadTally {
  threadId: string
  name: string
  count: number
}

/**
 * Main-process-owned authoritative copy of the currently-open Guide. The
 * renderer's Zustand store still holds a local copy for the main window's
 * own rendering, but this module is the source of truth that every window
 * (including the command HUD, a separate `BrowserWindow`) subscribes to via
 * the `guide:updated` broadcast below - no window polls for changes.
 */
let currentGuide: CurrentGuideState | null = null

/**
 * The thread that a new capture's confirm step should attach to (Task 7).
 * Reset whenever a Guide is (re)opened via `setCurrentGuide` - see that
 * function's doc comment for the default-selection rule - and updated
 * explicitly by `setActiveThreadId` whenever a new thread is created.
 */
let activeThreadId: string | null = null

export function getCurrentGuide(): CurrentGuideState | null {
  return currentGuide
}

export function getActiveThreadId(): string | null {
  return activeThreadId
}

export function setActiveThreadId(threadId: string | null): void {
  activeThreadId = threadId
}

/**
 * Sets the current Guide and resets `activeThreadId` to a reasonable
 * default for "resume capturing" purposes: `null` if the guide has no
 * threads yet (the very first capture will auto-create "Thread 1" per
 * `ensureThreadForCapture`), or the last thread in `guide.threads` if any
 * exist (most-recently-added thread is the most likely one the user wants
 * to keep adding to after reopening a Guide).
 */
export function setCurrentGuide(guidePath: string, guide: Guide): void {
  currentGuide = { guidePath, guide }
  activeThreadId = guide.threads.length > 0 ? guide.threads[guide.threads.length - 1].id : null
  broadcastGuideUpdated()
}

/**
 * Replaces the in-memory Guide (e.g. after `createThread`/`addStepToThread`
 * produce a new Guide snapshot) and broadcasts the update. Callers are
 * responsible for persisting the new Guide to disk (via `writeManifest`)
 * separately - this function only updates the in-memory copy.
 */
export function updateCurrentGuide(guide: Guide): void {
  if (!currentGuide) {
    throw new Error('updateCurrentGuide called with no current Guide set')
  }
  currentGuide = { guidePath: currentGuide.guidePath, guide }
  broadcastGuideUpdated()
}

/**
 * One tally entry per thread, with `count` computed fresh from that
 * thread's current `stepIds.length` on every call - never a separately
 * tracked counter, so it stays correct as steps are added, removed, or
 * moved between threads.
 */
export function computeStepTally(guide: Guide): ThreadTally[] {
  return guide.threads.map((thread) => ({
    threadId: thread.id,
    name: thread.name,
    count: thread.stepIds.length
  }))
}

function broadcastGuideUpdated(): void {
  if (!currentGuide) return
  const payload = { guidePath: currentGuide.guidePath, guide: currentGuide.guide }
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('guide:updated', payload)
  }
}
