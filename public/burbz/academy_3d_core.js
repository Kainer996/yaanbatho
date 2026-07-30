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
  // buttressed tree, ten treehouses that keep the character of their paintings,
  // birds with beating wings, chimney smoke, lanterns — is a few dozen KB of
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
    training:    { angle: 92,  y: 4.60, reach: 5.0, scale: 1.02 },
    kitchen:     { angle: 342, y: 5.60, reach: 4.3, scale: 1.04 },
    hospital:    { angle: 158, y: 6.05, reach: 4.6, scale: 1.00 },
    crowbar:     { angle: 48,  y: 6.90, reach: 4.2, scale: 1.02 },
    workshop:    { angle: 232, y: 7.60, reach: 4.0, scale: 0.96 },
    nursery:     { angle: 128, y: 8.60, reach: 3.7, scale: 0.94 },
    observatory: { angle: 318, y: 9.40, reach: 3.5, scale: 0.96 }
  };
  // Per-building character, read off the manga paintings: the Roost really is
  // a steep-roofed birdhouse with a hanging lantern; the Observatory really is
  // a star-blue dome under a crescent finial with a brass telescope out front.
  var STYLES = {
    dorm: {
      label: 'The Roost', roof: 'steep', w: 1.7, d: 1.5, h: 1.5,
      wall: 0xa06f42, wallDark: 0x755030, roofCol: 0x5b442b, trim: 0x8a6a3a,
      windows: [{ x: 0, y: 0.34, z: 0.78, r: 0.30, round: true }],
      extras: ['lantern-left', 'hole-door', 'rope-belt']
    },
    tavern: {
      label: 'Barracks', roof: 'pagoda', w: 2.0, d: 1.7, h: 1.25,
      wall: 0xb78048, wallDark: 0x6f5030, roofCol: 0x435261, trim: 0xb08a44,
      windows: [{ x: 0, y: 0.26, z: 0.86, r: 0.34, wide: true }],
      extras: ['target', 'open-front', 'training-posts']
    },
    training: {
      label: 'Training Hall', roof: 'pagoda', w: 2.1, d: 1.8, h: 1.2,
      wall: 0xcf9850, wallDark: 0x876333, roofCol: 0x4d5c6c, trim: 0xc09a4c,
      windows: [{ x: 0, y: 0.24, z: 0.90, r: 0.32, wide: true }],
      extras: ['target', 'open-front', 'training-posts']
    },
    hospital: {
      label: 'Bird Hospital', roof: 'gable', w: 2.0, d: 1.7, h: 1.45,
      wall: 0xa67445, wallDark: 0x725030, roofCol: 0x694e30, trim: 0x8f6c3c,
      windows: [{ x: -0.42, y: 0.34, z: 0.86, r: 0.26 }, { x: 0.42, y: 0.30, z: 0.86, r: 0.24 }],
      extras: ['cross', 'lantern-left', 'lantern-right']
    },
    crowbar: {
      label: 'The Crowbar', roof: 'layered', w: 2.1, d: 1.8, h: 1.35,
      wall: 0xb78148, wallDark: 0x7a5633, roofCol: 0x805f36, trim: 0xc79a4e,
      windows: [{ x: 0, y: 0.34, z: 0.90, r: 0.48, wide: true, warm: true }],
      extras: ['sign', 'lantern-left', 'lantern-right', 'barrel', 'stools', 'open-front']
    },
    kitchen: {
      label: 'Kitchen & Pantry', roof: 'gable', w: 2.0, d: 1.7, h: 1.5,
      wall: 0xa47040, wallDark: 0x6f4c2d, roofCol: 0x5b4429, trim: 0x8d6a38,
      windows: [{ x: -0.02, y: 0.66, z: 0.80, r: 0.22, round: true }, { x: 0, y: 0.14, z: 0.88, r: 0.52, wide: true, warm: true }],
      extras: ['chimney', 'awning', 'sacks']
    },
    workshop: {
      label: 'Nest Workshop', roof: 'shingle', w: 1.9, d: 1.7, h: 1.4,
      wall: 0xae7b46, wallDark: 0x765430, roofCol: 0x976f3e, trim: 0x9a7440,
      windows: [{ x: 0, y: 0.24, z: 0.86, r: 0.44, wide: true }],
      extras: ['roof-nest', 'hanging-nest', 'open-front']
    },
    nursery: {
      label: 'Hatchery Nursery', roof: 'egg', w: 1.6, d: 1.5, h: 1.9,
      wall: 0xbc8a4c, wallDark: 0x7e5730, roofCol: 0x986d3c, trim: 0xb08c4c,
      windows: [{ x: 0, y: 0.34, z: 0.70, r: 0.40, wide: true, warm: true }],
      extras: ['hanging-cradle', 'crossed-poles']
    },
    observatory: {
      label: 'Moon Observatory', roof: 'dome', w: 1.8, d: 1.8, h: 1.0,
      wall: 0x425081, wallDark: 0x2c3660, roofCol: 0x323d69, trim: 0xc6a44c,
      windows: [{ x: 0, y: 0.30, z: 0.80, r: 0.34, cool: true }],
      extras: ['crescent', 'telescope', 'lantern-left']
    },
    quest_roost: {
      label: 'Quest Roost', roof: 'gable', w: 1.9, d: 1.7, h: 1.35,
      wall: 0xb27e46, wallDark: 0x7a5630, roofCol: 0x634a2c, trim: 0xa9803f,
      windows: [{ x: 0, y: 0.28, z: 0.88, r: 0.44, wide: true }],
      extras: ['weathervane', 'lantern-left', 'lantern-right', 'open-front']
    }
  };

  var GLOW_WARM = 0xffc06a, GLOW_COOL = 0xa8c8ff;

  // Five bird archetypes to circle the canopy. Sizes and palettes deliberately
  // match the 2D engine's cast so the two Academies feel like one place.
  var BIRDS = {
    robin:   { size: 0.16, span: 1.5, flap: 8.5, body: 0x8a6f52, wing: 0x6b563e, breast: 0xd95f3b, night: 0.1 },
    bluetit: { size: 0.12, span: 1.5, flap: 11,  body: 0x4f8fd0, wing: 0x3c6ea8, breast: 0xe8d44d, night: 0.1 },
    crow:    { size: 0.27, span: 2.0, flap: 3.4, body: 0x26262e, wing: 0x1a1a22, breast: 0x22222c, night: 0.8 },
    buzzard: { size: 0.32, span: 2.4, flap: 2.2, body: 0x6e5233, wing: 0x54401f, breast: 0xa8916b, night: 0.15 },
    owl:     { size: 0.24, span: 2.1, flap: 3.0, body: 0xd9c49a, wing: 0xc4ab7e, breast: 0xf4ecdc, night: 1.6 }
  };

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
      var start = new V(Math.sin(a.angle) * 0.5, a.y - 0.85, Math.cos(a.angle) * 0.5);
      var end = new V(a.x, a.y - 0.16, a.z);
      g.add(limb(start, end, 0.34, 0.17, mats.bark, 0.55));
      // The branch carries on well past the house before it leafs out, so the
      // canopy never swallows the building it is supposed to be holding up.
      var beyond = new V(a.x * 2.35, a.y + 1.5 + rng() * 0.8, a.z * 2.35);
      g.add(limb(end, beyond, 0.16, 0.05, mats.bark, 0.7));
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
    var leafGeo = new T.IcosahedronGeometry(0.62, 0);
    var leaves = new T.InstancedMesh(leafGeo, mats.leaf, clusters.length);
    leaves.castShadow = true; leaves.receiveShadow = true;
    var dummy = new T.Object3D();
    var col = new T.Color();
    var leafBase = new T.Color(0x3f6b38);
    clusters.forEach(function(cl, idx) {
      dummy.position.set(cl.x, cl.y, cl.z);
      dummy.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      dummy.scale.set(cl.s * (0.9 + rng() * 0.4), cl.s * (0.72 + rng() * 0.3), cl.s * (0.9 + rng() * 0.4));
      dummy.updateMatrix();
      leaves.setMatrixAt(idx, dummy.matrix);
      col.copy(leafBase).offsetHSL((cl.tone - 0.5) * 0.06, (cl.tone - 0.5) * 0.14, (cl.tone - 0.5) * 0.16);
      leaves.setColorAt(idx, col);
    });
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    g.add(leaves);

    // Forty-odd limbs collapse into a single textured mesh.
    mergeStatic(g, {
      uv: true, name: 'tree-bark',
      only: function(o, m) { return m === mats.bark; },
      material: new T.MeshLambertMaterial({ map: mats.barkTex, color: 0xc0a884, vertexColors: true })
    });
    return { group: g, leaves: leaves, tips: tips };
  }

  // ---- one treehouse -------------------------------------------------------
  // Shared shell (platform, posts, railing, body, roof, ladder) plus the
  // per-building extras that make each one recognisably itself.

  function buildTreehouse(id, mats, rng) {
    var st = STYLES[id];
    if (!st) return null;
    var g = new T.Group();
    var glows = [];
    var W = st.w, D = st.d, H = st.h;

    var wallMat = new T.MeshLambertMaterial({ color: st.wall });
    var darkMat = new T.MeshLambertMaterial({ color: st.wallDark });
    var roofMat = new T.MeshLambertMaterial({ color: st.roofCol });
    var trimMat = new T.MeshLambertMaterial({ color: st.trim });

    // Deck
    var deck = box(W + 0.5, 0.14, D + 0.5, mats.plank, 0, 0, 0);
    g.add(deck);
    // Plank lines
    for (var pl = -2; pl <= 2; pl++) {
      g.add(box(W + 0.5, 0.02, 0.03, darkMat, 0, 0.08, pl * (D + 0.5) / 5.5));
    }
    // Support posts angling down to the branch
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(s) {
      var post = cyl(0.07, 0.09, 0.9, 6, trimMat, s[0] * W * 0.42, -0.5, s[1] * D * 0.42);
      post.rotation.set(s[1] * 0.14, 0, -s[0] * 0.14);
      g.add(post);
    });

    // Railing around the open deck
    var railY = 0.42;
    var rp = 0;
    for (rp = 0; rp < 12; rp++) {
      var ang = (rp / 12) * Math.PI * 2;
      var rx = Math.sin(ang) * (W + 0.34) * 0.5, rz = Math.cos(ang) * (D + 0.34) * 0.5;
      if (rz > D * 0.30) continue; // leave the front open
      g.add(cyl(0.035, 0.04, railY, 5, trimMat, rx, railY / 2, rz));
    }
    var rail = new T.Mesh(new T.TorusGeometry((W + D) * 0.25 + 0.12, 0.035, 5, 18), trimMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = railY;
    rail.scale.set(1, (D + 0.34) / (W + 0.34), 1);
    g.add(rail);

    // Body
    var bodyY = 0.07 + H / 2;
    if (st.roof === 'egg') {
      var egg = new T.Mesh(new T.SphereGeometry(W * 0.56, 16, 14), wallMat);
      egg.scale.set(1, H / (W * 1.02), 0.92);
      egg.position.y = 0.07 + H * 0.52;
      egg.castShadow = true; egg.receiveShadow = true;
      g.add(egg);
    } else {
      var body = box(W, H, D, wallMat, 0, bodyY, 0);
      g.add(body);
      // Corner timbers
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function(s) {
        g.add(box(0.11, H, 0.11, trimMat, s[0] * W / 2, bodyY, s[1] * D / 2));
      });
      // Plank shading on the sides
      g.add(box(W + 0.02, 0.06, D + 0.02, darkMat, 0, bodyY + H * 0.18, 0));
    }

    // Roof
    var roofBase = 0.07 + H;
    if (st.roof === 'gable' || st.roof === 'steep') {
      var pitch = st.roof === 'steep' ? 1.15 : 0.72;
      var slab = new T.Mesh(new T.BoxGeometry(W * 0.78, 0.10, D + 0.55), roofMat);
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var half = slab.clone();
        half.material = roofMat;
        half.position.set(sgn * W * 0.27, roofBase + pitch * 0.42, 0);
        half.rotation.z = -sgn * Math.atan2(pitch, W * 0.55);
        half.scale.x = Math.hypot(pitch, W * 0.55) / (W * 0.78) * 1.5;
        half.castShadow = true; half.receiveShadow = true;
        g.add(half);
      }
      g.add(box(0.13, 0.13, D + 0.6, trimMat, 0, roofBase + pitch * 0.82, 0)); // ridge beam
    } else if (st.roof === 'pagoda') {
      for (var tier = 0; tier < 2; tier++) {
        var tw = (W + 0.85) * (1 - tier * 0.26);
        var cone = new T.Mesh(new T.ConeGeometry(tw * 0.72, 0.5, 4, 1), roofMat);
        cone.rotation.y = Math.PI / 4;
        cone.position.y = roofBase + 0.18 + tier * 0.52;
        cone.castShadow = true; cone.receiveShadow = true;
        g.add(cone);
        // Upturned eave tips
        for (var e = 0; e < 4; e++) {
          var ea = e * Math.PI / 2 + Math.PI / 4;
          var tipM = cyl(0.03, 0.05, 0.3, 5, trimMat, Math.sin(ea) * tw * 0.5, roofBase + 0.16 + tier * 0.52, Math.cos(ea) * tw * 0.5);
          tipM.rotation.set(Math.cos(ea) * 0.7, 0, -Math.sin(ea) * 0.7);
          g.add(tipM);
        }
      }
      g.add(cyl(0.05, 0.05, 0.34, 6, trimMat, 0, roofBase + 1.14, 0));
    } else if (st.roof === 'layered') {
      for (var L = 0; L < 3; L++) {
        var lw = (W + 0.7) * (1 - L * 0.19);
        var ring = new T.Mesh(new T.ConeGeometry(lw * 0.62, 0.34, 8, 1), roofMat);
        ring.position.y = roofBase + 0.05 + L * 0.29;
        ring.castShadow = true; ring.receiveShadow = true;
        g.add(ring);
      }
    } else if (st.roof === 'shingle') {
      var hut = new T.Mesh(new T.ConeGeometry((W + 0.55) * 0.6, 0.95, 9, 2), roofMat);
      hut.position.y = roofBase + 0.4;
      hut.castShadow = true; hut.receiveShadow = true;
      g.add(hut);
    } else if (st.roof === 'dome') {
      var dome = new T.Mesh(new T.SphereGeometry(W * 0.62, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      dome.position.y = roofBase - 0.04;
      dome.castShadow = true; dome.receiveShadow = true;
      g.add(dome);
      // Gold meridian ribs
      for (var mr = 0; mr < 4; mr++) {
        var rib = new T.Mesh(new T.TorusGeometry(W * 0.62, 0.022, 4, 14, Math.PI), trimMat);
        rib.rotation.y = mr * Math.PI / 4;
        rib.rotation.z = Math.PI / 2;
        rib.position.y = roofBase - 0.04;
        g.add(rib);
      }
    } else if (st.roof === 'egg') {
      var cap = new T.Mesh(new T.SphereGeometry(W * 0.30, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      cap.position.y = 0.07 + H * 0.98;
      g.add(cap);
    }

    // Windows — emissive planes that the engine dims and flickers.
    (st.windows || []).forEach(function(w) {
      var col = w.cool ? GLOW_COOL : GLOW_WARM;
      var mat = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.92 });
      var geo = w.round ? new T.CircleGeometry(w.r, 14)
        : new T.PlaneGeometry(w.r * (w.wide ? 2.1 : 1.1), w.r * (w.wide ? 1.15 : 1.35));
      var pane = new T.Mesh(geo, mat);
      pane.position.set(w.x * W, 0.07 + w.y * H + H * 0.12, (w.z || 0.8) * D / 2 + 0.03);
      g.add(pane);
      // Frame
      var fr = new T.Mesh(w.round ? new T.TorusGeometry(w.r + 0.02, 0.03, 4, 14)
        : new T.BoxGeometry(w.r * (w.wide ? 2.2 : 1.2), w.r * (w.wide ? 1.25 : 1.45), 0.04), trimMat);
      fr.position.copy(pane.position);
      fr.position.z -= 0.015;
      g.add(fr);
      // Light spilling out of the opening — a lit window has to bleed into the
      // dark, or after sunset it just reads as a flat bright rectangle.
      var halo = new T.Sprite(new T.SpriteMaterial({
        map: sharedSoft(w.cool ? '150,190,255' : '255,186,104'),
        transparent: true, opacity: 0, depthWrite: false, fog: false,
        blending: T.AdditiveBlending
      }));
      var hs = w.r * (w.wide ? 3.4 : 2.7) * (w.cool ? 0.7 : 1);
      halo.scale.set(hs, hs * 0.82, 1);
      halo.position.copy(pane.position);
      halo.position.z += 0.12;
      g.add(halo);
      glows.push({ mat: mat, halo: halo.material, warm: !w.cool, base: 0.92 });
    });

    // Ladder down to the branch
    var lad = new T.Group();
    lad.add(box(0.05, 1.5, 0.05, trimMat, -0.17, -0.75, 0));
    lad.add(box(0.05, 1.5, 0.05, trimMat, 0.17, -0.75, 0));
    for (var rg = 0; rg < 5; rg++) lad.add(box(0.42, 0.04, 0.04, trimMat, 0, -0.25 - rg * 0.28, 0));
    lad.position.set(0, 0, D * 0.5 + 0.16);
    g.add(lad);

    // ---- per-building extras ----
    var ex = st.extras || [];
    function lantern(x, y, z) {
      var lg = new T.Group();
      lg.add(cyl(0.015, 0.015, 0.26, 4, trimMat, 0, 0.2, 0));
      var glassMat = new T.MeshBasicMaterial({ color: GLOW_WARM, transparent: true, opacity: 0.95 });
      var glass = new T.Mesh(new T.BoxGeometry(0.14, 0.18, 0.14), glassMat);
      lg.add(glass);
      lg.add(box(0.18, 0.04, 0.18, trimMat, 0, 0.11, 0));
      lg.add(box(0.17, 0.03, 0.17, trimMat, 0, -0.10, 0));
      var lhalo = new T.Sprite(new T.SpriteMaterial({
        map: sharedSoft('255,196,120'), transparent: true, opacity: 0,
        depthWrite: false, fog: false, blending: T.AdditiveBlending
      }));
      lhalo.scale.set(0.72, 0.72, 1);
      lg.add(lhalo);
      lg.position.set(x, y, z);
      g.add(lg);
      glows.push({ mat: glassMat, halo: lhalo.material, warm: true, base: 0.95, lantern: true });
      return lg;
    }
    if (ex.indexOf('lantern-left') >= 0) lantern(-(W / 2 + 0.30), 0.95, D * 0.22);
    if (ex.indexOf('lantern-right') >= 0) lantern(W / 2 + 0.30, 0.92, D * 0.22);
    if (ex.indexOf('chimney') >= 0) {
      var ch = box(0.30, 0.85, 0.30, darkMat, W * 0.30, roofBase + 0.75, -D * 0.12);
      g.add(ch);
      g.add(box(0.38, 0.09, 0.38, trimMat, W * 0.30, roofBase + 1.18, -D * 0.12));
      g.userData.chimney = new T.Vector3(W * 0.30, roofBase + 1.28, -D * 0.12);
    }
    if (ex.indexOf('cross') >= 0) {
      var crossMat = new T.MeshBasicMaterial({ color: 0x9ef0b8 });
      var plate = new T.Mesh(new T.CircleGeometry(0.30, 16), new T.MeshLambertMaterial({ color: 0x2f5c38 }));
      plate.position.set(0, 0.07 + H * 0.86, D / 2 + 0.04);
      g.add(plate);
      var cv = new T.Mesh(new T.PlaneGeometry(0.12, 0.34), crossMat);
      cv.position.set(0, 0.07 + H * 0.86, D / 2 + 0.06);
      g.add(cv);
      var chz = new T.Mesh(new T.PlaneGeometry(0.34, 0.12), crossMat);
      chz.position.copy(cv.position);
      g.add(chz);
      glows.push({ mat: crossMat, warm: false, base: 1, pulse: true });
    }
    if (ex.indexOf('sign') >= 0) {
      var arm = box(0.05, 0.05, 0.62, trimMat, W / 2 + 0.30, 0.07 + H * 0.92, 0);
      g.add(arm);
      var signMat = new T.MeshLambertMaterial({ color: 0x6b4a28 });
      var sign = new T.Mesh(new T.CylinderGeometry(0.27, 0.27, 0.05, 14), signMat);
      sign.rotation.x = Math.PI / 2;
      sign.position.set(W / 2 + 0.30, 0.07 + H * 0.62, 0.26);
      g.add(sign);
      var crow = new T.Mesh(new T.SphereGeometry(0.11, 8, 6), new T.MeshLambertMaterial({ color: 0x1c1c22 }));
      crow.position.set(W / 2 + 0.30, 0.07 + H * 0.62, 0.30);
      g.add(crow);
      g.userData.sign = sign;
    }
    if (ex.indexOf('barrel') >= 0) {
      var bar = cyl(0.19, 0.19, 0.42, 10, new T.MeshLambertMaterial({ color: 0x6a4826 }), -W * 0.42, 0.28, D * 0.10);
      g.add(bar);
      g.add(new T.Mesh(new T.TorusGeometry(0.20, 0.018, 4, 12), trimMat).translateX(-W * 0.42).translateY(0.36).translateZ(D * 0.10));
    }
    if (ex.indexOf('stools') >= 0) {
      for (var s2 = -1; s2 <= 1; s2++) {
        g.add(cyl(0.10, 0.09, 0.22, 8, trimMat, s2 * 0.42, 0.18, D * 0.30));
      }
    }
    if (ex.indexOf('target') >= 0) {
      var tgt = new T.Mesh(new T.CylinderGeometry(0.30, 0.30, 0.05, 16), new T.MeshLambertMaterial({ color: 0xe8dcc0 }));
      tgt.rotation.x = Math.PI / 2;
      tgt.position.set(0, 0.07 + H * 0.55, -D * 0.42);
      g.add(tgt);
      var ring2 = new T.Mesh(new T.TorusGeometry(0.19, 0.035, 6, 16), new T.MeshLambertMaterial({ color: 0xa8322a }));
      ring2.position.set(0, 0.07 + H * 0.55, -D * 0.39);
      g.add(ring2);
      var bull = new T.Mesh(new T.CircleGeometry(0.07, 12), new T.MeshLambertMaterial({ color: 0xa8322a }));
      bull.position.set(0, 0.07 + H * 0.55, -D * 0.37);
      g.add(bull);
    }
    if (ex.indexOf('training-posts') >= 0) {
      for (var tp = -1; tp <= 1; tp += 2) {
        g.add(cyl(0.05, 0.06, 0.62, 6, trimMat, tp * W * 0.52, 0.38, D * 0.34));
        g.add(box(0.09, 0.09, 0.09, new T.MeshLambertMaterial({ color: 0x8a3a2e }), tp * W * 0.52, 0.72, D * 0.34));
      }
    }
    if (ex.indexOf('roof-nest') >= 0) {
      var nest = new T.Mesh(new T.TorusGeometry(0.30, 0.11, 6, 12), new T.MeshLambertMaterial({ color: 0x8a6a3c }));
      nest.rotation.x = Math.PI / 2;
      nest.position.y = roofBase + 0.92;
      g.add(nest);
      var eggm = new T.Mesh(new T.SphereGeometry(0.10, 8, 6), new T.MeshLambertMaterial({ color: 0xefe4c8 }));
      eggm.scale.y = 1.3;
      eggm.position.y = roofBase + 0.95;
      g.add(eggm);
    }
    if (ex.indexOf('hanging-nest') >= 0 || ex.indexOf('hanging-cradle') >= 0) {
      var hang = new T.Group();
      hang.add(cyl(0.012, 0.012, 0.42, 4, trimMat, 0, 0.21, 0));
      var basket = new T.Mesh(new T.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new T.MeshLambertMaterial({ color: 0x9a7440 }));
      hang.add(basket);
      hang.position.set(-(W / 2 + 0.42), 0.55, D * 0.1);
      g.add(hang);
      g.add(box(0.05, 0.05, 0.5, trimMat, -(W / 2 + 0.24), 0.76, D * 0.1));
      g.userData.swing = hang;
    }
    if (ex.indexOf('crossed-poles') >= 0) {
      for (var cp = -1; cp <= 1; cp += 2) {
        var pole = cyl(0.035, 0.045, 1.0, 5, trimMat, cp * 0.22, 0.07 + H * 1.02, 0);
        pole.rotation.z = cp * 0.34;
        g.add(pole);
      }
    }
    if (ex.indexOf('crescent') >= 0) {
      var moonMat = new T.MeshBasicMaterial({ color: 0xf0dc9a });
      var moon = new T.Mesh(new T.TorusGeometry(0.17, 0.045, 6, 14, Math.PI * 1.35), moonMat);
      moon.position.y = roofBase + W * 0.62 + 0.22;
      moon.rotation.z = -0.6;
      g.add(moon);
      g.add(cyl(0.02, 0.02, 0.2, 4, trimMat, 0, roofBase + W * 0.62 + 0.06, 0));
      glows.push({ mat: moonMat, warm: false, base: 1, always: true });
    }
    if (ex.indexOf('telescope') >= 0) {
      var scope = new T.Group();
      scope.add(cyl(0.055, 0.085, 0.62, 10, new T.MeshLambertMaterial({ color: 0x9a8a5c })));
      scope.rotation.set(-0.85, 0.5, 0);
      scope.position.set(-W * 0.20, 0.07 + H * 0.72, D * 0.24);
      g.add(scope);
      g.add(cyl(0.05, 0.07, 0.34, 6, trimMat, -W * 0.20, 0.07 + H * 0.36, D * 0.24));
      g.userData.scope = scope;
    }
    if (ex.indexOf('weathervane') >= 0) {
      var vane = new T.Group();
      vane.add(cyl(0.02, 0.02, 0.5, 4, trimMat, 0, 0.25, 0));
      var arrow = new T.Mesh(new T.ConeGeometry(0.07, 0.22, 4), trimMat);
      arrow.rotation.z = -Math.PI / 2;
      arrow.position.set(0.2, 0.46, 0);
      vane.add(arrow);
      vane.add(box(0.16, 0.14, 0.02, trimMat, -0.16, 0.46, 0));
      vane.position.set(-W * 0.42, roofBase + 0.5, D * 0.3);
      g.add(vane);
      g.userData.vane = vane;
    }
    if (ex.indexOf('awning') >= 0) {
      var aw = box(W + 0.5, 0.06, 0.55, new T.MeshLambertMaterial({ color: 0x53381f }), 0, 0.07 + H * 0.74, D / 2 + 0.24);
      aw.rotation.x = -0.28;
      g.add(aw);
    }
    if (ex.indexOf('sacks') >= 0) {
      for (var sk = 0; sk < 3; sk++) {
        var sack = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), new T.MeshLambertMaterial({ color: 0xbfa478 }));
        sack.scale.set(1, 1.25, 1);
        sack.position.set(-0.5 + sk * 0.42, 0.22, D * 0.34);
        g.add(sack);
      }
    }
    if (ex.indexOf('rope-belt') >= 0) {
      var rope = new T.Mesh(new T.TorusGeometry(W * 0.56, 0.035, 5, 16), new T.MeshLambertMaterial({ color: 0xb49a68 }));
      rope.rotation.x = Math.PI / 2;
      rope.position.y = 0.07 + H * 0.30;
      g.add(rope);
    }
    if (ex.indexOf('hole-door') >= 0) {
      var hole = new T.Mesh(new T.CircleGeometry(0.20, 14), new T.MeshBasicMaterial({ color: 0x120c07 }));
      hole.position.set(0, 0.07 + H * 0.13, D / 2 + 0.035);
      g.add(hole);
    }
    if (ex.indexOf('open-front') >= 0) {
      var dark = new T.Mesh(new T.PlaneGeometry(W * 0.82, H * 0.52), new T.MeshBasicMaterial({ color: 0x1a1108 }));
      dark.position.set(0, 0.07 + H * 0.36, D / 2 + 0.02);
      g.add(dark);
    }

    // Swinging and turning parts must keep their own transforms; everything
    // else in the house is baked into one mesh.
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

  // A translucent blueprint of a building that has not been raised yet.
  function buildGhost(id) {
    var st = STYLES[id];
    var g = new T.Group();
    var mat = new T.MeshBasicMaterial({ color: 0xd6a84f, transparent: true, opacity: 0.13, wireframe: true });
    var m = new T.Mesh(new T.BoxGeometry(st.w, st.h, st.d), mat);
    m.position.y = 0.07 + st.h / 2;
    g.add(m);
    var disc = new T.Mesh(new T.CircleGeometry((st.w + st.d) * 0.28, 18), new T.MeshBasicMaterial({ color: 0xd6a84f, transparent: true, opacity: 0.10 }));
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    g.userData.ghost = true;
    return g;
  }

  // ---- a bird ---------------------------------------------------------------

  function buildBird(kind) {
    var b = BIRDS[kind] || BIRDS.robin;
    var g = new T.Group();
    var bodyMat = new T.MeshLambertMaterial({ color: b.body });
    var wingMat = new T.MeshLambertMaterial({ color: b.wing, side: T.DoubleSide });
    var s = b.size;
    var body = new T.Mesh(new T.SphereGeometry(s, 9, 7), bodyMat);
    body.scale.set(1.6, 0.92, 0.92);
    g.add(body);
    var head = new T.Mesh(new T.SphereGeometry(s * 0.62, 8, 6), bodyMat);
    head.position.set(s * 1.42, s * 0.30, 0);
    g.add(head);
    var beak = new T.Mesh(new T.ConeGeometry(s * 0.20, s * 0.55, 5), new T.MeshLambertMaterial({ color: 0xd8a03a }));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(s * 2.05, s * 0.26, 0);
    g.add(beak);
    var breast = new T.Mesh(new T.SphereGeometry(s * 0.66, 8, 6), new T.MeshLambertMaterial({ color: b.breast }));
    breast.scale.set(1.15, 0.85, 0.85);
    breast.position.set(s * 0.72, -s * 0.24, 0);
    g.add(breast);
    var tail = new T.Mesh(new T.BoxGeometry(s * 1.25, s * 0.10, s * 0.60), wingMat);
    tail.position.set(-s * 1.75, s * 0.06, 0);
    g.add(tail);
    // Wings pivot at the shoulders so they beat rather than slide.
    var wings = [];
    for (var side = -1; side <= 1; side += 2) {
      var pivot = new T.Group();
      pivot.position.set(0, s * 0.34, side * s * 0.42);
      var wing = new T.Mesh(new T.PlaneGeometry(s * 1.5, s * b.span, 1, 1), wingMat);
      wing.rotation.x = Math.PI / 2;
      wing.position.set(-s * 0.12, 0, side * s * b.span * 0.5);
      pivot.add(wing);
      g.add(pivot);
      wings.push({ pivot: pivot, side: side });
    }
    // Body parts bake into one mesh; the wings stay separate so they can beat.
    mergeStatic(g, {
      name: 'bird-body',
      only: function(o) {
        var q = o;
        while (q) { if (q.parent && q.parent.isGroup && wings.some(function(w) { return w.pivot === q.parent || w.pivot === q; })) return false; q = q.parent; }
        return true;
      }
    });
    g.userData.wings = wings;
    g.userData.kind = kind;
    g.userData.flap = b.flap;
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
      houses: [], glows: [], smokes: [], birds: [], fireflies: null, leafFall: [],
      labels: [], sun: null, moon: null, hemi: null, sky: null,
      builtKey: '', shadowTick: 0, disposed: false
    };
    var rng = mulberry32(20260730);

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

    // ---- build ----
    function makeMaterials() {
      var bark = barkTexture();
      bark.repeat.set(2, 1.4);
      return {
        bark: new T.MeshLambertMaterial({ map: bark, color: 0xc0a884 }),
        leaf: new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
        plank: new T.MeshLambertMaterial({ color: 0x8a6236 }),
        barkTex: bark
      };
    }

    function buildScene() {
      var scene = new T.Scene();
      scene.fog = new T.Fog(0x1d2a24, 44, 118);
      var mats = makeMaterials();
      st.mats = mats;

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
      gg.fillStyle = '#33512d'; gg.fillRect(0, 0, 256, 256);
      for (var gp = 0; gp < 420; gp++) {
        gg.fillStyle = 'rgba(' + (rng() < 0.5 ? '30,58,26' : '78,110,52') + ',' + (0.10 + rng() * 0.30) + ')';
        gg.beginPath();
        gg.ellipse(rng() * 256, rng() * 256, 4 + rng() * 26, 3 + rng() * 18, rng() * 3, 0, 7);
        gg.fill();
      }
      var groundTex = new T.CanvasTexture(gc);
      groundTex.wrapS = groundTex.wrapT = T.RepeatWrapping;
      groundTex.repeat.set(9, 9);
      if (T.SRGBColorSpace) groundTex.colorSpace = T.SRGBColorSpace;
      st.groundTex = groundTex;
      var ground = new T.Mesh(new T.CircleGeometry(70, 44), new T.MeshLambertMaterial({ map: groundTex, color: 0xa8bf9a }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.2;
      ground.receiveShadow = true;
      scene.add(ground);
      // Undergrowth around the roots
      var bushGeo = new T.IcosahedronGeometry(0.5, 0);
      var bushes = new T.InstancedMesh(bushGeo, new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), 120);
      var dm = new T.Object3D(), bc = new T.Color(), bbase = new T.Color(0x3a5c2e);
      for (var i = 0; i < 120; i++) {
        var ba = rng() * Math.PI * 2, br = 3.4 + rng() * 12;
        dm.position.set(Math.sin(ba) * br, -0.1 + rng() * 0.2, Math.cos(ba) * br);
        dm.rotation.set(rng(), rng() * 3, rng());
        var bs = 0.35 + rng() * 0.75;
        dm.scale.set(bs, bs * (0.5 + rng() * 0.4), bs);
        dm.updateMatrix();
        bushes.setMatrixAt(i, dm.matrix);
        bc.copy(bbase).offsetHSL((rng() - 0.5) * 0.07, 0, (rng() - 0.5) * 0.14);
        bushes.setColorAt(i, bc);
      }
      bushes.instanceMatrix.needsUpdate = true;
      if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
      bushes.receiveShadow = true;
      scene.add(bushes);

      // The tree
      var tree = buildTree(mats, rng);
      scene.add(tree.group);
      st.leaves = tree.leaves;

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
      sun.shadow.mapSize.set(1024, 1024);
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
        var isBuilt = built.indexOf(id) >= 0;
        var node = isBuilt ? buildTreehouse(id, mats, rng) : buildGhost(id);
        if (!node) return;
        node.position.set(a.x, a.y, a.z);
        node.rotation.y = a.angle; // face outward, away from the trunk
        node.scale.setScalar(a.cfg.scale);
        scene.add(node);
        if (isBuilt) {
          st.houses.push(node);
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
      for (var fl2 = 0; fl2 < 46; fl2++) {
        var fa = rng() * Math.PI * 2, fr2 = 3.6 + rng() * 4.6;
        var stem = cyl(0.012, 0.016, 0.3, 4, new T.MeshLambertMaterial({ color: 0x4a7a38 }), Math.sin(fa) * fr2, 0.05, Math.cos(fa) * fr2);
        garden.add(stem);
        var head = new T.Mesh(new T.SphereGeometry(0.09, 6, 5), new T.MeshLambertMaterial({ color: petals[Math.floor(rng() * petals.length)] }));
        head.position.set(Math.sin(fa) * fr2, 0.22, Math.cos(fa) * fr2);
        head.scale.y = 0.6;
        garden.add(head);
      }
      // A little pond with a feeder standing beside it.
      var pond = new T.Mesh(new T.CircleGeometry(1.5, 22), new T.MeshLambertMaterial({ color: 0x2f6b86 }));
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

      // Birds circling the canopy
      st.birds = [];
      for (var bi = 0; bi < 5; bi++) spawnBird(scene);

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

    function spawnBird(scene) {
      var night = st.night;
      var keys = Object.keys(BIRDS);
      var pool = [];
      keys.forEach(function(k) {
        var w = night ? BIRDS[k].night : (1 - BIRDS[k].night * 0.5);
        for (var n = 0; n < Math.max(1, Math.round(w * 6)); n++) pool.push(k);
      });
      var kind = pool[Math.floor(Math.random() * pool.length)] || 'robin';
      var b = buildBird(kind);
      b.userData.orbit = {
        r: 6 + Math.random() * 7,
        y: 3.5 + Math.random() * 7,
        sp: (0.10 + Math.random() * 0.16) * (Math.random() < 0.5 ? 1 : -1),
        a: Math.random() * Math.PI * 2,
        bobAmp: 0.3 + Math.random() * 0.7,
        bobSp: 0.5 + Math.random() * 0.9,
        phase: Math.random() * 7
      };
      scene.add(b);
      st.birds.push(b);
      return b;
    }

    // ---- renderer / mount ----
    function mount() {
      var cont = adapter.container();
      if (!cont) return false;
      st.cont = cont;
      if (!st.renderer) {
        st.renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        st.renderer.setPixelRatio(Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1));
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
      st.renderer.domElement.style.touchAction = 'none';
      resize();
      st.mounted = true;
      return true;
    }

    function resize() {
      if (!st.cont || !st.renderer) return;
      var w = st.cont.clientWidth, h = st.cont.clientHeight;
      if (!w || !h) return;
      st.w = w; st.h = h;
      st.renderer.setSize(w, h, false);
      st.camera.aspect = w / h;
      st.camera.updateProjectionMatrix();
    }

    // Drag to orbit, pinch to zoom, tap a building to step inside.
    function wireInput(el) {
      var MIN_D = 11, MAX_D = 52;
      function zoom(d) { st.cam.dist = Math.min(MAX_D, Math.max(MIN_D, d)); }
      el.addEventListener('pointerdown', function(e) {
        el.setPointerCapture && el.setPointerCapture(e.pointerId);
        st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        st.cam.lastInput = Date.now();
        st.dragged = false;
        if (st.pointers.size === 1) st.orbitStart = { x: e.clientX, y: e.clientY, az: st.cam.az, polar: st.cam.polar };
      });
      el.addEventListener('pointermove', function(e) {
        if (!st.pointers.has(e.pointerId)) return;
        st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        st.cam.lastInput = Date.now();
        if (st.pointers.size === 1 && st.orbitStart) {
          var dx = e.clientX - st.orbitStart.x, dy = e.clientY - st.orbitStart.y;
          if (Math.abs(dx) + Math.abs(dy) > 6) st.dragged = true;
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
        st.pointers.delete(e.pointerId);
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
      if (st.lastT && now - st.lastT < 14) { schedule(); return; } // 60fps cap
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
        var day = g.always ? 0.85 : 0.24;
        var target = g.lit ? (day + (g.base - day) * boost) * flick : 0.04;
        g.mat.opacity = g.mat.opacity + (target - g.mat.opacity) * Math.min(1, s * 5);
        var haloAmt = g.mat.opacity * (0.08 + boost * 0.40);
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

      // Birds: circle, bank and beat their wings
      for (var b = 0; b < st.birds.length; b++) {
        var bird = st.birds[b], o = bird.userData.orbit;
        o.a += s * o.sp;
        var x = Math.sin(o.a) * o.r, z = Math.cos(o.a) * o.r;
        var y = o.y + Math.sin(t * o.bobSp + o.phase) * o.bobAmp;
        bird.position.set(x, y, z);
        // Face along the tangent of the circle
        bird.rotation.y = Math.atan2(Math.cos(o.a) * o.sp, -Math.sin(o.a) * o.sp) + (o.sp > 0 ? 0 : Math.PI);
        bird.rotation.z = -Math.sin(t * o.bobSp + o.phase) * 0.16;
        var beat = Math.sin(t * bird.userData.flap + o.phase);
        bird.userData.wings.forEach(function(w) {
          w.pivot.rotation.x = w.side * beat * 0.85;
        });
      }

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
      st.renderer.render(st.scene, st.camera);
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
        st.glows.forEach(function(g) { g.mat.opacity = g.base; });
        st.renderer.shadowMap.needsUpdate = true;
        var rc = st.cam;
        st.camera.position.set(Math.sin(rc.az) * Math.sin(rc.polar) * rc.dist, Math.cos(rc.polar) * rc.dist + 3.6, Math.cos(rc.az) * Math.sin(rc.polar) * rc.dist);
        st.camera.lookAt(0, 7.8, 0);
        st.renderer.render(st.scene, st.camera);
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
      if (!st.scene) return;
      st.scene.traverse(function(o) {
        if (o.isInstancedMesh && o.dispose) o.dispose();
        if (o.isLight && o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
        if (o.geometry) o.geometry.dispose();
        var mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        mats.forEach(function(m) {
          var mp = m.map;
          if (mp && mp.dispose && !(mp.userData && mp.userData.shared) && mp !== st.smokeTex && mp !== st.ffTex && mp !== st.groundTex && mp !== (st.mats && st.mats.barkTex)) mp.dispose();
          m.dispose();
        });
      });
      st.scene = null;
      st.houses = []; st.glows = []; st.smokes = []; st.birds = []; st.labels = []; st.leafFall = [];
      st.fireflies = null; st.moon = null; st.moonDisc = null;
    }

    function stop() {
      pause();
      disposeScene();
      if (st.smokeTex) { st.smokeTex.dispose(); st.smokeTex = null; }
      if (st.ffTex) { st.ffTex.dispose(); st.ffTex = null; }
      if (st.groundTex) { st.groundTex.dispose(); st.groundTex = null; }
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
      isRunning: function() { return st.running; },
      _state: st
    };
  }

  return {
    ANCHORS: ANCHORS,
    STYLES: STYLES,
    BIRDS: BIRDS,
    isNightHour: isNightHour,
    lightBoostFor: lightBoostFor,
    anchorPosition: anchorPosition,
    mulberry32: mulberry32,
    createAcademy3D: createAcademy3D
  };
});
