(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.BurbzScanEconomy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RARITY_BASE = Object.freeze({
    common: 35,
    uncommon: 55,
    rare: 90,
    epic: 140,
    legendary: 220
  });

  function finiteNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function recruitCostBreakdown(bird) {
    const source = bird || {};
    const rarity = Object.prototype.hasOwnProperty.call(RARITY_BASE, source.rarity)
      ? source.rarity
      : 'common';
    const rarityBase = RARITY_BASE[rarity];
    const power = Math.max(20, finiteNumber(source.power, finiteNumber(source.basePower, 20)));
    const stats = [source.maxHp, source.atk, source.def, source.spd, source.int, source.stamina]
      .map(value => Math.max(0, finiteNumber(value, 0)))
      .filter(value => value > 0);
    const statAverage = stats.length ? stats.reduce((sum, value) => sum + value, 0) / stats.length : power;
    const statSpread = stats.length ? Math.max(...stats) - Math.min(...stats) : 0;

    // Rarity sets the market tier; power, overall stats and specialist builds add value.
    const powerPremium = Math.round(Math.max(0, power - 20) * 0.18);
    const statPremium = Math.round(Math.max(0, statAverage - 20) * 0.25);
    const specialistPremium = Math.round(Math.max(0, statSpread - 10) * 0.08);
    const total = Math.max(rarityBase, Math.min(500, rarityBase + powerPremium + statPremium + specialistPremium));

    return {
      rarity,
      rarityBase,
      power: Math.round(power),
      statAverage: Math.round(statAverage),
      powerPremium,
      statPremium,
      specialistPremium,
      total
    };
  }

  function recruitCostForBird(bird) {
    return recruitCostBreakdown(bird).total;
  }

  return { RARITY_BASE, recruitCostBreakdown, recruitCostForBird };
});
