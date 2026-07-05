import * as fs from 'fs/promises'
import * as path from 'path'
import { app } from 'electron'
import type { RecentGuideEntry } from '../shared/guideApi'
import { atomicWriteFile } from './persistence'

export type { RecentGuideEntry }

const MAX_RECENT_GUIDES = 10

function recentGuidesPath(): string {
  return path.join(app.getPath('userData'), 'recent-guides.json')
}

/**
 * Reads the recent-guides list from `recent-guides.json` in the userData
 * directory. Returns an empty array if the file doesn't exist yet.
 */
export async function readRecentGuides(): Promise<RecentGuideEntry[]> {
  try {
    const contents = await fs.readFile(recentGuidesPath(), 'utf-8')
    return JSON.parse(contents) as RecentGuideEntry[]
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw err
  }
}

/**
 * Adds `entry` to the recent-guides list, removing any existing entry with
 * the same `path`, prepending the new entry (most-recent-first), and
 * truncating to `MAX_RECENT_GUIDES`. Atomically writes the updated list back
 * and returns it.
 */
export async function addRecentGuide(entry: RecentGuideEntry): Promise<RecentGuideEntry[]> {
  const current = await readRecentGuides()
  const deduped = current.filter((existing) => existing.path !== entry.path)
  const updated = [entry, ...deduped].slice(0, MAX_RECENT_GUIDES)

  await atomicWriteFile(recentGuidesPath(), JSON.stringify(updated, null, 2))

  return updated
}
