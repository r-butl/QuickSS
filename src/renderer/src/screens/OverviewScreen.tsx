import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import AppHeader from '../components/AppHeader'
import CropEditor from '../components/CropEditor'
import type { CurrentGuideResult, StepContainer } from '../../../shared/guideApi'
import type { Guide, Step, Thread } from '../../../shared/types'

type ImageCache = MutableRefObject<Map<string, string>>

/**
 * One entry per addressable `StepContainer` in the current Guide: each of
 * the Guide's threads, plus the always-present Unsorted bucket. `domId` is
 * the id used for both the `SortableContext`'s items and the container-level
 * `useDroppable` fallback target (for dropping into an empty container, or
 * into empty space below the last item).
 */
interface ContainerDescriptor {
  domId: string
  container: StepContainer
  stepIds: string[]
}

function buildContainers(guide: Guide): ContainerDescriptor[] {
  return [
    ...guide.threads.map((thread) => ({
      domId: `thread:${thread.id}`,
      container: { kind: 'thread' as const, threadId: thread.id },
      stepIds: thread.stepIds
    })),
    {
      domId: 'unsorted',
      container: { kind: 'unsorted' as const },
      stepIds: guide.unsorted.stepIds
    }
  ]
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

interface StepThumbnailProps {
  guidePath: string
  imageFile: string
  caption: string
  imageCache: ImageCache
}

function StepThumbnail({
  guidePath,
  imageFile,
  caption,
  imageCache
}: StepThumbnailProps): React.JSX.Element {
  const [imageSrc, setImageSrc] = useState<string | null>(
    () => imageCache.current.get(imageFile) ?? null
  )

  useEffect(() => {
    // Already resolved (either from the initial-state cache hit above, or a
    // previous run of this same effect) - nothing to fetch.
    if (imageCache.current.has(imageFile)) return undefined

    let cancelled = false
    window.guideApi
      .readImage(guidePath, imageFile)
      .then((dataUrl) => {
        if (cancelled) return
        imageCache.current.set(imageFile, dataUrl)
        setImageSrc(dataUrl)
      })
      .catch((error: unknown) => {
        console.error('Failed to read step image:', error)
      })

    return () => {
      cancelled = true
    }
  }, [guidePath, imageFile, imageCache])

  if (!imageSrc) {
    return <div style={{ width: 120, height: 80, background: '#ddd' }} aria-hidden="true" />
  }

  return <img src={imageSrc} alt={caption} width={120} height={80} style={{ objectFit: 'cover' }} />
}

interface SortableStepCardProps {
  step: Step
  guidePath: string
  imageCache: ImageCache
  onCropStep: (stepId: string) => void
}

function SortableStepCard({
  step,
  guidePath,
  imageCache,
  onCropStep
}: SortableStepCardProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id
  })
  const [caption, setCaption] = useState(step.caption)
  const [description, setDescription] = useState(step.description)
  // Tracks the last `step.caption`/`step.description` seen from props so a
  // change originating elsewhere (e.g. a `guide:updated` broadcast from
  // another window) is reflected into the edit buffer. Adjusting state
  // directly during render (rather than in a `useEffect`) is the pattern
  // React recommends for "reset local state when a prop changes" - see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [lastSeenCaption, setLastSeenCaption] = useState(step.caption)
  const [lastSeenDescription, setLastSeenDescription] = useState(step.description)
  if (step.caption !== lastSeenCaption) {
    setLastSeenCaption(step.caption)
    setCaption(step.caption)
  }
  if (step.description !== lastSeenDescription) {
    setLastSeenDescription(step.description)
    setDescription(step.description)
  }

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition: transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
    border: '1px solid #ccc',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
    display: 'flex',
    gap: 8,
    alignItems: 'flex-start',
    background: 'white'
  }

  function handleCaptionBlur(): void {
    if (caption !== step.caption) {
      window.guideApi.updateStep(step.id, { caption }).catch((error: unknown) => {
        console.error('Failed to update step caption:', error)
      })
    }
  }

  function handleDescriptionBlur(): void {
    if (description !== step.description) {
      window.guideApi.updateStep(step.id, { description }).catch((error: unknown) => {
        console.error('Failed to update step description:', error)
      })
    }
  }

  function handleDelete(): void {
    if (!window.confirm('Delete this step? This cannot be undone.')) return
    window.guideApi.deleteStep(step.id).catch((error: unknown) => {
      console.error('Failed to delete step:', error)
    })
  }

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        role="button"
        aria-label={`Drag step ${step.caption || step.id}`}
        style={{ cursor: 'grab', padding: '4px 8px', userSelect: 'none' }}
      >
        ⠿
      </span>
      <StepThumbnail
        guidePath={guidePath}
        imageFile={step.imageFile}
        caption={step.caption}
        imageCache={imageCache}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <input
          type="text"
          value={caption}
          placeholder="Caption"
          onChange={(event) => setCaption(event.target.value)}
          onBlur={handleCaptionBlur}
        />
        <textarea
          value={description}
          placeholder="Description"
          rows={2}
          title={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={handleDescriptionBlur}
        />
        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>{truncate(description, 80)}</p>
      </div>
      <button type="button" onClick={() => onCropStep(step.id)}>
        Crop
      </button>
      <button type="button" onClick={handleDelete}>
        Delete
      </button>
    </div>
  )
}

