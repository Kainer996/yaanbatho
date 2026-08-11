// Burbz Village Variation Core — "No Two Villages Alike"
// No-Man's-Sky-style procedural identity for every settlement. A village's
// seed rolls a DNA card — wall build, roof craft, colour washes, trim and
// door paints, window glow, banner cloth — and pure colour maths (HSL
// rotations, golden-angle runs) turns one base palette into that village's
// own coat of paint. The same maths also replays a village's opening dice
// (palette, size, plan) so the Town Square can draw each district as the
// real village it is. Pure logic: no DOM, deterministic, UMD export.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzVillageVariationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // The same mulberry32 the game's villageRngFrom uses — bit for bit, so a
  // plan replayed here lands on the exact scene the village screen builds.
  function villageRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function frac(v) { return v - Math.floor(v); }

  // ---------------------------------------------------------------------------
  // Colour maths — integer hex in, integer hex out
  // ---------------------------------------------------------------------------
  function hexToHsl(hex) {
    const v = hex >>> 0;
    const r = ((v >> 16) & 255) / 255, g = ((v >> 8) & 255) / 255, b = (v & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
    return { h, s, l };
  }

  function hslToHex(h, s, l) {
    h = frac(h); s = clamp01(s); l = clamp01(l);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const chan = t => {
      t = frac(t);
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const to255 = v => Math.round(clamp01(v) * 255);
    return (to255(chan(h + 1 / 3)) << 16) | (to255(chan(h)) << 8) | to255(chan(h - 1 / 3));
  }

  // Rotate a colour's hue and nudge its saturation/lightness — the workhorse
  // that keeps a whole palette in key while every village sings its own note.
  function shiftHex(hex, dh, ds, dl) {
    const c = hexToHsl(hex);
    return hslToHex(c.h + (dh || 0), c.s + (ds || 0), c.l + (dl || 0));
  }

  function mixHex(a, b, t) {
    t = clamp01(t);
    const av = a >>> 0, bv = b >>> 0;
    const ch = shift => Math.round(((av >> shift) & 255) + (((bv >> shift) & 255) - ((av >> shift) & 255)) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  }

  function hexToRgbString(hex) {
    const v = hex >>> 0;
    return ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255);
  }

  // ---------------------------------------------------------------------------
  // The DNA card
  // ---------------------------------------------------------------------------
  // The golden angle as a fraction of a turn: successive steps never repeat
  // and never cluster — the sunflower trick, applied to paint.
  const GOLDEN_ANGLE = 0.38196601125;

  const WALL_STYLES = ['timber', 'stone', 'brick', 'painted'];
  const ROOF_STYLES = ['thatch', 'slate', 'tile', 'shingle'];

  // Each roof craft draws its colours from its own hue band. A run walks the
  // band by golden-angle steps from the village's own base hue, so every
  // roofline is a related family of colours no other village repeats.
  const ROOF_BANDS = {
    thatch: { lo: 0.07, hi: 0.13, sLo: 0.30, sHi: 0.46, lLo: 0.26, lHi: 0.42 },
    slate: { lo: 0.52, hi: 0.68, sLo: 0.08, sHi: 0.22, lLo: 0.20, lHi: 0.36 },
    tile: { lo: 0.98, hi: 1.07, sLo: 0.38, sHi: 0.56, lLo: 0.28, lHi: 0.42 },
    shingle: { lo: 0.0, hi: 1.0, sLo: 0.24, sHi: 0.44, lLo: 0.22, lHi: 0.40 }
  };

  function roofColorRun(style, baseHue, count, r) {
    const band = ROOF_BANDS[style] || ROOF_BANDS.shingle;
    const out = [];
    for (let i = 0; i < count; i++) {
      const walk = frac(baseHue + i * GOLDEN_ANGLE);
      const h = band.lo + walk * (band.hi - band.lo);
      const s = band.sLo + r() * (band.sHi - band.sLo);
      const l = band.lLo + r() * (band.lHi - band.lLo);
      out.push(hslToHex(h, s, l));
    }
    return out;
  }

  // A village's identity card. Same seed, same card, forever.
  function villageDNA(seed) {
    const r = villageRng(((seed >>> 0) ^ 0x9E3779B9) >>> 0);
    const hueShift = (r() - 0.5) * 0.16;
    const satShift = (r() - 0.5) * 0.12;
    const lightShift = (r() - 0.5) * 0.08;

    const wallRoll = r();
    const wallStyle = wallRoll < 0.38 ? 'timber' : wallRoll < 0.60 ? 'stone' : wallRoll < 0.76 ? 'brick' : 'painted';
    const roofRoll = r();
    const roofStyle = roofRoll < 0.26 ? 'thatch' : roofRoll < 0.52 ? 'slate' : roofRoll < 0.76 ? 'tile' : 'shingle';

    // The wash: a painted village commits to a real colour — Suffolk pink,
    // sage, cornflower; everyone else keeps a gentler lime-washed cream.
    const washHue = wallStyle === 'painted' ? r() : 0.08 + r() * 0.07;
    const washSat = wallStyle === 'painted' ? 0.26 + r() * 0.24 : 0.14 + r() * 0.14;
    const washLight = wallStyle === 'painted' ? 0.60 + r() * 0.18 : 0.66 + r() * 0.14;
    const plasterWash = hslToHex(washHue, washSat, washLight);

    const roofBaseHue = r();
    const roofs = roofColorRun(roofStyle, roofBaseHue, 6, r);

    // Trim and door: two saturated accents a golden angle apart, so shutters
    // and doors always agree without ever matching another village's pair.
    const trimHue = frac(roofBaseHue + 0.5 + (r() - 0.5) * 0.2);
    const trim = hslToHex(trimHue, 0.42 + r() * 0.26, 0.36 + r() * 0.16);
    const door = hslToHex(frac(trimHue + GOLDEN_ANGLE), 0.40 + r() * 0.28, 0.30 + r() * 0.18);

    // Window glow: candlelight in most villages, but some keep cooler
    // lamps — sea-glass green, violet oil — so streets read differently.
    const coolGlow = r() < 0.14;
    const glowHex = coolGlow
      ? hslToHex(0.42 + r() * 0.28, 0.55 + r() * 0.25, 0.68 + r() * 0.10)
      : hslToHex(0.07 + r() * 0.07, 0.72 + r() * 0.22, 0.66 + r() * 0.12);
    const windowGlow = { hex: glowHex, rgb: hexToRgbString(glowHex) };

    // Banner cloth: bunting, ribbons and pennants dyed in the village's own
    // two festival colours.
    const bannerHue = frac(trimHue + GOLDEN_ANGLE * 2);
    const banners = [
      hslToHex(bannerHue, 0.52 + r() * 0.28, 0.46 + r() * 0.14),
      hslToHex(frac(bannerHue + GOLDEN_ANGLE), 0.52 + r() * 0.28, 0.46 + r() * 0.14)
    ];

    // Character dials the builders read as they raise each house.
    const crookedness = r(); // how drunk the timbers lean
    const prosperity = r(); // window boxes, bunting, lantern strings

    return {
      seed: seed >>> 0,
      hueShift, satShift, lightShift,
      wallStyle, roofStyle,
      plasterWash, roofBaseHue, roofs,
      trim, door, windowGlow, banners,
      crookedness, prosperity
    };
  }

  // Re-key a base palette in the village's own DNA. Every structural key the
  // scene builders read survives; only the colours move.
  function varyPalette(pal, dna) {
    if (!pal || !dna) return pal;
    return Object.assign({}, pal, {
      sky: shiftHex(pal.sky, dna.hueShift * 0.35, 0, 0),
      ground: shiftHex(pal.ground, dna.hueShift * 0.6, dna.satShift * 0.5, dna.lightShift * 0.5),
      leaf: shiftHex(pal.leaf || 0x2c3a18, dna.hueShift * 0.8, dna.satShift * 0.6, dna.lightShift * 0.6),
      plaster: dna.wallStyle === 'painted' ? dna.plasterWash : mixHex(pal.plaster, dna.plasterWash, 0.45),
      timber: shiftHex(pal.timber, dna.hueShift * 0.4, 0, dna.lightShift * 0.6),
      stone: shiftHex(pal.stone, dna.hueShift * 0.5, dna.satShift * 0.4, dna.lightShift * 0.7),
      hemiSky: shiftHex(pal.hemiSky, dna.hueShift * 0.35, 0, 0),
      hemiGround: shiftHex(pal.hemiGround, dna.hueShift * 0.5, 0, 0),
      roofs: dna.roofs.slice(),
      dna
    });
  }

  // ---------------------------------------------------------------------------
  // The opening dice, replayed
  // ---------------------------------------------------------------------------
  // buildVillageScene rolls its identity in a fixed order: palette, size,
  // plan. This replays those three draws exactly, so any other screen — the
  // Town Square above all — can know which village it is looking at.
  function villagePlan(seed, paletteCount) {
    const r = villageRng(seed);
    const bank = Math.max(1, Math.floor(paletteCount) || 1);
    const paletteIndex = Math.floor(r() * bank);
    const sizeRoll = r();
    const tier = sizeRoll < 0.34 ? 0 : sizeRoll < 0.74 ? 1 : 2; // hamlet · village · town
    const layoutRoll = r();
    const layout = layoutRoll < 0.22 ? 'green' : layoutRoll < 0.42 ? 'crossroads' : layoutRoll < 0.62 ? 'riverside' : layoutRoll < 0.82 ? 'lane' : 'hamlet';
    return { paletteIndex, sizeRoll, tier, layoutRoll, layout };
  }

  // One call for a whole district: the village's plan, its DNA and its
  // re-keyed palette from the given palette bank.
  function districtIdentity(seed, paletteBank) {
    const bank = Array.isArray(paletteBank) && paletteBank.length ? paletteBank : [{}];
    const plan = villagePlan(seed, bank.length);
    const dna = villageDNA(seed);
    return { plan, dna, palette: varyPalette(bank[plan.paletteIndex % bank.length], dna) };
  }

  return {
    GOLDEN_ANGLE, WALL_STYLES, ROOF_STYLES, ROOF_BANDS,
    villageRng, hexToHsl, hslToHex, shiftHex, mixHex, hexToRgbString,
    roofColorRun, villageDNA, varyPalette, villagePlan, districtIdentity
  };
});
