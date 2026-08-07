# Scheda progetto: valutazione WSJF-lite e indicatore "$" in Projects

Data: 2026-08-06

## Contesto

Ogni `Project` in `data/config.json` ha oggi solo `id`, `name`, `priority` (e
`archived`). `priority` è un numero impostato a mano (drag&drop in
`ProjectsPage`) e guida sia l'ordine di visualizzazione sia i gate "Lo devi
fare!!!!" / "Non esagerare!!" in Home (`src/server.js`,
`activeProjectsByPriority`).

Vogliamo affiancare a `priority` — senza sostituirla — una valutazione
esplicita del valore economico e di opportunità di ogni progetto, secondo un
modello WSJF-lite (Weighted Shortest Job First semplificato):

```
score = (valoreEconomico + opportunità + urgenza) / effort
```

dove ciascuna componente è una stima 1-5 impostata a mano dall'utente (nessun
calcolo automatico da dati esterni — Vector è un progetto personale, non c'è
"reach" misurabile). Il risultato va mostrato in `ProjectsPage` come
indicatore visivo veloce ("$" ripetuti), con il dettaglio al passaggio del
mouse.

## Obiettivo

1. Una "scheda progetto" (dialog) per rinominare il progetto, impostarne una
   descrizione libera, e impostare le 4 componenti WSJF (1-5 ciascuna).
2. Il punteggio calcolato viene mostrato accanto al nome del progetto in
   `ProjectsPage` come sequenza di simboli `$` (1-5 simboli).
3. Al passaggio del mouse sul badge `$`, un tooltip mostra il valore di
   ciascuna delle 4 componenti e lo score totale.
4. `priority` resta come oggi, invariato e gestito separatamente (drag&drop):
   questa funzionalità non lo tocca né lo sostituisce.

## Design

### 1. Modello dati (`data/config.json`, `frontend/src/lib/types.ts`)

Estendere `Project` con campi opzionali (assenti = "non ancora valutato"):

```ts
export interface Project {
  id: string
  name: string
  priority: number
  archived?: boolean
  description?: string
  valueEconomic?: number    // 1-5
  valueOpportunity?: number // 1-5
  valueUrgency?: number     // 1-5
  valueEffort?: number      // 1-5
}
```

