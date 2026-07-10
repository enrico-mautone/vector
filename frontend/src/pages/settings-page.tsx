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

  async function handleToggle(key: 'enforcePriorityOrder' | 'limitDailyTasksByPriority', checked: boolean) {
    if (!data) return
    setData({ config: { ...data.config, [key]: checked } })
    try {
      await api.saveSettings({ [key]: checked })
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
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Lo devi fare!!!!</p>
            <p className="text-sm text-muted-foreground">
              Blocca la registrazione di uno step su un progetto se uno a priorità più alta non ha ancora ricevuto
              nessuno step oggi.
            </p>
          </div>
          <Switch
            checked={data.config.enforcePriorityOrder}
            onCheckedChange={(checked) => handleToggle('enforcePriorityOrder', checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-md border p-4">
          <div>
            <p className="text-sm font-medium">Non esagerare!!</p>
            <p className="text-sm text-muted-foreground">
              Limita gli step completabili al giorno per progetto in base alla priorità: 5 per il 1° progetto, 4 per
              il 2°, fino a 1 per il 5°. Dal 6° progetto in poi è bloccato finché uno dei primi 5 non viene
              archiviato. Evita di passare la giornata solo sui progetti meno prioritari (di solito i più
              divertenti) una volta sbloccati.
            </p>
          </div>
          <Switch
            checked={data.config.limitDailyTasksByPriority}
            onCheckedChange={(checked) => handleToggle('limitDailyTasksByPriority', checked)}
          />
        </div>
      </CardContent>
    </Card>
  )
}
