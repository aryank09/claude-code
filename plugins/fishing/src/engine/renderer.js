'use strict';

// Raw ANSI helpers. No dependencies (chalk v5 is ESM-only and would force
// an install step) so the game runs instantly on any Node 16+ install.

const ESC = '\x1b';

const CODES = {
  reset: `${ESC}[0m`,
  bold: `${ESC}[1m`,
  dim: `${ESC}[2m`,
};

function fg256(code, text) {
  return `${ESC}[38;5;${code}m${text}${CODES.reset}`;
}

function bold(text) {
  return `${CODES.bold}${text}${CODES.reset}`;
}

function dim(text) {
  return `${CODES.dim}${text}${CODES.reset}`;
}

const palette = {
  sky: (t) => fg256(74, t),
  water: (t) => fg256(24, t),
  waterLight: (t) => fg256(31, t),
  mountain: (t) => fg256(95, t),
  tree: (t) => fg256(28, t),
  gold: (t) => fg256(220, t),
  fish: (t) => fg256(214, t),
  rare: (t) => fg256(207, t),
  legendary: (t) => fg256(213, t),
  good: (t) => fg256(84, t),
  bad: (t) => fg256(203, t),
  muted: (t) => fg256(244, t),
};

// Strip ANSI codes to measure visible width for padding, since escape
// sequences count as zero-width characters on screen but not in `.length`.
function visibleLength(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padCenter(str, width) {
  const len = visibleLength(str);
  if (len >= width) return str;
  const totalPad = width - len;
  const left = Math.floor(totalPad / 2);
  const right = totalPad - left;
  return ' '.repeat(left) + str + ' '.repeat(right);
}

function padRight(str, width) {
  const len = visibleLength(str);
  if (len >= width) return str;
  return str + ' '.repeat(width - len);
}

// padCenter/padRight only ever ADD padding, they never truncate - so any
// string built from data (gear names, fish names, descriptions) must be
// clipped to a known-safe length before being placed in a fixed-width row,
// or a too-long value will blow past the box's right border.
function clip(str, maxLen) {
  if (visibleLength(str) <= maxLen) return str;
  return str.length > maxLen ? str.slice(0, Math.max(0, maxLen - 1)) + '…' : str;
}

function boxTop(width, title) {
  if (!title) return '╔' + '═'.repeat(width) + '╗';
  const label = ` ${title} `;
  const remaining = width - visibleLength(label);
  const left = Math.max(1, Math.floor(remaining / 2));
  const right = Math.max(1, width - visibleLength(label) - left);
  return '╔' + '═'.repeat(left) + label + '═'.repeat(right) + '╗';
}

function boxBottom(width) {
  return '╚' + '═'.repeat(width) + '╝';
}

function boxDivider(width) {
  return '╠' + '═'.repeat(width) + '╣';
}

function boxLine(content, width) {
  return '║' + padRight(content, width) + '║';
}

function hideCursor() {
  process.stdout.write(`${ESC}[?25l`);
}

function showCursor() {
  process.stdout.write(`${ESC}[?25h`);
}

function enterAltScreen() {
  process.stdout.write(`${ESC}[?1049h`);
}

function exitAltScreen() {
  process.stdout.write(`${ESC}[?1049l`);
}

function frame(lines) {
  // Move cursor home and redraw in one write to minimize flicker.
  process.stdout.write(`${ESC}[H${ESC}[2J` + lines.join('\r\n') + '\r\n');
}

module.exports = {
  CODES,
  palette,
  bold,
  dim,
  padCenter,
  padRight,
  visibleLength,
  clip,
  boxTop,
  boxBottom,
  boxDivider,
  boxLine,
  hideCursor,
  showCursor,
  enterAltScreen,
  exitAltScreen,
  frame,
};
