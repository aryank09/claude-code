'use strict';

const {
  palette,
  bold,
  dim,
  padCenter,
  clip,
  boxTop,
  boxBottom,
  boxDivider,
  boxLine,
} = require('../engine/renderer');

const WIDTH = 60;
const WATER_ROWS = 4;

// Plain ASCII only in this scene (mountains/trees/water/bobber): emoji and
// wide unicode glyphs render at inconsistent column widths across terminals
// and would break the fixed-width box alignment.

function mountainRow() {
  const chars = new Array(WIDTH).fill(' ');
  for (let peak = 8; peak < WIDTH; peak += 16) {
    if (peak - 1 >= 0) chars[peak - 1] = '/';
    chars[peak] = '^';
    if (peak + 1 < WIDTH) chars[peak + 1] = '\\';
  }
  return palette.mountain(chars.join(''));
}

function treeRow() {
  const chars = new Array(WIDTH).fill(' ');
  for (let t = 4; t < WIDTH; t += 9) {
    chars[t] = 'Y';
  }
  return palette.tree(chars.join(''));
}

function shoreRow() {
  return dim('-'.repeat(WIDTH));
}

function waveChar(x, tick, rowIndex) {
  return (x + tick + rowIndex * 2) % 5 < 2 ? '~' : ' ';
}

function buildWaterRow(rowIndex, tick, bobber) {
  const chars = [];
  for (let x = 0; x < WIDTH; x++) chars.push(waveChar(x, tick, rowIndex));
  const colorFn = rowIndex % 2 === 0 ? palette.water : palette.waterLight;

  if (bobber && bobber.row === rowIndex) {
    const col = Math.max(0, Math.min(WIDTH - 1, bobber.col));
    const prefix = chars.slice(0, col).join('');
    const suffix = chars.slice(col + 1).join('');
    return colorFn(prefix) + bobber.colorFn(bobber.char) + colorFn(suffix);
  }

  return colorFn(chars.join(''));
}

function getBobber(state, tick) {
  const col = Math.floor(WIDTH / 2);

  if (state.sub === 'waiting') {
    const row = Math.floor(tick / 3) % 2;
    return { row, col, char: 'o', colorFn: palette.gold };
  }

  if (state.sub === 'bite') {
    const flashing = tick % 2 === 0;
    return {
      row: 2,
      col,
      char: '*',
      colorFn: flashing ? palette.bad : palette.gold,
    };
  }

  return null;
}

function hintLine(state, tick) {
  if (state.sub === 'idle') {
    return dim('SPACE cast   ·   S shop   ·   Q quit');
  }
  if (state.sub === 'waiting') {
    const dots = '.'.repeat((tick % 4) + 1);
    return dim('watching the line' + dots);
  }
  if (state.sub === 'bite') {
    return tick % 2 === 0
      ? bold(palette.bad('something is biting!!'))
      : bold(palette.gold('something is biting!!'));
  }
  return '';
}

function render(state, tick) {
  const lines = [];

  lines.push(boxTop(WIDTH, 'TERMINAL TACKLE'));
  lines.push(boxLine(padCenter(bold(state.locationName), WIDTH), WIDTH));
  lines.push(boxDivider(WIDTH));
  // Rod/bait names come from gear data and could grow with future items, so
  // clip them defensively - this row has no room to spare (see clip() docs
  // in renderer.js for why untruncated data-derived text is dangerous here).
  const rodLabel = clip(state.rod, 10);
  const baitLabel = clip(state.bait, 10);
  const goldLabel = clip(String(state.gold), 7);
  lines.push(
    boxLine(
      padCenter(
        `Rod: ${rodLabel}   ·   Bait: ${baitLabel}   ·   Gold: ${palette.gold(goldLabel)}`,
        WIDTH
      ),
      WIDTH
    )
  );
  lines.push(boxDivider(WIDTH));

  const bobber = getBobber(state, tick);

  lines.push(boxLine(mountainRow(), WIDTH));
  lines.push(boxLine(treeRow(), WIDTH));
  lines.push(boxLine(shoreRow(), WIDTH));
  for (let row = 0; row < WATER_ROWS; row++) {
    lines.push(boxLine(buildWaterRow(row, tick, bobber), WIDTH));
  }

  lines.push(boxLine('', WIDTH));
  lines.push(boxLine(padCenter(hintLine(state, tick), WIDTH), WIDTH));
  lines.push(boxLine('', WIDTH));
  lines.push(boxBottom(WIDTH));

  return lines;
}

module.exports = { render, WIDTH };
