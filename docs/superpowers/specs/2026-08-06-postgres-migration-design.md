# Migrazione dati Vector da JSON a Postgres (Neon) — design

## Obiettivo

Sostituire i quattro file JSON (`data/config.json`, `data/log.json`,
`data/objectives.json`, `data/steps.json`) con un database Postgres ospitato
su Neon, mantenendo intatta tutta la logica di business esistente in
`src/server.js`. Cutover netto: dopo la migrazione l'app legge/scrive solo
Postgres (nessun dual-write, nessun fallback JSON), e i file JSON originali
vengono cancellati una volta verificato che tutto funziona.

## Approccio: mirroring 1:1

Una tabella per ciascun file JSON, forma il più possibile fedele alla
struttura esistente (niente normalizzazione aggiuntiva). Gli handler delle
route continuano a operare sugli stessi oggetti/array JS in memoria che
usano oggi (`config`, `log`, `steps`, `objectives`); cambia solo il modo in
cui questi vengono caricati/salvati:

- oggi: `readJSON(PATH)` / `writeJSON(PATH, data)` (sincroni, su file)
- dopo: `await readConfig()` / `await writeConfig(config)` (asincroni, via
  query Postgres) — stessa firma logica, stesso shape di ritorno.

Ogni `read*()` fa una `SELECT` e ricostruisce l'oggetto/array JS esattamente
come oggi in memoria. Ogni `write*()` sostituisce l'intero contenuto della
tabella (DELETE + INSERT dentro una transazione) — dato il volume di dati di
un'app single-user (poche decine di progetti/obiettivi, ~100 step), questo è
più semplice e sicuro di un rewrite chirurgico a query mirate, e rispetta la
richiesta di minimizzare le modifiche alla logica di business.

## Schema

**`projects`**
```sql
id                 text primary key,
name               text not null,
priority           integer not null,
archived           boolean not null default false,
description        text,
value_economic     integer,
value_opportunity  integer,
value_urgency      integer,
value_effort       integer
```

**`objectives`**
```sql
id            text primary key,
project_id    text not null references projects(id),
goal          text not null,
outcome       text not null,
priority      integer not null,
completed     boolean not null default false,
completed_at  timestamptz,
created_at    timestamptz not null
```

**`steps`**
```sql
id            text primary key,
project_id    text not null references projects(id),
objective_id  text references objectives(id),
text          text not null,
done          boolean not null default false,
completed_at  timestamptz,
created_at    timestamptz not null
```

**`habits`**
```sql
id    text primary key,
name  text not null
```

**`log_entries`** — mirror diretto del blob per-data di `log.json`, non
normalizzato:
```sql
date      date primary key,
projects  jsonb not null default '{}',
habits    jsonb not null default '{}'
```

**`app_config`** — riga singola per le impostazioni top-level di
`config.json`:
```sql
id                            integer primary key default 1,
urgency_threshold_days        integer not null,
enforce_priority_order        boolean not null,
limit_daily_tasks_by_priority boolean not null,
check (id = 1)
```

Nota: `steps.completed_at` e `objectives.completed_at` sono realmente usati
da `src/server.js` (impostati al toggle/finish); alcuni record storici in
`data/steps.json` non hanno mai avuto questo campo popolato — nella
migrazione diventano `NULL`, comportamento equivalente a oggi.

## Meccanica della migrazione

1. Aggiungere dipendenze `pg` e `dotenv` a `package.json` (root).
2. Verificare che `.gitignore` copra `.env` (aggiungere la riga se manca),
   poi creare `.env` con `DATABASE_URL=<connection string Neon>`. Il file
   non viene mai committato.
3. Nuovo modulo `src/db.js`: pool `pg` letto da `DATABASE_URL`, funzioni
   `readConfig/writeConfig`, `readLog/writeLog`, `readSteps/writeSteps`,
   `readObjectives/writeObjectives`, più `initSchema()` che crea le tabelle
   sopra con `CREATE TABLE IF NOT EXISTS`.
4. Script one-off `scripts/migrate-json-to-pg.js`: chiama `initSchema()`,
   poi legge i 4 file JSON esistenti e li inserisce nelle tabelle via le
   funzioni `write*()` di `db.js` (stesso codepath usato a runtime, per
   garantire che la forma sia identica).
5. Riscrittura di `src/server.js`: ogni handler che oggi chiama
   `readJSON(CONFIG_PATH)` ecc. diventa `async` e chiama
   `await readConfig()` ecc.; ogni `writeJSON(...)` diventa
   `await write*(...)`. La logica di business (filtri, sort, calcoli) resta
   invariata riga per riga.
6. Test manuale end-to-end su una porta isolata (non quella dell'istanza
   live) contro il DB Neon reale: home, progetti, step, obiettivi, habit,
   settings — lettura e scrittura.
7. Solo dopo verifica: cancellare `data/config.json`, `data/log.json`,
   `data/objectives.json`, `data/steps.json` e il codice morto
   (`readJSON`/`writeJSON`/costanti `*_PATH`).
8. Commit, push, PR, merge (su conferma esplicita), poi restart del
   processo Node dell'istanza live + reminder che serve sia rebuild
   frontend sia restart backend.

## Sicurezza

La connection string Neon è stata condivisa in chat in chiaro. Verrà scritta
solo in `.env` (mai committata). Consigliata la rotazione della password
Neon dopo il completamento della migrazione.

## Fuori scope

- Nessuna normalizzazione dello schema oltre al mirroring 1:1 (es. niente
  tabella `log_project_steps` per-riga) — esplicitamente richiesto
  dall'utente.
- Nessun dual-write/fallback JSON — cutover netto, come richiesto
  dall'utente.
