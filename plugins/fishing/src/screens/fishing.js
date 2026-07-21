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

// Number of non-water chrome lines the box always draws, used to figure out
// how many spare terminal rows are available to grow the water scene into.
const FIXED_CHROME_LINES = 12;
const MIN_WATER_ROWS = 3;
const MAX_WATER_ROWS = 10;

function waterRowCount(rows) {
  if (!rows) return 4;
  const spare = rows - FIXED_CHROME_LINES;
  return Math.max(MIN_WATER_ROWS, Math.min(MAX_WATER_ROWS, spare));
}

// Plain ASCII only in this scene (mountains/trees/water/bobber): emoji and
// wide unicode glyphs render at inconsistent column widths across terminals
// and would break the fixed-width box alignment.

function mountainRow(width) {
  const chars = new Array(width).fill(' ');
  for (let peak = 8; peak < width; peak += 16) {
    if (peak - 1 >= 0) chars[peak - 1] = '/';
    chars[peak] = '^';
    if (peak + 1 < width) chars[peak + 1] = '\\';
  }
  return palette.mountain(chars.join(''));
}

function treeRow(width) {
  const chars = new Array(width).fill(' ');
  for (let t = 4; t < width; t += 9) {
    chars[t] = 'Y';
  }
  return palette.tree(chars.join(''));
}

function shoreRow(width) {
  return dim('-'.repeat(width));
}

function waveChar(x, tick, rowIndex) {
  return (x + tick + rowIndex * 2) % 5 < 2 ? '~' : ' ';
}

function buildWaterRow(rowIndex, tick, bobber, width) {
  const chars = [];
  for (let x = 0; x < width; x++) chars.push(waveChar(x, tick, rowIndex));
  const colorFn = rowIndex % 2 === 0 ? palette.water : palette.waterLight;

  if (bobber && bobber.row === rowIndex) {
    const col = Math.max(0, Math.min(width - 1, bobber.col));
    const prefix = chars.slice(0, col).join('');
    const suffix = chars.slice(col + 1).join('');
    return colorFn(prefix) + bobber.colorFn(bobber.char) + colorFn(suffix);
  }

  return colorFn(chars.join(''));
}

function getBobber(state, tick, width) {
  const col = Math.floor(width / 2);

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

function render(state, tick, width, rows) {
  const lines = [];

  lines.push(boxTop(width, 'TERMINAL TACKLE'));
  lines.push(boxLine(padCenter(bold(state.locationName), width), width));
  lines.push(boxDivider(width));
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
        width
      ),
      width
    )
  );
  lines.push(boxDivider(width));

  const bobber = getBobber(state, tick, width);
  const waterRows = waterRowCount(rows);

  lines.push(boxLine(mountainRow(width), width));
  lines.push(boxLine(treeRow(width), width));
  lines.push(boxLine(shoreRow(width), width));
  for (let row = 0; row < waterRows; row++) {
    lines.push(boxLine(buildWaterRow(row, tick, bobber, width), width));
  }

  lines.push(boxLine('', width));
  lines.push(boxLine(padCenter(hintLine(state, tick), width), width));
  lines.push(boxLine('', width));
  lines.push(boxBottom(width));

  return lines;
}

module.exports = { render };