Nessuna migrazione dati necessaria: i progetti esistenti in
`data/config.json` restano validi senza questi campi (trattati come "da
valutare").

### 2. Calcolo score (`frontend/src/lib/utils.ts`)

Due funzioni pure, riusabili sia per il badge sia per il tooltip:

```ts
export function computeValueScore(p: Project): number | null {
  const { valueEconomic: e, valueOpportunity: o, valueUrgency: u, valueEffort: f } = p
  if (!e || !o || !u || !f) return null // non ancora valutato
  return (e + o + u) / f
}

// Mappa lo score continuo (min 3/5=0.6, max 15/1=15) su 1-5 simboli "$".
// Soglie tarate su distribuzione empirica: effort medio (3) con le altre
// componenti medio-alte dà "$$$"; punteggi estremi (effort 1, altre a 5) danno "$$$$$".
export function valueScoreToDollars(score: number): number {
  if (score >= 6) return 5
  if (score >= 4.5) return 4
  if (score >= 3) return 3
  if (score >= 1.8) return 2
  return 1
}
```

Nessun calcolo lato backend: lo score è derivato, il server salva solo le 4
componenti grezze + nome + descrizione.

### 3. Backend (`src/server.js`)

Nuovo endpoint, sul modello di `/api/objectives/:id/edit`:

```js
app.post('/api/projects/:id/edit', (req, res) => {
  const { name, description, valueEconomic, valueOpportunity, valueUrgency, valueEffort } = req.body
  const config = readJSON(CONFIG_PATH)
  const project = config.projects.find((p) => p.id === req.params.id)
  if (!project) return res.status(404).json({ ok: false, error: 'Progetto non trovato.' })
  if (!name || !name.trim()) return res.status(400).json({ ok: false, error: 'Nome progetto mancante.' })

  const clamp15 = (v) => (v === undefined || v === null || v === '' ? undefined : Math.min(5, Math.max(1, Math.round(Number(v)))))

  project.name = name.trim()
  project.description = (description || '').trim() || undefined
  project.valueEconomic = clamp15(valueEconomic)
  project.valueOpportunity = clamp15(valueOpportunity)
  project.valueUrgency = clamp15(valueUrgency)
  project.valueEffort = clamp15(valueEffort)
  writeJSON(CONFIG_PATH, config)
  res.json({ ok: true, project })
})
```

`GET /api/projects` non richiede modifiche: `{ ...p, objectives: ... }` già
propaga tutti i campi di `p`, inclusi quelli nuovi.

### 4. API client (`frontend/src/lib/api.ts`)

```ts
editProject: (
  id: string,
  patch: { name: string; description?: string; valueEconomic?: number; valueOpportunity?: number; valueUrgency?: number; valueEffort?: number }
) =>
  request<{ ok: true; project: Project }>(`/api/projects/${id}/edit`, {
    method: 'POST',
    body: JSON.stringify(patch),
  }),
```

### 5. Dialog "Scheda progetto" (`frontend/src/pages/projects-page.tsx`)

Nuovo componente `ProjectValueDialog`, sullo stesso pattern di
`EditObjectiveDialog`:

- Trigger: su **ogni** progetto (ogni `TabsTrigger`/header, uno per riga
  nella lista progetti) compare un `Button` icona con `Pencil`
  (`lucide-react`, size `size-3.5`, variant `ghost`, come già usato per
  `EditObjectiveDialog`), posizionato accanto al badge priorità e al nome
  progetto. Click apre il popup (`Dialog`) con la scheda di quel progetto
  specifico — un'istanza di `ProjectValueDialog` per progetto, ciascuna con
  il proprio `project` passato come prop (non un dialog condiviso/globale).
  `e.stopPropagation()` sul click del pulsante, per non attivare anche il
  toggle di apertura/selezione del progetto sottostante (tab o accordion
  trigger).
- Il dialog è indipendente dal contenitore tab/accordion: funziona
  identico se nel frattempo è stato applicato il refactor di
  `2026-08-06-projects-page-accordion-design.md`.
- Campi:
  - `Input` per il nome (obbligatorio, come oggi in `AddProjectDialog`).
  - `Textarea` per la descrizione (facoltativa).
  - 4 selettori 1-5 per Valore economico, Opportunità, Urgenza, Sforzo —
    riusare un piccolo componente `ScaleSelect` (5 pulsanti numerati o un
    gruppo di `Badge` cliccabili) con etichetta e microcopy sotto ciascuno
    (es. "Sforzo: 1 = poche ore, 5 = mesi di lavoro").
  - Anteprima live dello score/simboli `$` calcolati mentre si compila.
- Salvataggio: `api.editProject(project.id, {...})`, poi `onSaved()` /
  `load()` come gli altri dialog della pagina.

### 6. Badge "$" + tooltip nell'header progetto

Accanto al nome progetto (dove oggi c'è solo `<Badge>{p.priority}</Badge>` +
`p.name`):

```tsx
const score = computeValueScore(p)
...
{score !== null ? (
  <Tooltip>
    <TooltipTrigger render={<span className="font-mono text-sm text-emerald-600" />}>
      {'$'.repeat(valueScoreToDollars(score))}
    </TooltipTrigger>
    <TooltipContent>
      <div className="text-xs">
        <div>Valore economico: {p.valueEconomic}/5</div>
        <div>Opportunità: {p.valueOpportunity}/5</div>
        <div>Urgenza: {p.valueUrgency}/5</div>
        <div>Sforzo: {p.valueEffort}/5</div>
        <div className="mt-1 font-medium">Score: {score.toFixed(1)}</div>
      </div>
    </TooltipContent>
  </Tooltip>
) : (
  <span className="text-xs text-muted-foreground" title="Non ancora valutato">—</span>
)}
```

Usa `frontend/src/components/ui/tooltip.tsx`, già presente nel progetto
(verificare l'export esatto di `Tooltip`/`TooltipTrigger`/`TooltipContent`
prima di usarlo, potrebbe richiedere un `TooltipProvider` a livello di
`App.tsx` se non già presente).

## Fuori scope

- Nessuna modifica a `priority`, ai gate di Home, o alla logica di
  ordinamento esistente: lo score WSJF-lite è solo informativo/visuale in
  questa iterazione, non guida ancora l'ordinamento automatico dei progetti.
- Nessuna modifica al refactor accordion (spec separata,
  `2026-08-06-projects-page-accordion-design.md`) — il dialog e il badge
  vanno integrati in qualunque sia il contenitore corrente.
- Nessuna validazione "obbligatoria": un progetto può restare permanentemente
  senza valutazione, mostra semplicemente "—".

## Testing

Verifica manuale in dev:

- Aprire la scheda di un progetto senza valutazione: i 4 selettori sono
  vuoti, il badge nell'header mostra "—".
- Impostare le 4 componenti e salvare: il badge mostra da 1 a 5 simboli "$",
  coerenti con `valueScoreToDollars`.
- Hover sul badge: il tooltip mostra i 4 valori grezzi e lo score con un
  decimale.
- Rinominare il progetto dalla scheda: il nome si aggiorna ovunque compaia
  (header, eventuali riferimenti in Home).
- Modificare solo la descrizione senza toccare i valori WSJF già impostati:
  i valori restano invariati (non vengono azzerati da un salvataggio
  parziale).
- Un progetto con `priority` invariato dopo il salvataggio della scheda —
  drag&drop di riordino continua a funzionare come prima.
