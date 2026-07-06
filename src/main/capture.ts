import { desktopCapturer, screen } from 'electron'
import type { Guide } from '../shared/types'
import { createThread } from '../shared/manifest'

const DEFAULT_REGION_SIZE = { width: 800, height: 600 }

/**
 * Returns the display whose `bounds` rectangle contains `cursorPoint`.
 * Falls back to `displays[0]` (expected to be the primary display, e.g.
 * `screen.getPrimaryDisplay()`) if the cursor lies outside every display's
 * bounds — this can legitimately happen for a moment during a resolution
 * change, or if the cursor sits exactly on a boundary between displays.
 */
export function selectActiveDisplay(
  displays: Electron.Display[],
  cursorPoint: { x: number; y: number }
): Electron.Display {
  const match = displays.find((display) => {
    const { x, y, width, height } = display.bounds
    return (
      cursorPoint.x >= x &&
      cursorPoint.x < x + width &&
      cursorPoint.y >= y &&
      cursorPoint.y < y + height
    )
  })

  return match ?? displays[0]
}

/**
 * Computes an 800x600 (by default) rectangle centered on `cursorPoint`, in
 * coordinates relative to `displayBounds` (i.e. `displayBounds.x/y` is
 * subtracted from the cursor point first). The rectangle is clamped so it
 * never goes negative or extends past `displayBounds.width/height`.
 */
export function computeRegionCrop(
  cursorPoint: { x: number; y: number },
  displayBounds: Electron.Rectangle,
  size: { width: number; height: number } = DEFAULT_REGION_SIZE
): { x: number; y: number; width: number; height: number } {
  const localX = cursorPoint.x - displayBounds.x
  const localY = cursorPoint.y - displayBounds.y

  const width = Math.min(size.width, displayBounds.width)
  const height = Math.min(size.height, displayBounds.height)

  const idealX = localX - width / 2
  const idealY = localY - height / 2

  const x = Math.min(Math.max(idealX, 0), displayBounds.width - width)
  const y = Math.min(Math.max(idealY, 0), displayBounds.height - height)

  return { x, y, width, height }
}

/**
 * Captures the given display's raw frame (cursor-free, since OS capture
 * APIs exclude the cursor by default) via `desktopCapturer`. Matches the
 * `desktopCapturer` source to `display` by `display_id` when available,
 * falling back to the first (and presumably only) screen source when
 * `display_id` isn't populated or there's just one display.
 */
export async function captureDisplay(
  display: Electron.Display
): Promise<{ imageBuffer: Buffer; width: number; height: number }> {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: display.bounds.width, height: display.bounds.height }
  })

  const matched =
    sources.find((source) => source.display_id === String(display.id)) ??
    (sources.length === 1 ? sources[0] : undefined)

  if (!matched) {
    throw new Error(
      `Could not match desktopCapturer source to display ${display.id}: ` +
        `no source had a matching display_id, and ${sources.length} sources were available ` +
        `(fallback to an arbitrary source is only safe when exactly one is available)`
    )
  }

  const imageBuffer = matched.thumbnail.toPNG()
  const size = matched.thumbnail.getSize()

  return { imageBuffer, width: size.width, height: size.height }
}

/**
 * Returns the cursor position relative to the captured display's bounds
 * (same coordinate transform as `computeRegionCrop`), for storage as step
 * metadata. Icon rendering/compositing happens later (Phase 5 preview
 * work) — this only produces the position data.
 */
export function getCursorMetadata(
  cursorPoint: { x: number; y: number },
  display: Electron.Display
): { x: number; y: number } {
  return {
    x: cursorPoint.x - display.bounds.x,
    y: cursorPoint.y - display.bounds.y
  }
}

/**
 * Orchestrates a full-screen capture: locate the cursor, pick the active
 * display, capture its full frame, and compute cursor metadata relative to
 * that display. No crop is attached (full frame).
 */
export async function captureFullScreen(): Promise<{
  imageBuffer: Buffer
  cursor: { x: number; y: number }
}> {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = selectActiveDisplay(screen.getAllDisplays(), cursorPoint)
  const { imageBuffer } = await captureDisplay(display)
  const cursor = getCursorMetadata(cursorPoint, display)

  return { imageBuffer, cursor }
}

/**
 * Same orchestration as `captureFullScreen`, but also attaches a default
 * crop rectangle around the cursor. Per feature-requirements.md's
 * implementation notes, the full frame is captured in both cases — region
 * capture only differs by attaching crop metadata, no pixels are discarded
 * at capture time.
 */
export async function captureRegion(): Promise<{
  imageBuffer: Buffer
  cursor: { x: number; y: number }
  crop: { x: number; y: number; width: number; height: number }
}> {
  const cursorPoint = screen.getCursorScreenPoint()
  const display = selectActiveDisplay(screen.getAllDisplays(), cursorPoint)
  const { imageBuffer } = await captureDisplay(display)
  const cursor = getCursorMetadata(cursorPoint, display)
  const crop = computeRegionCrop(cursorPoint, display.bounds)

  return { imageBuffer, cursor, crop }
}

/**
 * Ensures there's a thread to attach a capture to, implementing
 * requirement 3's "capturing before any thread exists auto-creates
 * Thread 1":
 *
 * - If `activeThreadId` names an existing thread, it's returned unchanged
 *   (no-op).
 * - If `activeThreadId` is null/missing/stale and the guide has no threads
 *   at all, "Thread 1" is auto-created via `createThread` and returned.
 * - If `activeThreadId` is null/missing/stale but threads already exist,
 *   we do NOT create a second thread — chosen rule: fall back to the
 *   guide's first thread (`guide.threads[0]`). Rationale: auto-creating is
 *   only meant to bridge the very first capture before any thread exists;
 *   once threads exist, silently spawning more threads whenever the
 *   renderer's active-thread selection is momentarily null would surprise
 *   the user with duplicate "Thread N" entries. Falling back to the first
 *   thread is the least surprising default and keeps this function total
 *   (it always returns a valid thread) without inventing new threads it
 *   wasn't asked for.
 */
export function ensureThreadForCapture(
  guide: Guide,
  activeThreadId: string | null
): { guide: Guide; threadId: string } {
  if (activeThreadId && guide.threads.some((thread) => thread.id === activeThreadId)) {
    return { guide, threadId: activeThreadId }
  }

  if (guide.threads.length === 0) {
    const { guide: updatedGuide, thread } = createThread(guide, 'Thread 1')
    return { guide: updatedGuide, threadId: thread.id }
  }

  return { guide, threadId: guide.threads[0].id }
}
