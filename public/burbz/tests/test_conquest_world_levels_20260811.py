"""Conquest raises the world level, and the world fights back.

Classic RPG progression tied to the empire: every liberated village, county,
duchy and kingdom raises the WORLD LEVEL (world_level_core.js). Liberation
garrisons fight at the level their land is stamped with — world level plus a
distance band from the cradle, the first village ever freed — and the atlas
marks every dark village with a recommended level and a danger colour, the way
the newer Assassin's Creed maps do. The Fletcher's Forge itself now levels up:
higher hearths open deeper rarities to craft and hone all equipped gear to the
forge's level. Beating a high-level garrison pays scaled rewards.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "conquest-world-levels-v248-20260811"
PREVIOUS_RELEASE_PIN = "battle-faint-auto-hospital-v247-20260811"
CURRENT_BUILD = "iron-ingot-errand-v326-20260825"


def run_node(script: str):
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    return json.loads(run.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_world_level_climbs_with_every_rung_of_the_realm():
    out = run_node("""
const W = require('./world_level_core.js');
console.log(JSON.stringify({
  fresh: W.worldLevel({}),
  villages: W.worldLevel({ villages: 3 }),
  county: W.worldLevel({ villages: 3, counties: 1 }),
  duchy: W.worldLevel({ villages: 6, counties: 2, duchies: 1 }),
  kingdom: W.worldLevel({ villages: 12, counties: 4, duchies: 2, kingdoms: 1 }),
  empire: W.worldLevel({ villages: 12, counties: 4, duchies: 2, kingdoms: 2, empires: 1 }),
  capped: W.worldLevel({ villages: 500 }),
  cap: W.WORLD_LEVEL_CAP
}));
""")
    assert out["fresh"] == 1
    assert out["villages"] == 4          # 1 + 3 villages
    assert out["county"] == 6            # + county weight 2
    assert out["duchy"] == 15            # 1 + 6 + 4 + 4
    assert out["kingdom"] > out["duchy"]
    assert out["empire"] > out["kingdom"]
    assert out["capped"] == out["cap"] == 50


def test_the_far_frontier_always_fights_hardest():
    out = run_node("""
const W = require('./world_level_core.js');
console.log(JSON.stringify({
  bands: W.DISTANCE_BANDS.map(b => b.add),
  home: W.siteRecommendedLevel(6, 1),
  marches: W.siteRecommendedLevel(6, 30),
  far: W.siteRecommendedLevel(6, 5000),
  nullDist: W.siteRecommendedLevel(6, null),
  capped: W.siteRecommendedLevel(49, 5000)
}));
""")
    # Bands only ever get harder with distance.
    assert out["bands"] == sorted(out["bands"])
    assert out["home"] == 6
    assert out["marches"] == 8
    assert out["far"] == 14
    assert out["nullDist"] == 6          # unknown distance stays honest, not brutal
    assert out["capped"] == 50


def test_danger_ratings_call_the_odds_in_plain_words():
    out = run_node("""
const W = require('./world_level_core.js');
const at = (rec, flock) => W.dangerRating(rec, flock).id;
console.log(JSON.stringify({
  stroll: at(2, 5), fairLow: at(3, 5), fairHigh: at(6, 5),
  hardLow: at(7, 5), hardHigh: at(9, 5), deadly: at(10, 5),
  icons: W.DANGER_RATINGS.map(r => r.icon),
  flock: W.flockBattleLevel([10, 8, 2, 4, 1]),
  emptyFlock: W.flockBattleLevel([])
}));
""")
    assert out["stroll"] == "stroll"
    assert out["fairLow"] == "fair" and out["fairHigh"] == "fair"
    assert out["hardLow"] == "hard" and out["hardHigh"] == "hard"
    assert out["deadly"] == "deadly"
    assert "💀" in out["icons"]
    assert out["flock"] == 6             # average of the four strongest
    assert out["emptyFlock"] == 1


def test_forge_levels_gate_rarities_and_temper_all_gear():
    out = run_node("""
const L = require('./loot_crafting_core.js');
console.log(JSON.stringify({
  minLevels: ['common','uncommon','rare','epic','legendary'].map(L.minForgeLevelForRarity),
  legendaryAt3: L.canForgeAtLevel('sunlance_talons', 3),
  legendaryAt4: L.canForgeAtLevel('sunlance_talons', 4),
  costs: L.FORGE_UPGRADE_COSTS.length,
  atSummit: L.forgeUpgradeCost(L.FORGE_MAX_LEVEL),
  broke: L.canUpgradeForge(1, {}, 0, 0),
  mult1: L.temperMultiplier(1),
  mult5: L.temperMultiplier(5),
  sunlance5: L.temperedStats('sunlance_talons', 5),
  plain: L.equipmentBonuses({ weapon:'bronze_spurs' }),
  lv1: L.equipmentBonuses({ weapon:'bronze_spurs' }, { gearLevel: 1 }),
  lv3: L.equipmentBonuses({ weapon:'bronze_spurs' }, { gearLevel: 3 }),
  satchelLv5: L.equipmentBonuses({ trinket:'stormweave_satchel' }, { gearLevel: 5 }).carryBonus
}));
""")
    assert out["minLevels"] == [1, 1, 2, 3, 4]
    assert out["legendaryAt3"] is False and out["legendaryAt4"] is True
    assert out["costs"] == 4 and out["atSummit"] is None
    assert not out["broke"]["ok"] and any("coins" in m for m in out["broke"]["missing"])
    assert out["mult1"] == 1 and abs(out["mult5"] - 1.48) < 1e-9
    assert out["sunlance5"]["atk"] == 53 and out["sunlance5"]["critBonus"] == 0.13
    # A cold anvil changes nothing: no option, and gearLevel 1, are byte-alike.
    assert out["plain"] == out["lv1"]
    assert out["plain"]["atk"] == 12 and out["lv3"]["atk"] == 15
    # A bag is a bag — tempering never touches carry bonuses.
    assert out["satchelLv5"] == 3


def test_beating_a_high_level_garrison_pays_scaled_rewards():
    out = run_node("""
