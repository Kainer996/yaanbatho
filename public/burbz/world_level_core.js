// Burbz World Level Core — "The Usurper Fights Back"
// Conquest difficulty maths, Assassin's-Creed style. Every liberation makes
// the free realm stronger — and makes the dark force defend what is left
// harder. This core turns conquest progress into a WORLD LEVEL, stamps every
// still-shadowed village with a recommended level by how far it lies from the
// cradle of the realm, and rates the danger of a fight against the player's
// own flock. Pure logic: no DOM, deterministic, UMD export.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzWorldLevelCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function n(v, fallback) { const num = Number(v); return Number.isFinite(num) ? num : fallback; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // Bird levels top out at 50, so the world never asks for more.
  const WORLD_LEVEL_CAP = 50;

  // What each rung of the realm adds to the world level. A county is three
  // villages, so founding one moves the world on by its own weight on top of
  // the villages that made it — every title the player wins raises the stakes.
  const CONQUEST_WEIGHTS = { village: 1, county: 2, duchy: 4, kingdom: 6, empire: 8 };

  // progress: { villages, counties, duchies, kingdoms, empires } — counts of
  // liberated villages and founded titles. Missing fields count as zero.
  function worldLevel(progress) {
    const p = progress || {};
    const score =
      n(p.villages, 0) * CONQUEST_WEIGHTS.village +
      n(p.counties, 0) * CONQUEST_WEIGHTS.county +
      n(p.duchies, 0) * CONQUEST_WEIGHTS.duchy +
      n(p.kingdoms, 0) * CONQUEST_WEIGHTS.kingdom +
      n(p.empires, 0) * CONQUEST_WEIGHTS.empire;
    return clamp(1 + Math.round(score), 1, WORLD_LEVEL_CAP);
  }

  // ---------------------------------------------------------------------------
  // Distance bands — the far frontier is always the hard frontier
  // ---------------------------------------------------------------------------
  // Distance is measured from the CRADLE: the first village the player ever
  // freed. Close to home the garrisons match the world level; ride out past
  // the marches and the usurper's grip tightens band by band.
  const DISTANCE_BANDS = [
    { id: 'heartland',   maxKm: 3,        add: 0, label: 'Heartland' },
    { id: 'homefields',  maxKm: 12,       add: 1, label: 'Home Fields' },
    { id: 'marches',     maxKm: 40,       add: 2, label: 'The Marches' },
    { id: 'borderlands', maxKm: 150,      add: 4, label: 'Borderlands' },
    { id: 'shadowwilds', maxKm: 600,      add: 6, label: 'Shadow Wilds' },
    { id: 'farfrontier', maxKm: Infinity, add: 8, label: 'Far Frontier' }
  ];

  function distanceBand(distanceKm) {
    const km = Number(distanceKm);
    if (!Number.isFinite(km) || km < 0) return DISTANCE_BANDS[0];
    return DISTANCE_BANDS.find(b => km <= b.maxKm) || DISTANCE_BANDS[DISTANCE_BANDS.length - 1];
  }

  // The level stamped on a still-shadowed village: world level plus its band.
  function siteRecommendedLevel(worldLv, distanceKm) {
    return clamp(Math.max(1, Math.round(n(worldLv, 1))) + distanceBand(distanceKm).add, 1, WORLD_LEVEL_CAP);
  }

  // The garrison fights AT the recommended level — that is the whole deal.
  function garrisonLevel(recommendedLevel) {
    return clamp(Math.max(1, Math.round(n(recommendedLevel, 1))), 1, WORLD_LEVEL_CAP);
  }

  // ---------------------------------------------------------------------------
  // Danger ratings — honest odds before a single feather flies
  // ---------------------------------------------------------------------------
  // diff = recommended level minus the flock's battle level.
  const DANGER_RATINGS = [
    { id: 'stroll', maxDiff: -3,       icon: '🕊️', label: 'An easy flight', color: '#5fd38a', hint: 'Your flock flies well above this fight.' },
    { id: 'fair',   maxDiff: 1,        icon: '⚔️', label: 'A fair fight',   color: '#4aa8e0', hint: 'Evenly matched — bring your counters.' },
    { id: 'hard',   maxDiff: 4,        icon: '🔥', label: 'A hard fight',   color: '#e08a3a', hint: 'The garrison outlevels you. Train and gear up first.' },
    { id: 'deadly', maxDiff: Infinity, icon: '💀', label: 'Deadly',         color: '#e0594a', hint: 'Far beyond your flock. Liberate closer to home and come back stronger.' }
  ];

  function dangerRating(recommendedLevel, flockLevel) {
    const diff = Math.round(n(recommendedLevel, 1)) - Math.max(1, Math.round(n(flockLevel, 1)));
    const rating = DANGER_RATINGS.find(r => diff <= r.maxDiff) || DANGER_RATINGS[DANGER_RATINGS.length - 1];
    return { ...rating, diff };
  }

  // The flock's battle level: the average of its four strongest fighters,
  // because four birds is a Skyclash squad.
  function flockBattleLevel(levels) {
    const sorted = (Array.isArray(levels) ? levels : [])
      .map(v => Math.max(1, Math.round(n(v, 1))))
      .sort((a, b) => b - a)
      .slice(0, 4);
    if (!sorted.length) return 1;
    return Math.max(1, Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length));
  }

  return {
    WORLD_LEVEL_CAP, CONQUEST_WEIGHTS, worldLevel,
    DISTANCE_BANDS, distanceBand, siteRecommendedLevel, garrisonLevel,
    DANGER_RATINGS, dangerRating, flockBattleLevel
  };
});
