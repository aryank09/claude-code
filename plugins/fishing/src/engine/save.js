'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const SAVE_DIR = path.join(os.homedir(), '.claude-fishing');
const SAVE_PATH = path.join(SAVE_DIR, 'save.json');

function defaultSave() {
  const now = new Date().toISOString();
  return {
    version: 1,
    gold: 20,
    rod: 'bamboo',
    bait: 'worm',
    location: 'dock',
    totalCast: 0,
    totalCaught: 0,
    totalEscaped: 0,
    collection: {},
    createdAt: now,
    lastPlayedAt: now,
  };
}

function load() {
  try {
    const raw = fs.readFileSync(SAVE_PATH, 'utf8');
    const data = JSON.parse(raw);
    // Merge with defaults so older saves gain new fields safely.
    return Object.assign(defaultSave(), data);
  } catch (err) {
    const fresh = defaultSave();
    save(fresh);
    return fresh;
  }
}

function save(data) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });
  data.lastPlayedAt = new Date().toISOString();
  fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function recordCast(data) {
  data.totalCast += 1;
}

function recordEscape(data) {
  data.totalEscaped += 1;
}

function recordCatch(data, fish, weight, value) {
  data.totalCaught += 1;
  data.gold += value;

  const entry = data.collection[fish.id] || {
    caughtCount: 0,
    bestWeight: 0,
    firstCaughtAt: null,
  };

  const isNewSpecies = entry.caughtCount === 0;
  const isPersonalBest = weight > entry.bestWeight;

  entry.caughtCount += 1;
  entry.bestWeight = Math.max(entry.bestWeight, weight);
  entry.firstCaughtAt = entry.firstCaughtAt || new Date().toISOString();

  data.collection[fish.id] = entry;

  return { isNewSpecies, isPersonalBest };
}

module.exports = {
  SAVE_DIR,
  SAVE_PATH,
  defaultSave,
  load,
  save,
  recordCast,
  recordEscape,
  recordCatch,
};
