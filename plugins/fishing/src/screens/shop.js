'use strict';

const {
  palette,
  bold,
  dim,
  padRight,
  padCenter,
  clip,
  boxTop,
  boxBottom,
  boxDivider,
  boxLine,
} = require('../engine/renderer');
const gear = require('../engine/gear');

const WIDTH = 56;

// Single source of truth for numbered menu items, so the render and the
// keypress handler in game.js never drift out of sync with each other.
function getMenuItems() {
  const items = [];
  let key = 1;
  gear.rods.forEach((rod) => {
    items.push({ key: String(key++), kind: 'rod', item: rod });
  });
  gear.baits.forEach((bait) => {
    items.push({ key: String(key++), kind: 'bait', item: bait });
  });
  return items;
}

function purchase(saveData, key) {
  const menuItem = getMenuItems().find((m) => m.key === key);
  if (!menuItem) return null;

  const { kind, item } = menuItem;
  const currentId = kind === 'rod' ? saveData.rod : saveData.bait;

  if (currentId === item.id) {
    return { success: false, message: `Already using the ${item.name}.` };
  }
  if (saveData.gold < item.cost) {
    return {
      success: false,
      message: `Not enough gold - need ${item.cost - saveData.gold}g more.`,
    };
  }

  saveData.gold -= item.cost;
  if (kind === 'rod') saveData.rod = item.id;
  else saveData.bait = item.id;

  return { success: true, message: `Equipped the ${item.name}!` };
}

function itemRow(menuItem, equippedId) {
  const { key, item } = menuItem;
  const equipped = item.id === equippedId;
  const tag = equipped ? ' [EQUIPPED]' : '';
  const costText = equipped ? '' : item.cost === 0 ? 'free' : `${item.cost}g`;
  const label = clip(`[${key}] ${item.name}${tag}`, WIDTH - 10);
  const styledLabel = equipped ? palette.good(label) : label;
  const styledCost = item.cost === 0 && !equipped ? dim(costText) : palette.gold(costText);
  const line1 = padRight(styledLabel, WIDTH - 10) + padRight(styledCost, 10);
  const line2 = dim('    ' + clip(item.description, WIDTH - 4));
  return [line1, line2];
}

function render(state, tick) {
  const lines = [];

  lines.push(boxTop(WIDTH, 'TACKLE SHOP'));
  lines.push(
    boxLine(padCenter(`Gold: ${palette.gold(bold(String(state.gold)))}`, WIDTH), WIDTH)
  );
  lines.push(boxDivider(WIDTH));
  lines.push(boxLine(bold(' Rods'), WIDTH));

  gear.rods.forEach((rod, idx) => {
    const menuItem = { key: String(idx + 1), item: rod };
    itemRow(menuItem, state.rodId).forEach((line) => lines.push(boxLine(line, WIDTH)));
  });

  lines.push(boxLine('', WIDTH));
  lines.push(boxLine(bold(' Bait'), WIDTH));

  gear.baits.forEach((bait, idx) => {
    const menuItem = { key: String(gear.rods.length + idx + 1), item: bait };
    itemRow(menuItem, state.baitId).forEach((line) => lines.push(boxLine(line, WIDTH)));
  });

  lines.push(boxDivider(WIDTH));

  if (state.message && state.messageTimer > 0) {
    const color = state.messageOk ? palette.good : palette.bad;
    lines.push(boxLine(padCenter(color(bold(state.message)), WIDTH), WIDTH));
  } else {
    lines.push(boxLine('', WIDTH));
  }

  const blink = tick % 2 === 0;
  const hint = 'press a number to buy/equip  ·  B back  ·  Q quit';
  lines.push(boxLine(padCenter(blink ? bold(hint) : dim(hint), WIDTH), WIDTH));
  lines.push(boxBottom(WIDTH));

  return lines;
}

module.exports = { render, purchase, getMenuItems, WIDTH };
