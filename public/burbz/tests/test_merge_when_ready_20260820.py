"""Merge when ready v290 — Yaan's village → town → region progression, 2026-08-20.

The contracts of this release:
1. Nothing merges on its own. A village earns its ⭐ merge star at 40 folk
   and 75% happiness; a town earns its star at 120 folk and 75% happiness.
   Three starred places within range merge only when the player presses
   Merge, which signs a charter in the save.
2. deriveSettlements/deriveRegions replay signed charters when charters are
   passed; without the option the old automatic rules still hold for legacy
   callers. Charters sleep until every member exists, never bind one seed
   twice, and pre-v290 automatic formations are grandfathered on migration.
3. The Town Hall and County Hall each carry ONE Upgrade order that raises
   every home and yard across the whole settlement — one cost, one clock
   (the longest single build, since crews work every ward in parallel).
4. Old villages and towns stay visitable: small Visit doors at the Hall,
   and a visiting banner with the road back.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
STORY_PATH = ROOT / "STORY.md"
MERGE_CORE_PATH = ROOT / "settlement_merge_core.js"
OWN_RELEASE_PIN = "merge-when-ready-v290-20260820"
PREVIOUS_RELEASE_PIN = "training-your-way-v288-20260819"
CURRENT_BUILD = "step-inside-buildings-v341-20260901"
MERGE_CORE_PIN = "village-work-huts-v311-20260824"  # last release to touch the core


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    fn_end = html.find("\nfunction ", start + 10)
    const_end = html.find("\nconst ", start + 10)
    ends = [e for e in (fn_end, const_end) if e > start]
    assert ends, name
    return html[start:min(ends)]


def run_node(source: str):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, capture_output=True, timeout=120
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---- 1. The merge star ------------------------------------------------------

def test_star_thresholds_are_forty_folk_and_seventy_five_happiness():
    out = run_node(
        "const mc=require('./settlement_merge_core.js');\n"
        "console.log(JSON.stringify({\n"
        "  pop:mc.TOWN_MERGE_MIN_POPULATION, happy:mc.TOWN_MERGE_MIN_HAPPINESS,\n"
        "  tPop:mc.REGION_MERGE_MIN_POPULATION, tHappy:mc.REGION_MERGE_MIN_HAPPINESS,\n"
        "  ready:mc.villageMergeReadiness({population:16,happiness:0.75}).ready,\n"
        "  short:mc.villageMergeReadiness({population:15,happiness:0.99}).ready,\n"
        "  glum:mc.villageMergeReadiness({population:200,happiness:0.74}).ready,\n"
        "  pct:mc.villageMergeReadiness({population:16,happiness:75}).ready,\n"
        "  town:mc.townMergeReadiness({population:120,happiness:0.75}).ready,\n"
        "  townShort:mc.townMergeReadiness({population:119,happiness:1}).ready}));"
    )
    assert out["pop"] == 16 and out["happy"] == 0.75  # v310: Yaan cut the village bar from 40
    assert out["tPop"] == 120 and out["tHappy"] == 0.75
    assert out["ready"] is True and out["town"] is True
    assert out["short"] is False and out["glum"] is False and out["townShort"] is False
    assert out["pct"] is True  # 0..100 happiness heals to 0..1


def test_candidates_need_three_ready_neighbours_and_a_free_charter():
    out = run_node(
        "const mc=require('./settlement_merge_core.js');\n"
        "const pts=[\n"
        "  {seed:1,name:'A',lat:53.00,lon:-2.0,claimedAt:'2026-08-01',ready:true},\n"
        "  {seed:2,name:'B',lat:53.01,lon:-2.0,claimedAt:'2026-08-02',ready:true},\n"
        "  {seed:3,name:'C',lat:53.02,lon:-2.0,claimedAt:'2026-08-03',ready:true},\n"
        "  {seed:4,name:'D',lat:53.03,lon:-2.0,claimedAt:'2026-08-04',ready:false}\n"
        "];\n"
        "const open=mc.mergeCandidates(pts,5,[]);\n"
        "const taken=mc.mergeCandidates(pts,5,[{seeds:[1,2,3],mergedAt:'x'}]);\n"
        "const verdictOk=mc.validateMerge(pts,5,[],[1,2,3]);\n"
        "const verdictUnready=mc.validateMerge(pts,5,[],[2,3,4]);\n"
        "const verdictFar=mc.validateMerge(pts.concat([{seed:9,name:'Z',lat:60,lon:10,claimedAt:'2026-08-05',ready:true}]),5,[],[1,2,9]);\n"
        "console.log(JSON.stringify({open:open.length,seeds:open[0].seeds,taken:taken.length,\n"
        "  ok:verdictOk.ok,unready:verdictUnready.ok,unreadyWhy:verdictUnready.reason,far:verdictFar.ok}));"
    )
    assert out["open"] == 1 and out["seeds"] == [1, 2, 3]
    assert out["taken"] == 0  # a signed charter takes its villages off the table
    assert out["ok"] is True
    assert out["unready"] is False and "merge star" in out["unreadyWhy"]
    assert out["far"] is False


# ---- 2. Charters gate formation ---------------------------------------------

VILLAGES_JS = (
    "const vs=[\n"
    "  {seed:1,name:'A',lat:53.00,lon:-2.0,claimedAt:'2026-01-01T00:00:00Z'},\n"
    "  {seed:2,name:'B',lat:53.01,lon:-2.0,claimedAt:'2026-01-02T00:00:00Z'},\n"
    "  {seed:3,name:'C',lat:53.02,lon:-2.0,claimedAt:'2026-01-03T00:00:00Z'}\n"
    "];\n"
)


def test_no_charter_no_town_but_legacy_auto_mode_survives():
    out = run_node(
        "const core=require('./empire_realm_core.js');\n" + VILLAGES_JS +
        "const auto=core.deriveSettlements(vs);\n"
        "const manual=core.deriveSettlements(vs,{townCharters:[],cityCharters:[]});\n"
        "const signed=core.deriveSettlements(vs,{townCharters:[{seeds:[1,2,3],mergedAt:'2026-02-01T00:00:00Z'}],cityCharters:[]});\n"
        "console.log(JSON.stringify({auto:auto.towns.length,manual:manual.towns.length,\n"
        "  manualLoose:manual.unassigned.length,signed:signed.towns.length,\n"
        "  foundedAt:signed.towns[0].foundedAt,wards:signed.towns[0].villageCount}));"
    )
    assert out["auto"] == 1          # legacy callers keep the old automatic rule
    assert out["manual"] == 0        # manual mode with nothing signed: no town
    assert out["manualLoose"] == 3
    assert out["signed"] == 1        # the player's signature makes the town
    assert out["foundedAt"] == "2026-02-01T00:00:00Z"
    assert out["wards"] == 3


def test_region_charters_gate_counties_the_same_way():
    out = run_node(
        "const core=require('./empire_realm_core.js');\n"
        "const vs=[];\n"
        "let seed=0;\n"
        "for (let g=0; g<3; g++) for (let i=0; i<3; i++) {\n"
        "  seed++;\n"
        "  vs.push({seed,name:'V'+seed,lat:53+g*0.5+i*0.01,lon:-2.0,claimedAt:'2026-01-0'+seed+'T00:00:00Z'});\n"
        "}\n"
        "const townCharters=[{seeds:[1,2,3],mergedAt:'2026-02-01T00:00:00Z'},\n"
        "  {seeds:[4,5,6],mergedAt:'2026-02-02T00:00:00Z'},{seeds:[7,8,9],mergedAt:'2026-02-03T00:00:00Z'}];\n"
        "const none=core.deriveRealm(vs,{townCharters,cityCharters:[],regionCharters:[]});\n"
        "const hearts=none.settlements.towns.map(t=>t.heartSeed);\n"
        "const signed=core.deriveRealm(vs,{townCharters,cityCharters:[],\n"
        "  regionCharters:[{seeds:hearts,mergedAt:'2026-03-01T00:00:00Z'}]});\n"
        "console.log(JSON.stringify({towns:none.settlements.towns.length,\n"
        "  noRegions:none.regions.length,looseTowns:none.unassignedTowns.length,\n"
        "  regions:signed.regions.length,regionTowns:signed.regions[0]?signed.regions[0].townCount:0,\n"
        "  foundedAt:signed.regions[0]?signed.regions[0].foundedAt:''}));"
    )
    assert out["towns"] == 3
    assert out["noRegions"] == 0 and out["looseTowns"] == 3
    assert out["regions"] == 1 and out["regionTowns"] == 3
    assert out["foundedAt"] == "2026-03-01T00:00:00Z"


def test_charters_sleep_and_never_bind_a_seed_twice():
    out = run_node(
        "const core=require('./empire_realm_core.js');\n" + VILLAGES_JS +
        "const sleeping=core.deriveSettlements(vs,{townCharters:[{seeds:[1,2,99],mergedAt:'x'}],cityCharters:[]});\n"
        "const doubled=core.deriveSettlements(vs.concat([{seed:4,name:'D',lat:53.03,lon:-2.0,claimedAt:'2026-01-04T00:00:00Z'},\n"
        "  {seed:5,name:'E',lat:53.04,lon:-2.0,claimedAt:'2026-01-05T00:00:00Z'}]),\n"
        "  {townCharters:[{seeds:[1,2,3],mergedAt:'x'},{seeds:[3,4,5],mergedAt:'y'}],cityCharters:[]});\n"
        "console.log(JSON.stringify({sleeping:sleeping.towns.length,sleepLoose:sleeping.unassigned.length,\n"
        "  doubled:doubled.towns.length,doubledLoose:doubled.unassigned.length}));"
    )
    # A charter naming a village that is not (yet) liberated waits patiently.
    assert out["sleeping"] == 0 and out["sleepLoose"] == 3
    # Seed 3 is already bound by the first charter: the second never forms.
    assert out["doubled"] == 1 and out["doubledLoose"] == 2


def test_migration_grandfathers_the_automatic_era():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "ensureEmpireState")
    assert "mergeChartersVersion" in src
    assert "townCharters" in src and "regionCharters" in src
    out = run_node(
        "globalThis.BurbzEmpireRealmCore=require('./empire_realm_core.js');\n"
        "let saves=0; const saveState=()=>{saves++};\n"
        "const validPendingLiberation=()=>true;\n"
        "const gameState={empire:{villages:{\n"
        "  '1':{seed:1,name:'A',lat:53.00,lon:-2.0,claimedAt:'2026-01-01T00:00:00Z'},\n"
        "  '2':{seed:2,name:'B',lat:53.01,lon:-2.0,claimedAt:'2026-01-02T00:00:00Z'},\n"
        "  '3':{seed:3,name:'C',lat:53.02,lon:-2.0,claimedAt:'2026-01-03T00:00:00Z'}\n"
        "}}};\n"
        + src +
        "\nconst empire=ensureEmpireState();\n"
        "const once=empire.townCharters.map(c=>c.seeds);\n"
        "ensureEmpireState();\n"
        "console.log(JSON.stringify({version:empire.mergeChartersVersion,\n"
        "  charters:once,again:empire.townCharters.length,saved:saves>0}));"
    )
    # The auto-formed town of the old save survives as a signed charter, once.
    assert out["version"] == 1
    assert out["charters"] == [[1, 2, 3]]
    assert out["again"] == 1
    assert out["saved"] is True


# ---- 3. The player's Merge, wired into the game -----------------------------

def test_merge_actions_sign_charters_with_rollback():
    html = HTML_PATH.read_text(encoding="utf-8")
    villages = function_source(html, "empireMergeVillages")
    assert "validateMerge" in villages
    assert "townCharters.push" in villages
    assert "restoreGameStateSnapshot" in villages
    assert "openEmpireTown(town.id)" in villages
    towns = function_source(html, "empireMergeTowns")
    assert "regionCharters.push" in towns
    assert "restoreGameStateSnapshot" in towns
    assert "openEmpireRegion(region.id)" in towns


def test_derivation_caches_key_on_the_signed_charters():
    html = HTML_PATH.read_text(encoding="utf-8")
    settlements = function_source(html, "empireSettlementsInfo")
    assert "empireMergeCharters()" in settlements
    assert "empireCharterSignature(charters)" in settlements
    assert "townCharters: charters.townCharters" in settlements
    regions = function_source(html, "empireRegionsInfo")
    assert "empireCharterSignature(charters)" in regions


def test_star_badges_and_merge_buttons_reach_the_ui():
    html = HTML_PATH.read_text(encoding="utf-8")
    panel = function_source(html, "renderEmpirePanel")
    assert "empireTownMergeCandidates()" in panel
    assert "empireRegionMergeCandidates()" in panel
    assert "MERGE INTO ONE TOWN" in panel
    assert "MERGE INTO ONE COUNTY" in panel
    assert 'data-action="merge-villages"' in panel
    assert 'data-action="merge-towns"' in panel
    # empire-grid-v322-20260825: a starred village used to say "⭐ ready to
    # merge" in its row. The row is a square now, so the star IS the square —
    # gold border, ⭐ pip, "Ready to merge" from the grid core.
    tile = function_source(html, "empireVillageTile")
    assert "const ready = villageMergeReady(v);" in tile
    assert "mergeReady: !!(ready && ready.ready)" in tile
    # v317 removed the merge-star progress line from the governor's desk at
    # Yaan's ask. The star is still earned and still shown where the player
    # acts on it: the Empire banners above, and the atlas below.
    desk = function_source(html, "renderVillageManagePanel")
    assert "merge-progress" not in desk
    assert ".merge-banner {" in html and ".merge-star {" in html
    # A ready village wears its star on the royal atlas too.
    atlas = function_source(html, "refreshEmpireMap")
    assert "'⭐ ' + v.name" in atlas


def test_star_crossing_is_announced_once():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "maybeAwardMergeStar")
    assert "mergeStarSeen" in src
    assert "queueCompletionNotice" in src
    sim = function_source(html, "simulateVillageEconomy")
    assert "maybeAwardMergeStar(rec)" in sim


# ---- 4. One Upgrade order for the whole town or region ----------------------

def test_wholesale_plan_sums_costs_and_takes_the_longest_clock():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "wholesaleUpgradePlan")
    out = run_node(
        "const gameState={player:{level:99}};\n"
        "const EMPIRE_BUILDINGS=[\n"
        "  {id:'cabin',maxLevel:2,cost:{coins:10,branches:5,stone:0},buildMinutes:4},\n"
        "  {id:'farm',maxLevel:2,cost:{coins:20,branches:10,stone:5},buildMinutes:8},\n"
        "  {id:'gate',maxLevel:1,cost:{coins:99,branches:99,stone:99},buildMinutes:99,unlockLevel:100}\n"
        "];\n"
        "const levels={'7':{cabin:1,farm:0},'8':{cabin:2,farm:1}};\n"
        "const ensureVillageEconomy=rec=>({buildings:levels[String(rec.seed)],constructions:rec.constructions||[]});\n"
        "const villageConstructions=rec=>ensureVillageEconomy(rec).constructions;\n"
        "const villageConstructionOf=(rec,id)=>villageConstructions(rec).find(c=>c&&c.id===id)||null;\n"
        "const villageBuildingLevel=(rec,id)=>levels[String(rec.seed)][id]||0;\n"
        "const villageBuildingCost=(b,level)=>({coins:b.cost.coins*(level+1),branches:b.cost.branches*(level+1),stone:b.cost.stone*(level+1)});\n"
        "const villageBuildTimeMs=(b,level)=>Math.max(1,b.buildMinutes*(level+1))*60000;\n"
        "const villageStewardProject=()=>({staffed:false,buildFactor:1,costFactor:1});\n"
        "const settlementAllowsBuilding=()=>true;\n"
        + src +
        "\nconst plan=wholesaleUpgradePlan([{seed:7},{seed:8}]);\n"
        "console.log(JSON.stringify(plan));"
    )
    # Ward 7: cabin 1→2 (20/10/0, 8m), farm 0→1 (20/10/5, 8m).
    # Ward 8: cabin already max, farm 1→2 (40/20/10, 16m). Gate stays locked.
    steps = {(s["seed"], s["buildingId"], s["toLevel"]) for s in out["steps"]}
    assert steps == {(7, "cabin", 2), (7, "farm", 1), (8, "farm", 2)}
    assert out["cost"] == {"coins": 80, "branches": 40, "stone": 15}
    assert out["durationMs"] == 16 * 60000  # the longest single build, not the sum


def test_wholesale_completion_applies_every_step_atomically():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "completeWholesaleWorks")
    assert "snapshotGameState()" in src
    assert "restoreGameStateSnapshot(snapshot)" in src
    assert "durableSaveState({ throwOnFailure: true })" in src
    assert "maybeAwardMergeStar(rec)" in src
    begin = function_source(html, "beginWholesaleUpgrade")
    assert "wholesaleUpgradePlan(records)" in begin
    assert "addCoins(-plan.cost.coins)" in begin
    tick = function_source(html, "tickEmpireConstruction")
    assert "completeWholesaleWorks()" in tick


def test_upgrade_orders_stand_on_both_halls():
    html = HTML_PATH.read_text(encoding="utf-8")
    town = function_source(html, "renderTownScreen")
    assert "Upgrade the Whole Town" in town
    assert 'data-action="town-upgrade-all"' in town
    assert "beginWholesaleUpgrade(settle.id, 'town')" in town
    region = function_source(html, "renderRegionScreen")
    assert "Upgrade the Whole Region" in region
    assert 'data-action="region-upgrade-all"' in region
    assert "beginWholesaleUpgrade(region.id, 'region')" in region


# ---- 5. Visiting the old places ---------------------------------------------

def test_the_old_villages_stay_visitable():
    html = HTML_PATH.read_text(encoding="utf-8")
    town = function_source(html, "renderTownScreen")
    assert "Visit the Old Villages" in town
    assert 'data-action="town-visit"' in town
    assert "visitEmpireWard(chip.dataset.seed)" in town
    visit = function_source(html, "visitEmpireWard")
    assert "villageActive = {" in visit
    assert "gameState.lastVillage" not in visit  # a visit never rebinds home
    bar = function_source(html, "renderVillageClaimBar")
    assert "you are just visiting" in bar
    assert "BACK TO THE HALL" in bar


# ---- Release plumbing --------------------------------------------------------

def test_release_is_versioned_and_the_merge_core_shipped():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # Each core carries the pin of the release that last TOUCHED it, so a
    # browser refetches only what actually changed — the pin stays put while
    # the head build moves past it.
    for core, core_pin in (("settlement_merge_core.js", MERGE_CORE_PIN),
                           ("empire_realm_core.js", OWN_RELEASE_PIN)):
        pin = f"{core}?v={core_pin}"
        assert f'<script src="{pin}"></script>' in html
        assert sw.count(f"'./{pin}'") == 3
    assert MERGE_CORE_PATH.exists()
    story = STORY_PATH.read_text(encoding="utf-8")
    assert "merge star" in story
