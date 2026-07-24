'use strict';

// Shared core for the terminal pet: state persistence, time-based decay,
// and rendering. Used by the status line renderer, the feed hook, and the
// /pet command handler. No external dependencies (Node built-ins only).

const fs = require('fs');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Tuning. All values are in seconds. Fast lifecycle: a short break leaves the
// pet hungry, and a couple hours of total neglect kills it, so you can watch
// it change within a single session. Adjust these to taste.
// ---------------------------------------------------------------------------
const MINUTE = 60;
const HOUR = 60 * MINUTE;

const STAGES = [
  { key: 'thriving', until: 5 * MINUTE },
  { key: 'content', until: 15 * MINUTE },
  { key: 'hungry', until: 30 * MINUTE },
  { key: 'sad', until: 60 * MINUTE },
  { key: 'sick', until: 120 * MINUTE },
];
// Neglect beyond the last stage's `until` (48h) means the pet dies.
const DEATH_AFTER = STAGES[STAGES.length - 1].until;

const SCHEMA_VERSION = 1;
const DEFAULT_SPECIES = '(=^..^=)'; // referenced only in card art; face drives mood

// ANSI helpers -------------------------------------------------------------
const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
};

// Per-stage presentation ----------------------------------------------------
const MOOD = {
  thriving: { face: '(◕ᴗ◕)', word: 'thriving', color: C.green, say: '' },
  content: { face: '(・ᴗ・)', word: 'content', color: C.cyan, say: '' },
  hungry: { face: '(・﹏・)', word: 'hungry', color: C.yellow, say: 'feed me?' },
  sad: { face: '(╥﹏╥)', word: 'lonely', color: C.orange, say: 'come back?' },
  sick: { face: '(×﹏×)', word: 'sick', color: C.red, say: 'i feel awful…' },
  dead: { face: '(✝︿✝)', word: 'gone', color: C.gray, say: 'R.I.P.' },
};

// State I/O ------------------------------------------------------------------
function stateDir() {
  return path.join(os.homedir(), '.claude-pet');
}
function statePath() {
  return path.join(stateDir(), 'state.json');
}

function freshPet(name, now) {
  now = now || Date.now();
  return {
    version: SCHEMA_VERSION,
    name: name || randomName(),
    species: DEFAULT_SPECIES,
    born_at: now,
    last_fed: now,
    dead: false,
    died_at: null,
    generation: 1,
    best_life_ms: 0,
  };
}

function load(now) {
  now = now || Date.now();
  try {
    const raw = fs.readFileSync(statePath(), 'utf8');
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object') return freshPet(null, now);
    // Backfill any missing fields so older save files keep working.
    const base = freshPet(s.name, s.born_at || now);
    return Object.assign(base, s);
  } catch (_) {
    return freshPet(null, now);
  }
}

// Load the pet, creating and persisting a newborn on first ever run so its
// name/birthday stay stable across the very first status-line refreshes
// (which happen before any prompt has fed it).
function ensure(now) {
  now = now || Date.now();
  if (!fs.existsSync(statePath())) {
    const s = freshPet(null, now);
    save(s);
    return s;
  }
  return load(now);
}

function save(state) {
  try {
    fs.mkdirSync(stateDir(), { recursive: true });
    fs.writeFileSync(statePath(), JSON.stringify(state, null, 2));
    return true;
  } catch (_) {
    return false;
  }
}

// Time / decay math ----------------------------------------------------------
function neglectSeconds(state, now) {
  now = now || Date.now();
  return Math.max(0, Math.floor((now - state.last_fed) / 1000));
}

function lifeMs(state, now) {
  now = now || Date.now();
  const end = state.dead && state.died_at ? state.died_at : now;
  return Math.max(0, end - state.born_at);
}

function stageFor(neglectSec) {
  for (const s of STAGES) {
    if (neglectSec < s.until) return s.key;
  }
  return 'dead';
}

function healthPct(neglectSec) {
  const pct = 100 * (1 - neglectSec / DEATH_AFTER);
  return Math.max(0, Math.min(100, Math.round(pct)));
}

// Mutations ------------------------------------------------------------------
// Returns true if the pet transitioned to dead during this check.
function checkDeath(state, now) {
  now = now || Date.now();
  if (state.dead) return false;
  if (neglectSeconds(state, now) >= DEATH_AFTER) {
    state.dead = true;
    state.died_at = now;
    const life = now - state.born_at;
    if (life > (state.best_life_ms || 0)) state.best_life_ms = life;
    return true;
  }
  return false;
}

// Record interaction. If the pet was neglected past the death threshold while
// you were away, it dies now instead of being resurrected by your return.
function feed(state, now) {
  now = now || Date.now();
  if (state.dead) return { fed: false, died: false };
  const died = checkDeath(state, now);
  if (died) return { fed: false, died: true };
  state.last_fed = now;
  return { fed: true, died: false };
}

function revive(state, now) {
  now = now || Date.now();
  const gen = (state.generation || 1) + 1;
  const name = state.name;
  const best = Math.max(state.best_life_ms || 0, state.dead ? lifeMs(state, now) : 0);
  const next = freshPet(name, now);
  next.generation = gen;
  next.best_life_ms = best;
  return next;
}

