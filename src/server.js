const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'log.json');
const STEPS_PATH = path.join(__dirname, '..', 'data', 'steps.json');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

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

app.get('/', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const today = todayStr();
  const todayEntry = getEntry(log, today) || { projects: {}, habits: {} };

  const projectsStatus = config.projects
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((p) => {
      const doneToday = stepsLoggedToday(todayEntry, p.id).length > 0;
      const last = lastDoneDate(log, p.id, today);
      const daysSince = last ? daysBetween(last, today) : null;
      const urgent = !doneToday && (daysSince === null || daysSince >= config.urgencyThresholdDays);
      return { ...p, doneToday, daysSince, urgent };
    });

  // 1-3 azioni per oggi: non ancora fatte, urgenti prima, poi per priorità.
  const actionsToday = projectsStatus
    .filter((p) => !p.doneToday)
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      return a.priority - b.priority;
    })
    .slice(0, 3);

  const habitsStatus = config.habits.map((h) => ({
    ...h,
    doneToday: !!(todayEntry.habits && todayEntry.habits[h.id]),
    streak: habitStreak(log, h.id, today),
  }));

  res.render('home', { actionsToday, habitsStatus, today });
});

app.get('/log', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const steps = readJSON(STEPS_PATH);
  const today = todayStr();
  const todayEntry = getEntry(log, today) || { projects: {}, habits: {} };

  const projects = config.projects.map((p) => {
    const loggedToday = stepsLoggedToday(todayEntry, p.id);
    const loggedById = new Map(loggedToday.map((s) => [s.stepId, s.minutes]));
    // Step selezionabili oggi: quelli ancora aperti, più quelli già
    // registrati oggi (anche se nel frattempo segnati "fatti").
    const displaySteps = steps
      .filter((s) => s.projectId === p.id && (!s.done || loggedById.has(s.id)))
      .map((s) => ({
        id: s.id,
        text: s.text,
        checkedToday: loggedById.has(s.id),
        minutesToday: loggedById.has(s.id) ? loggedById.get(s.id) : '',
      }));
    return { ...p, displaySteps };
  });

  res.render('log', { projects, config, todayEntry, today });
});

app.post('/log', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const steps = readJSON(STEPS_PATH);
  const today = todayStr();

  const projects = {};
  config.projects.forEach((p) => {
    const projectSteps = steps.filter((s) => s.projectId === p.id);
    const loggedSteps = [];
    projectSteps.forEach((s) => {
      if (req.body[`step_${s.id}_done`] === 'on') {
        const minutes = parseInt(req.body[`step_${s.id}_minutes`], 10);
        loggedSteps.push({ stepId: s.id, minutes: Number.isFinite(minutes) ? minutes : 0 });
        s.done = true;
      }
    });
    projects[p.id] = { steps: loggedSteps };
  });
  writeJSON(STEPS_PATH, steps);

  const habits = {};
  config.habits.forEach((h) => {
    habits[h.id] = req.body[`habit_${h.id}`] === 'on';
  });

  const entry = { date: today, projects, habits };
  const existingIndex = log.findIndex((e) => e.date === today);
  if (existingIndex >= 0) {
    log[existingIndex] = entry;
  } else {
    log.push(entry);
  }
  writeJSON(LOG_PATH, log);
  res.redirect('/');
});

app.get('/steps', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  const steps = readJSON(STEPS_PATH);
  const sortedProjects = config.projects.slice().sort((a, b) => a.priority - b.priority);
  const selectedProjectId = req.query.project || sortedProjects[0].id;
  const projectSteps = steps
    .filter((s) => s.projectId === selectedProjectId)
    .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

  res.render('steps', { projects: sortedProjects, selectedProjectId, projectSteps });
});

app.post('/steps/add', (req, res) => {
  const { projectId, text } = req.body;
  if (text && text.trim()) {
    const steps = readJSON(STEPS_PATH);
    steps.push({ id: generateId(), projectId, text: text.trim(), done: false, createdAt: new Date().toISOString() });
    writeJSON(STEPS_PATH, steps);
  }
  res.redirect(`/steps?project=${encodeURIComponent(projectId)}`);
});

app.post('/steps/bulk', (req, res) => {
  const { projectId, bulkText } = req.body;
  const newTexts = parseBulkSteps(bulkText || '');
  if (newTexts.length > 0) {
    const steps = readJSON(STEPS_PATH);
    const createdAt = new Date().toISOString();
    newTexts.forEach((text) => {
      steps.push({ id: generateId(), projectId, text, done: false, createdAt });
    });
    writeJSON(STEPS_PATH, steps);
  }
  res.redirect(`/steps?project=${encodeURIComponent(projectId)}`);
});

app.post('/steps/:id/toggle', (req, res) => {
  const steps = readJSON(STEPS_PATH);
  const step = steps.find((s) => s.id === req.params.id);
  const projectId = step ? step.projectId : req.body.projectId;
  if (step) {
    step.done = !step.done;
    writeJSON(STEPS_PATH, steps);
  }
  res.redirect(`/steps?project=${encodeURIComponent(projectId)}`);
});

app.post('/steps/:id/delete', (req, res) => {
  const steps = readJSON(STEPS_PATH);
  const step = steps.find((s) => s.id === req.params.id);
  const projectId = step ? step.projectId : req.body.projectId;
  const remaining = steps.filter((s) => s.id !== req.params.id);
  writeJSON(STEPS_PATH, remaining);
  res.redirect(`/steps?project=${encodeURIComponent(projectId)}`);
});

app.listen(PORT, () => {
  console.log(`Vector in ascolto su http://localhost:${PORT}`);
});
