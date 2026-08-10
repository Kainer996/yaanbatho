"""Battle potions are player-turn consumables and remain craftable/buyable."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def _node(source: str):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_core_applies_turn_potions_without_ending_the_turn():
    out = _node(r"""
const B = require('./battle_core.js');
const fighter = { name:'Robin', hp:40, maxHp:100, barrier:0, cr:100, mods:[], fainted:false };
const heal = B.applyPotionEffect(fighter, { healPct:0.3 });
const power = B.applyPotionEffect(fighter, { mods:[{stat:'atk',pct:0.15,turns:3},{stat:'mag',pct:0.15,turns:3}] });
const wind = B.applyPotionEffect(fighter, { crStart:0.35 });
console.log(JSON.stringify({
  healed: heal.healed,
  hp: fighter.hp,
  atkPct: fighter.mods.find(m => m.stat === 'atk').pct,
  turns: fighter.mods.find(m => m.stat === 'atk').turns,
  carry: fighter.potionCrCarry,
  usefulAtFullHp: B.canUsePotionEffect({...fighter, hp:100}, {healPct:0.3}),
  powerUsefulAtFullHp: B.canUsePotionEffect({...fighter, hp:100}, {mods:[{stat:'atk',pct:0.15,turns:3}]})
}));
""")
    assert out == {
        "healed": 30,
        "hp": 70,
        "atkPct": 0.15,
        "turns": 4,  # one is spent by the skill taken immediately after drinking
        "carry": 35,
        "usefulAtFullHp": False,
        "powerUsefulAtFullHp": True,
    }


def test_turn_meter_potion_carries_readiness_into_the_next_turn():
    out = _node(r"""
const B = require('./battle_core.js');
const bird = {id:'p',name:'Robin',species:'Robin',level:1,maxHp:100,hp:100,stats:{strength:5,def:5,spd:5,int:5,stamina:5}};
const foe = {id:'o',name:'Crow',species:'Crow',level:1,maxHp:100,hp:100,stats:{strength:5,def:5,spd:5,int:5,stamina:5}};
const p = B.buildFighter(bird), o = B.buildFighter(foe);
const battle = B.createBattle({playerFighters:[p],opponentFighters:[o],seed:'potion-turn'});
battle.acting = {side:'player',index:0}; battle.phase = 'act'; p.cr = 100;
B.applyPotionEffect(p, {crStart:0.35});
B.resolveAction(battle, {skillIndex:0,targetIndex:0});
console.log(JSON.stringify({cr:p.cr, carry:p.potionCrCarry || 0, phase:battle.phase}));
""")
    assert out == {"cr": 35, "carry": 0, "phase": "tick"}


def test_equipped_potions_are_carried_until_their_birds_turn():
    assert "function prepareEquippedPotion(fighter, bird)" in HTML
    assert "prepareEquippedPotion(f, b);" in HTML
    assert "function battleUsePotion()" in HTML
    assert "onclick=\"battleUsePotion()\"" in HTML
    assert "core.applyPotionEffect(me, me.potion.effect)" in HTML
    assert "if (!b.acting || b.acting.side !== 'player') return;" in HTML
    assert "consumeEquippedPotion(bird)" in HTML
    assert "applyEquippedPotion(playerFighters[i], b)" not in HTML
    assert "potionSips" not in HTML


def test_potion_button_explains_empty_used_and_ready_states():
    assert "No potion equipped · equip one at the Forge" in HTML
    assert "Potion already used this battle" in HTML
    assert "Drink as a bonus action · then choose a move" in HTML


def test_inline_potion_handler_is_exported_for_the_button():
    start = HTML.index("Object.assign(window, { academyBuildBuilding")
    exports = HTML[start:HTML.index("});", start)]
    assert "battleUsePotion" in exports


def test_potion_drink_rolls_back_when_durable_save_fails():
    start = HTML.index("function battleUsePotion()")
    fn = HTML[start:HTML.index("\nfunction ", start + 1)]
    assert "const stateSnapshot = snapshotGameState();" in fn
    assert "const fighterSnapshot = JSON.parse(JSON.stringify(me));" in fn
    assert "const saved = saveState();" in fn
    assert "if (!saved.ok)" in fn
    assert "restoreGameStateSnapshot(stateSnapshot);" in fn
    assert "restoreStateTree(me, fighterSnapshot);" in fn


def test_forge_describes_player_turn_potions_not_removed_opening_effects():
    assert "Drink on this bird’s turn · does not replace its move" in HTML
    assert "% HP when drunk" in HTML
    assert "Drunk automatically as battle begins" not in HTML
    assert "% HP at start" not in HTML


def test_all_battle_potions_remain_craftable_and_can_be_bought():
    out = _node(r"""
const L = require('./loot_crafting_core.js');
const potions = L.gearBySlot('potion');
console.log(JSON.stringify({
  ids:potions.map(p=>p.id),
  craftable:potions.every(p => { const r = L.recipeFor(p.id); return !!(r && r.coins > 0 && Object.keys(r.materials).length > 0); })
}));
""")
    expected = ["tonic_of_vigour", "nettle_brew", "barrier_draught", "stormwing_philtre", "phoenix_elixir"]
    assert out["ids"] == expected
    assert out["craftable"] is True
    potion_shop = HTML[HTML.index("  potion: {"):HTML.index("  smith: {")]
    for gear_id in expected:
        assert f"grantGear: '{gear_id}'" in potion_shop
    buy = HTML[HTML.index("function villageBuy("):HTML.index("// Map screen entry point")]
    assert "if (item.grantGear)" in buy
    assert "gameState.inventory.gear[item.grantGear]" in buy


def test_release_marker_and_potion_core_pin_are_advanced():
    marker = "living-canopy-v236-20260806"
    assert marker in HTML
    assert marker in SW
    # battle_core moved on with the any-size-squad release; loot stays put.
    pins = {
        "battle_core.js": "any-size-squad-v242-20260810",
        "loot_crafting_core.js": "turn-potions-v232-20260806",
    }
    for asset, core_pin in pins.items():
        pin = f"{asset}?v={core_pin}"
        assert pin in HTML
        assert f"'./{pin}'" in SW
