import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tempDirs: string[] = []
let userDataDir: string

async function makeTempDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'doctool-recent-guides-'))
  tempDirs.push(dir)
  return dir
}

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataDir
  }
}))

beforeEach(async () => {
  userDataDir = await makeTempDir()
})

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe('readRecentGuides', () => {
  it('returns an empty array when the file does not exist', async () => {
    const { readRecentGuides } = await import('./recentGuides')
    expect(await readRecentGuides()).toEqual([])
  })
})

describe('addRecentGuide', () => {
  it('adds an entry and persists it so readRecentGuides sees it', async () => {
    const { readRecentGuides, addRecentGuide } = await import('./recentGuides')

    const entry = { path: '/guides/a', title: 'Guide A', lastOpenedAt: '2026-01-01T00:00:00.000Z' }
    const result = await addRecentGuide(entry)

    expect(result).toEqual([entry])
    expect(await readRecentGuides()).toEqual([entry])
  })

  it('dedupes by path, moving the re-added entry to the front', async () => {
    const { addRecentGuide } = await import('./recentGuides')

    const a = { path: '/guides/a', title: 'Guide A', lastOpenedAt: '2026-01-01T00:00:00.000Z' }
    const b = { path: '/guides/b', title: 'Guide B', lastOpenedAt: '2026-01-02T00:00:00.000Z' }
    await addRecentGuide(a)
    await addRecentGuide(b)

    const aAgain = { ...a, lastOpenedAt: '2026-01-03T00:00:00.000Z', title: 'Guide A Renamed' }
    const result = await addRecentGuide(aAgain)

    expect(result).toEqual([aAgain, b])
  })

  it('orders most-recently-added first', async () => {
    const { addRecentGuide } = await import('./recentGuides')

    const a = { path: '/guides/a', title: 'Guide A', lastOpenedAt: '2026-01-01T00:00:00.000Z' }
    const b = { path: '/guides/b', title: 'Guide B', lastOpenedAt: '2026-01-02T00:00:00.000Z' }
    const c = { path: '/guides/c', title: 'Guide C', lastOpenedAt: '2026-01-03T00:00:00.000Z' }

    await addRecentGuide(a)
    await addRecentGuide(b)
    const result = await addRecentGuide(c)

    expect(result.map((e) => e.path)).toEqual(['/guides/c', '/guides/b', '/guides/a'])
  })

  it('caps the list at 10 entries', async () => {
    const { addRecentGuide } = await import('./recentGuides')

    let result: Awaited<ReturnType<typeof addRecentGuide>> = []
    for (let i = 0; i < 12; i++) {
      result = await addRecentGuide({
        path: `/guides/${i}`,
        title: `Guide ${i}`,
        lastOpenedAt: new Date(2026, 0, i + 1).toISOString()
      })
    }

    expect(result).toHaveLength(10)
    expect(result[0].path).toBe('/guides/11')
    expect(result[9].path).toBe('/guides/2')
  })
})
