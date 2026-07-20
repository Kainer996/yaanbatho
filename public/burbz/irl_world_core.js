// Burbz IRL World — Skyrim-style settlements on the live walking map.
// Every ~1 km grid cell of the real world gets a deterministic medieval
// settlement: low-poly 3D buildings (mead hall, tavern, smithy, mage tower,
// standing stones, market stall) rendered through a MapLibre custom three.js
// layer, plus named RPG questgivers who hand out daily walk-to quests.
// The vector-tile building extrusions are also restyled from modern grey to
// weathered timber-and-stone so the whole map reads like one Nordic hold.
//
// Pure logic (settlement layout, quest generation, proximity state machine)
// is exported for the node-based tests; anything touching the DOM, MapLibre
// or THREE only runs inside the browser after init().
(function () {
  'use strict';

  var LAYER_ID = 'burbz-irl-3d';
  var STORE_KEY = 'burbzIrlWorld_v1';
  var HAIL_RADIUS_M = 60;
  var SETTLEMENT_REBUILD_M = 900;
  var DEFAULT_REACH_M = 45;

  // ---------------------------------------------------------------------------
  // Deterministic helpers (self-contained so the module runs under node tests)
  // ---------------------------------------------------------------------------
  function iwHash(str) {
    var h = 2166136261 >>> 0;
    var s = String(str);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function iwRandom(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function distMeters(a, b) {
    var lat1 = a.lat * Math.PI / 180, lat2 = b.lat * Math.PI / 180;
    var dLat = lat2 - lat1, dLon = (b.lon - a.lon) * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function offsetLatLon(lat, lon, distM, bearingRad) {
    var dLat = (distM * Math.cos(bearingRad)) / 111320;
    var dLon = (distM * Math.sin(bearingRad)) / (111320 * Math.max(0.05, Math.cos(lat * Math.PI / 180)));
    return { lat: lat + dLat, lon: lon + dLon };
  }

  function cellIdFor(lat, lon) {
    return (Math.round(lat * 100) / 100).toFixed(2) + ',' + (Math.round(lon * 100) / 100).toFixed(2);
  }

  function dayStamp(when) {
    var d = when ? new Date(when) : new Date();
    var mo = String(d.getMonth() + 1), da = String(d.getDate());
    return d.getFullYear() + '-' + (mo.length < 2 ? '0' + mo : mo) + '-' + (da.length < 2 ? '0' + da : da);
  }

  function questKey(cellId, npcId, day) { return cellId + '|' + npcId + '|' + day; }

  // ---------------------------------------------------------------------------
  // Settlement + NPC roster
  // ---------------------------------------------------------------------------
  var TOWN_PREFIX = ['Wind', 'Iron', 'Raven', 'Frost', 'Oak', 'Ember', 'Stone', 'Wolf', 'Amber', 'Thorn', 'Elder', 'Briar'];
  var TOWN_SUFFIX = ['helm', 'fell', 'garth', 'stead', 'moor', 'hollow', 'watch', 'ford', 'crag', 'vale', 'reach', 'run'];

  var NPC_ROSTER = [
    {
      id: 'jarl', name: 'Jarl Sigrun', role: 'Jarl', emoji: '👑', building: 'meadHall',
      hail: 'Ho, traveller! Come, the mead hall is warm.',
      brief: 'Our boundary stones have gone unchecked since the last snows. Walk the bounds of {town} and lay eyes on each marker for me — bandits pry them loose to move the borders.',
      done: 'The bounds of {town} hold firm. You have the thanks of the hall — and its coin.',
      kind: 'patrol', targetCount: 2, targetEmoji: '🪨',
      targetLabels: ['Old boundary stone', 'Fallen waymarker'],
      title: "The Jarl's Errand", reward: { xp: 60, coins: 26 }
    },
    {
      id: 'smith', name: 'Torvald Emberhand', role: 'Blacksmith', emoji: '⚒️', building: 'smithy',
      hail: 'Mind the sparks, friend.',
      brief: 'These blades came off the grindstone at dawn and the watchtower guard is still swinging rust. Carry the bundle up to the tower for me — my forge cannot mind itself.',
      done: 'The guard swings true steel again. Fair pay for honest legs.',
      kind: 'delivery', targetCount: 1, targetEmoji: '🗡️', deliveryTo: 'tower',
      targetLabels: ['The watchtower armoury'],
      title: 'Steel for the Watch', reward: { xp: 40, coins: 18 }
    },
    {
      id: 'alchemist', name: 'Alva Nightbloom', role: 'Alchemist', emoji: '🧪', building: 'stall',
      hail: 'You smell of the road. Excellent — the road is where the herbs are.',
      brief: 'My cauldron wants three things I cannot leave it to gather: nightshade, wild nettle and moonbell. They grow at the spots I have marked on your map. Walk to each and pick clean.',
      done: 'Nightshade, nettle, moonbell — all fresh! The draught will be potent. Your share, as promised.',
      kind: 'gather', targetCount: 3, targetEmoji: '🌿',
      targetLabels: ['Nightshade patch', 'Wild nettle thicket', 'Moonbell cluster'],
      title: 'Nightshade & Nettle', reward: { xp: 50, coins: 20 }
    },
    {
      id: 'mage', name: 'Mirael the Veiled', role: 'Court Mage', emoji: '🔮', building: 'tower',
      hail: 'The stones have been whispering your name. Curious.',
      brief: 'The standing stones beyond the settlement hum with old magic tonight. Stand within their circle, listen, and bring me word of what you feel. Do not touch the runestone.',
      done: 'Yes... the resonance clings to you still. You touched the runestone, didn\'t you? No matter — the reading is clear. Take this for your trouble.',
      kind: 'visit', targetCount: 1, targetEmoji: '🗿', targetAt: 'stones',
      targetLabels: ['The Standing Stones'],
      title: 'Whispers at the Stones', reward: { xp: 55, coins: 22 }
    },
    {
      id: 'innkeep', name: 'Sigrid Honeybrook', role: 'Innkeeper', emoji: '🍺', building: 'tavern',
      hail: 'Welcome to the hearth! Mind the dog.',
      brief: 'My delivery cart lost a keg of honeyed mead on the road last night. I\'ve marked where the wheel tracks veer off. Roll it back before the foxes learn to drink.',
      done: 'The keg! Barely a scratch on it. First cup\'s yours forever — and here, coin for your boots.',
      kind: 'fetch', targetCount: 1, targetEmoji: '🛢️',
      targetLabels: ['The lost mead keg'],
      title: 'The Lost Keg', reward: { xp: 35, coins: 15 }
    },
    {
      id: 'bard', name: 'Finn Larkspur', role: 'Bard', emoji: '🪕', building: 'stones',
      hail: 'Hail! You walk like someone with a story.',
      brief: 'I\'m composing a walking song for {town} and every verse needs a view. Visit the two lookouts I\'ve marked and the song will carry your footsteps in it forever.',
      done: 'Two verses, two views, one fine walker! When they sing this in {town}, that\'s you in the third line. Your cut of the hat, friend.',
      kind: 'patrol', targetCount: 2, targetEmoji: '🎵',
      targetLabels: ['First verse lookout', 'Second verse lookout'],
      title: 'A Song for the Road', reward: { xp: 45, coins: 18 }
    }
  ];

  function rosterById(id) {
    for (var i = 0; i < NPC_ROSTER.length; i++) if (NPC_ROSTER[i].id === id) return NPC_ROSTER[i];
    return null;
  }

  // Deterministic per ~1 km grid cell: same place, same hold, same folk.
  function buildSettlement(lat, lon) {
    var cellId = cellIdFor(lat, lon);
    var seed = iwHash('irl-settlement:' + cellId);
    var rand = iwRandom(seed);
    var name = TOWN_PREFIX[Math.floor(rand() * TOWN_PREFIX.length)] + TOWN_SUFFIX[Math.floor(rand() * TOWN_SUFFIX.length)];
    var anchor = { lat: lat, lon: lon };
    var baseBearing = rand() * Math.PI * 2;
    var landmarks = [];
    var npcs = [];
    NPC_ROSTER.forEach(function (def, i) {
      var bearing = baseBearing + i * (Math.PI * 2 / NPC_ROSTER.length) + (rand() - 0.5) * 0.5;
      var dist = 85 + rand() * 130;
      var pos = offsetLatLon(lat, lon, dist, bearing);
      landmarks.push({ type: def.building, lat: pos.lat, lon: pos.lon, rotation: rand() * Math.PI * 2 });
      // The questgiver stands a few strides clear of their building, not on the roof.
      var stand = offsetLatLon(pos.lat, pos.lon, 11, bearing + Math.PI / 2);
      npcs.push({ id: def.id, name: def.name, lat: stand.lat, lon: stand.lon, hailed: false });
    });
    return { cellId: cellId, seed: seed, name: name, anchor: anchor, npcs: npcs, landmarks: landmarks };
  }

  function findLandmark(settlement, type) {
    for (var i = 0; i < settlement.landmarks.length; i++) if (settlement.landmarks[i].type === type) return settlement.landmarks[i];
    return null;
  }

  // Daily radiant quest for one NPC: seeded by cell + npc + day so the whole
  // hold hands out fresh work every real-world morning.
  function buildQuestForNpc(npc, settlement, day) {
    var def = rosterById(npc.id);
    if (!def) return null;
    var rand = iwRandom(iwHash('irl-quest:' + settlement.cellId + ':' + npc.id + ':' + day));
    var targets = [];
    for (var i = 0; i < def.targetCount; i++) {
      var pos;
      var fixedAt = def.targetAt || def.deliveryTo;
      if (fixedAt) {
        var lm = findLandmark(settlement, fixedAt);
        pos = lm ? { lat: lm.lat, lon: lm.lon } : offsetLatLon(settlement.anchor.lat, settlement.anchor.lon, 150, rand() * Math.PI * 2);
      } else {
        pos = offsetLatLon(settlement.anchor.lat, settlement.anchor.lon, 120 + rand() * 200, rand() * Math.PI * 2);
      }
      targets.push({ label: def.targetLabels[i % def.targetLabels.length], emoji: def.targetEmoji, lat: pos.lat, lon: pos.lon, done: false });
    }
    return {
      key: questKey(settlement.cellId, npc.id, day),
      cellId: settlement.cellId, npcId: npc.id, day: day,
      title: def.title,
      targets: targets,
      reward: { xp: def.reward.xp, coins: def.reward.coins },
      state: 'active'
    };
  }

  // Proximity state machine: mark targets reached, then require walking back to
  // the questgiver to turn in. Pure — returns the events the UI should react to.
  function processFix(quest, lat, lon, npc, reachM) {
    var events = [];
    if (!quest || quest.state === 'done') return events;
    var here = { lat: lat, lon: lon };
    var reach = Number.isFinite(reachM) ? reachM : DEFAULT_REACH_M;
    quest.targets.forEach(function (t) {
      if (!t.done && distMeters(here, t) <= reach) { t.done = true; events.push({ type: 'target', quest: quest, target: t }); }
    });
    var remaining = quest.targets.filter(function (t) { return !t.done; }).length;
    if (!remaining && quest.state === 'active') { quest.state = 'return'; events.push({ type: 'all-targets', quest: quest }); }
    if (quest.state === 'return' && npc && distMeters(here, npc) <= reach) { quest.state = 'done'; events.push({ type: 'complete', quest: quest }); }
    return events;
  }

  // ---------------------------------------------------------------------------
  // Vector-tile buildings, restyled Skyrim: timber low-rises, stone keeps.
  // ---------------------------------------------------------------------------
  function extrusionPaint() {
    var h = ['coalesce', ['get', 'render_height'], ['get', 'height'], 5];
    return {
      'fill-extrusion-color': ['interpolate', ['linear'], h,
        0, '#8b7454', 5, '#7c6749', 11, '#6f6a5c', 24, '#7d7869', 60, '#8d8779'],
      'fill-extrusion-height': ['max', 3.2, h],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
      'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 14.7, 0, 15.7, 0.72, 17, 0.84],
      'fill-extrusion-vertical-gradient': true
    };
  }

  function styleExtrusionLayer(map, id) {
    if (!map) return;
    var paint = extrusionPaint();
    try { map.setLayoutProperty(id, 'visibility', 'visible'); } catch (e) {}
    Object.keys(paint).forEach(function (prop) {
      try { map.setPaintProperty(id, prop, paint[prop]); } catch (e) {}
    });
  }

  // If the style ships no 3D building layer at all, clone one off the flat
  // building footprints so the extrusions still appear.
  function ensureExtrusionLayer(map) {
    if (!map) return;
    var style;
    try { style = map.getStyle(); } catch (e) { return; }
    var layers = (style && style.layers) || [];
    var hasExtrusion = false, buildingFill = null, firstSymbol = null;
    layers.forEach(function (layer) {
      if (layer.type === 'fill-extrusion' && /building/i.test(layer.id)) hasExtrusion = true;
      if (!buildingFill && layer.type === 'fill' && /building/i.test(layer['source-layer'] || layer.id)) buildingFill = layer;
      if (!firstSymbol && layer.type === 'symbol') firstSymbol = layer.id;
    });
    if (hasExtrusion || !buildingFill) return;
    try {
      map.addLayer({
        id: 'burbz-irl-extrusions', type: 'fill-extrusion',
        source: buildingFill.source, 'source-layer': buildingFill['source-layer'] || 'building',
        minzoom: 14, paint: extrusionPaint()
      }, firstSymbol || undefined);
    } catch (e) {}
  }

  // ---------------------------------------------------------------------------
  // Runtime state (browser only)
  // ---------------------------------------------------------------------------
  var ctx = null;
  var state = {
    settlement: null,
    activeQuest: null,
    npcMarkers: [],
    targetMarkers: [],
    bannerMarker: null,
    lastPos: null,
    store: { v: 1, completed: {}, active: null }
  };
  var three = { renderer: null, scene: null, camera: null, group: null, transform: null, added: false };

  function storage() { return (typeof localStorage !== 'undefined') ? localStorage : null; }

  function loadStore() {
    var s = storage();
    if (!s) return;
    try {
      var raw = s.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.v === 1) state.store = parsed;
      }
    } catch (e) {}
  }

  function saveStore() {
    var s = storage();
    if (!s) return;
    try {
      var keys = Object.keys(state.store.completed);
      if (keys.length > 240) {
        keys.sort(function (a, b) { return state.store.completed[a] - state.store.completed[b]; });
        keys.slice(0, keys.length - 240).forEach(function (k) { delete state.store.completed[k]; });
      }
      state.store.active = (state.activeQuest && state.activeQuest.state !== 'done') ? state.activeQuest : null;
      s.setItem(STORE_KEY, JSON.stringify(state.store));
    } catch (e) {}
  }

  function init(context) { ctx = context; loadStore(); }

  function reachRadius() {
    try { var r = ctx && ctx.reachRadius && ctx.reachRadius(); if (Number.isFinite(r) && r > 0) return r; } catch (e) {}
    return DEFAULT_REACH_M;
  }

  function onMapReady() {
    var map = ctx && ctx.getMap && ctx.getMap();
    if (!map) return;
    ensureExtrusionLayer(map);
    ensure3dLayer(map);
    if (state.lastPos) ensureSettlement(state.lastPos.lat, state.lastPos.lon);
  }

  // ---------------------------------------------------------------------------
  // three.js custom layer: hand-built low-poly Nordic architecture
  // ---------------------------------------------------------------------------
  function ensure3dLayer(map) {
    if (!map || three.added || typeof window === 'undefined' || !window.THREE) return;
    try { if (map.getLayer(LAYER_ID)) { three.added = true; return; } } catch (e) {}
    var THREE = window.THREE;
    var layer = {
      id: LAYER_ID, type: 'custom', renderingMode: '3d',
      onAdd: function (m, gl) {
        three.camera = new THREE.Camera();
        three.scene = new THREE.Scene();
        three.group = new THREE.Group();
        three.scene.add(three.group);
        // r155+ physical light units: intensities need the ~π boost or the
        // whole hold reads as unlit silhouettes on the dark medieval map.
        three.scene.add(new THREE.HemisphereLight(0xfff6dd, 0x4a5540, 3.2));
        var sun = new THREE.DirectionalLight(0xffe2ac, 4.2);
        sun.position.set(-140, 220, -160);
        three.scene.add(sun);
        three.renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: false });
        three.renderer.autoClear = false;
        rebuildScene();
      },
      render: function (gl, arg) {
        if (!three.renderer || !three.transform) return;
        // MapLibre v4+ hands custom layers an args object; older builds pass the
        // raw matrix. Support both so a lib swap can never blank the buildings.
        var arr = (arg && arg.defaultProjectionData) ? arg.defaultProjectionData.mainMatrix : arg;
        if (!arr || !arr.length) return;
        var t = three.transform;
        var rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        var m = new THREE.Matrix4().fromArray(arr);
        var l = new THREE.Matrix4()
          .makeTranslation(t.x, t.y, t.z)
          .scale(new THREE.Vector3(t.scale, -t.scale, t.scale))
          .multiply(rotX);
        three.camera.projectionMatrix = m.multiply(l);
        three.renderer.resetState();
        three.renderer.render(three.scene, three.camera);
      }
    };
    var beforeId;
    try {
      var layers = map.getStyle().layers || [];
      for (var i = 0; i < layers.length; i++) if (layers[i].type === 'symbol') { beforeId = layers[i].id; break; }
    } catch (e) {}
    try { map.addLayer(layer, beforeId); three.added = true; } catch (e) { console.warn('BURBZ 3D layer failed', e); }
  }

  function disposeGroupChildren() {
    if (!three.group) return;
    while (three.group.children.length) {
      var child = three.group.children.pop();
      child.traverse(function (node) {
        if (node.geometry) node.geometry.dispose();
        if (node.material) { (Array.isArray(node.material) ? node.material : [node.material]).forEach(function (mm) { mm.dispose(); }); }
      });
    }
  }

  function rebuildScene() {
    var map = ctx && ctx.getMap && ctx.getMap();
    if (!map || !three.group || !state.settlement || typeof window === 'undefined' || !window.THREE || !window.maplibregl) return;
    var THREE = window.THREE;
    disposeGroupChildren();
    var a = state.settlement.anchor;
    var mc = window.maplibregl.MercatorCoordinate.fromLngLat([a.lon, a.lat], 0);
    three.transform = { x: mc.x, y: mc.y, z: mc.z || 0, scale: mc.meterInMercatorCoordinateUnits() };
    state.settlement.landmarks.forEach(function (lm) {
      var mesh = buildLandmarkMesh(THREE, lm.type, iwRandom(iwHash(state.settlement.cellId + ':' + lm.type)));
      if (!mesh) return;
      var p = window.maplibregl.MercatorCoordinate.fromLngLat([lm.lon, lm.lat], 0);
      mesh.position.set((p.x - three.transform.x) / three.transform.scale, 0, (p.y - three.transform.y) / three.transform.scale);
      mesh.rotation.y = lm.rotation;
      three.group.add(mesh);
    });
    try { map.triggerRepaint(); } catch (e) {}
  }

  // --- low-poly building kit (y-up metres, origin at ground centre) ---
  function lambert(THREE, color, emissive) {
    var m = new THREE.MeshLambertMaterial({ color: color });
    if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 0.85; }
    return m;
  }

  function addBox(THREE, group, w, h, d, color, x, yBottom, z, emissive) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(THREE, color, emissive));
    mesh.position.set(x, yBottom + h / 2, z);
    group.add(mesh);
    return mesh;
  }

  function addCylinder(THREE, group, rTop, rBottom, h, color, x, yBottom, z, segments) {
    var mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments || 8), lambert(THREE, color));
    mesh.position.set(x, yBottom + h / 2, z);
    group.add(mesh);
    return mesh;
  }

  function addCone(THREE, group, r, h, color, x, yBottom, z, segments) {
    var mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, segments || 8), lambert(THREE, color));
    mesh.position.set(x, yBottom + h / 2, z);
    group.add(mesh);
    return mesh;
  }

  // Pitched roof: a triangular prism with the ridge running along x.
  function roofGeometry(THREE, w, d, h) {
    var hw = w / 2, hd = d / 2;
    var A = [-hw, 0, -hd], B = [hw, 0, -hd], C = [hw, 0, hd], D = [-hw, 0, hd];
    var E = [-hw, h, 0], F = [hw, h, 0];
    var tris = [D, C, F, D, F, E, B, A, E, B, E, F, C, B, F, A, D, E];
    var pos = new Float32Array(tris.length * 3);
    tris.forEach(function (v, i) { pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]; });
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    return geo;
  }

  function addRoof(THREE, group, w, d, h, color, x, yBottom, z) {
    var mat = lambert(THREE, color);
    mat.side = THREE.DoubleSide;
    var mesh = new THREE.Mesh(roofGeometry(THREE, w, d, h), mat);
    mesh.position.set(x, yBottom, z);
    group.add(mesh);
    return mesh;
  }

  function addGroundPatch(THREE, group, radius, color) {
    var mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 12), lambert(THREE, color));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04;
    group.add(mesh);
    return mesh;
  }

  function addTimberFrame(THREE, group, w, h, d, yBottom) {
    // Dark cross-beams over plaster: the classic half-timbered silhouette.
    var beam = '#3d2e1c';
    addBox(THREE, group, w + 0.12, 0.24, d + 0.12, beam, 0, yBottom + h - 0.24, 0);
    addBox(THREE, group, w + 0.12, 0.24, d + 0.12, beam, 0, yBottom, 0);
    addBox(THREE, group, 0.24, h, 0.24, beam, -w / 2, yBottom, -d / 2);
    addBox(THREE, group, 0.24, h, 0.24, beam, w / 2, yBottom, -d / 2);
    addBox(THREE, group, 0.24, h, 0.24, beam, -w / 2, yBottom, d / 2);
    addBox(THREE, group, 0.24, h, 0.24, beam, w / 2, yBottom, d / 2);
  }

  function buildLandmarkMesh(THREE, type, rand) {
    var g = new THREE.Group();
    if (type === 'meadHall') {
      addGroundPatch(THREE, g, 12, '#6a5638');
      addBox(THREE, g, 15, 1.1, 8, '#8a877c', 0, 0, 0);
      addBox(THREE, g, 14, 3.6, 7.2, '#9a7648', 0, 1.1, 0);
      addTimberFrame(THREE, g, 14, 3.6, 7.2, 1.1);
      addRoof(THREE, g, 16.2, 9, 4.4, '#6b5136', 0, 4.7, 0);
      addBox(THREE, g, 16.6, 0.3, 0.5, '#2f2315', 0, 9.0, 0);
      addBox(THREE, g, 1.8, 2.4, 0.3, '#241a10', 0, 1.1, 3.65);
      addBox(THREE, g, 0.4, 5.4, 0.4, '#3d2e1c', 7.6, 0, 3.4);
      addBox(THREE, g, 1.6, 1.1, 0.08, '#c8a24a', 8.5, 4.1, 3.4);
    } else if (type === 'tavern') {
      addGroundPatch(THREE, g, 9, '#6a5638');
      addBox(THREE, g, 8, 2.8, 6, '#cbb896', 0, 0, 0);
      addBox(THREE, g, 8.8, 2.6, 6.8, '#8a6a44', 0, 2.8, 0);
      addTimberFrame(THREE, g, 8, 2.8, 6, 0);
      addRoof(THREE, g, 9.6, 7.6, 3.1, '#7a5a3a', 0, 5.4, 0);
      addBox(THREE, g, 1, 3.2, 1, '#8a877c', 2.6, 6.4, 1.2);
      addBox(THREE, g, 1.6, 2.3, 0.3, '#241a10', -1.4, 0, 3.05);
      addBox(THREE, g, 1.3, 0.9, 0.1, '#d6a84f', 3.2, 3.1, 3.5);
    } else if (type === 'smithy') {
      addGroundPatch(THREE, g, 7, '#5e4d33');
      addBox(THREE, g, 0.35, 3, 0.35, '#3d2e1c', -2.6, 0, -2);
      addBox(THREE, g, 0.35, 3, 0.35, '#3d2e1c', 2.6, 0, -2);
      addBox(THREE, g, 0.35, 3, 0.35, '#3d2e1c', -2.6, 0, 2);
      addBox(THREE, g, 0.35, 3, 0.35, '#3d2e1c', 2.6, 0, 2);
      addRoof(THREE, g, 6.6, 5.4, 2, '#6b5136', 0, 3, 0);
      addBox(THREE, g, 2, 1.2, 1.6, '#7c786e', -1.2, 0, 0);
      addBox(THREE, g, 1.2, 0.7, 1, '#ff7c2a', -1.2, 1.2, 0, '#ff5a00');
      addBox(THREE, g, 0.9, 0.8, 0.5, '#2c2c30', 1.4, 0.5, 0.4);
      addBox(THREE, g, 1.2, 0.5, 0.7, '#6b5136', 1.4, 0, 0.4);
    } else if (type === 'tower') {
      addGroundPatch(THREE, g, 7, '#6a675e');
      addCylinder(THREE, g, 2.9, 3.3, 2, '#7c786e', 0, 0, 0, 8);
      addCylinder(THREE, g, 2.6, 2.9, 8, '#918d83', 0, 2, 0, 8);
      addCone(THREE, g, 3.4, 3.6, '#55647e', 0, 10, 0, 8);
      addBox(THREE, g, 0.7, 1, 0.2, '#ffd98a', 0, 7.4, 2.62, '#ffb347');
      addBox(THREE, g, 0.2, 1, 0.7, '#ffd98a', 2.62, 5.2, 0, '#ffb347');
      addBox(THREE, g, 1.2, 2.1, 0.3, '#241a10', 0, 0.4, 3.1);
    } else if (type === 'stones') {
      addGroundPatch(THREE, g, 6.5, '#525f48');
      for (var i = 0; i < 5; i++) {
        var ang = (i / 5) * Math.PI * 2;
        var stone = addBox(THREE, g, 0.9, 2.4 + rand() * 0.9, 0.55, '#8a9680', Math.cos(ang) * 3.6, 0, Math.sin(ang) * 3.6);
        stone.rotation.y = ang + rand() * 0.5;
        stone.rotation.z = (rand() - 0.5) * 0.16;
      }
      addBox(THREE, g, 1.1, 3.4, 0.7, '#78877a', 0, 0, 0);
      addBox(THREE, g, 0.5, 1.1, 0.72, '#59d6c2', 0, 1.6, 0, '#37bfae');
    } else if (type === 'stall') {
      addGroundPatch(THREE, g, 5.5, '#6a5638');
      addBox(THREE, g, 0.25, 2.6, 0.25, '#3d2e1c', -1.8, 0, -1.2);
      addBox(THREE, g, 0.25, 2.6, 0.25, '#3d2e1c', 1.8, 0, -1.2);
      addBox(THREE, g, 0.25, 2.6, 0.25, '#3d2e1c', -1.8, 0, 1.2);
      addBox(THREE, g, 0.25, 2.6, 0.25, '#3d2e1c', 1.8, 0, 1.2);
      addRoof(THREE, g, 4.6, 3.4, 1.1, '#c05a3e', 0, 2.6, 0);
      addBox(THREE, g, 3.6, 0.9, 2, '#8a6a44', 0, 0.6, 0);
      addBox(THREE, g, 0.8, 0.8, 0.8, '#8a6b3a', -0.9, 1.05, 0.2);
      addBox(THREE, g, 0.7, 0.5, 0.7, '#4f6b35', 0.8, 1.05, -0.1);
    } else {
      return null;
    }
    return g;
  }

  // ---------------------------------------------------------------------------
  // NPC markers, quest targets and dialog UI
  // ---------------------------------------------------------------------------
  function clearMarkers(list) {
    list.forEach(function (mk) { try { mk.remove(); } catch (e) {} });
    list.length = 0;
  }

  function completedToday(npcId) {
    if (!state.settlement) return false;
    return !!state.store.completed[questKey(state.settlement.cellId, npcId, dayStamp())];
  }

  function npcIndicator(npc) {
    if (state.activeQuest && state.activeQuest.npcId === npc.id) {
      return state.activeQuest.state === 'return' ? '✅' : '…';
    }
    if (completedToday(npc.id)) return '';
    return '❗';
  }

  function renderNpcMarkers() {
    var map = ctx && ctx.getMap && ctx.getMap();
    if (!map || !state.settlement || typeof window === 'undefined' || !window.maplibregl) return;
    clearMarkers(state.npcMarkers);
    if (state.bannerMarker) { try { state.bannerMarker.remove(); } catch (e) {} state.bannerMarker = null; }

    var bannerEl = document.createElement('div');
    bannerEl.className = 'quest-marker-pin';
    var banner = document.createElement('div');
    banner.className = 'irl-town-banner';
    banner.textContent = '🏰 ' + state.settlement.name;
    bannerEl.appendChild(banner);
    state.bannerMarker = new window.maplibregl.Marker({ element: bannerEl, anchor: 'bottom' })
      .setLngLat([state.settlement.anchor.lon, state.settlement.anchor.lat]).addTo(map);

    state.settlement.npcs.forEach(function (npc) {
      var def = rosterById(npc.id);
      if (!def) return;
      var el = document.createElement('div');
      el.className = 'quest-marker-pin';
      var face = document.createElement('div');
      face.className = 'quest-marker qm-villager' + (completedToday(npc.id) && (!state.activeQuest || state.activeQuest.npcId !== npc.id) ? ' irl-done' : '');
      face.textContent = def.emoji;
      var indicator = npcIndicator(npc);
      if (indicator) {
        var badge = document.createElement('span');
        badge.className = 'qm-npc-quest';
        badge.textContent = indicator;
        face.appendChild(badge);
      }
      var plate = document.createElement('span');
      plate.className = 'qm-npc-nameplate';
      plate.textContent = def.name;
      face.appendChild(plate);
      el.appendChild(face);
      el.addEventListener('click', function (ev) { ev.stopPropagation(); openNpcDialog(npc); });
      state.npcMarkers.push(new window.maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([npc.lon, npc.lat]).addTo(map));
    });
  }

  function renderTargetMarkers() {
    var map = ctx && ctx.getMap && ctx.getMap();
    if (!map || typeof window === 'undefined' || !window.maplibregl) return;
    clearMarkers(state.targetMarkers);
    var quest = state.activeQuest;
    if (!quest || quest.state === 'done') return;
    quest.targets.forEach(function (t) {
      var el = document.createElement('div');
      el.className = 'quest-marker-pin';
      var face = document.createElement('div');
      face.className = 'quest-marker qm-irl-target' + (t.done ? ' done' : '');
      face.textContent = t.done ? '✔️' : t.emoji;
      el.appendChild(face);
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var here = state.lastPos;
        var away = here ? Math.round(distMeters(here, t)) : null;
        ctx.showToast(t.emoji + ' ' + t.label + (t.done ? ' — claimed!' : (away !== null ? ' — ' + away + ' m away. Walk within ' + Math.round(reachRadius()) + ' m.' : '')));
      });
      state.targetMarkers.push(new window.maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([t.lon, t.lat]).addTo(map));
    });
  }

  function findNpc(npcId) {
    if (!state.settlement) return null;
    for (var i = 0; i < state.settlement.npcs.length; i++) if (state.settlement.npcs[i].id === npcId) return state.settlement.npcs[i];
    return null;
  }

  function fillTown(text) {
    return String(text).replace(/\{town\}/g, state.settlement ? state.settlement.name : 'the settlement');
  }

  function closeNpcDialog() { var el = document.getElementById('irlNpcDialog'); if (el) el.remove(); }

  function openNpcDialog(npc) {
    var def = rosterById(npc.id);
    if (!def || !state.settlement) return;
    closeNpcDialog();
    var esc = ctx.escapeHtml;
    var quest = state.activeQuest;
    var mine = quest && quest.npcId === npc.id && quest.state !== 'done';
    var text, buttons;
    if (mine && quest.state === 'return') {
      var here = state.lastPos;
      if (here && distMeters(here, npc) <= reachRadius()) {
        completeActiveQuest();
        return;
      }
      text = 'You\'ve done the legwork — now walk back to me and we\'ll settle up!';
      buttons = '<button class="wq-npc-ok" data-act="close">On my way</button>';
    } else if (mine) {
      var remaining = quest.targets.filter(function (t) { return !t.done; });
      text = fillTown(def.brief) + ' (' + (quest.targets.length - remaining.length) + '/' + quest.targets.length + ' done — follow the golden markers.)';
      buttons = '<button class="wq-npc-ok" data-act="close">On it</button>';
    } else if (completedToday(npc.id)) {
      text = 'Good work today, friend. Rest those boots — I\'ll have more for you tomorrow.';
      buttons = '<button class="wq-npc-ok" data-act="close">Farewell</button>';
    } else if (quest && quest.state !== 'done') {
      var busyDef = rosterById(quest.npcId);
      text = fillTown(def.hail) + ' But I can see ' + (busyDef ? busyDef.name : 'someone') + ' already has you running about — finish that first.';
      buttons = '<button class="wq-npc-ok" data-act="close">Fair enough</button>';
    } else {
      var preview = buildQuestForNpc(npc, state.settlement, dayStamp());
      text = fillTown(def.brief) + ' (Reward: +' + preview.reward.xp + ' XP, +' + preview.reward.coins + ' coins)';
      buttons = '<button class="wq-npc-ok" data-act="accept">📜 Accept: ' + esc(def.title) + '</button>' +
        '<button class="wq-npc-ok irl-ghost" data-act="close">Not now</button>';
    }
    var el = document.createElement('div');
    el.id = 'irlNpcDialog';
    el.className = 'wq-npc-dialog';
    el.innerHTML = '<div class="wq-npc-panel"><div class="wq-npc-face"><div class="wq-npc-emoji">' + def.emoji + '</div></div>' +
      '<div><div class="wq-npc-name">' + esc(def.name) + ' · ' + esc(def.role) + ' of ' + esc(state.settlement.name) + '</div>' +
      '<div class="wq-npc-text">' + esc(text) + '</div>' +
      '<div class="irl-npc-actions">' + buttons + '</div></div></div>';
    el.addEventListener('click', function (ev) {
      var act = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act');
      if (ev.target === el || act === 'close') { el.remove(); return; }
      if (act === 'accept') { el.remove(); acceptQuest(npc); }
    });
    document.body.appendChild(el);
  }

  function acceptQuest(npc) {
    if (!state.settlement || (state.activeQuest && state.activeQuest.state !== 'done')) return;
    var quest = buildQuestForNpc(npc, state.settlement, dayStamp());
    if (!quest) return;
    state.activeQuest = quest;
    saveStore();
    renderNpcMarkers();
    renderTargetMarkers();
    try { ctx.playSfx('tap'); } catch (e) {}
    ctx.showToast('📜 Quest accepted: ' + quest.title + ' — follow the golden markers!');
  }

  function completeActiveQuest() {
    var quest = state.activeQuest;
    if (!quest) return;
    var def = rosterById(quest.npcId);
    quest.state = 'done';
    state.store.completed[quest.key] = Date.now();
    state.activeQuest = null;
    saveStore();
    renderNpcMarkers();
    renderTargetMarkers();
    try { ctx.addPlayerXp(quest.reward.xp); } catch (e) {}
    try { ctx.addCoins(quest.reward.coins); } catch (e) {}
    closeNpcDialog();
    if (def) {
      var esc = ctx.escapeHtml;
      var el = document.createElement('div');
      el.id = 'irlNpcDialog';
      el.className = 'wq-npc-dialog';
      el.innerHTML = '<div class="wq-npc-panel"><div class="wq-npc-face"><div class="wq-npc-emoji">' + def.emoji + '</div></div>' +
        '<div><div class="wq-npc-name">' + esc(def.name) + '</div>' +
        '<div class="wq-npc-text">' + esc(fillTown(def.done)) + '</div>' +
        '<div class="wq-npc-text irl-reward-line">🏅 +' + quest.reward.xp + ' XP &nbsp; 🪙 +' + quest.reward.coins + ' coins</div>' +
        '<div class="irl-npc-actions"><button class="wq-npc-ok" data-act="close">⚔️ Glory to ' + esc(state.settlement ? state.settlement.name : 'the hold') + '!</button></div></div></div>';
      el.addEventListener('click', function (ev) {
        var act = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act');
        if (ev.target === el || act === 'close') el.remove();
      });
      document.body.appendChild(el);
    } else {
      ctx.showToast('🏅 Quest complete! +' + quest.reward.xp + ' XP, +' + quest.reward.coins + ' coins');
    }
  }

  // ---------------------------------------------------------------------------
  // Position pipeline
  // ---------------------------------------------------------------------------
  function ensureSettlement(lat, lon) {
    if (state.settlement && distMeters(state.settlement.anchor, { lat: lat, lon: lon }) < SETTLEMENT_REBUILD_M) return;
    if (state.activeQuest && state.activeQuest.state !== 'done' && state.settlement) {
      // Player wandered a hold away mid-quest: abandon quietly, keep the map honest.
      state.activeQuest = null;
      saveStore();
    }
    state.settlement = buildSettlement(lat, lon);
    // Resume a same-day quest for this cell (e.g. app reopened mid-errand).
    var saved = state.store.active;
    if (saved && saved.cellId === state.settlement.cellId && saved.day === dayStamp() && saved.state !== 'done') {
      state.activeQuest = saved;
    }
    renderNpcMarkers();
    renderTargetMarkers();
    rebuildScene();
  }

  function onPositionFix(lat, lon) {
    if (!ctx || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
    state.lastPos = { lat: lat, lon: lon };
    var map = ctx.getMap && ctx.getMap();
    if (!map) return;
    ensureSettlement(lat, lon);
    if (!state.settlement) return;
    // GPS fixes, map load and the custom layer's onAdd can arrive in any
    // order, so heal whatever step is still missing on each fix.
    if (!three.added) ensure3dLayer(map);
    if (three.added && three.group && !three.transform) rebuildScene();

    // First-approach hails: one villager calls out per fix at most.
    for (var i = 0; i < state.settlement.npcs.length; i++) {
      var npc = state.settlement.npcs[i];
      if (!npc.hailed && distMeters(state.lastPos, npc) <= HAIL_RADIUS_M) {
        npc.hailed = true;
        var def = rosterById(npc.id);
        if (def) ctx.showToast(def.emoji + ' ' + def.name + ': “' + fillTown(def.hail) + '”');
        break;
      }
    }

    if (state.activeQuest && state.activeQuest.state !== 'done') {
      var giver = findNpc(state.activeQuest.npcId);
      var events = processFix(state.activeQuest, lat, lon, giver, reachRadius());
      if (events.length) {
        saveStore();
        events.forEach(function (ev) {
          if (ev.type === 'target') {
            try { ctx.playSfx('tap'); } catch (e) {}
            ctx.showToast(ev.target.emoji + ' ' + ev.target.label + ' — claimed!');
          } else if (ev.type === 'all-targets') {
            var d = rosterById(ev.quest.npcId);
            ctx.showToast('✅ All done! Return to ' + (d ? d.name : 'the questgiver') + ' to collect your reward.');
          } else if (ev.type === 'complete') {
            state.activeQuest = ev.quest;
            completeActiveQuest();
          }
        });
        if (state.activeQuest && state.activeQuest.state !== 'done') {
          renderNpcMarkers();
          renderTargetMarkers();
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  var api = {
    init: init,
    onMapReady: onMapReady,
    onPositionFix: onPositionFix,
    styleExtrusionLayer: styleExtrusionLayer,
    ensureExtrusionLayer: ensureExtrusionLayer,
    // pure exports for tests
    extrusionPaint: extrusionPaint,
    buildSettlement: buildSettlement,
    buildQuestForNpc: buildQuestForNpc,
    processFix: processFix,
    cellIdFor: cellIdFor,
    dayStamp: dayStamp,
    questKey: questKey,
    offsetLatLon: offsetLatLon,
    distMeters: distMeters,
    iwHash: iwHash,
    iwRandom: iwRandom,
    NPC_ROSTER: NPC_ROSTER,
    _state: state,
    _three: three
  };

  if (typeof window !== 'undefined') window.BurbzIrlWorld = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
