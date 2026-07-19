// Burbz Loot & Crafting Core — "The Fletcher's Forge"
// Item catalogue (weapons / armour / trinkets), crafting materials, loot
// tables with pity protection, gear stat bonuses and forge recipes.
// Weapons split into talon-craft (ATK) and spell-craft (MAG) so both big
// bruisers and small spellcasters have a gearing path. Pure logic module:
// no DOM, deterministic when given a seeded RNG, UMD export.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzLootCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  const RARITY_META = {
    common:    { label:'Common',    color:'#9aa5b1' },
    uncommon:  { label:'Uncommon',  color:'#5fd38a' },
    rare:      { label:'Rare',      color:'#4aa8e0' },
    epic:      { label:'Epic',      color:'#a06ae8' },
    legendary: { label:'Legendary', color:'#f0b429' }
  };
  function rarityIndex(r) { const i = RARITY_ORDER.indexOf(r); return i < 0 ? 0 : i; }

  // ---------------------------------------------------------------------------
  // Crafting materials — found on walks, won in battles, tithed by provinces
  // ---------------------------------------------------------------------------
  const MATERIALS = {
    oak_twig:     { id:'oak_twig',     label:'Oak Twig',      icon:'🪵', rarity:'common',    copy:'Sturdy forest timber for hafts and frames.' },
    river_reed:   { id:'river_reed',   label:'River Reed',    icon:'🌾', rarity:'common',    copy:'Supple reed for bindings and fletching.' },
    iron_grit:    { id:'iron_grit',    label:'Iron Grit',     icon:'⚙️', rarity:'common',    copy:'Gizzard-stone iron, ground fine for edges.' },
    down_tuft:    { id:'down_tuft',    label:'Down Tuft',     icon:'🪶', rarity:'common',    copy:'Warm underdown for padding armour.' },
    moon_dust:    { id:'moon_dust',    label:'Moon Dust',     icon:'🌙', rarity:'uncommon',  copy:'Glimmer shed by the Moon Observatory\'s lenses.' },
    storm_glass:  { id:'storm_glass',  label:'Storm Glass',   icon:'🌩️', rarity:'uncommon',  copy:'Sand fused by lightning — hums with speed.' },
    sun_amber:    { id:'sun_amber',    label:'Sun Amber',     icon:'🟠', rarity:'rare',      copy:'Ancient resin that holds a drop of sunlight.' },
    gold_thread:  { id:'gold_thread',  label:'Gold Thread',   icon:'🧵', rarity:'rare',      copy:'Spun from treasure-hoard filaments.' },
    ancient_rune: { id:'ancient_rune', label:'Ancient Rune',  icon:'🪬', rarity:'epic',      copy:'A feather-etched sliver of the old kingdom\'s magic.' },
    phoenix_ember:{ id:'phoenix_ember',label:'Phoenix Ember', icon:'🔥', rarity:'legendary', copy:'Never cools. Never dims. Forges the impossible.' }
  };

  // ---------------------------------------------------------------------------
  // Gear catalogue
  // ---------------------------------------------------------------------------
  // Slots: weapon (ATK or MAG), armour (DEF/HP/RES), trinket (SPD/crit/utility).
  // Stat keys match battle_core fighter fields: atk, mag, def, res, spd,
  // maxHp, critBonus.
  const GEAR = {
    // --- Weapons — talon-craft (physical, for the big birds) ---
    thorn_talons:   { id:'thorn_talons',   slot:'weapon', kind:'talon', rarity:'common',    label:'Thorn Talons',     icon:'🗡️', stats:{ atk:7 },  copy:'Hawthorn spurs lashed to the toes.' },
    bronze_spurs:   { id:'bronze_spurs',   slot:'weapon', kind:'talon', rarity:'uncommon',  label:'Bronze Spurs',     icon:'⚔️', stats:{ atk:12, spd:2 }, copy:'Fighting spurs cast in tavern bronze.' },
    stormcut_beak:  { id:'stormcut_beak',  slot:'weapon', kind:'talon', rarity:'rare',      label:'Stormcut Beak-Cap',icon:'🪓', stats:{ atk:18, critBonus:0.04 }, copy:'A beak-cap honed on storm glass.' },
    kings_gaff:     { id:'kings_gaff',     slot:'weapon', kind:'talon', rarity:'epic',      label:'King\'s Gaff',     icon:'🔱', stats:{ atk:26, spd:4, critBonus:0.06 }, copy:'Talon-blades from the old royal mews.' },
    sunlance_talons:{ id:'sunlance_talons',slot:'weapon', kind:'talon', rarity:'legendary', label:'Sunlance Talons',  icon:'☀️', stats:{ atk:36, spd:6, critBonus:0.09 }, copy:'Strike like the first light over the ridge.' },
    // --- Weapons — spell-craft (magic, for the small birds) ---
    willow_wand:    { id:'willow_wand',    slot:'weapon', kind:'wand',  rarity:'common',    label:'Willow Wing-Wand', icon:'🪄', stats:{ mag:8 },  copy:'A whippy willow sliver tucked under the wing.' },
    moonlit_charm:  { id:'moonlit_charm',  slot:'weapon', kind:'wand',  rarity:'uncommon',  label:'Moonlit Charm',    icon:'🌙', stats:{ mag:13, spd:2 }, copy:'Moon dust sealed in a locket of song.' },
    runed_crest:    { id:'runed_crest',    slot:'weapon', kind:'wand',  rarity:'rare',      label:'Runed Crest-Pin',  icon:'💠', stats:{ mag:19, critBonus:0.04 }, copy:'A crest-pin scratched with feather-runes.' },
    merlins_focus:  { id:'merlins_focus',  slot:'weapon', kind:'wand',  rarity:'epic',      label:'Merlin\'s Focus',  icon:'🔮', stats:{ mag:28, spd:4, critBonus:0.06 }, copy:'Cut from the wizard falcon\'s own spell-tablet.' },
    dawnsong_orb:   { id:'dawnsong_orb',   slot:'weapon', kind:'wand',  rarity:'legendary', label:'Dawnsong Orb',     icon:'🌅', stats:{ mag:38, spd:6, critBonus:0.09 }, copy:'The dawn chorus, caught in amber and gold.' },
    // --- Armour ---
    reed_vest:      { id:'reed_vest',      slot:'armour', kind:'armour', rarity:'common',    label:'Reed Vest',        icon:'🦺', stats:{ def:6, maxHp:10 }, copy:'Woven reeds that shrug off pecks.' },
    oak_breastplate:{ id:'oak_breastplate',slot:'armour', kind:'armour', rarity:'uncommon',  label:'Oak Breastplate',  icon:'🛡️', stats:{ def:10, maxHp:18, res:3 }, copy:'Steam-bent oak, light enough to fly in.' },
    feather_mail:   { id:'feather_mail',   slot:'armour', kind:'armour', rarity:'rare',      label:'Feather Mail',     icon:'⛓️', stats:{ def:15, maxHp:28, res:6 }, copy:'Thousands of tempered pinions, ringed like mail.' },
    warden_plumage: { id:'warden_plumage', slot:'armour', kind:'armour', rarity:'epic',      label:'Warden\'s Plumage',icon:'🥋', stats:{ def:22, maxHp:42, res:10 }, copy:'Worn by the sanctuary wardens of the free towns.' },
    aegis_of_dawn:  { id:'aegis_of_dawn',  slot:'armour', kind:'armour', rarity:'legendary', label:'Aegis of Dawn',    icon:'🌤️', stats:{ def:30, maxHp:60, res:15 }, copy:'The usurper\'s shadow slides straight off it.' },
    // --- Trinkets ---
    swift_band:     { id:'swift_band',     slot:'trinket', kind:'trinket', rarity:'common',    label:'Swift Band',      icon:'💍', stats:{ spd:5 }, copy:'A leg-band blessed by a passing swift.' },
    keen_eye_bead:  { id:'keen_eye_bead',  slot:'trinket', kind:'trinket', rarity:'uncommon',  label:'Keen-Eye Bead',   icon:'👁️', stats:{ critBonus:0.06, spd:2 }, copy:'See the gap before it opens.' },
    stormglass_anklet:{ id:'stormglass_anklet', slot:'trinket', kind:'trinket', rarity:'rare', label:'Stormglass Anklet', icon:'⚡', stats:{ spd:8, critBonus:0.04 }, copy:'Crackles when the wearer banks hard.' },
    gale_pendant:   { id:'gale_pendant',   slot:'trinket', kind:'trinket', rarity:'epic',      label:'Gale Pendant',    icon:'🌀', stats:{ spd:12, critBonus:0.06, mag:6 }, copy:'A bottled tailwind on a golden thread.' },
    heart_of_sky:   { id:'heart_of_sky',   slot:'trinket', kind:'trinket', rarity:'legendary', label:'Heart of the Sky',icon:'💎', stats:{ spd:16, critBonus:0.09, atk:8, mag:8 }, copy:'The open sky itself, cut and set.' }
  };

  const GEAR_SLOTS = ['weapon', 'armour', 'trinket'];

  function gearById(id) { return GEAR[id] || null; }
  function materialById(id) { return MATERIALS[id] || null; }
  function gearBySlot(slot) { return Object.values(GEAR).filter(g => g.slot === slot); }

  // Sum the stat bonuses of an equipped loadout {weapon:id, armour:id, trinket:id}.
  // Returns the `gear` shape battle_core.buildFighter consumes.
  function equipmentBonuses(loadout) {
    const total = { atk:0, mag:0, def:0, res:0, spd:0, maxHp:0, critBonus:0 };
    if (!loadout || typeof loadout !== 'object') return total;
    GEAR_SLOTS.forEach(slot => {
      const item = gearById(loadout[slot]);
      if (!item) return;
      Object.keys(item.stats).forEach(k => { total[k] = (total[k] || 0) + item.stats[k]; });
    });
    return total;
  }

  function gearPowerScore(item) {
    const s = item.stats || {};
    return Math.round((s.atk || 0) * 1.5 + (s.mag || 0) * 1.5 + (s.def || 0) * 1.2 + (s.res || 0) + (s.spd || 0) * 1.3 + (s.maxHp || 0) * 0.25 + (s.critBonus || 0) * 200);
  }

  // ---------------------------------------------------------------------------
  // Loot tables — every source rolls drops through here
  // ---------------------------------------------------------------------------
  // A drop: {kind:'gear'|'material'|'coins'|'branches', id?, qty}
  // Weights choose a rarity band first, then a concrete item, so tables stay
  // tiny and every new item is automatically lootable.
  const RARITY_WEIGHTS = {
    map_cache:  { common:62, uncommon:27, rare:9,  epic:2,  legendary:0 },
    map_relic:  { common:0,  uncommon:45, rare:38, epic:14, legendary:3 },
    league_win: { common:55, uncommon:30, rare:11, epic:3,  legendary:1 },
    liberation: { common:0,  uncommon:40, rare:38, epic:17, legendary:5 },
    tribute:    { common:60, uncommon:30, rare:9,  epic:1,  legendary:0 },
    forage:     { common:78, uncommon:19, rare:3,  epic:0,  legendary:0 }
  };

  // Pity: every miss on rare-or-better nudges the odds; a guaranteed rare+
  // fires at the cap. `pity` is a mutable counter object {rareMisses}.
  const PITY_RARE_CAP = 12;

  function pickRarity(weights, rng, pity) {
    let w = { ...weights };
    const p = pity && Number(pity.rareMisses) || 0;
    if (p > 0) {
      const shift = Math.min(30, p * 2.5);
      w.rare = (w.rare || 0) + shift * 0.7;
      w.epic = (w.epic || 0) + shift * 0.25;
      w.legendary = (w.legendary || 0) + shift * 0.05;
    }
    if (pity && p >= PITY_RARE_CAP) { w = { common:0, uncommon:0, rare:80, epic:17, legendary:3 }; }
    const total = RARITY_ORDER.reduce((s, r) => s + (w[r] || 0), 0) || 1;
    let roll = rng() * total;
    let chosen = 'common';
    for (const r of RARITY_ORDER) { if (roll < (w[r] || 0)) { chosen = r; break; } roll -= (w[r] || 0); }
    if (pity) {
      if (rarityIndex(chosen) >= rarityIndex('rare')) pity.rareMisses = 0;
      else pity.rareMisses = (Number(pity.rareMisses) || 0) + 1;
    }
    return chosen;
  }

  function pickFrom(list, rng) { return list.length ? list[Math.floor(rng() * list.length)] : null; }

  // rollGear: one equipment piece of a rolled rarity (any slot).
  function rollGear(source, rng, pity) {
    const rarity = pickRarity(RARITY_WEIGHTS[source] || RARITY_WEIGHTS.map_cache, rng, pity);
    const pool = Object.values(GEAR).filter(g => g.rarity === rarity);
    const item = pickFrom(pool, rng) || GEAR.thorn_talons;
    return { kind:'gear', id:item.id, qty:1 };
  }

  // rollMaterials: 1..count materials biased to the source's rarity band.
  function rollMaterials(source, rng, count) {
    const drops = [];
    const nDrops = Math.max(1, Math.round(count || 1));
    for (let i = 0; i < nDrops; i++) {
      const rarity = pickRarity(RARITY_WEIGHTS[source] || RARITY_WEIGHTS.forage, rng, null);
      const pool = Object.values(MATERIALS).filter(m => m.rarity === rarity);
      const mat = pickFrom(pool, rng) || MATERIALS.oak_twig;
      const existing = drops.find(d => d.id === mat.id);
      if (existing) existing.qty += 1;
      else drops.push({ kind:'material', id:mat.id, qty:1 });
    }
    return drops;
  }

  // The main entry: roll a full loot bundle for a source.
  // opts: { rng (required for determinism), pity, tier (0..6 scales quantity),
  //         guaranteeGear (bool) }
  function rollLoot(source, opts) {
    const o = opts || {};
    const rng = o.rng || Math.random;
    const tier = Math.max(0, Math.min(6, Number(o.tier) || 0));
    const drops = [];
    if (source === 'map_cache') {
      drops.push(...rollMaterials('forage', rng, 1 + (rng() < 0.4 ? 1 : 0)));
      if (o.guaranteeGear || rng() < 0.45) drops.push(rollGear('map_cache', rng, o.pity));
      drops.push({ kind:'coins', qty: 8 + Math.floor(rng() * 13) });
    } else if (source === 'map_relic') {
      drops.push(rollGear('map_relic', rng, o.pity));
      drops.push(...rollMaterials('map_cache', rng, 2));
      drops.push({ kind:'coins', qty: 20 + Math.floor(rng() * 26) });
    } else if (source === 'league_win') {
      drops.push(...rollMaterials('forage', rng, 1 + Math.floor(tier / 3)));
      if (rng() < 0.22 + tier * 0.03) drops.push(rollGear('league_win', rng, o.pity));
    } else if (source === 'liberation') {
      drops.push(rollGear('liberation', rng, o.pity));           // spoils of liberation
      drops.push(...rollMaterials('map_cache', rng, 2 + Math.floor(tier / 2)));
      drops.push({ kind:'branches', qty: 3 + Math.floor(rng() * 4) });
    } else if (source === 'tribute') {
      drops.push(...rollMaterials('tribute', rng, 1));
      if (rng() < 0.12) drops.push(rollGear('tribute', rng, null));
    } else {
      drops.push(...rollMaterials('forage', rng, 1));
    }
    return drops;
  }

  // ---------------------------------------------------------------------------
  // Crafting — the Fletcher's Forge
  // ---------------------------------------------------------------------------
  // Every gear item is craftable from materials + coins; costs scale by rarity.
  const CRAFT_COST_BY_RARITY = {
    common:    { coins:20,  mats:2 },
    uncommon:  { coins:45,  mats:3 },
    rare:      { coins:90,  mats:4 },
    epic:      { coins:180, mats:5 },
    legendary: { coins:360, mats:6 }
  };

  // Which materials a gear kind draws on, cheapest first; rarity depth decides
  // how far down the list the recipe reaches.
  const KIND_MATERIALS = {
    talon:   ['iron_grit', 'oak_twig', 'storm_glass', 'sun_amber', 'ancient_rune', 'phoenix_ember'],
    wand:    ['river_reed', 'moon_dust', 'storm_glass', 'gold_thread', 'ancient_rune', 'phoenix_ember'],
    armour:  ['down_tuft', 'oak_twig', 'iron_grit', 'gold_thread', 'ancient_rune', 'phoenix_ember'],
    trinket: ['river_reed', 'storm_glass', 'moon_dust', 'sun_amber', 'ancient_rune', 'phoenix_ember']
  };

  function recipeFor(gearId) {
    const item = gearById(gearId);
    if (!item) return null;
    const tier = rarityIndex(item.rarity);
    const cost = CRAFT_COST_BY_RARITY[item.rarity];
    const line = KIND_MATERIALS[item.kind] || KIND_MATERIALS.talon;
    const materials = {};
    // Base timber/reed cost plus increasingly rare components per tier.
    materials[line[0]] = cost.mats;
    for (let t = 1; t <= tier; t++) {
      const mat = line[Math.min(t, line.length - 1)];
      materials[mat] = (materials[mat] || 0) + Math.max(1, cost.mats - t - 1);
    }
    return { id:'craft_' + item.id, gearId:item.id, coins:cost.coins, materials };
  }

  function allRecipes() { return Object.keys(GEAR).map(recipeFor); }

  // Transmute: 3 of a material → 1 of the next material in that craft line.
  const TRANSMUTE_RATIO = 3;
  function transmuteTargets(materialId) {
    const out = [];
    Object.values(KIND_MATERIALS).forEach(line => {
      const i = line.indexOf(materialId);
      if (i >= 0 && i < line.length - 1 && !out.includes(line[i + 1])) out.push(line[i + 1]);
    });
    return out;
  }

  // Check a recipe against owned stock {materialId:qty} and coins.
  function canCraft(recipe, stock, coins) {
    if (!recipe) return { ok:false, missing:['unknown recipe'] };
    const missing = [];
    if ((Number(coins) || 0) < recipe.coins) missing.push(recipe.coins + ' coins');
    Object.keys(recipe.materials).forEach(matId => {
      const have = Number(stock && stock[matId]) || 0;
      const need = recipe.materials[matId];
      if (have < need) {
        const m = materialById(matId);
        missing.push((need - have) + '× ' + (m ? m.label : matId));
      }
    });
    return { ok: missing.length === 0, missing };
  }

  return {
    RARITY_ORDER, RARITY_META, rarityIndex,
    MATERIALS, GEAR, GEAR_SLOTS, gearById, materialById, gearBySlot,
    equipmentBonuses, gearPowerScore,
    RARITY_WEIGHTS, PITY_RARE_CAP, pickRarity, rollGear, rollMaterials, rollLoot,
    CRAFT_COST_BY_RARITY, KIND_MATERIALS, recipeFor, allRecipes,
    TRANSMUTE_RATIO, transmuteTargets, canCraft
  };
});
