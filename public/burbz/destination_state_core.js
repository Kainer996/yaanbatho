/* Destination state core: versioned destination walk plans, review lifecycle,
 * receipts and canonical adapter transactions. This module does not render UI
 * or save by itself; callers provide narrow save/economy/unlock adapters.
 */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDestinationStateCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  const VERSION = 1;
  const STATE_VERSION = 1;
  const RECORD_KIND = 'destination-quest';
  const PHASES = Object.freeze({
    PLANNED: 'planned',
    ACTIVE: 'active',
    REVIEW: 'review',
    COMPLETED: 'completed'
  });
  const DEFAULT_FRACTIONS = Object.freeze({
    building: [0.22, 0.58, 0.82],
    character: [0.36, 0.72, 0.9],
    bird: [0.18, 0.48, 0.78, 0.92]
  });

  function tryRequire(path) {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  }
  function routeApi() {
    return root && root.BurbzDestinationRouteCore || tryRequire('./destination_route_core.js');
  }
  function rewardApi() {
    return root && root.BurbzDestinationRewardCore || tryRequire('./destination_reward_core.js');
  }
  function areaBirdApi() {
    return root && root.BurbzAreaBirdsCore || tryRequire('./area_birds_core.js');
  }
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }
  function number(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function positiveInteger(value, fallback) {
    const n = Math.floor(number(value, fallback));
    return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
  }
  function speciesKey(name) {
    return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }
  function iso(value) {
    const d = new Date(number(value, Date.now()));
    return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
  }
  function text(value) {
    return String(value == null ? '' : value).trim();
  }
  function fail(code, message, extra) {
    return { ok: false, error: Object.assign({ code, message: message || code }, extra || {}) };
  }
  function ok(value) {
    return Object.assign({ ok: true }, value || {});
  }
  function hashString(value) {
    let h = 2166136261;
    const s = String(value || '');
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }
  function stableId(prefix, parts) {
    return prefix + '-' + hashString((parts || []).map(part => {
      if (part == null) return '';
      if (typeof part === 'object') return JSON.stringify(part);
      return String(part);
    }).join('|'));
  }
  function point(value) {
    return {
      lat: Number(value && value.lat),
      lon: Number(value && value.lon)
    };
  }
  function validPoint(value) {
    const p = point(value);
    return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  }
  function distance(a, b) {
    const api = routeApi();
    if (api && typeof api.distance === 'function') return api.distance(a, b);
    a = point(a); b = point(b);
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r;
    const dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function restoreTree(target, source) {
    if (!target || !source || typeof target !== 'object' || typeof source !== 'object' || Array.isArray(target) !== Array.isArray(source)) return clone(source);
    if (Array.isArray(target)) {
      target.length = source.length;
      for (let i = 0; i < source.length; i++) target[i] = restoreTree(target[i], source[i]);
      return target;
    }
    Object.keys(target).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(source, key)) delete target[key];
    });
    Object.keys(source).forEach(key => {
      target[key] = restoreTree(target[key], source[key]);
    });
    return target;
  }
  function captureLiveRefs(rootState) {
    const destination = rootState && rootState.destinationQuests;
    return {
      destination,
      active: destination && destination.active,
      archive: destination && destination.archive,
      meetings: destination && destination.meetings,
      receipts: destination && destination.receipts,
      previews: destination && destination.previews
    };
  }
  function restoreLiveRefs(rootState, refs) {
    if (!refs || !refs.destination || !rootState || !rootState.destinationQuests) return;
    if (rootState.destinationQuests !== refs.destination) {
      restoreTree(refs.destination, rootState.destinationQuests);
      rootState.destinationQuests = refs.destination;
    }
    const destination = rootState.destinationQuests;
    if (refs.active && destination.active && destination.active !== refs.active) {
      restoreTree(refs.active, destination.active);
      destination.active = refs.active;
    }
    if (refs.archive && destination.archive && destination.archive !== refs.archive) {
      restoreTree(refs.archive, destination.archive);
      destination.archive = refs.archive;
    }
    if (refs.meetings && destination.meetings && destination.meetings !== refs.meetings) {
      restoreTree(refs.meetings, destination.meetings);
      destination.meetings = refs.meetings;
    }
    if (refs.receipts && destination.receipts && destination.receipts !== refs.receipts) {
      restoreTree(refs.receipts, destination.receipts);
      destination.receipts = refs.receipts;
    }
    if (refs.previews && destination.previews && destination.previews !== refs.previews) {
      restoreTree(refs.previews, destination.previews);
      destination.previews = refs.previews;
    }
  }

  function validateRoute(route, opts) {
    const api = opts && opts.routeCore || routeApi();
    if (!api || typeof api.validateDestinationRoute !== 'function') return fail('route-core-unavailable', 'Destination route validation is unavailable.');
    const result = api.validateDestinationRoute(route);
    if (!result || !result.valid) return fail('invalid-route', 'Destination route is not certified.', { reason: result && result.reason });
    return ok({ validation: result });
  }
  function normalizeQuote(quote, opts) {
    const api = opts && opts.rewardCore || rewardApi();
    if (!api || typeof api.deserializeQuote !== 'function') return fail('reward-core-unavailable', 'Destination reward quote validation is unavailable.');
    try {
      const normalized = api.deserializeQuote(clone(quote));
      if (!Number.isSafeInteger(normalized.xp) || !Number.isSafeInteger(normalized.coins) || !Array.isArray(normalized.loot)) {
        return fail('invalid-quote', 'Destination reward quote is incomplete.');
      }
      return ok({ quote: normalized });
    } catch (error) {
      return fail('invalid-quote', 'Destination reward quote is not serializable.', { error: error && error.message });
    }
  }
  function routeLength(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
    return total;
  }
  function interpolate(a, b, t) {
    a = point(a); b = point(b);
    return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
  }
  function routePointAtFraction(route, fraction) {
    const points = (route && route.points || []).map(point).filter(validPoint);
    if (points.length < 2) return null;
    const total = Math.max(0, number(route.lengthM, 0)) || routeLength(points);
    const target = Math.max(0, Math.min(1, number(fraction, 0))) * total;
    let walked = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const len = distance(a, b);
      if (walked + len >= target || i === points.length - 1) {
        const t = len ? Math.max(0, Math.min(1, (target - walked) / len)) : 0;
        const p = interpolate(a, b, t);
        return {
          lat: Math.round(p.lat * 1e7) / 1e7,
          lon: Math.round(p.lon * 1e7) / 1e7,
          fraction: Math.round((total ? (walked + len * t) / total : 0) * 1000000) / 1000000,
          distanceM: Math.round((walked + len * t) * 100) / 100,
          sourceSegment: {
            index: i - 1,
            fromDistanceM: Math.round(walked * 100) / 100,
            toDistanceM: Math.round((walked + len) * 100) / 100,
            segmentDistanceM: Math.round(len * 100) / 100,
            from: { lat: a.lat, lon: a.lon },
            to: { lat: b.lat, lon: b.lon }
          }
        };
      }
      walked += len;
    }
    return null;
  }

  function meaningfulBuilding(item) {
    return !!(item && text(item.id) && text(item.label || item.name) && item.meaningful === true &&
      item.nativeAction && text(item.nativeAction.adapter) && text(item.nativeAction.method));
  }
  function meaningfulCharacter(item) {
    return !!(item && text(item.id) && text(item.name || item.label) && item.meaningful === true &&
      Array.isArray(item.dialogue) && item.dialogue.some(line => text(line)) &&
      item.nativeAction && text(item.nativeAction.adapter) && text(item.nativeAction.method));
  }
  function normalizedBuildings(content) {
    return (Array.isArray(content && content.buildings) ? content.buildings : []).filter(meaningfulBuilding).map(item => ({
      id: text(item.id),
      label: text(item.label || item.name),
      nativeAction: clone(item.nativeAction),
      source: text(item.source || content.source || 'provided-content')
    }));
  }
  function normalizedCharacters(content) {
    return (Array.isArray(content && content.characters) ? content.characters : []).filter(meaningfulCharacter).map(item => ({
      id: text(item.id),
      name: text(item.name || item.label),
      dialogue: item.dialogue.map(text).filter(Boolean),
      nativeAction: clone(item.nativeAction),
      source: text(item.source || content.source || 'provided-content')
    }));
  }
  function buildCommonBirdPool(input) {
    input = input || {};
    const catalogue = Array.isArray(input.catalogue) ? input.catalogue : [];
    const core = input.areaBirdsCore || areaBirdApi();
    let ranked = [];
    let source = 'provided-catalogue';
    if (core && typeof core.rank === 'function') {
      ranked = core.rank(catalogue, input.context || {}, input.evidence || null, 'likely', '');
      source = 'BurbzAreaBirdsCore.rank';
    } else {
      ranked = catalogue.slice();
    }
    const seen = new Set();
    const pool = [];
    for (const raw of ranked) {
      const name = text(raw.commonName || raw.name || raw.species || raw.canonical || raw.scientific);
      const scientificName = text(raw.scientificName || raw.scientific || raw.canonical || '');
      const key = speciesKey(name || scientificName);
      const rarity = text(raw.rarity || 'common').toLowerCase() || 'common';
      if (!key || seen.has(key) || rarity !== 'common' || raw.excluded) continue;
      seen.add(key);
      pool.push({
        key,
        species: name || scientificName,
        commonName: name || scientificName,
        scientificName,
        rarity: 'common',
        habitatMatches: Array.isArray(raw.matched) ? raw.matched.slice() : [],
        habitats: Array.isArray(raw.habitats) ? raw.habitats.slice() : [],
        source
      });
    }
    return { source, birds: pool };
  }
  function fractionFor(kind, index, total) {
    const defaults = DEFAULT_FRACTIONS[kind] || [0.5];
    if (index < defaults.length) return defaults[index];
    return Math.max(0.05, Math.min(0.95, (index + 1) / (total + 1)));
  }
  function makeEntry(recordId, route, kind, item, index, total, fractionOverride) {
    const fraction = Number.isFinite(Number(fractionOverride)) ? Math.max(0, Math.min(1, Number(fractionOverride))) : fractionFor(kind, index, total);
    const spot = routePointAtFraction(route, fraction);
    if (!spot) return null;
    const idBase = [recordId, kind, item.id || item.key || item.species, index, route.routeFingerprint, spot.distanceM.toFixed(2)];
    const entry = {
      id: stableId('dqe', idBase),
      schemaVersion: VERSION,
      kind,
      route: Object.assign({
        routeFingerprint: route.routeFingerprint
      }, spot),
      generatedGameEncounter: true,
      observedRealWorld: false,
      receiptId: null,
      outcome: null,
      source: item.source || null
    };
    if (kind === 'building') {
      entry.buildingId = item.id;
      entry.label = item.label;
      entry.nativeAction = clone(item.nativeAction);
    } else if (kind === 'character') {
      entry.characterId = item.id;
      entry.name = item.name;
      entry.dialogue = item.dialogue.slice();
      entry.nativeAction = clone(item.nativeAction);
    } else if (kind === 'bird') {
      entry.speciesKey = item.key;
      entry.species = item.commonName || item.species;
      entry.commonName = item.commonName || item.species;
      entry.scientificName = item.scientificName || '';
      entry.rarity = 'common';
      entry.nativeAction = {
        adapter: 'destinationBirdMeeting',
        method: 'meetCommonSpecies',
        payload: {
          species: entry.species,
          speciesKey: entry.speciesKey,
          observedRealWorld: false,
          generatedGameEncounter: true
        }
      };
    }
    return entry;
  }
  function selectedBirds(pool, count) {
    if (!pool.length) return [];
    const n = Math.max(1, Math.min(6, positiveInteger(count, 1)));
    const top = pool[0];
    const birds = [];
    for (let i = 0; i < n; i++) birds.push(Object.assign({}, top, { meetingIndex: i + 1 }));
    return birds;
  }

  function buildDestinationRecord(input) {
    input = input || {};
    const routeCheck = validateRoute(input.route, input);
    if (!routeCheck.ok) return routeCheck;
    const quoteCheck = normalizeQuote(input.quote, input);
    if (!quoteCheck.ok) return quoteCheck;
    const content = input.content || {};
    const buildings = normalizedBuildings(content);
    const characters = normalizedCharacters(content);
    if (!buildings.length) return fail('missing-building-content', 'Destination plan needs at least one meaningful route-linked building action.');
    if (!characters.length) return fail('missing-character-content', 'Destination plan needs at least one meaningful route-linked character action.');
    const birdPool = buildCommonBirdPool(input);
    if (!birdPool.birds.length) return fail('missing-common-bird-content', 'Destination plan needs at least one common bird from the catalogue/habitat pool.');

    const now = number(input.now, Date.now());
    const route = clone(input.route);
    const recordId = stableId('dq', [input.idSeed || '', route.routeFingerprint, quoteCheck.quote.xp, quoteCheck.quote.coins, now]);
    const chosenBirds = selectedBirds(birdPool.birds, input.commonBirdCount);
    let entries = [];
    buildings.slice(0, Math.max(1, positiveInteger(input.buildingCount, 1))).forEach((item, index, list) => {
      entries.push(makeEntry(recordId, route, 'building', item, index, list.length, item.fraction));
    });
    characters.slice(0, Math.max(1, positiveInteger(input.characterCount, 1))).forEach((item, index, list) => {
      entries.push(makeEntry(recordId, route, 'character', item, index, list.length, item.fraction));
    });
    chosenBirds.forEach((item, index, list) => {
      entries.push(makeEntry(recordId, route, 'bird', item, index, list.length, item.fraction));
    });
    entries = entries.filter(Boolean).sort((a, b) => a.route.distanceM - b.route.distanceM || a.id.localeCompare(b.id));
    entries.forEach((entry, index) => { entry.order = index + 1; });
    const counts = entries.reduce((acc, entry) => {
      acc[entry.kind] = (acc[entry.kind] || 0) + 1;
      return acc;
    }, {});
    if (!counts.building || !counts.character || !counts.bird) return fail('incomplete-plan', 'Destination plan did not produce every required content category.');
    return ok({
      record: {
        schemaVersion: VERSION,
        stateVersion: STATE_VERSION,
        kind: RECORD_KIND,
        id: recordId,
        phase: PHASES.PLANNED,
        route,
        routeFingerprint: route.routeFingerprint,
        quote: quoteCheck.quote,
        entries,
        receipts: {
          begin: null,
          finish: null,
          final: null,
          encounters: {}
        },
        contentSources: {
          route: 'BurbzDestinationRouteCore.validateDestinationRoute',
          quote: 'BurbzDestinationRewardCore.deserializeQuote',
          buildings: text(content.source || buildings[0].source || 'provided-content'),
          characters: text(content.source || characters[0].source || 'provided-content'),
          commonBirdPool: birdPool.source
        },
        createdAt: iso(now),
        updatedAt: iso(now),
        generatedGameEncounter: true,
        observedRealWorld: false
      }
    });
  }

  function emptyDestinationState() {
    return {
      version: STATE_VERSION,
      active: null,
      archive: [],
      previews: {},
      currentPreviewId: null,
      meetings: {},
      receipts: {},
      loadErrors: []
    };
  }
  function validEntry(entry) {
    return !!(entry && entry.schemaVersion === VERSION && text(entry.id) && ['building', 'character', 'bird'].includes(entry.kind) &&
      entry.route && Number.isFinite(Number(entry.route.distanceM)) && entry.route.sourceSegment &&
      entry.generatedGameEncounter === true && entry.observedRealWorld === false);
  }
  function validRecord(record) {
    if (!record || record.schemaVersion !== VERSION || record.kind !== RECORD_KIND || !text(record.id)) return false;
    if (!Object.values(PHASES).includes(record.phase)) return false;
    if (!record.route || !Array.isArray(record.entries) || !record.entries.length || !record.quote) return false;
    if (!record.entries.every(validEntry)) return false;
    const counts = record.entries.reduce((acc, entry) => (acc[entry.kind] = (acc[entry.kind] || 0) + 1, acc), {});
    return !!(counts.building && counts.character && counts.bird);
  }
  function sanitizeRecord(record, errors, label) {
    if (!validRecord(record)) {
      errors.push((label || 'record') + ':invalid-record');
      return null;
    }
    const clean = clone(record);
    clean.receipts = clean.receipts && typeof clean.receipts === 'object' && !Array.isArray(clean.receipts) ? clean.receipts : {};
    clean.receipts.encounters = clean.receipts.encounters && typeof clean.receipts.encounters === 'object' && !Array.isArray(clean.receipts.encounters) ? clean.receipts.encounters : {};
    clean.entries = clean.entries.slice().sort((a, b) => a.order - b.order || a.route.distanceM - b.route.distanceM || a.id.localeCompare(b.id));
    return clean;
  }
  function sanitizeMeeting(raw) {
    const species = text(raw && raw.species);
    const key = speciesKey(raw && (raw.speciesKey || raw.species));
    if (!key || !species) return null;
    const ids = [];
    for (const id of Array.isArray(raw.encounterIds) ? raw.encounterIds : []) {
      const value = text(id);
      if (value && !ids.includes(value)) ids.push(value);
    }
    return {
      schemaVersion: VERSION,
      speciesKey: key,
      species,
      encounterIds: ids,
      count: ids.length,
      unlockedAt: raw.unlockedAt || null,
      lastAt: raw.lastAt || null
    };
  }
  function sanitizeDestinationState(raw) {
    const out = emptyDestinationState();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    out.version = STATE_VERSION;
    const errors = out.loadErrors;
    out.active = raw.active ? sanitizeRecord(raw.active, errors, 'active') : null;
    if (Array.isArray(raw.archive)) {
      out.archive = raw.archive.map((record, index) => sanitizeRecord(record, errors, 'archive[' + index + ']')).filter(Boolean);
    } else if (raw.archive != null) errors.push('archive:invalid');
    if (raw.meetings && typeof raw.meetings === 'object' && !Array.isArray(raw.meetings)) {
      for (const [key, value] of Object.entries(raw.meetings)) {
        const meeting = sanitizeMeeting(value);
        if (meeting) out.meetings[key] = meeting;
        else errors.push('meeting:' + key + ':invalid');
      }
    } else if (raw.meetings != null) errors.push('meetings:invalid');
    if (raw.receipts && typeof raw.receipts === 'object' && !Array.isArray(raw.receipts)) out.receipts = clone(raw.receipts);
    else if (raw.receipts != null) errors.push('receipts:invalid');
    if (raw.previews && typeof raw.previews === 'object' && !Array.isArray(raw.previews)) {
      out.previews = clone(raw.previews);
      out.currentPreviewId = raw.currentPreviewId && out.previews[raw.currentPreviewId] ? raw.currentPreviewId : null;
    } else if (raw.previews != null) errors.push('previews:invalid');
    return out;
  }
  function validObject(value) {
    return !!(value && typeof value === 'object' && !Array.isArray(value));
  }
  function usableMeeting(raw) {
    if (!validObject(raw)) return false;
    const key = speciesKey(raw.speciesKey || raw.species);
    return raw.schemaVersion === VERSION && !!key && !!text(raw.species) &&
      Array.isArray(raw.encounterIds) && raw.encounterIds.every(id => !!text(id)) &&
      positiveInteger(raw.count, -1) === raw.encounterIds.length;
  }
  function usableDestinationState(raw) {
    if (!validObject(raw) || raw.version !== STATE_VERSION) return false;
    if (raw.active != null && !validRecord(raw.active)) return false;
    if (!Array.isArray(raw.archive) || !raw.archive.every(validRecord)) return false;
    if (!validObject(raw.meetings) || Object.values(raw.meetings).some(meeting => !usableMeeting(meeting))) return false;
    if (!validObject(raw.receipts) || !validObject(raw.previews)) return false;
    if (raw.currentPreviewId != null && !raw.previews[raw.currentPreviewId]) return false;
    return true;
  }
  function readDestinationState(rootState) {
    const raw = rootState && rootState.destinationQuests;
    return usableDestinationState(raw) ? raw : sanitizeDestinationState(raw);
  }
  function ensureDestinationState(rootState) {
    const raw = rootState && rootState.destinationQuests;
    if (usableDestinationState(raw)) return raw;
    const current = sanitizeDestinationState(raw);
    rootState.destinationQuests = current;
    return current;
  }

  function adapterProfile(rootState, adapter) {
    return adapter && typeof adapter.getProfileId === 'function' ? adapter.getProfileId(rootState) : rootState && rootState.profileId;
  }
  function adapterRevision(rootState, adapter) {
    return adapter && typeof adapter.getRevision === 'function' ? adapter.getRevision(rootState) : rootState && rootState.revision;
  }
  function checkGuard(rootState, adapter, guard) {
    guard = guard || {};
    if (guard.expectedProfileId != null && adapterProfile(rootState, adapter) !== guard.expectedProfileId) return 'stale-profile';
    if (guard.expectedRevision != null && adapterRevision(rootState, adapter) !== guard.expectedRevision) return 'stale-revision';
    return null;
  }
  function snapshot(rootState, adapter) {
    return adapter && typeof adapter.snapshot === 'function' ? adapter.snapshot(rootState) : clone(rootState);
  }
  function restore(rootState, adapter, before) {
    if (adapter && typeof adapter.restore === 'function') return adapter.restore(rootState, before);
    return restoreTree(rootState, before);
  }
  function persist(rootState, adapter) {
    if (!adapter || typeof adapter.persist !== 'function') return { ok: true };
    return adapter.persist(rootState);
  }
  function runTransaction(rootState, adapter, guard, apply) {
    const stale = checkGuard(rootState, adapter, guard);
    if (stale) return { status: stale };
    const before = snapshot(rootState, adapter);
    const refs = captureLiveRefs(rootState);
    try {
      if (adapter && typeof adapter.beginDeferredEffects === 'function') adapter.beginDeferredEffects(rootState);
      const value = apply();
      const saved = persist(rootState, adapter);
      if (saved === false || saved && saved.ok === false) throw saved && saved.error || new Error('Destination save failed');
      if (adapter && typeof adapter.commitDeferredEffects === 'function') {
        try { adapter.commitDeferredEffects(rootState); } catch (_) {}
      }
      return { status: 'committed', value };
    } catch (error) {
      restore(rootState, adapter, before);
      restoreLiveRefs(rootState, refs);
      if (adapter && typeof adapter.discardDeferredEffects === 'function') {
        try { adapter.discardDeferredEffects(rootState); } catch (_) {}
      }
      return { status: 'failed', error };
    }
  }
  function receiptKey(type, id) {
    return 'destination:' + type + ':' + id;
  }
  function stageDestinationPreview(rootState, record, opts) {
    opts = opts || {};
    if (!validRecord(record)) return fail('invalid-plan', 'Cannot stage an invalid destination plan.');
    const state = ensureDestinationState(rootState);
    const previewId = text(opts.previewId || stableId('dqprev', [record.id, opts.generation || 0]));
    const preview = {
      previewId,
      generation: positiveInteger(opts.generation, 0),
      record: clone(record),
      profileId: opts.profileId || rootState.profileId || null,
      revision: opts.revision != null ? opts.revision : rootState.revision,
      cancelled: false,
      stagedAt: iso(opts.now)
    };
    state.previews[previewId] = preview;
    state.currentPreviewId = previewId;
    return ok({ preview });
  }
  function cancelDestinationPreview(rootState, previewId, opts) {
    opts = opts || {};
    const state = ensureDestinationState(rootState);
    const preview = state.previews && state.previews[previewId];
    if (!preview) return fail('preview-missing', 'Destination preview is no longer available.');
    if (opts.profileId != null && preview.profileId !== opts.profileId) return fail('stale-profile', 'Destination preview belongs to another profile.');
    if (opts.revision != null && preview.revision !== opts.revision) return fail('stale-revision', 'Destination preview belongs to another save revision.');
    preview.cancelled = true;
    preview.cancelledAt = iso(opts.now);
    if (state.currentPreviewId === previewId) state.currentPreviewId = null;
    return ok({ preview });
  }
    function previewStatus(rootState, record, opts) {
      opts = opts || {};
      if (!opts.previewId) return null;
      const state = readDestinationState(rootState);
      const preview = state.previews && state.previews[opts.previewId];
      if (!preview) return 'preview-missing';
    if (preview.cancelled) return 'preview-cancelled';
    if (state.currentPreviewId !== opts.previewId || preview.record.id !== record.id) return 'preview-replaced';
    return null;
  }
  function beginDestinationQuest(rootState, record, adapter, opts) {
    opts = opts || {};
    if (!validRecord(record)) return { status: 'invalid-plan' };
    const preview = previewStatus(rootState, record, opts);
      if (preview) return { status: preview };
      const stale = checkGuard(rootState, adapter, opts);
      if (stale) return { status: stale };
      const currentState = readDestinationState(rootState);
      if (currentState.active && currentState.active.phase !== PHASES.COMPLETED) return { status: 'active-exists' };
    return runTransaction(rootState, adapter, opts, function() {
      const state = ensureDestinationState(rootState);
      const active = clone(record);
      active.phase = PHASES.ACTIVE;
      active.startedAt = iso(opts.now);
      active.updatedAt = iso(opts.now);
      active.profileId = adapterProfile(rootState, adapter) || opts.expectedProfileId || null;
      active.receipts.begin = { version: VERSION, at: iso(opts.now), routeFingerprint: active.routeFingerprint, quote: clone(active.quote) };
      state.active = active;
      state.receipts[receiptKey('begin', active.id)] = clone(active.receipts.begin);
      if (opts.previewId && state.previews[opts.previewId]) state.previews[opts.previewId].activatedAt = iso(opts.now);
      return { questId: active.id, phase: active.phase };
    });
  }
  function finishDestinationWalk(rootState, adapter, opts) {
    opts = opts || {};
    const stale = checkGuard(rootState, adapter, opts);
    if (stale) return { status: stale };
    const state = readDestinationState(rootState);
    const quest = state.active;
    if (!quest) return { status: 'no-active' };
    if (quest.phase === PHASES.REVIEW) return { status: 'duplicate' };
    if (quest.phase !== PHASES.ACTIVE) return { status: 'invalid-phase' };
    return runTransaction(rootState, adapter, opts, function() {
      const s = ensureDestinationState(rootState);
      const q = s.active;
      q.phase = PHASES.REVIEW;
      q.updatedAt = iso(opts.now);
      q.finish = {
        at: iso(opts.now),
        honorBased: true,
        gpsTicks: positiveInteger(opts.gpsTicks, 0),
        usedSuggestedTrack: !!opts.usedSuggestedTrack,
        requiresGpsArrival: false,
        requiresElapsedCheckpointProof: false,
        requiresSuggestedTrackCompliance: false
      };
      q.receipts.finish = { version: VERSION, at: q.finish.at, honorBased: true };
      s.receipts[receiptKey('finish', q.id)] = clone(q.receipts.finish);
      return { questId: q.id, phase: q.phase, entries: q.entries.map(e => e.id) };
    });
  }
  function reviewEntries(rootState) {
    const state = readDestinationState(rootState);
    const q = state.active;
    if (!q || ![PHASES.ACTIVE, PHASES.REVIEW].includes(q.phase)) return [];
    return q.entries.map(entry => Object.assign({}, clone(entry), {
      receipt: q.receipts && q.receipts.encounters && q.receipts.encounters[entry.id] || null
    }));
  }
  function advanceTime(rootState, ms) {
    const state = ensureDestinationState(rootState);
    state.lastTimeAdvanceMs = positiveInteger(state.lastTimeAdvanceMs, 0) + positiveInteger(ms, 0);
    return state.lastTimeAdvanceMs;
  }
  function findActiveEntry(rootState, entryId, mutate) {
    const state = mutate ? ensureDestinationState(rootState) : readDestinationState(rootState);
    const q = state.active;
    if (!q || ![PHASES.ACTIVE, PHASES.REVIEW].includes(q.phase)) return null;
    const entry = q.entries.find(e => e.id === entryId);
    return entry ? { state, quest: q, entry } : null;
  }
  function currentMeeting(state, entry) {
    const key = entry.speciesKey || speciesKey(entry.species || entry.commonName);
    let meeting = state.meetings[key];
    if (!meeting) {
      meeting = state.meetings[key] = {
        schemaVersion: VERSION,
        speciesKey: key,
        species: entry.species || entry.commonName,
        encounterIds: [],
        count: 0,
        unlockedAt: null,
        lastAt: null
      };
    }
    return meeting;
  }
  function applyMeeting(state, entry, adapter, now) {
    const key = entry.speciesKey || speciesKey(entry.species || entry.commonName);
    const meeting = currentMeeting(state, entry);
    const alreadyUnlocked = adapter && typeof adapter.isSpeciesUnlocked === 'function' && adapter.isSpeciesUnlocked(entry.species || entry.commonName);
    const counted = !meeting.encounterIds.includes(entry.id);
    if (counted) {
      meeting.encounterIds.push(entry.id);
      meeting.count = meeting.encounterIds.length;
      meeting.lastAt = iso(now);
    }
    let eligibleForUnlock = false;
    let unlock = null;
    if (meeting.count >= 3 && !meeting.unlockedAt && !alreadyUnlocked) {
      eligibleForUnlock = true;
      if (adapter && typeof adapter.unlockSpeciesForDestination === 'function') {
        unlock = adapter.unlockSpeciesForDestination(entry.species || entry.commonName, {
          speciesKey: key,
          encounterIds: meeting.encounterIds.slice(),
          at: iso(now),
          source: 'destination-same-species-meeting'
        });
        meeting.unlockedAt = iso(now);
      }
    }
    return {
      speciesKey: key,
      species: entry.species || entry.commonName,
      counted,
      count: meeting.count,
      encounterIds: meeting.encounterIds.slice(),
      eligibleForUnlock,
      alreadyUnlocked: !!alreadyUnlocked,
      unlock
    };
  }
  // A planned pin is not a visit. Bank only stops inside an actual fresh GPS
  // arrival circle; never infer passage from route progress or a camera pan.
  function hasMatchingDiscovery(quest, entry) {
    const discovery = quest.receipts.discoveries && quest.receipts.discoveries[entry.id];
    return !!(discovery && discovery.entryId === entry.id && discovery.lat === entry.route.lat && discovery.lon === entry.route.lon && Number.isFinite(discovery.at) && discovery.at > 0);
  }
  function encounterGate(rootState, entryId, fix, now) {
    const found = findActiveEntry(rootState, entryId, false);
    if (!found) return { ready: false, reason: 'Stop no longer available' };
    const { quest, entry } = found;
    if (quest.phase === PHASES.REVIEW) return { ready: true, reason: 'Walk review' };
    if (hasMatchingDiscovery(quest, entry))
      return { ready: true, reason: 'Discovered on your walk · revisit anywhere' };
    const core = root && root.BurbzGeographicPlacesCore || tryRequire('./geographic_places_core.js');
    return core ? core.arrival(entry.route, fix, now) : { ready: false, reason: 'Waiting for location' };
  }
  function observeDestinationEncounters(rootState, fix, adapter, opts) {
    opts = opts || {};
    const stale = checkGuard(rootState, adapter, opts);
    if (stale) return { status: stale };
    const q = readDestinationState(rootState).active;
    if (!q || q.phase !== PHASES.ACTIVE) return { status: 'unchanged' };
    const core = root && root.BurbzGeographicPlacesCore || tryRequire('./geographic_places_core.js');
    const eligible = e => !hasMatchingDiscovery(q, e) && core?.arrival(e.route, fix, opts.now).ready;
    if (!q.entries.some(eligible)) return { status: 'unchanged' };
    return runTransaction(rootState, adapter, opts, function() {
      const current = ensureDestinationState(rootState).active;
      if (!current || current.id !== q.id || current.phase !== PHASES.ACTIVE) throw new Error('Destination changed before discovery.');
      const nearby = current.entries.filter(e => !hasMatchingDiscovery(current, e) && core?.arrival(e.route, fix, opts.now).ready);
      current.receipts.discoveries = current.receipts.discoveries || {};
      nearby.forEach(e => { current.receipts.discoveries[e.id] = { entryId:e.id, lat:e.route.lat, lon:e.route.lon, at:fix.at }; });
      return { entries: nearby.map(e => e.id) };
    });
  }
  function applyDestinationEncounter(rootState, entryId, choice, adapter, opts) {
    opts = opts || {};
    choice = choice || {};
    const stale = checkGuard(rootState, adapter, opts);
    if (stale) return { status: stale };
    const found = findActiveEntry(rootState, entryId, false);
    if (!found) return { status: 'missing-entry' };
    if (found.quest.receipts.encounters && found.quest.receipts.encounters[entryId]) return { status: 'duplicate', value: found.quest.receipts.encounters[entryId] };
    const globalKey = receiptKey('encounter', entryId);
    if (found.state.receipts[globalKey]) return { status: 'duplicate', value: found.state.receipts[globalKey] };
    return runTransaction(rootState, adapter, opts, function() {
      if (choice.throwBeforeReceipt) throw new Error('Destination encounter callback failed');
      const current = findActiveEntry(rootState, entryId, true);
      if (!current) throw new Error('Destination encounter disappeared');
      const receipt = {
        version: VERSION,
        entryId,
        kind: current.entry.kind,
        at: iso(opts.now),
        phase: choice.phase || current.quest.phase,
        choiceId: choice.choiceId || 'continue',
        outcome: choice.outcome || 'recorded'
      };
      current.entry.receiptId = stableId('dqreceipt', [entryId, receipt.at, receipt.choiceId]);
      current.entry.outcome = clone(receipt);
      current.quest.receipts.encounters[entryId] = receipt;
      current.state.receipts[globalKey] = receipt;
      if (current.entry.kind === 'bird') receipt.meeting = applyMeeting(current.state, current.entry, adapter, opts.now);
      current.quest.updatedAt = iso(opts.now);
      return receipt;
    });
  }
  function applyQuote(rootState, adapter, quote) {
    if (quote.xp && adapter && typeof adapter.applyPlayerXpState === 'function') adapter.applyPlayerXpState(quote.xp, rootState);
    if (quote.coins && adapter && typeof adapter.addCoinsState === 'function') adapter.addCoinsState(quote.coins, rootState);
    if (quote.loot && quote.loot.length && adapter && typeof adapter.addLootState === 'function') adapter.addLootState(clone(quote.loot), rootState);
  }
  function completeDestinationQuest(rootState, adapter, opts) {
    opts = opts || {};
    const stale = checkGuard(rootState, adapter, opts);
    if (stale) return { status: stale };
    let state = readDestinationState(rootState);
    if (opts.questId && state.archive.some(record => record.id === opts.questId)) return { status: 'duplicate' };
    if (!state.active) return { status: 'no-active' };
    if (state.active.phase !== PHASES.REVIEW) return { status: 'invalid-phase' };
    const finalKey = receiptKey('complete', state.active.id);
    if (state.receipts[finalKey] || state.active.receipts.final) return { status: 'duplicate' };
    return runTransaction(rootState, adapter, opts, function() {
      state = ensureDestinationState(rootState);
      const q = state.active;
      if (!q || q.phase !== PHASES.REVIEW) throw new Error('Destination is not awaiting review.');
      applyQuote(rootState, adapter, q.quote);
      q.phase = PHASES.COMPLETED;
      q.completedAt = iso(opts.now);
      q.updatedAt = iso(opts.now);
      q.receipts.final = {
        version: VERSION,
        at: q.completedAt,
        quote: clone(q.quote),
        paid: true
      };
      const archived = clone(q);
      state.archive.unshift(archived);
      if (state.archive.length > 40) state.archive.length = 40;
      state.active = null;
      state.receipts[finalKey] = clone(q.receipts.final);
      return { questId: q.id, phase: PHASES.COMPLETED, quote: clone(q.quote), archive: archived };
    });
  }

  function createBrowserAdapter(apiRoot) {
    apiRoot = apiRoot || root || {};
    let deferredEffects = null;
    function activeDeferredEffects() {
      if (!deferredEffects) throw new Error('Destination unlock requires an active deferred effects transaction.');
      return deferredEffects;
    }
    return {
      beginDeferredEffects: function() {
        deferredEffects = [];
      },
      commitDeferredEffects: function() {
        const effects = deferredEffects || [];
        deferredEffects = null;
        effects.forEach(effect => {
          if (typeof effect !== 'function') return;
          try { effect(); } catch (_) {}
        });
      },
      discardDeferredEffects: function() {
        deferredEffects = null;
      },
      getProfileId: function(state) { return state && (state.photoProfileId || state.profileId); },
      getRevision: function(state) { return state && (state.revision || state.saveRevision || 0); },
      snapshot: function() {
        if (typeof apiRoot.snapshotGameState === 'function') return apiRoot.snapshotGameState();
        return clone(apiRoot.gameState);
      },
      restore: function(_state, before) {
        if (typeof apiRoot.restoreGameStateSnapshot === 'function') return apiRoot.restoreGameStateSnapshot(before);
        if (apiRoot.gameState) return restoreTree(apiRoot.gameState, before);
        return before;
      },
      persist: function() {
        if (typeof apiRoot.durableSaveState === 'function') return apiRoot.durableSaveState({ throwOnFailure: true, queueCloud: false });
        return { ok: true };
      },
      applyPlayerXpState: function(amount) {
        if (typeof apiRoot.applyPlayerXpState === 'function') return apiRoot.applyPlayerXpState(amount);
      },
      addCoinsState: function(amount) {
        if (typeof apiRoot.addCoins === 'function') return apiRoot.addCoins(amount);
      },
      addLootState: function(loot) {
        const gameState = apiRoot.gameState;
        if (!gameState) return;
        gameState.inventory = gameState.inventory || {};
        gameState.inventory.items = gameState.inventory.items || {};
        for (const item of loot || []) {
          if (!item || !item.id) continue;
          gameState.inventory.items[item.id] = (Number(gameState.inventory.items[item.id]) || 0) + Math.max(1, Math.floor(Number(item.qty) || 1));
        }
      },
      isSpeciesUnlocked: function(species) {
        if (typeof apiRoot.getDiscoveredRecordForSpecies === 'function' && apiRoot.getDiscoveredRecordForSpecies(species)) return true;
        const key = speciesKey(species);
        return !!(apiRoot.gameState && apiRoot.gameState.discoveredSpecies && apiRoot.gameState.discoveredSpecies[key]);
      },
      unlockSpeciesForDestination: function(species, meta) {
        if (typeof apiRoot.rememberDiscoveredBird !== 'function') {
          throw new Error('Destination unlock requires the canonical deferred discovery helper.');
        }
        {
          const isNew = apiRoot.rememberDiscoveredBird(
            { species, commonName: species, rarity: 'common', confidence: 1 },
            { silent: true, effects: activeDeferredEffects() }
          );
          return { unlocked: !!isNew, species, meta };
        }
      }
    };
  }

  return Object.freeze({
    VERSION,
    STATE_VERSION,
    RECORD_KIND,
    PHASES,
    buildDestinationRecord,
    buildCommonBirdPool,
    readDestinationState,
    sanitizeDestinationState,
    emptyDestinationState,
    ensureDestinationState,
    stageDestinationPreview,
    cancelDestinationPreview,
    beginDestinationQuest,
    finishDestinationWalk,
    reviewEntries,
    encounterGate,
    observeDestinationEncounters,
    applyDestinationEncounter,
    completeDestinationQuest,
    advanceTime,
    createBrowserAdapter,
    speciesKey,
    _restoreTree: restoreTree,
    _routePointAtFraction: routePointAtFraction,
    _runTransaction: runTransaction
  });
});
