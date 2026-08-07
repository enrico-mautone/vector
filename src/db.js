// Storage layer su Postgres (Neon), mirror 1:1 dei vecchi file JSON.
// Ogni read* ricostruisce l'oggetto/array JS esattamente come lo produceva
// readJSON(); ogni write* sostituisce l'intero contenuto della tabella
// (DELETE + INSERT in transazione) — dato il volume di dati di un'app
// single-user, è più semplice e sicuro di query mirate riga per riga.

require('dotenv').config();
const { Pool, types } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL non impostata (vedi .env)');
}

// OID 1082 = tipo `date`: di default node-postgres lo converte in un Date
// JS a mezzanotte locale, e un successivo toISOString() lo fa slittare di
// un giorno con timezone diverse da UTC. Lo teniamo come stringa 'YYYY-MM-DD'
// invariata, esattamente come nel log.json originale.
types.setTypeParser(1082, (val) => val);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

// Costruisce la clausola "($1,$2,...),($n+1,...)" e l'array piatto di valori
// per un INSERT multi-riga, evitando un round-trip di rete per riga (vedi
// writeSteps/writeObjectives/writeLog: prima di questo helper ogni write
// riscriveva l'intera tabella con una query awaited per riga, diventando
// visibilmente lento su Vercel/serverless già con poche centinaia di righe).
function buildValuesClause(rows) {
  const values = [];
  const placeholders = rows
    .map((row) => {
      const start = values.length;
      values.push(...row);
      return `(${row.map((_, i) => `$${start + i + 1}`).join(',')})`;
    })
    .join(',');
  return { placeholders, values };
}

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id text PRIMARY KEY,
      name text NOT NULL,
      priority integer NOT NULL,
      archived boolean NOT NULL DEFAULT false,
      description text,
      value_economic integer,
      value_opportunity integer,
      value_urgency integer,
      value_effort integer
    );
    CREATE TABLE IF NOT EXISTS objectives (
      id text PRIMARY KEY,
      project_id text NOT NULL REFERENCES projects(id),
      goal text NOT NULL,
      outcome text NOT NULL,
      priority integer NOT NULL,
      completed boolean NOT NULL DEFAULT false,
      completed_at timestamptz,
      created_at timestamptz NOT NULL
    );
    CREATE TABLE IF NOT EXISTS steps (
      id text PRIMARY KEY,
      project_id text NOT NULL REFERENCES projects(id),
      objective_id text REFERENCES objectives(id),
      text text NOT NULL,
      done boolean NOT NULL DEFAULT false,
      completed_at timestamptz,
      created_at timestamptz NOT NULL,
      position integer
    );
    CREATE TABLE IF NOT EXISTS habits (
      id text PRIMARY KEY,
      name text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS log_entries (
      date date PRIMARY KEY,
      projects jsonb NOT NULL DEFAULT '{}',
      habits jsonb NOT NULL DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS app_config (
      id integer PRIMARY KEY DEFAULT 1,
      urgency_threshold_days integer NOT NULL,
      enforce_priority_order boolean NOT NULL,
      limit_daily_tasks_by_priority boolean NOT NULL,
      CHECK (id = 1)
    );
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  // steps.position: colonna aggiunta dopo la creazione iniziale della tabella,
  // "CREATE TABLE IF NOT EXISTS" sopra non la aggiunge su un DB già esistente.
  // Senza una colonna d'ordine esplicita, l'ordine restituito da "SELECT * FROM
  // steps" dipende dall'ordine fisico delle righe: un upsert (ON CONFLICT DO
  // UPDATE, il caso normale di un riordino) aggiorna i valori in-place senza
  // spostare la riga, quindi il drag&drop non veniva mai persistito davvero.
  await pool.query(`ALTER TABLE steps ADD COLUMN IF NOT EXISTS position integer;`);
  // Backfill una tantum per le righe esistenti senza position: usa l'ordine di
  // creazione come punto di partenza (nessuna informazione di ordine migliore
  // disponibile per righe scritte prima di questa colonna).
  await pool.query(`
    UPDATE steps SET position = sub.rn
    FROM (SELECT id, row_number() OVER (ORDER BY created_at) AS rn FROM steps) sub
    WHERE steps.id = sub.id AND steps.position IS NULL;
  `);
}

// ---- users (auth) ----

async function findUserByEmail(email) {
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
  const r = res.rows[0];
  if (!r) return null;
  return { id: r.id, email: r.email, passwordHash: r.password_hash };
}

async function createUser({ id, email, passwordHash }) {
  await pool.query(
    `INSERT INTO users (id, email, password_hash) VALUES ($1,$2,$3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [id, email.toLowerCase(), passwordHash]
  );
}

// ---- config (projects + habits + settings) ----

async function readConfig() {
  const [settingsRes, projectsRes, habitsRes] = await Promise.all([
    pool.query('SELECT * FROM app_config WHERE id = 1'),
    pool.query('SELECT * FROM projects ORDER BY priority ASC'),
    pool.query('SELECT * FROM habits'),
  ]);
  const settings = settingsRes.rows[0] || {
    urgency_threshold_days: 2,
    enforce_priority_order: true,
    limit_daily_tasks_by_priority: true,
  };
  return {
    urgencyThresholdDays: settings.urgency_threshold_days,
    enforcePriorityOrder: settings.enforce_priority_order,
    limitDailyTasksByPriority: settings.limit_daily_tasks_by_priority,
    projects: projectsRes.rows.map(projectRowToJs),
    habits: habitsRes.rows.map((r) => ({ id: r.id, name: r.name })),
  };
}

async function writeConfig(config) {
  await withClient(async (client) => {
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO app_config (id, urgency_threshold_days, enforce_priority_order, limit_daily_tasks_by_priority)
         VALUES (1, $1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           urgency_threshold_days = EXCLUDED.urgency_threshold_days,
           enforce_priority_order = EXCLUDED.enforce_priority_order,
           limit_daily_tasks_by_priority = EXCLUDED.limit_daily_tasks_by_priority`,
        [config.urgencyThresholdDays, config.enforcePriorityOrder, config.limitDailyTasksByPriority]
      );
      // steps/objectives referenziano projects: rimuoverli prima evita violazioni di FK
      // quando un progetto viene eliminato; li ricreiamo subito dopo con gli stessi id.
      const projectIds = config.projects.map((p) => p.id);
      await client.query('DELETE FROM steps WHERE project_id != ALL($1::text[])', [projectIds]);
      await client.query('DELETE FROM objectives WHERE project_id != ALL($1::text[])', [projectIds]);
      await client.query('DELETE FROM projects WHERE id != ALL($1::text[])', [projectIds]);
      for (const p of config.projects) {
        await client.query(
          `INSERT INTO projects (id, name, priority, archived, description, value_economic, value_opportunity, value_urgency, value_effort)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             priority = EXCLUDED.priority,
             archived = EXCLUDED.archived,
             description = EXCLUDED.description,
             value_economic = EXCLUDED.value_economic,
             value_opportunity = EXCLUDED.value_opportunity,
             value_urgency = EXCLUDED.value_urgency,
             value_effort = EXCLUDED.value_effort`,
          [
            p.id, p.name, p.priority, !!p.archived, p.description ?? null,
            p.valueEconomic ?? null, p.valueOpportunity ?? null, p.valueUrgency ?? null, p.valueEffort ?? null,
          ]
        );
      }
      const habitIds = config.habits.map((h) => h.id);
      await client.query('DELETE FROM habits WHERE id != ALL($1::text[])', [habitIds]);
      for (const h of config.habits) {
        await client.query(
          `INSERT INTO habits (id, name) VALUES ($1,$2)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
          [h.id, h.name]
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

function projectRowToJs(r) {
  const p = { id: r.id, name: r.name, priority: r.priority };
  if (r.archived) p.archived = true;
  if (r.description !== null) p.description = r.description;
  if (r.value_economic !== null) p.valueEconomic = r.value_economic;
  if (r.value_opportunity !== null) p.valueOpportunity = r.value_opportunity;
  if (r.value_urgency !== null) p.valueUrgency = r.value_urgency;
  if (r.value_effort !== null) p.valueEffort = r.value_effort;
  return p;
}

// ---- log ----

async function readLog() {
  const res = await pool.query('SELECT * FROM log_entries ORDER BY date ASC');
  return res.rows.map((r) => ({
    date: r.date,
    projects: r.projects || {},
    habits: r.habits || {},
  }));
}

async function writeLog(log) {
  await withClient(async (client) => {
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM log_entries');
      if (log.length > 0) {
        const { placeholders, values } = buildValuesClause(
          log.map((entry) => [entry.date, JSON.stringify(entry.projects || {}), JSON.stringify(entry.habits || {})])
        );
        await client.query(`INSERT INTO log_entries (date, projects, habits) VALUES ${placeholders}`, values);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

// ---- steps ----

function stepRowToJs(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    objectiveId: r.objective_id,
    text: r.text,
    done: r.done,
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

async function readSteps() {
  // position determina l'ordine "vero" (vedi commento su ALTER TABLE in
  // initSchema); NULLS LAST + created_at come fallback per righe non ancora
  // backfillate.
  const res = await pool.query('SELECT * FROM steps ORDER BY position ASC NULLS LAST, created_at ASC');
  return res.rows.map(stepRowToJs);
}

async function writeSteps(steps) {
  await withClient(async (client) => {
    try {
      await client.query('BEGIN');
      // Upsert + cancella solo gli id non più presenti: uno steps.objective_id
      // cancellato-e-reinserito in blocco violerebbe momentaneamente la FK
      // steps->objectives se un'altra route tocca solo una delle due tabelle.
      const ids = steps.map((s) => s.id);
      await client.query('DELETE FROM steps WHERE id != ALL($1::text[])', [ids]);
      if (steps.length > 0) {
        // position = indice nell'array ricevuto: chi chiama writeSteps passa
        // sempre l'ordine desiderato (letto da readSteps e poi riscritto, o
        // ricalcolato esplicitamente da /api/steps/reorder), quindi persistere
        // l'indice come colonna esplicita è sufficiente e si autocorregge ad
        // ogni scrittura successiva.
        const { placeholders, values } = buildValuesClause(
          steps.map((s, i) => [s.id, s.projectId, s.objectiveId ?? null, s.text, !!s.done, s.completedAt ?? null, s.createdAt, i])
        );
        await client.query(
          `INSERT INTO steps (id, project_id, objective_id, text, done, completed_at, created_at, position)
           VALUES ${placeholders}
           ON CONFLICT (id) DO UPDATE SET
             project_id = EXCLUDED.project_id,
             objective_id = EXCLUDED.objective_id,
             text = EXCLUDED.text,
             done = EXCLUDED.done,
             completed_at = EXCLUDED.completed_at,
             created_at = EXCLUDED.created_at,
             position = EXCLUDED.position`,
          values
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

// ---- objectives ----

function objectiveRowToJs(r) {
  return {
    id: r.id,
    projectId: r.project_id,
    goal: r.goal,
    outcome: r.outcome,
    priority: r.priority,
    completed: r.completed,
    completedAt: r.completed_at ? r.completed_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  };
}

async function readObjectives() {
  const res = await pool.query('SELECT * FROM objectives');
  return res.rows.map(objectiveRowToJs);
}

async function writeObjectives(objectives) {
  await withClient(async (client) => {
    try {
      await client.query('BEGIN');
      // Stesso motivo di writeSteps: upsert + cancella solo gli id rimossi,
      // mai un DELETE totale (violerebbe la FK steps->objectives).
      const ids = objectives.map((o) => o.id);
      await client.query('DELETE FROM objectives WHERE id != ALL($1::text[])', [ids]);
      if (objectives.length > 0) {
        const { placeholders, values } = buildValuesClause(
          objectives.map((o) => [o.id, o.projectId, o.goal, o.outcome, o.priority, !!o.completed, o.completedAt ?? null, o.createdAt])
        );
        await client.query(
          `INSERT INTO objectives (id, project_id, goal, outcome, priority, completed, completed_at, created_at)
           VALUES ${placeholders}
           ON CONFLICT (id) DO UPDATE SET
             project_id = EXCLUDED.project_id,
             goal = EXCLUDED.goal,
             outcome = EXCLUDED.outcome,
             priority = EXCLUDED.priority,
             completed = EXCLUDED.completed,
             completed_at = EXCLUDED.completed_at,
             created_at = EXCLUDED.created_at`,
          values
        );
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

module.exports = {
  pool,
  initSchema,
  readConfig,
  writeConfig,
  readLog,
  writeLog,
  readSteps,
  writeSteps,
  readObjectives,
  writeObjectives,
  findUserByEmail,
  createUser,
};
