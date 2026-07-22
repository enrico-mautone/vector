const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'log.json');
const STEPS_PATH = path.join(__dirname, '..', 'data', 'steps.json');
const OBJECTIVES_PATH = path.join(__dirname, '..', 'data', 'objectives.json');
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');

app.use(express.json());

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(earlier, later) {
  const d1 = new Date(earlier);
  const d2 = new Date(later);
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

function getEntry(log, date) {
  return log.find((e) => e.date === date);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

function levelFromFraction(done, total) {
  if (done === 0) return 0;
  const frac = done / total;
  if (frac >= 1) return 4;
  if (frac >= 0.66) return 3;
  if (frac >= 0.33) return 2;
  return 1;
}

function buildHabitDoneMap(config, log) {
  const map = {};
  config.habits.forEach((h) => { map[h.id] = new Set(); });
  log.forEach((entry) => {
    config.habits.forEach((h) => {
      if (entry.habits && entry.habits[h.id]) {
        map[h.id].add(entry.date);
      }
    });
  });
  return map;
}

// Vista annuale: una colonna per mese, intensità = frazione di giorni fatti nel mese.
function buildYearView(habits, habitDoneMap, year) {
  const columns = MONTH_NAMES.map((name) => ({ label: name }));
  const rows = habits.map((h) => {
    const doneDates = habitDoneMap[h.id];
    const cells = MONTH_NAMES.map((_, monthIdx) => {
      const total = daysInMonth(year, monthIdx);
      let done = 0;
      for (let day = 1; day <= total; day++) {
        if (doneDates.has(`${year}-${pad2(monthIdx + 1)}-${pad2(day)}`)) done++;
      }
      return { level: levelFromFraction(done, total), title: `${done}/${total} giorni` };
    });
    return { habit: h, cells };
  });
  return { columns, rows };
}

// Vista mensile: una colonna per settimana del mese, intensità = frazione di
// giorni (della settimana ricadenti nel mese) fatti.
function buildMonthView(habits, habitDoneMap, year, month) {
  const monthIndex = month - 1;
  const lastDay = new Date(year, monthIndex, daysInMonth(year, monthIndex));
  const weeks = [];
  let cursor = startOfWeek(new Date(year, monthIndex, 1));
  while (cursor <= lastDay) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weeks.push({ start: weekStart, end: weekEnd });
    cursor.setDate(cursor.getDate() + 7);
  }
  const columns = weeks.map((w) => {
    const s = w.start.getMonth() === monthIndex ? w.start : new Date(year, monthIndex, 1);
    const e = w.end.getMonth() === monthIndex ? w.end : lastDay;
    return { label: `${s.getDate()}-${e.getDate()}` };
  });
  const rows = habits.map((h) => {
    const doneDates = habitDoneMap[h.id];
    const cells = weeks.map((w) => {
      let done = 0;
      let total = 0;
      const day = new Date(w.start);
      while (day <= w.end) {
        if (day.getMonth() === monthIndex) {
          total++;
          if (doneDates.has(ymd(day))) done++;
        }
        day.setDate(day.getDate() + 1);
      }
      return { level: levelFromFraction(done, total || 1), title: `${done}/${total} giorni` };
    });
    return { habit: h, cells };
  });
  return { columns, rows };
}

// Vista settimanale: una colonna per giorno (Lun-Dom), fatto/non fatto.
function buildWeekView(habits, habitDoneMap, weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  const columns = days.map((d, i) => ({ label: `${DAY_NAMES[i]} ${d.getDate()}/${d.getMonth() + 1}` }));
  const rows = habits.map((h) => {
    const doneDates = habitDoneMap[h.id];
    const cells = days.map((d) => {
      const done = doneDates.has(ymd(d));
      return { level: done ? 4 : 0, title: ymd(d) };
    });
    return { habit: h, cells };
  });
  return { columns, rows };
}

// Spezza un testo incollato in step separati: ogni riga E ogni segmento
// separato da ';' diventa un nuovo step, righe/segmenti vuoti scartati.
function parseBulkSteps(text) {
  return text
    .split(/[\n;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function stepsLoggedToday(todayEntry, projectId) {
  return (todayEntry.projects[projectId] && todayEntry.projects[projectId].steps) || [];
}

// Progetti "attivi" (non archiviati, con almeno uno step nel backlog),
// ordinati per priorità crescente (1 = più importante). È la base sia del
// gate "Lo devi fare!!!!" sia del gate "Non esagerare!!": quando un
// progetto viene archiviato sparisce da questa lista e tutti quelli dopo
// di lui risalgono di posizione automaticamente.
function activeProjectsByPriority(config, steps) {
  return config.projects
    .filter((p) => !p.archived && steps.some((s) => s.projectId === p.id))
    .sort((a, b) => a.priority - b.priority);
}

// Obiettivi non completati di un progetto, ordinati per priorità crescente
// (1 = prossimo da lavorare). Il primo elemento è l'obiettivo "attivo":
// solo i suoi task sono lavorabili — gate strutturale, sempre attivo,
// indipendente dal toggle "Lo devi fare!!!!" (quello vale solo tra progetti).
function activeObjectivesByPriority(objectives, projectId) {
  return objectives
    .filter((o) => o.projectId === projectId && !o.completed)
    .sort((a, b) => a.priority - b.priority);
}

// Con "Lo devi fare!!!!" attivo: non si può registrare uno step su un
// progetto se un progetto a priorità maggiore (numero più basso) non ha
// ancora nessuno step registrato oggi. Guarda solo i progetti con priorità
// maggiore del progetto su cui si sta registrando lo step (non l'intera
// lista): un "buco" di priorità più in basso nella lista non deve bloccare
// il progetto che si sta effettivamente provando a completare.
function checkPriorityGate(config, loggedStepsByProject, steps, projectId) {
  const sorted = activeProjectsByPriority(config, steps);
  const targetIndex = sorted.findIndex((p) => p.id === projectId);
  if (targetIndex <= 0) return null;
  for (let i = 0; i < targetIndex; i++) {
    const p = sorted[i];
    const hasSteps = (loggedStepsByProject[p.id] || []).length > 0;
    if (!hasSteps) {
      return { blockedProject: sorted[targetIndex], blockingProject: p };
    }
  }
  return null;
}

// Con "Non esagerare!!" attivo: limite giornaliero di step completabili per
// progetto, inversamente proporzionale alla posizione di priorità tra i
// progetti attivi (1ª posizione: 5 step/giorno, 2ª: 4, ... 5ª: 1). Dalla 6ª
// posizione in poi il limite è 0 — resta bloccato finché uno dei primi 5
// non viene archiviato (a quel punto la sua posizione risale e ottiene un
// limite). Ipotesi di Enrico: i progetti a priorità più bassa sono i più
// "divertenti", quindi senza un tetto rischiano di assorbire tutto il tempo
// una volta sbloccati.
function dailyTaskLimitForRank(rank) {
  const limit = 6 - rank;
  return limit > 0 ? limit : 0;
}

// Ritorna { rank, limit } se il progetto ha già raggiunto il limite
// giornaliero di step, altrimenti null.
function checkDailyTaskLimitGate(config, steps, todayEntry, projectId) {
  const ranked = activeProjectsByPriority(config, steps);
  const rank = ranked.findIndex((p) => p.id === projectId) + 1;
  if (rank === 0) return null;
  const limit = dailyTaskLimitForRank(rank);
  const doneToday = stepsLoggedToday(todayEntry, projectId).length;
  if (doneToday >= limit) {
    return { rank, limit };
  }
  return null;
}

// Giorni trascorsi dall'ultima volta che almeno uno step di un progetto è
// stato registrato nel log, scandendo a ritroso da `today` (esclusa).
// null = mai registrato nessuno step.
function lastDoneDate(log, projectId, today) {
  const sorted = log
    .filter((e) => e.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const entry of sorted) {
    const steps = entry.projects && entry.projects[projectId] && entry.projects[projectId].steps;
    if (steps && steps.length > 0) {
      return entry.date;
    }
  }
  return null;
}

// Giorni consecutivi (a ritroso da `today`) con quella habit segnata done.
function habitStreak(log, habitId, today) {
  let streak = 0;
  const cursor = new Date(today);
  for (;;) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const entry = getEntry(log, dateStr);
    if (entry && entry.habits && entry.habits[habitId]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

async function fetchRandomQuote() {
  try {
    const response = await fetch('https://motivational-spark-api.vercel.app/api/quotes/random');
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !data.quote) return null;
    return { text: data.quote, author: data.author || null };
  } catch (err) {
    return null;
  }
}

function buildHomeData(quote) {
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const steps = readJSON(STEPS_PATH);
  const objectives = readJSON(OBJECTIVES_PATH);
  const today = todayStr();
  const todayEntry = getEntry(log, today) || { projects: {}, habits: {} };

  // Un progetto resta visibile in Home finché non viene confermato come
  // terminato (config.projects[].archived) — non sparisce solo perché ha
  // già ricevuto uno step oggi o perché non è tra i primi per priorità.
  // I progetti senza nessuno step (mai avuto un backlog) sono invece esclusi
  // del tutto: non hanno nulla da fare, quindi non contano né per l'elenco
  // né per il gate "Lo devi fare!!!!". L'ordine è fisso per priorità (mai
  // per stato del giorno), così spuntare un'attività non fa "saltare" i
  // progetti in lista.
  let priorAllDone = true;
  const ranked = activeProjectsByPriority(config, steps);
  const actionsToday = ranked
    .map((p, i) => {
      const rank = i + 1;
      const completedTodayCount = stepsLoggedToday(todayEntry, p.id).length;
      const doneToday = completedTodayCount > 0;
      const last = lastDoneDate(log, p.id, today);
      const daysSince = last ? daysBetween(last, today) : null;
      const urgent = !doneToday && (daysSince === null || daysSince >= config.urgencyThresholdDays);
      const hasBacklog = steps.some((s) => s.projectId === p.id);
      const projectObjectives = objectives.filter((o) => o.projectId === p.id);
      const activeObjs = activeObjectivesByPriority(objectives, p.id);
      const activeObjective = activeObjs[0];
      const objectiveSteps = activeObjective ? steps.filter((s) => s.objectiveId === activeObjective.id) : [];
      const nextStep = activeObjective ? objectiveSteps.find((s) => !s.done) : null;
      const objectiveComplete = !!(activeObjective && objectiveSteps.length > 0 && !nextStep);
      const allObjectivesDone = projectObjectives.length > 0 && activeObjs.length === 0;
      const activeObjectiveEmpty = !!(activeObjective && objectiveSteps.length === 0);
      const workable = priorAllDone;
      priorAllDone = priorAllDone && (doneToday || !hasBacklog);
      return {
        ...p,
        doneToday,
        daysSince,
        urgent,
        workable,
        hasBacklog,
        nextStepId: nextStep ? nextStep.id : null,
        nextStepText: nextStep ? nextStep.text : null,
        activeObjectiveId: activeObjective ? activeObjective.id : null,
        activeObjectiveGoal: activeObjective ? activeObjective.goal : null,
        activeObjectiveOutcome: activeObjective ? activeObjective.outcome : null,
        objectiveComplete,
        allObjectivesDone,
        activeObjectiveEmpty,
        priorityRank: rank,
        dailyTaskLimit: dailyTaskLimitForRank(rank),
        completedTodayCount,
      };
    })
    .sort((a, b) => {
      if (a.hasBacklog !== b.hasBacklog) return a.hasBacklog ? -1 : 1;
      return a.priority - b.priority;
    });

  const habitsStatus = config.habits.map((h) => ({
    ...h,
    doneToday: !!(todayEntry.habits && todayEntry.habits[h.id]),
    streak: habitStreak(log, h.id, today),
  }));

  return { actionsToday, habitsStatus, today, quote, config };
}

app.get('/api/home', async (req, res) => {
  const quote = await fetchRandomQuote();
  res.json(buildHomeData(quote));
});

// Segna eseguito, direttamente da home, il prossimo step aperto di un
// progetto: stesso effetto di spuntarlo in /log (marca `done` in
// steps.json + lo registra nel log di oggi), ma un solo step alla volta.
// Rispetta il gate di priorità se "Lo devi fare!!!!" è attivo, e il tetto
// giornaliero per progetto se "Non esagerare!!" è attivo.
app.post('/api/home/complete-step', (req, res) => {
  const { projectId, stepId } = req.body;
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const steps = readJSON(STEPS_PATH);
  const today = todayStr();

  const step = steps.find((s) => s.id === stepId && s.projectId === projectId && !s.done);
  if (!step) {
    return res.status(404).json({ ok: false, error: 'Step non trovato o già completato.' });
  }

  const todayEntry = getEntry(log, today) || { projects: {}, habits: {} };
  const loggedStepsByProject = {};
  config.projects.forEach((p) => {
    loggedStepsByProject[p.id] = stepsLoggedToday(todayEntry, p.id).map((s) => ({ stepId: s.stepId }));
  });
  loggedStepsByProject[projectId] = loggedStepsByProject[projectId].concat([{ stepId }]);

  const objectives = readJSON(OBJECTIVES_PATH);
  const activeObjective = activeObjectivesByPriority(objectives, projectId)[0];
  if (!activeObjective || step.objectiveId !== activeObjective.id) {
    return res.status(400).json({ ok: false, error: 'Questo task appartiene a un obiettivo non ancora attivo.' });
  }

  if (config.enforcePriorityOrder) {
    const violation = checkPriorityGate(config, loggedStepsByProject, steps, projectId);
    if (violation) {
      const error = `"Lo devi fare!!!!" è attivo: registra prima almeno uno step su "${violation.blockingProject.name}" (priorità più alta) prima di registrarne su "${violation.blockedProject.name}".`;
      return res.status(400).json({ ok: false, error });
    }
  }

  if (config.limitDailyTasksByPriority) {
    const violation = checkDailyTaskLimitGate(config, steps, todayEntry, projectId);
    if (violation) {
      const error =
        violation.limit === 0
          ? `"Non esagerare!!" è attivo: questo progetto è oltre i primi 5 per priorità, resta bloccato finché non termini uno dei primi 5.`
          : `"Non esagerare!!" è attivo: hai già completato ${violation.limit} step oggi su questo progetto (${violation.rank}ª posizione per priorità), il limite giornaliero.`;
      return res.status(400).json({ ok: false, error });
    }
  }

  step.done = true;
  writeJSON(STEPS_PATH, steps);

  const projectEntry = todayEntry.projects[projectId] || { steps: [] };
  projectEntry.steps = projectEntry.steps.concat([{ stepId, minutes: 0 }]);
  todayEntry.projects[projectId] = projectEntry;
  todayEntry.date = today;
  const existingIndex = log.findIndex((e) => e.date === today);
  if (existingIndex >= 0) {
    log[existingIndex] = todayEntry;
  } else {
    log.push(todayEntry);
  }
  writeJSON(LOG_PATH, log);

  const nextStep = steps.find((s) => s.projectId === projectId && !s.done);
  res.json({
    ok: true,
    nextStepId: nextStep ? nextStep.id : null,
    nextStepText: nextStep ? nextStep.text : null,
  });
});

// Conferma esplicita ("il progetto è terminato?") che rimuove un progetto
// dalla Home: si arriva qui solo quando non ha più step aperti, e solo per
// azione diretta dell'utente — mai in automatico.
app.post('/api/home/finish-project', (req, res) => {
  const { projectId } = req.body;
  const config = readJSON(CONFIG_PATH);
  const steps = readJSON(STEPS_PATH);

  const project = config.projects.find((p) => p.id === projectId);
  if (!project) {
    return res.status(404).json({ ok: false, error: 'Progetto non trovato.' });
  }
  const hasOpenStep = steps.some((s) => s.projectId === projectId && !s.done);
  if (hasOpenStep) {
    return res.status(400).json({ ok: false, error: 'Il progetto ha ancora step aperti.' });
  }

  project.archived = true;
  writeJSON(CONFIG_PATH, config);
  res.json({ ok: true });
});

// Segna/de-segna una habit direttamente da home.
app.post('/api/home/toggle-habit', (req, res) => {
  const { habitId } = req.body;
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const today = todayStr();

  if (!config.habits.some((h) => h.id === habitId)) {
    return res.status(404).json({ ok: false, error: 'Habit non trovata.' });
  }

  const todayEntry = getEntry(log, today) || { date: today, projects: {}, habits: {} };
  const done = !(todayEntry.habits && todayEntry.habits[habitId]);
  todayEntry.habits = { ...todayEntry.habits, [habitId]: done };
  todayEntry.date = today;
  const existingIndex = log.findIndex((e) => e.date === today);
  if (existingIndex >= 0) {
    log[existingIndex] = todayEntry;
  } else {
    log.push(todayEntry);
  }
  writeJSON(LOG_PATH, log);

  res.json({ ok: true, done, streak: habitStreak(log, habitId, today) });
});

app.post('/api/steps/add', (req, res) => {
  const { projectId, objectiveId, text } = req.body;
  if (!objectiveId) {
    return res.status(400).json({ ok: false, error: 'Obiettivo mancante.' });
  }
  const steps = readJSON(STEPS_PATH);
  if (text && text.trim()) {
    steps.push({ id: generateId(), projectId, objectiveId, text: text.trim(), done: false, createdAt: new Date().toISOString() });
    writeJSON(STEPS_PATH, steps);
  }
  res.json({ ok: true, steps: steps.filter((s) => s.objectiveId === objectiveId) });
});

app.post('/api/steps/bulk', (req, res) => {
  const { projectId, objectiveId, bulkText } = req.body;
  if (!objectiveId) {
    return res.status(400).json({ ok: false, error: 'Obiettivo mancante.' });
  }
  const steps = readJSON(STEPS_PATH);
  const newTexts = parseBulkSteps(bulkText || '');
  if (newTexts.length > 0) {
    const createdAt = new Date().toISOString();
    newTexts.forEach((text) => {
      steps.push({ id: generateId(), projectId, objectiveId, text, done: false, createdAt });
    });
    writeJSON(STEPS_PATH, steps);
  }
  res.json({ ok: true, steps: steps.filter((s) => s.objectiveId === objectiveId) });
});

// Riordina gli step di un progetto secondo l'ordine (array di id) ricevuto
// dal drag & drop lato client. Gli step degli altri progetti non sono
// toccati; quelli del progetto vengono riscritti nel nuovo ordine.
app.post('/api/steps/reorder', (req, res) => {
  const { projectId, order } = req.body;
  if (!projectId || !Array.isArray(order)) {
    return res.status(400).json({ ok: false });
  }
  const steps = readJSON(STEPS_PATH);
  const projectSteps = steps.filter((s) => s.projectId === projectId);
  const byId = new Map(projectSteps.map((s) => [s.id, s]));
  const reordered = order.map((id) => byId.get(id)).filter(Boolean);
  projectSteps.forEach((s) => {
    if (!order.includes(s.id)) reordered.push(s);
  });
  const otherSteps = steps.filter((s) => s.projectId !== projectId);
  writeJSON(STEPS_PATH, otherSteps.concat(reordered));
  res.json({ ok: true });
});

app.post('/api/steps/:id/edit', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ ok: false });
  }
  const steps = readJSON(STEPS_PATH);
  const step = steps.find((s) => s.id === req.params.id);
  if (step) {
    step.text = text.trim();
    writeJSON(STEPS_PATH, steps);
  }
  res.json({ ok: true, step });
});

app.post('/api/steps/:id/toggle', (req, res) => {
  const steps = readJSON(STEPS_PATH);
  const step = steps.find((s) => s.id === req.params.id);
  if (step) {
    step.done = !step.done;
    writeJSON(STEPS_PATH, steps);
  }
  res.json({ ok: true, step });
});

app.post('/api/steps/:id/delete', (req, res) => {
  const steps = readJSON(STEPS_PATH);
  const remaining = steps.filter((s) => s.id !== req.params.id);
  writeJSON(STEPS_PATH, remaining);
  res.json({ ok: true });
});

// Sposta uno step su un altro obiettivo (stesso progetto) via drag & drop.
app.post('/api/steps/:id/move', (req, res) => {
  const { objectiveId } = req.body;
  if (!objectiveId) {
    return res.status(400).json({ ok: false, error: 'Obiettivo mancante.' });
  }
  const steps = readJSON(STEPS_PATH);
  const step = steps.find((s) => s.id === req.params.id);
  if (!step) {
    return res.status(404).json({ ok: false, error: 'Step non trovato.' });
  }
  const objectives = readJSON(OBJECTIVES_PATH);
  const targetObjective = objectives.find((o) => o.id === objectiveId);
  if (!targetObjective || targetObjective.projectId !== step.projectId) {
    return res.status(400).json({ ok: false, error: 'Obiettivo non valido per questo progetto.' });
  }
  step.objectiveId = objectiveId;
  writeJSON(STEPS_PATH, steps);
  res.json({ ok: true, step });
});

app.get('/api/habits', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const habitDoneMap = buildHabitDoneMap(config, log);
  const view = req.query.view === 'month' || req.query.view === 'week' ? req.query.view : 'year';

  let extra;
  if (view === 'year') {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    extra = { ...buildYearView(config.habits, habitDoneMap, year), year, prevYear: year - 1, nextYear: year + 1 };
  } else if (view === 'month') {
    let year, month;
    if (req.query.month && /^\d{4}-\d{2}$/.test(req.query.month)) {
      [year, month] = req.query.month.split('-').map(Number);
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
    }
    const prev = new Date(year, month - 2, 1);
    const next = new Date(year, month, 1);
    extra = {
      ...buildMonthView(config.habits, habitDoneMap, year, month),
      year,
      month,
      prevMonth: `${prev.getFullYear()}-${pad2(prev.getMonth() + 1)}`,
      nextMonth: `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`,
    };
  } else {
    const refDate = req.query.week && /^\d{4}-\d{2}-\d{2}$/.test(req.query.week) ? new Date(req.query.week) : new Date();
    const weekStart = startOfWeek(refDate);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    extra = {
      ...buildWeekView(config.habits, habitDoneMap, weekStart),
      prevWeek: ymd(prevWeekStart),
      nextWeek: ymd(nextWeekStart),
    };
  }

  res.json({ view, ...extra });
});

