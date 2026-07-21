'use strict';

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

// Rarer fish are intentionally uncommon: this weight decides how often a
// given rarity tier is picked before we narrow down to a species within it.
const RARITY_WEIGHTS = {
  common: 55,
  uncommon: 30,
  rare: 12,
  legendary: 3,
};

function weightedPick(items, weightFn) {
  const total = items.reduce((sum, item) => sum + weightFn(item), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= weightFn(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function pickFish(fishList) {
  const raritiesPresent = [...new Set(fishList.map((f) => f.rarity))];
  const rarity = weightedPick(raritiesPresent, (r) => RARITY_WEIGHTS[r] || 1);
  const candidates = fishList.filter((f) => f.rarity === rarity);
  return candidates[randInt(0, candidates.length - 1)];
}

function rollWeight(fish) {
  const [min, max] = fish.weightRange;
  // Slight low-weight bias feels more natural than a flat distribution -
  // most catches are unremarkable, big ones stay exciting.
  const t = Math.pow(Math.random(), 1.5);
  return Math.round((min + t * (max - min)) * 10) / 10;
}

function rollValue(fish, weight) {
  const [min, max] = fish.weightRange;
  const span = Math.max(max - min, 0.01);
  const ratio = 0.5 + (weight - min) / span; // 0.5x - 1.5x base value
  return Math.max(1, Math.round(fish.baseValue * ratio));
}

function biteDelayMs() {
  return randRange(1500, 4500);
}

module.exports = {
  randRange,
  randInt,
  weightedPick,
  pickFish,
  rollWeight,
  rollValue,
  biteDelayMs,
};
