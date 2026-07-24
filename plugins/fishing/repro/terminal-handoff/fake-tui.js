'use strict';

// Minimal full-screen, raw-mode terminal program (~25 lines of logic).
// It stands in for ANY interactive TUI a plugin might want to launch from a
// slash command: a game, an fzf-style picker, a wizard, etc. It needs three
// things a normal terminal program takes for granted:
//   1. raw-mode keyboard input (individual keypresses, no Enter)
//   2. a continuous render loop writing to the terminal
//   3. exclusive ownership of the controlling terminal
//
// Run it directly in a shell (`node fake-tui.js`) and it works perfectly.
// Launch it from a Claude Code hook (see hook-launch.sh) and it fails, because
// the hook - and therefore this process - has no controlling terminal.

const fs = require('fs');
const path = require('path');

const CRASH_LOG = path.join(__dirname, 'repro-crash.log');
const INPUT_LOG = path.join(__dirname, 'repro-input.log');

process.stdout.write('\x1b[?1049h\x1b[2J\x1b[H'); // alt screen + clear
process.stdout.write('REPRO TUI running. Press any key; press q to quit.\r\n');

if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

let frame = 0;
const timer = setInterval(() => {
  // Continuous writes can surface `write EIO`: the kernel may reject terminal
  // I/O from a process that isn't in the terminal's foreground process group /
  // session. This is intermittent (timing/load dependent).
  process.stdout.write(`frame ${frame++}\r\n`);
}, 200);

process.stdin.on('data', (key) => {
  // Record every keystroke this process actually receives. The reliable
  // symptom of the bug: keys you press while this TUI is "running" are largely
  // consumed by Claude Code (still reading the terminal for esc-to-interrupt),
  // so they never arrive here - this log stays empty or catches only a racy
  // fraction of what you typed.
  try {
    fs.appendFileSync(INPUT_LOG, JSON.stringify(key) + '\n');
  } catch (_) {
    /* ignore */
  }
  process.stdout.write(`key: ${JSON.stringify(key)}\r\n`);
  if (key === 'q' || key === '\u0003') {
    clearInterval(timer);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdout.write('\x1b[?1049l'); // leave alt screen
    process.exit(0);
  }
});

// stdout/tty may already be dead by the time this fires, so record the exact
// failure signature to a file the reproducer can read afterward.
function record(where, err) {
  try {
    fs.appendFileSync(
      CRASH_LOG,
      `[${new Date().toISOString()}] ${where}: ${(err && err.stack) || err}\n`
    );
  } catch (_) {
    /* nothing more we can do */
  }
  process.exit(1);
}

process.stdout.on('error', (err) => record('stdout error', err));
process.on('uncaughtException', (err) => record('uncaughtException', err));
