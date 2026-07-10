import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import type { SettingsData } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'

export function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null)

  useEffect(() => {
    api.settings().then(setData).catch(() => toast.error('Non riesco a caricare Impostazioni.'))
  }, [])

  async function handleToggle(checked: boolean) {
    if (!data) return
    setData({ config: { ...data.config, enforcePriorityOrder: checked } })
    try {
      await api.saveSettings(checked)
      toast.success('Impostazioni salvate.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore nel salvataggio.')
    }
  }

  if (!data) return <Skeleton className="h-40 w-full" />

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ordine di priorità</CardTitle>
        <CardDescription>Regole che Vector applica in Oggi</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Lo devi fare!!!!</p>
            <p className="text-sm text-muted-foreground">
              Blocca la registrazione di uno step su un progetto se uno a priorità più alta non ha ancora ricevuto
              nessuno step oggi.
            </p>
          </div>
          <Switch checked={data.config.enforcePriorityOrder} onCheckedChange={handleToggle} />
        </div>
      </CardContent>
    </Card>
  )
}
