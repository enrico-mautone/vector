// Script one-off: importa i dati esistenti in data/*.json nel Postgres
// (Neon) puntato da DATABASE_URL. Usa lo stesso codepath di write* usato a
// runtime (src/db.js), così la forma dei dati è garantita identica.
// Uso: node scripts/migrate-json-to-pg.js

const fs = require('fs');
const path = require('path');
const db = require('../src/db');

const DATA_DIR = path.join(__dirname, '..', 'data');

function readJSON(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf-8'));
}

async function main() {
  console.log('Inizializzo schema...');
  await db.initSchema();

  const config = readJSON('config.json');
  const log = readJSON('log.json');
  const steps = readJSON('steps.json');
  const objectives = readJSON('objectives.json');

  console.log(`Importo ${config.projects.length} progetti, ${config.habits.length} habit, settings...`);
  await db.writeConfig(config);

  console.log(`Importo ${objectives.length} obiettivi...`);
  await db.writeObjectives(objectives);

  console.log(`Importo ${steps.length} step...`);
  await db.writeSteps(steps);

  console.log(`Importo ${log.length} voci di log...`);
  await db.writeLog(log);

  console.log('Migrazione completata.');
  await db.pool.end();
}

main().catch((err) => {
  console.error('Migrazione fallita:', err);
  process.exit(1);
});
