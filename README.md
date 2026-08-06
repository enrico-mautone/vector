# Vector

Focus & habit command center — MVP personale (vedi il build log completo in
`../vector.md` nel repo `my-little-brain`).

## Avvio

```bash
npm install
npm start
```

Apre su `http://localhost:3000`.

Su Windows, se `node`/`npm` non sono riconosciuti subito dopo l'installazione
in una sessione di terminale già aperta, apri un nuovo terminale (il PATH si
aggiorna solo per le sessioni nuove).

Serve un file `.env` con `DATABASE_URL=<connection string Postgres>` (vedi
sezione Dati sotto) — non committato, va creato a mano.

## Dati

I dati (progetti, habit, log giornaliero, obiettivi, step) vivono su Postgres
(Neon), non più in file JSON — vedi
`docs/superpowers/specs/2026-08-06-postgres-migration-design.md` per lo
schema completo e i dettagli della migrazione. `src/db.js` è l'unico punto
di accesso al database; `scripts/migrate-json-to-pg.js` è lo script one-off
usato per l'import iniziale dai vecchi `data/*.json` (ormai rimossi).
