import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import type { Project, ProjectsData, Step } from '@/lib/types'
import { computeValueScore, formatObjective, valueScoreToDollars } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { ProjectValueBadge } from '@/components/project-value-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

// Un singolo step trascinabile. L'handle di trascinamento (icona grip) è l'unico
// elemento con i listener di drag: il resto della riga (bottoni edit/sposta/elimina)
// resta cliccabile senza conflitti con il gesto di drag.
function SortableStepRow({
  step,
  index,
  total,
  readOnly,
  editingId,
  editText,
  setEditText,
  startEdit,
  saveEdit,
  cancelEdit,
  handleMove,
  handleDelete,
}: {
  step: Step
  index: number
  total: number
  readOnly: boolean
  editingId: string | null
  editText: string
  setEditText: (v: string) => void
  startEdit: (s: Step) => void
  saveEdit: (id: string) => void
  cancelEdit: () => void
  handleMove: (index: number, direction: -1 | 1) => void
  handleDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `step:${step.id}`,
    disabled: readOnly,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 ${isDragging ? 'opacity-40' : ''}`}
    >
      {!readOnly && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab touch-none text-muted-foreground"
          aria-label="Trascina per riordinare"
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      {editingId === step.id ? (
        <>
          <Input
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit(step.id)
              if (e.key === 'Escape') cancelEdit()
            }}
            className="h-7 flex-1"
          />
          <Button variant="ghost" size="icon" className="size-7" onClick={() => saveEdit(step.id)}>
            <Check className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7" onClick={cancelEdit}>
            <X className="size-3.5" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm">{step.text}</span>
          {!readOnly && (
            <>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => startEdit(step)}>
                <Pencil className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" disabled={index === 0} onClick={() => handleMove(index, -1)}>
                <ArrowUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={index === total - 1}
                onClick={() => handleMove(index, 1)}
              >
                <ArrowDown className="size-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(step.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </>
      )}
    </div>
  )
}

function ProjectBacklog({
  steps,
  projectId,
  objectiveId,
  readOnly,
  onChange,
}: {
  steps: Step[]
  projectId: string
  objectiveId: string
  readOnly: boolean
  onChange: () => void
}) {
  const [newStep, setNewStep] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [completedOpen, setCompletedOpen] = useState(false)

  const open = steps.filter((s) => !s.done)
  const done = steps.filter((s) => s.done)

  async function handleAdd() {
    if (!newStep.trim()) return
    try {
      await api.addStep(projectId, objectiveId, newStep.trim())
      setNewStep('')
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riesco ad aggiungere lo step.")
    }
  }

  async function handleBulk() {
    if (!bulkText.trim()) return
    try {
      await api.bulkAddSteps(projectId, objectiveId, bulkText)
      setBulkText('')
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riesco ad aggiungere gli step.")
    }
  }

  async function handleToggle(id: string) {
    try {
      await api.toggleStep(id)
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riesco ad aggiornare lo step.")
    }
  }

  function startEdit(s: Step) {
    setEditingId(s.id)
    setEditText(s.text)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditText('')
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    await api.editStep(id, editText.trim())
    setEditingId(null)
    setEditText('')
    onChange()
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteStep(id)
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riesco a cancellare lo step.")
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const order = open.map((s) => s.id)
    const target = index + direction
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    try {
      await api.reorderSteps(projectId, order.concat(done.map((s) => s.id)))
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riesco a riordinare gli step.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!readOnly && (
        <div className="flex gap-2">
          <Input
            placeholder="Aggiungi uno step…"
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button variant="outline" size="icon" onClick={handleAdd} aria-label="Aggiungi step">
            <Plus />
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-md">
        {open.length === 0 && (
          <p className="text-sm text-muted-foreground">Nessuno step aperto. Trascina qui uno step da un altro obiettivo.</p>
        )}
        <SortableContext items={open.map((s) => `step:${s.id}`)} strategy={verticalListSortingStrategy}>
          {open.map((s, i) => (
            <SortableStepRow
              key={s.id}
              step={s}
              index={i}
              total={open.length}
              readOnly={readOnly}
              editingId={editingId}
              editText={editText}
              setEditText={setEditText}
              startEdit={startEdit}
              saveEdit={saveEdit}
              cancelEdit={cancelEdit}
              handleMove={handleMove}
              handleDelete={handleDelete}
            />
          ))}
        </SortableContext>
      </div>

      {done.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground"
              onClick={() => setCompletedOpen((v) => !v)}
            >
              {completedOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              Completati ({done.length})
            </button>
            {completedOpen &&
              done.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 opacity-60">
                  <Checkbox checked disabled={readOnly} onCheckedChange={() => !readOnly && handleToggle(s.id)} />
                  <span className="flex-1 text-sm line-through">{s.text}</span>
                  {s.completedAt && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(s.completedAt).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  )}
                  {!readOnly && (
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              ))}
          </div>
        </>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Incolla più righe (separa con a-capo o ";")</p>
          <div className="flex gap-2">
            <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={2} />
            <Button variant="outline" onClick={handleBulk}>
              Aggiungi tutti
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddObjectiveDialog({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [goal, setGoal] = useState('')
  const [outcome, setOutcome] = useState('')
  const [pending, setPending] = useState(false)

  async function handleCreate() {
    if (!goal.trim() || !outcome.trim()) return
    setPending(true)
    try {
      await api.addObjective(projectId, goal.trim(), outcome.trim())
      setGoal('')
      setOutcome('')
      setOpen(false)
      onAdded()
    } catch {
      toast.error("Non riesco a creare l'obiettivo.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="size-3.5" /> Aggiungi obiettivo
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo obiettivo</DialogTitle>
          <DialogDescription>Verrà messo in coda, dopo gli obiettivi già pianificati per questo progetto.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input placeholder="Obiettivo (es. Lanciare la demo)…" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Input
            placeholder="Risultato (es. per ottenere il primo utente reale)…"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>
        <DialogFooter>
          <Button disabled={pending || !goal.trim() || !outcome.trim()} onClick={handleCreate}>
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditObjectiveDialog({
  objective,
  onSaved,
}: {
  objective: { id: string; goal: string; outcome: string }
  onSaved: () => void
}) {
  const [open, setOpen] = useState(false)
  const [goal, setGoal] = useState(objective.goal)
  const [outcome, setOutcome] = useState(objective.outcome)
  const [pending, setPending] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) {
      setGoal(objective.goal)
      setOutcome(objective.outcome)
    }
    setOpen(next)
  }

  async function handleSave() {
    if (!goal.trim() || !outcome.trim()) return
    setPending(true)
    try {
      await api.editObjective(objective.id, goal.trim(), outcome.trim())
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Non riesco a salvare l'obiettivo.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="ghost" />}>
        <Pencil className="size-3.5" /> Modifica
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifica obiettivo</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Input placeholder="Obiettivo (es. Lanciare la demo)…" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <Input
            placeholder="Risultato (es. per ottenere il primo utente reale)…"
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>
        <DialogFooter>
          <Button disabled={pending || !goal.trim() || !outcome.trim()} onClick={handleSave}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Un obiettivo in coda si può trascinare per riordinarlo (handle dedicato, come
// per gli step); obiettivi attivi/completati restano fermi ma sono comunque
// validi bersagli di drop per far scorrere gli altri intorno a loro.
function ObjectiveSection({
  objective,
  projectId,
  onChange,
  isOpen,
  onToggleOpen,
  queued,
  onActivate,
}: {
  objective: ProjectsData['projects'][number]['objectives'][number]
  projectId: string
  onChange: () => void
  isOpen: boolean
  onToggleOpen: () => void
  queued: boolean
  onActivate?: () => void
}) {
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [pending, setPending] = useState(false)
  const hasOpenStep = objective.steps.some((s) => !s.done)
  const canFinish = objective.active && !hasOpenStep && objective.steps.length > 0

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `obj:${objective.id}`,
    disabled: !queued,
  })
  // Droppable a livello di intera card obiettivo (non solo della lista step aperti):
  // così un drop funziona anche quando l'obiettivo di destinazione è chiuso/collassato,
  // non solo quando è espanso e la lista step è visibile.
  const { setNodeRef: setDropZoneRef, isOver } = useDroppable({
    id: `dropzone:${objective.id}`,
    disabled: objective.completed,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }
  function setRefs(node: HTMLDivElement | null) {
    setNodeRef(node)
    setDropZoneRef(node)
  }

  async function handleFinish() {
    setPending(true)
    try {
      await api.finishObjective(objective.id)
      toast.success(`Obiettivo "${objective.goal}" completato.`)
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio.')
    } finally {
      setPending(false)
      setConfirmFinish(false)
    }
  }

  return (
    <div
      ref={setRefs}
      style={style}
      className={`flex flex-col gap-3 rounded-lg border p-4 ${objective.completed ? 'opacity-60' : ''} ${!objective.active && !objective.completed ? 'opacity-70' : ''} ${
        isDragging ? 'opacity-40' : ''
      } ${isOver ? 'ring-2 ring-primary/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        {queued && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-0.5 shrink-0 cursor-grab touch-none text-muted-foreground"
            aria-label="Trascina per riordinare"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleOpen}
          className="flex flex-1 items-start gap-2 text-left"
        >
          {isOpen ? (
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm">{formatObjective(objective.goal, objective.outcome)}</span>
        </button>
        <div className="flex items-center gap-2">
          {objective.active && (
            <EditObjectiveDialog
              objective={{ id: objective.id, goal: objective.goal, outcome: objective.outcome }}
              onSaved={onChange}
            />
          )}
          {objective.completed ? (
            <Badge variant="outline">completato</Badge>
          ) : objective.active ? (
            <Badge className="bg-primary/10 text-primary">attivo</Badge>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onActivate?.()
              }}
              title="Rendi questo l'obiettivo attivo"
            >
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                in coda
              </Badge>
            </button>
          )}
        </div>
      </div>
      {!isOpen && (
        <p className="pl-6 text-xs text-muted-foreground">
          {objective.steps.length === 0
            ? 'Nessuno step.'
            : `${objective.steps.filter((s) => !s.done).length} aperti su ${objective.steps.length} step`}
        </p>
      )}
      {isOpen && (
        <>
          <ProjectBacklog
            steps={objective.steps}
            projectId={projectId}
            objectiveId={objective.id}
            readOnly={objective.completed}
            onChange={onChange}
          />
          {canFinish && (
        <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
          <AlertDialogTrigger render={<Button size="sm" variant="outline" className="self-start" />}>
            Segna obiettivo completato
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Completare "{objective.goal}"?</AlertDialogTitle>
              <AlertDialogDescription>Il prossimo obiettivo per priorità si sbloccherà.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Non ancora</AlertDialogCancel>
              <AlertDialogAction disabled={pending} onClick={handleFinish}>
                Completa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          )}
        </>
      )}
    </div>
  )
}

function AddProjectDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setPending(true)
    try {
      await api.addProject(name.trim())
      setName('')
      setOpen(false)
      onAdded()
    } catch {
      toast.error('Non riesco a creare il progetto.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="icon" aria-label="Nuovo progetto" />}>
        <Plus />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo progetto</DialogTitle>
          <DialogDescription>Verrà aggiunto in coda, con l'ultima priorità.</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Nome del progetto…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <DialogFooter>
          <Button disabled={pending || !name.trim()} onClick={handleCreate}>
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const WSJF_FIELDS = {
  valueEconomic: { label: 'Valore economico', hint: '1 = nessun impatto economico, 5 = impatto economico diretto e rilevante' },
  valueOpportunity: { label: 'Opportunità', hint: '1 = nessuna nuova opportunità, 5 = apre opportunità significative' },
  valueUrgency: { label: 'Urgenza', hint: '1 = nessuna scadenza, 5 = urgente/bloccante ora' },
  valueEffort: { label: 'Sforzo', hint: '1 = poche ore, 5 = mesi di lavoro' },
} as const

function ScaleSelect({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number | undefined
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)}>
            <Badge variant={value === n ? 'default' : 'outline'} className="size-7 cursor-pointer justify-center rounded-md text-sm">
              {n}
            </Badge>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function ProjectValueDialog({ project, onSaved }: { project: Project; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [valueEconomic, setValueEconomic] = useState<number | undefined>(project.valueEconomic)
  const [valueOpportunity, setValueOpportunity] = useState<number | undefined>(project.valueOpportunity)
  const [valueUrgency, setValueUrgency] = useState<number | undefined>(project.valueUrgency)
  const [valueEffort, setValueEffort] = useState<number | undefined>(project.valueEffort)
  const [pending, setPending] = useState(false)

  function handleOpenChange(next: boolean) {
    if (next) {
      setName(project.name)
      setDescription(project.description ?? '')
      setValueEconomic(project.valueEconomic)
      setValueOpportunity(project.valueOpportunity)
      setValueUrgency(project.valueUrgency)
      setValueEffort(project.valueEffort)
    }
    setOpen(next)
  }

  const previewScore = computeValueScore({ valueEconomic, valueOpportunity, valueUrgency, valueEffort })

  async function handleSave() {
    if (!name.trim()) return
    setPending(true)
    try {
      await api.editProject(project.id, {
        name: name.trim(),
        description: description.trim(),
        valueEconomic,
        valueOpportunity,
        valueUrgency,
        valueEffort,
      })
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Non riesco a salvare il progetto.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label="Modifica progetto"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Scheda progetto</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Input placeholder="Nome del progetto…" value={name} onChange={(e) => setName(e.target.value)} />
          <Textarea
            placeholder="Descrizione (facoltativa)…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <ScaleSelect {...WSJF_FIELDS.valueEconomic} value={valueEconomic} onChange={setValueEconomic} />
          <ScaleSelect {...WSJF_FIELDS.valueOpportunity} value={valueOpportunity} onChange={setValueOpportunity} />
          <ScaleSelect {...WSJF_FIELDS.valueUrgency} value={valueUrgency} onChange={setValueUrgency} />
          <ScaleSelect {...WSJF_FIELDS.valueEffort} value={valueEffort} onChange={setValueEffort} />
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <span className="text-muted-foreground">Anteprima:</span>
            {previewScore !== null ? (
              <span className="font-mono text-emerald-600">
                {'$'.repeat(valueScoreToDollars(previewScore))}{' '}
                <span className="text-xs text-muted-foreground">(score {previewScore.toFixed(1)})</span>
              </span>
            ) : (
              <span className="text-muted-foreground">Non ancora valutato</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending || !name.trim()} onClick={handleSave}>
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Un unico DndContext per progetto copre sia il riordino degli obiettivi (drag
// sull'handle dell'obiettivo) sia il riordino/spostamento degli step fra
// obiettivi diversi dello stesso progetto (drag sull'handle dello step). I due
// casi si distinguono dal prefisso dell'id ("obj:"/"step:"/"dropzone:"), quindi
// un solo onDragEnd basta e non serve nidificare più DndContext.
function ObjectivesBoard({
  project,
  onChange,
  openOverrides,
  setOpenOverrides,
}: {
  project: ProjectsData['projects'][number]
  onChange: () => void
  openOverrides: Record<string, boolean>
  setOpenOverrides: Dispatch<SetStateAction<Record<string, boolean>>>
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  async function handleActivateObjective(objectiveId: string) {
    const order = project.objectives.map((o) => o.id)
    const index = order.indexOf(objectiveId)
    if (index === -1) return
    order.splice(index, 1)
    order.unshift(objectiveId)
    try {
      await api.reorderObjectives(project.id, order)
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Non riesco ad attivare questo obiettivo.')
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)
    if (activeId === overId) return

    if (activeId.startsWith('obj:')) {
      if (!overId.startsWith('obj:')) return
      const order = project.objectives.map((o) => `obj:${o.id}`)
      const fromIndex = order.indexOf(activeId)
      const toIndex = order.indexOf(overId)
      if (fromIndex === -1 || toIndex === -1) return
      const next = arrayMove(order, fromIndex, toIndex).map((id) => id.slice(4))
      try {
        await api.reorderObjectives(project.id, next)
        onChange()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Non riesco a riordinare gli obiettivi.')
      }
      return
    }

    if (!activeId.startsWith('step:')) return
    const stepId = activeId.slice(5)
    const sourceObjective = project.objectives.find((o) => o.steps.some((s) => s.id === stepId && !s.done))
    if (!sourceObjective) return

    let targetObjectiveId: string | null = null
    let overStepId: string | null = null
    if (overId.startsWith('dropzone:')) {
      targetObjectiveId = overId.slice(9)
    } else if (overId.startsWith('step:')) {
      overStepId = overId.slice(5)
      targetObjectiveId = project.objectives.find((o) => o.steps.some((s) => s.id === overStepId && !s.done))?.id ?? null
    }
    if (!targetObjectiveId) return

    try {
      if (sourceObjective.id !== targetObjectiveId) {
        await api.moveStep(stepId, targetObjectiveId)
      }
      const targetObjective = project.objectives.find((o) => o.id === targetObjectiveId)!
      const openIds = targetObjective.steps.filter((s) => !s.done && s.id !== stepId).map((s) => s.id)
      const doneIds = targetObjective.steps.filter((s) => s.done).map((s) => s.id)
      const toIndex = overStepId ? openIds.indexOf(overStepId) : openIds.length
      openIds.splice(toIndex === -1 ? openIds.length : toIndex, 0, stepId)
      await api.reorderSteps(project.id, openIds.concat(doneIds))
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Non riesco a riordinare gli step.')
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex justify-end">
        <AddObjectiveDialog projectId={project.id} onAdded={onChange} />
      </div>
      {project.objectives.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun obiettivo ancora. Aggiungine uno per iniziare.</p>
      )}
      <SortableContext items={project.objectives.map((o) => `obj:${o.id}`)} strategy={verticalListSortingStrategy}>
        {project.objectives.map((o) => {
          const queued = !o.active && !o.completed
          return (
            <ObjectiveSection
              key={o.id}
              objective={o}
              projectId={project.id}
              onChange={onChange}
              isOpen={openOverrides[o.id] ?? o.active}
              onToggleOpen={() =>
                setOpenOverrides((prev) => ({ ...prev, [o.id]: !(prev[o.id] ?? o.active) }))
              }
              queued={queued}
              onActivate={queued ? () => handleActivateObjective(o.id) : undefined}
            />
          )
        })}
      </SortableContext>
    </DndContext>
  )
}

// Riga di progetto trascinabile: solo l'icona grip ha i listener di drag, così
// il click sul trigger dell'accordion (per aprire/chiudere) e sui bottoni non
// entra in conflitto col gesto di trascinamento.
function SortableProjectItem({
  project,
  onChange,
  openOverrides,
  setOpenOverrides,
}: {
  project: ProjectsData['projects'][number]
  onChange: () => void
  openOverrides: Record<string, boolean>
  setOpenOverrides: Dispatch<SetStateAction<Record<string, boolean>>>
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <AccordionItem ref={setNodeRef} style={style} value={project.id} className={isDragging ? 'opacity-40' : ''}>
      <AccordionHeader>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex items-center px-2 cursor-grab touch-none text-muted-foreground"
          aria-label="Trascina per riordinare"
        >
          <GripVertical className="size-3.5" />
        </button>
        <AccordionTrigger>
          <Badge variant="outline" className="font-mono">
            {project.priority}
          </Badge>
          {project.name}
        </AccordionTrigger>
        <div className="flex items-center gap-1 px-2">
          <ProjectValueBadge project={project} />
          <ProjectValueDialog project={project} onSaved={onChange} />
        </div>
      </AccordionHeader>
      <AccordionPanel>
        <ObjectivesBoard project={project} onChange={onChange} openOverrides={openOverrides} setOpenOverrides={setOpenOverrides} />
      </AccordionPanel>
    </AccordionItem>
  )
}

export function ProjectsPage() {
  const [data, setData] = useState<ProjectsData | null>(null)
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})
  const [openProjectId, setOpenProjectId] = useState<string | undefined>(undefined)
  const didInitOpenProject = useRef(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  function load() {
    api.projects().then(setData).catch(() => toast.error('Non riesco a caricare Progetti.'))
  }

  useEffect(load, [])

  useEffect(() => {
    if (data && !didInitOpenProject.current) {
      didInitOpenProject.current = true
      setOpenProjectId(data.projects[0]?.id)
    }
  }, [data])

  if (!data) return <Skeleton className="h-96 w-full" />

  async function handleProjectDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!data || !over || active.id === over.id) return
    const order = data.projects.map((p) => p.id)
    const fromIndex = order.indexOf(String(active.id))
    const toIndex = order.indexOf(String(over.id))
    if (fromIndex === -1 || toIndex === -1) return
    const next = arrayMove(order, fromIndex, toIndex)
    try {
      await api.reorderProjects(next)
      load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Non riesco a riordinare i progetti.')
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">Backlog per progetto</CardTitle>
          <CardDescription>In ordine di priorità — trascina per riordinare</CardDescription>
        </div>
        <AddProjectDialog onAdded={load} />
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleProjectDragEnd}>
          <SortableContext items={data.projects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <Accordion
              value={openProjectId ? [openProjectId] : []}
              onValueChange={(value) => setOpenProjectId(value[0] ?? undefined)}
            >
              {data.projects.map((p) => (
                <SortableProjectItem
                  key={p.id}
                  project={p}
                  onChange={load}
                  openOverrides={openOverrides}
                  setOpenOverrides={setOpenOverrides}
                />
              ))}
            </Accordion>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  )
}
