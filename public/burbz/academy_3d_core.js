(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurbzAcademy3D = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // ==========================================================================
  // THE ACADEMY IN 3D — the great tree, modelled.
  //
  // Everything here is procedural three.js geometry: no downloaded meshes, no
  // multi-megabyte GLB over mobile data. The whole Academy — a gnarled
  // buttressed tree, treehouses that keep the character of their paintings,
  // chimney smoke and lanterns — is a compact collection of
  // code that builds itself on the device.
  //
  // Presentation only: it never reads or writes game state. The page hands it a
  // small adapter (which rooms are built, what hour it is, what to do when a
  // building is tapped) and gets back a scene it can start, pause and dispose.
  // The original 2D Academy is untouched and stays one tap away.
  // ==========================================================================

  var T = null; // THREE, resolved when a scene is created

  // ---- world layout --------------------------------------------------------
  // Every building hangs off a real branch. `angle` is degrees around the
  // trunk (0 faces the opening camera), `y` is metres up the trunk, `reach` is
  // how far the branch grows out before the platform sits on it.
  var ANCHORS = {
    dorm:        { angle: 200, y: 2.80, reach: 4.6, scale: 1.00 },
    tavern:      { angle: 22,  y: 2.60, reach: 4.9, scale: 1.00 },
    quest_roost: { angle: 300, y: 4.30, reach: 4.4, scale: 0.98 },
    magpie_market: { angle: 250, y: 3.55, reach: 4.7, scale: 1.02 },
    training:    { angle: 92,  y: 4.60, reach: 5.0, scale: 1.02 },
    kitchen:     { angle: 342, y: 5.60, reach: 4.3, scale: 1.04 },
    hospital:    { angle: 158, y: 6.05, reach: 4.6, scale: 1.00 },
    manager_office: { angle: 188, y: 7.05, reach: 4.1, scale: 0.98 },
    crowbar:     { angle: 48,  y: 6.90, reach: 4.2, scale: 1.02 },
    workshop:    { angle: 232, y: 7.60, reach: 4.0, scale: 0.96 },
    nursery:     { angle: 128, y: 8.60, reach: 3.7, scale: 0.94 },
    library:     { angle: 272, y: 8.20, reach: 3.9, scale: 0.97 },
    observatory: { angle: 318, y: 9.40, reach: 3.5, scale: 0.96 }
  };
  // Per-building character, read off the manga paintings: the Roost really is
  // a steep-roofed birdhouse with a hanging lantern; the Observatory really is
  // a star-blue dome under a crescent finial with a brass telescope out front.
  var STYLES = {
    dorm: {
      label: 'The Roost', roof: 'steep', w: 1.7, d: 1.5, h: 1.5,
      body: 'birdhouse', signature: 'round-perch-door', details: ['dormer', 'perch-brace'],
      wall: 0xa87948, wallDark: 0x624533, roofCol: 0x386c75, trim: 0xc69d62,
      windows: [{ x: 0, y: 0.44, z: 0.78, r: 0.30, round: true }],
      extras: ['lantern-left', 'hole-door', 'rope-belt']
    },
    tavern: {
      label: 'Barracks', roof: 'pagoda', w: 2.0, d: 1.7, h: 1.25,
      body: 'pavilion', signature: 'shielded-open-dojo', details: ['shields', 'pennants'],
      wall: 0xb78048, wallDark: 0x6f5030, roofCol: 0x435261, trim: 0xb08a44,
      windows: [{ x: 0, y: 0.26, z: 0.86, r: 0.34, wide: true }],
      extras: ['target', 'open-front', 'training-posts']
    },
    training: {
      label: 'Training Hall', roof: 'pagoda', w: 2.1, d: 1.8, h: 1.2,
      body: 'longhall', signature: 'target-gallery', details: ['banners', 'sparring-rack'],
      wall: 0xcf9850, wallDark: 0x876333, roofCol: 0x4d5c6c, trim: 0xc09a4c,
      windows: [{ x: 0, y: 0.24, z: 0.90, r: 0.32, wide: true }],
      extras: ['target', 'open-front', 'training-posts']
    },
    hospital: {
      label: 'Bird Hospital', roof: 'gable', w: 2.0, d: 1.7, h: 1.45,
      body: 'cross-gable', signature: 'healing-greenhouse', details: ['greenhouse', 'herb-box'],
      wall: 0xa67445, wallDark: 0x725030, roofCol: 0x557968, trim: 0xc9ac72,
      windows: [{ x: -0.28, y: 0.34, z: 0.86, r: 0.26 }, { x: 0.28, y: 0.30, z: 0.86, r: 0.24 }],
      extras: ['cross', 'lantern-left', 'lantern-right']
    },
    crowbar: {
      label: 'The Crowbar', roof: 'layered', w: 2.1, d: 1.8, h: 1.35,
      body: 'round', signature: 'circular-social-house', details: ['balcony-table', 'bottle-rack'],
      wall: 0xb78148, wallDark: 0x7a5633, roofCol: 0x9a553f, trim: 0xc79a4e,
      windows: [{ x: 0, y: 0.34, z: 0.90, r: 0.48, wide: true, warm: true }],
      extras: ['sign', 'lantern-left', 'lantern-right', 'barrel', 'stools', 'open-front']
    },
    kitchen: {
      label: 'Kitchen & Pantry', roof: 'gable', w: 2.0, d: 1.7, h: 1.5,
      body: 'cottage', signature: 'smoking-herb-kitchen', details: ['herb-box', 'copper-pans'],
      wall: 0xa47040, wallDark: 0x6f4c2d, roofCol: 0xa05b42, trim: 0xc09a60,
      windows: [{ x: -0.02, y: 0.66, z: 0.80, r: 0.22, round: true }, { x: 0, y: 0.14, z: 0.88, r: 0.52, wide: true, warm: true }],
      extras: ['chimney', 'awning', 'sacks']
    },
    workshop: {
      label: 'Nest Workshop', roof: 'shingle', w: 1.9, d: 1.7, h: 1.4,
      body: 'hexagonal', signature: 'pulley-nest-workshop', details: ['pulley', 'tool-wheel'],
      wall: 0xae7b46, wallDark: 0x765430, roofCol: 0x507a7a, trim: 0xc3a26b,
      windows: [{ x: 0, y: 0.24, z: 0.86, r: 0.44, wide: true }],
      extras: ['roof-nest', 'hanging-nest', 'open-front']
    },
    nursery: {
      label: 'Hatchery Nursery', roof: 'egg', w: 1.6, d: 1.5, h: 1.9,
      body: 'egg', signature: 'woven-cradle-egg', details: ['woven-ribs', 'cradle-mobile'],
      wall: 0xbc8a4c, wallDark: 0x7e5730, roofCol: 0x71935a, trim: 0xb08c4c,
      windows: [{ x: 0, y: 0.34, z: 0.70, r: 0.40, wide: true, warm: true }],
      extras: ['hanging-cradle', 'crossed-poles']
    },
    observatory: {
      label: 'Moon Observatory', roof: 'dome', w: 1.8, d: 1.8, h: 1.0,
      body: 'round', signature: 'star-studded-dome', details: ['star-band', 'lens-rings'],
      wall: 0x425081, wallDark: 0x2c3660, roofCol: 0x323d69, trim: 0xc6a44c,
      windows: [{ x: 0, y: 0.30, z: 0.80, r: 0.34, cool: true }],
      extras: ['crescent', 'telescope', 'lantern-left']
    },
    library: {
      label: 'The Library', roof: 'gable', w: 1.9, d: 1.7, h: 1.55,
      body: 'tower', signature: 'book-balcony-tower', details: ['book-balcony', 'reading-lamp'],
      wall: 0x9a6c40, wallDark: 0x684a2b, roofCol: 0x665376, trim: 0xc6a44c,
      windows: [{ x: -0.28, y: 0.42, z: 0.86, r: 0.22, warm: true }, { x: 0.28, y: 0.42, z: 0.86, r: 0.22, warm: true }, { x: 0, y: 0.10, z: 0.90, r: 0.46, wide: true, warm: true }],
      extras: ['open-front', 'lantern-left', 'rope-belt']
    },
    magpie_market: {
      label: 'Magpie Market', roof: 'gable', w: 2.0, d: 1.7, h: 1.30,
      body: 'cottage', signature: 'awninged-trading-stall', details: ['pub-sign', 'bottle-rack'],
      wall: 0xb5813f, wallDark: 0x7a5630, roofCol: 0x665777, trim: 0xc79a4e,
      windows: [{ x: 0, y: 0.28, z: 0.88, r: 0.48, wide: true, warm: true }],
      extras: ['awning', 'sign', 'lantern-left', 'lantern-right', 'barrel', 'sacks', 'open-front']
    },
    manager_office: {
      label: "Project Manager's Office", roof: 'steep', w: 1.8, d: 1.6, h: 1.45,
      body: 'birdhouse', signature: 'plans-and-ledgers-office', details: ['map-board', 'reading-lamp'],
      wall: 0x9b7144, wallDark: 0x684a2b, roofCol: 0x4b7069, trim: 0xc6a44c,
      windows: [{ x: 0, y: 0.34, z: 0.82, r: 0.32, round: true, warm: true }],
      extras: ['lantern-left', 'rope-belt', 'sign']
    },
    quest_roost: {
      label: 'Quest Roost', roof: 'gable', w: 1.9, d: 1.7, h: 1.35,
      body: 'faceted', signature: 'map-and-banner-roost', details: ['map-board', 'quest-banners'],
      wall: 0xb27e46, wallDark: 0x7a5630, roofCol: 0x3d7080, trim: 0xc4a16b,
      windows: [{ x: 0, y: 0.28, z: 0.88, r: 0.44, wide: true }],
      extras: ['weathervane', 'lantern-left', 'lantern-right', 'open-front']
    }
  };

  var GLOW_WARM = 0xffc06a, GLOW_COOL = 0xa8c8ff;

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function isNightHour(h) { return h >= 19.5 || h < 6; }
  // 0 = full daylight, 1 = deep night, with dawn and dusk ramps.
  function lightBoostFor(h) {
    if (h >= 21 || h < 5) return 1;
    if (h >= 17.5 && h < 21) return (h - 17.5) / 3.5;
    if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
    return 0;
  }

  function treeLightsActiveFor(hour, requested) {
    return !!requested && isNightHour(Number(hour));
  }

  // A phone should look rich, not cook itself. The expensive pieces are capped
  // by the short/long viewport sides and coarse hardware hints; geometry detail remains
  // because buildings are merged down to one static draw call each.
  function qualityProfileFor(viewWidth, dpr, cores, memoryGb, viewHeight, mobileHint) {
    viewWidth = Number(viewWidth) || 390;
    viewHeight = Number(viewHeight) || viewWidth;
    dpr = Math.max(1, Number(dpr) || 1);
    cores = Math.max(1, Number(cores) || 4);
    memoryGb = Math.max(1, Number(memoryGb) || 4);
    var shortSide = Math.min(viewWidth, viewHeight);
    var longSide = Math.max(viewWidth, viewHeight);
    var phone = mobileHint === true || viewWidth <= 700 || (shortSide <= 700 && longSide <= 1000);
    var low = phone && (cores <= 4 || memoryGb <= 2);
    return {
      pixelRatio: Math.min(dpr, low ? 1.25 : (phone ? 1.5 : 2)),
      frameMs: low ? 32 : (phone ? 22 : 14),
      shadowSize: low ? 512 : 1024,
      lightCount: low ? 2 : 3,
      canopyHalos: low ? 10 : (phone ? 16 : 24)
    };
  }

  function anchorPosition(id) {
    var a = ANCHORS[id];
    if (!a) return null;
    var rad = a.angle * Math.PI / 180;
    return { x: Math.sin(rad) * a.reach, y: a.y, z: Math.cos(rad) * a.reach, angle: rad, cfg: a };
  }

  // ---- canvas textures (bark, foliage, labels) -----------------------------

  function barkTexture() {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 512;
    var g = c.getContext('2d');
    g.fillStyle = '#5a4128';
    g.fillRect(0, 0, 128, 512);
    var rng = mulberry32(9161);
    for (var i = 0; i < 190; i++) {
      var x = rng() * 128, y = rng() * 512, len = 40 + rng() * 190;
      g.strokeStyle = 'rgba(' + (rng() < 0.5 ? '32,22,13' : '124,95,60') + ',' + (0.12 + rng() * 0.4) + ')';
      g.lineWidth = 0.7 + rng() * 3.2;
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x + (rng() - 0.5) * 12, y + len * 0.35, x + (rng() - 0.5) * 12, y + len * 0.7, x + (rng() - 0.5) * 9, y + len);
      g.stroke();
    }
    // A few moss patches, because this tree is old.
    for (var m = 0; m < 26; m++) {
      g.fillStyle = 'rgba(74,102,52,' + (0.10 + rng() * 0.20) + ')';
      g.beginPath();
      g.ellipse(rng() * 128, rng() * 512, 5 + rng() * 15, 8 + rng() * 22, rng() * 3, 0, 7);
      g.fill();
    }
    var tx = new T.CanvasTexture(c);
    tx.wrapS = tx.wrapT = T.RepeatWrapping;
    if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
    return tx;
  }

  // A sheet of four leaf shapes with a cut-out alpha, drawn rather than
  // downloaded. Instanced onto thousands of little cards it gives the canopy
  // actual foliage — veins, notched edges and all — instead of smooth blobs.
  function leafCardTexture() {
    var S = 128;
    var c = document.createElement('canvas');
    c.width = c.height = S * 2;
    var g = c.getContext('2d');
    var rng = mulberry32(4471);
    for (var q = 0; q < 4; q++) {
      var ox = (q % 2) * S, oy = Math.floor(q / 2) * S;
      g.save();
      g.translate(ox + S / 2, oy + S / 2);
      var len = S * 0.44, wide = S * (0.17 + rng() * 0.07);
      // Blade: two curves meeting at tip and stalk, with a slight lean.
      g.rotate((rng() - 0.5) * 0.5);
      var grad = g.createLinearGradient(0, -len, 0, len);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.55, '#e2e2e2');
      grad.addColorStop(1, '#bdbdbd');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(0, -len);
      g.bezierCurveTo(wide * 1.5, -len * 0.45, wide * 1.15, len * 0.45, 0, len * 0.86);
      g.bezierCurveTo(-wide * 1.15, len * 0.45, -wide * 1.5, -len * 0.45, 0, -len);
      g.closePath();
      g.fill();
      // Serrated edge: nick the outline so it is not a smooth almond.
      g.globalCompositeOperation = 'destination-out';
      for (var n = 0; n < 9; n++) {
        var t = 0.12 + n * 0.09;
        var yy = -len + t * len * 1.8;
        var xx = wide * 1.32 * Math.sin(Math.PI * t);
        g.beginPath(); g.arc(xx, yy, wide * 0.20, 0, 7); g.fill();
        g.beginPath(); g.arc(-xx, yy + wide * 0.3, wide * 0.18, 0, 7); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      // Midrib and side veins.
      g.strokeStyle = 'rgba(120,120,120,.55)';
      g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, -len * 0.92); g.lineTo(0, len * 0.8); g.stroke();
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(140,140,140,.42)';
      for (var vn = 0; vn < 6; vn++) {
        var vy = -len * 0.7 + vn * (len * 0.27);
        var reach = wide * 1.05 * Math.cos(vn * 0.25);
        g.beginPath(); g.moveTo(0, vy); g.quadraticCurveTo(reach * 0.6, vy + len * 0.06, reach, vy + len * 0.14); g.stroke();
        g.beginPath(); g.moveTo(0, vy); g.quadraticCurveTo(-reach * 0.6, vy + len * 0.06, -reach, vy + len * 0.14); g.stroke();
      }
      // Stalk.
      g.strokeStyle = 'rgba(150,150,150,.75)';
      g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(0, len * 0.8); g.lineTo(0, len * 0.98); g.stroke();
      g.restore();
    }
    var tx = new T.CanvasTexture(c);
    if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
    return tx;
  }

  function labelTexture(text) {
    var c = document.createElement('canvas');
    var pad = 26;
    var g = c.getContext('2d');
    g.font = '700 44px Rajdhani, system-ui, sans-serif';
    var w = Math.ceil(g.measureText(text).width) + pad * 2;
    c.width = w; c.height = 84;
    g = c.getContext('2d');
    g.font = '700 44px Rajdhani, system-ui, sans-serif';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(8,7,5,.74)';
    roundRect(g, 2, 12, w - 4, 58, 22);
    g.fill();
    g.strokeStyle = 'rgba(214,168,79,.55)';
    g.lineWidth = 2.5;
    roundRect(g, 2, 12, w - 4, 58, 22);
    g.stroke();
    g.fillStyle = '#f2d99a';
    g.fillText(text, pad, 42);
    var tx = new T.CanvasTexture(c);
    if (T.SRGBColorSpace) tx.colorSpace = T.SRGBColorSpace;
    tx.userData = { w: w };
    return tx;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // Shared soft-blob textures. Every lit window and lantern hangs one of these
  // in front of itself so the light visibly spills into the dark instead of
  // being a flat bright rectangle.
  var sharedTex = {};
  function sharedSoft(rgb) {
    if (!sharedTex[rgb]) {
      sharedTex[rgb] = softSpriteTexture(rgb);
      sharedTex[rgb].userData = { shared: true };
    }
    return sharedTex[rgb];
  }
  function clearSharedTex() {
    Object.keys(sharedTex).forEach(function(k) { if (sharedTex[k].dispose) sharedTex[k].dispose(); });
    sharedTex = {};
  }

  function softSpriteTexture(rgb) {
    var c = document.createElement('canvas');
    c.width = c.height = 64;
    var g = c.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.45, 'rgba(' + rgb + ',0.35)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new T.CanvasTexture(c);
  }

  // ---- small geometry helpers ----------------------------------------------

  function box(w, h, d, mat, x, y, z) {
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  function cyl(rt, rb, h, seg, mat, x, y, z) {
    var m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 8), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // Bake a group's static geometry down into a single mesh. A treehouse is
  // built from ~40 little boxes and cylinders, and ten of those plus a tree
  // made of forty limbs is 700+ draw calls — far too many for a phone. Each
  // part's colour is written into vertex colours, so one draw call renders the
  // lot. Transparent parts (windows, halos) are left alone so they can still
  // be lit and faded individually.
  function mergeStatic(root, opts) {
    opts = opts || {};
    root.updateMatrixWorld(true);
    var inv = new T.Matrix4().copy(root.matrixWorld).invert();
    var positions = [], normals = [], colors = [], uvs = [];
    var doomed = [], seenGeo = [];
    root.traverse(function(o) {
      if (!o.isMesh || o.isInstancedMesh || o.isSprite) return;
      var m = o.material;
      if (!m || Array.isArray(m) || m.transparent) return;
      if (opts.only && !opts.only(o, m)) return;
      if (!opts.only && m.map) return; // textured parts merge in their own pass
      var src = o.geometry;
      if (!src || !src.attributes || !src.attributes.position) return;
      var geo = src.index ? src.toNonIndexed() : src.clone();
      geo.applyMatrix4(new T.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      var p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
      var c = m.color || { r: 1, g: 1, b: 1 };
      for (var i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        if (n) normals.push(n.getX(i), n.getY(i), n.getZ(i)); else normals.push(0, 1, 0);
        colors.push(c.r, c.g, c.b);
        if (opts.uv) { if (u) uvs.push(u.getX(i), u.getY(i)); else uvs.push(0, 0); }
      }
      geo.dispose();
      doomed.push(o);
      if (seenGeo.indexOf(src) < 0) seenGeo.push(src);
    });
    if (!positions.length) return null;
    doomed.forEach(function(o) { if (o.parent) o.parent.remove(o); });
    seenGeo.forEach(function(gg) { gg.dispose(); }); // clones share source geometry
    var merged = new T.BufferGeometry();
    merged.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    merged.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    if (opts.uv) merged.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    var mat = opts.material || new T.MeshLambertMaterial({ vertexColors: true, flatShading: !!opts.flat });
    var mesh = new T.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (opts.name) mesh.name = opts.name;
    root.add(mesh);
    return mesh;
  }

  // A tapered, slightly bent limb from a to b — the building block of the tree.
  function limb(a, b, r0, r1, mat, bend) {
    var dir = new T.Vector3().subVectors(b, a);
    var len = dir.length();
    var curve = new T.CatmullRomCurve3([
      a.clone(),
      a.clone().lerp(b, 0.34).add(new T.Vector3(0, (bend || 0) * len * 0.16, 0)),
      a.clone().lerp(b, 0.7).add(new T.Vector3(0, (bend || 0) * len * 0.12, 0)),
      b.clone()
    ]);
    var geo = new T.TubeGeometry(curve, 9, r0, 7, false);
    // Taper the tube by scaling ring radii along its length.
    var pos = geo.attributes.position;
    var tubular = 9 + 1, radial = 7 + 1;
    for (var i = 0; i < tubular; i++) {
      var t = i / (tubular - 1);
      var scale = (r0 + (r1 - r0) * t) / r0;
      for (var j = 0; j < radial; j++) {
        var idx = i * radial + j;
        var p = curve.getPointAt(Math.min(1, t));
        var vx = pos.getX(idx) - p.x, vy = pos.getY(idx) - p.y, vz = pos.getZ(idx) - p.z;
        pos.setXYZ(idx, p.x + vx * scale, p.y + vy * scale, p.z + vz * scale);
      }
    }
    geo.computeVertexNormals();
    var m = new T.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ---- the great tree ------------------------------------------------------

  function buildTree(mats, rng) {
    var g = new T.Group();
    var V = T.Vector3;

    // Trunk: a leaning, tapering column with a swollen base.
    var trunkPts = [
      new V(0, 0, 0), new V(0.12, 2.2, -0.10), new V(-0.05, 4.6, 0.14),
      new V(0.16, 7.0, -0.06), new V(0.02, 9.4, 0.10), new V(-0.10, 11.2, 0)
    ];
    var trunkCurve = new T.CatmullRomCurve3(trunkPts);
    var trunkGeo = new T.TubeGeometry(trunkCurve, 26, 1, 14, false);
    // Taper from a 1.5m base to 0.34m at the crown, with a gnarled wobble.
    var pos = trunkGeo.attributes.position;
    var rings = 27, radial = 15;
    for (var i = 0; i < rings; i++) {
      var t = i / (rings - 1);
      var r = 1.5 * Math.pow(1 - t, 0.62) + 0.30;
      var p = trunkCurve.getPointAt(t);
      for (var j = 0; j < radial; j++) {
        var idx = i * radial + j;
        var wob = 1 + Math.sin(j * 2.3 + t * 7) * 0.09 + Math.sin(j * 5.1 - t * 4) * 0.05;
        var vx = pos.getX(idx) - p.x, vy = pos.getY(idx) - p.y, vz = pos.getZ(idx) - p.z;
        var len = Math.hypot(vx, vy, vz) || 1;
        var s = (r * wob) / len;
        pos.setXYZ(idx, p.x + vx * s, p.y + vy * s, p.z + vz * s);
      }
    }
    trunkGeo.computeVertexNormals();
    var trunk = new T.Mesh(trunkGeo, mats.bark);
    trunk.castShadow = true; trunk.receiveShadow = true;
    g.add(trunk);

    // Buttress roots flaring into the forest floor.
    for (var rIdx = 0; rIdx < 9; rIdx++) {
      var ra = (rIdx / 9) * Math.PI * 2 + rng() * 0.3;
      var reach = 2.4 + rng() * 1.9;
      var root = limb(
        new V(Math.sin(ra) * 0.5, 1.5 + rng() * 0.7, Math.cos(ra) * 0.5),
        new V(Math.sin(ra) * reach, -0.18, Math.cos(ra) * reach),
        0.62, 0.16, mats.bark, -0.5
      );
      g.add(root);
    }

    var tips = [];

    // A real branch out to every building anchor, so each treehouse is
    // genuinely carried by the tree rather than floating beside it.
    Object.keys(ANCHORS).forEach(function(id) {
      var a = anchorPosition(id);
      var sa = Math.sin(a.angle), ca = Math.cos(a.angle);
      var st2 = STYLES[id];
      var halfW = (st2 ? Math.max(st2.w, st2.d) : 2) * 0.5 * a.cfg.scale;
      // The bough runs UNDER the platform and stops there — a branch spearing
      // out through the middle of a house looked wrong. The deck rests on it.
      var start = new V(sa * 0.5, a.y - 0.85, ca * 0.5);
      var deckUnder = new V(sa * (a.cfg.reach - 0.15), a.y - 0.44, ca * (a.cfg.reach - 0.15));
      g.add(limb(start, deckUnder, 0.36, 0.20, mats.bark, 0.5));
      // A forked crutch under the far corners, so the house is visibly carried.
      [-1, 1].forEach(function(sgn) {
        var forkFrom = new V(sa * (a.cfg.reach * 0.52), a.y - 0.72, ca * (a.cfg.reach * 0.52));
        var fa = a.angle + sgn * 0.30;
        var forkTo = new V(Math.sin(fa) * (a.cfg.reach + halfW * 0.30), a.y - 0.30, Math.cos(fa) * (a.cfg.reach + halfW * 0.30));
        g.add(limb(forkFrom, forkTo, 0.15, 0.07, mats.bark, 0.35));
      });
      // The limb carries on past the house — but it branches away BEFORE the
      // wall and clears it to the side, so nothing pierces the building.
      var offA = a.angle + (rng() < 0.5 ? -1 : 1) * (0.40 + rng() * 0.18);
      var sideFrom = new V(sa * (a.cfg.reach * 0.62), a.y - 0.58, ca * (a.cfg.reach * 0.62));
      var clear = a.cfg.reach + halfW + 1.5 + rng();
      var beyond = new V(Math.sin(offA) * clear, a.y + 1.6 + rng() * 0.9, Math.cos(offA) * clear);
      g.add(limb(sideFrom, beyond, 0.17, 0.05, mats.bark, 0.7));
      tips.push({ p: beyond, small: true });
    });

    // Decorative limbs that give the canopy its spread. They start above the
    // highest treehouse so the whole building storey stays in clear air.
    for (var b = 0; b < 15; b++) {
      var ba = rng() * Math.PI * 2;
      var by = 9.8 + rng() * 2.6;
      var brh = 2.6 + rng() * 4.2;
      var s0 = new V(Math.sin(ba) * 0.4, by, Math.cos(ba) * 0.4);
      var e0 = new V(Math.sin(ba) * brh, by + 1.4 + rng() * 2.4, Math.cos(ba) * brh);
      g.add(limb(s0, e0, 0.24, 0.07, mats.bark, 0.8));
      tips.push({ p: e0, big: rng() < 0.7 });
      if (rng() < 0.6) {
        var e1 = new V(e0.x * 1.3 + (rng() - 0.5), e0.y + 0.9 + rng(), e0.z * 1.3 + (rng() - 0.5));
        g.add(limb(e0, e1, 0.07, 0.03, mats.bark, 0.6));
        tips.push({ p: e1, big: false });
      }
    }

    // Crown limbs reaching straight up out of the top of the trunk.
    for (var c = 0; c < 6; c++) {
      var ca = (c / 6) * Math.PI * 2 + rng() * 0.4;
      var top = new V(Math.sin(ca) * (1.6 + rng()), 11.6 + rng() * 1.6, Math.cos(ca) * (1.6 + rng()));
      g.add(limb(new V(-0.1, 10.6, 0), top, 0.2, 0.05, mats.bark, 0.5));
      tips.push({ p: top, big: true });
    }

    // ---- foliage: instanced leaf clusters at every twig end ----------------
    var clusters = [];
    tips.forEach(function(tip) {
      var n = tip.small ? 3 : (tip.big ? 7 : 4);
      for (var k = 0; k < n; k++) {
        clusters.push({
          x: tip.p.x + (rng() - 0.5) * (tip.small ? 1.1 : 1.9),
          y: tip.p.y + (rng() - 0.5) * 1.2 + 0.45,
          z: tip.p.z + (rng() - 0.5) * (tip.small ? 1.1 : 1.9),
          s: (tip.small ? 0.5 : tip.big ? 0.9 : 0.65) + rng() * (tip.small ? 0.35 : 0.8),
          tone: rng()
        });
      }
    });
    // A broad mass over the crown so the tree reads as one canopy from afar —
    // all of it above the treehouses, which live in clear air below.
    for (var q = 0; q < 120; q++) {
      var qa = rng() * Math.PI * 2, qr = Math.sqrt(rng()) * 7.2;
      clusters.push({
        x: Math.sin(qa) * qr, y: 12.5 + rng() * 3.6 - qr * 0.30, z: Math.cos(qa) * qr,
        s: 1.05 + rng() * 1.25, tone: rng()
      });
    }
    // The canopy is two layers. Underneath, dark blobs give it solid volume so
    // you cannot see straight through the tree. Over them, thousands of real
    // leaf cards catch the light — that is what stops it reading as fluff.
    var canopy = new T.Group();
    var dummy = new T.Object3D();
    var col = new T.Color();
    var leafDeep = new T.Color(0x1f3d1a);   // shaded, inside the canopy
    var leafMid = new T.Color(0x3f7231);
    var leafSun = new T.Color(0x7fb14a);    // top leaves catching the light
    function leafShade(tone, y) {
      // 0 at the shaded underside, 1 in the sunlit crown.
      var t = Math.max(0, Math.min(1, (y - 9.5) / 6.5)) * 0.62 + tone * 0.38;
      return t < 0.5 ? col.copy(leafDeep).lerp(leafMid, t * 2)
                     : col.copy(leafMid).lerp(leafSun, (t - 0.5) * 2);
    }

    var coreGeo = new T.IcosahedronGeometry(0.46, 0);
    var cores = new T.InstancedMesh(coreGeo, mats.leaf, clusters.length);
    cores.castShadow = true; cores.receiveShadow = true;
    clusters.forEach(function(cl, idx) {
      dummy.position.set(cl.x, cl.y, cl.z);
      dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      dummy.scale.set(cl.s * (0.86 + rng() * 0.35), cl.s * (0.66 + rng() * 0.28), cl.s * (0.86 + rng() * 0.35));
      dummy.updateMatrix();
      cores.setMatrixAt(idx, dummy.matrix);
      // The inner mass stays darker than the leaves hanging off it.
      cores.setColorAt(idx, leafShade(cl.tone * 0.5, cl.y - 1.5));
    });
    cores.instanceMatrix.needsUpdate = true;
    if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
    canopy.add(cores);

    // Individual leaves, scattered over the shell of every cluster.
    var cards = [];
    clusters.forEach(function(cl) {
      var buried = cl.y > 12 && Math.hypot(cl.x, cl.z) < 2.4;
      var n = Math.round((10 + cl.s * 10) * (buried ? 0.35 : 1));
      for (var k = 0; k < n; k++) {
        // Point on a sphere around the cluster, biased to its upper surface
        // where real foliage is densest.
        var u = rng() * Math.PI * 2, v = Math.acos(1 - 2 * Math.pow(rng(), 1.35));
        var rad = cl.s * (0.46 + rng() * 0.56);
        cards.push({
          x: cl.x + Math.sin(v) * Math.cos(u) * rad,
          y: cl.y + Math.cos(v) * rad * 0.78 + cl.s * 0.12,
          z: cl.z + Math.sin(v) * Math.sin(u) * rad,
          s: 0.34 + rng() * 0.36,
          tone: rng(),
          rx: rng() * Math.PI * 2, ry: rng() * Math.PI * 2, rz: rng() * Math.PI * 2
        });
      }
    });
    var cardGeo = new T.PlaneGeometry(1, 1);
    var leafCards = new T.InstancedMesh(cardGeo, mats.leafCard, cards.length);
    leafCards.receiveShadow = true; // alpha-tested cards cast messy shadows
    cards.forEach(function(cd, idx) {
      dummy.position.set(cd.x, cd.y, cd.z);
      dummy.rotation.set(cd.rx, cd.ry, cd.rz);
      dummy.scale.set(cd.s, cd.s * (1.25 + rng() * 0.5), 1);
      dummy.updateMatrix();
      leafCards.setMatrixAt(idx, dummy.matrix);
      leafCards.setColorAt(idx, leafShade(cd.tone, cd.y));
    });
    leafCards.instanceMatrix.needsUpdate = true;
    if (leafCards.instanceColor) leafCards.instanceColor.needsUpdate = true;
    canopy.add(leafCards);

    g.add(canopy);
    var leaves = canopy;

    // Forty-odd limbs collapse into a single textured mesh.
    mergeStatic(g, {
      uv: true, name: 'tree-bark',
      only: function(o, m) { return m === mats.bark; },
      material: new T.MeshLambertMaterial({ map: mats.barkTex, color: 0xc0a884, vertexColors: true })
    });
    return { group: g, leaves: leaves, tips: tips };
  }

  // ---- one treehouse -------------------------------------------------------
  // Modelled to match the manga paintings: shingled roofs laid row by row,
  // mullioned windows with sills and shutters, planked decks on visible
  // brackets, rope lashings where the house grips its branch, and the props
  // each building is known for. Every static part merges into one mesh at the
  // end, so all this detail still costs a single draw call per house.

  function buildTreehouse(id, mats, rng) {
    var st = STYLES[id];
    if (!st) return null;
    var g = new T.Group();
    var glows = [];
    var W = st.w, D = st.d, H = st.h;

    var wallMat = new T.MeshLambertMaterial({ color: st.wall });
    var darkMat = new T.MeshLambertMaterial({ color: st.wallDark });
    var roofMat = new T.MeshLambertMaterial({ color: st.roofCol });
    var roofMat2 = new T.MeshLambertMaterial({ color: shade(st.roofCol, 0.82) });
    var trimMat = new T.MeshLambertMaterial({ color: st.trim });
    var ropeMat = new T.MeshLambertMaterial({ color: 0xa89068 });
    var ironMat = new T.MeshLambertMaterial({ color: 0x4a4a52 });
    var interiorMat = new T.MeshLambertMaterial({ color: 0x1c1208 });

    function shade(hex, f) {
      var r = Math.round(((hex >> 16) & 255) * f), gg = Math.round(((hex >> 8) & 255) * f), b = Math.round((hex & 255) * f);
      return (r << 16) | (gg << 8) | b;
    }

    // ---- deck: planks with gaps, on brackets ----
    var deckY = 0;
    var planks = 9;
    for (var pi = 0; pi < planks; pi++) {
      var pz = -(D + 0.55) / 2 + (pi + 0.5) * (D + 0.55) / planks;
      g.add(box(W + 0.62, 0.09, (D + 0.55) / planks - 0.035, pi % 2 ? mats.plank : darkMat, 0, deckY, pz));
    }
    // Deck edge beams and corner brackets
    g.add(box(W + 0.70, 0.10, 0.10, trimMat, 0, deckY - 0.06, (D + 0.55) / 2));
    g.add(box(W + 0.70, 0.10, 0.10, trimMat, 0, deckY - 0.06, -(D + 0.55) / 2));
    g.add(box(0.10, 0.10, D + 0.55, trimMat, (W + 0.62) / 2, deckY - 0.06, 0));
    g.add(box(0.10, 0.10, D + 0.55, trimMat, -(W + 0.62) / 2, deckY - 0.06, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(c) {
      var br = box(0.09, 0.52, 0.09, trimMat, c[0] * W * 0.44, -0.28, c[1] * D * 0.44);
      br.rotation.set(-c[1] * 0.36, 0, c[0] * 0.36);
      g.add(br);
    });
    // Rope lashings where the deck grips the bough below.
    for (var lr = 0; lr < 3; lr++) {
      var ring = new T.Mesh(new T.TorusGeometry(0.30 + lr * 0.05, 0.035, 5, 12), ropeMat);
      ring.rotation.x = Math.PI / 2 + 0.2;
      ring.position.set((lr - 1) * 0.34, -0.40, 0);
      g.add(ring);
    }

    // ---- railing: posts, top rail, mid rail; front left open ----
    var railY = 0.44;
    var perim = [];
    for (var rp = 0; rp < 22; rp++) {
      var t = rp / 22 * Math.PI * 2;
      var rx = Math.sin(t) * (W + 0.56) * 0.5, rz = Math.cos(t) * (D + 0.50) * 0.5;
      if (rz > D * 0.26) continue; // the front stays open for the ladder
      perim.push([rx, rz]);
      g.add(cyl(0.032, 0.038, railY, 5, trimMat, rx, railY / 2, rz));
    }
    perim.forEach(function(pt, i) {
      var nx = perim[i + 1];
      if (!nx) return;
      var mx = (pt[0] + nx[0]) / 2, mz = (pt[1] + nx[1]) / 2;
      var len = Math.hypot(nx[0] - pt[0], nx[1] - pt[1]) * 1.06;
      var ang = Math.atan2(nx[0] - pt[0], nx[1] - pt[1]);
      [railY, railY * 0.55].forEach(function(hy, k) {
        var bar = box(0.05, 0.05, len, k ? ropeMat : trimMat, mx, hy, mz);
        bar.rotation.y = ang;
        g.add(bar);
      });
    });

    // ---- crafted architecture: bevels, joinery and shaped roof surfaces ----
    // Geometry carries the surface detail: no extra texture downloads or draw
    // calls. Large readable forms first; small trim never substitutes for shape.
    var plasterColors = {
      dorm: 0xe5c58b, tavern: 0xe1c79d, training: 0xdfb971,
      hospital: 0xd8e1bd, crowbar: 0xd9af78, kitchen: 0xe8cc98,
      workshop: 0xcfa46e, nursery: 0xe8d4a3, observatory: 0x687ea1,
      library: 0xd9c7aa, magpie_market: 0xdfbd8b, manager_office: 0xc7d2b7,
      quest_roost: 0xd6bc91
    };
    var plasterMat = new T.MeshLambertMaterial({ color: plasterColors[id] });
    var joineryMat = new T.MeshLambertMaterial({ color: 0x49352b });
    var brassMat = new T.MeshLambertMaterial({ color: 0xd9b66d });
    var tileMats = [0.82, 0.94, 1.06, 1.16].map(function(f) {
      return new T.MeshLambertMaterial({ color: shade(st.roofCol, f) });
    });
    var craftParts = { shingles: 0, joinery: 0, bevels: 0 };
    function bevel(w, h, d, mat, x, y, z, radius) {
      var b = Math.min(radius || 0.025, w * 0.16, h * 0.16, d * 0.16);
      var s = new T.Shape();
      s.moveTo(-w / 2 + b, -h / 2 + b); s.lineTo(w / 2 - b, -h / 2 + b);
      s.lineTo(w / 2 - b, h / 2 - b); s.lineTo(-w / 2 + b, h / 2 - b); s.closePath();
      var geo = new T.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true,
        bevelThickness: b, bevelSize: b, bevelSegments: 1, steps: 1, curveSegments: 1 });
      geo.translate(0, 0, -d / 2 + b);
      var m = new T.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true; m.receiveShadow = true;
      craftParts.bevels++;
      return m;
    }
    function beam(a, b, width, mat, parent) {
      var av = new T.Vector3().fromArray(a), bv = new T.Vector3().fromArray(b);
      var m = bevel(width, av.distanceTo(bv), width, mat || joineryMat);
      m.position.copy(av).add(bv).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), bv.sub(av).normalize());
      (parent || g).add(m); craftParts.joinery++;
      return m;
    }
    // Closed thin slabs, with real thickness at the eaves. Points go round the
    // top clockwise when seen from below, yielding outward-facing top normals.
    function slab(points, thickness, mat) {
      var pos = [];
      function tri(a, b, c) { pos.push.apply(pos, a.concat(b, c)); }
      var low = points.map(function(p) { return [p[0], p[1] - thickness, p[2]]; });
      var cross = new T.Vector3().fromArray(points[1]).sub(new T.Vector3().fromArray(points[0]))
        .cross(new T.Vector3().fromArray(points[2]).sub(new T.Vector3().fromArray(points[0])));
      if (cross.y < 0) { points = points.slice().reverse(); low.reverse(); }
      tri(points[0], points[1], points[2]); tri(points[0], points[2], points[3]);
      tri(low[2], low[1], low[0]); tri(low[3], low[2], low[0]);
      for (var k = 0; k < 4; k++) {
        var n = (k + 1) % 4;
        tri(points[n], points[k], low[k]); tri(points[n], low[k], low[n]);
      }
      var geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
      var mesh = new T.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh); return mesh;
    }
    function timberHouse(w, h, d, x, bottom, z, openFront) {
      // Real side/back walls, not an opaque cube hiding the serving window.
      var mid = bottom + h * 0.5;
      g.add(bevel(w, h, 0.12, plasterMat, x, mid, z - d / 2 + 0.06));
      [-1, 1].forEach(function(side) {
        g.add(bevel(0.12, h, d, plasterMat, x + side * (w / 2 - 0.06), mid, z));
        g.add(bevel(w, h * 0.18, 0.13, wallMat, x, bottom + h * 0.09, z + side * (d / 2 - 0.04)));
        g.add(bevel(w + 0.10, 0.11, 0.14, joineryMat, x, bottom + h * 0.22, z + side * d / 2));
        g.add(bevel(w + 0.14, 0.14, 0.18, joineryMat, x, bottom + h - 0.04, z + side * d / 2));
        [-1, 1].forEach(function(front) {
          var px = x + side * w / 2, pz = z + front * d / 2;
          g.add(bevel(0.14, h + 0.08, 0.14, joineryMat, px, mid, pz));
          g.add(bevel(0.19, 0.12, 0.19, brassMat, px, bottom + h * 0.15, pz));
          beam([px, bottom + h * 0.68, pz], [px - side * w * 0.21, bottom + h - 0.10, pz], 0.085);
        });
        // Side-wall Tudor bracing, silhouette-visible even when orbiting.
        beam([x + side * (w / 2 + 0.014), bottom + h * 0.24, z - d * 0.38],
          [x + side * (w / 2 + 0.014), bottom + h * 0.9, z + d * 0.30], 0.075);
      });
      if (!openFront) {
        g.add(bevel(w - 0.16, h * 0.76, 0.12, plasterMat, x, bottom + h * 0.60, z + d / 2 - 0.07));
      } else {
        g.add(bevel(w - 0.16, h * 0.18, 0.12, plasterMat, x, bottom + h * 0.87, z + d / 2 - 0.07));
        g.add(bevel(w - 0.08, 0.09, 0.28, trimMat, x, bottom + h * 0.25, z + d / 2 + 0.07));
      }
      // Chamfered foundation sill and joists make the room feel supported.
      g.add(bevel(w + 0.16, 0.13, d + 0.16, darkMat, x, bottom, z));
      for (var j = -1; j <= 1; j++) {
        g.add(bevel(0.10, 0.15, d + 0.34, joineryMat, x + j * w * 0.33, bottom - 0.10, z));
      }
    }
    function gableRoof(w, d, base, rise, cx, cz) {
      var run = w / 2 + 0.21, span = d + 0.48, rows = 6, cols = Math.max(5, Math.round(span / 0.34));
      function at(side, u, z, lift) {
        return [cx + side * run * u, base + rise * Math.pow(Math.max(0, 1 - u), 1.55) + 0.09 * Math.pow(u, 8) + (lift || 0), cz + z];
      }
      [-1, 1].forEach(function(side) {
        for (var row = 0; row < rows; row++) {
          var u0 = row / rows, u1 = (row + 1) / rows;
          slab([at(side,u0,-span/2,0),at(side,u1,-span/2,0),at(side,u1,span/2,0),at(side,u0,span/2,0)], 0.065, roofMat2);
          // Staggered, individually coloured tiles; gaps expose dark underlay,
          // not added black seam bars. Eave tiles are wider and slightly uneven.
          for (var col = -1; col < cols; col++) {
            var za = Math.max(-span/2, -span/2 + (col + (row % 2) * 0.5) * span/cols + 0.012);
            var zb = Math.min(span/2, -span/2 + (col + 1 + (row % 2) * 0.5) * span/cols - 0.012);
            if (zb - za < 0.03) continue;
            var ua = Math.max(0, u0 - 0.016), ub = Math.min(1.015, u1 + 0.014);
            slab([at(side,ua,za,0.045),at(side,ub,za,0.045),at(side,ub,zb,0.045),at(side,ua,zb,0.045)],
              0.045, tileMats[(row * 3 + col + 5 + (side > 0 ? 1 : 0)) % tileMats.length]);
            craftParts.shingles++;
          }
        }
        [-1, 1].forEach(function(front) {
          for (var seg = 0; seg < rows; seg++) {
            beam(at(side,seg/rows,front*(span/2+0.018),-0.035), at(side,(seg+1)/rows,front*(span/2+0.018),-0.035), 0.105, trimMat);
          }
        });
      });
      // Recessed plaster gables close the roof, framed with a king-post truss.
      [-1, 1].forEach(function(front) {
        var s = new T.Shape(); s.moveTo(-run, 0.02);
        for (var p = 0; p <= 12; p++) {
          var x = -1 + p / 6;
          s.lineTo(x * run, rise * Math.pow(1 - Math.abs(x), 1.55) + 0.09 * Math.pow(Math.abs(x),8));
        }
        s.lineTo(run, 0.02); s.closePath();
        var geo = new T.ExtrudeGeometry(s, {depth:0.06,bevelEnabled:false,curveSegments:1});
        var face = new T.Mesh(geo, plasterMat);
        face.position.set(cx, base, cz + front*d/2 - 0.03); face.castShadow = true; g.add(face);
        beam([cx-run*.80,base+.05,cz+front*(d/2+.05)],[cx+run*.80,base+.05,cz+front*(d/2+.05)],.10);
        beam([cx,base+.05,cz+front*(d/2+.055)],[cx,base+rise*.95,cz+front*(d/2+.055)],.095);
        [-1,1].forEach(function(side) {
          beam([cx+side*run*.58,base+.08,cz+front*(d/2+.055)],[cx,base+rise*.66,cz+front*(d/2+.055)],.065);
        });
      });
      // Individual clay ridge caps, not a single featureless box.
      for (var rc = 0; rc < cols; rc++) {
        g.add(bevel(0.18,0.14,span/cols-.012,trimMat,cx,base+rise+.07,cz-span/2+(rc+.5)*span/cols));
      }
    }
    function radialRoof(radius, base, rise, sides, squash) {
      // A continuous curved roof: each tile is a frustum panel connected to
      // the next course, not a stack of intersecting/hovering cone primitives.
      var rows = 6;
      function at(u, a, lift) {
        if (sides === 4) a += Math.PI / 4;
        var r = radius * (0.10 + 0.90*u);
        return [Math.sin(a)*r, base+rise*Math.pow(1-u,1.55)+0.10*Math.pow(u,8)+(lift||0),Math.cos(a)*r*squash];
      }
      for (var row=0;row<rows;row++) {
        for (var seg=0;seg<sides;seg++) {
          var a=seg/sides*Math.PI*2,b=(seg+1)/sides*Math.PI*2,u=row/rows,v=(row+1)/rows;
          slab([at(u,a,0),at(v,a,0),at(v,b,0),at(u,b,0)],.07,roofMat2);
          var columns = sides === 4 ? 6 : 2;
          function edge(level, f) {
            var p=at(level,a,.038),q=at(level,b,.038);
            return p.map(function(n,k){return n+(q[k]-n)*f;});
          }
          for (var tile=0;tile<columns;tile++) {
            var left=(tile+.018)/columns,right=(tile+.982)/columns;
            slab([edge(Math.max(0,u-.018),left),edge(v,left),edge(v,right),edge(Math.max(0,u-.018),right)],
              .04,tileMats[(row+seg+tile)%4]); craftParts.shingles++;
          }
        }
      }
      g.add(cyl(.035,.15,.28,8,brassMat,0,base+rise+.08,0));
    }

    var bodyY = 0.05 + H / 2;
    var roofBase = 0.05 + H;
    if (st.body === 'egg') {
      var egg = new T.Mesh(new T.SphereGeometry(W*.53,24,18),plasterMat);
      egg.scale.set(1,H/(W*1.02),.94); egg.position.y=.05+H*.51; g.add(egg);
      // Curved woven basket staves follow the shell instead of floating hoops.
      for (var stave=0;stave<16;stave++) {
        var a=stave/16*Math.PI*2, pts=[];
        for (var sp=0;sp<=10;sp++) {
          var t=.24+sp/10*(Math.PI-.48);
          pts.push(new T.Vector3(Math.sin(t)*Math.cos(a)*W*.54,.05+H*.51+Math.cos(t)*H*.53,Math.sin(t)*Math.sin(a)*W*.51));
        }
        g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),10,.025,4,false),trimMat));
      }
    } else if (st.body === 'round' || st.body === 'hexagonal' || st.body === 'faceted') {
      var sides = st.body === 'hexagonal' ? 6 : 10;
      // Deliberately faceted ring of panelled bays with structural uprights.
      for (var bay=0;bay<sides;bay++) {
        var ba=bay/sides*Math.PI*2,bb=(bay+1)/sides*Math.PI*2;
        var a=[Math.sin(ba)*W*.51,.05,Math.cos(ba)*D*.51],b=[Math.sin(bb)*W*.51,.05,Math.cos(bb)*D*.51];
        beam(a,[a[0],roofBase,a[2]],.115);
        var panel=bevel(Math.hypot(b[0]-a[0],b[2]-a[2]),H-.10,.11,plasterMat,(a[0]+b[0])/2,bodyY,(a[2]+b[2])/2);
        panel.rotation.y=Math.atan2(a[2]-b[2],b[0]-a[0]); g.add(panel);
        [.14,.84].forEach(function(level) {beam([a[0],.05+H*level,a[2]],[b[0],.05+H*level,b[2]],.085,trimMat);});
      }
      // A front window bay has a real backing surface at the facade plane.
      timberHouse(W*.66,H*.80,.24,0,.06,D*.48,false);
    } else if (st.body === 'birdhouse') {
      timberHouse(W,H,D,0,.05,0,false);
      // Jettied upper storey plus a projecting circular bird-door surround.
      g.add(bevel(W+0.16,.16,D+.12,joineryMat,0,roofBase-.17,0));
      var surround=new T.Mesh(new T.TorusGeometry(W*.24,.075,6,24),trimMat);
      surround.position.set(0,.05+H*(id==='dorm'?.56:.46),D/2+.075); g.add(surround);
    } else if (st.body === 'pavilion') {
      timberHouse(W,H,D,0,.05,0,true);
      g.add(bevel(W*.82,.06,D*.74,wallMat,0,.19,0));
    } else if (st.body === 'longhall') {
      timberHouse(W,H,D,0,.05,0,true);
      [-1,1].forEach(function(side) {
        g.add(bevel(.18,H*.64,.18,joineryMat,side*W*.30,.05+H*.32,D*.52));
      });
    } else if (st.body === 'cross-gable') {
      timberHouse(W*.90,H,D,0,.05,0,false);
      timberHouse(W*.42,H*.55,D*.64,W*.56,.05,-D*.08,false);
      gableRoof(W*.42,D*.64,.05+H*.55,.35,W*.56,-D*.08);
    } else if (st.body === 'cottage') {
      timberHouse(W,H,D,0,.05,0,st.extras.indexOf('open-front')>=0 || id==='kitchen');
      timberHouse(W*.30,H*.54,D*.66,W*.57,.05,-D*.1,false);
      gableRoof(W*.30,D*.66,.05+H*.54,.30,W*.57,-D*.1);
    } else if (st.body === 'tower') {
      timberHouse(W*.88,H,D,0,.05,0,true);
      g.add(bevel(W+0.10,.14,D+.14,joineryMat,0,roofBase-.14,0));
      // Reading oriel, carried by carved diagonal brackets.
      timberHouse(W*.52,H*.35,.32,0,.05+H*.57,D*.54,false);
      var readingGlass=new T.MeshBasicMaterial({color:GLOW_WARM,transparent:true,opacity:.92});
      var readingPane=new T.Mesh(new T.PlaneGeometry(W*.43,H*.22),readingGlass);
      readingPane.position.set(0,.05+H*.755,D*.54+.17);g.add(readingPane);
      [-1,0,1].forEach(function(bar){g.add(bevel(.035,H*.24,.035,trimMat,bar*W*.14,.05+H*.755,D*.54+.195));});
      glows.push({mat:readingGlass,warm:true,base:.92});
    }

    // ---- roofs: sculpted curves and individually laid tiles ----
    if (st.roof === 'gable' || st.roof === 'steep') {
      gableRoof(W,D,roofBase,st.roof==='steep'?1.15:.86,0,0);
    } else if (st.roof === 'pagoda') {
      // Two connected sweeping hips with a small clerestory between them.
      radialRoof(W*.82,roofBase-.10,.69,4,D/W);
      timberHouse(W*.42,.30,D*.42,0,roofBase+.49,0,false);
      radialRoof(W*.58,roofBase+.73,.50,4,D/W);
    } else if (st.roof === 'layered') {
      radialRoof(W*.68,roofBase-.02,.85,16,D/W);
      g.add(cyl(.25,.29,.22,12,plasterMat,0,roofBase+.83,0));
      radialRoof(.43,roofBase+.92,.27,12,1);
    } else if (st.roof === 'shingle') {
      radialRoof(W*.67,roofBase,.94,12,D/W);
    } else if (st.roof === 'dome') {
      // Fluted copper-blue shell, raised brass meridians, stepped drum.
      g.add(cyl(W*.59,W*.59,.18,24,joineryMat,0,roofBase-.02,0));
      for (var gore=0;gore<12;gore++) {
        var dome=new T.Mesh(new T.SphereGeometry(W*.61,4,10,gore*Math.PI/6,Math.PI/6,0,Math.PI/2),tileMats[gore%4]);
        dome.position.y=roofBase+.07; dome.castShadow=true; g.add(dome);
        var points=[];
        for(var mer=0;mer<=12;mer++){
          var polar=mer/12*Math.PI/2, az=gore*Math.PI/6;
          points.push(new T.Vector3(-Math.cos(az)*Math.sin(polar)*W*.618,roofBase+.07+Math.cos(polar)*W*.618,Math.sin(az)*Math.sin(polar)*W*.618));
        }
        g.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),12,.026,5,false),brassMat));
      }
      var rim=new T.Mesh(new T.TorusGeometry(W*.615,.045,6,32),brassMat);
      rim.rotation.x=Math.PI/2; rim.position.y=roofBase+.07; g.add(rim);
    } else if (st.roof === 'egg') {
      // Leaf-shaped petal canopy shelters the woven nursery.
      radialRoof(W*.59,roofBase-.21,.42,8,.94);
    }
    // Deep knee-braces and pinned ironwork beneath every suspended platform.
    [-1,1].forEach(function(side) {
      [-1,1].forEach(function(front) {
        beam([side*W*.19,-.58,front*D*.19],[side*W*.48,-.07,front*D*.44],.14);
        var peg=cyl(.035,.035,.12,8,brassMat,side*W*.48,-.08,front*(D*.44+.06));
        peg.rotation.x=Math.PI/2; g.add(peg);
      });
    });
    g.userData.architecture = { version:358, signature:st.signature, parts:craftParts };

    // ---- openings: dark interior, frames, mullions, sills, shutters ----
    (st.windows || []).forEach(function(w) {
      var col = w.cool ? GLOW_COOL : GLOW_WARM;
      // Windows sit ON the front wall. The old `w.z * D/2` put them a few
      // centimetres INSIDE the body, so every pane was hidden by its own wall.
      var frontZ = st.roof === 'egg' ? W * 0.50 : D / 2;
      var wx = w.x * W, wy = 0.05 + w.y * H + H * 0.12, wz = frontZ + 0.015;
      var ww = w.r * (w.wide ? 2.1 : 1.1), wh = w.r * (w.wide ? 1.15 : 1.35);
      // Recessed dark interior behind the glass gives the opening depth.
      g.add(box(ww * 0.98, wh * 0.98, 0.10, interiorMat, wx, wy, wz - 0.09));
      var mat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92 });
      var geo = w.round ? new T.CircleGeometry(w.r, 18) : new T.PlaneGeometry(ww, wh);
      var pane = new T.Mesh(geo, mat);
      pane.position.set(wx, wy, wz + 0.03);
      g.add(pane);
      // Frame + mullions.
      if (w.round) {
        g.add(new T.Mesh(new T.TorusGeometry(w.r + 0.03, 0.038, 5, 18), trimMat).translateX(wx).translateY(wy).translateZ(wz + 0.02));
        g.add(box(0.045, w.r * 2, 0.045, trimMat, wx, wy, wz + 0.045));
        g.add(box(w.r * 2, 0.045, 0.045, trimMat, wx, wy, wz + 0.045));
      } else {
        g.add(box(ww + 0.10, 0.06, 0.07, trimMat, wx, wy + wh / 2, wz + 0.035));
        g.add(box(ww + 0.10, 0.06, 0.07, trimMat, wx, wy - wh / 2, wz + 0.035));
        g.add(box(0.06, wh, 0.07, trimMat, wx - ww / 2, wy, wz + 0.035));
        g.add(box(0.06, wh, 0.07, trimMat, wx + ww / 2, wy, wz + 0.035));
        var bars = w.wide ? 3 : 1;
        for (var mb = 1; mb <= bars; mb++) {
          g.add(box(0.038, wh, 0.05, trimMat, wx - ww / 2 + (mb / (bars + 1)) * ww, wy, wz + 0.045));
        }
        g.add(box(ww, 0.04, 0.05, trimMat, wx, wy, wz + 0.045));
        // Sill with a lip, and shutters either side.
        g.add(box(ww + 0.26, 0.06, 0.16, trimMat, wx, wy - wh / 2 - 0.05, wz + 0.07));
        [-1, 1].forEach(function(sd) {
          var sht = box(ww * 0.32, wh * 0.96, 0.05, darkMat, wx + sd * (ww / 2 + ww * 0.17), wy, wz + 0.06);
          sht.rotation.y = -sd * 0.45;
          g.add(sht);
        });
      }
      var halo = new T.Sprite(new T.SpriteMaterial({
        map: sharedSoft(w.cool ? '150,190,255' : '255,186,104'),
        transparent: true, opacity: 0, depthWrite: false, fog: false, blending: T.AdditiveBlending
      }));
      var hs = w.r * (w.wide ? 3.4 : 2.7) * (w.cool ? 0.7 : 1);
      halo.scale.set(hs, hs * 0.82, 1);
      halo.position.set(wx, wy, wz + 0.14);
      g.add(halo);
      glows.push({ mat: mat, halo: halo.material, warm: !w.cool, base: 0.92 });
    });

    // ---- ladder down to the bough ----
    var lad = new T.Group();
    lad.add(box(0.055, 1.6, 0.055, trimMat, -0.19, -0.8, 0));
    lad.add(box(0.055, 1.6, 0.055, trimMat, 0.19, -0.8, 0));
    for (var rg = 0; rg < 6; rg++) lad.add(box(0.46, 0.045, 0.055, ropeMat, 0, -0.22 - rg * 0.26, 0));
    lad.position.set(W * 0.22, 0, D * 0.5 + 0.20);
    lad.rotation.x = -0.10;
    g.add(lad);

    // ---- per-building props ----
    var ex = st.extras || [];
    function lantern(x, y, z, cool) {
      var lg = new T.Group();
      lg.add(cyl(0.016, 0.016, 0.30, 4, ironMat, 0, 0.22, 0));
      lg.add(new T.Mesh(new T.TorusGeometry(0.05, 0.012, 4, 8), ironMat).translateY(0.36).rotateX(Math.PI / 2));
      var glassMat = new T.MeshBasicMaterial({ color: cool ? GLOW_COOL : GLOW_WARM, transparent: true, opacity: 0.95 });
      lg.add(new T.Mesh(new T.CylinderGeometry(0.085, 0.095, 0.19, 6), glassMat));
      // Cage bars, cap and base.
      for (var cb = 0; cb < 4; cb++) {
        var cba = cb * Math.PI / 2 + Math.PI / 4;
        lg.add(box(0.018, 0.20, 0.018, ironMat, Math.sin(cba) * 0.085, 0, Math.cos(cba) * 0.085));
      }
      var capm = new T.Mesh(new T.ConeGeometry(0.13, 0.10, 6), ironMat);
      capm.position.y = 0.15;
      lg.add(capm);
      lg.add(new T.Mesh(new T.CylinderGeometry(0.10, 0.11, 0.035, 6), ironMat).translateY(-0.11));
      var lhalo = new T.Sprite(new T.SpriteMaterial({
        map: sharedSoft(cool ? '170,200,255' : '255,196,120'), transparent: true, opacity: 0,
        depthWrite: false, fog: false, blending: T.AdditiveBlending
      }));
      lhalo.scale.set(0.72, 0.72, 1);
      lg.add(lhalo);
      lg.position.set(x, y, z);
      g.add(lg);
      glows.push({ mat: glassMat, halo: lhalo.material, warm: !cool, base: 0.95, lantern: true });
      return lg;
    }
    function barrel(x, y, z, s) {
      s = s || 1;
      var bm = new T.MeshLambertMaterial({ color: 0x6a4826 });
      g.add(cyl(0.19 * s, 0.17 * s, 0.42 * s, 12, bm, x, y + 0.21 * s, z));
      [0.32, 0.11].forEach(function(hy) {
        g.add(new T.Mesh(new T.TorusGeometry(0.19 * s, 0.02 * s, 4, 12), ironMat).translateX(x).translateY(y + hy * s).translateZ(z).rotateX(Math.PI / 2));
      });
    }
    function crate(x, y, z, s) {
      s = s || 1;
      g.add(box(0.30 * s, 0.26 * s, 0.30 * s, new T.MeshLambertMaterial({ color: 0x7a5a32 }), x, y + 0.13 * s, z));
      g.add(box(0.32 * s, 0.04 * s, 0.32 * s, trimMat, x, y + 0.24 * s, z));
      g.add(box(0.32 * s, 0.04 * s, 0.32 * s, trimMat, x, y + 0.04 * s, z));
    }

    if (ex.indexOf('lantern-left') >= 0) lantern(-(W / 2 + 0.34), 0.98, D * 0.24, id === 'observatory');
    if (ex.indexOf('lantern-right') >= 0) lantern(W / 2 + 0.34, 0.94, D * 0.24, false);
    if (ex.indexOf('chimney') >= 0) {
      // Stone stack, laid in courses, with an iron cowl.
      for (var ch = 0; ch < 5; ch++) {
        var cw = 0.34 - ch * 0.012;
        g.add(bevel(cw, 0.17, cw, ch % 2 ? new T.MeshLambertMaterial({ color: 0x6b6156 }) : new T.MeshLambertMaterial({ color: 0x7a6f62 }),
          W * 0.30, roofBase + 0.42 + ch * 0.17, -D * 0.10));
      }
      g.add(bevel(0.44, 0.08, 0.44, ironMat, W * 0.30, roofBase + 1.21, -D * 0.10));
      g.add(bevel(0.30, 0.10, 0.30, ironMat, W * 0.30, roofBase + 1.30, -D * 0.10));
      g.userData.chimney = new T.Vector3(W * 0.30, roofBase + 1.37, -D * 0.10);
    }
    if (ex.indexOf('cross') >= 0) {
      var crossMat = new T.MeshBasicMaterial({ color: 0x9ef0b8 });
      g.add(new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.05, 20), new T.MeshLambertMaterial({ color: 0x2f5c38 }))
        .translateY(0.05 + H * 0.86).translateZ(D / 2 + 0.05).rotateX(Math.PI / 2));
      g.add(new T.Mesh(new T.TorusGeometry(0.32, 0.028, 5, 20), trimMat).translateY(0.05 + H * 0.86).translateZ(D / 2 + 0.06));
      var cv = new T.Mesh(new T.PlaneGeometry(0.13, 0.36), crossMat);
      cv.position.set(0, 0.05 + H * 0.86, D / 2 + 0.08);
      g.add(cv);
      var chz = new T.Mesh(new T.PlaneGeometry(0.36, 0.13), crossMat);
      chz.position.copy(cv.position);
      g.add(chz);
      glows.push({ mat: crossMat, warm: false, base: 1, pulse: true });
    }
    if (ex.indexOf('sign') >= 0) {
      g.add(box(0.06, 0.06, 0.70, trimMat, W / 2 + 0.34, 0.05 + H * 0.94, 0));
      g.add(box(0.06, 0.34, 0.06, trimMat, W / 2 + 0.34, 0.05 + H * 0.94 - 0.17, 0.30));
      var signG = new T.Group();
      signG.add(new T.Mesh(new T.CylinderGeometry(0.29, 0.29, 0.055, 18), new T.MeshLambertMaterial({ color: 0x6b4a28 })).rotateX(Math.PI / 2));
      signG.add(new T.Mesh(new T.TorusGeometry(0.29, 0.03, 5, 18), trimMat));
      var crow = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), new T.MeshLambertMaterial({ color: 0x1c1c22 }));
      crow.scale.set(1.3, 1, 0.7);
      crow.position.z = 0.05;
      signG.add(crow);
      signG.add(new T.Mesh(new T.ConeGeometry(0.04, 0.11, 5), new T.MeshLambertMaterial({ color: 0xd8a03a })).translateX(0.15).translateZ(0.05).rotateZ(-Math.PI / 2));
      signG.position.set(W / 2 + 0.34, 0.05 + H * 0.62, 0.30);
      g.add(signG);
      g.userData.sign = signG;
    }
    if (ex.indexOf('barrel') >= 0) { barrel(-W * 0.44, 0.05, D * 0.06); crate(-W * 0.44, 0.05, -D * 0.26, 0.8); }
    if (ex.indexOf('stools') >= 0) {
      for (var s2 = -1; s2 <= 1; s2++) {
        g.add(cyl(0.11, 0.10, 0.06, 10, trimMat, s2 * 0.44, 0.30, D * 0.30));
        for (var lgs = 0; lgs < 3; lgs++) {
          var la2 = lgs * 2.1;
          var leg = cyl(0.02, 0.025, 0.28, 4, darkMat, s2 * 0.44 + Math.sin(la2) * 0.07, 0.15, D * 0.30 + Math.cos(la2) * 0.07);
          leg.rotation.set(Math.cos(la2) * 0.12, 0, -Math.sin(la2) * 0.12);
          g.add(leg);
        }
      }
      // Bottles on a back shelf.
      g.add(box(W * 0.82, 0.05, 0.14, trimMat, 0, 0.05 + H * 0.52, -D * 0.30));
      for (var bo = 0; bo < 6; bo++) {
        g.add(cyl(0.035, 0.045, 0.17, 6, new T.MeshLambertMaterial({ color: [0x3c6b43, 0x6b4a28, 0x2f4f6b][bo % 3] }),
          -W * 0.32 + bo * (W * 0.64 / 5), 0.05 + H * 0.52 + 0.11, -D * 0.30));
      }
    }
    if (ex.indexOf('target') >= 0) {
      var tg = new T.Group();
      tg.add(new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.06, 20), new T.MeshLambertMaterial({ color: 0xe8dcc0 })).rotateX(Math.PI / 2));
      tg.add(new T.Mesh(new T.TorusGeometry(0.32, 0.028, 5, 20), trimMat));
      tg.add(new T.Mesh(new T.TorusGeometry(0.20, 0.035, 6, 18), new T.MeshLambertMaterial({ color: 0xa8322a })).translateZ(0.03));
      tg.add(new T.Mesh(new T.CircleGeometry(0.075, 14), new T.MeshLambertMaterial({ color: 0xa8322a })).translateZ(0.05));
      tg.position.set(0, 0.05 + H * 0.55, -D * 0.44);
      tg.rotation.y = Math.PI;
      g.add(tg);
    }
    if (ex.indexOf('training-posts') >= 0) {
      for (var tp = -1; tp <= 1; tp += 2) {
        g.add(cyl(0.055, 0.07, 0.70, 8, trimMat, tp * W * 0.54, 0.40, D * 0.32));
        g.add(new T.Mesh(new T.TorusGeometry(0.09, 0.022, 4, 10), ropeMat).translateX(tp * W * 0.54).translateY(0.66).translateZ(D * 0.32).rotateX(Math.PI / 2));
        g.add(box(0.11, 0.11, 0.11, new T.MeshLambertMaterial({ color: 0x8a3a2e }), tp * W * 0.54, 0.80, D * 0.32));
      }
    }
    if (ex.indexOf('roof-nest') >= 0) {
      var nest = new T.Mesh(new T.TorusGeometry(0.32, 0.12, 7, 14), new T.MeshLambertMaterial({ color: 0x8a6a3c }));
      nest.rotation.x = Math.PI / 2;
      nest.position.y = roofBase + 1.0;
      g.add(nest);
      for (var tw2 = 0; tw2 < 7; tw2++) {
        var twg = box(0.035, 0.035, 0.42, ropeMat, 0, roofBase + 1.02, 0);
        twg.rotation.set(0.2, tw2 * 0.9, 0.1);
        g.add(twg);
      }
      var eggm = new T.Mesh(new T.SphereGeometry(0.11, 10, 8), new T.MeshLambertMaterial({ color: 0xefe4c8 }));
      eggm.scale.y = 1.3;
      eggm.position.y = roofBase + 1.04;
      g.add(eggm);
    }
    if (ex.indexOf('hanging-nest') >= 0 || ex.indexOf('hanging-cradle') >= 0) {
      var hang = new T.Group();
      [-1, 1].forEach(function(hz) { hang.add(cyl(0.012, 0.012, 0.44, 4, ropeMat, hz * 0.10, 0.22, 0)); });
      var basket = new T.Mesh(new T.SphereGeometry(0.21, 12, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new T.MeshLambertMaterial({ color: 0x9a7440 }));
      hang.add(basket);
      hang.add(new T.Mesh(new T.TorusGeometry(0.21, 0.022, 4, 14), trimMat));
      hang.position.set(-(W / 2 + 0.46), 0.52, D * 0.08);
      g.add(hang);
      g.add(box(0.06, 0.06, 0.56, trimMat, -(W / 2 + 0.26), 0.76, D * 0.08));
      g.userData.swing = hang;
    }
    if (ex.indexOf('crossed-poles') >= 0) {
      for (var cp = -1; cp <= 1; cp += 2) {
        var pole = cyl(0.04, 0.05, 1.05, 6, trimMat, cp * 0.24, 0.05 + H * 1.02, 0);
        pole.rotation.z = cp * 0.34;
        g.add(pole);
      }
      g.add(new T.Mesh(new T.TorusGeometry(0.09, 0.022, 4, 10), ropeMat).translateY(0.05 + H * 1.24).rotateY(0.4));
    }
    if (ex.indexOf('crescent') >= 0) {
      var moonMat = new T.MeshBasicMaterial({ color: 0xf0dc9a });
      var moon = new T.Mesh(new T.TorusGeometry(0.19, 0.05, 7, 16, Math.PI * 1.35), moonMat);
      moon.position.y = roofBase + W * 0.62 + 0.28;
      moon.rotation.z = -0.6;
      g.add(moon);
      g.add(cyl(0.022, 0.022, 0.26, 5, trimMat, 0, roofBase + W * 0.62 + 0.10, 0));
      glows.push({ mat: moonMat, warm: false, base: 1, always: true });
    }
    if (ex.indexOf('telescope') >= 0) {
      var scope = new T.Group();
      scope.add(cyl(0.12,0.065,0.76,16,brassMat));
      [.18,.36].forEach(function(y){var ring=new T.Mesh(new T.TorusGeometry(y>.2?.125:.10,.022,5,16),joineryMat);ring.rotation.x=Math.PI/2;ring.position.y=y;scope.add(ring);});
      scope.add(cyl(.043,.04,.16,8,trimMat,0,-.43,0));
      var lens=new T.Mesh(new T.CircleGeometry(.109,20),new T.MeshBasicMaterial({color:0x9ccede}));
      lens.rotation.x=-Math.PI/2;lens.position.y=.383;scope.add(lens);
      scope.rotation.set(1.05,0.5,0);
      scope.position.set(-W*.18,.74,D/2+.34);
      g.add(scope);
      // A real observing balcony, with the tripod outside the closed wall.
      g.add(bevel(W*.86,.10,.76,wallMat,0,0,D/2+.25));
      for (var tl = 0; tl < 3; tl++) {
        var ta = tl * Math.PI*2/3;
        beam([-W*.18,.73,D/2+.34],[-W*.18+Math.sin(ta)*.22,.06,D/2+.34+Math.cos(ta)*.22],.045,trimMat);
      }
      [-1,1].forEach(function(side){beam([side*W*.31,-.30,D*.25],[side*W*.31,-.04,D/2+.48],.08);});
      g.userData.scope = scope;
    }
    if (ex.indexOf('weathervane') >= 0) {
      var vane = new T.Group();
      vane.add(cyl(0.022, 0.022, 0.54, 5, ironMat, 0, 0.27, 0));
      var arrow = new T.Mesh(new T.ConeGeometry(0.075, 0.24, 5), ironMat);
      arrow.rotation.z = -Math.PI / 2;
      arrow.position.set(0.24, 0.50, 0);
      vane.add(arrow);
      vane.add(box(0.18, 0.16, 0.02, ironMat, -0.19, 0.50, 0));
      vane.add(box(0.40, 0.03, 0.03, ironMat, 0.02, 0.50, 0));
      vane.position.set(-W * 0.40, roofBase + 0.52, D * 0.28);
      g.add(vane);
      g.userData.vane = vane;
      // Compass ring below it.
      g.add(new T.Mesh(new T.TorusGeometry(0.13, 0.02, 4, 14), trimMat).translateX(-W * 0.40).translateY(roofBase + 0.46).translateZ(D * 0.28).rotateX(Math.PI / 2));
    }
    if (ex.indexOf('awning') >= 0) {
      var clothMats = [new T.MeshLambertMaterial({color:0xe1cea0}),
        new T.MeshLambertMaterial({color:id==='kitchen'?0x658377:0x8e5162})];
      var awningW=W+0.28, awningTop=.05+H*.86, awningFront=.05+H*.66;
      for(var stripe=0;stripe<8;stripe++) {
        var ax0=-awningW/2+stripe*awningW/8, ax1=ax0+awningW/8;
        for(var fold=0;fold<3;fold++) {
          var f0=fold/3,f1=(fold+1)/3;
          function fabricY(f){return awningTop+(awningFront-awningTop)*f-.07*Math.sin(f*Math.PI);}
          slab([[ax0,fabricY(f0),D/2+.02+f0*.62],[ax1,fabricY(f0),D/2+.02+f0*.62],
            [ax1,fabricY(f1),D/2+.02+f1*.62],[ax0,fabricY(f1),D/2+.02+f1*.62]],.024,clothMats[stripe%2]);
        }
        g.add(bevel(awningW/8-.005,.10,.035,clothMats[stripe%2],(ax0+ax1)/2,awningFront-.045,D/2+.64));
      }
      [-1, 1].forEach(function(ax) {
        g.add(cyl(0.035,0.042,awningFront-.05,6,trimMat,ax*(W*.46),(.05+awningFront)/2,D/2+.61));
      });
      // Herbs hung under the awning.
      for (var hb = 0; hb < 5; hb++) {
        var hx = -W * 0.36 + hb * (W * 0.72 / 4);
        g.add(cyl(0.012, 0.012, 0.16, 4, ropeMat, hx, 0.05 + H * 0.66, D / 2 + 0.22));
        var bunch = new T.Mesh(new T.ConeGeometry(0.055, 0.20, 6), new T.MeshLambertMaterial({ color: [0x5c7a34, 0x7a5c34, 0x8a4a3a][hb % 3] }));
        bunch.position.set(hx, 0.05 + H * 0.58, D / 2 + 0.22);
        g.add(bunch);
      }
    }
    if (ex.indexOf('sacks') >= 0) {
      for (var sk = 0; sk < 3; sk++) {
        var sack = new T.Mesh(new T.SphereGeometry(0.15, 10, 8), new T.MeshLambertMaterial({ color: 0xbfa478 }));
        sack.scale.set(1, 1.3, 1);
        sack.position.set(-W * 0.40 + sk * 0.36, 0.20, D * 0.32);
        g.add(sack);
        g.add(new T.Mesh(new T.TorusGeometry(0.055, 0.018, 4, 8), ropeMat).translateX(-W * 0.40 + sk * 0.36).translateY(0.36).translateZ(D * 0.32).rotateX(Math.PI / 2));
      }
      barrel(W * 0.40, 0.05, D * 0.30, 0.75);
    }
    if (ex.indexOf('rope-belt') >= 0) {
      for (var rb = 0; rb < 2; rb++) {
        var rope2 = new T.Mesh(new T.TorusGeometry(W * 0.57, 0.038, 6, 20), ropeMat);
        rope2.rotation.x = Math.PI / 2;
        rope2.position.y = 0.05 + H * (0.26 + rb * 0.09);
        g.add(rope2);
      }
    }
    if (ex.indexOf('hole-door') >= 0) {
      g.add(new T.Mesh(new T.CircleGeometry(0.22, 16), new T.MeshBasicMaterial({ color: 0x0f0a05 })).translateY(0.05 + H * 0.14).translateZ(D / 2 + 0.04));
      g.add(new T.Mesh(new T.TorusGeometry(0.24, 0.035, 5, 16), trimMat).translateY(0.05 + H * 0.14).translateZ(D / 2 + 0.03));
      g.add(cyl(0.03, 0.03, 0.22, 5, trimMat, 0, 0.05 + H * 0.14 - 0.30, D / 2 + 0.10)); // perch
    }
    if (ex.indexOf('open-front') >= 0) {
      g.add(box(W * 0.84, H * 0.52, 0.06, interiorMat, 0, 0.05 + H * 0.38, -D * 0.34));
      g.add(box(W * 0.84, 0.06, D * 0.66, interiorMat, 0, 0.05 + H * 0.11, -D * 0.02));
      g.add(box(W * 0.90, 0.07, 0.10, trimMat, 0, 0.05 + H * 0.64, D / 2 + 0.02));
      g.add(box(W * 0.90, 0.07, 0.10, trimMat, 0, 0.05 + H * 0.12, D / 2 + 0.02));
      [-1, 1].forEach(function(ox) { g.add(box(0.08, H * 0.54, 0.10, trimMat, ox * W * 0.45, 0.05 + H * 0.38, D / 2 + 0.02)); });
    }
    // Signature facade details: each room gets a recognisable silhouette at
    // phone scale, not merely a new paint colour. Opaque pieces merge into the
    // house shell, so these flourishes do not multiply draw calls.
    var detail = st.details || [];
    function hasDetail(name) { return detail.indexOf(name) >= 0; }
    if (hasDetail('dormer')) {
      timberHouse(W*.36,.32,.38,W*.20,roofBase+.10,D*.40,false);
      gableRoof(W*.36,.38,roofBase+.42,.28,W*.20,D*.40);
      var dormerGlass=new T.MeshBasicMaterial({color:GLOW_WARM,transparent:true,opacity:.92});
      var dormerPane=new T.Mesh(new T.CircleGeometry(.095,16),dormerGlass);
      dormerPane.position.set(W*.20,roofBase+.28,D*.40+.205);g.add(dormerPane);
      var dormerFrame=new T.Mesh(new T.TorusGeometry(.105,.018,5,16),trimMat);
      dormerFrame.position.copy(dormerPane.position);g.add(dormerFrame);
      glows.push({mat:dormerGlass,warm:true,base:.92});
    }
    if (hasDetail('perch-brace')) {
      var perch = cyl(0.035, 0.045, W * 0.72, 6, trimMat, 0, 0.05 + H * 0.24, D / 2 + 0.30);
      perch.rotation.z = Math.PI / 2;
      g.add(perch);
    }
    if (hasDetail('shields')) {
      [-1, 1].forEach(function(sd2) {
        var shield = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.045, 12), new T.MeshLambertMaterial({ color: sd2 < 0 ? 0x8e3f32 : 0x385b7a }));
        shield.rotation.x = Math.PI / 2;
        shield.position.set(sd2 * W * 0.28, 0.05 + H * 0.67, D / 2 + 0.09);
        g.add(shield);
        g.add(new T.Mesh(new T.TorusGeometry(0.18, 0.025, 4, 12), trimMat).translateX(sd2 * W * 0.28).translateY(0.05 + H * 0.67).translateZ(D / 2 + 0.12));
      });
    }
    if (hasDetail('pennants') || hasDetail('banners') || hasDetail('quest-banners')) {
      [-1, 1].forEach(function(bn) {
        g.add(cyl(0.018, 0.022, 0.72, 5, trimMat, bn * W * 0.42, 0.05 + H * 0.92, D / 2 + 0.12));
        var cloth = new T.Mesh(new T.PlaneGeometry(0.25, 0.42), new T.MeshLambertMaterial({ color: bn < 0 ? 0xb94f3c : 0xd6a84f, side: T.DoubleSide }));
        cloth.position.set(bn * W * 0.42 + bn * 0.13, 0.05 + H * 1.02, D / 2 + 0.13);
        cloth.rotation.z = bn * -0.14;
        g.add(cloth);
      });
    }
    if (hasDetail('greenhouse')) {
      var glass = new T.MeshLambertMaterial({ color: 0x9ed8b7, transparent: true, opacity: 0.38, side: T.DoubleSide });
      var glassRoof = box(W * 0.52, 0.035, D * 0.52, glass, W * 0.48, 0.05 + H * 0.50, 0);
      glassRoof.rotation.z = -0.34;
      glassRoof.castShadow = false;
      g.add(glassRoof);
      for (var gr = -1; gr <= 1; gr++) g.add(cyl(0.022, 0.025, H * 0.48, 5, trimMat, W * 0.56, 0.05 + H * 0.26, gr * D * 0.22));
    }
    if (hasDetail('herb-box')) {
      g.add(box(W * 0.42, 0.12, 0.18, darkMat, W * 0.24, 0.05 + H * 0.20, D / 2 + 0.12));
      for (var herb = 0; herb < 5; herb++) {
        var herbLeaf = new T.Mesh(new T.ConeGeometry(0.045, 0.18, 5), new T.MeshLambertMaterial({ color: herb % 2 ? 0x4f7a3a : 0x6d8e45 }));
        herbLeaf.position.set(W * 0.08 + herb * W * 0.08, 0.05 + H * 0.31, D / 2 + 0.13);
        herbLeaf.rotation.z = (herb - 2) * 0.08;
        g.add(herbLeaf);
      }
    }
    if (hasDetail('copper-pans') || hasDetail('tool-wheel') || hasDetail('lens-rings')) {
      for (var pan = 0; pan < 3; pan++) {
        var metalCol = hasDetail('copper-pans') ? 0xc57b42 : (hasDetail('lens-rings') ? 0xd1b55a : 0x6f7880);
        var wheel = new T.Mesh(new T.TorusGeometry(0.11 + pan * 0.025, 0.018, 4, 12), new T.MeshLambertMaterial({ color: metalCol }));
        wheel.position.set(-W * 0.28 + pan * W * 0.28, 0.05 + H * 0.73, D / 2 + 0.10);
        g.add(wheel);
      }
    }
    if (hasDetail('pulley')) {
      var pulley = new T.Mesh(new T.TorusGeometry(0.17, 0.035, 5, 14), ironMat);
      pulley.position.set(W * 0.48, 0.05 + H * 0.86, D * 0.18);
      pulley.rotation.y = Math.PI / 2;
      g.add(pulley);
      g.add(cyl(0.012, 0.012, 0.82, 4, ropeMat, W * 0.48, 0.05 + H * 0.43, D * 0.18));
      g.add(new T.Mesh(new T.TorusGeometry(0.07, 0.018, 4, 10, Math.PI * 1.6), ironMat).translateX(W * 0.48).translateY(0.05).translateZ(D * 0.18));
    }
    if (hasDetail('book-balcony') || hasDetail('map-board')) {
      g.add(box(W * 0.72, H * 0.34, 0.08, darkMat, 0, 0.05 + H * 0.46, D / 2 + 0.08));
      g.add(box(W * 0.78, 0.07, 0.22, trimMat, 0, 0.05 + H * 0.28, D / 2 + 0.15));
      if (hasDetail('book-balcony')) {
        for (var bk = 0; bk < 7; bk++) g.add(box(0.08, 0.22 + (bk % 3) * 0.04, 0.06,
          new T.MeshLambertMaterial({ color: [0x7f3f32, 0x385b7a, 0x76613a][bk % 3] }),
          -W * 0.27 + bk * W * 0.09, 0.05 + H * 0.43, D / 2 + 0.14));
      } else {
        var scroll = new T.Mesh(new T.PlaneGeometry(W * 0.54, H * 0.22), new T.MeshLambertMaterial({ color: 0xd7c79a, side: T.DoubleSide }));
        scroll.position.set(0, 0.05 + H * 0.47, D / 2 + 0.14);
        g.add(scroll);
      }
    }
    if (hasDetail('reading-lamp')) lantern(W * 0.35, 0.05 + H * 0.74, D / 2 + 0.20, false);
    if (hasDetail('targets')) {
      [-1, 0, 1].forEach(function(tg) {
        var targetDisc = new T.Mesh(new T.CylinderGeometry(0.13, 0.13, 0.035, 12),
          new T.MeshLambertMaterial({ color: tg ? 0xd1b45d : 0xa94a38 }));
        targetDisc.rotation.x = Math.PI / 2;
        targetDisc.position.set(tg * W * 0.28, 0.05 + H * 0.47, D / 2 + 0.10);
        g.add(targetDisc);
      });
    }
    if (hasDetail('sparring-rack')) {
      [-1, 1].forEach(function(sr) {
        var spar = cyl(0.025, 0.03, H * 0.58, 6, trimMat, sr * W * 0.34, 0.05 + H * 0.36, D / 2 + 0.14);
        spar.rotation.z = sr * 0.78;
        g.add(spar);
      });
      g.add(box(W * 0.78, 0.07, 0.10, darkMat, 0, 0.05 + H * 0.18, D / 2 + 0.13));
    }
    if (hasDetail('balcony-table')) {
      var tableTop = new T.Mesh(new T.CylinderGeometry(W * 0.20, W * 0.20, 0.08, 12), trimMat);
      tableTop.position.set(0, 0.05 + H * 0.30, D / 2 + 0.24);
      g.add(tableTop);
      g.add(cyl(0.055, 0.07, H * 0.28, 7, darkMat, 0, 0.05 + H * 0.15, D / 2 + 0.24));
    }
    if (hasDetail('bottle-rack')) {
      g.add(box(W * 0.56, H * 0.30, 0.07, darkMat, -W * 0.12, 0.05 + H * 0.62, D / 2 + 0.11));
      for (var bt = 0; bt < 5; bt++) {
        var bottle = cyl(0.025, 0.04, 0.18 + (bt % 2) * 0.05, 7,
          new T.MeshLambertMaterial({ color: bt % 2 ? 0x5f7f63 : 0x87633f }),
          -W * 0.33 + bt * W * 0.105, 0.05 + H * 0.58, D / 2 + 0.16);
        g.add(bottle);
      }
    }
    if (hasDetail('ward-lantern')) lantern(-W * 0.38, 0.05 + H * 0.66, D / 2 + 0.20, false);
    if (hasDetail('pub-sign')) {
      g.add(box(0.06, H * 0.55, 0.06, trimMat, W * 0.48, 0.05 + H * 0.56, D / 2 + 0.08));
      var pubBoard = box(W * 0.42, H * 0.24, 0.07, darkMat, W * 0.33, 0.05 + H * 0.72, D / 2 + 0.10);
      pubBoard.rotation.z = -0.08;
      g.add(pubBoard);
    }
    if (hasDetail('barrels')) {
      [-1, 1].forEach(function(br) {
        var barrel = new T.Mesh(new T.CylinderGeometry(0.16, 0.18, 0.35, 10), darkMat);
        barrel.position.set(br * W * 0.34, 0.05 + 0.18, D / 2 + 0.16);
        g.add(barrel);
        [-1, 1].forEach(function(band) {
          var barrelBand = new T.Mesh(new T.TorusGeometry(0.17, 0.018, 4, 10), ironMat);
          barrelBand.rotation.x = Math.PI / 2;
          barrelBand.position.set(br * W * 0.34, 0.05 + 0.18 + band * 0.10, D / 2 + 0.16);
          g.add(barrelBand);
        });
      });
    }
    if (hasDetail('cradle-mobile')) {
      g.add(cyl(0.018, 0.022, H * 0.42, 5, trimMat, 0, 0.05 + H * 0.78, D / 2 + 0.18));
      var mobileBar = box(W * 0.40, 0.035, 0.035, trimMat, 0, 0.05 + H * 0.62, D / 2 + 0.18);
      g.add(mobileBar);
      [-1, 0, 1].forEach(function(mb) {
        g.add(cyl(0.010, 0.010, 0.18 + Math.abs(mb) * 0.05, 4, ropeMat,
          mb * W * 0.16, 0.05 + H * 0.51, D / 2 + 0.18));
        var charm = new T.Mesh(new T.ConeGeometry(0.055, 0.11, 5), new T.MeshLambertMaterial({ color: mb ? 0xd6a84f : 0x7ca58d }));
        charm.position.set(mb * W * 0.16, 0.05 + H * 0.40, D / 2 + 0.18);
        g.add(charm);
      });
    }
    if (hasDetail('woven-ribs')) {
      [.65,1.03,1.42,1.83,2.22,2.60].forEach(function(polar) {
        var wovenRib = new T.Mesh(new T.TorusGeometry(Math.sin(polar)*(W*.53+.018),.018,5,28),trimMat);
        wovenRib.scale.y=.94;
        wovenRib.rotation.x=Math.PI/2;
        wovenRib.position.y=.05+H*.51+Math.cos(polar)*H*.5196;
        g.add(wovenRib);
      });
    }
    if (hasDetail('star-band')) {
      for (var sb = 0; sb < 5; sb++) {
        var star = new T.Mesh(new T.OctahedronGeometry(0.055 + (sb % 2) * 0.015),
          new T.MeshLambertMaterial({ color: sb % 2 ? 0xd9c678 : 0x8fb3c7 }));
        star.position.set(-W * 0.34 + sb * W * 0.17, 0.05 + H * (0.42 + (sb % 2) * 0.10), D / 2 + 0.11);
        g.add(star);
      }
    }
    // Every house gets a window box of flowers and a coil of rope — the small
    // signs of somebody living there.
    if (ex.indexOf('open-front') < 0 && id !== 'observatory') {
      var pbW = W * 0.30;
      g.add(box(pbW, 0.10, 0.12, darkMat, -W * 0.26, 0.05 + H * 0.13, D / 2 + 0.07));
      g.add(box(pbW + 0.03, 0.03, 0.13, trimMat, -W * 0.26, 0.05 + H * 0.13 + 0.06, D / 2 + 0.07));
      for (var fw = 0; fw < 3; fw++) {
        g.add(new T.Mesh(new T.SphereGeometry(0.032, 6, 5), new T.MeshLambertMaterial({ color: [0xe8697d, 0xf0c04a, 0xc27ad6][fw] }))
          .translateX(-W * 0.26 - pbW * 0.34 + fw * (pbW * 0.34)).translateY(0.05 + H * 0.13 + 0.10).translateZ(D / 2 + 0.07));
      }
    }

    // Swinging and turning parts keep their own transforms; the rest of the
    // house — every plank, shingle, mullion and rail — bakes into one mesh.
    var moving = [g.userData.swing, g.userData.sign, g.userData.vane, g.userData.scope].filter(Boolean);
    mergeStatic(g, {
      name: id + '-shell',
      only: function(o, m) {
        if (m.map || m.transparent) return false;
        for (var i = 0; i < moving.length; i++) {
          var q = o;
          while (q) { if (q === moving[i]) return false; q = q.parent; }
        }
        return true;
      }
    });
    g.userData.roomId = id;
    g.userData.glows = glows;
    g.traverse(function(o) { if (o.isMesh || o.isSprite) o.userData.roomId = id; });
    return g;
  }

  // ---- scene ---------------------------------------------------------------

  function createAcademy3D(adapter) {
    if (!adapter || typeof adapter.container !== 'function') return null;
    T = adapter.three || (typeof window !== 'undefined' ? window.THREE : null);
    if (!T) return null;

    var st = {
      running: false, mounted: false, raf: 0, lastT: 0, clock: 0,
      cont: null, renderer: null, scene: null, camera: null,
      w: 0, h: 0, night: false, boost: 0,
      cam: { az: 0.55, polar: 1.46, dist: 33, lastInput: 0 },
      pointers: new Map(), orbitStart: null, pinchLast: null, dragged: false,
      houses: [], glows: [], smokes: [], fireflies: null, leafFall: [],
      labels: [], sun: null, moon: null, hemi: null, sky: null,
      builtKey: '', shadowTick: 0, disposed: false,
      quality: qualityProfileFor(390, 1, 4, 4),
      treeLightRequested: false, treeLightActive: false,
      treeLights: [], treeLightHalos: [], treeLightMaterials: [], treeLeafMaterials: []
    };
    var rng = mulberry32(20260730);

    function renderScene() {
      var manga = typeof globalThis !== 'undefined' && globalThis.BurbzManga;
      if (manga) manga.render(T, st.renderer, st.scene, st.camera);
      else st.renderer.render(st.scene, st.camera);
    }

    function hourNow() {
      try {
        if (adapter.hourOfDay) {
          var h = Number(adapter.hourOfDay());
          if (isFinite(h)) return h;
        }
      } catch (e) {}
      var d = new Date();
      return d.getHours() + d.getMinutes() / 60;
    }
    function builtRooms() {
      try { return (adapter.builtRooms && adapter.builtRooms()) || []; } catch (e) { return []; }
    }
    function reduced() {
      try { return !!(adapter.reducedMotion && adapter.reducedMotion()); } catch (e) { return false; }
    }

    function qualityForSize(w, h) {
      var nav = typeof navigator !== 'undefined' ? navigator : {};
      var dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
      var coarse = false;
      try { coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches; } catch (e) {}
      var mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(String(nav.userAgent || ''));
      return qualityProfileFor(w, dpr, nav.hardwareConcurrency, nav.deviceMemory, h, coarse || mobileUa);
    }

    function requestedTreeLights() {
      try { return !!(adapter.treeLightsEnabled && adapter.treeLightsEnabled()); } catch (e) { return false; }
    }

    function applyTreeLights(active) {
      active = !!active;
      st.treeLightActive = active;
      st.treeLights.forEach(function(light, idx) {
        light.intensity = active ? (idx === st.treeLights.length - 1 ? 2.55 : 1.85) : 0;
      });
      st.treeLightMaterials.forEach(function(mat, idx) {
        mat.opacity = active ? (idx === 0 ? 0.36 : 0.22) : 0;
      });
      st.treeLightHalos.forEach(function(mat, idx) {
        mat.opacity = active ? (0.14 + (idx % 4) * 0.025) : 0;
      });
      st.treeLeafMaterials.forEach(function(mat, idx) {
        if (!mat || !mat.emissive) return;
        mat.emissive.setHex(active ? (idx === 1 ? 0x48330e : 0x28320d) : 0x000000);
        mat.emissiveIntensity = active ? (idx === 1 ? 0.72 : 0.46) : 0;
      });
    }

    function applyStaticRoomGlows(active) {
      var boost = lightBoostFor(hourNow());
      st.glows.forEach(function(g) {
        if (g.lit === undefined) g.lit = true;
        var day = g.always ? 0.85 : 0.42;
        var target = g.lit ? day + (g.base - day) * boost : 0.04;
        if (!active && boost > 0.5 && !g.always) target *= 0.68;
        if (active) target = Math.max(target, Math.min(1, g.base * (g.lantern ? 1.02 : 1.12)));
        g.mat.opacity = target;
        var haloAmt = target * (0.08 + boost * 0.40 + (active ? 0.20 : 0));
        if (g.halo) g.halo.opacity = haloAmt;
        if (g.halos) for (var hh = 0; hh < g.halos.length; hh++) g.halos[hh].opacity = haloAmt;
      });
    }

    function setTreeLights(on) {
      st.treeLightRequested = !!on;
      applyTreeLights(treeLightsActiveFor(hourNow(), st.treeLightRequested));
      applyStaticRoomGlows(st.treeLightActive);
      // Reduced-motion mode has no animation loop to repaint the button's
      // choice, so draw its one still frame immediately.
      if (!st.running && st.renderer && st.scene && st.camera) renderScene();
      return st.treeLightActive;
    }

    // Three real, shadow-free point lights provide leaf/bark response; a single
    // merged inner-vein mesh and bounded additive halos imitate warm bounced
    // light through the branches. This gives a ray-traced feeling without the
    // battery and frame-rate cost of actual path tracing on a phone.
    function buildTreeLightRig(scene, tree) {
      st.treeLights = []; st.treeLightHalos = []; st.treeLightMaterials = [];
      for (var li = 0; li < st.quality.lightCount; li++) {
        var ly = 3.4 + li * (8.1 / Math.max(1, st.quality.lightCount - 1));
        var light = new T.PointLight(li === st.quality.lightCount - 1 ? 0xffd58a : 0xffa94f, 0, li === st.quality.lightCount - 1 ? 15 : 11, 2);
        light.position.set(Math.sin(li * 2.3) * 0.7, ly, Math.cos(li * 2.3) * 0.7);
        light.castShadow = false;
        scene.add(light);
        st.treeLights.push(light);
      }

      var buildGlowMat = new T.MeshBasicMaterial({ color: 0xffb04f });
      var veinGroup = new T.Group();
      var luminousTips = tree.tips.filter(function(tip) { return tip.p.y > 8.5; });
      luminousTips.slice(0, 12).forEach(function(tip, idx) {
        var from = new T.Vector3(tip.p.x * 0.10, Math.max(5.4, tip.p.y - 3.4), tip.p.z * 0.10);
        var to = tip.p.clone().multiplyScalar(0.88);
        veinGroup.add(limb(from, to, idx % 3 === 0 ? 0.075 : 0.05, 0.018, buildGlowMat, 0.45));
      });
      scene.add(veinGroup);
      var veinMesh = mergeStatic(veinGroup, { name: 'tree-light-veins' });
      if (veinMesh) {
        var veinMat = new T.MeshBasicMaterial({ color: 0xffb04f, transparent: true, opacity: 0,
          depthWrite: false, blending: T.AdditiveBlending, vertexColors: true });
        veinMesh.material = veinMat;
        veinMesh.castShadow = false; veinMesh.receiveShadow = false;
        st.treeLightMaterials.push(veinMat);
      }

      var haloCount = Math.min(st.quality.canopyHalos, Math.max(1, luminousTips.length));
      for (var gh = 0; gh < haloCount; gh++) {
        var tip = luminousTips[(gh * 7) % luminousTips.length];
        if (!tip) break;
        var haloMat = new T.SpriteMaterial({ map: sharedSoft('255,255,255'),
          color: gh % 3 ? 0xffa94f : 0xffdc91, transparent: true, opacity: 0,
          depthWrite: false, depthTest: false, fog: false, blending: T.AdditiveBlending });
        var halo = new T.Sprite(haloMat);
        halo.position.copy(tip.p).add(new T.Vector3(Math.sin(gh * 2.1) * 0.7, 0.35 + (gh % 3) * 0.22, Math.cos(gh * 1.7) * 0.7));
        var haloScale = 1.8 + (gh % 4) * 0.32;
        halo.scale.set(haloScale, haloScale, 1);
        scene.add(halo);
        st.treeLightHalos.push(haloMat);
      }
      st.treeLightRequested = requestedTreeLights();
      applyTreeLights(treeLightsActiveFor(hourNow(), st.treeLightRequested));
    }

    // ---- build ----
    function makeMaterials() {
      var bark = barkTexture();
      bark.repeat.set(2, 1.4);
      var leafTex = leafCardTexture();
      leafTex.repeat.set(0.5, 0.5); // one of the four leaves on the sheet
      return {
        bark: new T.MeshLambertMaterial({ map: bark, color: 0xc0a884 }),
        leaf: new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
        // alphaTest (not transparency) keeps the cards depth-sorted for free.
        leafCard: new T.MeshLambertMaterial({ map: leafTex, color: 0xffffff, alphaTest: 0.42, side: T.DoubleSide }),
        leafLitter: new T.MeshLambertMaterial({ map: leafTex, color: 0xffffff, alphaTest: 0.42, side: T.DoubleSide }),
        plank: new T.MeshLambertMaterial({ color: 0x8a6236 }),
        barkTex: bark, leafTex: leafTex
      };
    }

    function buildScene() {
      var scene = new T.Scene();
      scene.fog = new T.Fog(0x1d2a24, 44, 118);
      var mats = makeMaterials();
      st.mats = mats;
      st.treeLeafMaterials = [mats.leaf, mats.leafCard];

      // Sky dome with a painted gradient that shifts from day to night.
      var skyMat = new T.ShaderMaterial({
        side: T.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new T.Color(0x4d94c4) }, bot: { value: new T.Color(0xd6e8d4) }, night: { value: 0 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: [
          'uniform vec3 top; uniform vec3 bot; uniform float night; varying vec3 vP;',
          'void main(){',
          '  float h = clamp(vP.y / 120.0 + 0.28, 0.0, 1.0);',
          '  vec3 c = mix(bot, top, h);',
          '  float star = step(0.9992, fract(sin(dot(floor(vP.xz*2.4), vec2(12.99,78.23)))*43758.55)) * night * step(0.35, h);',
          '  gl_FragColor = vec4(c + star, 1.0);',
          '}'
        ].join('\n')
      });
      var sky = new T.Mesh(new T.SphereGeometry(120, 24, 14), skyMat);
      scene.add(sky);
      st.sky = skyMat;

      // Forest floor
      var gc = document.createElement('canvas');
      gc.width = gc.height = 256;
      var gg = gc.getContext('2d');
      gg.fillStyle = '#5a4a30'; gg.fillRect(0, 0, 256, 256);
      for (var gp = 0; gp < 420; gp++) {
        gg.fillStyle = 'rgba(' + (rng() < 0.42 ? '38,28,17' : (rng() < 0.5 ? '92,74,45' : '58,74,40')) + ',' + (0.12 + rng() * 0.34) + ')';
        gg.beginPath();
        gg.ellipse(rng() * 256, rng() * 256, 4 + rng() * 26, 3 + rng() * 18, rng() * 3, 0, 7);
        gg.fill();
      }
      var groundTex = new T.CanvasTexture(gc);
      groundTex.wrapS = groundTex.wrapT = T.RepeatWrapping;
      groundTex.repeat.set(14, 14);
      if (T.SRGBColorSpace) groundTex.colorSpace = T.SRGBColorSpace;
      st.groundTex = groundTex;
      var ground = new T.Mesh(new T.CircleGeometry(70, 44), new T.MeshLambertMaterial({ map: groundTex, color: 0xd2c0a2 }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.2;
      ground.receiveShadow = true;
      scene.add(ground);
      // The forest floor under a big tree is leaf litter, not shrubbery:
      // fallen leaves, twigs, moss, a few stones and toadstools.
      var floor = new T.Group();

      // Fallen leaves lying flat, using the same leaf art as the canopy.
      var litterCount = 520;
      var litter = new T.InstancedMesh(new T.PlaneGeometry(1, 1), mats.leafLitter, litterCount);
      litter.receiveShadow = true;
      var dm = new T.Object3D(), lc = new T.Color();
      var litterDry = new T.Color(0x6b5a2c), litterFresh = new T.Color(0x4a6b2c);
      for (var li = 0; li < litterCount; li++) {
        var la = rng() * Math.PI * 2, lr = 2.0 + Math.pow(rng(), 0.55) * 22;
        dm.position.set(Math.sin(la) * lr, -0.17 + rng() * 0.03, Math.cos(la) * lr);
        dm.rotation.set(-Math.PI / 2 + (rng() - 0.5) * 0.35, rng() * Math.PI * 2, 0);
        var ls = 0.24 + rng() * 0.22;
        dm.scale.set(ls, ls * 1.3, 1);
        dm.updateMatrix();
        litter.setMatrixAt(li, dm.matrix);
        litter.setColorAt(li, lc.copy(litterDry).lerp(litterFresh, rng() * 0.8));
      }
      litter.instanceMatrix.needsUpdate = true;
      if (litter.instanceColor) litter.instanceColor.needsUpdate = true;
      floor.add(litter);

      // Fallen twigs and bark scraps.
      for (var tw = 0; tw < 26; tw++) {
        var ta = rng() * Math.PI * 2, tr = 2.6 + rng() * 11;
        var twig = box(0.035 + rng() * 0.03, 0.035, 0.30 + rng() * 0.55,
          new T.MeshLambertMaterial({ color: rng() < 0.5 ? 0x5a4630 : 0x6b573c }),
          Math.sin(ta) * tr, -0.15, Math.cos(ta) * tr);
        twig.rotation.set(0, rng() * Math.PI, (rng() - 0.5) * 0.2);
        floor.add(twig);
      }
      // Mossy stones settled among the roots.
      for (var sn = 0; sn < 16; sn++) {
        var sa3 = rng() * Math.PI * 2, sr3 = 2.8 + rng() * 9;
        var stone = new T.Mesh(new T.DodecahedronGeometry(0.14 + rng() * 0.20, 0),
          new T.MeshLambertMaterial({ color: rng() < 0.4 ? 0x5e6354 : 0x6d6f66, flatShading: true }));
        stone.position.set(Math.sin(sa3) * sr3, -0.14 + rng() * 0.05, Math.cos(sa3) * sr3);
        stone.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        stone.scale.y = 0.6 + rng() * 0.3;
        stone.castShadow = true; stone.receiveShadow = true;
        floor.add(stone);
      }
      // Moss patches creeping out from the trunk.
      for (var mp = 0; mp < 13; mp++) {
        var ma = rng() * Math.PI * 2, mr = 2.2 + rng() * 6;
        var moss = new T.Mesh(new T.CircleGeometry(0.28 + rng() * 0.42, 7),
          new T.MeshLambertMaterial({ color: rng() < 0.5 ? 0x2f4423 : 0x3a5229 }));
        moss.rotation.x = -Math.PI / 2;
        moss.rotation.z = rng() * 3;
        moss.position.set(Math.sin(ma) * mr, -0.178, Math.cos(ma) * mr);
        floor.add(moss);
      }
      // Toadstools, because every old tree has them.
      for (var ts = 0; ts < 8; ts++) {
        var tsa = rng() * Math.PI * 2, tsr = 2.4 + rng() * 8;
        var tx = Math.sin(tsa) * tsr, tz = Math.cos(tsa) * tsr;
        var hgt = 0.07 + rng() * 0.07;
        floor.add(cyl(0.022, 0.030, hgt, 6, new T.MeshLambertMaterial({ color: 0xe6dcc4 }), tx, -0.17 + hgt / 2, tz));
        var capm2 = new T.Mesh(new T.SphereGeometry(0.048 + rng() * 0.03, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          new T.MeshLambertMaterial({ color: rng() < 0.4 ? 0xb04a3a : 0x8a6a48 }));
        capm2.scale.y = 0.7;
        capm2.position.set(tx, -0.17 + hgt, tz);
        floor.add(capm2);
      }
      // A few ferns for height, kept sparse and away from the camera's lap.
      for (var fn = 0; fn < 18; fn++) {
        var fa2 = rng() * Math.PI * 2, fr3 = 4.5 + rng() * 8;
        var fx = Math.sin(fa2) * fr3, fz = Math.cos(fa2) * fr3;
        for (var fr4 = 0; fr4 < 5; fr4++) {
          var frond = box(0.05, 0.02, 0.46 + rng() * 0.2, new T.MeshLambertMaterial({ color: 0x3d6b30 }), fx, -0.05, fz);
          frond.rotation.set(-0.55 - rng() * 0.25, (fr4 / 5) * Math.PI * 2 + rng() * 0.4, 0);
          frond.position.y = -0.02 + rng() * 0.06;
          floor.add(frond);
        }
      }
      mergeStatic(floor, { name: 'forest-floor', flat: true });
      scene.add(floor);

      // The tree
      var tree = buildTree(mats, rng);
      scene.add(tree.group);
      st.leaves = tree.leaves;
      buildTreeLightRig(scene, tree);

      // Lights
      var hemi = new T.HemisphereLight(0xcfe4f5, 0x54633c, 1.25);
      scene.add(hemi);
      var amb = new T.AmbientLight(0xffffff, 0.30);
      scene.add(amb);
      st.amb = amb;
      st.hemi = hemi;
      var sun = new T.DirectionalLight(0xfff0d2, 1.45);
      sun.position.set(9, 16, 7);
      sun.castShadow = true;
      sun.shadow.mapSize.set(st.quality.shadowSize, st.quality.shadowSize);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 70;
      sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
      sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -8;
      sun.shadow.bias = -0.0012;
      scene.add(sun);
      st.sun = sun;
      var fill = new T.DirectionalLight(0xa8c4e4, 0.55);
      fill.position.set(-8, 6, -9);
      scene.add(fill);
      st.fill = fill;

      // Buildings on their branches
      st.houses = []; st.glows = []; st.smokes = []; st.labels = [];
      var built = builtRooms();
      Object.keys(ANCHORS).forEach(function(id) {
        var a = anchorPosition(id);
        if (built.indexOf(id) < 0) return; // its branch waits, bare
        var node = buildTreehouse(id, mats, rng);
        if (!node) return;
        node.position.set(a.x, a.y, a.z);
        node.rotation.y = a.angle; // face outward, away from the trunk
        node.scale.setScalar(a.cfg.scale);
        scene.add(node);
        st.houses.push(node);
        {
          (node.userData.glows || []).forEach(function(gl) { st.glows.push(gl); });
          if (node.userData.chimney) {
            var wp = node.userData.chimney.clone().applyEuler(new T.Euler(0, a.angle, 0))
              .multiplyScalar(a.cfg.scale).add(new T.Vector3(a.x, a.y, a.z));
            st.smokes.push({ origin: wp, sprites: [] });
          }
          // Floating name plaque
          var tx = labelTexture(STYLES[id].label);
          var spr = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false, fog: false }));
          var lw = (tx.userData.w / 84) * 0.42;
          spr.scale.set(lw, 0.42, 1);
          spr.position.set(a.x, a.y + STYLES[id].h + 1.25, a.z);
          spr.renderOrder = 12;
          scene.add(spr);
          st.labels.push(spr);
        }
      });

      // The moon, for the night sky.
      var moonMat = new T.SpriteMaterial({ map: sharedSoft('255,250,232'), transparent: true, opacity: 0, depthWrite: false, fog: false, blending: T.AdditiveBlending });
      var moon = new T.Sprite(moonMat);
      moon.scale.set(7.5, 7.5, 1);
      moon.position.set(-30, 30, -34);
      scene.add(moon);
      var moonDisc = new T.Mesh(new T.CircleGeometry(2.1, 24), new T.MeshBasicMaterial({ color: 0xf4f0e0, transparent: true, opacity: 0, fog: false }));
      moonDisc.position.copy(moon.position);
      moonDisc.lookAt(0, 6, 0);
      scene.add(moonDisc);
      st.moon = moonMat; st.moonDisc = moonDisc.material;

      // Lantern strings wound up the trunk — the Academy's own fairy lights.
      // One merged bulb mesh plus a handful of halos, not fifty draw calls.
      var bulbGroup = new T.Group();
      var haloMats = [];
      for (var ln = 0; ln < 16; ln++) {
        var lt = ln / 16;
        var la = lt * Math.PI * 5.2;
        var lr = 1.45 * Math.pow(1 - lt * 0.75, 0.6) + 0.34;
        var lp = new T.Vector3(Math.sin(la) * lr, 1.5 + lt * 8.2, Math.cos(la) * lr);
        var bulb = new T.Mesh(new T.SphereGeometry(0.085, 6, 5), new T.MeshLambertMaterial({ color: 0xffc878 }));
        bulb.position.copy(lp);
        bulbGroup.add(bulb);
        if (ln % 2 === 0) {
          var bhalo = new T.Sprite(new T.SpriteMaterial({ map: sharedSoft('255,200,130'), transparent: true, opacity: 0, depthWrite: false, fog: false, blending: T.AdditiveBlending }));
          bhalo.scale.set(0.62, 0.62, 1);
          bhalo.position.copy(lp);
          scene.add(bhalo);
          haloMats.push(bhalo.material);
        }
      }
      scene.add(bulbGroup);
      var bulbMesh = mergeStatic(bulbGroup, { name: 'lantern-string' });
      if (bulbMesh) {
        bulbMesh.material = new T.MeshBasicMaterial({ color: 0xffc878, vertexColors: true, transparent: true, opacity: 0.9 });
        bulbMesh.castShadow = false;
        st.glows.push({ mat: bulbMesh.material, halos: haloMats, warm: true, base: 0.92, lantern: true });
      }

      // The Aviary Gardens: the ground-level room, planted around the roots.
      var garden = new T.Group();
      var petals = [0xe8697d, 0xf0c04a, 0xe4e2ec, 0xc27ad6, 0xf08a3c];
      for (var fl2 = 0; fl2 < 26; fl2++) {
        var fa = rng() * Math.PI * 2, fr2 = 3.6 + rng() * 4.6;
        var stem = cyl(0.012, 0.016, 0.3, 4, new T.MeshLambertMaterial({ color: 0x4a7a38 }), Math.sin(fa) * fr2, 0.05, Math.cos(fa) * fr2);
        garden.add(stem);
        var head = new T.Mesh(new T.SphereGeometry(0.09, 6, 5), new T.MeshLambertMaterial({ color: petals[Math.floor(rng() * petals.length)] }));
        head.position.set(Math.sin(fa) * fr2, 0.22, Math.cos(fa) * fr2);
        head.scale.y = 0.6;
        garden.add(head);
      }
      // A little pond with a feeder standing beside it.
      var pond = new T.Mesh(new T.CircleGeometry(1.4, 24), new T.MeshLambertMaterial({ color: 0x2a4a58 }));
      pond.rotation.x = -Math.PI / 2;
      pond.position.set(4.6, -0.16, 3.4);
      pond.scale.set(1, 0.72, 1);
      garden.add(pond);
      var feeder = new T.Group();
      feeder.add(cyl(0.05, 0.06, 1.5, 6, new T.MeshLambertMaterial({ color: 0x8a6a3a }), 0, 0.75, 0));
      var tray = new T.Mesh(new T.CylinderGeometry(0.34, 0.30, 0.10, 12), new T.MeshLambertMaterial({ color: 0x9a7440 }));
      tray.position.y = 1.5;
      feeder.add(tray);
      var caps = new T.Mesh(new T.ConeGeometry(0.42, 0.28, 10), new T.MeshLambertMaterial({ color: 0x6b4a28 }));
      caps.position.y = 1.78;
      feeder.add(caps);
      feeder.position.set(-4.4, 0, 3.8);
      garden.add(feeder);
      mergeStatic(garden, { name: 'gardens' });
      scene.add(garden);

      // Chimney smoke sprites
      var smokeTex = softSpriteTexture('232,228,220');
      st.smokes.forEach(function(sm) {
        for (var s = 0; s < 9; s++) {
          var sp = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
          sp.position.copy(sm.origin);
          sp.userData = { phase: s / 9, speed: 0.26 + Math.random() * 0.12 };
          scene.add(sp);
          sm.sprites.push(sp);
        }
      });
      st.smokeTex = smokeTex;

      // Fireflies for the night
      var ffTex = softSpriteTexture('210,245,150');
      var ffGroup = new T.Group();
      for (var f = 0; f < 16; f++) {
        var fs = new T.Sprite(new T.SpriteMaterial({ map: ffTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
        fs.scale.setScalar(0.24);
        fs.userData = { a: Math.random() * 7, b: Math.random() * 7, r: 3 + Math.random() * 12, y: 0.6 + Math.random() * 7, sp: 0.1 + Math.random() * 0.22 };
        ffGroup.add(fs);
      }
      scene.add(ffGroup);
      st.fireflies = ffGroup;
      st.ffTex = ffTex;

      // Drifting leaves
      var leafFallGeo = new T.PlaneGeometry(0.16, 0.11);
      st.leafFall = [];
      for (var lf = 0; lf < 12; lf++) {
        var lm = new T.Mesh(leafFallGeo, new T.MeshLambertMaterial({ color: 0x4e7a3a, side: T.DoubleSide }));
        lm.userData = { a: Math.random() * 7, r: 2 + Math.random() * 9, y: 2 + Math.random() * 9, sp: 0.5 + Math.random() * 0.8, spin: Math.random() * 3 };
        scene.add(lm);
        st.leafFall.push(lm);
      }

      st.scene = scene;
      st.builtKey = built.slice().sort().join(',');
      st.shadowTick = 0;
    }

    // ---- renderer / mount ----
    function mount() {
      var cont = adapter.container();
      if (!cont) return false;
      st.cont = cont;
      if (!st.renderer) {
        st.quality = qualityForSize(cont.clientWidth || 390, cont.clientHeight || 700);
        st.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        st.renderer.setPixelRatio(st.quality.pixelRatio);
        st.renderer.shadowMap.enabled = true;
        st.renderer.shadowMap.type = T.PCFSoftShadowMap;
        st.renderer.shadowMap.autoUpdate = false;
        if (T.ACESFilmicToneMapping) {
          st.renderer.toneMapping = T.ACESFilmicToneMapping;
          st.renderer.toneMappingExposure = 1.42;
        }
        st.camera = new T.PerspectiveCamera(52, 1, 0.4, 260);
        wireInput(st.renderer.domElement);
      }
      if (!st.renderer.domElement.isConnected) cont.appendChild(st.renderer.domElement);
      st.renderer.domElement.style.width = '100%';
      st.renderer.domElement.style.height = '100%';
      st.renderer.domElement.style.display = 'block';
      st.renderer.domElement.style.touchAction = 'pan-y'; // swipes scroll the page; a held finger steers
      resize();
      st.mounted = true;
      return true;
    }

    function resize() {
      if (!st.cont || !st.renderer) return;
      var w = st.cont.clientWidth, h = st.cont.clientHeight;
      if (!w || !h) return;
      var nextQuality = qualityForSize(w, h);
      if (nextQuality.pixelRatio !== st.quality.pixelRatio) st.renderer.setPixelRatio(nextQuality.pixelRatio);
      if (st.sun && nextQuality.shadowSize !== st.quality.shadowSize) {
        st.sun.shadow.mapSize.set(nextQuality.shadowSize, nextQuality.shadowSize);
        if (st.sun.shadow.map) { st.sun.shadow.map.dispose(); st.sun.shadow.map = null; }
        st.renderer.shadowMap.needsUpdate = true;
      }
      st.quality = nextQuality;
      st.w = w; st.h = h;
      st.renderer.setSize(w, h, false);
      st.camera.aspect = w / h;
      st.camera.updateProjectionMatrix();
    }

    // Hold, then drag to orbit; pinch to zoom; tap a building to step inside.
    // The gate (touch_steer_core.js) lets the page scroll over the canvas: a
    // swipe scrolls, only a finger held still for a beat grabs the camera.
    function wireInput(el) {
      var MIN_D = 11, MAX_D = 52;
      function zoom(d) { st.cam.dist = Math.min(MAX_D, Math.max(MIN_D, d)); }
      var g = typeof globalThis !== 'undefined' ? globalThis : this;
      var steer = (g && g.BurbzTouchSteer) ? g.BurbzTouchSteer.createHoldGate({
        onEngage: function(at) {
          st.dragged = true; // grabbing the camera is never a tap
          if (st.cont && st.cont.classList) st.cont.classList.add('steering');
          if (st.orbitStart) { st.orbitStart.x = at.x; st.orbitStart.y = at.y; st.orbitStart.az = st.cam.az; st.orbitStart.polar = st.cam.polar; }
          try { if (g.navigator && g.navigator.vibrate) g.navigator.vibrate(8); } catch (err) {}
        }
      }) : { down: function() { return true; }, move: function() { return true; }, up: function() {}, cancel: function() {}, engaged: true };
      el.addEventListener('touchmove', function(e) { if (steer.engaged && e.cancelable) e.preventDefault(); }, { passive: false });
      el.addEventListener('pointerdown', function(e) {
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        st.cam.lastInput = Date.now();
        st.dragged = false;
        steer.down({ pointerType: e.pointerType, x: e.clientX, y: e.clientY });
        if (st.pointers.size === 1) st.orbitStart = { x: e.clientX, y: e.clientY, az: st.cam.az, polar: st.cam.polar };
      });
      el.addEventListener('pointermove', function(e) {
        if (!st.pointers.has(e.pointerId)) return;
        st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        st.cam.lastInput = Date.now();
        var maySteer = steer.move({ x: e.clientX, y: e.clientY });
        if (st.pointers.size === 1 && st.orbitStart) {
          var dx = e.clientX - st.orbitStart.x, dy = e.clientY - st.orbitStart.y;
          if (Math.abs(dx) + Math.abs(dy) > 6) st.dragged = true;
          if (!maySteer) return; // the page owns this swipe — the camera stays put
          st.cam.az = st.orbitStart.az - dx * 0.008;
          st.cam.polar = Math.min(1.62, Math.max(0.30, st.orbitStart.polar - dy * 0.006));
        } else if (st.pointers.size === 2) {
          var pts = Array.from(st.pointers.values());
          var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (st.pinchLast) zoom(st.cam.dist * (st.pinchLast / d));
          st.pinchLast = d;
          st.dragged = true;
        }
      });
      function release(e) {
        if (st.pointers.delete(e.pointerId)) steer.up(); // pointerleave fires for a hovering mouse too
        if (!steer.engaged && st.cont && st.cont.classList) st.cont.classList.remove('steering');
        if (st.pointers.size < 2) st.pinchLast = null;
        if (st.pointers.size === 0) st.orbitStart = null;
      }
      el.addEventListener('pointerup', function(e) {
        if (!st.dragged) tapAt(e);
        release(e);
      });
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('wheel', function(e) {
        e.preventDefault();
        st.cam.lastInput = Date.now();
        zoom(st.cam.dist + e.deltaY * 0.014);
      }, { passive: false });
      el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    }

    function tapAt(e) {
      if (!st.scene || !st.camera || !st.houses.length) return;
      var rect = st.renderer.domElement.getBoundingClientRect();
      var ndc = new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      var ray = new T.Raycaster();
      ray.setFromCamera(ndc, st.camera);
      var hits = ray.intersectObjects(st.houses, true);
      if (!hits.length) return;
      var o = hits[0].object;
      while (o && !o.userData.roomId) o = o.parent;
      if (o && o.userData.roomId && adapter.onRoomTap) {
        try { adapter.onRoomTap(o.userData.roomId); } catch (err) {}
      }
    }

    // ---- frame ----
    function tick(now) {
      st.raf = 0;
      if (!st.running) return;
      if (typeof document !== 'undefined' && document.hidden) { st.lastT = 0; schedule(); return; }
      try { if (adapter.isScreenActive && !adapter.isScreenActive()) { st.lastT = 0; schedule(); return; } } catch (e) {}
      if (!st.cont || !st.cont.isConnected) { pause(); return; }
      if (st.lastT && now - st.lastT < st.quality.frameMs) { schedule(); return; }
      var dt = st.lastT ? Math.min(60, now - st.lastT) : 16;
      st.lastT = now;
      st.clock += dt;
      frame(dt / 1000);
      schedule();
    }

    function frame(s) {
      var t = st.clock / 1000;
      var h = hourNow();
      var boost = lightBoostFor(h);
      var night = isNightHour(h);
      if (Math.abs(boost - st.boost) > 0.005 || night !== st.night) {
        st.boost = boost; st.night = night;
        applyDaylight(boost);
        st.shadowTick = 0; // re-render shadows for the new sun angle
      }
      var treeLightActive = treeLightsActiveFor(h, st.treeLightRequested);
      if (treeLightActive !== st.treeLightActive) applyTreeLights(treeLightActive);

      // Idle drift, but never while the player is steering.
      if (Date.now() - st.cam.lastInput > 7000) st.cam.az += s * 0.045;
      var c = st.cam;
      st.camera.position.set(
        Math.sin(c.az) * Math.sin(c.polar) * c.dist,
        Math.cos(c.polar) * c.dist + 3.6,
        Math.cos(c.az) * Math.sin(c.polar) * c.dist
      );
      st.camera.lookAt(0, 7.8, 0);

      // Window and lantern life
      for (var i = 0; i < st.glows.length; i++) {
        var g = st.glows[i];
        if (g.lit === undefined) { g.lit = true; g.switchAt = 0; g.phase = Math.random() * 20; g.speed = 4 + Math.random() * 6; }
        if (st.clock >= g.switchAt) {
          if (g.lit && !g.always && Math.random() < 0.05) { g.lit = false; g.switchAt = st.clock + 1800 + Math.random() * 4600; }
          else { g.lit = true; g.switchAt = st.clock + 900 + Math.random() * 1800; }
        }
        var flick = g.lantern ? (0.78 + 0.22 * Math.sin(t * g.speed + g.phase) * Math.sin(t * g.speed * 0.4 + g.phase))
          : (0.90 + 0.10 * Math.sin(t * g.speed * 0.5 + g.phase));
        if (g.pulse) flick = 0.62 + 0.38 * Math.sin(t * 1.7 + g.phase);
        var day = g.always ? 0.85 : 0.42;
        var target = g.lit ? (day + (g.base - day) * boost) * flick : 0.04;
        if (st.treeLightActive) target = Math.max(target, g.base * (g.lantern ? 0.98 : 0.88) * flick);
        g.mat.opacity = g.mat.opacity + (target - g.mat.opacity) * Math.min(1, s * 5);
        var haloAmt = g.mat.opacity * (0.08 + boost * 0.40 + (st.treeLightActive ? 0.20 : 0));
        if (g.halo) g.halo.opacity = haloAmt;
        if (g.halos) for (var hh = 0; hh < g.halos.length; hh++) g.halos[hh].opacity = haloAmt;
      }

      // Chimney smoke
      st.smokes.forEach(function(sm) {
        sm.sprites.forEach(function(sp) {
          var u = sp.userData;
          u.phase += s * u.speed;
          if (u.phase > 1) u.phase -= 1;
          var p = u.phase;
          sp.position.set(
            sm.origin.x + Math.sin(t * 0.5 + u.speed * 9) * p * 1.3,
            sm.origin.y + p * 3.6,
            sm.origin.z + Math.cos(t * 0.4 + u.speed * 7) * p * 0.9
          );
          var sc = 0.45 + p * 1.9;
          sp.scale.set(sc, sc, 1);
          sp.material.opacity = 0.60 * Math.sin(Math.PI * Math.min(1, p * 1.05));
        });
      });

      // Fireflies come out with the dark
      if (st.fireflies) {
        var ffOn = Math.max(0, boost * 1.3 - 0.25);
        st.fireflies.children.forEach(function(fs, idx) {
          var u = fs.userData;
          var a = u.a + t * u.sp;
          fs.position.set(Math.sin(a) * u.r, u.y + Math.sin(t * 0.6 + u.b) * 0.9, Math.cos(a * 0.9 + u.b) * u.r);
          fs.material.opacity = ffOn * 0.62 * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.6 + idx)));
        });
      }

      // Leaves letting go of the canopy
      st.leafFall.forEach(function(lm) {
        var u = lm.userData;
        u.y -= s * u.sp;
        if (u.y < -0.2) { u.y = 9 + Math.random() * 3; u.r = 2 + Math.random() * 9; u.a = Math.random() * 7; }
        u.a += s * 0.4;
        lm.position.set(Math.sin(u.a) * u.r, u.y, Math.cos(u.a) * u.r);
        lm.rotation.set(t * u.spin, t * u.spin * 0.7, t * u.spin * 0.4);
      });

      // Plaques always face the camera; hanging things sway.
      st.houses.forEach(function(hs, i) {
        if (hs.userData.swing) hs.userData.swing.rotation.z = Math.sin(t * 1.1 + i) * 0.13;
        if (hs.userData.sign) hs.userData.sign.rotation.z = Math.sin(t * 0.9 + i) * 0.10;
        if (hs.userData.vane) hs.userData.vane.rotation.y = t * 0.6 + Math.sin(t * 0.4) * 1.2;
        if (hs.userData.scope) hs.userData.scope.rotation.y = 0.5 + Math.sin(t * 0.22) * 0.35;
      });

      // Shadows are static: re-render the map only when something changed.
      if (st.shadowTick < 2) { st.renderer.shadowMap.needsUpdate = true; st.shadowTick++; }
      renderScene();
    }

    function applyDaylight(boost) {
      var day = 1 - boost;
      if (st.sun) {
        st.sun.intensity = 0.20 + day * 1.30;
        st.sun.color.setHex(boost > 0.5 ? 0xbcd0ff : 0xffe9c4);
        st.sun.position.set(9 - boost * 15, 16 - boost * 4, 7 + boost * 4);
      }
      if (st.fill) st.fill.intensity = 0.16 + day * 0.42;
      if (st.amb) st.amb.intensity = 0.12 + day * 0.26;
      if (st.hemi) {
        st.hemi.intensity = 0.26 + day * 1.05;
        st.hemi.color.setHex(boost > 0.5 ? 0x46567e : 0xcfe4f5);
        st.hemi.groundColor.setHex(boost > 0.5 ? 0x1a1e16 : 0x54633c);
      }
      if (st.sky) {
        st.sky.uniforms.top.value.setHex(boost > 0.5 ? 0x080d20 : 0x4d94c4).lerp(new T.Color(0x122048), boost * 0.5);
        st.sky.uniforms.bot.value.setHex(boost > 0.5 ? 0x16203a : 0xd6e8d4);
        st.sky.uniforms.night.value = boost;
      }
      if (st.moon) st.moon.opacity = Math.max(0, boost * 0.85 - 0.06);
      if (st.moonDisc) st.moonDisc.opacity = Math.max(0, boost * 0.95 - 0.06);
      if (st.scene && st.scene.fog) st.scene.fog.color.setHex(boost > 0.5 ? 0x101828 : 0x1d2a24);
      if (st.renderer) st.renderer.setClearColor(boost > 0.5 ? 0x0a0f1c : 0x3c6a58, 1);
    }

    function schedule() { if (st.running && !st.raf) st.raf = requestAnimationFrame(tick); }

    // ---- lifecycle ----
    function start() {
      if (!mount()) return false;
      if (!st.scene) {
        buildScene();
        applyDaylight(lightBoostFor(hourNow()));
      }
      if (reduced()) {
        // Reduced motion: draw one still frame of the Academy, then stop.
        st.running = false;
        st.night = isNightHour(hourNow());
        st.boost = lightBoostFor(hourNow());
        applyDaylight(st.boost);
        applyStaticRoomGlows(st.treeLightActive);
        st.renderer.shadowMap.needsUpdate = true;
        var rc = st.cam;
        st.camera.position.set(Math.sin(rc.az) * Math.sin(rc.polar) * rc.dist, Math.cos(rc.polar) * rc.dist + 3.6, Math.cos(rc.az) * Math.sin(rc.polar) * rc.dist);
        st.camera.lookAt(0, 7.8, 0);
        renderScene();
        return true;
      }
      if (st.running) return true;
      st.running = true;
      st.lastT = 0;
      schedule();
      return true;
    }

    function pause() {
      st.running = false;
      if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
      st.lastT = 0;
    }

    // A building went up (or the player moved one): rebuild the tree's cast.
    function refresh() {
      if (!st.scene) return;
      var key = builtRooms().slice().sort().join(',');
      if (key === st.builtKey) return;
      disposeScene();
      buildScene();
      applyDaylight(lightBoostFor(hourNow()));
    }

    function disposeScene() {
      if (typeof globalThis !== 'undefined' && globalThis.BurbzManga) globalThis.BurbzManga.dispose(st.renderer);
      if (!st.scene) return;
      st.scene.traverse(function(o) {
        if (o.isInstancedMesh && o.dispose) o.dispose();
        if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
        if (o.geometry) o.geometry.dispose();
        var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach(function(m) {
          var mp = m.map;
          if (mp && mp.dispose && !(mp.userData && mp.userData.shared) && mp !== st.smokeTex && mp !== st.ffTex && mp !== st.groundTex && mp !== (st.mats && st.mats.leafTex) && mp !== (st.mats && st.mats.barkTex)) mp.dispose();
          m.dispose();
        });
      });
      // These textures are deliberately skipped during traversal because many
      // meshes share them; release each one exactly once before a rebuild.
      [st.smokeTex, st.ffTex, st.groundTex,
        st.mats && st.mats.leafTex, st.mats && st.mats.barkTex].forEach(function(tex, idx, all) {
        if (tex && tex.dispose && all.indexOf(tex) === idx) tex.dispose();
      });
      st.smokeTex = null; st.ffTex = null; st.groundTex = null;
      if (st.mats) { st.mats.leafTex = null; st.mats.barkTex = null; }
      st.mats = null;
      st.scene = null;
      st.houses = []; st.glows = []; st.smokes = []; st.labels = []; st.leafFall = [];
      st.fireflies = null; st.moon = null; st.moonDisc = null;
      st.treeLights = []; st.treeLightHalos = []; st.treeLightMaterials = []; st.treeLeafMaterials = []; st.treeLightActive = false;
    }

    function stop() {
      pause();
      disposeScene();
      if (st.smokeTex) { st.smokeTex.dispose(); st.smokeTex = null; }
      if (st.ffTex) { st.ffTex.dispose(); st.ffTex = null; }
      if (st.groundTex) { st.groundTex.dispose(); st.groundTex = null; }
      if (st.mats && st.mats.leafTex) { st.mats.leafTex.dispose(); st.mats.leafTex = null; }
      if (st.mats && st.mats.barkTex) { st.mats.barkTex.dispose(); st.mats.barkTex = null; }
      clearSharedTex();
      if (st.renderer) {
        if (st.renderer.domElement && st.renderer.domElement.parentNode) st.renderer.domElement.parentNode.removeChild(st.renderer.domElement);
        st.renderer.dispose();
        st.renderer = null;
      }
      st.camera = null;
      st.mounted = false;
      st.disposed = true;
    }

    return {
      start: start,
      pause: pause,
      stop: stop,
      refresh: refresh,
      resize: resize,
      setTreeLights: setTreeLights,
      isRunning: function() { return st.running; },
      _state: st
    };
  }

  return {
    ANCHORS: ANCHORS,
    STYLES: STYLES,
    isNightHour: isNightHour,
    lightBoostFor: lightBoostFor,
    treeLightsActiveFor: treeLightsActiveFor,
    qualityProfileFor: qualityProfileFor,
    anchorPosition: anchorPosition,
    mulberry32: mulberry32,
    createAcademy3D: createAcademy3D
  };
});
