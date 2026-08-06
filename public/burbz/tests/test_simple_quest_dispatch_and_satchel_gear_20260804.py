"""Quest dispatch stays simple; Forge satchels increase carried loot.

The send sheet asks only for duration and bird. Provisions/lucky charms are not
spent or selected there. Satchels are durable Forge enhancements equipped on a
bird and automatically improve expedition carrying capacity.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def _node(script: str):
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def _function_body(name: str) -> str:
    start = HTML.index(f"function {name}(")
    next_fn = HTML.find("\nfunction ", start + 1)
    return HTML[start : next_fn if next_fn != -1 else len(HTML)]


def test_dispatch_sheet_only_asks_for_duration_and_bird():
    render = _function_body("renderQuestSendSheet")
    assert "Choose duration" in render
    assert "Choose a bird" in render
    for removed in (
        "Provision <span",
        "Lucky charm <span",
        "provisionChips",
        "charmChips",
        "toggleQuestEquip",
    ):
        assert removed not in render

    state_line = next(line for line in HTML.splitlines() if line.startswith("let questSendState ="))
    assert "templateId" in state_line and "durationMinutes" in state_line and "birdId" in state_line
    assert "provision" not in state_line and "charm" not in state_line
    assert "function toggleQuestEquip(" not in HTML


def test_new_dispatch_does_not_spend_food_or_charms():
    start = _function_body("startBirdExpedition")
    confirm = _function_body("confirmQuestSend")
    assert "gameState.pantry[" not in start
    assert "gameState.inventory.items[" not in start
    assert "quest.equipment" not in start
    assert "durationMinutes: questSendState.durationMinutes" in confirm
    assert "provision:" not in confirm and "charm:" not in confirm


def test_legacy_active_quests_keep_their_already_paid_bonus_for_save_compatibility():
    claim = _function_body("claimBirdExpedition")
    assert "q.equipment || {}" in claim
    assert "equipment.provision" in claim
    assert "equipment.charm" in claim
    assert "legacy" in claim.lower()


def test_forge_has_five_craft_only_satchel_enhancements():
    payload = _node(
        """
const L = require('./loot_crafting_core.js');
const satchels = L.gearBySlot('trinket').filter(x => x.kind === 'satchel');
const rolls = Array.from({length:250}, (_, i) => {
  const seq = [((i * 37) % 251) / 251, ((i * 91 + 7) % 251) / 251];
  let n = 0;
  return L.rollGear('map_cache', () => seq[n++ % seq.length], {rareMisses:0}).id;
});
console.log(JSON.stringify({
  count: satchels.length,
  bonuses: satchels.map(x => x.carryBonus),
  craftOnly: satchels.every(x => x.craftOnly === true),
  craftable: satchels.every(x => L.recipeFor(x.id) && L.recipeFor(x.id).coins > 0),
  names: satchels.map(x => x.label),
  randomDropsContainSatchel: rolls.some(id => satchels.some(x => x.id === id))
}));
"""
    )
    assert payload["count"] == 5
    assert payload["bonuses"] == [1, 2, 3, 4, 5]
    assert payload["craftOnly"] is True
    assert payload["craftable"] is True
    assert all("Satchel" in name for name in payload["names"])
    assert payload["randomDropsContainSatchel"] is False


def test_equipped_satchel_automatically_increases_carry_limit():
    payload = _node(
        """
const L = require('./loot_crafting_core.js');
const S = require('./bird_size_core.js');
const bird = {sizeScore:0, stamina:50, level:1};
const rewards = {branches:30, items:{oak_twig:8}};
const bonuses = L.equipmentBonuses({trinket:'stormweave_satchel'});
const base = S.applyCarryLimit(rewards, bird);
const packed = S.applyCarryLimit(rewards, bird, bonuses.carryBonus);
console.log(JSON.stringify({
  carryBonus: bonuses.carryBonus,
  baseCapacity: base.capacity,
  packedCapacity: packed.capacity,
  baseUnits: base.unitsUsed,
  packedUnits: packed.unitsUsed,
  leavesLessBehind: packed.leftBehind < base.leftBehind
}));
"""
    )
    assert payload == {
        "carryBonus": 3,
        "baseCapacity": 1,
        "packedCapacity": 4,
        "baseUnits": 1,
        "packedUnits": 4,
        "leavesLessBehind": True,
    }


def test_host_applies_and_displays_equipped_satchel_capacity():
    carry = _function_body("applyExpeditionCarryLimit")
    summary = _function_body("birdSizeSummary")
    assert "birdGearBonuses(bird).carryBonus" in carry
    assert "applyCarryLimit(quest.rewards, bird, carryBonus)" in carry
    assert "birdGearBonuses(bird).carryBonus" in summary
    stat_line = _function_body("forgeGearStatLine")
    assert "carryBonus" in stat_line
    assert "🎒 carries +" in stat_line
    assert "🎒 Satchels — carry more quest loot" in HTML
    assert "carry more home from quests" in HTML


def test_satchel_release_assets_are_versioned_for_installed_pwa():
    size_version = "forge-satchels-v220-20260804"
    loot_version = "turn-potions-v232-20260806"
    assert f"bird_size_core.js?v={size_version}" in HTML
    assert f"loot_crafting_core.js?v={loot_version}" in HTML
    assert f"'./bird_size_core.js?v={size_version}'" in SW
    assert f"'./loot_crafting_core.js?v={loot_version}'" in SW
    # BURBZ_BUILD tracks the NEWEST release marker; later releases move it on,
    # but this release's own segment stays in the cache lineage forever.
    assert size_version in next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE = "))
