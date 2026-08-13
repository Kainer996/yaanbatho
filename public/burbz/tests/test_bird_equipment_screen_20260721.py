"""Tap a companion bird -> classic RPG equipment screen.

Players equip weapons, armour, enhancements (trinkets), spells and potions on
a bird. Spells grant an extra battle skill; potions are bonus actions on that
bird's player turn and restock from the bag for the next battle.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CORE = (ROOT / "loot_crafting_core.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def _node(script):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


# ---------------------------------------------------------------------------
# Item catalogue: spells and potions join weapons, armour and enhancements
# ---------------------------------------------------------------------------

def test_loot_core_gains_spell_and_potion_slots():
    payload = _node("""
const L = require('./loot_crafting_core.js');
const spells = L.gearBySlot('spell'), potions = L.gearBySlot('potion');
console.log(JSON.stringify({
  slots: L.GEAR_SLOTS,
  spellCount: spells.length, potionCount: potions.length,
  spellRarities: [...new Set(spells.map(s => s.rarity))].length,
  everySpellHasSkill: spells.every(s => s.spell && s.spell.cd > 0),
  everyPotionHasEffect: potions.every(p => p.battle && Object.keys(p.battle).length > 0),
  bonusesIgnoreEmptyStats: (() => { const b = L.equipmentBonuses({ spell:'ember_wisp', potion:'phoenix_elixir' });
    return Object.values(b).every(v => v === 0); })(),
  everyNewItemCraftable: [...spells, ...potions].every(i => L.recipeFor(i.id) && L.recipeFor(i.id).coins > 0),
  powerScorePositive: [...spells, ...potions].every(i => L.gearPowerScore(i) > 0)
}));
""")
    assert payload["slots"] == ["weapon", "armour", "trinket", "spell", "potion"]
    assert payload["spellCount"] == 5 and payload["potionCount"] == 5
    assert payload["spellRarities"] == 5
    assert payload["everySpellHasSkill"] is True
    assert payload["everyPotionHasEffect"] is True
    assert payload["bonusesIgnoreEmptyStats"] is True
    assert payload["everyNewItemCraftable"] is True
    assert payload["powerScorePositive"] is True


def test_spell_scrolls_become_real_battle_skills():
    payload = _node("""
const core = require('./battle_core.js');
const L = require('./loot_crafting_core.js');
const f = core.buildFighter({ id:'a', species:'Tawny Owl', maxHp:90, hp:90, atk:55, def:50, spd:52, stamina:60 });
const skill = L.spellSkillFor('frost_sigil');
f.skills.splice(Math.max(1, f.skills.length - 1), 0, { ...skill, cdLeft:0 });
const foe = core.buildOpponentFighter({ id:'e', species:'Grudge Pigeon', maxHp:90, hp:90, atk:50, def:45, spd:48, stamina:60 }, 0, 'seed');
const b = core.createBattle({ playerFighters:[f], opponentFighters:[foe], seed:'spelltest', tier:0 });
let cast = false, guard = 0;
while (core.teamAlive(b, 'player') && core.teamAlive(b, 'opponent') && guard++ < 80) {
  core.tickToNextTurn(b);
  if (!b.acting) break;
  if (b.acting.side === 'player') {
    const acts = core.availableActions(b);
    const i = acts.findIndex(a => a.usable && a.skill.fromSpellScroll);
    if (i >= 0) cast = true;
    core.resolveAction(b, { skillIndex: i >= 0 ? i : acts.findIndex(a => a.usable), targetIndex: 0 });
  } else core.resolveAction(b, core.aiChooseAction(b));
}
console.log(JSON.stringify({ cast, healSpellIsHeal: L.spellSkillFor('phoenix_chorus').kind === 'heal',
  spellUsesMagic: skill.stat === 'mag', nullForNonSpell: L.spellSkillFor('thorn_talons') === null }));
""")
    assert payload["cast"] is True
    assert payload["healSpellIsHeal"] is True
    assert payload["spellUsesMagic"] is True
    assert payload["nullForNonSpell"] is True


def test_potion_effects_cover_heal_barrier_buffs_and_meter():
    payload = _node("""
