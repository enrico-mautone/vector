# Refactor pagina /projects: progetti come accordion verticale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire i `Tabs` orizzontali di `ProjectsPage` con un accordion
verticale (un progetto aperto alla volta), mantenendo drag&drop di riordino
progetti e tutto il contenuto/comportamento esistente degli obiettivi.

**Architecture:** Nuovo componente shadcn-style `ui/accordion.tsx` che avvolge il
primitivo `@base-ui/react/accordion` (stesso pattern già usato da `ui/tabs.tsx`
per `@base-ui/react/tabs`). `ProjectsPage` sostituisce `Tabs`/`TabsList`/
`TabsContent` con `Accordion`/`AccordionItem`/`AccordionHeader`/`AccordionTrigger`/
`AccordionPanel`, con stato di apertura controllato a livello di pagina. Gli
handler di drag&drop già esistenti per il riordino progetti migrano dalla
`TabsTrigger` al wrapper dell'header dell'accordion, senza cambiare la loro logica.

**Tech Stack:** React 19, TypeScript, `@base-ui/react` (già dipendenza), Tailwind
v4 (variant `data-*` nativa, già usata nel resto del progetto), lucide-react per
le icone.

## Global Constraints

- Nessuna modifica al backend (`src/`, `data/*.json`) o alle funzioni `api.*`.
- Nessuna modifica a `ObjectiveSection`/`ProjectBacklog`/`AddObjectiveDialog`/
  `EditObjectiveDialog`/`AddProjectDialog` (restano invariati, solo richiamati da
  un contenitore diverso).
- Nessun framework di test automatico esiste in `frontend/` (nessun file
  `*.test.*`, nessuna dipendenza di test in `frontend/package.json`). La
  verifica di ogni task è: `npm run build` (in `frontend/`, esegue `tsc -b &&
  vite build`) deve passare senza errori, più verifica manuale in `npm run dev`.
- Stile: seguire esattamente il pattern di `frontend/src/components/ui/tabs.tsx`
  (wrapper `cn(...)` su ogni parte del primitivo, `data-slot` sugli elementi).
- Lingua di UI/testi: italiano, come nel resto della pagina.

---

### Task 1: Componente `ui/accordion.tsx`

**Files:**
- Create: `frontend/src/components/ui/accordion.tsx`

**Interfaces:**
- Consumes: `Accordion` da `@base-ui/react/accordion` (import: `import {
  Accordion as AccordionPrimitive } from "@base-ui/react/accordion"`, stesso
  stile di `tabs.tsx` che fa `import { Tabs as TabsPrimitive } from
  "@base-ui/react/tabs"`); `cn` da `@/lib/utils`; icona `ChevronDown` da
  `lucide-react`.
- Produces (usati da Task 2):
  - `Accordion` — wrapper di `AccordionPrimitive.Root`, accetta tutte le prop di
    `AccordionPrimitive.Root.Props` (in particolare `value`, `onValueChange`,
    `multiple`).
  - `AccordionItem` — wrapper di `AccordionPrimitive.Item`, accetta
    `AccordionPrimitive.Item.Props` (in particolare `value`).
  - `AccordionHeader` — wrapper di `AccordionPrimitive.Header`.
  - `AccordionTrigger` — wrapper di `AccordionPrimitive.Trigger`, renderizza
    automaticamente `children` seguiti da un `ChevronDown` che ruota 180° quando
    l'item è aperto (via attributo `data-panel-open` esposto dal trigger stesso).
  - `AccordionPanel` — wrapper di `AccordionPrimitive.Panel`.

- [ ] **Step 1: Scrivere il componente**

```tsx
import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("rounded-lg border", className)}
      {...props}
    />
  )
}

function AccordionHeader({ className, ...props }: AccordionPrimitive.Header.Props) {
  return (
    <AccordionPrimitive.Header
      data-slot="accordion-header"
      className={cn("flex", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={cn(
        "flex flex-1 items-center gap-2 rounded-lg px-4 py-3 text-left text-sm font-medium outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 data-panel-open:rotate-180" />
    </AccordionPrimitive.Trigger>
  )
}

function AccordionPanel({ className, ...props }: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-panel"
      className={cn("flex flex-col gap-4 px-4 pb-4", className)}
      {...props}
    />
  )
}

export {
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionTrigger,
  AccordionPanel,
}
```

