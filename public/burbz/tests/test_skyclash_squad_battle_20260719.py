"""Skyclash squad battle engine + Fletcher's Forge loot/crafting core."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def _node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


ROBIN = {"species": "European Robin", "level": 1, "maxHp": 70, "hp": 70, "atk": 20,
         "def": 30, "spd": 50, "int": 50, "cha": 50, "stamina": 50}
EAGLE = {"species": "Golden Eagle", "level": 1, "maxHp": 140, "hp": 140, "atk": 100,
         "def": 90, "spd": 80, "int": 70, "cha": 50, "stamina": 80}


def test_small_birds_out_magic_big_birds_and_cast_spark():
    payload = _node(f"""
const core = require('./battle_core.js');
const robin = {json.dumps(ROBIN)}, eagle = {json.dumps(EAGLE)};
const rf = core.buildFighter({{ ...robin, id:'r' }});
const ef = core.buildFighter({{ ...eagle, id:'e' }});
console.log(JSON.stringify({{
  robinMag: core.deriveMagic(robin), eagleMag: core.deriveMagic(eagle),
  robinBasic: rf.skills[0].id, eagleBasic: ef.skills[0].id,
  robinUltStat: rf.skills[rf.skills.length-1].stat, eagleUltStat: ef.skills[ef.skills.length-1].stat
}}));
""")
    assert payload["robinMag"] > payload["eagleMag"]
    assert payload["robinBasic"] == "spark"      # magic-leaning birds lead with a spell
    assert payload["eagleBasic"] == "peck"
    assert payload["robinUltStat"] == "mag"      # signatures follow the bird's strength
    assert payload["eagleUltStat"] == "atk"


def test_squad_battle_is_deterministic_and_terminates():
    payload = _node(f"""
const core = require('./battle_core.js');
const robin = {json.dumps(ROBIN)}, eagle = {json.dumps(EAGLE)};
function run() {{
  const p = [robin, eagle].map((b, i) => core.buildFighter({{ ...b, id:'p'+i }}));
  const o = [eagle, robin].map((b, i) => core.buildOpponentFighter({{ ...b, id:'o'+i, species: i ? 'Eurasian Wren' : 'Mute Swan' }}, 2, 'seed'+i));
  const battle = core.createBattle({{ playerFighters:p, opponentFighters:o, seed:'pytest', tier:2 }});
  let guard = 0;
  while (battle.phase !== 'over' && guard++ < 600) {{
    if (!core.tickToNextTurn(battle)) break;
    core.resolveAction(battle, core.aiChooseAction(battle));
  }}
  return {{ winner: battle.winner, turns: battle.turn, over: battle.phase === 'over' }};
}}
console.log(JSON.stringify({{ a: run(), b: run() }}));
""")
    assert payload["a"]["over"] is True
    assert payload["a"] == payload["b"]
    assert payload["a"]["turns"] > 4  # squads trade several actions, not one alpha strike


def test_turn_meter_favors_faster_birds_and_focus_surge_costs():
    payload = _node("""
const core = require('./battle_core.js');
const fast = core.buildFighter({ id:'f', species:'Barn Swallow', maxHp:80, hp:80, atk:40, def:40, spd:90, int:50, cha:50, stamina:50 });
const slow = core.buildFighter({ id:'s', species:'Common Pheasant', maxHp:120, hp:120, atk:60, def:60, spd:30, int:40, cha:40, stamina:60 });
const battle = core.createBattle({ playerFighters:[fast], opponentFighters:[slow], seed:'meter' });
const first = core.tickToNextTurn(battle);
console.log(JSON.stringify({ firstSide: first.side, surgeCost: core.SURGE_COST, focusMax: core.FOCUS_MAX,
  forecast: core.forecastTurnOrder(battle, 4).map(t => t.side) }));
""")
    assert payload["firstSide"] == "player"  # 90 SPD outruns 30 SPD on the meter
    assert payload["forecast"].count("player") > payload["forecast"].count("opponent")
    assert 0 < payload["surgeCost"] <= payload["focusMax"]


def test_equipment_bonuses_feed_fighters_and_recipes_are_craftable():
    payload = _node("""
const core = require('./battle_core.js');
const L = require('./loot_crafting_core.js');
const bare = core.buildFighter({ id:'a', species:'Carrion Crow', maxHp:90, hp:90, atk:50, def:50, spd:50, int:90, cha:50, stamina:70 });
const gear = L.equipmentBonuses({ weapon:'bronze_spurs', armour:'oak_breastplate', trinket:'swift_band' });
const armed = core.buildFighter({ id:'a', species:'Carrion Crow', maxHp:90, hp:90, atk:50, def:50, spd:50, int:90, cha:50, stamina:70 }, { gear });
const rec = L.recipeFor('feather_mail');
const stock = {}; Object.keys(rec.materials).forEach(k => stock[k] = rec.materials[k]);
console.log(JSON.stringify({
  atkGain: armed.atk - bare.atk, defGain: armed.def - bare.def, hpGain: armed.maxHp - bare.maxHp, spdGain: armed.spd - bare.spd,
  craftOkExact: L.canCraft(rec, stock, rec.coins).ok,
  craftBlockedEmpty: L.canCraft(rec, {}, 0).ok,
  recipeCount: L.allRecipes().length,
  everyGearHasSlot: Object.values(L.GEAR).every(g => L.GEAR_SLOTS.includes(g.slot)),
  pityForcesRare: (() => { const g = L.rollGear('map_cache', core.seededRandom('pity'), { rareMisses: L.PITY_RARE_CAP });
    return L.rarityIndex(L.gearById(g.id).rarity) >= L.rarityIndex('rare'); })()
}));
""")
    assert payload["atkGain"] == 12 and payload["defGain"] == 10
    assert payload["hpGain"] == 18 and payload["spdGain"] == 7
    assert payload["craftOkExact"] is True and payload["craftBlockedEmpty"] is False
    assert payload["recipeCount"] == 30  # + spells & potions since the bird equipment screen
    assert payload["everyGearHasSlot"] is True
    assert payload["pityForcesRare"] is True


def test_liberation_loot_always_includes_gear():
    payload = _node("""
const core = require('./battle_core.js');
const L = require('./loot_crafting_core.js');
const results = [];
for (let i = 0; i < 12; i++) {
  const drops = L.rollLoot('liberation', { rng: core.seededRandom('lib' + i), tier: 2 });
  results.push(drops.some(d => d.kind === 'gear'));
}
console.log(JSON.stringify({ allHaveGear: results.every(Boolean) }));
""")
    assert payload["allHaveGear"] is True


def test_index_wires_skyclash_forge_and_magic_stat():
    html = INDEX.read_text(encoding="utf-8")
    # squad arena + forge screens exist and scripts are loaded
    assert 'id="arenaTimeline"' in html
    assert 'id="arenaFocus"' in html
    assert 'id="screen-forge"' in html
    assert "loot_crafting_core.js" in html
    assert "battleToggleSurge" in html
    # magic stat generated from biology and shown on cards
    assert "mag: clamp(mag, 10, 999)" in html
    assert 'card-back-stat-label">MAG' in html
    # overworld loot: gear caches and relic chests spawn on the walking map
    assert "id:'gearcache'" in html
    assert "id:'relic'" in html
    assert "rollLoot('map_relic'" in html
    # empire loot: liberation spoils, armoury on claim, tribute materials
    assert "rollLoot('tribute'" in html
    assert "guaranteeGear: true" in html
