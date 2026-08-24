// Burbz Loot & Crafting Core — "The Fletcher's Forge"
// Item catalogue (weapons / armour / trinkets-as-enhancements / spells /
// potions), crafting materials, loot tables with pity protection, gear stat
// bonuses and forge recipes.
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
  // Slots: weapon (ATK or MAG), armour (DEF/HP/RES), trinket (SPD/crit/utility/carry).
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
    // --- Trinkets — presented in the equip screen as Enhancements ---
    swift_band:     { id:'swift_band',     slot:'trinket', kind:'trinket', rarity:'common',    label:'Swift Band',      icon:'💍', stats:{ spd:5 }, copy:'A leg-band blessed by a passing swift.' },
    keen_eye_bead:  { id:'keen_eye_bead',  slot:'trinket', kind:'trinket', rarity:'uncommon',  label:'Keen-Eye Bead',   icon:'👁️', stats:{ critBonus:0.06, spd:2 }, copy:'See the gap before it opens.' },
    stormglass_anklet:{ id:'stormglass_anklet', slot:'trinket', kind:'trinket', rarity:'rare', label:'Stormglass Anklet', icon:'⚡', stats:{ spd:8, critBonus:0.04 }, copy:'Crackles when the wearer banks hard.' },
    gale_pendant:   { id:'gale_pendant',   slot:'trinket', kind:'trinket', rarity:'epic',      label:'Gale Pendant',    icon:'🌀', stats:{ spd:12, critBonus:0.06, mag:6 }, copy:'A bottled tailwind on a golden thread.' },
    heart_of_sky:   { id:'heart_of_sky',   slot:'trinket', kind:'trinket', rarity:'legendary', label:'Heart of the Sky',icon:'💎', stats:{ spd:16, critBonus:0.09, atk:8, mag:8 }, copy:'The open sky itself, cut and set.' },
    // --- Satchels — durable Forge gear, never a quest-send consumable ---
    reed_satchel:      { id:'reed_satchel',       slot:'trinket', kind:'satchel', rarity:'common',    label:'Reed Satchel',       icon:'🎒', stats:{}, carryBonus:1, craftOnly:true, copy:'A light woven pouch that carries one extra find.' },
    oakframe_satchel:  { id:'oakframe_satchel',   slot:'trinket', kind:'satchel', rarity:'uncommon',  label:'Oakframe Satchel',   icon:'🎒', stats:{}, carryBonus:2, craftOnly:true, copy:'An oak-braced field bag that carries two extra finds.' },
    stormweave_satchel:{ id:'stormweave_satchel', slot:'trinket', kind:'satchel', rarity:'rare',      label:'Stormweave Satchel', icon:'🎒', stats:{}, carryBonus:3, craftOnly:true, copy:'Weatherproof weaving keeps three extra finds secure in flight.' },
    gilded_satchel:    { id:'gilded_satchel',     slot:'trinket', kind:'satchel', rarity:'epic',      label:'Gilded Satchel',     icon:'🎒', stats:{}, carryBonus:4, craftOnly:true, copy:'A balanced courier bag that carries four extra finds.' },
    royal_satchel:     { id:'royal_satchel',      slot:'trinket', kind:'satchel', rarity:'legendary', label:'Royal Satchel',      icon:'🎒', stats:{}, carryBonus:5, craftOnly:true, copy:'The finest expedition pack in the Kingdom: five extra finds.' },
    // --- Spells — an equipped scroll grants the bird an extra battle skill ---
    ember_wisp:     { id:'ember_wisp',     slot:'spell', kind:'spell', rarity:'common',    label:'Ember Wisp',       icon:'🔥', stats:{}, spell:{ power:56, cd:2, kind:'attack' }, copy:'A darting mote of flame, eager to bite.' },
    mending_light:  { id:'mending_light',  slot:'spell', kind:'spell', rarity:'uncommon',  label:'Mending Light',    icon:'💫', stats:{}, spell:{ power:0, cd:3, kind:'heal', healPct:0.28 }, copy:'Warm dawnlight knits feather and bone.' },
    frost_sigil:    { id:'frost_sigil',    slot:'spell', kind:'spell', rarity:'rare',      label:'Frost Sigil',      icon:'❄️', stats:{}, spell:{ power:68, cd:2, kind:'attack', rider:{ kind:'debuff', stat:'spd', pct:0.2, turns:2 } }, copy:'Rime creeps along the foe\'s wings.' },
    tempest_scroll: { id:'tempest_scroll', slot:'spell', kind:'spell', rarity:'epic',      label:'Tempest Scroll',   icon:'⛈️', stats:{}, spell:{ power:62, cd:3, kind:'attack', aoe:true }, copy:'Unrolls into a storm that strikes every foe.' },
    phoenix_chorus: { id:'phoenix_chorus', slot:'spell', kind:'spell', rarity:'legendary', label:'Phoenix Chorus',   icon:'🎶', stats:{}, spell:{ power:0, cd:4, kind:'heal', healPct:0.32, cleanse:true, teamWide:true }, copy:'The firebird\'s song mends the whole squad.' },
    // --- Potions — equipped brews used as bonus actions on their bird's turn ---
    tonic_of_vigour:{ id:'tonic_of_vigour',slot:'potion', kind:'potion', rarity:'common',    label:'Tonic of Vigour',  icon:'🧪', stats:{}, battle:{ healPct:0.3 }, copy:'A bracing berry tonic — restore HP on this bird’s turn, then still make a move.' },
    nettle_brew:    { id:'nettle_brew',    slot:'potion', kind:'potion', rarity:'uncommon',  label:'Nettle War-Brew',  icon:'🍵', stats:{}, battle:{ mods:[{ stat:'atk', pct:0.15, turns:3 }, { stat:'mag', pct:0.15, turns:3 }] }, copy:'Stings going down, then the fury takes hold.' },
    barrier_draught:{ id:'barrier_draught',slot:'potion', kind:'potion', rarity:'rare',      label:'Barrier Draught',  icon:'🫧', stats:{}, battle:{ barrierPct:0.22 }, copy:'Bottled shieldwater wraps the drinker in a shimmering shell.' },
    stormwing_philtre:{ id:'stormwing_philtre', slot:'potion', kind:'potion', rarity:'epic', label:'Stormwing Philtre',icon:'🌪️', stats:{}, battle:{ mods:[{ stat:'spd', pct:0.2, turns:3 }], crStart:0.35 }, copy:'Drink the gale — move faster and keep 35% readiness after this turn.' },
    phoenix_elixir: { id:'phoenix_elixir', slot:'potion', kind:'potion', rarity:'legendary', label:'Phoenix Elixir',   icon:'🔆', stats:{}, battle:{ healPct:0.5, barrierPct:0.2, mods:[{ stat:'atk', pct:0.15, turns:3 }, { stat:'mag', pct:0.15, turns:3 }] }, copy:'A drop of ember-light: mends, shields and emboldens.' }
  };

  const GEAR_SLOTS = ['weapon', 'armour', 'trinket', 'spell', 'potion'];

  function gearById(id) { return GEAR[id] || null; }
  function materialById(id) { return MATERIALS[id] || null; }
  function gearBySlot(slot) { return Object.values(GEAR).filter(g => g.slot === slot); }

  // Sum the stat bonuses of an equipped loadout {weapon:id, armour:id, trinket:id}.
  // Returns the `gear` shape battle_core.buildFighter consumes.
  // options.gearLevel: the Forge's level. The Fletcher keeps every equipped
  // piece honed to the forge's own temper, so upgrading the forge levels up
  // the whole armoury at once. Level 1 (or no option) leaves stats untouched.
  function equipmentBonuses(loadout, options) {
    const gearLevel = normalizeForgeLevel(options && options.gearLevel);
    const total = { atk:0, mag:0, def:0, res:0, spd:0, maxHp:0, critBonus:0, carryBonus:0 };
    if (!loadout || typeof loadout !== 'object') return total;
    GEAR_SLOTS.forEach(slot => {
      const item = gearById(loadout[slot]);
      if (!item) return;
      const stats = gearLevel > 1 ? temperedStats(item, gearLevel) : (item.stats || {});
      Object.keys(stats).forEach(k => { total[k] = (total[k] || 0) + stats[k]; });
      total.carryBonus += Math.max(0, Number(item.carryBonus) || 0);
    });
    return total;
  }

  // An equipped spell scroll becomes a real battle skill in the shape
  // battle_core's action resolver already understands (attack/heal/barrier/buff).
  function spellSkillFor(gearIdOrItem) {
    const item = typeof gearIdOrItem === 'string' ? gearById(gearIdOrItem) : gearIdOrItem;
    if (!item || item.slot !== 'spell' || !item.spell) return null;
    return {
      id: 'spell_' + item.id,
      label: item.label,
      icon: item.icon,
      school: 'spell',
      stat: 'mag',
      kind: item.spell.kind || 'attack',
      power: item.spell.power || 0,
      cd: item.spell.cd || 2,
      healPct: item.spell.healPct || 0,
      aoe: !!item.spell.aoe,
      cleanse: !!item.spell.cleanse,
      teamWide: !!item.spell.teamWide,
      rider: item.spell.rider || null,
      fromSpellScroll: true
    };
  }

  // The player-turn effect of an equipped potion:
  // { healPct, barrierPct, mods:[{stat,pct,turns}], crStart }
  function potionEffectFor(gearIdOrItem) {
    const item = typeof gearIdOrItem === 'string' ? gearById(gearIdOrItem) : gearIdOrItem;
    if (!item || item.slot !== 'potion' || !item.battle) return null;
    return {
      healPct: item.battle.healPct || 0,
      barrierPct: item.battle.barrierPct || 0,
      mods: (item.battle.mods || []).map(m => ({ ...m })),
      crStart: item.battle.crStart || 0
    };
  }

  function gearPowerScore(item) {
    const s = item.stats || {};
    let score = Math.round((s.atk || 0) * 1.5 + (s.mag || 0) * 1.5 + (s.def || 0) * 1.2 + (s.res || 0) + (s.spd || 0) * 1.3 + (s.maxHp || 0) * 0.25 + (s.critBonus || 0) * 200 + (item.carryBonus || 0) * 10);
    if (item.spell) score += Math.round((item.spell.power || 0) * 0.5 + (item.spell.healPct || 0) * 100 + (item.spell.aoe ? 15 : 0) + (item.spell.teamWide ? 15 : 0));
    if (item.battle) score += Math.round((item.battle.healPct || 0) * 80 + (item.battle.barrierPct || 0) * 80 + (item.battle.mods || []).reduce((n, m) => n + m.pct * 100, 0) + (item.battle.crStart || 0) * 40);
    return score;
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
    const pool = Object.values(GEAR).filter(g => g.rarity === rarity && !g.craftOnly);
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
  // Forge levels — the Fletcher's Forge itself can be rebuilt, hearth by hearth
  // ---------------------------------------------------------------------------
  // Each forge level opens deeper rarities to craft AND tempers every equipped
  // piece: gear fights at the forge's level (see equipmentBonuses), so the
  // armoury keeps pace as the liberated world gets harder.
  const FORGE_MAX_LEVEL = 5;
  const FORGE_LEVELS = [
    { level:1, label:'Field Anvil',   rarityCap:'uncommon',  copy:'A travelling smith\'s kit. Common and uncommon work only.' },
    { level:2, label:'Stone Hearth',  rarityCap:'rare',      copy:'A proper hearth holds the heat rare work needs.' },
    { level:3, label:'Guild Forge',   rarityCap:'epic',      copy:'Guild tools and a true quenching trough. Epic work begins.' },
    { level:4, label:'Royal Forge',   rarityCap:'legendary', copy:'The old royal bellows roar again. Nothing is beyond the smith.' },
    { level:5, label:'Sunfire Forge', rarityCap:'legendary', copy:'Fed by a phoenix ember that never cools. The summit of the craft.' }
  ];

  function normalizeForgeLevel(v) {
    const num = Math.round(Number(v));
    return Number.isFinite(num) ? Math.max(1, Math.min(FORGE_MAX_LEVEL, num)) : 1;
  }
  function forgeLevelInfo(level) { return FORGE_LEVELS[normalizeForgeLevel(level) - 1]; }

  // The forge level a rarity first comes off the anvil at.
  const FORGE_LEVEL_BY_RARITY = { common:1, uncommon:1, rare:2, epic:3, legendary:4 };
  function minForgeLevelForRarity(rarity) { return FORGE_LEVEL_BY_RARITY[rarity] || 1; }
  function canForgeAtLevel(gearIdOrItem, forgeLevel) {
    const item = typeof gearIdOrItem === 'string' ? gearById(gearIdOrItem) : gearIdOrItem;
    if (!item) return false;
    return normalizeForgeLevel(forgeLevel) >= minForgeLevelForRarity(item.rarity);
  }

  // Rebuilding the forge costs coins, branches and real materials — a proper
  // savings goal between conquests. Index 0 is the cost of going 1 → 2.
  const FORGE_UPGRADE_COSTS = [
    { coins:150,  branches:40,  materials:{ iron_grit:6, oak_twig:6 } },
    { coins:400,  branches:90,  materials:{ storm_glass:5, gold_thread:3 } },
    { coins:900,  branches:160, materials:{ sun_amber:4, ancient_rune:2 } },
    { coins:1800, branches:280, materials:{ ancient_rune:3, phoenix_ember:1 } }
  ];
  function forgeUpgradeCost(currentLevel) {
    const lv = normalizeForgeLevel(currentLevel);
    return lv >= FORGE_MAX_LEVEL ? null : FORGE_UPGRADE_COSTS[lv - 1];
  }
  function canUpgradeForge(currentLevel, stock, coins, branches) {
    const cost = forgeUpgradeCost(currentLevel);
    if (!cost) return { ok:false, missing:['the forge is already at its summit'] };
    const missing = [];
    if ((Number(coins) || 0) < cost.coins) missing.push(cost.coins + ' coins');
    if ((Number(branches) || 0) < cost.branches) missing.push(cost.branches + ' branches');
    Object.keys(cost.materials).forEach(matId => {
      const have = Number(stock && stock[matId]) || 0;
      const need = cost.materials[matId];
      if (have < need) {
        const m = materialById(matId);
        missing.push((need - have) + '× ' + (m ? m.label : matId));
      }
    });
    return { ok: missing.length === 0, missing };
  }

  // Tempering: +12% to every combat stat per forge level above the first,
  // plus a sliver of crit. Carry bonuses stay put — a bag is a bag.
  const GEAR_TEMPER_PCT = 0.12;
  function temperMultiplier(gearLevel) {
    return 1 + (normalizeForgeLevel(gearLevel) - 1) * GEAR_TEMPER_PCT;
  }
  function temperedStats(gearIdOrItem, gearLevel) {
    const item = typeof gearIdOrItem === 'string' ? gearById(gearIdOrItem) : gearIdOrItem;
    if (!item) return {};
    const lv = normalizeForgeLevel(gearLevel);
    const mult = temperMultiplier(lv);
    const out = {};
    Object.keys(item.stats || {}).forEach(k => {
      const v = item.stats[k];
      if (k === 'critBonus') out[k] = Math.round((v + (lv - 1) * 0.01) * 100) / 100;
      else out[k] = Math.round(v * mult);
    });
    return out;
  }

  // ---------------------------------------------------------------------------
  // The Stores market — selling what the kingdom owns (v295)
  // ---------------------------------------------------------------------------
  // Yaan's rule: anything on the shelves can be turned into coins. Crafted
  // gear is the real money — a legendary piece sells for more than its forge
  // bill, because the materials in it are precious. Raw materials fetch a
  // modest price by rarity. Small found things — a pile of berries, a heap
  // of sticks, an oddment — go for pocket change. Selling is always a choice,
  // never a bargain: crafting and cooking beat the market price on purpose.
  const SELL_PRICES = {
    material: { common:2, uncommon:6, rare:15, epic:40, legendary:100 },
    gear:     { common:15, uncommon:40, rare:90, epic:200, legendary:450 },
    food: 2,     // per larder item — berries, seeds, small prey
    keepsake: 5  // curios and oddments on the shelf
  };
  // Coins per unit for one shelf item. kind: 'material' | 'gear' | 'food' |
  // 'keepsake'. Unknown kinds and rarities price at 0 — unsellable.
  function sellValue(kind, rarity) {
    const line = SELL_PRICES[String(kind || '')];
    if (typeof line === 'number') return line;
    if (line && typeof line === 'object') return Number(line[String(rarity || '')]) || 0;
    return 0;
  }
  // The quote a SELL button shows: {each, qty, total}. Quantity is clamped to
  // what is actually owned, so a stale button can never oversell.
  function sellQuote(kind, rarity, owned, qty) {
    const each = sellValue(kind, rarity);
    const stock = Math.max(0, Math.floor(Number(owned) || 0));
    const count = Math.max(0, Math.min(stock, Math.floor(Number(qty) || 0)));
    return { each, qty: count, total: each * count };
  }

  // ---------------------------------------------------------------------------
  // The Magpie Market — buying materials back (v314)
  // ---------------------------------------------------------------------------
  // The Academy's trading post buys and sells the same shelf, and the gap
  // between the two prices is the traders' cut. The markup widens with rarity
  // on purpose: everyday timber and reed are pocket change, but a Phoenix
  // Ember costs five times what a magpie will pay for one. Quests stay the
  // best way to get the precious stuff — the market is the shortcut you pay
  // for, never the cheap route.
  const BUY_MARKUP = { common:2.5, uncommon:2.5, rare:3, epic:4, legendary:5 };
  // Coins per unit to buy one material. Anything the market will not pay for
  // it will not sell either, so an unsellable kind prices at 0 — unbuyable.
  function buyValue(kind, rarity) {
    const base = sellValue(kind, rarity);
    if (!base) return 0;
    const markup = BUY_MARKUP[String(rarity || '')] || BUY_MARKUP.common;
    return Math.ceil(base * markup);
  }
  // The quote a BUY button shows: {each, qty, total, afford}. `afford` is how
  // many the given purse actually covers, so a stale button can never overspend
  // and a discount (a well-posted Market Trader) is applied to `each` before
  // the sums — never after, which would let rounding leak a free unit.
  function buyQuote(kind, rarity, coins, qty, discount) {
    const listed = buyValue(kind, rarity);
    const factor = Math.max(0.5, Math.min(1, Number(discount) || 1));
    const each = listed ? Math.max(1, Math.round(listed * factor)) : 0;
    const purse = Math.max(0, Math.floor(Number(coins) || 0));
    const afford = each ? Math.floor(purse / each) : 0;
    const count = Math.max(0, Math.min(afford, Math.floor(Number(qty) || 0)));
    return { each, qty: count, total: each * count, afford };
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
    trinket: ['river_reed', 'storm_glass', 'moon_dust', 'sun_amber', 'ancient_rune', 'phoenix_ember'],
    satchel: ['river_reed', 'oak_twig', 'down_tuft', 'gold_thread', 'ancient_rune', 'phoenix_ember'],
    spell:   ['river_reed', 'moon_dust', 'sun_amber', 'gold_thread', 'ancient_rune', 'phoenix_ember'],
    potion:  ['river_reed', 'down_tuft', 'moon_dust', 'sun_amber', 'ancient_rune', 'phoenix_ember']
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

  // ---------------------------------------------------------------------------
  // Forge timers — nothing worth having is hammered out in a heartbeat
  // ---------------------------------------------------------------------------
  // A commission is placed at the forge, the materials are spent up front and
  // the smith works the clock down even while the app is closed. The band a
  // piece sits in sets the bulk of the wait; within a band the *stronger* item
  // always takes longer, so a Sunlance is never as quick as a Willow Wand.
  const CRAFT_TIME_BY_RARITY = {
    common:    45 * 1000,
    uncommon:   4 * 60 * 1000,
    rare:      18 * 60 * 1000,
    epic:      55 * 60 * 1000,
    legendary:  3 * 60 * 60 * 1000
  };
  // How hard the item's own power score stretches its band. 120 is chosen so
  // the weakest piece in the catalogue adds ~9% and the strongest ~72%, with a
  // hard ceiling so no future item can run away with the clock.
  const CRAFT_POWER_DIVISOR = 120;
  const CRAFT_POWER_MAX_MULTIPLIER = 1.8;
  // Simultaneous commissions the Fletcher will take. Beyond this the queue is
  // full and the player has to collect (or cancel) something first.
  const FORGE_MAX_JOBS = 3;

  function craftTimeMs(gearIdOrItem) {
    const item = typeof gearIdOrItem === 'string' ? gearById(gearIdOrItem) : gearIdOrItem;
    if (!item) return 0;
    const base = CRAFT_TIME_BY_RARITY[item.rarity] || CRAFT_TIME_BY_RARITY.common;
    const multiplier = Math.min(CRAFT_POWER_MAX_MULTIPLIER, 1 + gearPowerScore(item) / CRAFT_POWER_DIVISOR);
    return Math.round(base * multiplier);
  }

  // Sorting helper for any UI that wants "quickest first" inside a group.
  function craftTimeCompare(aId, bId) { return craftTimeMs(aId) - craftTimeMs(bId); }

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
    equipmentBonuses, gearPowerScore, spellSkillFor, potionEffectFor,
    RARITY_WEIGHTS, PITY_RARE_CAP, pickRarity, rollGear, rollMaterials, rollLoot,
    SELL_PRICES, sellValue, sellQuote,
    BUY_MARKUP, buyValue, buyQuote,
    CRAFT_COST_BY_RARITY, KIND_MATERIALS, recipeFor, allRecipes,
    FORGE_MAX_LEVEL, FORGE_LEVELS, normalizeForgeLevel, forgeLevelInfo,
    FORGE_LEVEL_BY_RARITY, minForgeLevelForRarity, canForgeAtLevel,
    FORGE_UPGRADE_COSTS, forgeUpgradeCost, canUpgradeForge,
    GEAR_TEMPER_PCT, temperMultiplier, temperedStats,
    CRAFT_TIME_BY_RARITY, CRAFT_POWER_DIVISOR, CRAFT_POWER_MAX_MULTIPLIER, FORGE_MAX_JOBS,
    craftTimeMs, craftTimeCompare,
    TRANSMUTE_RATIO, transmuteTargets, canCraft
  };
});
