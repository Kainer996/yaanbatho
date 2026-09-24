// Burbz Bird Patch Map — where does the bird you just heard live?
//
// When Merlin's wand hears a bird, or a photo names one, this draws the real
// map around the player with a circle in that bird's colour. The circle is
// the bird's home patch: small for a robin, miles wide for a raven. It pulses
// while the bird is still singing and settles when it goes quiet.
//
// Every meeting is saved on this phone only. Meet the same kind of bird in
// the same patch again and Merlin says so: it is almost certainly the same
// bird. That is the lesson Yaan wanted Burbz to teach — birds are not all
// over the place; the two tawny owls at work are the same two owls.
//
// Logic lives in bird_home_range_core.js. This file owns the DOM, MapLibre
// layers, GPS and the pulse. It needs the host page to call configure().
(function (root) {
  'use strict';
  const Core = root.BurbzBirdHomeRangeCore;
  if (!Core) return;

  const VERSION = 'bird-patch-map-v463-20260924';
  // One BirdNET window is five seconds and hops every 2.5 s. A bird that
  // keeps singing lands in the next window before this runs out.
  const SONG_MS = 5200;
  const PULSE_MS = 1100;
  const FIX_FRESH_MS = 2 * 60 * 1000;
  const FIX_MAX_ACCURACY_M = 150;
  const FAITHFUL_LABEL = { life: 'Stays for life', season: 'Stays all season', roams: 'Roams widely' };

  const deps = {
    loadMapLibre: () => (root.maplibregl ? Promise.resolve() : Promise.reject(new Error('Map unavailable'))),
    mapStyle: () => 'https://tiles.openfreemap.org/styles/liberty',
    fallbackPosition: () => null,
    toast: () => {},
    openLiveMap: null,
    storage: null
  };
  const state = {
    mini: null, miniReady: false, miniLoading: null,
    live: null,
    watchId: null, fix: null,
    here: null,
    singing: new Map(), // key -> { patch, until }
    raf: 0,
    lastLesson: null,
    closedAt: 0, hideTimer: 0,
    data: {} // last GeoJSON sent to each source, for tests
  };

  function $(id) { return root.document ? root.document.getElementById(id) : null; }
  function storage() {
    if (deps.storage) return deps.storage;
    try { return root.localStorage; } catch (_) { return null; }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function configure(opts) {
    Object.assign(deps, opts || {});
    wirePanel();
    return api;
  }

  // ---------------------------------------------------------------- GPS
  function geolocation() {
    const test = root.__burbzSoundTestDeps;
    if (test && typeof test.getCurrentPosition === 'function') {
      return { getCurrentPosition: test.getCurrentPosition, watchPosition: null, clearWatch: null };
    }
    const g = root.navigator && root.navigator.geolocation;
    if (!g) return null;
    return {
      getCurrentPosition: g.getCurrentPosition.bind(g),
      watchPosition: g.watchPosition ? g.watchPosition.bind(g) : null,
      clearWatch: g.clearWatch ? g.clearWatch.bind(g) : null
    };
  }

  function fromPosition(pos) {
    if (!pos || !pos.coords) return null;
    const lat = Number(pos.coords.latitude), lng = Number(pos.coords.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, accuracy: Number(pos.coords.accuracy) || 50, at: Number(pos.timestamp) || Date.now() };
  }

  function goodFix(fix) {
    return !!fix && Date.now() - fix.at <= FIX_FRESH_MS && fix.accuracy <= FIX_MAX_ACCURACY_M;
  }

  // While Merlin listens, keep a precise fix so each hearing lands where the
  // player really stands. The watch stops the moment listening stops.
  function setListening(on) {
    const geo = geolocation();
    if (on && state.watchId == null && geo && geo.watchPosition) {
      try {
        state.watchId = geo.watchPosition(pos => {
          const fix = fromPosition(pos);
          if (fix) { state.fix = fix; state.here = fix; drawHere(); }
        }, () => {}, { enableHighAccuracy: true, maximumAge: 30000, timeout: 20000 });
      } catch (_) { state.watchId = null; }
    } else if (!on && state.watchId != null) {
      try { geo && geo.clearWatch && geo.clearWatch(state.watchId); } catch (_) {}
      state.watchId = null;
    }
  }

  function currentPosition() {
    if (goodFix(state.fix)) return Promise.resolve(state.fix);
    try {
      const fb = deps.fallbackPosition && deps.fallbackPosition();
      if (fb && Number.isFinite(fb.lat) && Number.isFinite(fb.lng) && goodFix(Object.assign({ accuracy: 50, at: Date.now() }, fb))) {
        return Promise.resolve(Object.assign({ accuracy: 50, at: Date.now() }, fb));
      }
    } catch (_) {}
    const geo = geolocation();
    if (!geo) return Promise.resolve(null);
    return new Promise(resolve => {
      let done = false;
      const finish = v => { if (!done) { done = true; resolve(v); } };
      setTimeout(() => finish(null), 9000);
      try {
        geo.getCurrentPosition(pos => {
          const fix = fromPosition(pos);
          if (fix) state.fix = fix;
          finish(fix);
        }, () => finish(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
      } catch (_) { finish(null); }
    });
  }

  // ---------------------------------------------------------------- GeoJSON
  function circle(center, radiusM, props, steps) {
    const n = steps || 72;
    const ring = [];
    const latR = center.lat * Math.PI / 180;
    const dLat = radiusM / 111320;
    const dLng = radiusM / (111320 * Math.max(0.05, Math.cos(latR)));
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      ring.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
    }
    return { type: 'Feature', properties: props || {}, geometry: { type: 'Polygon', coordinates: [ring] } };
  }

  function collection(features) { return { type: 'FeatureCollection', features }; }

  function knownFeatures() {
    return Core.knownPatches(Core.loadLog(storage())).map(p =>
      circle(p.center, Math.max(Core.MIN_MATCH_M, p.range.radiusM), { color: p.range.color, name: p.name, visits: p.visits }));
  }

  function songFeatures() {
    const out = [];
    state.singing.forEach(s => {
      out.push(circle(s.patch.center, Math.max(Core.MIN_MATCH_M, s.patch.range.radiusM),
        { color: s.patch.range.color, name: s.name }));
    });
    return out;
  }

  function hereFeature() {
    if (!state.here) return collection([]);
    return collection([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [state.here.lng, state.here.lat] } }]);
  }

  // ---------------------------------------------------------------- layers
  function addLayers(map, prefix) {
    if (!map || map.getSource(prefix + '-known')) return;
    map.addSource(prefix + '-known', { type: 'geojson', data: collection([]) });
    map.addSource(prefix + '-song', { type: 'geojson', data: collection([]) });
    map.addLayer({ id: prefix + '-known-fill', type: 'fill', source: prefix + '-known',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.07 } });
    map.addLayer({ id: prefix + '-known-line', type: 'line', source: prefix + '-known',
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.4, 'line-opacity': 0.55, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: prefix + '-song-fill', type: 'fill', source: prefix + '-song',
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.16 } });
    map.addLayer({ id: prefix + '-song-line', type: 'line', source: prefix + '-song',
      paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-opacity': 0.95 } });
  }

  function setData(map, id, data) {
    try { const src = map && map.getSource(id); if (src) { src.setData(data); state.data[id] = data; } } catch (_) {}
  }

  function refreshMap(map, prefix) {
    if (!map) return;
    setData(map, prefix + '-known', collection(knownFeatures()));
    setData(map, prefix + '-song', collection(songFeatures()));
  }

  // The live Map screen calls this from its own source setup, so the layers
  // come back after any style reload.
  function attachLiveMap(map) {
    if (!map) return;
    state.live = map;
    try { addLayers(map, 'burbz-bird-patch'); refreshMap(map, 'burbz-bird-patch'); }
    catch (err) { if (!/Style is not done loading/i.test(String(err && err.message || err))) console.warn('BURBZ bird patch layers', err); }
  }

  // ---------------------------------------------------------------- mini map
  function ensureMini() {
    if (state.miniReady) return Promise.resolve(state.mini);
    if (state.miniLoading) return state.miniLoading;
    const el = $('birdPatchMap');
    if (!el) return Promise.resolve(null);
    state.miniLoading = Promise.resolve(deps.loadMapLibre()).then(() => {
      const gl = root.maplibregl;
      if (!gl) throw new Error('Map unavailable');
      const c = state.here || { lat: 54.45, lng: -2.65 };
      const map = new gl.Map({ container: el, style: deps.mapStyle(), center: [c.lng, c.lat], zoom: 15,
        interactive: false, attributionControl: false, fadeDuration: 0,
        pixelRatio: Math.min(2, root.devicePixelRatio || 1) });
      state.mini = map;
      return new Promise(resolve => {
        map.on('load', () => {
          addLayers(map, 'patch');
          map.addSource('patch-here', { type: 'geojson', data: hereFeature() });
          map.addLayer({ id: 'patch-here-halo', type: 'circle', source: 'patch-here',
            paint: { 'circle-radius': 11, 'circle-color': '#f0c767', 'circle-opacity': 0.28 } });
          map.addLayer({ id: 'patch-here-dot', type: 'circle', source: 'patch-here',
            paint: { 'circle-radius': 5.5, 'circle-color': '#f0c767', 'circle-stroke-color': '#07100c', 'circle-stroke-width': 2 } });
          state.miniReady = true;
          refreshMap(map, 'patch');
          frameMini();
          startPulse();
          resolve(map);
        });
      });
    }).catch(err => {
      const panel = $('birdPatchPanel');
      if (panel) panel.classList.add('no-map');
      console.warn('BURBZ bird patch map unavailable', err);
      return null;
    }).finally(() => { state.miniLoading = null; });
    return state.miniLoading;
  }

  function drawHere() {
    if (state.miniReady) setData(state.mini, 'patch-here', hereFeature());
  }

  // Frame the biggest singing patch, or the player, so the whole circle shows.
  function frameMini() {
    const map = state.mini;
    if (!map || !state.miniReady) return;
    let radius = 120, center = state.here;
    state.singing.forEach(s => {
      if (s.patch.range.radiusM >= radius || !center) { radius = s.patch.range.radiusM; center = s.patch.center; }
    });
    if (!center) return;
    const r = Math.max(Core.MIN_MATCH_M, radius) * 1.15;
    const dLat = r / 111320, dLng = r / (111320 * Math.max(0.05, Math.cos(center.lat * Math.PI / 180)));
    try {
      map.fitBounds([[center.lng - dLng, center.lat - dLat], [center.lng + dLng, center.lat + dLat]],
        { padding: 14, duration: 600, maxZoom: 17.5 });
    } catch (_) {}
  }

  // ---------------------------------------------------------------- pulse
  function pulse(now) {
    const t = now || Date.now();
    let live = false;
    state.singing.forEach((s, key) => { if (s.until > Date.now()) live = true; else { s.quiet = true; } });
    const still = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const wave = still ? 1 : 0.5 + 0.5 * Math.sin((t % PULSE_MS) / PULSE_MS * Math.PI * 2);
    const fill = live ? 0.1 + 0.28 * wave : 0.14;
    const width = live ? 2 + 3 * wave : 2.4;
    for (const [map, prefix] of [[state.miniReady ? state.mini : null, 'patch'], [state.live, 'burbz-bird-patch']]) {
      if (!map) continue;
      try {
        if (map.getLayer(prefix + '-song-fill')) map.setPaintProperty(prefix + '-song-fill', 'fill-opacity', fill);
        if (map.getLayer(prefix + '-song-line')) map.setPaintProperty(prefix + '-song-line', 'line-width', width);
      } catch (_) {}
    }
    const panel = $('birdPatchPanel');
    if (panel) panel.classList.toggle('is-singing', live);
    // Reduced motion: no pulse, just a brighter circle until the song ends.
    if (live && still) state.raf = setTimeout(() => { state.raf = 0; pulse(Date.now()); }, 500);
    else if (live && root.requestAnimationFrame) state.raf = root.requestAnimationFrame(pulse);
    else state.raf = 0;
  }

  function startPulse() {
    if (!state.raf && root.requestAnimationFrame) state.raf = root.requestAnimationFrame(pulse);
  }

  // ---------------------------------------------------------------- panel
  function wirePanel() {
    const open = $('birdPatchOpenMap');
    if (open && !open.dataset.wired) {
      open.dataset.wired = '1';
      open.addEventListener('click', () => {
        const c = (state.lastLesson && state.lastLesson.center) || state.here;
        hidePanel();
        if (typeof deps.openLiveMap === 'function') deps.openLiveMap(c);
      });
    }
    const close = $('birdPatchClose');
    if (close && !close.dataset.wired) {
      close.dataset.wired = '1';
      close.addEventListener('click', () => { state.closedAt = Date.now(); hidePanel(); });
    }
  }

  function panelOpen() { const p = $('birdPatchPanel'); return !!p && !p.hidden; }

  function hidePanel() {
    const panel = $('birdPatchPanel');
    if (panel) panel.hidden = true;
    clearTimeout(state.hideTimer);
  }

  // Sit just above the dock, wherever the dock is on this phone.
  function placePanel(panel) {
    const doc = root.document;
    const nav = doc && (doc.getElementById('bottomDock') || doc.querySelector('.bottom-nav'));
    const r = nav && nav.getBoundingClientRect();
    const bottom = r && r.height ? Math.max(12, (root.innerHeight || 0) - r.top + 10) : 16;
    panel.style.setProperty('--bird-patch-bottom', Math.round(bottom) + 'px');
  }

  function showPanel() {
    const panel = $('birdPatchPanel');
    if (!panel) return;
    panel.hidden = false;
    placePanel(panel);
    ensureMini().then(map => { if (map) { try { map.resize(); } catch (_) {} frameMini(); } });
  }

  // The live Map screen draws the circles itself; the card would cover them.
  function onLiveMapScreen() {
    const el = $('screen-map');
    return !!el && el.classList.contains('active');
  }

  function renderLegend() {
    const list = $('birdPatchLegend');
    if (!list) return;
    const rows = [];
    state.singing.forEach(s => {
      const r = s.patch.range;
      rows.push('<li class="' + (s.until > Date.now() ? 'singing' : '') + '"><i style="background:' + esc(r.color) + '"></i><b>' + esc(s.name) +
        '</b><span>' + (r.estimated ? 'about ' : '') + esc(Core.formatDistance(r.radiusM)) + ' · ' + esc(FAITHFUL_LABEL[r.faithful] || '') +
        (s.patch.visits > 1 ? ' · visit ' + s.patch.visits : '') + '</span></li>');
    });
    list.innerHTML = rows.join('');
  }

  function renderLesson(lesson, name, color) {
    const box = $('birdPatchLesson');
    if (!box || !lesson) return;
    box.hidden = false;
    box.style.setProperty('--patch-color', color);
    box.dataset.kind = lesson.kind;
    box.innerHTML = '<strong>' + esc(lesson.title) + '</strong><span>' + esc(lesson.text) + '</span>';
  }

  // ---------------------------------------------------------------- meet
  // birds: [{ commonName | species }]. Called by the host after a confirmed
  // sound window or photo. Returns the lessons, mainly for tests.
  async function meet(birds, opts) {
    const o = opts || {};
    const list = (Array.isArray(birds) ? birds : [birds]).filter(Boolean);
    if (!list.length) return [];
    const fix = await currentPosition();
    if (fix) { state.here = fix; drawHere(); }
    const lessons = [];
    let log = Core.loadLog(storage());
    const lessonRank = { 'same-bird': 4, first: 3, neighbour: 2, 'same-visit': 1 };
    let best = null;
    for (const bird of list) {
      const name = bird.commonName || bird.species || '';
      if (!name) continue;
      const rangeOpts = { massG: o.massFor ? o.massFor(bird) : undefined, guild: o.guildFor ? o.guildFor(bird) : undefined, via: o.source };
      if (!fix) {
        const range = Core.rangeFor(name, rangeOpts);
        lessons.push({ name, lesson: { kind: 'no-location', title: name + ' roams about ' + Core.formatDistance(range.radiusM),
          text: 'Allow location and Merlin will draw where it lives on the map.' }, range });
        continue;
      }
      const res = Core.recordEncounter(log, name, fix, Object.assign({ now: Date.now() }, rangeOpts));
      log = res.log;
      if (!res.patch) continue;
      state.singing.delete(res.patch.range.key);
      state.singing.set(res.patch.range.key, { patch: res.patch, name, until: Date.now() + SONG_MS });
      while (state.singing.size > 8) state.singing.delete(state.singing.keys().next().value);
      const entry = { name, lesson: res.lesson, range: res.patch.range, center: res.patch.center };
      lessons.push(entry);
      if (!best || (lessonRank[res.lesson.kind] || 0) > (lessonRank[best.lesson.kind] || 0)) best = entry;
    }
    if (fix) Core.saveLog(storage(), log);
    if (!best && lessons.length) best = lessons[0];
    if (best) {
      renderLesson(best.lesson, best.name, best.range.color);
      state.lastLesson = best;
      // A bird still singing on the same visit never reopens a closed card.
      const teaches = best.lesson.kind !== 'same-visit';
      const wanted = panelOpen() || teaches || !state.closedAt;
      if (wanted && !onLiveMapScreen()) {
        showPanel();
        clearTimeout(state.hideTimer);
        state.hideTimer = setTimeout(hidePanel, 25000);
      } else if (teaches) {
        try { deps.toast('📍 ' + best.lesson.title + ' — ' + best.lesson.text); } catch (_) {}
      }
    }
    renderLegend();
    refreshMap(state.miniReady ? state.mini : null, 'patch');
    refreshMap(state.live, 'burbz-bird-patch');
    frameMini();
    startPulse();
    // Settle the legend once the song window closes.
    setTimeout(renderLegend, SONG_MS + 50);
    return lessons;
  }

  const api = { VERSION, SONG_MS, configure, meet, setListening, attachLiveMap, circle, hide: hidePanel,
    get state() { return state; } };
  root.BurbzBirdPatchMap = api;
})(typeof window !== 'undefined' ? window : globalThis);
