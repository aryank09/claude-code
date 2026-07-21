'use strict';

const { palette, bold, dim, padCenter } = require('../engine/renderer');

function render(tick, width) {
  const lines = [];
  const border = '='.repeat(width);

  lines.push(palette.mountain(border));
  lines.push('');
  lines.push(padCenter(palette.gold(bold('T E R M I N A L   T A C K L E')), width));
  lines.push('');
  lines.push(padCenter('🎣  a little fishing break, right in your terminal  🎣', width));
  lines.push('');
  lines.push(padCenter(palette.waterLight('~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~'), width));
  lines.push('');

  const blink = Math.floor(tick / 5) % 2 === 0;
  const prompt = blink ? bold('press any key to start') : dim('press any key to start');
  lines.push(padCenter(prompt, width));
  lines.push('');
  lines.push(padCenter(dim('Q to quit anytime  ·  progress saves automatically'), width));
  lines.push('');
  lines.push(palette.mountain(border));

  return lines;
}

module.exports = { render };
