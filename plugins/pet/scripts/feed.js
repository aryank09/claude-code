#!/usr/bin/env node
'use strict';

// UserPromptSubmit hook: "using the terminal" feeds the pet.
// It records the interaction timestamp and exits WITHOUT writing anything to
// stdout. For UserPromptSubmit, any stdout is injected into Claude's context,
// which would cost tokens — so this hook stays completely silent.

const pet = require('../lib/pet.js');

function run() {
  try {
    const now = Date.now();
    const state = pet.load(now);
    // feed() first checks whether the pet already starved while you were away;
    // if so it dies now instead of being resurrected by your return.
    pet.feed(state, now);
    pet.save(state);
  } catch (_) {
    // Never disrupt the prompt on failure.
  }
  process.exit(0);
}

// Drain (and ignore) the hook payload on stdin, then run. Guard so we only run
// once whether 'end' fires or the fallback timer does.
let done = false;
const go = () => {
  if (done) return;
  done = true;
  run();
};
process.stdin.on('data', () => {});
process.stdin.on('end', go);
process.stdin.on('error', go);
setTimeout(go, 50).unref();
