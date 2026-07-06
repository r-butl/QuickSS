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

/**
 * Uniform way to address "a thread's stepIds array" or "the unsorted
 * bucket's stepIds array" without special-casing call sites. Every
 * function below that takes a `StepContainer` treats both variants
 * identically.
 */
export type StepContainer = { kind: 'thread'; threadId: string } | { kind: 'unsorted' }

function containersEqual(a: StepContainer, b: StepContainer): boolean {
  if (a.kind !== b.kind) return false
  return a.kind === 'thread' && b.kind === 'thread' ? a.threadId === b.threadId : true
}

function findThread(guide: Guide, threadId: string): Thread {
  const thread = guide.threads.find((t) => t.id === threadId)
  if (!thread) {
    throw new Error(`Thread with id "${threadId}" not found`)
  }
  return thread
}

/**
 * Read-only helper returning the `stepIds` array addressed by `container`.
 * Throws if `container.kind === 'thread'` and the threadId doesn't exist.
 */
export function getContainerStepIds(guide: Guide, container: StepContainer): string[] {
  if (container.kind === 'unsorted') {
    return guide.unsorted.stepIds
  }
  return findThread(guide, container.threadId).stepIds
}

/**
 * Immutable-update helper: returns a new Guide with `container`'s stepIds
 * array replaced by `stepIds`. Throws if `container.kind === 'thread'` and
 * the threadId doesn't exist.
 */
function setContainerStepIds(guide: Guide, container: StepContainer, stepIds: string[]): Guide {
  if (container.kind === 'unsorted') {
    return {
      ...guide,
      unsorted: { stepIds },
      updatedAt: new Date().toISOString()
    }
  }

  findThread(guide, container.threadId)

  return {
    ...guide,
    threads: guide.threads.map((t) => (t.id === container.threadId ? { ...t, stepIds } : t)),
    updatedAt: new Date().toISOString()
  }
}

/**
 * Reorders a step within `container`'s own stepIds array (does not move a
 * step between containers - see `moveStep` for that). Throws on
 * out-of-range indices.
 */
export function reorderStep(
  guide: Guide,
  container: StepContainer,
  fromIndex: number,
  toIndex: number
): Guide {
  const stepIds = getContainerStepIds(guide, container)

  if (fromIndex < 0 || fromIndex >= stepIds.length) {
    throw new Error(
      `fromIndex ${fromIndex} out of range for container with ${stepIds.length} step(s)`
    )
  }
  if (toIndex < 0 || toIndex >= stepIds.length) {
    throw new Error(`toIndex ${toIndex} out of range for container with ${stepIds.length} step(s)`)
  }

  const newStepIds = [...stepIds]
  const [moved] = newStepIds.splice(fromIndex, 1)
  newStepIds.splice(toIndex, 0, moved)

  return setContainerStepIds(guide, container, newStepIds)
}

/**
 * Removes `stepId` from `from`'s stepIds array and inserts it into `to`'s
 * stepIds array at `toIndex` (default: append at the end) - a single
 * atomic Guide update, not two separately-applied Guide-returning calls.
 * Steps dragged out with no destination land in `{ kind: 'unsorted' }`;
 * that's just calling this with `to: { kind: 'unsorted' }`, no special
 * handling needed. Throws if `stepId` isn't actually in `from`'s array
 * (guards against stale UI state).
 */
export function moveStep(
  guide: Guide,
  stepId: string,
  from: StepContainer,
  to: StepContainer,
  toIndex?: number
): Guide {
  const fromStepIds = getContainerStepIds(guide, from)
  if (!fromStepIds.includes(stepId)) {
    throw new Error(`Step with id "${stepId}" not found in the specified source container`)
  }

  const newFromStepIds = fromStepIds.filter((id) => id !== stepId)
  const sameContainer = containersEqual(from, to)
  const baseToStepIds = sameContainer ? newFromStepIds : getContainerStepIds(guide, to)
  const insertIndex = toIndex ?? baseToStepIds.length

  if (insertIndex < 0 || insertIndex > baseToStepIds.length) {
    throw new Error(
      `toIndex ${insertIndex} out of range for destination container with ${baseToStepIds.length} step(s)`
    )
  }

  const newToStepIds = [...baseToStepIds]
  newToStepIds.splice(insertIndex, 0, stepId)

  if (sameContainer) {
    return setContainerStepIds(guide, from, newToStepIds)
  }

  const guideAfterRemoval = setContainerStepIds(guide, from, newFromStepIds)
  return setContainerStepIds(guideAfterRemoval, to, newToStepIds)
}

/**
 * Renames a thread. Throws if `threadId` doesn't exist. No uniqueness
 * constraint on names.
 */
export function renameThread(guide: Guide, threadId: string, newName: string): Guide {
  findThread(guide, threadId)

  return {
    ...guide,
    threads: guide.threads.map((t) => (t.id === threadId ? { ...t, name: newName } : t)),
    updatedAt: new Date().toISOString()
  }
}

/**
 * Merges the given fields into a Step (caption/description editing only -
 * crop and delete are separate functions). Throws if `stepId` doesn't
 * exist.
 */
export function updateStep(
  guide: Guide,
  stepId: string,
  updates: Partial<Pick<Step, 'caption' | 'description'>>
): Guide {
  const step = guide.steps[stepId]
  if (!step) {
    throw new Error(`Step with id "${stepId}" not found`)
  }

  return {
    ...guide,
    steps: {
      ...guide.steps,
      [stepId]: { ...step, ...updates }
    },
    updatedAt: new Date().toISOString()
  }
}

/**
 * Trivial variant of `updateStep` for the crop rectangle. Not wired up to
 * any UI yet - Task 9's job - but pure and available now since it's a
 * one-line variation on `updateStep`.
 */
export function updateStepCrop(guide: Guide, stepId: string, crop: Step['crop']): Guide {
  const step = guide.steps[stepId]
  if (!step) {
    throw new Error(`Step with id "${stepId}" not found`)
  }

  return {
    ...guide,
    steps: {
      ...guide.steps,
      [stepId]: { ...step, crop }
    },
    updatedAt: new Date().toISOString()
  }
}

/**
 * Removes the step from `guide.steps` AND from whichever container
 * currently holds its id (searches all threads + unsorted). Throws if
 * `stepId` doesn't exist anywhere.
 */
export function deleteStep(guide: Guide, stepId: string): Guide {
  if (!guide.steps[stepId]) {
    throw new Error(`Step with id "${stepId}" not found`)
  }

  const newSteps = { ...guide.steps }
  delete newSteps[stepId]

  const newThreads = guide.threads.map((t) =>
    t.stepIds.includes(stepId) ? { ...t, stepIds: t.stepIds.filter((id) => id !== stepId) } : t
  )
  const newUnsorted = guide.unsorted.stepIds.includes(stepId)
    ? { stepIds: guide.unsorted.stepIds.filter((id) => id !== stepId) }
    : guide.unsorted

  return {
    ...guide,
    steps: newSteps,
    threads: newThreads,
    unsorted: newUnsorted,
    updatedAt: new Date().toISOString()
  }
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
