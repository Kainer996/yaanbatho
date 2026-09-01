// Burbz Building Interior Core — step inside every building you raise.
// Each of the governor's buildings has a hand-drawn interior: the room
// itself, the villagers posted there, the goods on its shelves. The scene
// is honest — a half-manned hut shows empty stools, a dry cistern shows a
// dry trough, an upgrade under way drapes the room in dust sheets.
// Pure presentation logic: state in, an SVG string out. No DOM, no game
// globals, deterministic, UMD export for Node tests.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBuildingInteriorCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // The fifteen buildings a governor can raise. Mirrors EMPIRE_BUILDINGS in
  // index.html — an id outside this list gets the plain plot scene.
  const INTERIOR_IDS = ['cabin', 'hut', 'farm', 'well', 'lumberhut', 'minehut',
    'cottages', 'tavern', 'chapel', 'lumber', 'quarry', 'market', 'storehouse',
    'foundry', 'entertainment'];

  // ---- The view: plain facts in, a clamped picture of the room out --------
  // Everything the scenes read comes through here, so a caller can never
  // hand a scene a shape it does not expect.
  function interiorView(buildingId, facts) {
    const f = facts || {};
    const id = INTERIOR_IDS.indexOf(buildingId) !== -1 ? buildingId : 'plot';
    const maxLevel = Math.max(1, Math.floor(Number(f.maxLevel) || 3));
    const level = Math.max(0, Math.min(maxLevel, Math.floor(Number(f.level) || 0)));
    const needed = Math.max(0, Math.floor(Number(f.workersNeeded) || 0));
    const posted = Math.max(0, Math.min(needed, Math.floor(Number(f.workersPosted) || 0)));
    let fill = Number(f.storeFill);
    if (!isFinite(fill)) fill = 0;
    fill = Math.max(0, Math.min(1, fill));
    return {
      id: id,
      level: level,
      maxLevel: maxLevel,
      plot: level <= 0,
      rising: !!f.rising,
      workers: { posted: posted, needed: needed },
      storeFill: fill
    };
  }

  // ---- The drawing kit ------------------------------------------------------
  // One palette and one set of props for all fifteen rooms, so the whole
  // village feels built by the same hands. Same family as the Academy's
  // inline scenes: warm timber, lantern gold, deep ink lines.
  const INK = '#140d06', TRIM = '#6b4a26', GOLD = '#d6a84f', GOLDHI = '#f0c767';
  const CREAM = '#f4ead4', TEAL = '#2e7d86', STONE = '#7d7568', STONEDK = '#5a5348';
  let uid = 0;

  const DEFS = '<defs>'
    + '<linearGradient id="bi-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a15"/><stop offset="1" stop-color="#241708"/></linearGradient>'
    + '<linearGradient id="bi-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#41301a"/><stop offset="1" stop-color="#1d1208"/></linearGradient>'
    + '<linearGradient id="bi-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6e675c"/><stop offset="1" stop-color="#453f36"/></linearGradient>'
    + '<radialGradient id="bi-gold"><stop offset="0" stop-color="#f0c767" stop-opacity=".8"/><stop offset="1" stop-color="#f0c767" stop-opacity="0"/></radialGradient>'
    + '<radialGradient id="bi-day"><stop offset="0" stop-color="#cfe8ef"/><stop offset=".6" stop-color="#9fccd8"/><stop offset="1" stop-color="#6da4b4"/></radialGradient>'
    + '<linearGradient id="bi-fire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e2842f"/><stop offset="1" stop-color="#ffe9a8"/></linearGradient>'
    + '<linearGradient id="bi-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ea8b5"/><stop offset="1" stop-color="#28656f"/></linearGradient>'
    + '<radialGradient id="bi-vig"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".44"/></radialGradient>'
    + '</defs>';

  // Plank wall with a soft lantern pool. Every room starts here.
  function wall(tint) {
    let s = '<rect width="800" height="600" fill="url(#bi-wall)"/>';
    for (let i = 0; i < 10; i++) s += '<rect x="' + (i * 80) + '" y="0" width="77" height="600" fill="' + (i % 2 ? '#372715' : '#2f2010') + '"/>';
    s += '<path d="M96 140q20 30 0 62M300 240q18 26 0 54M604 120q20 30 0 62M688 320q16 24 0 50" stroke="#221507" stroke-width="4" fill="none"/>';
    s += '<ellipse cx="400" cy="180" rx="430" ry="270" fill="url(#bi-gold)" opacity="' + (tint === undefined ? 0.13 : tint) + '"/>';
    return s;
  }
  // Cut-stone wall for the grander rooms (stone cottage, chapel, foundry).
  function stoneWall() {
    let s = '<rect width="800" height="600" fill="url(#bi-stone)"/>';
    for (let row = 0; row < 8; row++) {
      const y = row * 62, off = row % 2 ? 55 : 0;
      s += '<path d="M0 ' + y + 'h800" stroke="#332e27" stroke-width="4"/>';
      for (let c = 0; c < 9; c++) s += '<path d="M' + (off + c * 110) + ' ' + y + 'v62" stroke="#332e27" stroke-width="3.4"/>';
    }
    s += '<ellipse cx="400" cy="180" rx="430" ry="270" fill="url(#bi-gold)" opacity=".12"/>';
    return s;
  }
  function beam() { return '<rect width="800" height="46" fill="#1d1309"/><rect y="42" width="800" height="10" fill="#0f0a04"/>'; }
  function floor(y) {
    y = y || 452;
    let s = '<rect x="0" y="' + y + '" width="800" height="' + (600 - y) + '" fill="url(#bi-floor)"/><rect x="0" y="' + y + '" width="800" height="6" fill="#0f0a04"/>';
    s += '<path d="M0 ' + (y + 44) + 'h800M0 ' + (y + 96) + 'h800" stroke="#120b05" stroke-width="3"/>';
    for (const fx of [140, 320, 500, 670]) s += '<path d="M' + fx + ' ' + (y + 6) + 'l' + Math.round((fx - 400) / 9) + ' ' + (594 - y) + '" stroke="#120b05" stroke-width="3"/>';
    return s;
  }
  function lantern(x, y, sc) {
    sc = sc || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + sc + ')"><line x1="0" y1="-40" x2="0" y2="0" stroke="#3d2c14" stroke-width="3"/><circle cx="0" cy="20" r="42" fill="url(#bi-gold)" opacity=".55"/><rect x="-9" y="-7" width="18" height="9" rx="3" fill="' + TRIM + '"/><rect x="-13" y="0" width="26" height="36" rx="7" fill="#1c1209" stroke="' + TRIM + '" stroke-width="3"/><rect x="-7" y="6" width="14" height="24" rx="4" fill="#ffdf9e"><animate attributeName="opacity" values=".7;.95;.78;.95;.7" dur="3.4s" repeatCount="indefinite"/></rect></g>';
  }
  // A window on the village: daylight, a roofline, a bird on the wing.
  function window_(cx, cy, w, h) {
    const id = 'bi-win' + (++uid);
    return '<rect x="' + (cx - w / 2 - 10) + '" y="' + (cy - h / 2 - 10) + '" width="' + (w + 20) + '" height="' + (h + 20) + '" rx="10" fill="#17100a"/>'
      + '<clipPath id="' + id + '"><rect x="' + (cx - w / 2) + '" y="' + (cy - h / 2) + '" width="' + w + '" height="' + h + '" rx="6"/></clipPath>'
      + '<g clip-path="url(#' + id + ')"><rect x="' + (cx - w / 2) + '" y="' + (cy - h / 2) + '" width="' + w + '" height="' + h + '" fill="url(#bi-day)"/>'
      + '<path d="M' + (cx - w / 2) + ' ' + (cy + h * 0.22) + 'q' + (w * 0.3) + ' -18 ' + (w * 0.62) + ' -4t' + (w * 0.5) + ' 8v' + h + 'h-' + (w * 1.4) + 'z" fill="#4c7a52"/>'
      + '<path d="M' + (cx - w * 0.28) + ' ' + (cy - h * 0.08) + 'l14 -12 14 12z" fill="#8a5a34"/><rect x="' + (cx - w * 0.24) + '" y="' + (cy - h * 0.08) + '" width="20" height="16" fill="#a8794a"/>'
      + '<path d="M' + (cx + w * 0.18) + ' ' + (cy - h * 0.3) + 'q7 -7 14 0M' + (cx + w * 0.22) + ' ' + (cy - h * 0.3) + 'q3 -4 6 0" stroke="#2c3e44" stroke-width="2.4" fill="none"/></g>'
      + '<path d="M' + (cx - w / 2) + ' ' + cy + 'h' + w + 'M' + cx + ' ' + (cy - h / 2) + 'v' + h + '" stroke="#17100a" stroke-width="7"/>'
      + '<rect x="' + (cx - w / 2 - 10) + '" y="' + (cy - h / 2 - 10) + '" width="' + (w + 20) + '" height="' + (h + 20) + '" rx="10" fill="none" stroke="' + TRIM + '" stroke-width="5"/>';
  }
  function table(x, y, w, h, skew) {
    skew = skew === undefined ? 26 : skew;
    return '<polygon points="' + x + ',' + y + ' ' + (x + w) + ',' + y + ' ' + (x + w + skew) + ',' + (y + h) + ' ' + (x - skew) + ',' + (y + h) + '" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/>'
      + '<polygon points="' + (x - skew) + ',' + (y + h) + ' ' + (x + w + skew) + ',' + (y + h) + ' ' + (x + w + skew) + ',' + (y + h + 12) + ' ' + (x - skew) + ',' + (y + h + 12) + '" fill="#31210f" stroke="' + INK + '" stroke-width="2"/>'
      + '<rect x="' + (x - skew + 10) + '" y="' + (y + h + 12) + '" width="14" height="' + Math.max(20, 560 - y - h) + '" fill="#2b1e11" stroke="' + INK + '" stroke-width="2"/>'
      + '<rect x="' + (x + w + skew - 24) + '" y="' + (y + h + 12) + '" width="14" height="' + Math.max(20, 560 - y - h) + '" fill="#2b1e11" stroke="' + INK + '" stroke-width="2"/>';
  }
  function shelf(x, y, w) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="10" rx="3" fill="#3a2a16" stroke="' + INK + '" stroke-width="2"/><path d="M' + (x + 8) + ' ' + (y + 10) + 'l8 14M' + (x + w - 16) + ' ' + (y + 10) + 'l8 14" stroke="#2b1e11" stroke-width="5"/>';
  }
  function sack(x, y, sc, colour) {
    sc = sc || 1; colour = colour || '#b98c3e';
    return '<g transform="translate(' + x + ',' + y + ') scale(' + sc + ')"><path d="M-22 0q-6 -34 8 -44q-4 -8 14 -8t14 8q14 10 8 44z" fill="' + colour + '" stroke="' + INK + '" stroke-width="2.6"/><path d="M-14 -44q14 6 28 0" stroke="' + INK + '" stroke-width="2" fill="none"/><path d="M-6 -52h12" stroke="#6b4a26" stroke-width="5"/></g>';
  }
  function barrel(x, y, sc) {
    sc = sc || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + sc + ')"><path d="M-20 -52q20 -8 40 0v52q-20 8 -40 0z" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.6"/><path d="M-20 -38q20 6 40 0M-20 -14q20 6 40 0" stroke="#5a4326" stroke-width="4" fill="none"/><ellipse cx="0" cy="-52" rx="20" ry="6" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/></g>';
  }
  function crate(x, y, sc) {
    sc = sc || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + sc + ')"><rect x="-24" y="-40" width="48" height="40" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.6"/><path d="M-24 -40l48 40M24 -40l-48 40" stroke="#5a4326" stroke-width="3.6"/></g>';
  }
  function firepit(x, y, sc) {
    sc = sc || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + sc + ')"><circle cx="0" cy="24" r="60" fill="url(#bi-gold)" opacity=".5"/><ellipse cx="0" cy="10" rx="34" ry="10" fill="#3b332b" stroke="' + INK + '" stroke-width="2.6"/><path d="M-20 6l12 -10M20 6l-12 -10M0 8l0 -14" stroke="#221507" stroke-width="5"/><path d="M-8 0q-8 -22 8 -34q-2 14 8 20q2 -8 8 -10q4 18 -8 26q-10 6 -16 -2z" fill="url(#bi-fire)"><animate attributeName="opacity" values=".85;1;.8;1;.85" dur="1.9s" repeatCount="indefinite"/></path></g>';
  }
  // A villager at their work: hood, cloak, honest hands. `pose` reads
  // 'work' (leaning to the bench), 'sit' or 'stand'. A soft lantern pool
  // stands behind every posted worker, so a manned bench reads lit.
  function villager(x, y, sc, pose, tone) {
    sc = sc || 1; tone = tone || '#8a986b';
    const lean = pose === 'work' ? 'rotate(9)' : '';
    const legs = pose === 'sit'
      ? '<path d="M-10 46q2 14 -8 20M10 46q-2 14 8 20" stroke="#3a2b18" stroke-width="8" fill="none" stroke-linecap="round"/>'
      : '<path d="M-8 46v22M8 46v22" stroke="#3a2b18" stroke-width="8" stroke-linecap="round"/>';
    return '<g transform="translate(' + x + ',' + y + ') scale(' + sc + ')">'
      + '<circle cx="0" cy="16" r="52" fill="url(#bi-gold)" opacity=".4"/>'
      + '<g transform="' + lean + '">'
      + legs
      + '<path d="M-20 48q-6 -40 20 -46q26 6 20 46q-20 8 -40 0z" fill="' + tone + '" stroke="' + INK + '" stroke-width="2.8"/>'
      + '<path d="M-16 16q16 10 32 0" stroke="' + INK + '" stroke-width="2" fill="none" opacity=".5"/>'
      + '<circle cx="0" cy="-10" r="13" fill="#e5c79a" stroke="' + INK + '" stroke-width="2.6"/>'
      + '<path d="M-14 -12q14 -20 28 0q-6 -8 -14 -8t-14 8z" fill="' + tone + '" stroke="' + INK + '" stroke-width="2.4"/>'
      + (pose === 'work' ? '<path d="M14 20q16 6 22 16" stroke="#e5c79a" stroke-width="7" fill="none" stroke-linecap="round"/>' : '')
      + '</g></g>';
  }
  // An empty stool where a worker should stand. The honest gap.
  function emptyPost(x, y, sc) {
    sc = sc || 1;
    return '<g transform="translate(' + x + ',' + y + ') scale(' + sc + ')" opacity=".85"><ellipse cx="0" cy="40" rx="20" ry="7" fill="#241809"/><rect x="-16" y="8" width="32" height="8" rx="3" fill="#4a3418" stroke="' + INK + '" stroke-width="2"/><path d="M-12 16l-4 24M12 16l4 24M0 16v24" stroke="#2b1e11" stroke-width="4"/></g>';
  }
  // Dust sheets and a ladder: the room while its upgrade rises.
  function risingDressing() {
    return '<g opacity=".92"><path d="M40 300q80 40 170 8v292h-190z" fill="#cfc4ab" opacity=".5"/><path d="M60 330q60 26 130 6M56 400q64 24 138 4" stroke="#a99e86" stroke-width="3" fill="none" opacity=".6"/>'
      + '<path d="M640 560l44 -300M712 560l-44 -300M652 480h48M660 420h40M668 360h32" stroke="#6b4a26" stroke-width="7" stroke-linecap="round"/>'
      + '<circle cx="700" cy="250" r="30" fill="url(#bi-gold)" opacity=".4"/></g>';
  }
  // Level pips drawn into the room itself — a little wall plaque.
  function plaque(level, maxLevel) {
    let pips = '';
    for (let i = 0; i < maxLevel; i++) pips += '<circle cx="' + (i * 16 - (maxLevel - 1) * 8) + '" cy="0" r="5" fill="' + (i < level ? GOLDHI : '#241708') + '" stroke="' + INK + '" stroke-width="1.6"/>';
    return '<g transform="translate(400,74)"><rect x="-' + (maxLevel * 10 + 12) + '" y="-14" width="' + (maxLevel * 20 + 24) + '" height="28" rx="8" fill="#1c1209" stroke="' + TRIM + '" stroke-width="3"/>' + pips + '</g>';
  }
  function vignette() { return '<rect width="800" height="600" fill="url(#bi-vig)"/>'; }
  function wrap(label, body) {
    return '<svg class="bi-scene" viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + label + '">' + DEFS + body + vignette() + '</svg>';
  }
  // Deal the crew across the room's work spots: a villager where one is
  // posted, an empty stool where the yard is short. A spot reads
  // [x, y, scale, pose, tone].
  function crew(spots, view, sc) {
    let s = '';
    for (let i = 0; i < spots.length; i++) {
      const p = spots[i];
      const size = (p[2] || 1) * (sc || 1);
      s += i < view.workers.posted ? villager(p[0], p[1], size, p[3] || 'work', p[4]) : emptyPost(p[0], p[1], size);
    }
    return s;
  }

  // ---- The plot: staked ground where a building could rise -----------------
  function plotScene(view) {
    let s = '<rect width="800" height="600" fill="url(#bi-day)"/>';
    s += '<path d="M0 320q200 -40 420 -10t380 -8v298H0z" fill="#4c7a52"/>';
    s += '<path d="M0 420q220 -30 430 -6t370 -10v196H0z" fill="#5b8a5d"/>';
    // The staked-out plot, waiting on the governor's word.
    s += '<polygon points="180,420 620,420 700,540 100,540" fill="#8a744c" opacity=".55"/>';
    s += '<polygon points="180,420 620,420 700,540 100,540" fill="none" stroke="#f4ead4" stroke-width="4" stroke-dasharray="16 12"/>';
    for (const [px, py] of [[180, 420], [620, 420], [700, 540], [100, 540]])
      s += '<rect x="' + (px - 5) + '" y="' + (py - 34) + '" width="10" height="38" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/>';
    // A ghost of the building to come.
    s += '<path d="M260 400l140 -110 140 110v16h-280z" fill="none" stroke="#f4ead4" stroke-width="4" stroke-dasharray="12 10" opacity=".8"/>';
    s += crate(660, 560, 1.1) + crate(716, 566, 0.9) + sack(608, 566, 1);
    s += '<g transform="translate(150,556)"><rect x="-6" y="-52" width="8" height="52" rx="3" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/><path d="M-20 -52h36l-6 -16h-24z" fill="#8a8073" stroke="' + INK + '" stroke-width="2.4"/></g>';
    return s;
  }

  // ---- The fifteen rooms ----------------------------------------------------
  const SCENES = {
    cabin: function(view) {
      const stoneHome = view.level >= 3;
      let s = stoneHome ? stoneWall() : wall();
      s += beam();
      s += window_(600, 210, 150, 140);
      s += lantern(180, 120, 1);
      // The hearth is the heart of the home.
      s += '<g transform="translate(120,452)"><rect x="-70" y="-160" width="140" height="160" rx="8" fill="' + (stoneHome ? '#5a5348' : '#4a3a26') + '" stroke="' + INK + '" stroke-width="3"/><rect x="-44" y="-96" width="88" height="96" rx="8" fill="#17100a"/><path d="M-16 -10q-10 -30 10 -44q-2 18 10 26q4 -10 10 -12q4 24 -12 34q-12 6 -18 -4z" fill="url(#bi-fire)"><animate attributeName="opacity" values=".85;1;.8;1;.85" dur="2.1s" repeatCount="indefinite"/></path><circle cx="0" cy="-30" r="70" fill="url(#bi-gold)" opacity=".5"/></g>';
      s += floor();
      s += table(330, 430, 180, 26);
      s += '<ellipse cx="420" cy="436" rx="26" ry="9" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2"/><path d="M404 430q16 -12 32 0" stroke="' + INK + '" stroke-width="2" fill="none"/>';
      // Cots grow with the household: one, a row, a proper bedchamber door.
      s += '<g transform="translate(660,470)"><rect x="-56" y="-24" width="112" height="34" rx="8" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/><rect x="-56" y="-38" width="34" height="20" rx="7" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.4"/><rect x="-22" y="-34" width="78" height="16" rx="6" fill="#8a2f2a" opacity=".85" stroke="' + INK + '" stroke-width="2"/></g>';
      if (view.level >= 2) s += '<g transform="translate(540,500)"><rect x="-50" y="-22" width="100" height="30" rx="8" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/><rect x="-50" y="-34" width="30" height="18" rx="6" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.4"/><rect x="-20" y="-30" width="70" height="14" rx="6" fill="' + TEAL + '" opacity=".8" stroke="' + INK + '" stroke-width="2"/></g>';
      if (stoneHome) s += '<path d="M330 120q70 -46 140 0" stroke="' + TRIM + '" stroke-width="5" fill="none"/><circle cx="400" cy="104" r="10" fill="' + GOLDHI + '" opacity=".8"/>';
      s += villager(300, 500, 1.05, 'stand', '#a07a8a') + villager(455, 508, 0.95, 'sit', '#8a986b');
      if (view.level >= 2) s += villager(560, 430, 0.7, 'stand', '#7b8a94');
      return s;
    },
    hut: function(view) {
      let s = wall(0.16);
      s += beam();
      s += window_(200, 200, 140, 130);
      // The drying rack: the day's forage, berries and mast by the basket.
      s += shelf(430, 180, 300);
      const berries = Math.max(1, Math.round(2 + view.storeFill * 4));
      for (let i = 0; i < berries; i++) s += '<g transform="translate(' + (470 + i * 52) + ',176)"><path d="M-16 0q0 -18 16 -18t16 18z" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.4"/><circle cx="-5" cy="-8" r="4.4" fill="#5a3a7a"/><circle cx="5" cy="-10" r="4.4" fill="#7a2f4a"/><circle cx="0" cy="-4" r="4.4" fill="#5a3a7a"/></g>';
      s += '<path d="M430 250h300" stroke="#3d2c14" stroke-width="4"/>';
      for (let i = 0; i < 4; i++) s += '<path d="M' + (460 + i * 70) + ' 250q4 24 0 44" stroke="#7a5a34" stroke-width="5" fill="none"/><ellipse cx="' + (460 + i * 70) + '" cy="300" rx="10" ry="16" fill="#8a6f4a" stroke="' + INK + '" stroke-width="2"/>';
      // The bow on the wall — hunters, not farmers, feed this village.
      s += '<g transform="translate(320,250) rotate(-24)"><path d="M0 -70q44 70 0 140" stroke="#6b4a26" stroke-width="7" fill="none"/><path d="M0 -70L0 70" stroke="' + CREAM + '" stroke-width="2.6"/></g>';
      s += floor(470);
      s += firepit(150, 520, 1.1);
      s += crew([[420, 512, 1, 'work', '#8a986b']], view, 1);
      s += sack(640, 566, 1.2, '#8a6f4a') + crate(716, 566, 1);
      s += lantern(680, 120, 0.9);
      return s;
    },
    farm: function(view) {
      let s = wall(0.16);
      s += beam();
      s += window_(560, 200, 190, 150);
      // Sheaves against the wall, the harvest in sacks by the door.
      for (let i = 0; i < 3; i++) s += '<g transform="translate(' + (120 + i * 80) + ',330)"><path d="M-20 60q10 -90 20 -104q10 14 20 104z" fill="#c8a24f" stroke="' + INK + '" stroke-width="2.6"/><path d="M-14 20h28" stroke="#6b4a26" stroke-width="5"/><path d="M-8 -34q8 -16 8 -30M0 -34q0 -16 0 -34M8 -34q-8 -16 -8 -30" stroke="#d9b96a" stroke-width="3" fill="none"/></g>';
      s += '<g transform="translate(430,240) rotate(18)"><path d="M0 0v110" stroke="#6b4a26" stroke-width="6"/><path d="M0 0q40 -22 78 -8" stroke="#8a8073" stroke-width="7" fill="none"/></g>';
      s += floor(460);
      const sacks = Math.max(1, Math.round(1 + view.storeFill * 5));
      for (let i = 0; i < sacks; i++) s += sack(500 + (i % 3) * 66, 566 - Math.floor(i / 3) * 44, 1.15, i % 2 ? '#b98c3e' : '#c8a24f');
      s += crew([[220, 512, 1.05, 'work', '#8a986b']], view, 1);
      s += lantern(300, 116, 0.95);
      s += '<ellipse cx="150" cy="560" rx="60" ry="12" fill="#241809" opacity=".6"/>';
      return s;
    },
    well: function(view) {
      let s = wall(0.15);
      s += beam();
      s += window_(160, 200, 140, 130);
      s += floor(470);
      // The well house: a staved drum, two posts, a little gabled roof, and
      // the windlass rope easing its bucket down the shaft.
      s += '<g transform="translate(370,440)">'
        + '<rect x="-108" y="-306" width="16" height="306" fill="#6b4a26" stroke="' + INK + '" stroke-width="2.6"/>'
        + '<rect x="92" y="-306" width="16" height="306" fill="#6b4a26" stroke="' + INK + '" stroke-width="2.6"/>'
        + '<path d="M-140 -296l140 -60 140 60z" fill="#8a5a34" stroke="' + INK + '" stroke-width="3"/>'
        + '<path d="M-124 -296h248" stroke="' + INK + '" stroke-width="3"/>'
        + '<rect x="-100" y="-252" width="200" height="12" rx="6" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.4"/>'
        + '<circle cx="118" cy="-246" r="16" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.6"/>'
        + '<line x1="0" y1="-246" x2="0" y2="-120" stroke="' + CREAM + '" stroke-width="3"/>'
        + '<g><rect x="-16" y="-120" width="32" height="26" rx="5" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.6"/>'
        + '<animateTransform attributeName="transform" type="translate" values="0 0;0 14;0 0" dur="5s" repeatCount="indefinite"/></g>'
        + '<path d="M-96 -60q96 -20 192 0v54q-96 22 -192 0z" fill="#8a6a3a" stroke="' + INK + '" stroke-width="3"/>'
        + '<path d="M-64 -66v70M0 -70v72M64 -66v70" stroke="#5a4326" stroke-width="3.4"/>'
        + '<ellipse cx="0" cy="-60" rx="96" ry="22" fill="#241708" stroke="' + INK + '" stroke-width="3"/>'
        + '<ellipse cx="0" cy="-62" rx="72" ry="14" fill="#0d1b1f"/>'
        + '</g>';
      // The trough gauges the cistern: full means full, dry means dry.
      const tw = 170, fillW = Math.round(tw * view.storeFill);
      s += '<g transform="translate(650,514)">'
        + '<rect x="-' + (tw / 2 + 10) + '" y="-34" width="' + (tw + 20) + '" height="54" rx="10" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/>'
        + '<rect x="-' + tw / 2 + '" y="-24" width="' + tw + '" height="34" rx="6" fill="#241708"/>'
        + (fillW > 6 ? '<rect x="-' + tw / 2 + '" y="-24" width="' + fillW + '" height="34" rx="6" fill="url(#bi-water)"><animate attributeName="opacity" values=".9;1;.9" dur="3.2s" repeatCount="indefinite"/></rect>' : '')
        + '<path d="M-' + (tw / 2 - 14) + ' 20v22M' + (tw / 2 - 14) + ' 20v22" stroke="#2b1e11" stroke-width="8"/>'
        + '</g>';
      s += '<g transform="translate(140,520)"><rect x="-11" y="-30" width="22" height="30" rx="4" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.4"/><ellipse cx="0" cy="-30" rx="11" ry="4" fill="#0d1b1f" stroke="' + INK + '" stroke-width="2"/></g>';
      s += lantern(660, 120, 0.95);
      return s;
    },
    lumberhut: function(view) {
      let s = wall(0.16);
      s += beam();
      s += window_(650, 190, 150, 130);
      // The log wall: the week's felling, stacked to season.
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++)
        s += '<g transform="translate(' + (110 + i * 62 + row * 31) + ',' + (420 - row * 52) + ')"><circle r="26" fill="#8a6a3a" stroke="' + INK + '" stroke-width="3"/><circle r="16" fill="#a8794a"/><circle r="7" fill="#8a6a3a"/></g>';
      // The saw bench where the three woodsmen work.
      s += floor(460);
      s += table(340, 420, 240, 24, 30);
      s += '<g transform="translate(430,404)"><path d="M-60 8h130" stroke="#8a8073" stroke-width="7"/><path d="M-60 8l-16 -18M70 8l16 -18" stroke="#6b4a26" stroke-width="7"/><path d="M-48 8l8 8M-28 8l8 8M-8 8l8 8M12 8l8 8M32 8l8 8M52 8l8 8" stroke="#8a8073" stroke-width="3"/></g>';
      s += '<g transform="translate(240,300) rotate(-30)"><rect x="-5" y="-52" width="10" height="66" rx="4" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/><path d="M-22 -52q22 -18 44 0l-8 18q-14 -10 -28 0z" fill="#8a8073" stroke="' + INK + '" stroke-width="2.6"/></g>';
      s += crew([[330, 510, 1, 'work', '#8a986b'], [520, 514, 1, 'work', '#7b8a94'], [660, 520, 1, 'stand', '#a07a8a']], view, 1);
      s += lantern(180, 116, 0.95);
      return s;
    },
    minehut: function(view) {
      let s = wall(0.1);
      s += beam();
      // The tunnel mouth, shored with honest timber.
      s += '<g transform="translate(560,452)"><path d="M-150 0v-190q0 -70 150 -70t150 70v190z" fill="#17100a" stroke="' + INK + '" stroke-width="4"/><path d="M-150 0v-190q0 -70 150 -70" fill="none" stroke="#3b332b" stroke-width="12"/><path d="M150 0v-190q0 -70 -150 -70" fill="none" stroke="#3b332b" stroke-width="12"/><rect x="-160" y="-206" width="26" height="206" fill="#6b4a26" stroke="' + INK + '" stroke-width="3"/><rect x="134" y="-206" width="26" height="206" fill="#6b4a26" stroke="' + INK + '" stroke-width="3"/><rect x="-170" y="-236" width="340" height="30" fill="#6b4a26" stroke="' + INK + '" stroke-width="3"/><circle cx="0" cy="-120" r="46" fill="url(#bi-gold)" opacity=".25"/></g>';
      s += lantern(430, 260, 0.85) + lantern(690, 260, 0.85);
      // The ore cart, filling as the dig goes well.
      s += floor(452);
      const ore = Math.max(0, Math.round(view.storeFill * 5));
      let cart = '<g transform="translate(200,500)"><path d="M-70 -50h140l-20 50h-100z" fill="#4a4238" stroke="' + INK + '" stroke-width="3"/><circle cx="-40" cy="12" r="16" fill="#241708" stroke="' + INK + '" stroke-width="3"/><circle cx="40" cy="12" r="16" fill="#241708" stroke="' + INK + '" stroke-width="3"/>';
      for (let i = 0; i < ore; i++) cart += '<circle cx="' + (-40 + (i % 3) * 40) + '" cy="' + (-58 - Math.floor(i / 3) * 18) + '" r="14" fill="#8a8073" stroke="' + INK + '" stroke-width="2.6"/>';
      s += cart + '</g>';
      s += '<path d="M120 560h240M120 578h240" stroke="#3b332b" stroke-width="6"/>';
      // Picks on the wall for the crew of three.
      for (let i = 0; i < 3; i++) s += '<g transform="translate(' + (90 + i * 64) + ',230) rotate(' + (i * 8 - 8) + ')"><rect x="-4" y="-44" width="8" height="58" rx="3" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/><path d="M-26 -44q26 -16 52 0" stroke="#8a8073" stroke-width="7" fill="none"/></g>';
      s += crew([[420, 512, 1, 'work', '#7b8a94'], [560, 524, 1, 'work', '#8a986b'], [680, 516, 1, 'stand', '#a07a8a']], view, 1);
      return s;
    },
    cottages: function(view) {
      let s = wall();
      s += beam();
      // Three windows, one per cottage of the row — lit as folk move in.
      for (let i = 0; i < 3; i++) {
        s += window_(160 + i * 240, 200, 130, 120);
        if (i < view.level) s += '<circle cx="' + (160 + i * 240) + '" cy="200" r="60" fill="url(#bi-gold)" opacity=".28"/>';
      }
      s += floor();
      // The shared washing line: a row that lives together.
      s += '<path d="M100 330q300 44 600 0" stroke="' + CREAM + '" stroke-width="3" fill="none" opacity=".8"/>';
      for (let i = 0; i < 4; i++) s += '<g transform="translate(' + (190 + i * 140) + ',' + (348 + (i % 2) * 8) + ')"><rect x="-20" y="0" width="40" height="34" rx="4" fill="' + (i % 2 ? TEAL : '#8a2f2a') + '" opacity=".85" stroke="' + INK + '" stroke-width="2.2"><animateTransform attributeName="transform" type="skewX" values="0;5;0;-4;0" dur="' + (4 + i) + 's" repeatCount="indefinite"/></rect></g>';
      s += table(320, 460, 170, 24);
      s += '<ellipse cx="405" cy="466" rx="22" ry="8" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2"/>';
      s += villager(240, 516, 1, 'stand', '#a07a8a') + villager(500, 520, 0.95, 'sit', '#8a986b');
      if (view.level >= 2) s += villager(620, 508, 0.9, 'stand', '#7b8a94');
      if (view.level >= 3) s += villager(140, 524, 0.85, 'sit', '#b07a48');
      s += lantern(400, 116, 1);
      return s;
    },
    tavern: function(view) {
      let s = wall(0.2);
      s += beam();
      // The bar, the kegs, the evening glow. Cheer by the mugful.
      s += '<g transform="translate(560,350)"><rect x="-190" y="0" width="380" height="26" rx="8" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/><rect x="-180" y="26" width="360" height="96" fill="#31210f" stroke="' + INK + '" stroke-width="3"/><path d="M-120 26v96M-40 26v96M40 26v96M120 26v96" stroke="#241708" stroke-width="4"/></g>';
      for (let i = 0; i < 3; i++) s += barrel(430 + i * 120, 340, 1.05);
      for (let i = 0; i < 4; i++) s += '<g transform="translate(' + (420 + i * 88) + ',344)"><rect x="-10" y="-18" width="20" height="18" rx="4" fill="#c8a24f" stroke="' + INK + '" stroke-width="2.2"/><path d="M10 -14q10 4 0 10" stroke="' + INK + '" stroke-width="2.4" fill="none"/><path d="M-6 -18q4 -8 12 0" stroke="' + CREAM + '" stroke-width="3" fill="none" opacity=".8"/></g>';
      s += window_(160, 200, 140, 130);
      // The skittles corner — the games the whole village argues over.
      s += floor(476);
      s += '<g transform="translate(170,520)">';
      for (let i = 0; i < 4; i++) s += '<g transform="translate(' + ((i % 3) * 26 - 26 + Math.floor(i / 3) * 13) + ',' + (Math.floor(i / 3) * -20) + ')"><path d="M-7 0q-3 -26 7 -34q10 8 7 34z" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.4"/></g>';
      s += '<circle cx="-70" cy="-6" r="12" fill="#8a5a34" stroke="' + INK + '" stroke-width="2.6"/></g>';
      s += table(340, 500, 150, 22);
      s += villager(300, 546, 1, 'sit', '#a07a8a') + villager(520, 550, 1, 'sit', '#8a986b') + villager(640, 470, 1.05, 'stand', '#7b8a94');
      s += lantern(400, 120, 1) + lantern(660, 130, 0.85);
      return s;
    },
    chapel: function(view) {
      let s = stoneWall();
      s += beam();
      // The round window pours quiet colour over the pews.
      const id = 'bi-rose' + (++uid);
      s += '<circle cx="400" cy="180" r="86" fill="#17100a"/><clipPath id="' + id + '"><circle cx="400" cy="180" r="72"/></clipPath>'
        + '<g clip-path="url(#' + id + ')"><rect x="328" y="108" width="144" height="144" fill="url(#bi-day)"/><path d="M400 108v144M328 180h144M350 130l100 100M450 130l-100 100" stroke="#17100a" stroke-width="7"/><circle cx="400" cy="180" r="24" fill="' + GOLDHI + '" opacity=".7"/></g>'
        + '<circle cx="400" cy="180" r="86" fill="none" stroke="' + TRIM + '" stroke-width="6"/>';
      s += '<polygon points="400,270 340,452 460,452" fill="' + GOLDHI + '" opacity=".08"/>';
      // The altar and its candles.
      s += floor();
      s += '<g transform="translate(400,430)"><rect x="-80" y="-56" width="160" height="56" rx="6" fill="#5a5348" stroke="' + INK + '" stroke-width="3"/><rect x="-90" y="-64" width="180" height="12" rx="4" fill="#6e675c" stroke="' + INK + '" stroke-width="2.6"/>';
      for (const cx of [-50, 0, 50]) s += '<rect x="' + (cx - 4) + '" y="-96" width="8" height="30" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="1.8"/><path d="M' + (cx - 3) + ' -102q3 -8 6 0q-1 6 -3 6t-3 -6z" fill="' + GOLDHI + '"><animate attributeName="opacity" values=".7;1;.75;1;.7" dur="2.4s" repeatCount="indefinite"/></path><circle cx="' + cx + '" cy="-100" r="16" fill="url(#bi-gold)" opacity=".5"/>';
      s += '</g>';
      // Pews, and the bell rope in the corner.
      for (let i = 0; i < 2; i++) s += '<g transform="translate(' + (210 + i * 60) + ',' + (500 + i * 34) + ')">' + table(0, 0, 130, 16, 18) + '</g>' + '<g transform="translate(' + (460 + i * 60) + ',' + (500 + i * 34) + ')">' + table(0, 0, 130, 16, 18) + '</g>';
      s += '<path d="M740 46v220" stroke="#8a6f4a" stroke-width="5"/><circle cx="740" cy="276" r="12" fill="#8a6a3a" stroke="' + INK + '" stroke-width="2.6"/>';
      s += crew([[330, 546, 1, 'stand', '#7b8a94']], view, 1);
      s += villager(560, 552, 0.95, 'sit', '#a07a8a');
      return s;
    },
    lumber: function(view) {
      let s = wall(0.14);
      s += beam();
      s += window_(170, 190, 150, 130);
      // The saw pit: a camp that cuts by the cartload, not the armful.
      s += floor(440);
      s += '<g transform="translate(430,420)"><rect x="-170" y="0" width="340" height="34" fill="#31210f" stroke="' + INK + '" stroke-width="3"/><rect x="-150" y="-18" width="300" height="18" fill="#8a6a3a" stroke="' + INK + '" stroke-width="3"/><circle cx="-150" cy="-30" r="30" fill="#a8794a" stroke="' + INK + '" stroke-width="3"/><circle cx="-150" cy="-30" r="18" fill="#8a6a3a"/><path d="M-120 -24h270" stroke="#8a8073" stroke-width="6"/><path d="M-100 -24l6 8M-60 -24l6 8M-20 -24l6 8M20 -24l6 8M60 -24l6 8M100 -24l6 8" stroke="#8a8073" stroke-width="3"/></g>';
      // Planks seasoned and stacked — the camp's whole point.
      const planks = Math.max(2, Math.round(2 + view.storeFill * 4));
      for (let i = 0; i < planks; i++) s += '<rect x="580" y="' + (540 - i * 18) + '" width="180" height="14" rx="4" fill="' + (i % 2 ? '#a8794a' : '#8a6a3a') + '" stroke="' + INK + '" stroke-width="2.4" transform="rotate(' + (i % 2 ? -1.5 : 1) + ' 670 ' + (540 - i * 18) + ')"/>';
      s += '<g transform="translate(300,290) rotate(-38)"><rect x="-5" y="-58" width="10" height="72" rx="4" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/><path d="M-24 -58q24 -20 48 0l-9 20q-15 -11 -30 0z" fill="#8a8073" stroke="' + INK + '" stroke-width="2.6"/></g>';
      s += crew([[260, 512, 1.05, 'work', '#8a986b']], view, 1);
      s += lantern(650, 120, 0.9);
      return s;
    },
    quarry: function(view) {
      // Open to the rock face: a quarry's "room" is the cut itself.
      let s = '<rect width="800" height="600" fill="url(#bi-day)"/>';
      s += '<path d="M0 90q120 -40 240 -10t260 -12 300 14v518H0z" fill="url(#bi-stone)"/>';
      for (let row = 0; row < 5; row++) {
        const y = 140 + row * 74, off = row % 2 ? 60 : 0;
        s += '<path d="M0 ' + y + 'h800" stroke="#332e27" stroke-width="5" opacity=".8"/>';
        for (let c = 0; c < 8; c++) s += '<path d="M' + (off + c * 120) + ' ' + y + 'v74" stroke="#332e27" stroke-width="4" opacity=".7"/>';
      }
      // The working ledge and the blocks already cut.
      s += '<path d="M0 452h800v148H0z" fill="#5a5348"/><path d="M0 452h800" stroke="#332e27" stroke-width="6"/>';
      const blocks = Math.max(1, Math.round(1 + view.storeFill * 4));
      for (let i = 0; i < blocks; i++) s += '<g transform="translate(' + (560 + (i % 2) * 96) + ',' + (556 - Math.floor(i / 2) * 60) + ')"><rect x="-42" y="-46" width="84" height="46" fill="#8a8073" stroke="' + INK + '" stroke-width="3"/><path d="M-42 -46l12 -12h84l-12 12" fill="#a09a8c" stroke="' + INK + '" stroke-width="2.6"/></g>';
      // Storm glass glints in the fresh cut — the quarry's rare find.
      s += '<path d="M300 300l10 -18 10 18 -10 14z" fill="#8fd0da" opacity=".9"><animate attributeName="opacity" values=".5;1;.5" dur="3.6s" repeatCount="indefinite"/></path>';
      s += '<g transform="translate(190,420) rotate(-16)"><rect x="-4" y="-46" width="8" height="58" rx="3" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/><path d="M-26 -46q26 -16 52 0" stroke="#8a8073" stroke-width="7" fill="none"/></g>';
      s += '<g transform="translate(360,470)"><path d="M-40 -20h80l-12 20h-56z" fill="#4a4238" stroke="' + INK + '" stroke-width="3"/><circle cx="-22" cy="8" r="12" fill="#241708" stroke="' + INK + '" stroke-width="2.6"/><circle cx="22" cy="8" r="12" fill="#241708" stroke="' + INK + '" stroke-width="2.6"/></g>';
      s += crew([[250, 520, 1.05, 'work', '#7b8a94']], view, 1);
      return s;
    },
    market: function(view) {
      let s = wall(0.2);
      s += beam();
      // Two stalls under striped awnings — trade under one roof.
      for (let i = 0; i < 2; i++) {
        const x = 210 + i * 380;
        s += '<g transform="translate(' + x + ',330)">';
        s += '<path d="M-130 -110h260l-18 44h-224z" fill="' + (i ? TEAL : '#8a2f2a') + '" stroke="' + INK + '" stroke-width="3"/>';
        for (let st = 0; st < 5; st++) s += '<path d="M' + (-130 + 52 * st + 10) + ' -110l' + (st * 1 + 14) + ' 44" stroke="' + CREAM + '" stroke-width="9" opacity=".85"/>';
        s += '<rect x="-120" y="20" width="240" height="24" rx="6" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/><rect x="-110" y="44" width="220" height="66" fill="#31210f" stroke="' + INK + '" stroke-width="3"/></g>';
      }
      // The scales that price a fair day's trade.
      s += '<g transform="translate(400,340)"><path d="M0 -60v70" stroke="#8a8073" stroke-width="5"/><path d="M-52 -46q52 -22 104 0" stroke="#8a8073" stroke-width="4" fill="none"/><path d="M-52 -46v14M52 -46v14" stroke="#8a8073" stroke-width="3"/><path d="M-68 -32q16 16 32 0z" fill="#c8a24f" stroke="' + INK + '" stroke-width="2.4"/><path d="M36 -32q16 16 32 0z" fill="#c8a24f" stroke="' + INK + '" stroke-width="2.4"/></g>';
      // Reed bundles and berry crates: what the traders bring in.
      for (let i = 0; i < 3; i++) s += '<g transform="translate(' + (150 + i * 40) + ',352)"><path d="M-8 0q-2 -44 8 -56q10 12 8 56z" fill="#9aa86b" stroke="' + INK + '" stroke-width="2.2"/></g>';
      s += floor(470);
      const crates = Math.max(1, Math.round(1 + view.storeFill * 3));
      for (let i = 0; i < crates; i++) s += crate(560 + (i % 2) * 60, 566 - Math.floor(i / 2) * 44, 1.05);
      s += '<g transform="translate(590,522)"><circle cx="-8" cy="-4" r="5" fill="#5a3a7a"/><circle cx="4" cy="-8" r="5" fill="#7a2f4a"/><circle cx="0" cy="2" r="5" fill="#5a3a7a"/></g>';
      s += crew([[290, 520, 1.05, 'stand', '#b07a48']], view, 1);
      s += villager(450, 528, 0.95, 'stand', '#a07a8a');
      s += lantern(400, 118, 1);
      return s;
    },
    storehouse: function(view) {
      let s = wall(0.12);
      s += beam();
      // Deep shelves, honest stock. The cellar never lies.
      for (let row = 0; row < 3; row++) {
        const y = 190 + row * 96;
        s += shelf(90, y, 620);
        const stocked = Math.round((620 / 78) * view.storeFill);
        for (let i = 0; i < 8; i++) {
          if (i < stocked) s += i % 3 === 0 ? barrel(130 + i * 78, y - 2, 0.72) : sack(130 + i * 78, y - 2, 0.8, i % 2 ? '#b98c3e' : '#8a6f4a');
        }
      }
      s += floor(482);
      s += barrel(160, 566, 1.15) + crate(260, 566, 1.1);
      // The tally desk: every sack signed in and out.
      s += table(480, 500, 170, 24);
      s += '<g transform="translate(560,492)"><rect x="-26" y="-16" width="52" height="20" rx="3" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.2"/><path d="M-18 -8h36M-18 -2h28" stroke="#6b4a26" stroke-width="2"/><path d="M30 -20q10 -8 8 -18" stroke="#8a8073" stroke-width="3" fill="none"/></g>';
      s += villager(660, 546, 1, 'work', '#7b8a94');
      s += lantern(400, 118, 1);
      return s;
    },
    foundry: function(view) {
      let s = stoneWall();
      s += beam();
      // The furnace: the town's one truly hungry mouth.
      s += '<g transform="translate(240,452)"><path d="M-110 0v-210q0 -60 110 -60t110 60v210z" fill="#453f36" stroke="' + INK + '" stroke-width="4"/><path d="M-70 0v-110q0 -46 70 -46t70 46v110z" fill="#17100a"/><path d="M-34 -8q-14 -52 20 -76q-4 26 16 40q6 -16 16 -20q8 34 -18 54q-20 14 -34 2z" fill="url(#bi-fire)"><animate attributeName="opacity" values=".85;1;.8;1;.85" dur="1.6s" repeatCount="indefinite"/></path><circle cx="0" cy="-60" r="90" fill="url(#bi-gold)" opacity=".5"/><rect x="-24" y="-286" width="48" height="80" fill="#453f36" stroke="' + INK + '" stroke-width="3.4"/></g>';
      // The pour: grit in, clean ingots out.
      s += '<g transform="translate(520,400)"><path d="M-40 -30l80 12l-10 26l-76 -12z" fill="#5a5348" stroke="' + INK + '" stroke-width="3"/><path d="M30 -12q14 20 10 44" stroke="' + GOLDHI + '" stroke-width="6" fill="none"><animate attributeName="opacity" values="1;.5;1" dur="1.4s" repeatCount="indefinite"/></path></g>';
      s += floor(452);
      const ingots = Math.max(1, Math.round(1 + view.storeFill * 5));
      for (let i = 0; i < ingots; i++) s += '<g transform="translate(' + (560 + (i % 3) * 66) + ',' + (540 - Math.floor(i / 3) * 30) + ')"><path d="M-26 0l6 -18h40l6 18z" fill="#8f959c" stroke="' + INK + '" stroke-width="2.6"/><path d="M-16 -12h32" stroke="' + CREAM + '" stroke-width="2" opacity=".6"/></g>';
      s += '<g transform="translate(430,300) rotate(20)"><rect x="-5" y="-44" width="10" height="58" rx="4" fill="#6b4a26" stroke="' + INK + '" stroke-width="2"/><rect x="-20" y="-64" width="40" height="24" rx="4" fill="#8a8073" stroke="' + INK + '" stroke-width="2.8"/></g>';
      s += crew([[470, 520, 1.05, 'work', '#7b8a94'], [660, 470, 1, 'work', '#b07a48']], view, 1);
      return s;
    },
    entertainment: function(view) {
      // Three rooms in one house: games yard, playhouse, music hall.
      if (view.level >= 3) {
        let s = stoneWall();
        s += beam();
        // The grand hall: organ pipes and a balcony the realm talks about.
        for (let i = 0; i < 7; i++) s += '<rect x="' + (260 + i * 42) + '" y="' + (120 + Math.abs(i - 3) * 26) + '" width="26" height="' + (240 - Math.abs(i - 3) * 40) + '" rx="9" fill="#8f959c" stroke="' + INK + '" stroke-width="3"/>';
        s += '<path d="M60 140q90 60 0 130M740 140q-90 60 0 130" stroke="' + GOLD + '" stroke-width="6" fill="none"/>';
        s += '<rect x="80" y="330" width="640" height="26" rx="9" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/>';
        s += floor(460);
        s += '<g transform="translate(400,430)"><rect x="-190" y="-24" width="380" height="30" rx="8" fill="#8a2f2a" stroke="' + INK + '" stroke-width="3"/><path d="M-190 -24q190 -30 380 0" stroke="' + GOLDHI + '" stroke-width="4" fill="none"/></g>';
        s += villager(320, 520, 1, 'stand', '#a07a8a') + villager(480, 526, 1, 'stand', '#7b8a94');
        s += crew([[620, 516, 1, 'work', '#b07a48']], view, 1);
        s += lantern(160, 130, 1) + lantern(640, 130, 1);
        return s;
      }
      if (view.level === 2) {
        let s = wall(0.2);
        s += beam();
        // The playhouse: a real stage, real curtains, a travelling bard.
        s += '<g transform="translate(400,300)"><rect x="-240" y="-160" width="480" height="200" rx="10" fill="#241708" stroke="' + INK + '" stroke-width="4"/><path d="M-240 -160q60 90 60 200M240 -160q-60 90 -60 200" fill="#8a2f2a" stroke="' + INK + '" stroke-width="3"/><path d="M-240 -160h480" stroke="' + GOLDHI + '" stroke-width="5"/><circle cx="0" cy="-30" r="70" fill="url(#bi-gold)" opacity=".4"/>';
        s += '<g transform="translate(0,20)"><path d="M-8 26v22M8 26v22" stroke="#2b1e11" stroke-width="7" stroke-linecap="round"/><path d="M-16 28q-4 -34 16 -38q20 4 16 38q-16 6 -32 0z" fill="#7a5a6b" stroke="' + INK + '" stroke-width="2.6"/><circle cx="0" cy="-20" r="11" fill="#d9b98c" stroke="' + INK + '" stroke-width="2.4"/><path d="M18 6q14 -8 16 -22" stroke="#8a6a3a" stroke-width="4" fill="none"/><path d="M34 -18q6 -4 6 -10" stroke="' + CREAM + '" stroke-width="2.6" fill="none"/></g></g>';
        s += '<rect x="160" y="404" width="480" height="18" rx="6" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/>';
        s += floor(470);
        s += villager(280, 540, 1, 'sit', '#8a986b') + villager(420, 548, 1, 'sit', '#7b8a94');
        s += crew([[620, 520, 1, 'work', '#b07a48']], view, 1);
        s += lantern(140, 124, 0.95);
        return s;
      }
      let s = wall(0.2);
      s += beam();
      // The tavern & games yard: skittles, darts and decent ale.
      s += window_(620, 190, 150, 130);
      s += '<g transform="translate(300,320)"><rect x="-150" y="0" width="300" height="24" rx="8" fill="#4a3418" stroke="' + INK + '" stroke-width="3"/><rect x="-140" y="24" width="280" height="86" fill="#31210f" stroke="' + INK + '" stroke-width="3"/></g>';
      s += barrel(200, 312, 1) + barrel(330, 312, 1);
      s += '<g transform="translate(560,300)"><circle r="52" fill="#8a6f4a" stroke="' + INK + '" stroke-width="3"/><circle r="36" fill="' + CREAM + '"/><circle r="20" fill="#8a2f2a"/><circle r="7" fill="' + GOLDHI + '"/><path d="M-4 -66l8 20l-8 4z" fill="#52646b" stroke="' + INK + '" stroke-width="2"/></g>';
      s += floor(470);
      s += '<g transform="translate(180,530)">';
      for (let i = 0; i < 5; i++) s += '<g transform="translate(' + ((i % 3) * 26 - 26 + Math.floor(i / 3) * 13) + ',' + (Math.floor(i / 3) * -22) + ')"><path d="M-7 0q-3 -26 7 -34q10 8 7 34z" fill="' + CREAM + '" stroke="' + INK + '" stroke-width="2.4"/></g>';
      s += '</g>';
      s += villager(380, 540, 1, 'sit', '#a07a8a') + villager(520, 546, 1, 'sit', '#8a986b');
      s += crew([[660, 516, 1, 'work', '#b07a48']], view, 1);
      s += lantern(430, 120, 1);
      return s;
    }
  };

  // ---- The one door in ------------------------------------------------------
  // Renders the room for a view. A plot (level 0) always shows the staked
  // ground; a rising upgrade drapes the finished room in its dust sheets.
  function sceneSVG(view, label) {
    const v = view && view.id ? view : interiorView(view && view.id, view);
    let body;
    if (v.plot) body = plotScene(v);
    else {
      const draw = SCENES[v.id];
      body = draw ? draw(v) : plotScene(v);
      body += plaque(v.level, v.maxLevel);
      if (v.rising) body += risingDressing();
    }
    return wrap(label || 'Building interior', body);
  }

  return {
    INTERIOR_IDS: INTERIOR_IDS,
    interiorView: interiorView,
    sceneSVG: sceneSVG
  };
});
