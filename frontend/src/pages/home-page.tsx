import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Flame, Quote as QuoteIcon } from 'lucide-react'
import { api } from '@/lib/api'
import type { HomeData } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
import { toast } from 'sonner'

function VectorLine({ data }: { data: HomeData }) {
  const projects = data.actionsToday
  const today = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">La rotta di oggi</CardTitle>
            <CardDescription>Ordine di priorità · in evidenza il prossimo su cui lavorare</CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 font-mono capitalize">
            {today}
          </Badge>
        </div>
        {data.config.enforcePriorityOrder && (
          <div className="mt-1 flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            "Lo devi fare!!!" è attivo — l'ordine di priorità è vincolante.
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center overflow-x-auto pb-2">
          {projects.map((p, i) => {
            const isNext = p.workable && !p.doneToday
            const dotClass = p.doneToday
              ? 'bg-primary'
              : p.urgent
                ? 'bg-urgent-foreground'
                : isNext
                  ? 'bg-primary'
                  : 'bg-border'
            return (
              <div key={p.id} className="flex items-center">
                {i > 0 && <div className="h-px w-10 shrink-0 bg-border" />}
                <Tooltip>
                  <TooltipTrigger render={<span className="flex cursor-default flex-col items-center gap-1.5" />}>
                    <div
                      className={`flex size-3.5 shrink-0 items-center justify-center rounded-full ring-4 ${dotClass} ${isNext ? 'ring-accent' : 'ring-transparent'}`}
                    />
                    <span className="max-w-20 truncate text-xs text-muted-foreground">{p.name}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {p.name} · priorità {p.priority}
                    {p.doneToday ? ' · fatto oggi' : p.urgent ? ' · urgente' : isNext ? ' · prossimo' : ''}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ActionCard({
  data,
  project,
  onChange,
}: {
  data: HomeData
  project: HomeData['actionsToday'][number]
  onChange: () => void
}) {
  const [pending, setPending] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const blocked = data.config.enforcePriorityOrder && !project.workable && !project.doneToday

  async function handleComplete() {
    if (!project.nextStepId) return
    setPending(true)
    try {
      await api.completeStep(project.id, project.nextStepId)
      toast.success('Ben fatto continua così!! +10pt')
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio.')
    } finally {
      setPending(false)
    }
  }

  async function handleFinish() {
    setPending(true)
    try {
      await api.finishProject(project.id)
      toast.success(`"${project.name}" archiviato.`)
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio.')
    } finally {
      setPending(false)
      setConfirmFinish(false)
    }
  }

  return (
    <Card className={blocked ? 'opacity-60' : ''}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {project.priority}
            </Badge>
            <CardTitle className="text-base">{project.name}</CardTitle>
          </div>
          {project.doneToday && (
            <Badge className="bg-primary/10 text-primary">
              <CheckCircle2 className="size-3.5" /> Fatto oggi
            </Badge>
          )}
          {!project.doneToday && project.urgent && <Badge variant="destructive">Urgente</Badge>}
        </div>
        <CardDescription>
          {project.daysSince === null
            ? 'Nessuno step registrato finora'
            : project.daysSince === 0
              ? 'Ultimo step oggi'
              : `Ultimo step ${project.daysSince} giorni fa`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-3">
        {project.nextStepText ? (
          <p className="text-sm">{project.nextStepText}</p>
        ) : project.hasBacklog ? (
          <p className="text-sm text-muted-foreground">Non ci sono più step. Il progetto è terminato?</p>
        ) : (
          <p className="text-sm text-muted-foreground">Nessuno step in backlog. Aggiungine uno in Progetti.</p>
        )}
        {project.nextStepId ? (
          <Button size="sm" disabled={pending || blocked} onClick={handleComplete}>
            Segna fatto
          </Button>
        ) : project.hasBacklog ? (
          <AlertDialog open={confirmFinish} onOpenChange={setConfirmFinish}>
            <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>Segna terminato</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archiviare "{project.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Il progetto sparirà da questa vista. Puoi farlo solo quando non ci sono più step aperti.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Non ancora</AlertDialogCancel>
                <AlertDialogAction disabled={pending} onClick={handleFinish}>
                  Archivia
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  )
}

function HabitsPanel({ data, onChange }: { data: HomeData; onChange: () => void }) {
  async function handleToggle(habitId: string) {
    try {
      const result = await api.toggleHabit(habitId)
      if (result.done) toast.success('Ben fatto continua così!! +10pt')
      onChange()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Abitudini</CardTitle>
        <CardDescription>Costanza di oggi</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {data.habitsStatus.map((h, i) => (
          <div key={h.id}>
            {i > 0 && <Separator className="my-3" />}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={h.doneToday} onCheckedChange={() => handleToggle(h.id)} />
                <span className="text-sm">{h.name}</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-sm text-muted-foreground">
                <Flame className={`size-3.5 ${h.streak > 0 ? 'text-urgent-foreground' : ''}`} />
                {h.streak}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function HomePage() {
  const [data, setData] = useState<HomeData | null>(null)

  function load() {
    api.home().then(setData).catch(() => toast.error('Non riesco a caricare Vector.'))
  }

  useEffect(load, [])

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-40 lg:col-span-2" />
          <Skeleton className="h-40" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {data.quote && (
        <Card className="border-dashed bg-accent/40">
          <CardContent className="flex items-start gap-3 py-4">
            <QuoteIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm italic text-foreground/80">
              "{data.quote.text}"
              {data.quote.author && <span className="not-italic text-muted-foreground"> — {data.quote.author}</span>}
            </p>
          </CardContent>
        </Card>
      )}

      <VectorLine data={data} />

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {data.actionsToday.map((project) => (
            <ActionCard key={project.id} data={data} project={project} onChange={load} />
          ))}
        </div>
        <HabitsPanel data={data} onChange={load} />
      </div>
    </div>
  )
}