app.get('/api/projects', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  const steps = readJSON(STEPS_PATH);
  const objectives = readJSON(OBJECTIVES_PATH);
  const projects = config.projects
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((p) => {
      const active = activeObjectivesByPriority(objectives, p.id)[0] || null;
      const projectObjectives = objectives
        .filter((o) => o.projectId === p.id)
        .sort((a, b) => a.priority - b.priority)
        .map((o) => ({
          ...o,
          active: !o.completed && active !== null && o.id === active.id,
          steps: steps
            .filter((s) => s.objectiveId === o.id)
            .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)),
        }));
      return { ...p, objectives: projectObjectives };
    });
  res.json({ projects });
});

app.post('/api/projects/add', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ ok: false, error: 'Nome progetto mancante.' });
  }
  const config = readJSON(CONFIG_PATH);
  const maxPriority = config.projects.reduce((max, p) => Math.max(max, p.priority), 0);
  const project = { id: generateId(), name: name.trim(), priority: maxPriority + 1 };
  config.projects.push(project);
  writeJSON(CONFIG_PATH, config);
  res.json({ ok: true, project });
});

app.post('/api/projects/reorder', (req, res) => {
  const { order } = req.body;
  if (!Array.isArray(order)) {
    return res.status(400).json({ ok: false, error: 'Ordine non valido.' });
  }
  const config = readJSON(CONFIG_PATH);
  const byId = new Map(config.projects.map((p) => [p.id, p]));
  order.forEach((id, index) => {
    const project = byId.get(id);
    if (project) project.priority = index + 1;
  });
  writeJSON(CONFIG_PATH, config);
  res.json({ ok: true, config });
});

