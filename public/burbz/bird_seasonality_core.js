/* ============================================================================
   BURBZ - Bird seasonality & detectability engine
   ----------------------------------------------------------------------------
   Separates SEASONAL AVAILABILITY from RARITY.

   Historically the "Area Birds" panel labelled every species by a single
   all-time global commonness score (realWorldRarityLabel). That score is a
   property of the species, not of the here-and-now: it happily showed a
   winter-only duck like Eurasian Wigeon as "Regular" on 1 August, and it
   never removed a species that simply cannot be present this week.

   This module computes a CANDIDATE PROBABILITY for a species at a moment and
   place:

       p = localOccurrence x weekProbability x habitatMatch x detectability

   - localOccurrence : how likely the species is at a suitable local spot,
                       independent of season (0..1).
   - weekProbability : week-of-year phenology (migration / residency), 0..1.
   - habitatMatch    : does the local habitat suit the species, 0..1.
   - detectability   : time-of-day conspicuousness (crepuscular / nocturnal
                       birds are near-invisible at midday), 0..1.

   Exclusion is driven by SEASON and HABITAT, never by rarity: when the
   week-of-year probability (or the habitat match) is effectively zero the
   species is dropped from the spawn list entirely rather than being called
   "uncommon". Time-of-day only dims a species (Woodcock is Rare by day and
   dusk-only Uncommon); it never excludes.

   Usable both in the browser (window.BurbzSeasonality) and under node
   (module.exports) so it can be unit-tested directly.
   ========================================================================== */
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  if (root) root.BurbzSeasonality = engine;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // --- Label bands, keyed on the candidate probability p (0..1). ------------
  // These share the game's five-tier vocabulary (common/regular/uncommon/
  // scarce/rare) so existing rarity CSS keeps working. ABSENT is below the
  // rare floor: the species is not offered at all.
  const BANDS = [
    { label: 'common', min: 0.55 },
    { label: 'regular', min: 0.30 },
    { label: 'uncommon', min: 0.13 },
    { label: 'scarce', min: 0.045 },
    { label: 'rare', min: 0.012 }
  ];
  const PRESENCE_FLOOR = 0.012; // p below this == effectively absent.

  function rarityLabelForProbability(p) {
    for (const band of BANDS) if (p >= band.min) return band.label;
    return 'absent';
  }

  // --- Week of year (1..53) -------------------------------------------------
  function weekOfYear(date) {
    const d = date instanceof Date ? date : new Date(date || Date.now());
    const start = new Date(d.getFullYear(), 0, 1);
    const day = Math.floor((d - start) / 86400000) + 1; // 1-based day of year
    return Math.max(1, Math.min(53, Math.ceil(day / 7)));
  }

  const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

  // Circular distance between two weeks on a 52-week ring (0..26).
  function weekGap(a, b) {
    let g = Math.abs(a - b) % 52;
    return g > 26 ? 52 - g : g;
  }

  // A soft plateau window on the 52-week ring. Full strength inside
  // [start..end] (inclusive, wrapping when start > end), linearly ramping to
  // zero over `ramp` weeks on each shoulder.
  function ringWindow(week, start, end, ramp) {
    const inside = (w, s, e) => (s <= e ? (w >= s && w <= e) : (w >= s || w <= e));
    if (inside(week, start, end)) return 1;
    const dStart = weekGap(week, start);
    const dEnd = weekGap(week, end);
    const d = Math.min(dStart, dEnd);
    return clamp01(1 - d / ramp);
  }

  // --- Week-of-year phenology per migratory status --------------------------
  // Weeks: ~ wk1 = early Jan, wk18 = early May, wk31 = early Aug, wk44 = early
  // Nov. All curves live on the 52-week ring so winter wraps the year end.
  const STATUS_CURVES = {
    // Present all year; a mild late-summer moult/quiet dip and a shallow
    // deep-winter dip keep residents high but not pinned at 1.0.
    resident(week) {
      let base = 0.9;
      if (week >= 11 && week <= 22) base = 0.98;       // spring song peak
      else if (week >= 28 && week <= 36) base = 0.85;  // late-summer moult / quiet
      else if (week >= 48 || week <= 4) base = 0.86;   // hard midwinter
      return base;
    },
    // Summer migrant / migrant breeder: Africa in winter, here ~Apr-Sep.
    summer(week) {
      return ringWindow(week, 16, 35, 4); // plateau early May-early Sep
    },
    // Like summer but a fraction now overwinter (Blackcap, Chiffchaff): keep a
    // small winter floor so they are scarce-not-absent off season.
    partial_summer(week) {
      return Math.max(0.15, ringWindow(week, 16, 35, 4));
    },
    // Winter visitor: breeds in the far north, here ~Oct-Mar, gone in summer.
    winter(week) {
      return ringWindow(week, 44, 8, 4); // plateau early Nov-late Feb
    },
    // Irruptive winter visitor (Waxwing): winter-only AND not every year, so
    // scale the winter window down. Summer is a hard zero.
    irruptive(week) {
      return 0.5 * ringWindow(week, 46, 6, 3);
    },
    // Passage migrant: spring and autumn peaks, thin in mid-summer/mid-winter.
    passage(week) {
      const spring = ringWindow(week, 13, 18, 3);
      const autumn = ringWindow(week, 33, 41, 3);
      return Math.max(spring, autumn);
    }
  };

  function weekProbability(status, week) {
    const curve = STATUS_CURVES[status] || STATUS_CURVES.resident;
    return clamp01(curve(week));
  }

  // --- Detectability by time of day -----------------------------------------
  // hour is 0..23. Diurnal birds vanish at night; crepuscular birds (Woodcock)
  // are near-invisible at midday but active at dawn/dusk; nocturnal birds
  // (owls) invert that.
  function triSlot(hour, { dawn, day, dusk, night }) {
    // Smooth-ish piecewise across the day. Values are conspicuousness 0..1.
    if (hour >= 5 && hour < 8) return dawn;
    if (hour >= 8 && hour < 17) return day;
    if (hour >= 17 && hour < 22) return dusk;
    return night; // 22:00-05:00
  }
  const DETECT_PROFILES = {
    diurnal: h => triSlot(h, { dawn: 1.0, day: 1.0, dusk: 0.7, night: 0.15 }),
    aerial: h => triSlot(h, { dawn: 0.8, day: 1.0, dusk: 0.75, night: 0.1 }),
    crepuscular: h => triSlot(h, { dawn: 0.75, day: 0.12, dusk: 0.85, night: 0.3 }),
    nocturnal: h => triSlot(h, { dawn: 0.5, day: 0.12, dusk: 0.7, night: 1.0 })
  };
  function detectability(detect, hour) {
    const fn = DETECT_PROFILES[detect] || DETECT_PROFILES.diurnal;
    const h = Number.isFinite(Number(hour)) ? ((Number(hour) % 24) + 24) % 24 : 12;
    return clamp01(fn(h));
  }

  // --- Explicit phenology table --------------------------------------------
  // Authoritative for named species and the well-known British migrants.
  // `occ` is the baseline local occurrence in prime habitat & season (0..1) --
  // deliberately NOT the all-time commonness score, because scarce wide-
  // ranging birds (Hobby) have a low chance at any one local spot even at
  // peak. `micro` marks a species tied to a micro-habitat (a waterbody /
  // coast) so it is excluded away from it. `edge` marks farmland/scrub-edge
  // birds. Sources: BTO BirdFacts phenology & status.
  const PHENOLOGY = {
    // -- The seven Delamere-in-early-August reference species --------------
    'Mistle Thrush': { status: 'resident', occ: 0.58, detect: 'diurnal', habitats: ['woodland', 'park', 'grassland', 'farmland'] },
    'Woodcock': { status: 'resident', occ: 0.40, detect: 'crepuscular', habitats: ['woodland', 'wetland'] },
    'Hobby': { status: 'summer', occ: 0.22, detect: 'aerial', habitats: ['wetland', 'grassland', 'woodland', 'farmland', 'water'] },
    'Mediterranean Gull': { status: 'resident', occ: 0.22, detect: 'diurnal', habitats: ['water', 'wetland', 'coast', 'urban'], micro: 'waterbody' },
    'Yellowhammer': { status: 'resident', occ: 0.34, detect: 'diurnal', habitats: ['farmland', 'grassland', 'heath'], edge: true },
    'Eurasian Wigeon': { status: 'winter', occ: 0.60, detect: 'diurnal', habitats: ['water', 'wetland', 'coast'], micro: 'waterbody' },
    'Bohemian Waxwing': { status: 'irruptive', occ: 0.45, detect: 'diurnal', habitats: ['urban', 'park', 'woodland'] },

    // -- Other common British winter visitors (gone in high summer) --------
    'Redwing': { status: 'winter', occ: 0.55, detect: 'diurnal', habitats: ['woodland', 'farmland', 'park', 'grassland'] },
    'Fieldfare': { status: 'winter', occ: 0.55, detect: 'diurnal', habitats: ['farmland', 'grassland', 'woodland'] },
    'Brambling': { status: 'winter', occ: 0.4, detect: 'diurnal', habitats: ['woodland', 'farmland', 'park'] },
    'Whooper Swan': { status: 'winter', occ: 0.35, detect: 'diurnal', habitats: ['water', 'wetland', 'farmland'], micro: 'waterbody' },
    'Bewick\'s Swan': { status: 'winter', occ: 0.3, detect: 'diurnal', habitats: ['water', 'wetland', 'farmland'], micro: 'waterbody' },
    'Pink-footed Goose': { status: 'winter', occ: 0.45, detect: 'diurnal', habitats: ['farmland', 'wetland', 'water', 'coast'] },
    'Barnacle Goose': { status: 'winter', occ: 0.35, detect: 'diurnal', habitats: ['coast', 'wetland', 'grassland'] },
    'Brent Goose': { status: 'winter', occ: 0.35, detect: 'diurnal', habitats: ['coast', 'wetland'], micro: 'coast' },
    'Northern Pintail': { status: 'winter', occ: 0.4, detect: 'diurnal', habitats: ['water', 'wetland'], micro: 'waterbody' },
    'Common Goldeneye': { status: 'winter', occ: 0.4, detect: 'diurnal', habitats: ['water', 'wetland'], micro: 'waterbody' },
    'Common Pochard': { status: 'winter', occ: 0.4, detect: 'diurnal', habitats: ['water', 'wetland'], micro: 'waterbody' },
    'Eurasian Siskin': { status: 'resident', occ: 0.42, detect: 'diurnal', habitats: ['woodland', 'park'] },

    // -- Common British summer migrants (in Africa in winter) --------------
    'Swift': { status: 'summer', occ: 0.7, detect: 'aerial', habitats: ['urban', 'park', 'water', 'wetland', 'grassland', 'farmland'] },
    'Swallow': { status: 'summer', occ: 0.7, detect: 'aerial', habitats: ['farmland', 'grassland', 'wetland', 'water', 'urban'] },
    'House Martin': { status: 'summer', occ: 0.6, detect: 'aerial', habitats: ['urban', 'park', 'farmland', 'water'] },
    'Sand Martin': { status: 'summer', occ: 0.5, detect: 'aerial', habitats: ['water', 'wetland'], micro: 'waterbody' },
    'Cuckoo': { status: 'summer', occ: 0.28, detect: 'diurnal', habitats: ['woodland', 'wetland', 'grassland', 'heath', 'farmland'] },
    'Common Cuckoo': { status: 'summer', occ: 0.28, detect: 'diurnal', habitats: ['woodland', 'wetland', 'grassland', 'heath', 'farmland'] },
    'Chiffchaff': { status: 'partial_summer', occ: 0.6, detect: 'diurnal', habitats: ['woodland', 'park', 'wetland'] },
    'Willow Warbler': { status: 'summer', occ: 0.55, detect: 'diurnal', habitats: ['woodland', 'heath', 'park'] },
    'Blackcap': { status: 'partial_summer', occ: 0.6, detect: 'diurnal', habitats: ['woodland', 'park'] },
    'Garden Warbler': { status: 'summer', occ: 0.4, detect: 'diurnal', habitats: ['woodland', 'park'] },
    'Common Whitethroat': { status: 'summer', occ: 0.5, detect: 'diurnal', habitats: ['farmland', 'grassland', 'heath'], edge: true },
    'Greater Whitethroat': { status: 'summer', occ: 0.5, detect: 'diurnal', habitats: ['farmland', 'grassland', 'heath'], edge: true },
    'Sedge Warbler': { status: 'summer', occ: 0.45, detect: 'diurnal', habitats: ['wetland', 'water'], micro: 'waterbody' },
    'Reed Warbler': { status: 'summer', occ: 0.45, detect: 'diurnal', habitats: ['wetland', 'water'], micro: 'waterbody' },
    'Spotted Flycatcher': { status: 'summer', occ: 0.35, detect: 'diurnal', habitats: ['woodland', 'park'] },
    'Pied Flycatcher': { status: 'summer', occ: 0.3, detect: 'diurnal', habitats: ['woodland'] },
    'Common Redstart': { status: 'summer', occ: 0.32, detect: 'diurnal', habitats: ['woodland', 'heath'] },
    'Tree Pipit': { status: 'summer', occ: 0.3, detect: 'diurnal', habitats: ['woodland', 'heath'] },
    'Yellow Wagtail': { status: 'summer', occ: 0.35, detect: 'diurnal', habitats: ['farmland', 'grassland', 'wetland'], edge: true },
    'Common Nightingale': { status: 'summer', occ: 0.2, detect: 'crepuscular', habitats: ['woodland'] },
    'Turtle Dove': { status: 'summer', occ: 0.16, detect: 'diurnal', habitats: ['farmland', 'woodland'], edge: true },
    'Osprey': { status: 'summer', occ: 0.14, detect: 'diurnal', habitats: ['water', 'wetland'], micro: 'waterbody' },
    'Common Tern': { status: 'summer', occ: 0.4, detect: 'diurnal', habitats: ['water', 'wetland', 'coast'], micro: 'waterbody' },
    'Northern Wheatear': { status: 'passage', occ: 0.35, detect: 'diurnal', habitats: ['grassland', 'coast', 'hills', 'farmland'] },

    // -- Owls: present all year but only detectable after dark --------------
    'Tawny Owl': { status: 'resident', occ: 0.4, detect: 'nocturnal', habitats: ['woodland', 'park'] },
    'Barn Owl': { status: 'resident', occ: 0.3, detect: 'crepuscular', habitats: ['farmland', 'grassland', 'wetland'] },
    'Little Owl': { status: 'resident', occ: 0.28, detect: 'crepuscular', habitats: ['farmland', 'grassland'] }
  };

  // --- Status inference from a host-supplied profile ------------------------
  // Lets summer/winter/irruptive species that are NOT in the table above be
  // gated too, using the free-text status the field-guide data already
  // carries plus any month array.
  function classifyFromHints(hints) {
    const text = String((hints && (hints.statusText || hints.status || '')) || '').toLowerCase();
    const traits = (hints && Array.isArray(hints.traits) ? hints.traits.join(' ') : '').toLowerCase();
    const blob = text + ' ' + traits;
    if (/irrupt/.test(blob)) return 'irruptive';
    if (/winter visitor|winter migrant|wintering|winter only/.test(blob)) return 'winter';
    if (/summer visitor|summer migrant|migrant breeder|summer breeder|summer only/.test(blob)) return 'summer';
    if (/passage/.test(blob) && !/resident|breeder/.test(blob)) return 'passage';
    if (/resident|all year|year-round/.test(blob)) return 'resident';
    // Month array: present-months that skip deep winter => summer; skip high
    // summer => winter. Requires a clear, non-trivial window to fire.
    const months = hints && Array.isArray(hints.months) ? hints.months.map(Number) : null;
    if (months && months.length && months.length < 12) {
      const has = m => months.includes(m);
      const winterAbsent = !has(11) && !has(12) && !has(1) && !has(2);
      const summerAbsent = !has(5) && !has(6) && !has(7) && !has(8);
      if (winterAbsent && (has(5) || has(6) || has(7))) return 'summer';
      if (summerAbsent && (has(11) || has(12) || has(1))) return 'winter';
    }
    return 'resident';
  }

  // Micro-habitat sets: species tagged `micro:'waterbody'` only match open
  // water / wetland; `micro:'coast'` only coast.
  const MICRO_HABITATS = {
    waterbody: new Set(['water', 'wetland']),
    coast: new Set(['coast'])
  };

  function occFromCommonness(commonness) {
    const c = Number(commonness);
    if (!Number.isFinite(c)) return 0.34;
    return clamp01(c / 100);
  }

  // Resolve the effective phenology descriptor for a species, merging the
  // authoritative table with host-supplied hints.
  function resolve(species, hints) {
    const name = String(species || '').split('(')[0].trim();
    const entry = PHENOLOGY[name] || null;
    const status = (entry && entry.status) || classifyFromHints(hints);
    const occ = entry && entry.occ != null ? entry.occ
      : occFromCommonness(hints && hints.commonness);
    const detect = (entry && entry.detect) || (hints && hints.detect) || 'diurnal';
    let habitats = (entry && entry.habitats) || (hints && hints.habitats) || null;
    if (habitats && !Array.isArray(habitats)) habitats = String(habitats).split(/\s*,\s*/);
    const micro = entry ? entry.micro || null : null;
    const edge = entry ? !!entry.edge : false;
    return { name, status, occ, detect, habitats, micro, edge };
  }

  // Habitat match 0..1 for a species at a given local habitat.
  function habitatMatch(desc, habitat) {
    const h = String(habitat || '').toLowerCase();
    if (desc.micro) {
      const set = MICRO_HABITATS[desc.micro];
      // Tied to a micro-habitat: full match inside it, otherwise absent.
      if (set) return set.has(h) ? 1 : 0;
    }
    if (!desc.habitats || !desc.habitats.length) return 0.85; // unknown -> generic
    if (desc.habitats.map(x => String(x).toLowerCase()).includes(h)) return 1;
    // Off-habitat spillover: edge/scrub birds barely stray into closed habitat;
    // generalists a little more.
    return desc.edge ? 0.06 : 0.15;
  }

  // --- Public scoring -------------------------------------------------------
  // Seasonal presence ignores time of day: it is what decides whether a
  // species is offered at all (spawn membership). p = occ x week x habitat.
  function seasonalPresence(species, ctx) {
    const c = ctx || {};
    const desc = resolve(species, c.hints);
    const week = c.week != null ? c.week : weekOfYear(c.date);
    return clamp01(desc.occ * weekProbability(desc.status, week) * habitatMatch(desc, c.habitat));
  }

  // Full candidate probability, including time-of-day detectability. This is
  // what the displayed rarity label is derived from.
  function candidateProbability(species, ctx) {
    const c = ctx || {};
    const desc = resolve(species, c.hints);
    const week = c.week != null ? c.week : weekOfYear(c.date);
    const hour = c.hour != null ? c.hour : (c.date ? new Date(c.date).getHours() : 12);
    return {
      species: desc.name,
      status: desc.status,
      localOccurrence: desc.occ,
      weekProbability: weekProbability(desc.status, week),
      habitatMatch: habitatMatch(desc, c.habitat),
      detectability: detectability(desc.detect, hour),
      get seasonalPresence() {
        return clamp01(this.localOccurrence * this.weekProbability * this.habitatMatch);
      },
      get p() {
        return clamp01(this.localOccurrence * this.weekProbability * this.habitatMatch * this.detectability);
      }
    };
  }

  // Is the species seasonally/habitat plausible enough to offer at all?
  // Deliberately time-of-day independent so crepuscular birds still appear
  // (dimmed) during the day rather than being excluded.
  function isPresent(species, ctx) {
    return seasonalPresence(species, ctx) >= PRESENCE_FLOOR;
  }

  // The rarity label to DISPLAY, from the full candidate probability. Returns
  // one of common/regular/uncommon/scarce/rare, or 'absent' when below floor.
  function rarityLabel(species, ctx) {
    return rarityLabelForProbability(candidateProbability(species, ctx).p);
  }

  return {
    version: 'bird-seasonality-20260804',
    PRESENCE_FLOOR,
    weekOfYear,
    weekProbability,
    detectability,
    habitatMatch: (species, habitat, hints) => habitatMatch(resolve(species, hints), habitat),
    resolve,
    seasonalPresence,
    candidateProbability,
    isPresent,
    rarityLabel,
    rarityLabelForProbability,
    _statusCurves: STATUS_CURVES,
    _phenology: PHENOLOGY
  };
});
