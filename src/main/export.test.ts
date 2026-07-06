import { describe, expect, it } from 'vitest'
import { addStepToThread, createGuide, createThread, parseManifest } from '../shared/manifest'
import { Guide, Step } from '../shared/types'
// Imported from `shared/export.ts` rather than `./export` (this file's own
// module) so this test never pulls in `src/main/export.ts`'s Electron
// imports (`BrowserWindow`, `@electron-toolkit/utils`'s `is`) - those are
// only needed by `exportGuideAsPdf`, which is Electron-runtime-only and out
// of scope for unit tests (see the task brief). `src/main/export.ts`
// re-exports both functions tested here, so callers elsewhere in the main
// process still import everything export-related from one place.
import { exportGuideAsJson, exportGuideAsMarkdown } from '../shared/export'

function makeStep(id: string, overrides: Partial<Step> = {}): Step {
  return {
    id,
    imageFile: `images/${id}.png`,
    caption: `Caption ${id}`,
    description: `Description ${id}`,
    cursor: { x: 0, y: 0, visible: false },
    crop: null,
    createdAt: new Date().toISOString(),
    ...overrides
  }
}

/**
 * Same shape as `src/shared/manifest.test.ts`'s fixture: two threads ("A"
 * with steps a1,a2 and "B" with step b1) plus an unsorted bucket holding
 * one step (u1) - enough to exercise both "multiple threads/steps in
 * order" and "unsorted must not leak into the tutorial output".
 */
function makeFixtureGuide(): Guide {
  let guide = createGuide('Fixture Guide')
  const { guide: g1, thread: threadA } = createThread(guide, 'Thread A')
  const { guide: g2, thread: threadB } = createThread(g1, 'Thread B')
  guide = g2

  guide = addStepToThread(guide, threadA.id, makeStep('a1', { caption: 'Open the app' }))
  guide = addStepToThread(guide, threadA.id, makeStep('a2', { caption: 'Click settings' }))
  guide = addStepToThread(guide, threadB.id, makeStep('b1', { caption: 'Save changes' }))

  guide = {
    ...guide,
    steps: {
      ...guide.steps,
      u1: makeStep('u1', {
        caption: 'THIS STEP SHOULD NEVER APPEAR IN TUTORIAL OUTPUT',
        description: 'Unsorted step description that must not leak either'
      })
    },
    unsorted: { stepIds: ['u1'] }
  }

  return guide
}

describe('exportGuideAsMarkdown', () => {
  it('renders the Guide title as an H1', () => {
    const guide = makeFixtureGuide()
    const markdown = exportGuideAsMarkdown(guide)
    expect(markdown).toContain('# Fixture Guide')
  })

  it('renders each Thread as an H2 in guide.threads order, with its steps numbered underneath', () => {
    const guide = makeFixtureGuide()
    const markdown = exportGuideAsMarkdown(guide)

    const threadAIndex = markdown.indexOf('## Thread A')
    const threadBIndex = markdown.indexOf('## Thread B')
    expect(threadAIndex).toBeGreaterThan(-1)
    expect(threadBIndex).toBeGreaterThan(-1)
    expect(threadAIndex).toBeLessThan(threadBIndex)

    expect(markdown).toContain('### Step 1: Open the app')
    expect(markdown).toContain('### Step 2: Click settings')
    expect(markdown).toContain('### Step 1: Save changes')

    expect(markdown).toContain('Description a1')
    expect(markdown).toContain('Description a2')
    expect(markdown).toContain('Description b1')

    expect(markdown).toContain('![Open the app](images/a1.png)')
    expect(markdown).toContain('![Click settings](images/a2.png)')
    expect(markdown).toContain('![Save changes](images/b1.png)')
  })

  it('excludes unsorted-bucket steps entirely from the output', () => {
    const guide = makeFixtureGuide()
    const markdown = exportGuideAsMarkdown(guide)

    expect(markdown).not.toContain('THIS STEP SHOULD NEVER APPEAR IN TUTORIAL OUTPUT')
    expect(markdown).not.toContain('Unsorted step description that must not leak either')
    expect(markdown).not.toContain('u1.png')
  })
})

describe('exportGuideAsJson', () => {
  it('round-trips through parseManifest back to an equivalent Guide', () => {
    const guide = makeFixtureGuide()
    const json = exportGuideAsJson(guide)
    const parsed = parseManifest(json)

    expect(parsed).toEqual(guide)
  })

  it('includes unsorted steps (unlike the Markdown/PDF exports)', () => {
    const guide = makeFixtureGuide()
    const json = exportGuideAsJson(guide)

    expect(json).toContain('THIS STEP SHOULD NEVER APPEAR IN TUTORIAL OUTPUT')
  })
})
