'use strict';

const GEAR = require('../data/gear.json');

function getRod(id) {
  return GEAR.rods.find((r) => r.id === id) || GEAR.rods[0];
}

function getBait(id) {
  return GEAR.baits.find((b) => b.id === id) || GEAR.baits[0];
}

module.exports = {
  rods: GEAR.rods,
  baits: GEAR.baits,
  getRod,
  getBait,
};
