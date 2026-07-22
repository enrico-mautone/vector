const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const STEPS_PATH = path.join(DATA_DIR, 'steps.json');
const OBJECTIVES_PATH = path.join(DATA_DIR, 'objectives.json');

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function migrate() {
  const steps = readJSON(STEPS_PATH);
  const objectives = readJSON(OBJECTIVES_PATH);

  const orphanProjectIds = [...new Set(steps.filter((s) => !s.objectiveId).map((s) => s.projectId))];

  orphanProjectIds.forEach((projectId) => {
    const objective = {
      id: generateId(),
      projectId,
      goal: 'Backlog pre-OKR',
      outcome: "Completare gli step già pianificati prima dell'introduzione degli obiettivi",
      priority: 1,
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    objectives.push(objective);
    steps.forEach((s) => {
      if (s.projectId === projectId && !s.objectiveId) {
        s.objectiveId = objective.id;
      }
    });
  });

  writeJSON(STEPS_PATH, steps);
  writeJSON(OBJECTIVES_PATH, objectives);

  console.log(`Migrati ${orphanProjectIds.length} progetti, creati ${orphanProjectIds.length} obiettivi "Backlog pre-OKR".`);
}

migrate();
