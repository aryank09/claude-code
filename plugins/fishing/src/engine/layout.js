'use strict';

// Every screen shares one box width derived from the live terminal size
// instead of each hardcoding its own constant. That way switching between
// screens (title -> fishing -> minigame -> reveal -> shop) never jumps to a
// different width, and resizing the terminal makes the whole game bigger
// (or smaller) together.
//
// MIN_WIDTH is set by the most cramped fixed-content row in the game (the
// fishing screen's "Rod: ... Bait: ... Gold: ..." status line) - going
// narrower than this risks overflow even with defensive clipping.
// MAX_WIDTH keeps things from stretching into a sparse, awkward-looking box
// on ultra-wide terminals.
const MIN_WIDTH = 60;
const MAX_WIDTH = 100;

// Required so the box (content + 2 border chars) can't be wider than the
// terminal itself, which would wrap and break the ASCII art alignment.
const MIN_TERMINAL_COLS = MIN_WIDTH + 2;
const MIN_TERMINAL_ROWS = 24;

function getTerminalSize() {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  return { cols, rows };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Recomputed fresh on every call (cheap - just reads two properties) rather
// than cached, so a live terminal resize is picked up on the very next
// render tick with no extra event plumbing needed.
function getLayout() {
  const { cols, rows } = getTerminalSize();
  const width = clamp(cols - 2, MIN_WIDTH, MAX_WIDTH);
  return { cols, rows, width };
}

module.exports = {
  getTerminalSize,
  getLayout,
  MIN_WIDTH,
  MAX_WIDTH,
  MIN_TERMINAL_COLS,
  MIN_TERMINAL_ROWS,
};
