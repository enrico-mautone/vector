import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { LogData } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

interface StepEntryState {
  checked: boolean
  minutes: string
}

export function LogPage() {
  const [data, setData] = useState<LogData | null>(null)
  const [steps, setSteps] = useState<Record<string, StepEntryState>>({})
  const [habits, setHabits] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .log()
      .then((res) => {
        setData(res)
        const stepState: Record<string, StepEntryState> = {}
        res.projects.forEach((p) =>
          p.displaySteps.forEach((s) => {
            stepState[s.id] = { checked: s.checkedToday, minutes: s.minutesToday === '' ? '' : String(s.minutesToday) }
          }),
        )
        setSteps(stepState)
        setHabits(res.todayEntry.habits || {})
      })
      .catch(() => toast.error('Non riesco a caricare Registra.'))
  }, [])

  async function handleSave() {
    if (!data) return
    setSaving(true)
    try {
      const payload = Object.entries(steps)
        .filter(([, s]) => s.checked)
        .map(([stepId, s]) => ({ stepId, minutes: parseInt(s.minutes, 10) || 0 }))
      await api.saveLog(payload, habits)
      toast.success('Log salvato.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio.')
    } finally {
      setSaving(false)
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {data.projects.map((project) => (
          <Card key={project.id}>
            <CardHeader>
              <CardTitle className="text-base">{project.name}</CardTitle>
              <CardDescription>Seleziona gli step fatti oggi</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {project.displaySteps.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessuno step in backlog.</p>
              )}
              {project.displaySteps.map((s, i) => (
                <div key={s.id}>
                  {i > 0 && <Separator className="my-2" />}
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={steps[s.id]?.checked ?? false}
                      onCheckedChange={(checked) =>
                        setSteps((prev) => ({ ...prev, [s.id]: { ...prev[s.id], checked: checked === true } }))
                      }
                    />
                    <span className="flex-1 text-sm">{s.text}</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="min"
                      className="w-20"
                      disabled={!steps[s.id]?.checked}
                      value={steps[s.id]?.minutes ?? ''}
                      onChange={(e) =>
                        setSteps((prev) => ({ ...prev, [s.id]: { ...prev[s.id], minutes: e.target.value } }))
                      }
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Abitudini</CardTitle>
          <CardDescription>Spunta quelle fatte oggi</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {data.config.habits.map((h) => (
            <label key={h.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={habits[h.id] ?? false}
                onCheckedChange={(checked) => setHabits((prev) => ({ ...prev, [h.id]: checked === true }))}
              />
              {h.name}
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          Salva registro
        </Button>
      </div>
    </div>
  )
}
