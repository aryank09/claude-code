'use strict';

const { palette, bold, dim, padCenter, boxTop, boxBottom, boxLine } = require('../engine/renderer');

const WIDTH = 48;

function stars(rarity) {
  // Plain ASCII, not unicode stars: some terminals render star glyphs as
  // double-width, which would throw off the fixed-width box alignment.
  const counts = { common: 1, uncommon: 2, rare: 3, legendary: 5 };
  const n = counts[rarity] || 1;
  return '*'.repeat(n) + '-'.repeat(5 - n);
}

function rarityColor(rarity) {
  if (rarity === 'legendary') return palette.legendary;
  if (rarity === 'rare') return palette.rare;
  return palette.fish;
}

function renderCatch(result, tick) {
  const { fish, weight, value, isNewSpecies, isPersonalBest } = result;
  const color = rarityColor(fish.rarity);
  const lines = [];

  lines.push(boxTop(WIDTH, 'CATCH!'));
  lines.push(boxLine('', WIDTH));
  lines.push(boxLine(padCenter(color(bold(fish.art)), WIDTH), WIDTH));
  lines.push(boxLine('', WIDTH));
  lines.push(boxLine(padCenter(bold(color(fish.name.toUpperCase())), WIDTH), WIDTH));
  lines.push(boxLine(padCenter(color(stars(fish.rarity)) + '  ' + dim(fish.rarity), WIDTH), WIDTH));
  lines.push(boxLine('', WIDTH));
  lines.push(
    boxLine(padCenter(`Weight: ${weight} lbs   ·   Value: ${palette.gold(value + 'g')}`, WIDTH), WIDTH)
  );

  const badges = [];
  if (isNewSpecies) badges.push(palette.good('NEW SPECIES!'));
  if (isPersonalBest) badges.push(palette.gold('PERSONAL BEST!'));
  if (badges.length) {
    lines.push(boxLine('', WIDTH));
    lines.push(boxLine(padCenter(badges.join('   '), WIDTH), WIDTH));
  }

  lines.push(boxLine('', WIDTH));
  lines.push(boxLine(padCenter(dim('"' + fish.flavor + '"'), WIDTH), WIDTH));
  lines.push(boxLine('', WIDTH));

  const blink = tick % 2 === 0;
  const hint = 'press any key to keep fishing  ·  Q quit';
  lines.push(boxLine(padCenter(blink ? bold(hint) : dim(hint), WIDTH), WIDTH));
  lines.push(boxBottom(WIDTH));

  return lines;
}

function renderEscape(tick) {
  const lines = [];

  lines.push(boxTop(WIDTH, 'IT GOT AWAY'));
  lines.push(boxLine('', WIDTH));
  lines.push(boxLine(padCenter(palette.bad('>< ) ) ) ) ~ ~ ~'), WIDTH), WIDTH));
  lines.push(boxLine('', WIDTH));
  lines.push(boxLine(padCenter(dim('The line went slack. Whatever it was, it slipped free.'), WIDTH), WIDTH));
  lines.push(boxLine('', WIDTH));

  const blink = tick % 2 === 0;
  const hint = 'press any key to try again  ·  Q quit';
  lines.push(boxLine(padCenter(blink ? bold(hint) : dim(hint), WIDTH), WIDTH));
  lines.push(boxBottom(WIDTH));

  return lines;
}

function render(state, tick) {
  if (state.escaped) return renderEscape(tick);
  return renderCatch(state, tick);
}

module.exports = { render, WIDTH };
