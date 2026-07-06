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

## Dati

- `data/config.json` — elenco progetti (con priorità) e habit. Si modifica a
  mano quando cambiano i progetti attivi.
- `data/log.json` — una voce per giorno, scritta dal form `/log`. Non
  modificarlo a mano se non per correggere un errore.