interface DroppableContainerProps {
  domId: string
  children: React.ReactNode
}

function DroppableContainer({ domId, children }: DroppableContainerProps): React.JSX.Element {
  const { setNodeRef } = useDroppable({ id: domId })
  return (
    <div ref={setNodeRef} style={{ minHeight: 40 }}>
      {children}
    </div>
  )
}

interface StepListProps {
  descriptor: ContainerDescriptor
  steps: Record<string, Step>
  guidePath: string
  imageCache: ImageCache
  emptyLabel: string
  onCropStep: (stepId: string) => void
}

function StepList({
  descriptor,
  steps,
  guidePath,
  imageCache,
  emptyLabel,
  onCropStep
}: StepListProps): React.JSX.Element {
  return (
    <SortableContext items={descriptor.stepIds} strategy={verticalListSortingStrategy}>
      <DroppableContainer domId={descriptor.domId}>
        {descriptor.stepIds.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>{emptyLabel}</p>
        ) : (
          descriptor.stepIds.map((stepId) => {
            const step = steps[stepId]
            if (!step) return null
            return (
              <SortableStepCard
                key={stepId}
                step={step}
                guidePath={guidePath}
                imageCache={imageCache}
                onCropStep={onCropStep}
              />
            )
          })
        )}
      </DroppableContainer>
    </SortableContext>
  )
}

interface ThreadSectionProps {
  thread: Thread
  steps: Record<string, Step>
  guidePath: string
  imageCache: ImageCache
  onCropStep: (stepId: string) => void
}

function ThreadSection({
  thread,
  steps,
  guidePath,
  imageCache,
  onCropStep
}: ThreadSectionProps): React.JSX.Element {
  const [name, setName] = useState(thread.name)
  const [lastSeenName, setLastSeenName] = useState(thread.name)
  if (thread.name !== lastSeenName) {
    setLastSeenName(thread.name)
    setName(thread.name)
  }

  function handleRenameBlur(): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== thread.name) {
      window.guideApi.renameThread(thread.id, trimmed).catch((error: unknown) => {
        console.error('Failed to rename thread:', error)
      })
    } else {
      setName(thread.name)
    }
  }

  return (
    <section style={{ marginBottom: 24 }}>
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={handleRenameBlur}
        style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}
      />
      <StepList
        descriptor={{
          domId: `thread:${thread.id}`,
          container: { kind: 'thread', threadId: thread.id },
          stepIds: thread.stepIds
        }}
        steps={steps}
        guidePath={guidePath}
        imageCache={imageCache}
        emptyLabel="No steps yet — drag steps here."
        onCropStep={onCropStep}
      />
    </section>
  )
}

/**
 * Overview/editor mode: a list of threads (renameable, each showing its
 * ordered steps) plus an always-visible Unsorted section - a real
 * addressable `StepContainer`, not just a UI label, per requirement 3.
 * Drag-and-drop (via dnd-kit) reorders steps within a container and moves
 * them between containers, including into/out of Unsorted. The Guide shown
 * here stays live via the `guide:updated` subscription (Task 6) rather than
 * re-fetching after every local action.
 */
