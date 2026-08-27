"""Honest need gauges: the bars read what is actually built.

Yaan's report (2026-08-20, with a screenshot): a village with no well and no
farm showed Food 3/3 and Water 3/3, full and green — the relief stores were
filling the bars. Pinned as `honest-need-gauges-v296`:

- The food and water GAUGES read only what the built, staffed farms and
  wells supply each cycle. No well → empty water bar, however full the
  cistern still is. The number beside the bar counts the same truth.
- The SIM is unchanged on purpose: `sat` still reads harvest + stores, so
  relief supplies really do feed the first settlers, keep happiness up and
  hold starvation off. Two truths, kept apart: the gauge shows the
  infrastructure, the sublabel tells the stores story ("villagers live off
  the granary…", amber while they do).
- Shelter and joy already gauged built capacity; they now carry the same
  supply fields so every bar reads one way.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "honest-need-gauges-v296-20260820"
CURRENT_BUILD = "walk-detection-removed-v334-20260827"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def snapshot_harness(probe: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    consts = html[html.index("const EMPIRE_TRIBUTE_INTERVAL_MS"):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "villageNeedCapacity",
            "villageStoreCapacity",
            "villageProvisionRates",
            "villageWorkforce",
            "villageCrewShare",
            "villageProductionSnapshot",
            "villageBuildingLevel",
            "mergeResourceTotals",
            "villageEconomySnapshot",
        )
    )
    stubs = """
global.window = global;
const gameState = { player: {} };
const ensureVillageEconomy = rec => rec.economy;
const villageRoleMultiplier = () => 1;
const regionRoleMultiplier = () => 1;
const empireRegionOfSeed = () => null;
const empireSettlementOfSeed = () => null;
const realmCore = () => null;
const village = (population, buildings, stores) => ({ seed: 7, economy: { population, buildings, stores } });
"""
    return consts + "\n" + stubs + functions + "\n" + probe


def test_relief_stores_feed_the_sim_but_never_fill_the_gauge():
    out = run_node(snapshot_harness("""
// Yaan's screenshot: 3 settlers, one cabin, NO farm, NO well — but the
// liberation relief supplies (30 food, 30 water) still sit in the cellar.
const snap = villageEconomySnapshot(village(3, { cabin: 1 }, { food: 30, water: 30 }));
const byId = Object.fromEntries(snap.needs.map(n => [n.id, n]));
console.log(JSON.stringify({
  food:    { sat: byId.food.sat,    gauge: byId.food.supplySat,    servedGauge: byId.food.supplyServed },
  water:   { sat: byId.water.sat,   gauge: byId.water.supplySat,   servedGauge: byId.water.supplyServed },
  shelter: { sat: byId.shelter.sat, gauge: byId.shelter.supplySat, servedGauge: byId.shelter.supplyServed },
  happiness: snap.happiness
}));
"""))
    # The sim: everyone is fed and watered from the stores — that keeps
    # happiness and growth exactly as designed.
    assert out["food"]["sat"] == 1 and out["water"]["sat"] == 1
    # The gauge: nothing is built, so the bars stand empty at 0/3.
    assert out["food"]["gauge"] == 0 and out["food"]["servedGauge"] == 0
    assert out["water"]["gauge"] == 0 and out["water"]["servedGauge"] == 0
    # Shelter reads the real cabin: 3 of 3 sheltered under 6 roofs.
    assert out["shelter"]["gauge"] == 1 and out["shelter"]["servedGauge"] == 3
    # Happiness still counts the meals (3 of 4 needs met; joy is 0).
    assert round(out["happiness"], 4) == 0.7059  # v310: joy weighs 1.25, so no tavern means no 75%


def test_a_staffed_well_and_farm_fill_the_gauges_for_real():
    out = run_node(snapshot_harness("""
// Same village after building: a staffed farm (feeds 14) and a well (16).
const snap = villageEconomySnapshot(village(3, { cabin: 1, farm: 1, well: 1 }, { food: 5, water: 5 }));
const byId = Object.fromEntries(snap.needs.map(n => [n.id, n]));
// And a farm with NO farmhand goes back to an empty food gauge.
const idle = villageEconomySnapshot(village(0, { farm: 1, well: 1 }, { food: 0, water: 0 }));
const idleById = Object.fromEntries(idle.needs.map(n => [n.id, n]));
console.log(JSON.stringify({
  food: byId.food.supplySat, water: byId.water.supplySat,
  idleFood: idleById.food.supplySat, idleWater: idleById.water.supplySat
}));
"""))
    assert out["food"] == 1 and out["water"] == 1
    # No villagers: the farm has no hands (rate 0), the well flows on its own.
    assert out["idleFood"] == 0 and out["idleWater"] == 1


def test_both_desks_draw_the_gauge_not_the_meal():
    html = HTML.read_text(encoding="utf-8")
    village_panel = function_source(html, "renderVillageManagePanel")
    assert "n.supplySat" in village_panel
    assert "Math.min(snap.pop, gaugeServed)" in village_panel
    assert "villagers live off the" in village_panel  # the borrowed-time sublabel
    town_screen = function_source(html, "renderTownScreen")
    assert "need.supplySat" in town_screen
    # The Town's aggregate rolls the same supply numbers up from its wards.
    town_snap = function_source(html, "townEconomySnapshot")
    assert "supplyServed" in town_snap and "supplySat" in town_snap
    # Happiness and the shortage warning still run on the meal truth.
    snap = function_source(html, "villageEconomySnapshot")
    assert "needs.reduce((sum, n) => sum + n.sat * (n.weight || 1), 0) / needWeight;" in snap
    assert "n.sat < 1" in village_panel


def test_release_is_versioned_for_service_worker_self_update():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert RELEASE in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
