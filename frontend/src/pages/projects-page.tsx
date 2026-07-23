import { useEffect, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { ProjectsData, Step } from '@/lib/types'
import { formatObjective } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
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
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [completedOpen, setCompletedOpen] = useState(false)

  const open = steps.filter((s) => !s.done)
  const done = steps.filter((s) => s.done)

  async function handleAdd() {
    if (!newStep.trim()) return
    await api.addStep(projectId, objectiveId, newStep.trim())
    setNewStep('')
    onChange()
  }

  async function handleBulk() {
    if (!bulkText.trim()) return
    await api.bulkAddSteps(projectId, objectiveId, bulkText)
    setBulkText('')
    onChange()
  }

  async function handleToggle(id: string) {
    await api.toggleStep(id)
    onChange()
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
    await api.deleteStep(id)
    onChange()
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const order = open.map((s) => s.id)
    const target = index + direction
    if (target < 0 || target >= order.length) return
    ;[order[index], order[target]] = [order[target], order[index]]
    await api.reorderSteps(projectId, order.concat(done.map((s) => s.id)))
    onChange()
  }

  // targetId=null significa "rilascia in fondo alla lista" (drop sul contenitore,
  // non su un item specifico). Legge dataTransfer per gestire anche il drop di
  // uno step trascinato da un ALTRO obiettivo (dragId locale non lo conosce).
  async function handleDrop(targetId: string | null, e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    let payload: { stepId: string; objectiveId: string } | null = null
    try {
      const raw = e.dataTransfer.getData('application/x-step')
      payload = raw ? JSON.parse(raw) : null
    } catch {
      payload = null
    }
    const stepId = payload?.stepId ?? dragId
    const sourceObjectiveId = payload?.objectiveId ?? objectiveId
    setDragId(null)
    if (!stepId || stepId === targetId) return

    if (sourceObjectiveId !== objectiveId) {
      await api.moveStep(stepId, objectiveId)
    }
    const order = open.map((s) => s.id).filter((id) => id !== stepId)
    const toIndex = targetId ? order.indexOf(targetId) : order.length
    order.splice(toIndex === -1 ? order.length : toIndex, 0, stepId)
    await api.reorderSteps(projectId, order.concat(done.map((s) => s.id)))
    onChange()
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

      <div
        className="flex flex-col gap-2"
        onDragOver={(e) => {
          if (readOnly) return
          e.preventDefault()
        }}
        onDrop={(e) => {
          if (readOnly) return
          handleDrop(null, e)
        }}
      >
        {open.length === 0 && <p className="text-sm text-muted-foreground">Nessuno step aperto. Trascina qui uno step da un altro obiettivo.</p>}
        {open.map((s, i) => (
          <div
            key={s.id}
            draggable={!readOnly}
            onDragStart={(e) => {
              if (readOnly) return
              setDragId(s.id)
              e.dataTransfer.setData('application/x-step', JSON.stringify({ stepId: s.id, objectiveId }))
            }}
            onDragEnd={() => {
              setDragId(null)
              setDragOverId(null)
            }}
            onDragOver={(e) => {
              if (readOnly) return
              e.preventDefault()
              e.stopPropagation()
              if (dragId !== s.id) setDragOverId(s.id)
            }}
            onDragLeave={() => setDragOverId((cur) => (cur === s.id ? null : cur))}
            onDrop={(e) => {
              if (readOnly) return
              handleDrop(s.id, e)
            }}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 ${dragId === s.id ? 'opacity-40' : ''} ${
              dragOverId === s.id ? 'border-t-2 border-t-primary' : ''
            }`}
          >
            {!readOnly && <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />}
            {editingId === s.id ? (
              <>
                <Input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(s.id)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  className="h-7 flex-1"
                />
                <Button variant="ghost" size="icon" className="size-7" onClick={() => saveEdit(s.id)}>
                  <Check className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={cancelEdit}>
                  <X className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{s.text}</span>
                {!readOnly && (
                  <>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => startEdit(s)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => handleMove(i, -1)}>
                      <ArrowUp className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={i === open.length - 1}
                      onClick={() => handleMove(i, 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(s.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
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

function ObjectiveSection({
  objective,
  projectId,
  onChange,
  isOpen,
  onToggleOpen,
  draggable = false,
  isDragging = false,
  isDragOver = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  onActivate,
}: {
  objective: ProjectsData['projects'][number]['objectives'][number]
  projectId: string
  onChange: () => void
  isOpen: boolean
  onToggleOpen: () => void
  draggable?: boolean
  isDragging?: boolean
  isDragOver?: boolean
  onDragStart?: () => void
  onDragEnd?: () => void
  onDragOver?: (e: DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: DragEvent) => void
  onActivate?: () => void
}) {
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [pending, setPending] = useState(false)
  const hasOpenStep = objective.steps.some((s) => !s.done)
  const canFinish = objective.active && !hasOpenStep && objective.steps.length > 0

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
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDragLeave={draggable ? onDragLeave : undefined}
      onDrop={draggable ? onDrop : undefined}
      className={`flex flex-col gap-3 rounded-lg border p-4 ${objective.completed ? 'opacity-60' : ''} ${!objective.active && !objective.completed ? 'opacity-70' : ''} ${
        draggable && isDragging ? 'opacity-40' : ''
      } ${draggable && isDragOver ? 'border-t-2 border-t-primary' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
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

export function ProjectsPage() {
  const [data, setData] = useState<ProjectsData | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [objDragId, setObjDragId] = useState<string | null>(null)
  const [objDragOverId, setObjDragOverId] = useState<string | null>(null)
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({})

  function load() {
    api.projects().then(setData).catch(() => toast.error('Non riesco a caricare Progetti.'))
  }

  useEffect(load, [])

  if (!data) return <Skeleton className="h-96 w-full" />

  async function handleDrop(targetId: string) {
    setDragOverId(null)
    if (!data || !dragId || dragId === targetId) {
      setDragId(null)
      return
    }
    const order = data.projects.map((p) => p.id)
    const fromIndex = order.indexOf(dragId)
    const toIndex = order.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDragId(null)
      return
    }
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, dragId)
    setDragId(null)
    await api.reorderProjects(order)
    load()
  }

  async function handleObjectiveDrop(project: ProjectsData['projects'][number], targetId: string) {
    setObjDragOverId(null)
    if (!objDragId || objDragId === targetId) {
      setObjDragId(null)
      return
    }
    const order = project.objectives.map((o) => o.id)
    const fromIndex = order.indexOf(objDragId)
    const toIndex = order.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setObjDragId(null)
      return
    }
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, objDragId)
    setObjDragId(null)
    await api.reorderObjectives(project.id, order)
    load()
  }

  async function handleActivateObjective(project: ProjectsData['projects'][number], objectiveId: string) {
    const order = project.objectives.map((o) => o.id)
    const index = order.indexOf(objectiveId)
    if (index === -1) return
    order.splice(index, 1)
    order.unshift(objectiveId)
    await api.reorderObjectives(project.id, order)
    load()
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
        <Tabs defaultValue={data.projects[0]?.id}>
          <TabsList>
            {data.projects.map((p) => (
              <TabsTrigger
                key={p.id}
                value={p.id}
                draggable
                onDragStart={() => setDragId(p.id)}
                onDragEnd={() => {
                  setDragId(null)
                  setDragOverId(null)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragId && dragId !== p.id) setDragOverId(p.id)
                }}
                onDragLeave={() => setDragOverId((cur) => (cur === p.id ? null : cur))}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(p.id)
                }}
                className={`gap-1.5 cursor-grab ${dragId === p.id ? 'opacity-40' : ''} ${
                  dragOverId === p.id ? 'border-l-2 border-l-primary' : ''
                }`}
              >
                <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                <Badge variant="outline" className="font-mono">
                  {p.priority}
                </Badge>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {data.projects.map((p) => (
            <TabsContent key={p.id} value={p.id} className="flex flex-col gap-4">
              <div className="flex justify-end">
                <AddObjectiveDialog projectId={p.id} onAdded={load} />
              </div>
              {p.objectives.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessun obiettivo ancora. Aggiungine uno per iniziare.</p>
              )}
              {p.objectives.map((o) => {
                const queued = !o.active && !o.completed
                return (
                  <ObjectiveSection
                    key={o.id}
                    objective={o}
                    projectId={p.id}
                    onChange={load}
                    isOpen={openOverrides[o.id] ?? o.active}
                    onToggleOpen={() =>
                      setOpenOverrides((prev) => ({ ...prev, [o.id]: !(prev[o.id] ?? o.active) }))
                    }
                    draggable={queued}
                    isDragging={objDragId === o.id}
                    isDragOver={objDragOverId === o.id}
                    onDragStart={() => setObjDragId(o.id)}
                    onDragEnd={() => {
                      setObjDragId(null)
                      setObjDragOverId(null)
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      if (objDragId && objDragId !== o.id) setObjDragOverId(o.id)
                    }}
                    onDragLeave={() => setObjDragOverId((cur) => (cur === o.id ? null : cur))}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleObjectiveDrop(p, o.id)
                    }}
                    onActivate={queued ? () => handleActivateObjective(p, o.id) : undefined}
                  />
                )
              })}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
