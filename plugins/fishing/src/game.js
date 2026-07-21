#!/usr/bin/env node
'use strict';

const readline = require('readline');

const renderer = require('./engine/renderer');
const SaveEngine = require('./engine/save');
const rng = require('./engine/rng');

const titleScreen = require('./screens/title');
const fishingScreen = require('./screens/fishing');
const minigame = require('./screens/minigame');
const revealScreen = require('./screens/reveal');

const FISH_LIST = require('./data/fish.json');
const LOCATION_NAME = 'Dock at Lake Mistveil';

const TICK_MS = 80;

let saveData = null;
let loopHandle = null;
let tick = 0;
let cleaned = false;

const state = {
  screen: 'title',
  fishing: { sub: 'idle', biteTimer: 0, biteFlashTimer: 0 },
  minigame: null,
  reveal: null,
};

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function buildFishingDisplay() {
  return {
    sub: state.fishing.sub,
    locationName: LOCATION_NAME,
    rod: capitalize(saveData.rod),
    bait: capitalize(saveData.bait),
    gold: saveData.gold,
  };
}

function restoreTerminal() {
  if (cleaned) return;
  cleaned = true;
  try {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  } catch (err) {
    /* best effort */
  }
  renderer.showCursor();
  renderer.exitAltScreen();
  try {
    process.stdin.pause();
  } catch (err) {
    /* best effort */
  }
}

function quit() {
  if (loopHandle) clearInterval(loopHandle);
  restoreTerminal();
  if (saveData) {
    console.log('');
    console.log(`🎣 Tight lines! Total caught: ${saveData.totalCaught}   Gold: ${saveData.gold}`);
    console.log(`Save file: ${SaveEngine.SAVE_PATH}`);
  }
  console.log('');
  process.exit(0);
}

process.on('exit', restoreTerminal);
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
process.on('uncaughtException', (err) => {
  restoreTerminal();
  console.error('Fishing game crashed:', err && err.stack ? err.stack : err);
  process.exit(1);
});

function handleKeypress(str, key) {
  if (key && key.ctrl && key.name === 'c') return quit();
  if (str && str.toLowerCase() === 'q') return quit();

  const isSpace = str === ' ' || (key && key.name === 'space');

  if (state.screen === 'title') {
    state.screen = 'fishing';
    state.fishing = { sub: 'idle', biteTimer: 0, biteFlashTimer: 0 };
    return;
  }

  if (state.screen === 'fishing' && isSpace && state.fishing.sub === 'idle') {
    state.fishing.sub = 'waiting';
    state.fishing.biteTimer = rng.biteDelayMs();
    SaveEngine.recordCast(saveData);
    SaveEngine.save(saveData);
    return;
  }

  if (state.screen === 'minigame' && isSpace) {
    state.minigame.spaceQueued = true;
    return;
  }

  if (state.screen === 'reveal') {
    state.screen = 'fishing';
    state.fishing = { sub: 'idle', biteTimer: 0, biteFlashTimer: 0 };
    return;
  }
}

function tickFishing() {
  if (state.fishing.sub === 'waiting') {
    state.fishing.biteTimer -= TICK_MS;
    if (state.fishing.biteTimer <= 0) {
      state.fishing.sub = 'bite';
      state.fishing.biteFlashTimer = 600;
    }
  } else if (state.fishing.sub === 'bite') {
    state.fishing.biteFlashTimer -= TICK_MS;
    if (state.fishing.biteFlashTimer <= 0) {
      const fish = rng.pickFish(FISH_LIST);
      state.minigame = minigame.createState(fish);
      state.screen = 'minigame';
      return;
    }
  }

  renderer.frame(fishingScreen.render(buildFishingDisplay(), tick));
}

function tickMinigame() {
  const spacePressed = Boolean(state.minigame.spaceQueued);
  state.minigame.spaceQueued = false;

  const result = minigame.update(state.minigame, spacePressed);
  renderer.frame(minigame.render(state.minigame, tick));

  if (result === 'win') {
    const fish = state.minigame.fish;
    const weight = rng.rollWeight(fish);
    const value = rng.rollValue(fish, weight);
    const { isNewSpecies, isPersonalBest } = SaveEngine.recordCatch(saveData, fish, weight, value);
    SaveEngine.save(saveData);
    state.reveal = { fish, weight, value, isNewSpecies, isPersonalBest, escaped: false };
    state.screen = 'reveal';
  } else if (result === 'lose') {
    SaveEngine.recordEscape(saveData);
    SaveEngine.save(saveData);
    state.reveal = { escaped: true };
    state.screen = 'reveal';
  }
}

function loop() {
  tick += 1;

  if (state.screen === 'title') {
    renderer.frame(titleScreen.render(tick));
  } else if (state.screen === 'fishing') {
    tickFishing();
  } else if (state.screen === 'minigame') {
    tickMinigame();
  } else if (state.screen === 'reveal') {
    renderer.frame(revealScreen.render(state.reveal, tick));
  }
}

function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error(
      'Terminal Tackle needs an interactive terminal (TTY) to run.\n' +
        'Run it directly in a terminal window, not through a pipe or redirect.'
    );
    process.exit(1);
  }

  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  if (cols < 60 || rows < 24) {
    console.error(
      `Your terminal window is a bit small (${cols}x${rows}). ` +
        'Please resize to at least 60x24 and try again.'
    );
    process.exit(1);
  }

  saveData = SaveEngine.load();

  renderer.enterAltScreen();
  renderer.hideCursor();

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('keypress', handleKeypress);

  loopHandle = setInterval(loop, TICK_MS);
}

main();
