#!/usr/bin/env node
'use strict';

const readline = require('readline');

const renderer = require('./engine/renderer');
const SaveEngine = require('./engine/save');
const rng = require('./engine/rng');
const gear = require('./engine/gear');
const layout = require('./engine/layout');

const titleScreen = require('./screens/title');
const fishingScreen = require('./screens/fishing');
const minigame = require('./screens/minigame');
const revealScreen = require('./screens/reveal');
const shopScreen = require('./screens/shop');

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
  shop: null,
};

function buildFishingDisplay() {
  return {
    sub: state.fishing.sub,
    locationName: LOCATION_NAME,
    rod: gear.getRod(saveData.rod).shortName,
    bait: gear.getBait(saveData.bait).shortName,
    gold: saveData.gold,
  };
}

function returnToFishingIdle() {
  state.screen = 'fishing';
  state.fishing = { sub: 'idle', biteTimer: 0, biteFlashTimer: 0 };
}

function openShop() {
  state.screen = 'shop';
  state.shop = { message: '', messageOk: false, messageTimer: 0 };
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

  if (state.screen === 'fishing' && state.fishing.sub === 'idle') {
    if (isSpace) {
      state.fishing.sub = 'waiting';
      state.fishing.biteTimer = rng.biteDelayMs();
      SaveEngine.recordCast(saveData);
      SaveEngine.save(saveData);
      return;
    }
    if (str && str.toLowerCase() === 's') {
      openShop();
      return;
    }
  }

  if (state.screen === 'minigame' && isSpace) {
    state.minigame.spaceQueued = true;
    return;
  }

  if (state.screen === 'reveal') {
    returnToFishingIdle();
    return;
  }

  if (state.screen === 'shop') {
    const isBack = (str && str.toLowerCase() === 'b') || (key && key.name === 'escape');
    if (isBack) {
      returnToFishingIdle();
      return;
    }
    if (str && /^[0-9]$/.test(str)) {
      const result = shopScreen.purchase(saveData, str);
      if (result) {
        SaveEngine.save(saveData);
        state.shop.message = result.message;
        state.shop.messageOk = result.success;
        state.shop.messageTimer = 35;
      }
      return;
    }
  }
}

function tickFishing(view) {
  if (state.fishing.sub === 'waiting') {
    state.fishing.biteTimer -= TICK_MS;
    if (state.fishing.biteTimer <= 0) {
      state.fishing.sub = 'bite';
      state.fishing.biteFlashTimer = 600;
    }
  } else if (state.fishing.sub === 'bite') {
    state.fishing.biteFlashTimer -= TICK_MS;
    if (state.fishing.biteFlashTimer <= 0) {
      const rarityBoost = gear.getBait(saveData.bait).rarityBoost;
      const barBonus = gear.getRod(saveData.rod).barBonus;
      const fish = rng.pickFish(FISH_LIST, rarityBoost);
      state.minigame = minigame.createState(fish, barBonus);
      state.screen = 'minigame';
      return;
    }
  }

  renderer.frame(
    fishingScreen.render(buildFishingDisplay(), tick, view.width, view.rows),
    view
  );
}

function tickMinigame(view) {
  const spacePressed = Boolean(state.minigame.spaceQueued);
  state.minigame.spaceQueued = false;

  const result = minigame.update(state.minigame, spacePressed);
  renderer.frame(minigame.render(state.minigame, tick, view.width), view);

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

function tickShop(view) {
  if (state.shop.messageTimer > 0) state.shop.messageTimer -= 1;

  renderer.frame(
    shopScreen.render(
      {
        gold: saveData.gold,
        rodId: saveData.rod,
        baitId: saveData.bait,
        message: state.shop.message,
        messageOk: state.shop.messageOk,
        messageTimer: state.shop.messageTimer,
      },
      tick,
      view.width
    ),
    view
  );
}

function renderTooSmall(view) {
  renderer.frame(
    [
      '',
      renderer.bold(renderer.palette.bad('Terminal window too small to keep playing.')),
      '',
      `Currently ${view.cols}x${view.rows} - need at least ` +
        `${layout.MIN_TERMINAL_COLS}x${layout.MIN_TERMINAL_ROWS}.`,
      '',
      renderer.dim('Resize your terminal window; the game will resume automatically.'),
    ],
    view
  );
}

function loop() {
  tick += 1;
  // Recomputed every tick (cheap) rather than cached, so a live terminal
  // resize is reflected on the very next frame with no extra event wiring.
  const view = layout.getLayout();

  // Below this size the box (view.width + 2 border chars) would be wider
  // than the terminal itself and wrap, corrupting the ASCII art alignment.
  // Everything simply pauses here (bite timers, minigame physics, the
  // timeout clock) rather than ticking blindly with no visible feedback -
  // it resumes exactly where it left off once they resize back up.
  if (view.cols < layout.MIN_TERMINAL_COLS || view.rows < layout.MIN_TERMINAL_ROWS) {
    return renderTooSmall(view);
  }

  if (state.screen === 'title') {
    renderer.frame(titleScreen.render(tick, view.width), view);
  } else if (state.screen === 'fishing') {
    tickFishing(view);
  } else if (state.screen === 'minigame') {
    tickMinigame(view);
  } else if (state.screen === 'reveal') {
    renderer.frame(revealScreen.render(state.reveal, tick, view.width), view);
  } else if (state.screen === 'shop') {
    tickShop(view);
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

  const { cols, rows } = layout.getTerminalSize();
  if (cols < layout.MIN_TERMINAL_COLS || rows < layout.MIN_TERMINAL_ROWS) {
    console.error(
      `Your terminal window is a bit small (${cols}x${rows}). ` +
        `Please resize to at least ${layout.MIN_TERMINAL_COLS}x${layout.MIN_TERMINAL_ROWS} and try again.`
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
