(function(root, factory) {
  const api = factory(root || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDestinationQuestUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  const VERSION = 'destination-quest-ui-v431-20260921';
  const PIN = 'gold-trail-raven-v454-20260923';
  const DEFAULT_ROUTE_OPTIONS = {
    timeoutMs: 5000,
    totalTimeoutMs: 12000,
    minRouteM: 25,
    queryPaddingM: 280
  };

  function clone(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function text(value, fallback) {
    const out = String(value == null ? '' : value).trim();
    return out || fallback || '';
  }
  function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function validCoordinate(point) {
    if (!point) return false;
    const lat = number(point.lat);
    const lon = number(point.lon);
    return lat != null && lon != null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }
  function normalizedPoint(lat, lon, extra) {
    const point = Object.assign({}, extra || {}, { lat: number(lat), lon: number(lon) });
    return validCoordinate(point) ? point : null;
  }
  function distanceLabel(meters) {
    const n = Math.max(0, Number(meters) || 0);
    if (n < 1000) return Math.round(n) + ' m';
    return (n / 1000).toFixed(n < 10000 ? 2 : 1) + ' km';
  }
  function pointLabel(point) {
    if (!validCoordinate(point)) return 'Not selected';
    return Number(point.lat).toFixed(5) + ', ' + Number(point.lon).toFixed(5);
  }
  function routePoints(route) {
    return Array.isArray(route && route.points) ? route.points.filter(validCoordinate) : [];
  }
  function routeLength(route) {
    return Math.max(0, Number(route && (route.lengthM || route.distanceM)) || 0);
  }
  function summarizeError(result, fallback) {
    const rawError = result && result.error && typeof result.error === 'object' ? result.error : null;
    const code = result && (result.code || rawError && rawError.code || result.error || result.reason || result.status);
    const message = result && (result.message || result.detail || rawError && rawError.message);
    return {
      code: text(code, 'preview-failed'),
      message: text(message, fallback || 'This destination route is not available. Try another start or destination.')
    };
  }
  function callMaybe(fn, fallback) {
    try {
      return typeof fn === 'function' ? fn() : fallback;
    } catch (_) {
      return fallback;
    }
  }
  function nowValue(options) {
    return typeof options.now === 'function' ? options.now() : Date.now();
  }
  function rootStateFrom(options) {
    return typeof options.rootState === 'function' ? options.rootState() : (options.rootState || {});
  }
  function profileFrom(options, rootState) {
    if (typeof options.profileId === 'function') return options.profileId(rootState);
    return rootState && (rootState.photoProfileId || rootState.profileId) || null;
  }
  function revisionFrom(options, rootState) {
    if (typeof options.revision === 'function') return options.revision(rootState);
    return rootState && (rootState.saveRevision != null ? rootState.saveRevision : rootState.revision) || 0;
  }
  function resultFailed(value) {
    return !value || value.ok === false || value.status && value.status !== 'committed' && value.status !== 'ok';
  }

  function createPlannerController(options) {
    options = options || {};
    const routeCore = options.routeCore || root.BurbzDestinationRouteCore;
    const elevationCore = options.elevationCore || root.BurbzDestinationElevationCore;
    const rewardCore = options.rewardCore || root.BurbzDestinationRewardCore;
    const stateCore = options.stateCore || root.BurbzDestinationStateCore;
    const state = {
      version: VERSION,
      phase: 'idle',
      start: null,
      end: null,
      startSource: null,
      endSource: null,
      preview: null,
      error: null,
      generation: 0,
      previewId: null,
      previewContext: null,
      routeOptions: Object.assign({}, options.routeOptions || {}),
      pending: null,
      abort: null,
      lastProvider: null,
      lastElevation: null
    };

    function emit(code, extra) {
      const payload = Object.assign({ code, phase: state.phase, generation: state.generation }, extra || {});
      if (typeof options.onStatus === 'function') {
        try { options.onStatus(payload); } catch (_) {}
      }
      return payload;
    }
    function publicState() {
      return {
        version: VERSION,
        phase: state.phase,
        start: state.start && Object.assign({}, state.start),
        end: state.end && Object.assign({}, state.end),
        startSource: state.startSource,
        endSource: state.endSource,
        preview: state.preview,
        error: state.error,
        generation: state.generation,
        previewId: state.previewId,
        pending: !!state.pending,
        lastProvider: state.lastProvider,
        lastElevation: state.lastElevation,
        providerProgress: state.providerProgress
      };
    }
    function ensureReady() {
      if (!routeCore || typeof routeCore.fetchDestinationRoute !== 'function') return { ok: false, error: { code: 'missing-route-core', message: 'Destination routing is not available in this build.' } };
      if (!rewardCore || typeof rewardCore.quoteDestinationReward !== 'function') return { ok: false, error: { code: 'missing-reward-core', message: 'Destination rewards are not available in this build.' } };
      if (!stateCore || typeof stateCore.buildDestinationRecord !== 'function' || typeof stateCore.beginDestinationQuest !== 'function') return { ok: false, error: { code: 'missing-state-core', message: 'Destination saving is not available in this build.' } };
      return { ok: true };
    }
    function cancelStaged(reason) {
      if (!state.previewId || !stateCore || typeof stateCore.cancelDestinationPreview !== 'function') return;
      const rootState = rootStateFrom(options);
      try {
        stateCore.cancelDestinationPreview(rootState, state.previewId, {
          profileId: profileFrom(options, rootState),
          revision: revisionFrom(options, rootState),
          now: nowValue(options),
          reason
        });
      } catch (_) {}
    }
    function invalidate(reason) {
      if (state.abort && typeof state.abort.abort === 'function') {
        try { state.abort.abort(); } catch (_) {}
      }
      state.generation += 1;
      cancelStaged(reason || 'replaced');
      state.abort = null;
      state.pending = null;
      state.preview = null;
      state.previewId = null;
      state.previewContext = null;
      state.phase = 'idle';
      state.error = null;
      emit(reason || 'selection-changed');
    }
    function setPoint(kind, lat, lon, source) {
      const point = normalizedPoint(lat, lon, { source: source || 'manual' });
      if (!point) {
        state.error = { code: 'invalid-coordinate', message: 'Enter a valid latitude and longitude.' };
        state.phase = 'input-error';
        emit('invalid-coordinate', { kind });
        return { ok: false, error: state.error };
      }
      invalidate(kind + '-changed');
      if (kind === 'start') {
        state.start = point;
        state.startSource = source || 'manual';
      } else {
        state.end = point;
        state.endSource = source || 'manual';
      }
      emit(kind + '-selected', { point });
      return { ok: true, point: Object.assign({}, point) };
    }
    function contextStatus(context) {
      if (!context) return 'stale-preview';
      const current = rootStateFrom(options);
      if (profileFrom(options, current) !== context.profileId) return 'stale-profile';
      if (current !== context.rootState) return 'stale-save';
      if (revisionFrom(options, current) !== context.revision) return 'stale-revision';
      return null;
    }
    function stale(generation) {
      if (generation !== state.generation || state.phase === 'cancelled') return true;
      const changed = contextStatus(state.previewContext);
      if (changed) { cancel(changed); return true; }
      return false;
    }
    async function sampleElevation(points, generation, signal) {
      const unavailable = reason => ({ available: false, reason, ascentM: 0, descentM: 0, multiplier: 1, provenance: { provider: 'unavailable' } });
      if (!elevationCore || typeof elevationCore.sampleRouteElevation !== 'function') {
        return unavailable('Elevation service unavailable in this build.');
      }
      // DEM is optional: a slow tile must not strand a valid walking route.
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timer, onAbort;
      const deadlineMs = Math.max(1, Math.min(10000, Number(options.elevationTimeoutMs) || 10000));
      try {
        const deadline = new Promise(resolve => {
          timer = setTimeout(() => {
            resolve(unavailable('Elevation timed out; rewards use distance only.'));
            controller?.abort();
          }, deadlineMs);
          onAbort = () => { resolve(null); controller?.abort(); };
          if (signal?.aborted) onAbort();
          else signal?.addEventListener('abort', onAbort, { once: true });
        });
        const value = await Promise.race([
          Promise.resolve().then(() => elevationCore.sampleRouteElevation(points, {
            signal: controller ? controller.signal : signal, spacingM: options.elevationSpacingM || 90
          })), deadline
        ]);
        if (stale(generation)) return null;
        if (value && typeof value === 'object') return value;
      } catch (err) {
        if (stale(generation)) return null;
        return unavailable(err && err.message || 'Elevation could not be checked.');
      } finally {
        clearTimeout(timer);
        if (onAbort) signal?.removeEventListener('abort', onAbort);
      }
      return unavailable('Elevation could not be checked.');
    }
    function makeQuote(route, elevation) {
      return rewardCore.quoteDestinationReward({ distanceM: routeLength(route), lengthM: routeLength(route) }, elevation, { difficulty: options.difficulty || 'normal' });
    }
    function contentInput() {
      const raw = typeof options.content === 'function' ? options.content() : (options.content || {});
      return Object.assign({ source: 'destination-ui-native-pool' }, raw || {});
    }
    function catalogueInput() {
      const raw = typeof options.catalogue === 'function' ? options.catalogue() : (options.catalogue || []);
      return Array.isArray(raw) ? raw : [];
    }
    function failPreview(error) {
      state.phase = 'error';
      state.error = error;
      state.preview = null;
      state.previewId = null;
      emit('preview-error', { error });
      if (typeof options.onPreviewError === 'function') {
        try { options.onPreviewError(error); } catch (_) {}
      }
      return { ok: false, error };
    }
    async function preview(extra) {
      const ready = ensureReady();
      if (!ready.ok) return failPreview(ready.error);
      if (!validCoordinate(state.start) || !validCoordinate(state.end)) {
        return failPreview({ code: 'missing-selection', message: 'Choose a start and destination before previewing.' });
      }
      cancelStaged('replaced');
      if (state.abort && typeof state.abort.abort === 'function') {
        try { state.abort.abort(); } catch (_) {}
      }
      const generation = state.generation + 1;
      state.generation = generation;
      state.phase = 'planning';
      state.error = null;
      state.preview = null;
      state.previewId = null;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      state.abort = controller;
      const owner = rootStateFrom(options);
      state.previewContext = { rootState: owner, profileId: profileFrom(options, owner), revision: revisionFrom(options, owner) };
      emit('preview-started', { start: state.start, end: state.end });
      const routeOptions = Object.assign({}, DEFAULT_ROUTE_OPTIONS, state.routeOptions, extra && extra.routeOptions || {});
      if (controller) routeOptions.signal = controller.signal;

      routeOptions.onProgress = progress => {if(generation!==state.generation)return;state.providerProgress=progress;emit('provider-progress');};
      let routeRequest;
      try {
        routeRequest = routeCore.fetchDestinationRoute(state.start, state.end, routeOptions);
      } catch (err) {
        routeRequest = Promise.reject(err);
      }
      const promise = Promise.resolve(routeRequest)
        .then(async routeResult => {
          if (stale(generation)) return { ok: false, stale: true, status: 'stale-route' };
          if (!routeResult || routeResult.ok === false || !routeResult.route) {
            return failPreview(summarizeError(routeResult, 'No public walking route could be built for that selection.'));
          }
          const route = routeResult.route;
          state.lastProvider = route.provider || routeResult.provider || null;
          const elevation = await sampleElevation(routePoints(route), generation, controller && controller.signal);
          if (stale(generation) || !elevation) return { ok: false, stale: true, status: 'stale-elevation' };
          state.lastElevation = elevation;
          let quote;
          try {
            quote = makeQuote(route, elevation);
          } catch (err) {
            return failPreview({ code: 'quote-failed', message: err && err.message || 'Reward preview could not be computed.' });
          }
          if (stale(generation)) return { ok: false, stale: true, status: 'stale-quote' };
          const rootState = rootStateFrom(options);
          const build = stateCore.buildDestinationRecord({
            route,
            quote,
            content: contentInput(),
            catalogue: catalogueInput(),
            areaBirdsCore: options.areaBirdsCore || {},
            commonBirdCount: options.commonBirdCount || 3,
            buildingCount: options.buildingCount || 1,
            characterCount: options.characterCount || 1,
            idSeed: text(options.idSeed, profileFrom(options, rootState) || 'destination-ui') + ':' + generation,
            now: nowValue(options),
            routeCore,
            rewardCore
          });
          if (stale(generation)) return { ok: false, stale: true, status: 'stale-content' };
          if (!build || build.ok === false || !build.record) {
            return failPreview(summarizeError(build, 'This route could not produce a complete destination plan.'));
          }
          const previewId = 'dqprev-' + generation + '-' + Math.max(0, nowValue(options));
          const staged = stateCore.stageDestinationPreview(rootState, build.record, {
            previewId,
            generation,
            profileId: profileFrom(options, rootState),
            revision: revisionFrom(options, rootState),
            now: nowValue(options)
          });
          if (stale(generation)) {
            try { stateCore.cancelDestinationPreview(rootState, previewId, { now: nowValue(options) }); } catch (_) {}
            return { ok: false, stale: true, status: 'stale-stage' };
          }
          if (!staged || staged.ok === false) return failPreview(summarizeError(staged, 'Destination preview could not be staged.'));
          const value = {
            ok: true,
            generation,
            previewId,
            route,
            elevation,
            quote,
            record: build.record,
            provider: state.lastProvider,
            staged: staged.preview || null
          };
          state.phase = 'preview';
          state.preview = value;
          state.previewId = previewId;
          state.error = null;
          emit('preview-ready', {
            previewId,
            provider: state.lastProvider,
            entryCount: Array.isArray(build.record.entries) ? build.record.entries.length : 0
          });
          if (typeof options.onPreview === 'function') {
            try { options.onPreview(value); } catch (_) {}
          }
          return value;
        })
        .catch(err => {
          if (stale(generation) || err && err.name === 'AbortError') return { ok: false, stale: true, status: 'cancelled' };
          return failPreview({ code: err && err.code || 'provider-network', message: err && err.message || 'The route provider could not be reached.' });
        })
        .finally(() => {
          if (state.pending === promise) state.pending = null;
          if (state.abort === controller) state.abort = null;
        });
      state.pending = promise;
      return promise;
    }
    function begin() {
      const ready = ensureReady();
      if (!ready.ok) return { status: ready.error.code, error: ready.error };
      if (!state.preview || !state.preview.record || !state.previewId) {
        const error = { code: 'no-preview', message: 'Preview a valid destination before beginning.' };
        state.error = error;
        emit('begin-blocked', { error });
        return { status: 'no-preview', error };
      }
      const changed = contextStatus(state.previewContext);
      if (changed) { cancel(changed); return { status: changed }; }
      const rootState = state.previewContext.rootState;
      const result = stateCore.beginDestinationQuest(rootState, state.preview.record, options.saveAdapter || null, {
        previewId: state.previewId,
        expectedProfileId: state.previewContext.profileId,
        expectedRevision: state.previewContext.revision,
        now: nowValue(options)
      });
      if (result && result.status === 'committed') {
        state.phase = 'active';
        state.error = null;
        emit('begin-committed', { previewId: state.previewId, value: result.value || null });
        if (typeof options.onBegin === 'function') {
          try { options.onBegin(result, state.preview); } catch (_) {}
        }
      } else {
        const error = { code: result && result.status || 'begin-failed', message: 'Begin could not save this destination plan. Reopen the planner and retry.' };
        state.error = error;
        emit('begin-failed', { error, result });
      }
      return result || { status: 'begin-failed' };
    }
    function cancel(reason) {
      if (state.abort && typeof state.abort.abort === 'function') {
        try { state.abort.abort(); } catch (_) {}
      }
      state.generation += 1;
      cancelStaged(reason || 'cancelled');
      state.abort = null;
      state.pending = null;
      state.preview = null;
      state.previewId = null;
      state.previewContext = null;
      state.error = null;
      state.phase = 'cancelled';
      emit('cancelled', { reason: reason || 'cancelled' });
      return { ok: true };
    }
    function setRouteOptions(value) {
      state.routeOptions = Object.assign({}, state.routeOptions, value || {});
      invalidate('route-options-changed');
      return Object.assign({}, state.routeOptions);
    }
    function setPreciseStart(position) {
      if (!position || position.precise !== true || !validCoordinate(position)) {
        state.error = { code: 'gps-unavailable', message: 'Precise GPS is not available. Enter a start manually or pick it on the map.' };
        state.phase = 'input-error';
        emit('gps-unavailable');
        return { ok: false, error: state.error };
      }
      return setPoint('start', position.lat, position.lon, position.source || 'precise-gps');
    }
    return {
      version: VERSION,
      state: publicState,
      setManualStart: (lat, lon) => setPoint('start', lat, lon, 'manual'),
      setManualEnd: (lat, lon) => setPoint('end', lat, lon, 'manual'),
      setMapStart: (lat, lon) => setPoint('start', lat, lon, 'map-tap'),
      setMapEnd: (lat, lon) => setPoint('end', lat, lon, 'map-tap'),
      setPreciseStart,
      setRouteOptions,
      preview,
      begin,
      cancel,
      clear: () => invalidate('cleared')
    };
  }

  function createTimelineController(options) {
    options = options || {};
    const stateCore = options.stateCore || root.BurbzDestinationStateCore;
    const state = {
      version: VERSION,
      lastResult: null,
      error: null
    };

    function emit(code, extra) {
      const payload = Object.assign({ code, version: VERSION }, extra || {});
      state.lastResult = payload;
      if (typeof options.onStatus === 'function') {
        try { options.onStatus(payload); } catch (_) {}
      }
      return payload;
    }
    function rootState() {
      return rootStateFrom(options);
    }
    function adapter() {
      return options.saveAdapter || null;
    }
    function guard(extra) {
      const rootStateValue = rootState();
      return Object.assign({
        expectedProfileId: profileFrom(options, rootStateValue),
        expectedRevision: revisionFrom(options, rootStateValue),
        now: nowValue(options)
      }, extra || {});
    }
    function readState() {
      const rootStateValue = rootState();
      if (stateCore && typeof stateCore.readDestinationState === 'function') return stateCore.readDestinationState(rootStateValue);
      if (stateCore && typeof stateCore.sanitizeDestinationState === 'function') return stateCore.sanitizeDestinationState(rootStateValue && rootStateValue.destinationQuests);
      return rootStateValue && rootStateValue.destinationQuests || {};
    }
    function activeQuest() {
      const current = readState();
      return current && current.active || null;
    }
    function archivedQuests() {
      const current = readState();
      return Array.isArray(current && current.archive) ? current.archive.slice() : [];
    }
    function entries(opts) {
      opts = opts || {};
      if (opts.questId) {
        const archived = archivedQuests().find(record => record.id === opts.questId);
        return archived && Array.isArray(archived.entries) ? clone(archived.entries) : [];
      }
      const rootStateValue = rootState();
      if (stateCore && typeof stateCore.reviewEntries === 'function') return stateCore.reviewEntries(rootStateValue);
      const active = activeQuest();
      return active && Array.isArray(active.entries) ? clone(active.entries) : [];
    }
    function entryById(entryId) {
      const active = activeQuest();
      const list = active && Array.isArray(active.entries) ? active.entries : [];
      return list.find(entry => entry.id === entryId) || null;
    }
    function nativeHandlerFor(entry) {
      const handlers = typeof options.nativeHandlers === 'function' ? options.nativeHandlers() : options.nativeHandlers;
      const action = entry && entry.nativeAction || {};
      if (!handlers || !action.method || typeof handlers[action.method] !== 'function') return null;
      return { fn: handlers[action.method], action };
    }
    function runNative(entry, result, choice) {
      const handler = nativeHandlerFor(entry);
      if (!handler) return false;
      const receipt = result && (result.value || result.receipt || null);
      const payload = Object.assign({}, handler.action.payload || {}, {
        receipt,
        result,
        choice: choice || {},
        phase: activeQuest() && activeQuest().phase || null
      });
      handler.fn(entry, payload);
      return true;
    }
    function finishWalk(opts) {
      opts = opts || {};
      if (opts.confirmed !== true) {
        const result = { status: 'confirmation-required' };
        state.error = result;
        emit('finish-confirmation-required', { result });
        return result;
      }
      if (!stateCore || typeof stateCore.finishDestinationWalk !== 'function') {
        const result = { status: 'missing-state-core' };
        state.error = result;
        emit('finish-failed', { result });
        return result;
      }
      const result = stateCore.finishDestinationWalk(rootState(), adapter(), guard({
        gpsTicks: opts.gpsTicks || 0,
        usedSuggestedTrack: !!opts.usedSuggestedTrack
      }));
      state.error = result && result.status === 'committed' ? null : result;
      emit(result && result.status === 'committed' ? 'finish-committed' : 'finish-failed', { result });
      if (result && result.status === 'committed' && typeof options.onFinish === 'function') {
        try { options.onFinish(result); } catch (_) {}
      }
      return result || { status: 'failed' };
    }
    let pendingEntry = null, nativeGeneration = 0;
    function cancelPending() { nativeGeneration++; pendingEntry = null; }
    function openEntry(entryId, choice) {
      if (pendingEntry) return pendingEntry;
      const result = openEntryNow(entryId, choice);
      if (result && typeof result.then === 'function') {
        const pending = result.finally(() => { if (pendingEntry === pending) pendingEntry = null; });
        pendingEntry = pending;
        return pendingEntry;
      }
      return result;
    }
    function openEntryNow(entryId, choice) {
      const generation = nativeGeneration;
      choice = Object.assign({ choiceId: 'open' }, choice || {});
      const beforeEntry = entryById(entryId);
      if (!beforeEntry) {
        const result = { status: 'missing-entry' };
        state.error = result;
        emit('entry-failed', { entryId, result });
        return result;
      }
      if (!stateCore || typeof stateCore.applyDestinationEncounter !== 'function') {
        const result = { status: 'missing-state-core' };
        state.error = result;
        emit('entry-failed', { entryId, result });
        return result;
      }
      const fix = options.getPrecisePosition?.() || null;
      const observed = stateCore.observeDestinationEncounters(rootState(), fix, adapter(), guard());
      if (!['committed', 'unchanged'].includes(observed.status)) return observed;
      const gate = stateCore.encounterGate(rootState(), entryId, fix, nowValue(options));
      if (!gate.ready) return { status: 'not-discovered', reason: gate.reason };
      const expectedRoot = rootState(), expectedProfile = profileFrom(options, expectedRoot), expectedQuest = activeQuest()?.id;
      let nativePreparation;
      const cleanupNative=()=>{if(nativePreparation?.close)nativePreparation.close();else options.nativeFailed?.(beforeEntry);};
      const commit = () => {
      if (generation !== nativeGeneration || rootState() !== expectedRoot || profileFrom(options, rootState()) !== expectedProfile || activeQuest()?.id !== expectedQuest) return { status: 'stale-native' };
      const result = stateCore.applyDestinationEncounter(rootState(), entryId, choice, adapter(), guard());
      const okToShow = result && (result.status === 'committed' || result.status === 'duplicate');
      if (okToShow) {
        const afterEntry = entryById(entryId) || beforeEntry;
        runNative(afterEntry, result, choice);
        state.error = null;
        emit(result.status === 'committed' ? 'entry-committed' : 'entry-duplicate', { entryId, result });
        if (typeof options.onEntry === 'function') {
          try { options.onEntry(result, afterEntry); } catch (_) {}
        }
      } else {
        state.error = result || { status: 'failed' };
        emit('entry-failed', { entryId, result });
      }
      if (!okToShow) cleanupNative();
      return result || { status: 'failed' };
      };
      if (typeof options.prepareNative !== 'function') return commit();
      return Promise.resolve(options.prepareNative(beforeEntry)).then(ready => {
        nativePreparation=ready;
        if (ready === false) return { status: 'native-unavailable' };
        const result = commit();
        if (result.status === 'stale-native') cleanupNative();
        return result;
      }).catch(() => { cleanupNative(); return { status: 'native-unavailable' }; });
    }
    function completeQuest(opts) {
      opts = opts || {};
      if (opts.confirmed !== true) {
        const result = { status: 'confirmation-required' };
        state.error = result;
        emit('complete-confirmation-required', { result });
        return result;
      }
      if (!stateCore || typeof stateCore.completeDestinationQuest !== 'function') {
        const result = { status: 'missing-state-core' };
        state.error = result;
        emit('complete-failed', { result });
        return result;
      }
      const result = stateCore.completeDestinationQuest(rootState(), adapter(), guard({ questId: opts.questId }));
      state.error = result && (result.status === 'committed' || result.status === 'duplicate') ? null : result;
      emit(result && result.status === 'committed' ? 'complete-committed' : result && result.status === 'duplicate' ? 'complete-duplicate' : 'complete-failed', { result });
      if (result && result.status === 'committed' && typeof options.onComplete === 'function') {
        try { options.onComplete(result); } catch (_) {}
      }
      return result || { status: 'failed' };
    }

    return {
      version: VERSION,
      state: () => ({ version: VERSION, lastResult: state.lastResult, error: state.error }),
      activeQuest,
      archive: archivedQuests,
      entries,
      finishWalk,
      openEntry,
      cancelPending,
      completeQuest
    };
  }

  function attach(options) {
    options = options || {};
    const doc = options.document || root.document;
    if (!doc || !doc.body) return null;
    const controller = createPlannerController(Object.assign({}, options, {
      onPreview: function(value) {
        drawPreview(value);
        if (typeof options.onPreview === 'function') options.onPreview(value);
      },
      onStatus: function(status) {
        if (typeof options.onStatus === 'function') options.onStatus(status);
        render();
      },
      onBegin: function(result, preview) {
        controller.cancel('quest-started'); // The saved active quest now owns the map.
        closePlanner({ keepActive: true });
        refreshMapRoute({fit:true});
        if (typeof options.onBegin === 'function') options.onBegin(result, preview);
      }
    }));
    const markers = [];
    const encounterMarkers = [];
    let encounterKey = '';
    let sheet = null;
    let routeMap = null, renderedRouteKey = '';
    let mapPick = null;
    let nativeHandlers = null;
    let archiveViewId = null;
    let disposed = false, mainButton = null, mainHandler = null, markerKey = '', manualCoordinates = false;
    const timelineController = createTimelineController(Object.assign({}, options, {
      nativeHandlers: () => nativeHandlers || {},
      onStatus: function(status) {
        if (typeof options.onTimelineStatus === 'function') {
          try { options.onTimelineStatus(status); } catch (_) {}
        }
        render();
      },
      onFinish: function(result) {
        if (typeof options.onFinish === 'function') options.onFinish(result);
      },
      onEntry: function(result, entry) {
        if (typeof options.onEntry === 'function') options.onEntry(result, entry);
      },
      onComplete: function(result) {
        if (typeof options.onComplete === 'function') options.onComplete(result);
      }
    }));

    function getMap() {
      return typeof options.getMap === 'function' ? options.getMap() : options.map || null;
    }
    function showToast(message) {
      if (typeof options.showToast === 'function') options.showToast(message);
    }
    function confirmAction(message) {
      if (typeof options.confirmDestinationAction === 'function') return options.confirmDestinationAction(message);
      if (typeof root.confirm === 'function') return root.confirm(message);
      return true;
    }
    function closeLegacyPanels() {
      if (typeof options.closeWalkQuestSheet === 'function') options.closeWalkQuestSheet();
      if (typeof options.closeGeographicPlaces === 'function') options.closeGeographicPlaces();
      if (typeof options.closeQuestFocus === 'function') options.closeQuestFocus({ restoreFocus: false });
    }
    function ensureSheet() {
      if (sheet && sheet.isConnected) return sheet;
      sheet = doc.createElement('section');
      sheet.id = 'destinationQuestSheet';
      sheet.className = 'destination-quest-sheet';
      sheet.setAttribute('role', 'dialog');
      sheet.setAttribute('aria-modal', 'false');
      sheet.setAttribute('aria-labelledby', 'destinationQuestTitle');
      doc.body.appendChild(sheet);
      return sheet;
    }
    function focusFirst() {
      const target = sheet && sheet.querySelector('input, button');
      if (target && typeof target.focus === 'function') {
        try { target.focus({ preventScroll: true }); } catch (_) { target.focus(); }
      }
    }
    function cleanupMapPick() {
      const map = mapPick && mapPick.map;
      if (map && typeof map.off === 'function' && mapPick.handler) {
        try { map.off('click', mapPick.handler); } catch (_) {}
      }
      mapPick = null;
      doc.body.classList.remove('destination-map-picking');
      if (typeof options.setMapInspectionMode === 'function') options.setMapInspectionMode(!!sheet?.classList.contains('open'));
    }
    function clearPreviewLayer() {
      renderedRouteKey = '';
      markerKey = '';
      encounterKey = '';
      encounterMarkers.splice(0).forEach(marker => { try { marker.remove(); } catch (_) {} });
      markers.splice(0).forEach(marker => {
        try { marker.remove(); } catch (_) {}
      });
      const map = routeMap || getMap();
      if (!map) return;
      for (const layerId of ['burbz-destination-guidance', 'burbz-destination-route', 'burbz-destination-route-glow']) {
        try { if (map.getLayer && map.getLayer(layerId)) map.removeLayer(layerId); } catch (_) {}
      }
      try { if (map.getSource && map.getSource('burbz-destination-route')) map.removeSource('burbz-destination-route'); } catch (_) {}
    }
    function routeGeoJSON(route) {
      return {
        type: 'FeatureCollection',
        features: (route?.routeSchemaVersion === 2 ? route.routeEvidence.parts : [{kind:'mapped',route}]).map(part => ({
          type: 'Feature',
          properties: {guidance:part.kind === 'guidance'},
          geometry: { type: 'LineString', coordinates: (part.kind === 'guidance' ? part.points : routePoints(part.route)).map(point => [point.lon, point.lat]) }
        }))
      };
    }
    function makeMarker(point, label, className) {
      const map = getMap();
      if (!map || !point || !validCoordinate(point)) return;
      const el = doc.createElement('div');
      el.className = 'destination-route-marker ' + className;
      el.dataset.latitude = String(point.lat); el.dataset.longitude = String(point.lon);
      el.setAttribute('role','img');
      el.innerHTML = '<strong>' + (className === 'start' ? '1' : '2') + '</strong><span>' + (className === 'start' ? 'START' : 'DESTINATION') + '</span>';
      el.setAttribute('aria-label', 'Destination ' + label + ' marker');
      try {
        const factory = typeof options.createMarker === 'function' ? options.createMarker : (root.maplibregl && root.maplibregl.Marker ? cfg => new root.maplibregl.Marker(cfg) : null);
        if (!factory) return;
        const marker = factory({ element: el, anchor: 'center' }).setLngLat([point.lon, point.lat]).addTo(map);
        markers.push(marker);
      } catch (_) {}
    }
    function syncSelectionMarkers(route) {
      const current = controller.state();
      const s = route ? {start:route.selectedStart || route.points?.[0],end:route.selectedEnd || route.points?.at(-1)} : current;
      const key = JSON.stringify([s.start,s.end]);
      if (key === markerKey) return;
      markers.splice(0).forEach(m=>m.remove());
      makeMarker(s.start,'Start','start'); makeMarker(s.end,'Destination','end');
      markerKey=key;
    }
    function syncEncounterMarkers(entries) {
      const items = (Array.isArray(entries) ? entries : []).filter(entry => entry && validCoordinate(entry.route));
      const key = JSON.stringify(items.map(entry => [entry.id, entry.kind, entry.route.lat, entry.route.lon, entry.label || entry.name || entry.commonName || entry.species, !!entry.receiptId]));
      if (key === encounterKey) return;
      encounterMarkers.splice(0).forEach(marker => { try { marker.remove(); } catch (_) {} });
      const map = getMap();
      const factory = typeof options.createMarker === 'function' ? options.createMarker : (root.maplibregl?.Marker ? cfg => new root.maplibregl.Marker(cfg) : null);
      if (!map || !factory) return;
      for (const entry of items) {
        const el = doc.createElement('div');
        el.className = 'destination-encounter-marker' + (entry.receiptId ? ' is-visited' : '');
        el.dataset.entryId = entry.id;
        el.textContent = ({building:'🏠', character:'💬', bird:'🐦'})[entry.kind] || '✦';
        const label = entry.label || entry.name || entry.commonName || entry.species || 'Quest stop';
        el.title = 'Game encounter · ' + label;
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', el.title);
        try { encounterMarkers.push(factory({element:el,anchor:'center'}).setLngLat([entry.route.lon,entry.route.lat]).addTo(map)); } catch (_) {}
      }
      encounterKey = key;
    }
    function drawPreview(preview, opts = {}) {
      const map = getMap();
      const route = preview && preview.route;
      const points = routePoints(route);
      if (!map || points.length < 2) return;
      if (renderedRouteKey !== route.routeFingerprint) clearPreviewLayer();
      try {
        if (!map.getSource || !map.getSource('burbz-destination-route')) {
          map.addSource('burbz-destination-route', { type: 'geojson', data: routeGeoJSON(route) });
          map.addLayer({ id: 'burbz-destination-route-glow', filter:['==',['get','guidance'],false], type: 'line', source: 'burbz-destination-route', layout: {'line-cap':'round','line-join':'round'}, paint: { 'line-color': '#b99348', 'line-width': 13, 'line-opacity': .30, 'line-blur': 2 } });
          map.addLayer({ id: 'burbz-destination-route', filter:['==',['get','guidance'],false], type: 'line', source: 'burbz-destination-route', layout: {'line-cap':'round','line-join':'round'}, paint: { 'line-color': '#e8c778', 'line-width': 7, 'line-opacity': .82 } });
          map.addLayer({id:'burbz-destination-guidance',type:'line',source:'burbz-destination-route',filter:['==',['get','guidance'],true],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#e8c778','line-width':4,'line-opacity':.8,'line-dasharray':[2,2]}});
        } else {
          map.getSource('burbz-destination-route').setData(routeGeoJSON(route));
        }
      } catch (_) {}
      renderedRouteKey = route.routeFingerprint;
      syncSelectionMarkers(route);
      syncEncounterMarkers(preview.record?.entries || preview.entries || []);
      if (opts.fit === false) return;
      if (typeof options.fitRoute === 'function') {
        options.fitRoute(points);
      } else if (root.maplibregl && typeof map.fitBounds === 'function') {
        try {
          const bounds = new root.maplibregl.LngLatBounds();
          points.forEach(point => bounds.extend([point.lon, point.lat]));
          map.fitBounds(bounds, { padding: { top: 96, right: 28, bottom: 260, left: 28 }, maxZoom: 16, duration: 450 });
        } catch (_) {}
      }
    }
    function refreshMapRoute(opts = {}) {
      if (disposed) return;
      const map = getMap();
      if (map !== routeMap) {
        clearPreviewLayer();
        routeMap?.off?.('style.load', onMapStyleLoad);
        routeMap = map;
        routeMap?.on?.('style.load', onMapStyleLoad);
      }
      const active = timelineController.activeQuest();
      const preview = sheet?.classList.contains('open') ? controller.state().preview : null;
      const route = active?.route || preview?.route;
      if (route) drawPreview({route, record:active || preview?.record}, {fit:opts.fit === true});
      else { clearPreviewLayer(); if(sheet?.classList.contains('open'))syncSelectionMarkers(); }
    }
    function onMapStyleLoad() { renderedRouteKey = ''; refreshMapRoute(); }
    function routeMetricHTML(preview) {
      if (!preview || !preview.route || !preview.quote) return '';
      const elevation = preview.quote.elevation || preview.elevation || {};
      const elevationCopy = elevation.status === 'measured'
        ? 'Elevation measured: ' + Math.round(Number(elevation.ascentM) || 0) + ' m ascent'
        : 'Elevation unavailable: neutral reward multiplier';
      const loot = Array.isArray(preview.quote.loot) && preview.quote.loot.length
        ? preview.quote.loot.map(item => escapeHtml(item.id) + ' x' + Math.max(1, Number(item.qty) || 1)).join(', ')
        : 'No loot';
      return '<div class="destination-preview-card" data-destination-preview="ready">' +
        '<div class="destination-preview-grid">' +
        '<div><span>Distance</span><b>' + distanceLabel(routeLength(preview.route)) + '</b></div>' +
        '<div><span>Difficulty</span><b>' + escapeHtml(preview.quote.difficulty && preview.quote.difficulty.label || 'normal') + '</b></div>' +
        '<div><span>XP</span><b>+' + Math.round(Number(preview.quote.xp) || 0) + '</b></div>' +
        '<div><span>Coins</span><b>+' + Math.round(Number(preview.quote.coins) || 0) + '</b></div>' +
        '</div>' +
        '<p>' + escapeHtml(elevationCopy) + '</p>' +
        '<p>Loot: ' + escapeHtml(loot) + '</p>' +
        '<p>' + escapeHtml(preview.route.routeDataNote || 'Any route to your destination counts; follow local access and conditions.') + '</p>' +
        '</div>';
    }
    function activeSummaryHTML() {
      const active = timelineController.activeQuest() || (typeof options.activeQuest === 'function' ? options.activeQuest() : null);
      if (!active) return '';
      const entries = Array.isArray(active.entries) ? active.entries : [];
      return '<div class="destination-active-card" data-destination-active="' + escapeHtml(active.id || '') + '">' +
        '<div><b>' + escapeHtml(active.phase === 'review' ? 'Destination story review' : 'Destination walk active') + '</b><span>' + entries.length + ' banked stops saved before departure</span></div>' +
        '<button type="button" data-destination-open-active>View Plan</button>' +
        '</div>';
    }
    function renderActiveTimeline(active) {
      const entries = timelineController.entries();
      return entries.map(entry => '<button type="button" class="destination-entry-row" data-destination-entry="' + escapeHtml(entry.id) + '">' +
        '<span>' + escapeHtml(entry.kind) + '</span><b>' + escapeHtml(entry.label || entry.name || entry.commonName || entry.species || 'Destination stop') + '</b>' +
        '<em>' + escapeHtml((options.stateCore || root.BurbzDestinationStateCore).encounterGate(rootStateFrom(options),entry.id,null).ready ? (entry.receipt || entry.receiptId ? 'Saved · revisit' : 'Discovered · revisit') : 'Not reached') + '</em></button>').join('') ||
        '<p>No banked entries found. Reopen after the saved plan reloads.</p>';
    }
    function renderArchiveTimeline() {
      const archive = timelineController.archive();
      if (!archive.length) return '';
      if (archiveViewId) {
        const record = archive.find(item => item.id === archiveViewId);
        if (record) {
          const rows = timelineController.entries({ questId: archiveViewId }).map(entry => '<button type="button" class="destination-entry-row" data-destination-archive-entry="' + escapeHtml(entry.id) + '">' +
            '<span>' + escapeHtml(entry.kind) + '</span><b>' + escapeHtml(entry.label || entry.name || entry.commonName || entry.species || 'Destination stop') + '</b>' +
            '<em>' + escapeHtml(entry.outcome || entry.receiptId ? 'Archived' : distanceLabel(entry.route && entry.route.distanceM)) + '</em></button>').join('');
          return '<section class="destination-active-panel destination-archive-panel"><h3>Completed destination walk</h3>' +
            '<p class="destination-guidance">This archive keeps the saved route order and outcomes. Opening a stop here never pays the quest again.</p>' +
            '<button type="button" class="destination-archive-back" data-destination-archive-list>Back to completed walks</button>' +
            rows + '</section>';
        }
      }
      return '<section class="destination-active-panel destination-archive-panel"><h3>Completed destination walks</h3>' +
        archive.slice(0, 6).map(record => '<button type="button" class="destination-entry-row" data-destination-archive="' + escapeHtml(record.id || '') + '">' +
        '<span>archive</span><b>' + escapeHtml((record.entries && record.entries.length || 0) + ' saved stops') + '</b><em>' + escapeHtml(record.completedAt || record.updatedAt || '') + '</em></button>').join('') +
        '</section>';
    }
    function renderDestinationTimeline(active) {
      if (!active) return renderArchiveTimeline();
      const isReview = active.phase === 'review';
      const quote = active.quote || {};
      const loot = Array.isArray(quote.loot) && quote.loot.length ? quote.loot.map(item => escapeHtml(item.id) + ' x' + Math.max(1, Number(item.qty) || 1)).join(', ') : 'No loot';
      return '<section class="destination-active-panel" data-destination-phase="' + escapeHtml(active.phase || '') + '">' +
        '<h3>' + escapeHtml(isReview ? 'Story review' : 'Pocket walk plan') + '</h3>' +
        '<p class="destination-guidance">' + escapeHtml(isReview ? 'Review every saved stop in route order. You can leave and come back; completion only happens when you choose it.' : 'Pocket your phone: nearby loot is gathered automatically inside your yellow circle. Keep location active; if your phone pauses it, gathering resumes when you reopen. You can revisit discovered stops from this list. Unseen stops still need a nearby GPS visit.') + '</p>' +
        '<div class="destination-preview-grid destination-payment-grid"><div><span>XP</span><b>+' + Math.round(Number(quote.xp) || 0) + '</b></div><div><span>Coins</span><b>+' + Math.round(Number(quote.coins) || 0) + '</b></div><div><span>Loot</span><b>' + escapeHtml(loot) + '</b></div></div>' +
        '<div class="destination-actions destination-timeline-actions">' +
        (isReview ? '<button type="button" data-destination-complete>Complete & claim</button>' : '<button type="button" data-destination-finish>Finish my walk</button>') +
        '</div>' +
        renderActiveTimeline(active) +
        '</section>' + renderArchiveTimeline();
    }
    function render() {
      refreshMapRoute();
      if (!sheet || !sheet.classList.contains('open')) return;
      const current = controller.state();
      if (!timelineController.activeQuest()) syncSelectionMarkers();
      sheet.classList.toggle('show-coordinates',manualCoordinates);
      const planning = current.phase === 'planning' || current.pending;
      const preview = current.preview;
      const error = current.error;
      const active = timelineController.activeQuest() || (typeof options.activeQuest === 'function' ? options.activeQuest() : null);
      const activeHTML = renderDestinationTimeline(active);
      sheet.dataset.selectionReady = String(!!current.start && !!current.end && !active && !manualCoordinates);
      sheet.innerHTML = '<div class="destination-quest-panel">' +
        '<button type="button" class="destination-sheet-close" data-destination-close aria-label="Close Main Quests">x</button>' +
        '<header class="destination-sheet-head"><div><span>Main Quests</span><h2 id="destinationQuestTitle">Plan a destination walk</h2></div>' +
        '<p>' + (mapPick ? (mapPick.kind === 'start' ? '1. Tap the map to place your START.' : '2. Start set. Tap the map to place your DESTINATION.') : 'Choose your start, choose a destination, then preview the walk.') + '</p></header>' +
        '<button type="button" class="destination-coordinate-toggle" data-destination-coordinates aria-pressed="' + manualCoordinates + '">' + (manualCoordinates ? 'Hide coordinates' : current.start && current.end ? 'Change points' : 'Enter coordinates manually') + '</button>' +
        activeHTML +
        '<form class="destination-coordinate-form" data-destination-form>' +
        '<fieldset><legend>1 · Start</legend><label>Latitude<input id="destinationStartLat" name="startLat" inputmode="decimal" autocomplete="off" value="' + escapeHtml(current.start && current.start.lat != null ? current.start.lat : '') + '"></label><label>Longitude<input id="destinationStartLon" name="startLon" inputmode="decimal" autocomplete="off" value="' + escapeHtml(current.start && current.start.lon != null ? current.start.lon : '') + '"></label><div class="destination-point-line">' + escapeHtml(current.start ? 'Start selected' : 'Choose a start') + '</div><div class="destination-button-row"><button type="button" data-destination-gps>Use precise GPS</button><button type="button" data-destination-pick="start">Tap start on map</button></div></fieldset>' +
        '<fieldset><legend>2 · Destination</legend><label>Latitude<input id="destinationEndLat" name="endLat" inputmode="decimal" autocomplete="off" value="' + escapeHtml(current.end && current.end.lat != null ? current.end.lat : '') + '"></label><label>Longitude<input id="destinationEndLon" name="endLon" inputmode="decimal" autocomplete="off" value="' + escapeHtml(current.end && current.end.lon != null ? current.end.lon : '') + '"></label><div class="destination-point-line">' + escapeHtml(current.end ? 'Destination selected' : 'Choose a destination') + '</div><div class="destination-button-row"><button type="button" data-destination-pick="end">Tap destination on map</button></div></fieldset>' +
        '<div class="destination-status" role="status" data-destination-status>' + escapeHtml(planning ? (current.providerProgress?.alternative ? 'First map service unavailable. Checking another public map source...' : 'Checking the public walking network...') : error ? error.message : preview ? 'Route ready. Begin saves your walk and rewards.' : current.start && current.end ? 'Both points are set. Preview your walk.' : 'Choose both points to preview.') + '</div>' +
        routeMetricHTML(preview) +
        '<div class="destination-actions"><button type="submit" data-destination-preview ' + (planning ? 'disabled' : '') + '>' + (preview ? 'Preview Again' : 'Preview Route') + '</button><button type="button" data-destination-begin ' + (!preview || planning ? 'disabled' : '') + '>Begin</button><button type="button" data-destination-cancel>Cancel</button></div>' +
        '</form>' +
        activeSummaryHTML() +
        '</div>';
      bindSheet();
    }
    function bindSheet() {
      if (!sheet) return;
      const form = sheet.querySelector('[data-destination-form]');
      const startLat = sheet.querySelector('#destinationStartLat');
      const startLon = sheet.querySelector('#destinationStartLon');
      const endLat = sheet.querySelector('#destinationEndLat');
      const endLon = sheet.querySelector('#destinationEndLon');
      sheet.querySelector('[data-destination-coordinates]')?.addEventListener('click',()=>{manualCoordinates=!manualCoordinates;render();});
      sheet.querySelector('[data-destination-close]')?.addEventListener('click', () => closePlanner());
      sheet.querySelector('[data-destination-cancel]')?.addEventListener('click', () => {
        controller.cancel('user-cancel');
        closePlanner();
      });
      sheet.querySelector('[data-destination-gps]')?.addEventListener('click', () => {
        const pos = typeof options.getPrecisePosition === 'function' ? options.getPrecisePosition() : null;
        const result = controller.setPreciseStart(pos);
        if (!result.ok) showToast(result.error.message);
        render();
      });
      sheet.querySelectorAll('[data-destination-pick]').forEach(button => {
        button.addEventListener('click', () => beginMapPick(button.getAttribute('data-destination-pick')));
      });
      form?.addEventListener('submit', ev => {
        ev.preventDefault();
        const a = manualCoordinates ? controller.setManualStart(startLat && startLat.value, startLon && startLon.value) : {ok:!!controller.state().start};
        const b = manualCoordinates ? controller.setManualEnd(endLat && endLat.value, endLon && endLon.value) : {ok:!!controller.state().end};
        if (!a.ok || !b.ok) { render(); return; }
        controller.preview().then(render);
      });
      sheet.querySelector('[data-destination-begin]')?.addEventListener('click', () => {
        const result = controller.begin();
        if (result && result.status !== 'committed') showToast('Destination was not saved: ' + (result.status || 'begin failed'));
        render();
      });
      sheet.querySelector('[data-destination-finish]')?.addEventListener('click', () => {
        if (!confirmAction('Finish this destination walk by honor confirmation? Any route you took counts; GPS checkpoints are not required.')) return;
        const result = timelineController.finishWalk({ confirmed: true, gpsTicks: 0, usedSuggestedTrack: false });
        if (result && result.status !== 'committed') showToast('Walk finish could not save: ' + (result.status || 'failed'));
        render();
      });
      sheet.querySelector('[data-destination-complete]')?.addEventListener('click', () => {
        if (!confirmAction('Complete this destination story and claim the saved reward?')) return;
        const result = timelineController.completeQuest({ confirmed: true });
        if (result && !['committed', 'duplicate'].includes(result.status)) showToast('Destination completion could not save: ' + (result.status || 'failed'));
        render();
      });
      sheet.querySelectorAll('[data-destination-entry]').forEach(button => {
        button.addEventListener('click', () => openNativeEntry(button.getAttribute('data-destination-entry')));
      });
      sheet.querySelectorAll('[data-destination-archive]').forEach(button => {
        button.addEventListener('click', () => {
          archiveViewId = button.getAttribute('data-destination-archive');
          render();
        });
      });
      sheet.querySelector('[data-destination-archive-list]')?.addEventListener('click', () => {
        archiveViewId = null;
        render();
      });
      sheet.querySelectorAll('[data-destination-archive-entry]').forEach(button => {
        button.addEventListener('click', () => openArchivedEntry(button.getAttribute('data-destination-archive-entry')));
      });
      sheet.querySelector('[data-destination-open-active]')?.addEventListener('click', () => {
        const active = typeof options.activeQuest === 'function' ? options.activeQuest() : null;
        if (active) render();
      });
    }
    function beginMapPick(kind) {
      manualCoordinates = false;
      const map = getMap();
      if (!map || typeof map.on !== 'function') {
        showToast('Open the map, then tap to choose a point.');
        return;
      }
      cleanupMapPick();
      if (typeof options.setMapInspectionMode === 'function') options.setMapInspectionMode(true);
      doc.body.classList.add('destination-map-picking');
      const handler = ev => {
        const lngLat = ev && ev.lngLat;
        const lat = lngLat && number(lngLat.lat);
        const lon = lngLat && number(lngLat.lng);
        cleanupMapPick();
        if (lat == null || lon == null) {
          showToast('That map tap did not have coordinates. Try again or use the inputs.');
          return;
        }
        if (kind === 'start') controller.setMapStart(lat, lon);
        else controller.setMapEnd(lat, lon);
        render();
        if(controller.state().start && controller.state().end) {
          options.fitRoute?.([controller.state().start,controller.state().end]);
          controller.preview().then(render);
        }
        if(kind === 'start' && !controller.state().end) queueMicrotask(()=>{if(sheet?.classList.contains('open'))beginMapPick('end');});
      };
      mapPick = { map, handler, kind };
      map.on('click', handler);
      render();
      showToast('Tap the map to choose the ' + (kind === 'start' ? 'start' : 'destination') + '. You can still pan and zoom first.');
    }
    async function openNativeEntry(entryId, choice) {
      const result = await timelineController.openEntry(entryId, choice || { choiceId: 'open' });
      if (result && !['committed', 'duplicate'].includes(result.status)) {
        showToast(result.status === 'not-discovered' ? (result.reason || 'Walk within 45 m to discover this stop first.') : 'Destination stop could not save: ' + (result.status || 'failed'));
      }
      render();
      return result;
    }
    async function openArchivedEntry(entryId) {
      const archive = timelineController.archive();
      const record = archive.find(item => item.id === archiveViewId);
      const entry = record && Array.isArray(record.entries) ? record.entries.find(item => item.id === entryId) : null;
      if (!entry) return;
      if (options.prepareNative && await options.prepareNative(entry) === false) { showToast('This saved stop could not open. Try again.'); return; }
      const action = entry.nativeAction || {};
      if (nativeHandlers && action.method && typeof nativeHandlers[action.method] === 'function') {
        nativeHandlers[action.method](entry, Object.assign({}, action.payload || {}, {
          archived: true,
          receipt: entry.outcome || record.receipts && record.receipts.encounters && record.receipts.encounters[entry.id] || null,
          phase: 'completed'
        }));
      } else {
        showToast(text(entry.label || entry.name || entry.commonName || entry.species, 'Destination stop') + ' is archived.');
      }
    }
    function openPlanner() {
      if (disposed) return false;
      closeLegacyPanels();
      cleanupMapPick();
      if (typeof options.switchScreen === 'function') options.switchScreen('map');
      const precise = typeof options.getPrecisePosition === 'function' ? options.getPrecisePosition() : null;
      if (precise && !controller.state().start) controller.setPreciseStart(precise);
      ensureSheet().classList.add('open');
      doc.body.classList.add('destination-quest-open');
      options.setMapInspectionMode?.(true);
      render();
      focusFirst();
      emitOpen();
    }
    function emitOpen() {
      if (typeof options.onOpen === 'function') {
        try { options.onOpen(controller.state()); } catch (_) {}
      }
    }
    function closePlanner(opts) {
      opts = opts || {};
      if(!opts.keepActive) { timelineController.cancelPending(); options.onClose?.(); }
      cleanupMapPick();
      if (!opts.keepActive) controller.cancel('planner-closed');
      if (sheet) sheet.classList.remove('open');
      doc.body.classList.remove('destination-quest-open');
      options.setMapInspectionMode?.(false);
      refreshMapRoute();
    }
    function wireMainButton() {
      const btn = doc.getElementById('mapQuestShowBtn');
      if (!btn) return;
      btn.dataset.wired = 'destination-main';
      btn.dataset.destinationQuestWired = '1';
      btn.setAttribute('aria-label', 'Open Main Quests destination planner');
      btn.setAttribute('aria-pressed', 'false');
      mainButton = btn;
      mainHandler = ev => {
        ev.preventDefault();
        if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
        else ev.stopPropagation();
        if (typeof options.tap === 'function') options.tap();
        openPlanner();
      };
      btn.addEventListener('click', mainHandler, true);
    }
    function onKeyDown(ev) {
      if (ev.key !== 'Escape' || !sheet?.classList.contains('open')) return;
      ev.preventDefault();
      closePlanner();
      mainButton?.focus?.({ preventScroll: true });
    }
    function onPageHide() { closePlanner(); }
    function dispose() {
      if (disposed) return;
      closePlanner();
      disposed = true;
      clearPreviewLayer();
      routeMap?.off?.('style.load', onMapStyleLoad);
      routeMap = null;
      if (mainButton && mainHandler) {
        mainButton.removeEventListener('click', mainHandler, { capture: true });
        delete mainButton.dataset.destinationQuestWired;
        if (mainButton.dataset.wired === 'destination-main') delete mainButton.dataset.wired;
      }
      doc.removeEventListener?.('keydown', onKeyDown);
      root.removeEventListener?.('pagehide', onPageHide);
      sheet?.remove();
      sheet = null;
    }
    wireMainButton();
    doc.addEventListener?.('keydown', onKeyDown);
    root.addEventListener?.('pagehide', onPageHide);
    nativeHandlers = Object.assign({}, options.nativeHandlers || {});

    return Object.assign(controller, {
      openPlanner,
      closePlanner,
      dispose,
      render,
      drawPreview,
      refreshMapRoute,
      clearPreviewLayer,
      cleanupMapPick,
      activeHandoff: () => {
        const active = typeof options.activeQuest === 'function' ? options.activeQuest() : null;
        return active ? clone(active) : null;
      },
      timelineHandoff: () => {
        return timelineController.entries();
      },
      finishDestinationWalk: opts => timelineController.finishWalk(Object.assign({ confirmed: true }, opts || {})),
      openDestinationEntry: openNativeEntry,
      completeDestinationQuest: opts => timelineController.completeQuest(Object.assign({ confirmed: true }, opts || {})),
      archiveHandoff: () => timelineController.archive(),
      timelineState: () => timelineController.state(),
      mapPickState: () => mapPick ? { kind: mapPick.kind } : null,
      nativeHandlers: value => {
        if (value) nativeHandlers = Object.assign({}, nativeHandlers, value);
        return Object.keys(nativeHandlers || {});
      },
      setManualPoints: (start, end) => {
        if (start) controller.setManualStart(start.lat, start.lon);
        if (end) controller.setManualEnd(end.lat, end.lon);
        render();
        return controller.state();
      }
    });
  }

  return Object.freeze({
    VERSION,
    PIN,
    createPlannerController,
    createTimelineController,
    attach,
    distanceLabel,
    pointLabel
  });
});
