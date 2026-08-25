/* The Empire grid: one little square per holding, coloured by what it wants.
 *
 * Yaan's ask (2026-08-25, from a screenshot of the Empire screen): the
 * VILLAGES tab was a drop-down — press the count, a list unfolds, then press a
 * row. Make it a box of boxes instead. One square per village, the bird that
 * runs it painted inside, and the square's colour saying what the place needs.
 * One tap opens it. The same for Towns and for Counties.
 *
 * This module owns the reading, not the drawing: given a few plain facts about
 * one holding it names the single thing that holding wants most. It never
 * reads game globals — the caller normalises state and passes it in — so the
 * whole ladder is unit-testable in bare Node.
 */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BurbzEmpireGrid = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Below this, the folk are visibly unhappy: the same 45%-and-under band the
  // 😟 face uses on every village row, rounded to a clean half.
  var UNHAPPY_BELOW = 0.5;

  // The ladder, most urgent first. One holding says one thing — the first rung
  // that matches is the colour the square wears. Two rungs are red on purpose:
  // an empty village and a miserable one are the same emergency wearing
  // different clothes, and the player should read "go there" from the colour
  // alone before reading which of the two it is.
  var NEEDS = [
    { id: 'empty',   tone: 'red',   icon: '🏚️', label: 'Nobody lives here' },
    { id: 'unhappy', tone: 'red',   icon: '😟', label: 'Folk are unhappy' },
    { id: 'star',    tone: 'gold',  icon: '⭐',  label: 'Ready to merge' },
    { id: 'vacant',  tone: 'violet', icon: '🪧', label: 'Nobody in charge' },
    { id: 'idle',    tone: 'blue',  icon: '🔨', label: 'A crew is free' },
    { id: 'busy',    tone: 'green', icon: '🏗️', label: 'Building' },
    { id: 'well',    tone: 'green', icon: '✅', label: 'All is well' }
  ];

  var NEED_INDEX = {};
  NEEDS.forEach(function (need) { NEED_INDEX[need.id] = need; });

  // The five colours, in the order a legend should read them: worst first.
  // Violet, not amber, for the empty desk: amber sat too close to the merge
  // star's gold on a phone, and two meanings must never share a colour.
  var TONES = ['red', 'violet', 'gold', 'blue', 'green'];

  // What each colour promises, for the one-line key under the grids. Short
  // enough to sit on a phone without wrapping twice.
  var TONE_LEGEND = [
    { tone: 'red',   icon: '😟', label: 'needs you' },
    { tone: 'violet', icon: '🪧', label: 'no bird in charge' },
    { tone: 'gold',  icon: '⭐',  label: 'ready to merge' },
    { tone: 'blue',  icon: '🔨', label: 'a crew is free' },
    { tone: 'green', icon: '✅', label: 'running itself' }
  ];

  function num(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function needById(id) { return NEED_INDEX[String(id || '')] || null; }

  // The one thing this holding wants. Input is caller-normalised:
  //
  //   pop           number  — residents. 0 or fewer means nobody lives here.
  //   happiness     0..1    — weighted satisfaction, as the village ledger reads it.
  //   posted        boolean — a bird holds this holding's civic post. Pass the
  //                           boolean explicitly; only an exact `false` is read
  //                           as "the desk is empty", so a caller that has no
  //                           post to report never trips the vacant rung.
  //   freeCrews     number  — build slots standing idle right now.
  //   building      boolean — something is rising here.
  //   mergeReady    boolean — wears the ⭐ merge star.
  //   tributeReady  boolean — a whole tax cycle has piled up.
  //   postTitle     string  — what the civic post is called here, so the
  //                           vacant line can name it ("No Lord Mayor").
  //
  // Anything missing simply does not match its rung, so a tier that has no
  // crews or no merge star passes nothing and still lands somewhere honest.
  function holdingNeed(input) {
    var it = input && typeof input === 'object' ? input : {};
    var pop = num(it.pop, 0);
    var happiness = num(it.happiness, 1);
    var id;
    if (pop <= 0) id = 'empty';
    else if (happiness < UNHAPPY_BELOW) id = 'unhappy';
    else if (it.mergeReady) id = 'star';
    else if (it.posted === false) id = 'vacant';
    else if (num(it.freeCrews, 0) > 0) id = 'idle';
    else if (it.building) id = 'busy';
    else id = 'well';
    var need = NEED_INDEX[id];
    return {
      id: need.id,
      tone: need.tone,
      icon: need.icon,
      label: id === 'vacant' ? vacantLabel(it.postTitle) : need.label,
      // The coin rides alongside the colour instead of competing with it: a
      // full strongbox is worth a glance, but it is never why you walk over.
      tributeReady: !!it.tributeReady
    };
  }

  function vacantLabel(postTitle) {
    var title = String(postTitle || '').trim();
    return title ? 'No ' + title : NEED_INDEX.vacant.label;
  }

  // Does this need mean "go and do something"? Green holdings run themselves;
  // everything else is a job waiting. Drives the count beside a tier's title.
  function needWantsYou(id) {
    var need = needById(id);
    return !!need && need.tone !== 'green';
  }

  // Roll a tier's squares into one line: how many there are, and how many are
  // asking for the player. Takes the objects holdingNeed returned.
  function tierSummary(needs) {
    var list = Array.isArray(needs) ? needs.filter(Boolean) : [];
    return {
      total: list.length,
      wanting: list.filter(function (need) { return needWantsYou(need.id); }).length,
      paying: list.filter(function (need) { return !!need.tributeReady; }).length
    };
  }

  return {
    UNHAPPY_BELOW: UNHAPPY_BELOW,
    NEEDS: NEEDS,
    TONES: TONES,
    TONE_LEGEND: TONE_LEGEND,
    needById: needById,
    holdingNeed: holdingNeed,
    needWantsYou: needWantsYou,
    tierSummary: tierSummary
  };
}));
