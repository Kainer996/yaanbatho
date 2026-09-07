/* Walking quests: presentation only. Network topology and saved discoveries
   belong to walking_route_core / walking_encounter_core, never this module. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzWalkingQuestUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ART = Object.freeze({
    warden: 'assets/walking-quests/warden.webp',
    'lantern-post': 'assets/walking-quests/lantern-post.webp',
    'wayfarer-rest': 'assets/walking-quests/wayfarer-rest.webp'
  });
  const ICONS = Object.freeze({
    loop: '<path d="M18.5 7A8 8 0 1 0 20 15M18.5 7V2.5M18.5 7H14"/>',
    path: '<path d="M5 4h9a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h9M5 4l3-3M5 4l3 3M19 20l-3-3M19 20l-3 3"/>',
    pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z"/>',
    book: '<path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Zm0 0v15"/>',
    building: '<path d="m2 10 10-8 10 8M5 8v13h14V8M10 21v-7h4v7M8 10h1M15 10h1"/>',
    npc: '<path d="M7 12c-3 3-4 5-4 8h18c0-3-1-5-4-8M8 11l-2-1 2-5 4-3 4 3 2 5-2 1M9 9a3 3 0 0 0 6 0"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    leaf: '<path d="M20 3c0 10-2 16-9 16a7 7 0 0 1-7-7C4 5 10 3 20 3ZM3 21 15 9"/>'
  });

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    })[c]);
  }
  function finite(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  }
  function icon(name) {
    return '<svg class="wq-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || ICONS.compass) + '</svg>';
  }
  function distanceLabel(metres) {
    const value = finite(metres);
    if (value === null || value < 0) return 'Distance unavailable';
    return value < 1000 ? Math.round(value) + ' m' : (value / 1000).toFixed(value < 10000 ? 1 : 0) + ' km';
  }
  function routeStats(offer) {
    const route = offer || {};
    const length = finite(route.lengthM);
    const versioned = Number(route.routeSchemaVersion) === 1;
    const mode = versioned && (route.routeMode === 'loop' || route.routeMode === 'out-and-back') ? route.routeMode : 'unknown';
    const share = finite(route.pathShare);
    const start = finite(route.startDistM);
    let sourceDate = '';
    if (route.sourceTimestamp) {
      const parsed = new Date(route.sourceTimestamp);
      if (Number.isFinite(parsed.getTime())) sourceDate = parsed.toISOString().slice(0, 10);
    }
    const startDistance = start !== null && start >= 0 ? distanceLabel(start) + ' away · straight-line' : 'Start distance unavailable';
    return {
      mode: mode,
      lengthM: length !== null && length > 0 ? length : null,
      distance: length !== null && length > 0 ? distanceLabel(length) : 'Distance unavailable',
      durationMin: length !== null && length > 0 ? Math.max(1, Math.round(length / 75)) : null,
      modeLabel: mode === 'loop' ? 'Genuine loop' : mode === 'out-and-back' ? 'Out & back' : 'Route awaiting review',
      modeNote: mode === 'loop' ? (route.viaSpur ? 'Returns to the start; a connecting path is retraced.' : 'Returns to the start on a connected walking route.') : mode === 'out-and-back' ? 'Retrace the same path to return to the start.' : 'Route shape has not been checked.',
      pathPercent: share !== null && share >= 0 && share <= 1 ? Math.round(share * 100) : null,
      startDistance: startDistance,
      startLabel: startDistance,
      source: typeof route.source === 'string' ? route.source : '',
      sourceDate: sourceDate,
      fallbackReason: mode === 'out-and-back' && typeof route.fallbackReason === 'string' ? route.fallbackReason : '',
      warnings: Array.isArray(route.warnings) ? route.warnings.filter(w => typeof w === 'string' && w.trim()).slice(0, 6) : []
    };
  }
  function metric(iconName, value, label) {
    return '<span class="wq-metric">' + icon(iconName) + '<span><strong>' + escapeHtml(value) + '</strong><span>' + escapeHtml(label) + '</span></span></span>';
  }
  function metrics(stats) {
    return '<span class="wq-route-metrics">' +
      metric('path', stats.distance, 'complete walk') +
      metric('clock', stats.durationMin === null ? '—' : '~' + stats.durationMin + ' min', 'walking time') +
      metric('leaf', stats.pathPercent === null ? 'Unknown' : stats.pathPercent + '%', 'mapped footpaths') + '</span>';
  }
  function routeFacts(offer, options) {
    const stats = routeStats(offer);
    const opts = options || {};
    const source = stats.source ? '<span>Route data: ' + escapeHtml(stats.source) + (stats.sourceDate ? ' · ' + escapeHtml(stats.sourceDate) : '') + '.</span> ' : '';
    const fallback = stats.fallbackReason ? '<p>' + escapeHtml(stats.fallbackReason) + '</p>' : '';
    const warnings = stats.warnings.length ? '<ul class="wq-route-warnings">' + stats.warnings.map(w => '<li>' + escapeHtml(w) + '</li>').join('') + '</ul>' : '';
    return '<div class="wq-route-facts' + (opts.compact ? ' is-compact' : '') + '">' + metrics(stats) +
      '<div class="wq-route-shape">' + icon(stats.mode === 'loop' ? 'loop' : 'path') + '<span><strong>' + escapeHtml(stats.modeLabel) + '</strong> · ' + escapeHtml(stats.modeNote) + '</span></div>' +
      '<div class="wq-route-start">' + icon('pin') + '<span>Start: ' + escapeHtml(stats.startDistance) + '</span></div>' +
      (!opts.compact ? '<details class="wq-route-details"><summary>About this route</summary><div>' + fallback + source + 'Walking time is an estimate at 4.5 km/h, excluding stops and travel to the start. Map access and conditions can change; follow signs.' + warnings + '</div></details>' : '') + '</div>';
  }
  function offerCard(offer, index, options) {
    const route = offer || {};
    const opts = options || {};
    const stats = routeStats(route);
    const i = Math.max(0, Math.floor(finite(index) || 0));
    const name = route.name || 'Nearby walking route';
    return '<button type="button" class="walk-quest-offer wq-offer-card' + (opts.selected ? ' is-selected' : '') + '" data-quest-offer="' + i + '"' + (opts.selected ? ' aria-current="true"' : '') + '>' +
      '<span class="wq-offer-top"><span class="wq-offer-emblem">' + icon(stats.mode === 'loop' ? 'loop' : 'path') + '</span><span class="wq-offer-heading"><span class="wq-eyebrow">' + escapeHtml(stats.modeLabel) + '</span><span class="wq-offer-name">' + escapeHtml(name) + '</span></span><span class="wq-offer-arrow">' + icon('arrow') + '</span></span>' +
      metrics(stats) + '<span class="wq-offer-start">' + icon('pin') + '<span>' + escapeHtml(stats.startDistance) + '</span></span>' +
      (stats.mode === 'out-and-back' ? '<span class="wq-offer-note">Retrace the same path on the return leg.</span>' : route.viaSpur ? '<span class="wq-offer-note">Loop includes a retraced connecting path.</span>' : '') +
      (opts.encounters && opts.encounters.length ? encounterCards(opts.encounters, { compact:true }) : '') + '</button>';
  }
  function encounterArt(encounter) {
    const e = encounter || {};
    // Saved and map-fed strings cannot introduce a remote URL or markup.
    return ART[e.artKey] || Object.values(ART).find(path => path === e.artPath) || ART[e.kind === 'npc' ? 'warden' : 'lantern-post'];
  }
  function checkpointText(encounter) {
    const checkpoint = finite(encounter && encounter.checkpointIndex);
    return checkpoint !== null && checkpoint >= 0 ? 'Checkpoint ' + (Math.floor(checkpoint) + 1) : 'Along your route';
  }
  function encounterCards(encounters, options) {
    const opts = options || {};
    const rows = (Array.isArray(encounters) ? encounters : []).filter(e => e && typeof e === 'object');
    if (!rows.length) return '';
    const compact = !!opts.compact;
    return '<' + (compact ? 'span' : 'div') + ' class="wq-encounters' + (compact ? ' is-compact' : '') + '">' + rows.map(e => {
      const discovered = !!(e.discovered || e.visited);
      const interactive = opts.interactive !== false && (!compact || opts.interactive === true);
      const tag = interactive ? 'button' : 'span';
      const status = discovered ? (e.choiceId ? 'Remembered' : 'Discovered') : checkpointText(e);
      return '<' + tag + (interactive ? ' type="button" data-encounter-id="' + escapeHtml(e.id) + '"' : '') + ' class="wq-encounter-card' + (discovered ? ' is-discovered' : '') + '">' +
        '<span class="wq-encounter-art"><img src="' + encounterArt(e) + '" alt="" width="96" height="96" loading="lazy" decoding="async"></span>' +
        '<span class="wq-encounter-copy"><span class="wq-encounter-status">' + (discovered ? icon('check') : icon(e.kind === 'npc' ? 'npc' : 'building')) + escapeHtml(status) + '</span><strong>' + escapeHtml(e.name || 'Trail encounter') + '</strong>' +
        '<span class="wq-encounter-fiction">Fictional encounter</span>' +
        (!compact ? '<span class="wq-encounter-role">' + escapeHtml(e.role || 'Alderwing encounter') + '</span><span class="wq-encounter-lore">' + escapeHtml(discovered ? e.lore || '' : 'A story waiting at this route checkpoint.') + '</span>' + (discovered && e.choiceId && e.outcome ? '<span class="wq-encounter-outcome">' + escapeHtml(e.outcome) + '</span>' : '') : '') + '</span>' +
        (interactive ? '<span class="wq-encounter-arrow">' + icon('arrow') + '</span>' : '') + '</' + tag + '>';
    }).join('') + '</' + (compact ? 'span' : 'div') + '>';
  }
  function encounterDialog(encounter, options) {
    const e = encounter || {};
    const opts = options || {};
    const discovered = !!(e.discovered || e.visited);
    const suppliedChoices = Array.isArray(opts.choices) ? opts.choices : e.choices;
    const choices = discovered && !e.choiceId && Array.isArray(suppliedChoices) ? suppliedChoices.filter(choice => choice && typeof choice === 'object') : [];
    return '<div class="wq-npc-panel wq-discovery-panel' + (opts.embedded ? ' is-embedded' : '') + '">' + (!opts.embedded ? '<button type="button" class="wq-close" data-wq-close aria-label="Close encounter">' + icon('close') + '</button>' : '') +
      '<div class="wq-discovery-art"><img src="' + encounterArt(e) + '" alt="" width="240" height="240" decoding="async"></div>' +
      '<div class="wq-discovery-content"><div class="wq-eyebrow">' + (discovered ? 'Alderwing discovery' : checkpointText(e)) + '</div>' +
      '<h2 class="wq-discovery-title" data-wq-initial-focus tabindex="-1">' + escapeHtml(e.name || 'Trail encounter') + '</h2><p class="wq-discovery-role">' + escapeHtml(e.role || '') + '</p>' +
      '<p class="wq-discovery-lore">' + escapeHtml(discovered ? e.lore || '' : 'Follow your walking route to this checkpoint to discover its story.') + '</p>' +
      '<p class="wq-fiction-note">' + icon('book') + '<span>A fictional Alderwing encounter on your walking route. This is not a real-world building or person.</span></p>' +
      (choices.length ? '<p class="wq-discovery-prompt">' + escapeHtml(e.prompt || 'Leave your mark on this story.') + '</p><div class="wq-encounter-choices">' + choices.map(choice => '<button type="button" class="wq-choice" data-encounter-id="' + escapeHtml(e.id) + '" data-encounter-choice="' + escapeHtml(choice.id) + '">' + escapeHtml(choice.label || choice.text || choice.id) + '</button>').join('') + '</div>' : '') +
      (e.choiceId ? '<p class="wq-discovery-outcome">' + escapeHtml(e.outcome || '') + '</p><p class="wq-choice-saved">' + icon('check') + '<span>Remembered in your trail journal.</span></p>' : '') +
      (!opts.embedded ? '<button type="button" class="wq-primary" data-wq-close>Back to the walk</button>' : '') + '</div></div>';
  }
  function journal(encounters) {
    const rows = (Array.isArray(encounters) ? encounters : []).filter(e => e && (e.discovered || e.visited));
    return '<section class="wq-journal"><div class="wq-section-head">' + icon('book') + '<h3>Trail journal</h3><span>' + rows.length + ' discovered</span></div><p class="wq-fiction-note">Fictional people and places from Alderwing, discovered on your real walks.</p>' +
      (rows.length ? encounterCards(rows, { interactive:false }) : '<p class="wq-empty-copy">Your first trail story is still ahead. Reach a marked checkpoint to meet the people of Alderwing.</p>') + '</section>';
  }
  function emptyState(reason) {
    const message = reason === 'data-incomplete' ? 'The walking map is incomplete here. We could not verify a useful connected route.' : 'No useful public-footpath walk was found nearby. Try another starting area or return when more paths are mapped.';
    return '<div class="wq-empty">' + icon('compass') + '<h3>No suitable walk yet</h3><p>' + message + '</p><p class="wq-empty-copy">A short street fragment will not be offered as a walking adventure.</p></div>';
  }
  function bindDialog(el, onClose) {
    if (!el || !el.ownerDocument) return function () {};
    const doc = el.ownerDocument;
    const opener = doc.activeElement;
    let active = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    if ((!el.hasAttribute('aria-label') || el.hasAttribute('data-wq-generated-label')) && !el.hasAttribute('aria-labelledby')) {
      const title = el.querySelector('h1,h2,h3,.quest-name,.quest-board-title,.wq-npc-name');
      el.setAttribute('aria-label', title ? title.textContent : 'Walking quest');
      el.setAttribute('data-wq-generated-label', '');
    }
    const focusables = () => Array.from(el.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')).filter(node => !node.closest('[hidden],[inert]') && node.getClientRects().length > 0);
    function cleanup() {
      if (!active) return;
      active = false;
      el.removeEventListener('keydown', keydown);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll:true });
    }
    function keydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onClose === 'function') onClose();
        cleanup();
      } else if (event.key === 'Tab') {
        const nodes = focusables();
        if (!nodes.length) { event.preventDefault(); el.focus(); return; }
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (doc.activeElement === first || !nodes.includes(doc.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (doc.activeElement === last || !el.contains(doc.activeElement))) { event.preventDefault(); first.focus(); }
      }
    }
    el.addEventListener('keydown', keydown);
    const start = el.querySelector('[data-wq-initial-focus]') || focusables()[0] || el;
    if (start === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    start.focus({ preventScroll:true });
    return cleanup;
  }

  return Object.freeze({ escapeHtml, icon, distanceLabel, routeStats, routeFacts, offerCard, encounterArt, encounterCards, encounterDialog, journal, emptyState, bindDialog });
});
