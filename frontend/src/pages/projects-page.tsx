import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { ProjectsData, Step } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

function ProjectBacklog({ steps, projectId, onChange }: { steps: Step[]; projectId: string; onChange: () => void }) {
  const [newStep, setNewStep] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const open = steps.filter((s) => !s.done)
  const done = steps.filter((s) => s.done)

  async function handleAdd() {
    if (!newStep.trim()) return
    await api.addStep(projectId, newStep.trim())
    setNewStep('')
    onChange()
  }

  async function handleBulk() {
    if (!bulkText.trim()) return
    await api.bulkAddSteps(projectId, bulkText)
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

  async function handleDrop(targetId: string) {
    setDragOverId(null)
    if (!dragId || dragId === targetId) {
      setDragId(null)
      return
    }
    const order = open.map((s) => s.id)
    const fromIndex = order.indexOf(dragId)
    const toIndex = order.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) {
      setDragId(null)
      return
    }
    order.splice(fromIndex, 1)
    order.splice(toIndex, 0, dragId)
    setDragId(null)
    await api.reorderSteps(projectId, order.concat(done.map((s) => s.id)))
    onChange()
  }

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-2">
        {open.length === 0 && <p className="text-sm text-muted-foreground">Nessuno step aperto.</p>}
        {open.map((s, i) => (
          <div
            key={s.id}
            draggable
            onDragStart={() => setDragId(s.id)}
            onDragEnd={() => {
              setDragId(null)
              setDragOverId(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (dragId && dragId !== s.id) setDragOverId(s.id)
            }}
            onDragLeave={() => setDragOverId((cur) => (cur === s.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault()
              handleDrop(s.id)
            }}
            className={`flex items-center gap-2 rounded-md border px-3 py-2 ${dragId === s.id ? 'opacity-40' : ''} ${
              dragOverId === s.id ? 'border-t-2 border-t-primary' : ''
            }`}
          >
            <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
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
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">Completati</p>
            {done.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md border border-dashed px-3 py-2 opacity-60">
                <Checkbox checked onCheckedChange={() => handleToggle(s.id)} />
                <span className="flex-1 text-sm line-through">{s.text}</span>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">Incolla più righe (separa con a-capo o ";")</p>
        <div className="flex gap-2">
          <Textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={2} />
          <Button variant="outline" onClick={handleBulk}>
            Aggiungi tutti
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ProjectsPage() {
  const [data, setData] = useState<ProjectsData | null>(null)

  function load() {
    api.projects().then(setData).catch(() => toast.error('Non riesco a caricare Progetti.'))
  }

  useEffect(load, [])

  if (!data) return <Skeleton className="h-96 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backlog per progetto</CardTitle>
        <CardDescription>In ordine di priorità</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={data.projects[0]?.id}>
          <TabsList>
            {data.projects.map((p) => (
              <TabsTrigger key={p.id} value={p.id} className="gap-1.5">
                <Badge variant="outline" className="font-mono">
                  {p.priority}
                </Badge>
                {p.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {data.projects.map((p) => (
            <TabsContent key={p.id} value={p.id}>
              <ProjectBacklog steps={p.projectSteps} projectId={p.id} onChange={load} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