const B = require('./battle_core.js');
console.log(JSON.stringify({
  classic: B.battleRewards(2, 'player', {}),
  lv1: B.battleRewards(2, 'player', { opponentLevel: 1 }),
  lv11: B.battleRewards(2, 'player', { opponentLevel: 11 }),
  loss: B.battleRewards(2, 'opponent', { opponentLevel: 11 })
}));
""")
    classic = out["classic"]
    # No opponentLevel (or level 1) keeps the exact classic payouts.
    assert classic == out["lv1"]
    assert (classic["coins"], classic["branches"], classic["birdXp"], classic["playerXp"]) == (24, 4, 36, 50)
    lv11 = out["lv11"]
    assert (lv11["coins"], lv11["birdXp"], lv11["playerXp"]) == (34, 50, 70)  # ×1.4
    assert out["loss"]["coins"] == 4     # defeat stays a consolation, never a payday


def test_liberation_garrisons_fight_at_their_lands_stamped_level():
    html = HTML_PATH.read_text(encoding="utf-8")
    gen = function_source(html, "leagueRivalOpponents")
    assert "empireSiteRecommendedLevel(liberationSite)" in gen
    assert "Math.max(Math.round(avgLevel), worldLv)" in gen
    # The early game stays a near-certain win — pinned alongside
    # test_early_game_easy_battles.
    assert "Math.max(1, Math.round(avgLevel) - 1)" in gen
    # A new world level or a different liberation target re-rolls the squad.
    assert "'_wl' + worldLv" in gen
    # The world level itself is derived from the whole realm pyramid.
    progress = function_source(html, "burbzConquestProgress")
    for key in ("villages:", "counties:", "duchies:", "kingdoms:", "empires:"):
        assert key in progress, key
    cradle = function_source(html, "empireCradleVillage")
    assert "claimedAt" in cradle


def test_battle_select_shows_honest_odds_and_results_pay_by_level():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "rival-danger-line" in html
    assert "Garrison Lv " in html
    assert "World Lv " in html
    assert "your flock Lv " in html
    end = function_source(html, "endPerchBattle")
    assert "opponentLevel" in end
    assert "swayed: swayedCount, opponentLevel" in end


def test_the_forge_upgrades_and_hones_the_whole_armoury():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "function renderForgeUpgradePanel()" in html
    assert "function upgradeForge()" in html
    assert "UPGRADE THE FORGE" in html
    assert "gameState.forgeLevel = lv + 1" in html
    # Locked recipes say exactly which hearth they need.
    assert "🔒 FORGE LV " in html
    craft = function_source(html, "craftGear")
    assert "canForgeAtLevel(item, burbzForgeLevel())" in craft
    # Equipped gear fights at the forge's level.
    bonuses = function_source(html, "birdGearBonuses")
    assert "gearLevel: burbzForgeLevel()" in bonuses
    stat_line = function_source(html, "forgeGearStatLine")
    assert "temperedStats(item, forgeLv)" in stat_line
    # Inline onclick handlers only see window-exported functions.
    assert "cancelForgeJob, upgradeForge," in html


def test_the_atlas_stamps_dark_villages_with_recommended_levels():
    html = HTML_PATH.read_text(encoding="utf-8")
    refresh = function_source(html, "refreshEmpireMap")
    assert "empireSiteRecommendedLevel(village)" in refresh
    assert "danger-' + danger.id" in refresh
    assert "Recommended Lv " in refresh
    assert "' LV ' + rec" in refresh
    # The key teaches the colours; the status line carries the world level.
    assert "LV on a dark banner" in html
    assert "World Lv ' + burbzWorldLevel()" in html
    assert ".empire-map-marker.is-frontier.danger-deadly" in html


def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # battle_core moved with v258 (Night Wings), then with v287 (attack preview),
    # and the loot core with v295 (the Stores market); the world-level core
    # still ships under this release.
    for asset, core_pin in (("world_level_core.js", OWN_RELEASE_PIN),
                            ("battle_core.js", "mercy-streak-attack-preview-v287-20260819"),
                            ("loot_crafting_core.js", "magpie-market-v316-20260824")):
        pin = f"{asset}?v={core_pin}"
        assert pin in html, pin
        assert f"'./{pin}'" in sw, pin
    # The new core rides both SW lists and the live updater's manifest.
    assert sw.count(f"'./world_level_core.js?v={OWN_RELEASE_PIN}'") == 2
    updater = UPDATER_PATH.read_text(encoding="utf-8")
    assert '"world_level_core.js"' in updater
