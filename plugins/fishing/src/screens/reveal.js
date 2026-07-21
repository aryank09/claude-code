'use strict';

const { palette, bold, dim, padCenter, clip, boxTop, boxBottom, boxLine } = require('../engine/renderer');

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

function renderCatch(result, tick, width) {
  const { fish, weight, value, isNewSpecies, isPersonalBest } = result;
  const color = rarityColor(fish.rarity);
  const lines = [];

  lines.push(boxTop(width, 'CATCH!'));
  lines.push(boxLine('', width));
  lines.push(boxLine(padCenter(color(bold(fish.art)), width), width));
  lines.push(boxLine('', width));
  lines.push(boxLine(padCenter(bold(color(fish.name.toUpperCase())), width), width));
  lines.push(boxLine(padCenter(color(stars(fish.rarity)) + '  ' + dim(fish.rarity), width), width));
  lines.push(boxLine('', width));
  lines.push(
    boxLine(padCenter(`Weight: ${weight} lbs   ·   Value: ${palette.gold(value + 'g')}`, width), width)
  );

  const badges = [];
  if (isNewSpecies) badges.push(palette.good('NEW SPECIES!'));
  if (isPersonalBest) badges.push(palette.gold('PERSONAL BEST!'));
  if (badges.length) {
    lines.push(boxLine('', width));
    lines.push(boxLine(padCenter(badges.join('   '), width), width));
  }

  lines.push(boxLine('', width));
  // Flavor text is free-form data (fish.json) with no fixed max length, so
  // clip it defensively - see clip() docs in renderer.js.
  lines.push(boxLine(padCenter(dim('"' + clip(fish.flavor, width - 2) + '"'), width), width));
  lines.push(boxLine('', width));

  const blink = tick % 2 === 0;
  const hint = 'press any key to keep fishing  ·  Q quit';
  lines.push(boxLine(padCenter(blink ? bold(hint) : dim(hint), width), width));
  lines.push(boxBottom(width));

  return lines;
}

function renderEscape(tick, width) {
  const lines = [];

  lines.push(boxTop(width, 'IT GOT AWAY'));
  lines.push(boxLine('', width));
  lines.push(boxLine(padCenter(palette.bad('>< ) ) ) ) ~ ~ ~'), width), width));
  lines.push(boxLine('', width));
  lines.push(boxLine(padCenter(dim('The line went slack. Whatever it was, it slipped free.'), width), width));
  lines.push(boxLine('', width));

  const blink = tick % 2 === 0;
  const hint = 'press any key to try again  ·  Q quit';
  lines.push(boxLine(padCenter(blink ? bold(hint) : dim(hint), width), width));
  lines.push(boxBottom(width));

  return lines;
}

function render(state, tick, width) {
  if (state.escaped) return renderEscape(tick, width);
  return renderCatch(state, tick, width);
}

module.exports = { render };