app.get('/api/objectives', (req, res) => {
  const { projectId } = req.query;
  const objectives = readJSON(OBJECTIVES_PATH);
  const steps = readJSON(STEPS_PATH);
  const active = activeObjectivesByPriority(objectives, projectId)[0] || null;
  const list = objectives
    .filter((o) => o.projectId === projectId)
    .sort((a, b) => a.priority - b.priority)
    .map((o) => ({
      ...o,
      active: !o.completed && active !== null && o.id === active.id,
      steps: steps
        .filter((s) => s.objectiveId === o.id)
        .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1)),
    }));
  res.json({ objectives: list });
});

app.post('/api/objectives/add', (req, res) => {
  const { projectId, goal, outcome } = req.body;
  if (!projectId || !goal || !goal.trim()) {
    return res.status(400).json({ ok: false, error: 'Obiettivo mancante.' });
  }
  const objectives = readJSON(OBJECTIVES_PATH);
  const maxPriority = objectives
    .filter((o) => o.projectId === projectId)
    .reduce((max, o) => Math.max(max, o.priority), 0);
  const objective = {
    id: generateId(),
    projectId,
    goal: goal.trim(),
    outcome: (outcome || '').trim(),
    priority: maxPriority + 1,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  objectives.push(objective);
  writeJSON(OBJECTIVES_PATH, objectives);
  res.json({ ok: true, objective });
});

app.post('/api/objectives/reorder', (req, res) => {
  const { projectId, order } = req.body;
  if (!projectId || !Array.isArray(order)) {
    return res.status(400).json({ ok: false, error: 'Ordine non valido.' });
  }
  const objectives = readJSON(OBJECTIVES_PATH);
  const byId = new Map(objectives.filter((o) => o.projectId === projectId).map((o) => [o.id, o]));
  order.forEach((id, index) => {
    const objective = byId.get(id);
    if (objective) objective.priority = index + 1;
  });
  writeJSON(OBJECTIVES_PATH, objectives);
  res.json({ ok: true });
});

app.post('/api/objectives/:id/edit', (req, res) => {
  const { goal, outcome } = req.body;
  if (!goal || !goal.trim()) {
    return res.status(400).json({ ok: false, error: 'Obiettivo mancante.' });
  }
  const objectives = readJSON(OBJECTIVES_PATH);
  const objective = objectives.find((o) => o.id === req.params.id);
  if (!objective) {
    return res.status(404).json({ ok: false, error: 'Obiettivo non trovato.' });
  }
  objective.goal = goal.trim();
  objective.outcome = (outcome || '').trim();
  writeJSON(OBJECTIVES_PATH, objectives);
  res.json({ ok: true, objective });
});

// Conferma esplicita di completamento — stesso pattern di finish-project:
// mai automatico, e solo se non ci sono più task aperti sotto l'obiettivo.
app.post('/api/objectives/:id/finish', (req, res) => {
  const objectives = readJSON(OBJECTIVES_PATH);
  const steps = readJSON(STEPS_PATH);
  const objective = objectives.find((o) => o.id === req.params.id);
  if (!objective) {
    return res.status(404).json({ ok: false, error: 'Obiettivo non trovato.' });
  }
  const hasOpenStep = steps.some((s) => s.objectiveId === objective.id && !s.done);
  if (hasOpenStep) {
    return res.status(400).json({ ok: false, error: "L'obiettivo ha ancora task aperti." });
  }
  objective.completed = true;
  objective.completedAt = new Date().toISOString();
  writeJSON(OBJECTIVES_PATH, objectives);
  res.json({ ok: true });
});

app.post('/api/objectives/:id/delete', (req, res) => {
  const objectives = readJSON(OBJECTIVES_PATH);
  const steps = readJSON(STEPS_PATH);
  const objective = objectives.find((o) => o.id === req.params.id);
  if (!objective) {
    return res.status(404).json({ ok: false, error: 'Obiettivo non trovato.' });
  }
  const hasSteps = steps.some((s) => s.objectiveId === objective.id);
  if (hasSteps) {
    return res.status(400).json({ ok: false, error: 'Sposta o cancella prima i task di questo obiettivo.' });
  }
  const remaining = objectives.filter((o) => o.id !== req.params.id);
  writeJSON(OBJECTIVES_PATH, remaining);
  res.json({ ok: true });
});

app.get('/api/settings', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  res.json({ config });
});

app.post('/api/settings', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  if ('enforcePriorityOrder' in req.body) {
    config.enforcePriorityOrder = req.body.enforcePriorityOrder === true;
  }
  if ('limitDailyTasksByPriority' in req.body) {
    config.limitDailyTasksByPriority = req.body.limitDailyTasksByPriority === true;
  }
  writeJSON(CONFIG_PATH, config);
  res.json({ ok: true, config });
});

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Vector in ascolto su http://localhost:${PORT}`);
});
