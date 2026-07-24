#!/usr/bin/env node
'use strict';

// UserPromptExpansion hook for the /pet command. Runs the requested action
// against the pet's saved state, then BLOCKS the expansion so nothing reaches
// the model (zero API tokens). The result is shown to the user via `reason`.
//
// Subcommands (from command_args):
//   /pet                 show the pet's status card
//   /pet feed | pet      give it attention right now
//   /pet revive          adopt a fresh pet after yours has died
//   /pet rename <name>   rename your pet
//   /pet help            usage

const pet = require('../lib/pet.js');

function block(reason) {
  const out = {
    decision: 'block',
    reason,
    hookSpecificOutput: { hookEventName: 'UserPromptExpansion' },
  };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

function usage() {
  return [
    'Terminal Pet — commands',
    '  /pet             check on your pet',
    '  /pet feed        give it attention now',
    '  /pet rename <n>  rename it',
    '  /pet revive      adopt a new pet after yours dies',
    '  /pet help        this message',
    '',
    'Your pet lives in the status line and slowly gets hungry when you',
    'stop using the terminal. Keep working (or /pet feed) to keep it happy.',
  ].join('\n');
}

function handle(payload) {
  const now = Date.now();
  const args = String((payload && payload.command_args) || '').trim();
  const parts = args.split(/\s+/).filter(Boolean);
  const sub = (parts[0] || '').toLowerCase();

  let state = pet.load(now);

  if (sub === 'help' || sub === '-h' || sub === '--help') {
    return block(usage());
  }

  if (sub === 'revive' || sub === 'adopt') {
    const wasDead = state.dead;
    state = pet.revive(state, now);
    pet.save(state);
    const header = wasDead
      ? `You bury the old one and adopt ${state.name} (generation #${state.generation}).`
      : `You adopt a new pet, ${state.name} (generation #${state.generation}).`;
    return block(pet.renderCard(state, now, header));
  }

  if (sub === 'rename') {
    const name = parts.slice(1).join(' ').trim();
    if (!name) return block('Usage: /pet rename <new name>');
    state.name = name.slice(0, 24);
    pet.save(state);
    return block(pet.renderCard(state, now, `Renamed to ${state.name}.`));
  }

  if (sub === 'feed' || sub === 'pet' || sub === 'pat') {
    if (state.dead) {
      return block(pet.renderCard(state, now, `${state.name} has passed on. Try /pet revive.`));
    }
    const res = pet.feed(state, now);
    pet.save(state);
    const header = res.died
      ? `You returned too late… ${state.name} didn't make it.`
      : `You give ${state.name} some attention. ♥`;
    return block(pet.renderCard(state, now, header));
  }

  // Default: show status (also silently persists a death transition).
  if (!state.dead) {
    pet.checkDeath(state, now);
    pet.save(state);
  }
  return block(pet.renderCard(state, now));
}

let raw = '';
let done = false;
const go = () => {
  if (done) return;
  done = true;
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (_) {
    payload = {};
  }
  try {
    handle(payload);
  } catch (_) {
    block('Your pet is napping (internal error). Try again.');
  }
};
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', go);
process.stdin.on('error', go);
setTimeout(go, 100).unref();
