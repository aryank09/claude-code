'use strict';

const {
  palette,
  bold,
  dim,
  padCenter,
  boxTop,
  boxBottom,
  boxDivider,
  boxLine,
} = require('../engine/renderer');

const WIDTH = 40;
const TRACK_HEIGHT = 14;

const GRAVITY = 0.9;
const LIFT_IMPULSE = 2.6;
const MAX_BAR_VEL = 3.2;
const BAR_MOVE_SCALE = 0.35;

// Progress is a random walk that can hover near equilibrium for a long
// time under mediocre play. Without a bound, an indecisive game could drag
// on far longer than is fun, so a tired-out angler loses the fish as a
// safety valve, same as real fishing games use a rod "stamina" timer.
const TIMEOUT_TICKS = 240;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Terminals only give us keydown-style events with OS auto-repeat, never a
// clean keyup - so instead of trying to detect "held", every SPACE event
// (tap or auto-repeat) just adds an upward impulse while gravity constantly
// pulls down. Holding the key naturally produces a stream of impulses.
//
// Catch-zone height is deliberately small relative to TRACK_HEIGHT: if a
// stationary zone parked against a wall covered too much of the track,
// "spam space" or "do nothing" would passively win by camping in place
// instead of actively tracking the fish, which would make the mechanic
// luck-based instead of skill-based.
function createState(fish) {
  const barHeight = Math.max(2, 5 - fish.difficulty);
  return {
    fish,
    barHeight,
    fishPos: TRACK_HEIGHT / 2,
    fishVel: 0,
    barPos: (TRACK_HEIGHT - barHeight) / 2,
    barVel: 0,
    progress: 40,
    result: null,
    elapsedTicks: 0,
  };
}

function update(mg, spacePressed) {
  const accelRange = 0.15 + mg.fish.difficulty * 0.05;
  const maxFishSpeed = 0.4 + mg.fish.difficulty * 0.1;

  mg.fishVel += (Math.random() * 2 - 1) * accelRange;
  mg.fishVel = clamp(mg.fishVel, -maxFishSpeed, maxFishSpeed);
  mg.fishPos += mg.fishVel;
  if (mg.fishPos < 0) {
    mg.fishPos = 0;
    mg.fishVel *= -0.6;
  }
  if (mg.fishPos > TRACK_HEIGHT - 1) {
    mg.fishPos = TRACK_HEIGHT - 1;
    mg.fishVel *= -0.6;
  }

  mg.barVel += GRAVITY;
  if (spacePressed) mg.barVel -= LIFT_IMPULSE;
  mg.barVel = clamp(mg.barVel, -MAX_BAR_VEL, MAX_BAR_VEL);
  mg.barPos += mg.barVel * BAR_MOVE_SCALE;

  const maxBarPos = TRACK_HEIGHT - mg.barHeight;
  if (mg.barPos < 0) {
    mg.barPos = 0;
    mg.barVel = 0;
  }
  if (mg.barPos > maxBarPos) {
    mg.barPos = maxBarPos;
    mg.barVel = 0;
  }

  const overlap =
    mg.fishPos >= mg.barPos - 0.001 &&
    mg.fishPos <= mg.barPos + mg.barHeight - 1 + 0.001;

  const fillRate = 3.6 - mg.fish.difficulty * 0.2;
  const drainRate = 1.6 + mg.fish.difficulty * 0.25;
  mg.progress += overlap ? fillRate : -drainRate;
  mg.progress = clamp(mg.progress, 0, 100);

  mg.elapsedTicks += 1;

  if (mg.progress >= 100) mg.result = 'win';
  else if (mg.progress <= 0) mg.result = 'lose';
  else if (mg.elapsedTicks >= TIMEOUT_TICKS) mg.result = 'lose';

  return mg.result;
}

function rarityColor(rarity) {
  if (rarity === 'legendary') return palette.legendary;
  if (rarity === 'rare') return palette.rare;
  return palette.fish;
}

function buildTrackRow(row, mg) {
  const barTop = Math.round(mg.barPos);
  const barBottom = barTop + mg.barHeight - 1;
  const isBar = row >= barTop && row <= barBottom;
  const fishColor = rarityColor(mg.fish.rarity);
  const bgColor = isBar ? palette.good : palette.muted;
  const bgChar = isBar ? '=' : '.';
  const chars = new Array(WIDTH).fill(bgChar);

  if (Math.round(mg.fishPos) === row) {
    const art = mg.fish.art.slice(0, WIDTH);
    const start = Math.max(0, Math.floor((WIDTH - art.length) / 2));
    const end = Math.min(WIDTH, start + art.length);
    const prefix = chars.slice(0, start).join('');
    const suffix = chars.slice(end).join('');
    return bgColor(prefix) + fishColor(art) + bgColor(suffix);
  }

  return bgColor(chars.join(''));
}

function progressBar(progress) {
  const filled = Math.round((progress / 100) * WIDTH);
  const color = progress < 33 ? palette.bad : progress < 66 ? palette.gold : palette.good;
  return color('█'.repeat(filled)) + dim('░'.repeat(Math.max(0, WIDTH - filled)));
}

function render(mg, tick) {
  const lines = [];

  lines.push(boxTop(WIDTH, 'REEL IT IN'));
  lines.push(
    boxLine(padCenter(bold('Something is on the line!'), WIDTH), WIDTH)
  );
  lines.push(boxDivider(WIDTH));

  for (let row = 0; row < TRACK_HEIGHT; row++) {
    lines.push(boxLine(buildTrackRow(row, mg), WIDTH));
  }

  lines.push(boxDivider(WIDTH));
  lines.push(boxLine(progressBar(mg.progress), WIDTH));
  lines.push(
    boxLine(padCenter(`${Math.round(mg.progress)}%`, WIDTH), WIDTH)
  );
  lines.push(boxLine('', WIDTH));

  const blink = tick % 2 === 0;
  const tiring = mg.elapsedTicks >= TIMEOUT_TICKS * 0.75;
  const hint = tiring
    ? "your arms are tiring out - reel it in soon!"
    : 'mash / hold SPACE to reel up  ·  Q quit';
  const styledHint = tiring ? palette.bad(bold(hint)) : blink ? bold(hint) : dim(hint);
  lines.push(boxLine(padCenter(styledHint, WIDTH), WIDTH));
  lines.push(boxBottom(WIDTH));

  return lines;
}

module.exports = { createState, update, render, WIDTH, TRACK_HEIGHT };
