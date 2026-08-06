// Script one-off: crea/aggiorna un utente per il login di Vector, con
// password hashata (bcrypt) salvata su Postgres (Neon). Non stampa mai la
// password in chiaro nei log.
// Uso: node scripts/create-user.js <email> <password>

const crypto = require('crypto');
const db = require('../src/db');
const auth = require('../src/auth');

async function main() {
  const [, , email, password] = process.argv;
  if (!email || !password) {
    console.error('Uso: node scripts/create-user.js <email> <password>');
    process.exit(1);
  }

  await db.initSchema();

  const passwordHash = await auth.hashPassword(password);
  await db.createUser({ id: crypto.randomUUID(), email, passwordHash });

  console.log(`Utente creato/aggiornato: ${email}`);
  await db.pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
