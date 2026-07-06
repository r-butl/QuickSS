import { Guide } from './types'
import { serializeManifest } from './manifest'

/**
 * Thin wrapper around `serializeManifest` (Task 2) - JSON export is a
 * near-direct dump of the manifest, unsorted steps included, since it's a
 * raw data export rather than a formatted "tutorial" output. See
 * `exportGuideAsMarkdown` below for the opposite choice on Markdown/PDF.
 *
 * Lives in `shared/` (alongside `manifest.ts`) rather than `main/export.ts`
 * so it - and `exportGuideAsMarkdown` below - stay free of any
 * Electron-adjacent import (directly or transitively, e.g. via
 * `@electron-toolkit/utils`), making them trivially unit-testable with no
 * `vi.mock('electron', ...)` scaffolding. `src/main/export.ts` re-exports
 * both functions so IPC handlers still import everything export-related
 * from one place.
 */
export function exportGuideAsJson(guide: Guide): string {
  return serializeManifest(guide)
}

/**
 * Pure string-building function - no filesystem/Electron access, fully
 * unit-testable. Renders the Guide as a Markdown "tutorial": title as H1,
 * each Thread (in `guide.threads` order) as an H2, each of its steps as an
 * H3 heading (the caption) followed by the description and an image
 * reference using a path relative to the exported file (`step.imageFile`
 * is already `images/<id>.png`, relative to the Guide's own folder - the
 * IPC handler that writes this file defaults the save location to that
 * same folder so the relative path resolves; see `src/main/ipc.ts`).
 *
 * Unsorted-bucket steps are deliberately excluded: a Thread is "a
 * sub-workflow of the overall tutorial" and export is "the composed
 * tutorial" (requirement 11) - steps not yet assigned to a Thread aren't
 * part of that tutorial yet. This matches the PDF/print-view output but
 * differs from `exportGuideAsJson`, which is a raw data dump and keeps
 * everything including unsorted.
 */
export function exportGuideAsMarkdown(guide: Guide): string {
  const lines: string[] = [`# ${guide.title}`, '']

  for (const thread of guide.threads) {
    lines.push(`## ${thread.name}`, '')

    thread.stepIds.forEach((stepId, index) => {
      const step = guide.steps[stepId]
      if (!step) return

      const heading = step.caption ? `Step ${index + 1}: ${step.caption}` : `Step ${index + 1}`
      lines.push(`### ${heading}`, '')
      if (step.description) {
        lines.push(step.description, '')
      }
      lines.push(`![${step.caption}](${step.imageFile})`, '')
    })
  }

  return lines.join('\n').trimEnd() + '\n'
}