- [ ] **Step 2: Verificare la build**

Run: `cd frontend && npm run build`
Expected: nessun errore di TypeScript o build (il componente non è ancora
importato da nessuna pagina, quindi non ci sono effetti visibili — questo step
verifica solo che i tipi di `@base-ui/react/accordion` combacino con l'uso fatto).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/accordion.tsx
git commit -m "feat: aggiungi componente ui/accordion

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: `ProjectsPage` — sostituire Tabs con Accordion (senza drag&drop)

**Files:**
- Modify: `frontend/src/pages/projects-page.tsx:1-15` (import)
- Modify: `frontend/src/pages/projects-page.tsx:598-754` (`ProjectsPage`)

**Interfaces:**
- Consumes: `Accordion`, `AccordionItem`, `AccordionHeader`, `AccordionTrigger`,
  `AccordionPanel` da `@/components/ui/accordion` (Task 1); `Badge`, `Button`,
  `GripVertical`, `Skeleton`, `api`, `toast`, `AddProjectDialog`,
  `AddObjectiveDialog`, `ObjectiveSection` — tutti già presenti/importati nel
  file.
- Produces: nessuna nuova interfaccia esposta ad altri file — `ProjectsPage`
  resta l'unico export usato da `App.tsx`/routing (invariato).

Questo task sostituisce la struttura Tabs con Accordion e introduce lo stato di
apertura controllato, ma **non** ancora il drag&drop dei progetti (task 3) — cioè
temporaneamente si perde il riordino drag&drop dei progetti, che verrà
riaggiunto subito dopo. Questo mantiene ogni task piccolo e verificabile.

- [ ] **Step 1: Aggiornare gli import**

In `frontend/src/pages/projects-page.tsx`, sostituire la riga:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
```

con:

```tsx
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionTrigger } from '@/components/ui/accordion'
```

- [ ] **Step 2: Aggiungere lo stato di apertura controllato**

Nel corpo di `ProjectsPage`, subito dopo la riga `const [openOverrides,
setOpenOverrides] = useState<Record<string, boolean>>({})`, aggiungere:

```tsx
const [openProjectId, setOpenProjectId] = useState<string | undefined>(undefined)
```

Poi, subito dopo `useEffect(load, [])`, aggiungere un secondo `useEffect` che
inizializza l'apertura al primo progetto solo la prima volta che i dati
arrivano:

```tsx
useEffect(() => {
  if (data && openProjectId === undefined) {
    setOpenProjectId(data.projects[0]?.id)
  }
}, [data, openProjectId])
```

- [ ] **Step 3: Sostituire il blocco `Tabs` con `Accordion`**

Sostituire (dentro `return (<Card>...`) il blocco che va da `<Tabs
defaultValue={data.projects[0]?.id}>` a `</Tabs>` con:

```tsx
<Accordion
  value={openProjectId ? [openProjectId] : []}
  onValueChange={(value) => setOpenProjectId(value[0] as string | undefined)}
>
  {data.projects.map((p) => (
    <AccordionItem key={p.id} value={p.id}>
      <AccordionHeader>
        <AccordionTrigger>
          <Badge variant="outline" className="font-mono">
            {p.priority}
          </Badge>
          {p.name}
        </AccordionTrigger>
      </AccordionHeader>
      <AccordionPanel>
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
      </AccordionPanel>
    </AccordionItem>
  ))}
</Accordion>
```

Nota: il `GripVertical` e gli handler `onDragStart`/`onDragEnd`/`onDragOver`/
`onDragLeave`/`onDrop`/`draggable` che erano su `TabsTrigger` **non** vengono
riportati qui — verranno aggiunti nel Task 3 sull'`AccordionHeader`. La variabile
`dragId`/`dragOverId`/`handleDrop` restano dichiarate nel componente ma
temporaneamente inutilizzate: è previsto, verranno usate nel Task 3 (se `npm run
build`/lint segnalano "unused variable" in questo step intermedio, è accettabile
solo come stato di passaggio prima del Task 3 — non fare commit di questo stato
intermedio da solo, va committato insieme al Task 3).

- [ ] **Step 4: Verificare la build dopo aver completato anche il Task 3**

Non eseguire il commit qui: passare direttamente al Task 3, poi verificare ed
eseguire il commit una sola volta per entrambi (vedi Task 3, Step 3-4).

---

### Task 3: Drag&drop riordino progetti sull'header dell'accordion

**Files:**
- Modify: `frontend/src/pages/projects-page.tsx` (blocco `AccordionHeader` /
  `AccordionTrigger` introdotto nel Task 2)

**Interfaces:**
- Consumes: `dragId`, `dragOverId`, `setDragId`, `setDragOverId`, `handleDrop`
  (funzione già definita in `ProjectsPage`, firma `handleDrop(targetId: string):
  Promise<void>`) — tutti già presenti nel componente, invariati.
- Produces: nessuna nuova interfaccia.

Applica al blocco introdotto nel Task 2 lo stesso pattern già usato in
`ObjectiveSection` (`frontend/src/pages/projects-page.tsx:459-470`): un wrapper
esterno gestisce `draggable`/`onDragStart`/`onDragEnd`/`onDragOver`/
`onDragLeave`/`onDrop`, mentre l'elemento cliccabile interno (qui
`AccordionTrigger`) resta libero di gestire solo l'apertura/chiusura via click.

- [ ] **Step 1: Spostare gli handler di drag&drop su `AccordionHeader`**

Sostituire il blocco `<AccordionHeader><AccordionTrigger>...` scritto nel Task 2
con:

```tsx
<AccordionHeader
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
  className={`cursor-grab ${dragId === p.id ? 'opacity-40' : ''} ${
    dragOverId === p.id ? 'border-t-2 border-t-primary' : ''
  }`}
>
  <AccordionTrigger>
    <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
    <Badge variant="outline" className="font-mono">
      {p.priority}
    </Badge>
    {p.name}
  </AccordionTrigger>
</AccordionHeader>
```

(`GripVertical` è già importato in cima al file — nessuna modifica agli import
necessaria per questo step.)

- [ ] **Step 2: Verificare che `AccordionHeader` accetti le prop di drag&drop**

`AccordionHeader` (Task 1) è tipizzato su `AccordionPrimitive.Header.Props`, che
estende `BaseUIComponentProps<'h3', ...>` — quindi accetta tutte le prop native
di un elemento HTML (incluse `draggable`, `onDragStart`, ecc.), esattamente come
`TabsTrigger` le accettava prima. Nessuna modifica a `ui/accordion.tsx` è
necessaria.

- [ ] **Step 3: Verificare la build**

Run: `cd frontend && npm run build`
Expected: nessun errore di TypeScript o build; nessun warning "unused variable"
per `dragId`/`dragOverId`/`handleDrop`.

- [ ] **Step 4: Verifica manuale in dev**

Run: `cd frontend && npm run dev` (o `npm run dev` dalla root del progetto se
avvia sia backend che frontend — verificare con `dev.bat`/`dev.ps1` se serve
anche il backend attivo per caricare i dati)

Aprire `/projects` nel browser e verificare:
- I progetti sono impilati verticalmente, ognuno come sezione di accordion.
- Il primo progetto (priorità più alta) è aperto di default; gli altri sono
  chiusi.
- Cliccare l'header di un altro progetto lo apre e chiude quello precedente.
- Cliccare l'header del progetto già aperto lo chiude (nessun progetto aperto).
- Trascinare l'header di un progetto su un altro ne riordina la priorità
  (verificabile dal numero nel `Badge` dopo il riordino, che si aggiorna via
  `load()`).
- Dentro il pannello aperto: "Aggiungi obiettivo", lista obiettivi con relativo
  apri/chiudi, drag&drop degli step e tutto il resto funzionano esattamente come
  prima del refactor.

- [ ] **Step 5: Commit (Task 2 + Task 3 insieme)**

```bash
git add frontend/src/pages/projects-page.tsx
git commit -m "feat: pagina /projects — progetti come accordion verticale con drag&drop

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Post-plan check

- [ ] Rileggere `frontend/src/pages/projects-page.tsx` per confermare che non
  restino riferimenti a `Tabs`/`TabsList`/`TabsContent`/`TabsTrigger` o import
  da `@/components/ui/tabs` in questo file (il componente `ui/tabs.tsx` stesso
  resta intatto — è solo questo file che non lo usa più).
