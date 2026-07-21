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

// TRACK_HEIGHT is deliberately NOT resized with the terminal: barHeight is
// tuned as a formula relative to this exact constant (see createState), so
// changing it per-terminal would silently shift catch difficulty depending
// on how tall the user's window happens to be. Only the horizontal WIDTH
// (purely cosmetic here - it doesn't touch physics) responds to terminal
// size, via the `width` param threaded through the render functions below.
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
// luck-based instead of skill-based. `barBonus` comes from equipped rod
// tier (see data/gear.json) and raises the floor for players who upgrade.
function createState(fish, barBonus = 0) {
  const barHeight = clamp(Math.max(3, 6 - fish.difficulty) + barBonus, 3, TRACK_HEIGHT);
  return {
    fish,
    barHeight,
    fishPos: TRACK_HEIGHT / 2,
    fishVel: 0,
    barPos: (TRACK_HEIGHT - barHeight) / 2,
    barVel: 0,
    progress: 42,
    result: null,
    elapsedTicks: 0,
  };
}

function update(mg, spacePressed) {
  const accelRange = 0.14 + mg.fish.difficulty * 0.045;
  const maxFishSpeed = 0.37 + mg.fish.difficulty * 0.09;

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

  const fillRate = 3.8 - mg.fish.difficulty * 0.2;
  const drainRate = 1.45 + mg.fish.difficulty * 0.22;
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

function buildTrackRow(row, mg, width) {
  const barTop = Math.round(mg.barPos);
  const barBottom = barTop + mg.barHeight - 1;
  const isBar = row >= barTop && row <= barBottom;
  const fishColor = rarityColor(mg.fish.rarity);
  const bgColor = isBar ? palette.good : palette.muted;
  const bgChar = isBar ? '=' : '.';
  const chars = new Array(width).fill(bgChar);

  if (Math.round(mg.fishPos) === row) {
    const art = mg.fish.art.slice(0, width);
    const start = Math.max(0, Math.floor((width - art.length) / 2));
    const end = Math.min(width, start + art.length);
    const prefix = chars.slice(0, start).join('');
    const suffix = chars.slice(end).join('');
    return bgColor(prefix) + fishColor(art) + bgColor(suffix);
  }

  return bgColor(chars.join(''));
}

function progressBar(progress, width) {
  const filled = Math.round((progress / 100) * width);
  const color = progress < 33 ? palette.bad : progress < 66 ? palette.gold : palette.good;
  return color('█'.repeat(filled)) + dim('░'.repeat(Math.max(0, width - filled)));
}

function render(mg, tick, width) {
  const lines = [];

  lines.push(boxTop(width, 'REEL IT IN'));
  lines.push(
    boxLine(padCenter(bold('Something is on the line!'), width), width)
  );
  lines.push(boxDivider(width));

  for (let row = 0; row < TRACK_HEIGHT; row++) {
    lines.push(boxLine(buildTrackRow(row, mg, width), width));
  }

  lines.push(boxDivider(width));
  lines.push(boxLine(progressBar(mg.progress, width), width));
  lines.push(
    boxLine(padCenter(`${Math.round(mg.progress)}%`, width), width)
  );
  lines.push(boxLine('', width));

  const blink = tick % 2 === 0;
  const tiring = mg.elapsedTicks >= TIMEOUT_TICKS * 0.75;
  const hint = tiring
    ? "your arms are tiring out - reel it in soon!"
    : 'mash / hold SPACE to reel up  ·  Q quit';
  const styledHint = tiring ? palette.bad(bold(hint)) : blink ? bold(hint) : dim(hint);
  lines.push(boxLine(padCenter(styledHint, width), width));
  lines.push(boxBottom(width));

  return lines;
}

module.exports = { createState, update, render, TRACK_HEIGHT };
