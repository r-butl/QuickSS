import { Guide, Thread, Step } from './types'

export function createGuide(title: string): Guide {
  const now = new Date().toISOString()
  return {
    manifestVersion: 1,
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    threads: [],
    unsorted: { stepIds: [] },
    steps: {}
  }
}

export function createThread(guide: Guide, name?: string): { guide: Guide; thread: Thread } {
  const threadName = name ?? `Thread ${guide.threads.length + 1}`
  const thread: Thread = {
    id: crypto.randomUUID(),
    name: threadName,
    stepIds: []
  }

  const updatedGuide: Guide = {
    ...guide,
    threads: [...guide.threads, thread],
    updatedAt: new Date().toISOString()
  }

  return { guide: updatedGuide, thread }
}

export function addStepToThread(guide: Guide, threadId: string, step: Step): Guide {
  const thread = guide.threads.find((t) => t.id === threadId)
  if (!thread) {
    throw new Error(`Thread with id "${threadId}" not found`)
  }

  const updatedGuide: Guide = {
    ...guide,
    steps: {
      ...guide.steps,
      [step.id]: step
    },
    threads: guide.threads.map((t) =>
      t.id === threadId ? { ...t, stepIds: [...t.stepIds, step.id] } : t
    ),
    updatedAt: new Date().toISOString()
  }

  return updatedGuide
}

export function parseManifest(json: string): Guide {
  const parsed = JSON.parse(json)

  if (parsed.manifestVersion === undefined) {
    throw new Error('manifestVersion field is missing')
  }

  if (parsed.manifestVersion !== 1) {
    throw new Error(`manifestVersion must be 1, got ${parsed.manifestVersion}`)
  }

  return parsed as Guide
}

export function serializeManifest(guide: Guide): string {
  return JSON.stringify(guide, null, 2)
}
