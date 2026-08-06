# Refactor pagina /projects: progetti come accordion verticale

Data: 2026-08-06

## Contesto

Oggi `ProjectsPage` (`frontend/src/pages/projects-page.tsx`) mostra i progetti come
`Tabs` orizzontali (`ui/tabs.tsx`, basato su `@base-ui/react/tabs`): un progetto è
selezionato alla volta tramite tab, e il suo contenuto (lista obiettivi) appare sotto.
Il riordino dei progetti avviene via drag&drop sulle `TabsTrigger`.

Vogliamo invece che i progetti siano impilati verticalmente, ciascuno come sezione
di un accordion, con **un solo progetto aperto alla volta**. Il drag&drop per
riordinare i progetti va mantenuto.

Gli obiettivi dentro ogni progetto (`ObjectiveSection`, `ProjectBacklog`) non cambiano:
hanno già un proprio toggle apri/chiudi indipendente e restano così.

## Obiettivo

Sostituire il livello "progetti" da tab orizzontali ad accordion verticale,
mantenendo tutte le funzionalità esistenti (drag&drop riordino progetti, aggiunta
progetto/obiettivo, contenuto identico nel pannello).

## Design

### 1. Nuovo componente `frontend/src/components/ui/accordion.tsx`

Wrapper shadcn-style attorno a `@base-ui/react/accordion` (stesso pattern già usato
da `ui/tabs.tsx` per `@base-ui/react/tabs`, libreria già presente in
`node_modules/@base-ui/react`). Nessuna logica di business — solo styling e
composizione dei part primitivi:

- `Accordion` → `Accordion.Root`
- `AccordionItem` → `Accordion.Item`
- `AccordionHeader` → `Accordion.Header`
- `AccordionTrigger` → `Accordion.Trigger`, con icona chevron che ruota in base allo
  stato espanso/collassato (stesso trattamento del chevron già usato in
  `ObjectiveSection`)
- `AccordionPanel` → `Accordion.Panel`

Componente generico e riusabile, non specifico alla pagina progetti.

### 2. `ProjectsPage`: struttura

- `Tabs` / `TabsList` / `TabsContent` sono sostituiti da `Accordion` (root con
  `multiple={false}`, il default della libreria — un solo item espanso alla volta,
  e cliccare l'item già aperto lo collassa) con un `AccordionItem` per progetto,
  impilati verticalmente invece che affiancati come tab.
- Stato di apertura controllato: nuovo state `const [openProjectId, setOpenProjectId]`
  (analogo a `dragId`/`objDragId` già presenti), inizializzato al primo progetto
  (`data.projects[0]?.id`) per replicare il comportamento attuale (`Tabs
  defaultValue={data.projects[0]?.id}`). L'inizializzazione avviene una sola volta
  al primo caricamento dei dati (es. `useEffect` che imposta il default se
  `openProjectId` è ancora `undefined`), così il riordino/drag&drop successivo dei
  progetti non forza una riapertura. Se il progetto aperto viene eliminato o il suo
  id non è più presente nei dati, l'accordion risulta semplicemente senza item
  espanso — nessuna gestione speciale necessaria (comportamento equivalente a oggi
  se il progetto selezionato in tab veniva rimosso).
- Header di ogni `AccordionItem` (dentro `AccordionTrigger`): stesso contenuto
  visuale già presente nella `TabsTrigger` di oggi — icona grip (`GripVertical`),
  `Badge` con `p.priority`, nome progetto (`p.name`), più il chevron di espansione
  gestito dal componente accordion stesso.
- `AccordionPanel` di ogni item: stesso contenuto già presente in `TabsContent` di
  oggi, invariato — riga con `AddObjectiveDialog`, messaggio "Nessun obiettivo
  ancora" se vuoto, mappa di `ObjectiveSection` per ciascun obiettivo del progetto.
  Nessuna modifica a `ObjectiveSection` o `ProjectBacklog`.

### 3. Drag&drop riordino progetti

Stesso pattern già usato in `ObjectiveSection` per il drag&drop degli obiettivi
(outer `div` draggable + elemento cliccabile interno indipendente): gli handler di
drag&drop già esistenti in `ProjectsPage` (`dragId`, `dragOverId`, `handleDrop`,
`onDragStart`/`onDragEnd`/`onDragOver`/`onDragLeave`/`onDrop`) restano identici nella
logica, ma si spostano dalla `TabsTrigger` all'header/wrapper dell'`AccordionItem`
(es. sul `div` reso da `AccordionHeader`, o su un wrapper attorno ad esso), lasciando
`AccordionTrigger` libero di gestire solo il click di apertura/chiusura. Nessuna
modifica al backend o a `api.reorderProjects`.

## Fuori scope

- Nessuna modifica al comportamento di `ObjectiveSection`/`ProjectBacklog` (toggle
  apertura obiettivi, drag&drop step, ecc.).
- Nessuna modifica alle API backend (`src/`, `data/*.json`).
- Nessuna modifica al componente `ui/tabs.tsx` esistente (resta usato altrove se
  presente; qui viene solo sostituito nell'uso specifico di `ProjectsPage`).

## Testing

Verifica manuale in dev (nessun test automatico esistente per questa pagina):

- Un solo progetto risulta espanso alla volta; cliccare un altro progetto chiude
  quello precedente e apre il nuovo; cliccare quello già aperto lo collassa.
- Drag&drop tra header di progetti diversi riordina correttamente (persistenza via
  `api.reorderProjects`, verificabile in `data/config.json` o dal riordino dei
  `priority` mostrati).
- Aggiunta progetto/obiettivo e contenuto del pannello (lista obiettivi, drag&drop
  step, completamento) continuano a funzionare esattamente come prima.