function OverviewScreen(): React.JSX.Element {
  const [current, setCurrent] = useState<CurrentGuideResult | null>(null)
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [croppingStepId, setCroppingStepId] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  const imageCache = useRef(new Map<string, string>())

  useEffect(() => {
    window.guideApi.getCurrent().then(setCurrent)
    const unsubscribe = window.guideApi.onGuideUpdated(setCurrent)
    return unsubscribe
  }, [])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const guide = current?.guide ?? null
  const guidePath = current?.guidePath ?? null

  function handleDragStart(event: DragStartEvent): void {
    setActiveStepId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent): void {
    setActiveStepId(null)
    const { active, over } = event
    if (!guide || !over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    const containers = buildContainers(guide)

    const fromDescriptor = containers.find((c) => c.stepIds.includes(activeId))
    if (!fromDescriptor) return

    let toDescriptor = containers.find((c) => c.domId === overId)
    let toIndex: number

    if (toDescriptor) {
      // Dropped on empty container space (or a container with no items) -
      // append at the end.
      toIndex = toDescriptor.stepIds.length
    } else {
      toDescriptor = containers.find((c) => c.stepIds.includes(overId))
      if (!toDescriptor) return
      toIndex = toDescriptor.stepIds.indexOf(overId)
    }

    const fromIndex = fromDescriptor.stepIds.indexOf(activeId)

    if (fromDescriptor.domId === toDescriptor.domId) {
      if (fromIndex === toIndex) return
      window.guideApi
        .reorderStep(fromDescriptor.container, fromIndex, toIndex)
        .catch((error: unknown) => {
          console.error('Failed to reorder step:', error)
        })
    } else {
      window.guideApi
        .moveStep(activeId, fromDescriptor.container, toDescriptor.container, toIndex)
        .catch((error: unknown) => {
          console.error('Failed to move step:', error)
        })
    }
  }

  async function handleExport(kind: 'json' | 'markdown' | 'pdf'): Promise<void> {
    setExportStatus(`Exporting ${kind}…`)
    try {
      const exporter =
        kind === 'json'
          ? window.guideApi.exportJson
          : kind === 'markdown'
            ? window.guideApi.exportMarkdown
            : window.guideApi.exportPdf
      const savedPath = await exporter()
      setExportStatus(savedPath ? `Exported to ${savedPath}` : 'Export cancelled.')
    } catch (error: unknown) {
      console.error(`Failed to export ${kind}:`, error)
      setExportStatus('Export failed.')
    }
  }

  if (!guide || !guidePath) {
    return (
      <div>
        <AppHeader />
        <main>
          <p>No guide loaded.</p>
        </main>
      </div>
    )
  }

  const activeStep = activeStepId ? guide.steps[activeStepId] : null
  const croppingStep = croppingStepId ? guide.steps[croppingStepId] : null

  return (
    <div>
      <AppHeader />
      <section style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 16px' }}>
        <span style={{ fontWeight: 'bold' }}>Export:</span>
        <button type="button" onClick={() => handleExport('json')}>
          JSON
        </button>
        <button type="button" onClick={() => handleExport('markdown')}>
          Markdown
        </button>
        <button type="button" onClick={() => handleExport('pdf')}>
          PDF
        </button>
        {exportStatus ? <span style={{ fontSize: 12, color: '#666' }}>{exportStatus}</span> : null}
      </section>
      <main>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {guide.threads.map((thread) => (
            <ThreadSection
              key={thread.id}
              thread={thread}
              steps={guide.steps}
              guidePath={guidePath}
              imageCache={imageCache}
              onCropStep={setCroppingStepId}
            />
          ))}

          <section>
            <h2>Unsorted</h2>
            <StepList
              descriptor={{
                domId: 'unsorted',
                container: { kind: 'unsorted' },
                stepIds: guide.unsorted.stepIds
              }}
              steps={guide.steps}
              guidePath={guidePath}
              imageCache={imageCache}
              emptyLabel="Nothing unsorted."
              onCropStep={setCroppingStepId}
            />
          </section>

          <DragOverlay>
            {activeStep ? (
              <div
                style={{
                  padding: 8,
                  background: 'white',
                  border: '1px solid #333',
                  borderRadius: 4
                }}
              >
                {activeStep.caption || '(untitled step)'}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </main>

      {croppingStep ? (
        <CropEditor
          guidePath={guidePath}
          step={croppingStep}
          onClose={() => setCroppingStepId(null)}
        />
      ) : null}
    </div>
  )
}

export default OverviewScreen