// Rendering ------------------------------------------------------------------
function heartsBar(pct) {
  const filled = Math.round(pct / 20); // 0..5
  const full = Math.max(0, Math.min(5, filled));
  return '♥'.repeat(full) + '♡'.repeat(5 - full);
}

function humanizeAgo(sec) {
  if (sec < 45) return 'just now';
  if (sec < 90) return '1m ago';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(sec / 3600);
  const rem = Math.round((sec % 3600) / 60);
  if (h < 24) return rem ? `${h}h ${rem}m ago` : `${h}h ago`;
  const d = Math.floor(sec / 86400);
  const hh = Math.round((sec % 86400) / 3600);
  return hh ? `${d}d ${hh}h ago` : `${d}d ago`;
}

function humanizeSpan(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

// A tiny bit of life: blink and sparkle based on wall-clock time so that
// consecutive status-line refreshes animate subtly during active use.
function animateFace(stageKey, face, now) {
  now = now || Date.now();
  if (stageKey === 'dead') return face;
  const t = Math.floor(now / 1000);
  const blink = t % 7 === 0; // ~1s blink every 7s
  if (blink && (stageKey === 'thriving' || stageKey === 'content')) {
    return face.replace(/[◕・]/g, '─');
  }
  return face;
}

function sparkle(now) {
  now = now || Date.now();
  return Math.floor(now / 1500) % 2 === 0 ? '✧' : '✦';
}

// Status-line rendering: compact, two lines, colored.
function renderStatusLine(state, now, opts) {
  now = now || Date.now();
  opts = opts || {};
  const useColor = opts.color !== false;
  const paint = (s, c) => (useColor ? `${c}${s}${C.reset}` : s);

  const neglect = neglectSeconds(state, now);
  const stageKey = state.dead ? 'dead' : stageFor(neglect);
  const mood = MOOD[stageKey];
  const pct = state.dead ? 0 : healthPct(neglect);

  if (stageKey === 'dead') {
    const lived = humanizeSpan(lifeMs(state, now));
    const line1 = paint(`🪦 ${state.name} ${mood.face} ${mood.word}`, C.gray);
    const line2 = paint(`lived ${lived} · /pet revive to adopt again`, C.gray);
    return `${line1}\n${line2}`;
  }

  const face = animateFace(stageKey, mood.face, now);
  const spark = stageKey === 'thriving' ? ` ${sparkle(now)}` : '';
  const say = mood.say ? paint(` ${mood.say}`, C.dim) : '';

  const line1 = `🐾 ${paint(state.name, C.bold)} ${paint(face, mood.color)}${spark} ${paint(mood.word, mood.color)}${say}`;
  const bar = paint(heartsBar(pct), mood.color);
  const line2 = `${bar} ${paint(`${pct}%`, C.dim)} ${paint('·', C.dim)} ${paint(`fed ${humanizeAgo(neglect)}`, C.dim)}`;
  return `${line1}\n${line2}`;
}

// Verbose "card" for the /pet command output (plain-ish, no ANSI reliance).
function renderCard(state, now, header) {
  now = now || Date.now();
  const neglect = neglectSeconds(state, now);
  const stageKey = state.dead ? 'dead' : stageFor(neglect);
  const mood = MOOD[stageKey];
  const pct = state.dead ? 0 : healthPct(neglect);
  const lines = [];
  if (header) lines.push(header);
  lines.push('┌───────────────────────────────┐');
  lines.push(`│   ${mood.face}   ${state.name}`);
  if (state.dead) {
    lines.push(`│   status: gone · lived ${humanizeSpan(lifeMs(state, now))}`);
    lines.push('│   run  /pet revive  to adopt a new one');
  } else {
    lines.push(`│   mood: ${mood.word}${mood.say ? '  “' + mood.say + '”' : ''}`);
    lines.push(`│   health: ${heartsBar(pct)} ${pct}%`);
    lines.push(`│   fed: ${humanizeAgo(neglect)}`);
    lines.push(`│   age: ${humanizeSpan(lifeMs(state, now))}`);
  }
  lines.push(`│   generation #${state.generation || 1}`);
  if (state.best_life_ms) lines.push(`│   longest life: ${humanizeSpan(state.best_life_ms)}`);
  lines.push('└───────────────────────────────┘');
  return lines.join('\n');
}

// Whimsical default names ----------------------------------------------------
const NAMES = [
  'Pixel', 'Bit', 'Nibble', 'Sudo', 'Kernel', 'Byte', 'Tofu', 'Mochi',
  'Blinky', 'Ghost', 'Segfault', 'Noodle', 'Cache', 'Waffle', 'Boops',
];
function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

module.exports = {
  STAGES,
  DEATH_AFTER,
  MOOD,
  stateDir,
  statePath,
  freshPet,
  load,
  ensure,
  save,
  neglectSeconds,
  lifeMs,
  stageFor,
  healthPct,
  checkDeath,
  feed,
  revive,
  renderStatusLine,
  renderCard,
  humanizeAgo,
  humanizeSpan,
  randomName,
};