const L = require('./loot_crafting_core.js');
const elixir = L.potionEffectFor('phoenix_elixir');
const philtre = L.potionEffectFor('stormwing_philtre');
console.log(JSON.stringify({
  heals: elixir.healPct > 0, shields: elixir.barrierPct > 0, buffs: elixir.mods.length >= 2,
  meterStart: philtre.crStart > 0, nullForNonPotion: L.potionEffectFor('reed_vest') === null
}));
""")
    assert all(payload[k] is True for k in ("heals", "shields", "buffs", "meterStart", "nullForNonPotion"))


# ---------------------------------------------------------------------------
# The tap-on-bird RPG equipment screen
# ---------------------------------------------------------------------------

def test_equipment_overlay_exists_with_rpg_anatomy():
    assert 'id="birdEquipOverlay"' in HTML
    assert 'id="birdEquipBody"' in HTML
    assert ".bird-equip-overlay { position:fixed; inset:0;" in HTML
    for fn in ("function openBirdEquip(", "function closeBirdEquip(", "function renderBirdEquip(",
               "function birdEquipOpenSlot(", "function birdEquipSet(", "function birdEquipClear("):
        assert fn in HTML
    # classic RPG anatomy: hero portrait, stat grid, slot grid, item picker
    for marker in ("bird-equip-hero", "bird-equip-stats", "bird-equip-slots", "bird-equip-picker"):
        assert marker in HTML


def test_all_five_equip_categories_are_presented():
    assert "const EQUIP_SLOT_ORDER = ['weapon', 'armour', 'trinket', 'spell', 'potion'];" in HTML
    # trinkets are surfaced to the player as Enhancements
    assert "label: 'Enhancement'" in HTML
    assert "label: 'Spell'" in HTML
    assert "label: 'Potion'" in HTML
    # the forge craft tab groups the new categories too
    assert "label:'📜 Spells — scrolls & sigils'" in HTML
    assert "label:'🧪 Potions — battle brews'" in HTML


def test_tapping_your_bird_opens_the_screen_from_the_main_surfaces():
    # Birdex companion card: the bird art itself is the tap target
    assert 'data-action="open-equip"' in HTML
    assert '<div class="card-art" data-action="open-equip"' in HTML
    assert "openBirdEquip(equipTarget.dataset.birdId || card.dataset.birdId)" in HTML
    # battle squad picker: gear badge on every pick-card
    assert 'class="pk-equip"' in HTML
    assert ".pk-equip { position:absolute;" in HTML
    # field-guide modal offers the equipment screen
    assert "⚔️ Equipment" in HTML
    # inline onclick handlers can reach the API
    exported = "".join(part.split("});", 1)[0] for part in HTML.split("Object.assign(window, {")[1:])
    for fn in ("openBirdEquip", "closeBirdEquip", "birdEquipOpenSlot", "birdEquipSet", "birdEquipClear"):
        assert fn in exported


def test_equip_actions_share_one_bag_aware_code_path():
    assert "function equipItemOnBird(birdId, slot, gearId)" in HTML
    assert "function unequipItemFromBird(birdId, slot)" in HTML
    # the forge reuses the same plumbing instead of duplicating it
    assert "if (!equipItemOnBird(forgeState.birdId, slot, gearId)) return;" in HTML
    assert "if (!unequipItemFromBird(forgeState.birdId, slot)) return;" in HTML


# ---------------------------------------------------------------------------
# Battle wiring: spells join the skill bar; potions wait for a player turn
# ---------------------------------------------------------------------------

def test_battle_start_prepares_spells_and_player_turn_potions():
    assert "function applyEquippedSpell(fighter, bird)" in HTML
    assert "function prepareEquippedPotion(fighter, bird)" in HTML
    assert "function consumeEquippedPotion(bird)" in HTML
    assert "applyEquippedSpell(f, b);" in HTML
    assert "prepareEquippedPotion(f, b);" in HTML
    assert "function battleUsePotion()" in HTML


def test_drunk_potions_restock_from_the_bag():
    start = HTML.index("function consumeEquippedPotion(bird)")
    fn = HTML[start:HTML.index("\nfunction ", start + 1)]
    assert "delete loadout.potion;" in fn
    assert "if ((bag[id] || 0) > 0) { bag[id] -= 1; loadout.potion = id; }" in fn


# ---------------------------------------------------------------------------
# PWA cache: new item catalogue must actually reach installed players
# ---------------------------------------------------------------------------

def test_loot_core_version_is_bumped_and_consistent():
    pin = 'loot_crafting_core.js?v=conquest-world-levels-v248-20260811'
    assert pin in HTML
    assert f"'./{pin}'" in SW
    assert "fletchers-forge-20260719" not in HTML
    assert "fletchers-forge-20260719" not in SW
    assert "const BURBZ_CACHE = 'burbz-" in SW
