"""Different towns build at the same time; one project per town.

The construction lock lives on each village's own economy record
(`eco.construction`), so starting a project in one town must never block a
project starting in another. These tests run the REAL empireBuildStructure /
ensureVillageEconomy code in Node against two seeded towns, and pin the
player-facing copy that explains the rule (a bare "one project at a time"
toast read as a global limit — it is not).
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def build_harness() -> str:
    html = HTML.read_text(encoding="utf-8")
    buildings = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "villageBuildTimeMs",
            "villageConstructionFor",
            "ensureVillageEconomy",
            "villageBuildingCost",
            "empireBuildStructure",
        )
    )
    stubs = """
global.window = global;
const toasts = [];
const gameState = { player: { coins: 5000, branches: 5000 } };
const empire = { villages: {} };
const ensureEmpireState = () => empire;
const empireCompleteConstructions = () => false;
const villageRuinDefsFor = () => [];
const villageRngFrom = () => () => 0.5;
const VILLAGE_RUIN_KINDS = { house: {} };
const VILLAGE_BASE_POPULATION = 0, VILLAGE_MAX_POPULATION = 60;
const EMPIRE_NEEDS = [];
const playerBranches = () => gameState.player.branches;
const addCoins = n => { gameState.player.coins += n; };
const addBranches = n => { gameState.player.branches += n; };
const saveState = () => {}; const updateHeader = () => {}; const renderVillage = () => {};
const SFX = { questComplete: () => {} }; const vibrate = () => {};
const showToast = t => toasts.push(t);
const formatBuildDuration = () => 'soon';
let villageActive = null, villageBuiltSeed = null;
"""
    driver = """
empire.villages['1111'] = { seed: 1111, name: 'Testham A', lat: 53.2, lon: -2.5, claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
empire.villages['2222'] = { seed: 2222, name: 'Testham B', lat: 53.3, lon: -2.6, claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
empireBuildStructure(1111, 'farm');       // town A starts a project
empireBuildStructure(2222, 'cottages');   // town B must start CONCURRENTLY
empireBuildStructure(1111, 'well');       // same town again must be refused
console.log(JSON.stringify({
  townA: empire.villages['1111'].economy.construction?.id || null,
  townB: empire.villages['2222'].economy.construction?.id || null,
  toasts
}));
"""
    return stubs + buildings + "\n" + functions + "\n" + driver


def run_harness():
    result = subprocess.run(["node", "-e", build_harness()], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_two_towns_build_concurrently_but_one_town_holds_one_project():
    out = run_harness()
    # Both towns hold live constructions at the same time...
    assert out["townA"] == "farm"
    assert out["townB"] == "cottages"
    # ...and the refusal was for the SAME-town second project only.
    refusals = [t for t in out["toasts"] if "still raising" in t]
    assert len(refusals) == 1
    assert "Testham A" in refusals[0]


def test_construction_lock_is_stored_per_village_record():
    html = HTML.read_text(encoding="utf-8")
    build = function_source(html, "empireBuildStructure")
    # The busy check reads the TARGET village's own economy — no global flag.
    assert "const eco = ensureVillageEconomy(rec);" in build
    assert "if (eco.construction) {" in build
    assert "eco.construction = { id: building.id" in build


def test_player_facing_copy_says_the_limit_is_per_town():
    html = HTML.read_text(encoding="utf-8")
    # The refusal toast names the town and says other towns can keep building.
    assert "one project per town. Your other towns can build meanwhile." in html
    # The Construction Yard header makes the same promise while builders work.
    assert "builders busy here — other towns can still build" in html
    assert "' · builders busy'" not in html
