#!/usr/bin/env node
'use strict';

// Claude Code status-line command for the terminal pet.
// Reads the session JSON on stdin (unused, but drained), loads the pet's
// state, applies time-based decay, persists a death transition if one just
// happened, and prints the pet to stdout. Runs locally: zero API tokens.

const pet = require('../lib/pet.js');

let rendered = false;
function main() {
  if (rendered) return;
  rendered = true;
  const now = Date.now();
  const state = pet.ensure(now);

  // If the pet crossed the death threshold while idle, record it once so the
  // death is permanent (a returning prompt won't silently resurrect it).
  if (!state.dead && pet.checkDeath(state, now)) {
    pet.save(state);
  }

  const color = process.env.NO_COLOR ? false : true;
  process.stdout.write(pet.renderStatusLine(state, now, { color }) + '\n');
}

// Drain stdin so Claude Code's pipe closes cleanly, then render. We don't need
// the payload, but reading it avoids EPIPE on some platforms.
let buf = '';
process.stdin.on('data', (c) => (buf += c));
process.stdin.on('end', () => {
  try {
    main();
  } catch (_) {
    // Never break the status line; print nothing on failure.
  }
});
process.stdin.on('error', () => {
  try {
    main();
  } catch (_) {}
});
// If stdin never emits (no pipe), still render after a short tick.
setTimeout(() => {
  try {
    main();
  } catch (_) {}
}, 50).unref();
