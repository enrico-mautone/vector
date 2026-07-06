const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const LOG_PATH = path.join(__dirname, '..', 'data', 'log.json');

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

// Giorni trascorsi dall'ultimo step registrato come "done" su un progetto,
// scandendo il log a ritroso da `today` (esclusa). null = mai fatto.
function lastDoneDate(log, projectId, today) {
  const sorted = log
    .filter((e) => e.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const entry of sorted) {
    if (entry.projects && entry.projects[projectId] && entry.projects[projectId].done) {
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
      const doneToday = !!(todayEntry.projects[p.id] && todayEntry.projects[p.id].done);
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
  const today = todayStr();
  const todayEntry = getEntry(log, today) || { projects: {}, habits: {} };
  res.render('log', { config, todayEntry, today });
});

app.post('/log', (req, res) => {
  const config = readJSON(CONFIG_PATH);
  const log = readJSON(LOG_PATH);
  const today = todayStr();

  const projects = {};
  config.projects.forEach((p) => {
    projects[p.id] = {
      done: req.body[`project_${p.id}_done`] === 'on',
      note: req.body[`project_${p.id}_note`] || '',
    };
  });

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

app.listen(PORT, () => {
  console.log(`Vector in ascolto su http://localhost:${PORT}`);
});
