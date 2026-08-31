/* Pure feature-gate logic: which parts of Burbz a player has met yet.
 * The player quest chain is the teacher, so the chain decides when each
 * dock button and quest-board section first appears. Nothing re-locks:
 * a feature is open once the chain reaches its link, once the save shows
 * the player already uses it, or once the early game is over (level 12,
 * the v262 line). Input is caller-normalized; this module never reads
 * game globals.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BurbzOnboardingGate = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The early game ends at trainer level 12 (early-game-until-level-12 v262).
  // From there every gate stands open, whatever the chain says.
  var MASTER_UNLOCK_LEVEL = 12;

  // feature → the chain link that introduces it. A null link means the
  // feature is part of the game's opening and never hides. Keys match the
  // dock's data-screen / data-quick-destination names so the DOM walker can
  // pair them without a translation table; quest-board sections carry a
  // quests_ prefix.
  var FEATURE_UNLOCKS = {
    map: null,          // home — the world itself
    quests: null,       // the chain lives here; claims happen here
    village: null,      // link 1 opens the Empire map
    scan: null,         // the game boots onto Merlin's wand
    academy: 'pq_build_barracks',
    birdex: 'pq_preen',
    forge: 'pq_equip_gear',
    inventory: 'pq_equip_gear',
    battle: 'pq_first_win',
    // The Kitchen & Pantry stands from the start (starter-kitchen), so its
    // button waits for the chain's first feeding lesson, not for a build.
    kitchen: 'pq_true_diet',
    training: 'pq_build_training',
    hospital: 'pq_build_hospital',
    leaderboards: 'pq_win_3',
    diary: 'pq_preen',
    quests_daily: 'pq_build_barracks',
    quests_weekly: 'pq_first_win',
    quests_achievements: 'pq_first_win',
    quests_walks: 'pq_walk_adventure'
  };

  function toArray(value) { return Array.isArray(value) ? value : []; }

  // Index of the first unclaimed link — the active one. Every link before it
  // is claimed, so "the chain has reached link i" is exactly i <= activeIndex.
  function chainActiveIndex(chainIds, claimedIds) {
    var ids = toArray(chainIds);
    var claimed = {};
    toArray(claimedIds).forEach(function (id) { claimed[id] = true; });
    for (var i = 0; i < ids.length; i++) {
      if (!claimed[ids[i]]) return i;
    }
    return ids.length;
  }

  // input: {
  //   chainIds:  ordered player-quest ids,
  //   claimedIds: ids the player has claimed,
  //   evidence:  {feature: true} — the save already shows this in use,
  //   playerLevel: trainer level,
  //   masterUnlock: force everything open (level valve computed here too)
  // }
  // Returns {feature: boolean} for every key in FEATURE_UNLOCKS.
  function unlockedFeatures(input) {
    input = input && typeof input === 'object' ? input : {};
    var chainIds = toArray(input.chainIds);
    var evidence = input.evidence && typeof input.evidence === 'object' ? input.evidence : {};
    var level = Number(input.playerLevel) || 1;
    var master = input.masterUnlock === true || level >= MASTER_UNLOCK_LEVEL;
    var activeIndex = chainActiveIndex(chainIds, input.claimedIds);
    var open = {};
    Object.keys(FEATURE_UNLOCKS).forEach(function (feature) {
      if (master || evidence[feature] === true) { open[feature] = true; return; }
      var link = FEATURE_UNLOCKS[feature];
      if (link == null) { open[feature] = true; return; }
      var linkIndex = chainIds.indexOf(link);
      // A link the chain no longer carries must never lock its feature
      // forever — an unknown link counts as already passed.
      open[feature] = linkIndex < 0 ? true : linkIndex <= activeIndex;
    });
    return open;
  }

  // The swipe road (or any ordered screen list) with locked screens removed.
  // Screens the gate does not know keep their place.
  function filterRoad(road, open) {
    var map = open && typeof open === 'object' ? open : {};
    return toArray(road).filter(function (screen) { return map[screen] !== false; });
  }

  return {
    MASTER_UNLOCK_LEVEL: MASTER_UNLOCK_LEVEL,
    FEATURE_UNLOCKS: FEATURE_UNLOCKS,
    chainActiveIndex: chainActiveIndex,
    unlockedFeatures: unlockedFeatures,
    filterRoad: filterRoad
  };
}));
