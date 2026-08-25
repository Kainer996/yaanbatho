// Burbz Village Manager Core — "the bird builds the village".
//
// Yaan's law (2026-08-25). A player standing in the village, with every
// material to hand, raises every one of its buildings in FOUR HOURS. That is
// the yardstick the whole module hangs off.
//
// Appoint a bird as the village's Project Manager and it does the entire job
// on its own: it takes each building in turn, pays the bill, and gets on with
// it while you are somewhere else. It is slower than you, because you are not
// there. How much slower is the bird itself:
//
//   * a fully clever, fully charming songbird — a robin, a wren, a song thrush
//     that has spent its days in the Library and its nights in the Crowbar —
//     builds the whole village in SIX HOURS.
//   * a dull, graceless bird of prey takes THREE REAL DAYS.
//
// Everything between reads off one number: the bird's civic aptitude, which is
// INT and CHA weighed down by the bird's own size (bird_roles_core.js). Small
// charmers win. That is the point of the rule.
//
// With no manager, nothing here runs: the player builds the village themselves,
// exactly as they always have.
//
// Pure module: no DOM, no game state, no clocks of its own. UMD export.
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BurbzVillageManager = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MS_PER_MINUTE = 60000;
  var MS_PER_HOUR = 60 * MS_PER_MINUTE;

  // The three numbers Yaan named.
  var PLAYER_VILLAGE_HOURS = 4;   // you, there, with the materials
  var MANAGER_BEST_HOURS = 6;     // the sharpest, most charming songbird
  var MANAGER_WORST_HOURS = 72;   // a dull heavyweight: three real days

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---------------------------------------------------------------------------
  // The clock
  // ---------------------------------------------------------------------------

  // How long this bird takes over a whole village, in hours. Straight line from
  // three days at aptitude 0 to six hours at aptitude 100 — every point of wit
  // and charm the bird earns shaves a real, visible slice off the clock.
  function managerVillageHours(aptitude) {
    var a = clamp(num(aptitude, 0), 0, 100) / 100;
    return MANAGER_WORST_HOURS - (MANAGER_WORST_HOURS - MANAGER_BEST_HOURS) * a;
  }
  function managerVillageMs(aptitude) {
    return Math.round(managerVillageHours(aptitude) * MS_PER_HOUR);
  }

  // What the player's own build clocks are multiplied by when the manager runs
  // the site instead. `playerBudgetMs` is the real four-hour village budget the
  // game hands in, so the promise stays true even if the ladder is re-tuned;
  // a missing or nonsense budget falls back to the four-hour law itself.
  function managerBuildFactor(aptitude, playerBudgetMs) {
    var budget = num(playerBudgetMs, 0);
    if (!(budget > 0)) budget = PLAYER_VILLAGE_HOURS * MS_PER_HOUR;
    return Math.round((managerVillageMs(aptitude) / budget) * 1000) / 1000;
  }

  // The player's own clock for a whole village: raising every one of these
  // buildings once, one crew, back to back, with the materials already in hand.
  // This should come out at exactly four hours — a test pins it.
  function playerVillageBudgetMs(buildings) {
    var list = Array.isArray(buildings) ? buildings : [];
    var minutes = 0;
    list.forEach(function (b) { minutes += Math.max(0, num(b && b.buildMinutes, 0)); });
    return Math.round(minutes * MS_PER_MINUTE);
  }

  // ---------------------------------------------------------------------------
  // The programme
  // ---------------------------------------------------------------------------
  // The manager works the village list top to bottom, and it raises EVERY
  // building once before it upgrades any of them: a village with a roof, a
  // larder, a well and a woodpile beats one perfect cottage. Only when the
  // whole village stands does it start round two.
  //
  // rows: [{ id, level, maxLevel, buildable, rising }]
  //   level     — what stands now (a site already rising counts as done)
  //   buildable — false while a building is gated: town-tier work in a lone
  //               village, or a hall the trainer has not unlocked yet
  //   rising    — a crew is on it already, so the manager looks past it
  function nextManagerStep(rows) {
    var list = (Array.isArray(rows) ? rows : []).filter(function (row) {
      return row && row.id != null && row.buildable !== false;
    });
    var ceiling = 0;
    list.forEach(function (row) { ceiling = Math.max(ceiling, Math.max(1, Math.floor(num(row.maxLevel, 1)))); });
    for (var pass = 0; pass < ceiling; pass += 1) {
      for (var i = 0; i < list.length; i += 1) {
        var row = list[i];
        if (row.rising) continue;
        var level = Math.max(0, Math.floor(num(row.level, 0)));
        var max = Math.max(1, Math.floor(num(row.maxLevel, 1)));
        if (level !== pass || level >= max) continue;
        return { id: String(row.id), level: level };
      }
    }
    return null;
  }

  // Where the village has got to, and when it will stand. "Built" means every
  // building it is allowed to raise is up — upgrades come after, and are not
  // counted here, because the six-hour promise is about the village existing.
  //
  // rows carry `minutes` (the player's own clock for that first level) and,
  // for the one site under way, `risingMsLeft`.
  function villageRaiseOutlook(rows, buildFactor, options) {
    var opts = options && typeof options === 'object' ? options : {};
    var factor = Math.max(0, num(buildFactor, 1));
    var list = (Array.isArray(rows) ? rows : []).filter(function (row) {
      return row && row.id != null && row.buildable !== false;
    });
    var total = list.length;
    var raised = 0;
    var pendingMs = 0;
    list.forEach(function (row) {
      if (Math.floor(num(row.level, 0)) > 0) { raised += 1; return; }
      var left = num(row.risingMsLeft, NaN);
      if (isFinite(left)) { pendingMs += Math.max(0, left); return; }
      pendingMs += Math.max(0, num(row.minutes, 0)) * MS_PER_MINUTE * factor;
    });
    return {
      total: total,
      raised: raised,
      left: Math.max(0, total - raised),
      built: total > 0 && raised >= total,
      remainingMs: Math.max(0, Math.round(pendingMs)),
      // A manager with nothing to spend is not slow, it is stuck. The caller
      // passes the shortfall it found so one object answers "how is it going".
      waitingFor: opts.waitingFor || null
    };
  }

  return {
    MS_PER_HOUR: MS_PER_HOUR,
    PLAYER_VILLAGE_HOURS: PLAYER_VILLAGE_HOURS,
    MANAGER_BEST_HOURS: MANAGER_BEST_HOURS,
    MANAGER_WORST_HOURS: MANAGER_WORST_HOURS,
    managerVillageHours: managerVillageHours,
    managerVillageMs: managerVillageMs,
    managerBuildFactor: managerBuildFactor,
    playerVillageBudgetMs: playerVillageBudgetMs,
    nextManagerStep: nextManagerStep,
    villageRaiseOutlook: villageRaiseOutlook
  };
}));
