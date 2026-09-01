"""Battle-progression fixes v286 — Yaan's play-report sweep, 2026-08-19.

Four contracts in one release:
1. A bird lost in battle reaches the Bird Hospital hurt. The old order let a
   post-battle level-up heal the casualty to full BEFORE admission, whose
   full-HP guard then bounced it — the bird stood in its old room (the
   Training Hall) at full health. Battle now grants XP with
   ``levelUpBird(bird, xp, { noHeal: true })`` for the fallen, and a save
   with no Hospital rests them in the Aviary Gardens instead of at a post.
2. A liberation battle frees a VILLAGE, and says so. Towns only ever form at
   the birdhouse build when three claims chain within 5 km — and that merge
   now announces its three villages by name, before and as it happens.
3. The village → town → county ladder is visible from town management, and
   the procedural world always offers enough villages to climb it.
4. The bottom nav carries a FORGE tab straight to the Fletcher's Forge, with
   ready commissions badged through the action-badge heartbeat.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
STORY_PATH = ROOT / "STORY.md"
BADGE_CORE_PATH = ROOT / "action_badge_core.js"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "battle-progression-fixes-v286-20260819"
PREVIOUS_RELEASE_PIN = "settlement-scene-sharp-v285-20260819"
CURRENT_BUILD = "step-inside-buildings-v341-20260901"
VERSIONED_BADGE_CORE = "action_badge_core.js?v=nav-action-badges-v312-20260824"  # moved on in v312


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


# ---- 1. Lost birds reach the ward -------------------------------------------

def test_level_up_holds_its_heal_back_when_asked():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "levelUpBird")
    assert "if (!options.noHeal) bird.hp = bird.maxHp;" in src
    out = run_node(
        "const XP_PER_LEVEL=(lv)=>Math.floor(80+lv*40+Math.pow(lv,1.5)*10);\n"
        "const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));\n"
        "const generateBirdStats=()=>({hp:80,atk:60,def:60,spd:60,int:50,stamina:50});\n"
        "const showToast=()=>{}; const SFX={levelUp:()=>{}};\n"
        "const birdDisplayName=b=>b.commonName;\n"
        + src +
        "\nconst hurt={commonName:'Peregrine',species:'Peregrine Falcon',level:1,xp:0,hp:1,rarity:'common',training:{}};\n"
        "levelUpBird(hurt,500,{noHeal:true});\n"
        "const healed={commonName:'Buzzard',species:'Buzzard',level:1,xp:0,hp:1,rarity:'common',training:{}};\n"
        "levelUpBird(healed,500);\n"
        "console.log(JSON.stringify({hurtHp:hurt.hp,hurtLevel:hurt.level,healedFull:healed.hp===healed.maxHp}));"
    )
    # The fallen bird levelled but kept its wound; the default caller still heals.
    assert out["hurtLevel"] > 1
    assert out["hurtHp"] == 1
    assert out["healedFull"] is True


def test_battle_end_carries_the_lost_to_the_ward_hurt():
    html = HTML_PATH.read_text(encoding="utf-8")
    end = function_source(html, "endPerchBattle")
    assert "const lost = !!(f.fainted || f.hp <= 0);" in end
    assert "levelUpBird(bird, rewards.birdXp, lost ? { noHeal: true } : {})" in end
    # XP first, admission second — and the admission can no longer be bounced,
    # because the fallen bird's heal was held back.
    assert end.index("levelUpBird(bird, rewards.birdXp") < end.index("admitFaintedBirdToHospital(bird)")
    assert "restLostBirdOutsideWard(bird)" in end
    assert "carried to the Bird Hospital" in end
    # free-birds-v318 retired the Aviary Gardens: a bird with no ward to go
    # to now rests free in the tree, and the note says so.
    assert "hurt and free in the tree" in end


def test_no_ward_fallback_rests_the_fallen_in_the_gardens():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "restLostBirdOutsideWard")
    assert "bird.academy.room === 'hospital' || bird.academy.room === 'outdoors'" in src
    assert "birdAssignedPost(bird.id)" in src
    assert "birdHasActiveExpedition(bird.id) || birdHasActiveTraining(bird.id)" in src
    assert "bird.academy.room = 'outdoors';" in src
    out = run_node(
        "const ensureBirdAcademy=b=>{b.academy=b.academy||{room:'training'};};\n"
        "const birdAssignedPost=()=>false;\n"
        "const birdHasActiveExpedition=()=>false;\n"
        "const birdHasActiveTraining=()=>false;\n"
        + src +
        "\nconst bird={id:'b1',academy:{room:'training'}};\n"
        "const moved=restLostBirdOutsideWard(bird);\n"
        "const again=restLostBirdOutsideWard(bird);\n"
        "console.log(JSON.stringify({moved,room:bird.academy.room,again}));"
    )
    assert out["moved"] is True
    assert out["room"] == "outdoors"
    assert out["again"] is False


# ---- 2. A battle frees a village; merges announce themselves ----------------

def test_victory_screen_frees_a_village_not_a_town():
    html = HTML_PATH.read_text(encoding="utf-8")
    end = function_source(html, "endPerchBattle")
    assert "'VILLAGE LIBERATED!'" in end
    assert "TOWN LIBERATED" not in end
    assert "liberatedVillage" in end
    start = function_source(html, "startPerchBattle")
    # v331: the reassurance moved off the battle log and onto the select
    # screen's liberation banner, where it is read before the fight starts.
    assert "Free the village!" in html
    assert "Free the town!" not in start


def test_victory_screen_no_longer_forewarns_a_merge():
    """Superseded by merge-when-ready-v290: a liberation can never complete a
    merge, so the victory screen makes no union promises."""
    html = HTML_PATH.read_text(encoding="utf-8")
    end = function_source(html, "endPerchBattle")
    assert "previewClaimFounding" not in end
    assert "Raising it unites" not in end
    assert "the village is free" in end


def test_claim_bar_offers_a_plain_birdhouse_and_a_visit_banner():
    """v290: the birdhouse never unites anything, and a merged ward greets
    visitors with the road back to its Hall."""
    html = HTML_PATH.read_text(encoding="utf-8")
    bar = function_source(html, "renderVillageClaimBar")
    assert "previewClaimFounding" not in bar
    assert "Raising it unites" not in bar
    assert "BUILD LIBERATION BIRDHOUSE" in bar
    assert "you are just visiting" in bar
    assert "BACK TO THE HALL" in bar


def test_liberation_toast_points_at_the_merge_star():
    """v290: claiming a village teaches the road to the ⭐ merge star instead
    of announcing automatic merges."""
    html = HTML_PATH.read_text(encoding="utf-8")
    claim = function_source(html, "claimCurrentVillage")
    assert "merge star" in claim
    assert "16 folk" in claim
    assert "settlementWardNames(foundedSettlement)" not in claim
    merge = function_source(html, "empireMergeVillages")
    assert "mc.nameList(names)" in merge  # the toast names the three wards
    assert "townCharters.push" in merge


def test_preview_founding_returns_null_under_signed_merging():
    """v290: with charters passed, a fresh claim never completes a merge, so
    the preview is honestly null — merging is the player's own act."""
    html = HTML_PATH.read_text(encoding="utf-8")
    preview = function_source(html, "previewClaimFounding")
    assert "empire.villages[key]" in preview  # already-claimed -> no preview
    assert "empireMergeCharters()" in preview
    out = run_node(
        "const core=require('./empire_realm_core.js');\n"
        "const realmCore=()=>core;\n"
        "const villages={\n"
        "  '101':{seed:101,name:'Wrenfold',lat:51.5,lon:-2.6,claimedAt:'2026-08-01T00:00:00Z'},\n"
        "  '102':{seed:102,name:'Thistlemere',lat:51.518,lon:-2.6,claimedAt:'2026-08-02T00:00:00Z'}\n"
        "};\n"
        "const ensureEmpireState=()=>({villages,townCharters:[],cityCharters:[],regionCharters:[]});\n"
        "const empireVillages=()=>Object.values(villages);\n"
        "const empireMergeCharters=()=>({townCharters:[],cityCharters:[],regionCharters:[]});\n"
        + preview +
        "\nconst near=previewClaimFounding({seed:103,name:'Alderbrook',lat:51.536,lon:-2.6});\n"
        "const claimed=previewClaimFounding({seed:101,name:'Wrenfold',lat:51.5,lon:-2.6});\n"
        "console.log(JSON.stringify({near:near===null,claimed:claimed===null}));"
    )
    assert out["near"] is True
    assert out["claimed"] is True


# ---- 3. The county rung, visible and always reachable -----------------------

def test_town_hall_shows_the_county_rung():
    html = HTML_PATH.read_text(encoding="utf-8")
    town = function_source(html, "renderTownScreen")
    assert "empireRegionOfSeed(settle.heartSeed)" in town
    assert 'id="townCountySection"' in town
    assert "OPEN COUNTY HALL" in town
    assert "Toward a County" in town
    assert "merge star" in town
    assert "MERGE INTO ONE COUNTY" in town
    assert 'data-action="town-county"' in town
    assert "openEmpireRegion(county.id)" in town


def test_merge_core_offers_ready_trios_only():
    """v290 replaces the automatic cluster count: three READY towns within
    150 km make a candidate; unready or far ones never do."""
    out = run_node(
        "const mc=require('./settlement_merge_core.js');\n"
        "const pts=[\n"
        "  {seed:11,name:'A',lat:51.5,lon:-2.6,claimedAt:'2026-08-01',ready:true},\n"
        "  {seed:22,name:'B',lat:52.0,lon:-2.6,claimedAt:'2026-08-02',ready:true},\n"
        "  {seed:33,name:'C',lat:52.4,lon:-2.6,claimedAt:'2026-08-03',ready:true},\n"
        "  {seed:44,name:'D',lat:20.0,lon:100.0,claimedAt:'2026-08-04',ready:true},\n"
        "  {seed:55,name:'E',lat:51.6,lon:-2.6,claimedAt:'2026-08-05',ready:false}\n"
        "];\n"
        "const cands=mc.mergeCandidates(pts,150,[]);\n"
        "const gated=mc.mergeCandidates(pts.map(p=>({...p,ready:p.seed!==33?p.ready:false})),150,[]);\n"
        "console.log(JSON.stringify({count:cands.length,seeds:cands[0].seeds,gatedCount:gated.length}));"
    )
    assert out["count"] == 1
    assert out["seeds"] == [11, 22, 33]
    assert out["gatedCount"] == 0


def test_world_always_offers_enough_villages_for_towns_and_counties():
    """Sampled density contract: wherever the player stands, the ~13 km
    neighbourhood holds at least three DISJOINT village trios chainable at
    5 km — one trio makes a town, three towns make a county. The waystead
    floor plus 34%-of-cells density make this hold everywhere tested."""
    html = HTML_PATH.read_text(encoding="utf-8")
    world = "\n".join([
        "const VILLAGE_CELL_DEG = 0.02;",
        "const VILLAGE_BLOCK_CELLS = 3;",
        # The cradle village needs a save; this contract is about the bare
        # procedural grid, and a cradle only ever adds a settlement.
        "const empireCradleSite = () => null;",
        function_source(html, "burbzHash32"),
        function_source(html, "villageRngFrom"),
        function_source(html, "villageNameFromSeed"),
        function_source(html, "villageInCell"),
        function_source(html, "waysteadInBlock"),
        function_source(html, "villagesNearLatLng"),
    ])
    out = run_node(
        "globalThis.BurbzEmpireRealmCore=require('./empire_realm_core.js');\n"
        "const core=globalThis.BurbzEmpireRealmCore;\n"
        + world + "\n" +
        "const lats=[-45,-10,0,25,43,51.5,55,65];\n"
        "let samples=0,townFails=0,countyFails=0,minTrios=Infinity;\n"
        "for (const baseLat of lats) {\n"
        "  for (let k=0;k<25;k++) {\n"
        "    const h=(Math.imul(k+1,2654435761)>>>0);\n"
        "    const lat=baseLat+((h%1000)/1000-0.5)*2;\n"
        "    const lon=-180+((Math.imul(h,40503)>>>0)%360000)/1000;\n"
        "    samples++;\n"
        "    const pts=villagesNearLatLng(lat,lon,6).map(v=>({seed:v.seed,lat:v.lat,lon:v.lon,claimedAt:'x'}));\n"
        "    const clusters=core.clusterVillages(pts,5);\n"
        "    const trios=clusters.reduce((n,c)=>n+Math.floor(c.length/3),0);\n"
        "    minTrios=Math.min(minTrios,trios);\n"
        "    if (!clusters.some(c=>c.length>=3)) townFails++;\n"
        "    if (trios<3) countyFails++;\n"
        "  }\n"
        "}\n"
        "console.log(JSON.stringify({samples,townFails,countyFails,minTrios}));"
    )
    assert out["samples"] == 200
    assert out["townFails"] == 0
    assert out["countyFails"] == 0
    assert out["minTrios"] >= 3


# ---- 4. The FORGE tab -------------------------------------------------------

def test_bottom_nav_carries_a_forge_tab():
    html = HTML_PATH.read_text(encoding="utf-8")
    nav = html[html.index('id="bottomNav"'):html.index("</nav>", html.index('id="bottomNav"'))]
    assert 'data-game-route data-screen="forge" aria-label="Blacksmith\'s forge"' in nav
    assert '<div class="nav-label">Forge</div>' in nav
    # Both live in the fixed dock; Battle rides the adventure row beside the
    # island, Forge the management deck above (fixed-dock-v303).
    assert nav.index('data-screen="forge"') < nav.index('data-screen="battle"')
    assert 'data-screen="academy"' in html[html.index('bottom-dock-anchor'):]
    # switchScreen already renders the forge on entry — the tab rides that.
    # v321 gave the Forge an entry tab, so the route does a little more than
    # render — it still renders, and the dock is still what reaches it.
    assert "if (name === 'forge') {" in html
    assert "renderForge();" in html


def test_ready_forge_commissions_badge_the_tab():
    html = HTML_PATH.read_text(encoding="utf-8")
    state = function_source(html, "normalizeActionBadgeState")
    assert "forgeJobsReady(now).length" in state
    assert "forge: forgeReadyCount" in state
    core = BADGE_CORE_PATH.read_text(encoding="utf-8")
    assert "'forge'," in core
    out = run_node(
        "const api=require('./action_badge_core.js');\n"
        "const counts=api.computeActionBadgeCounts({forge:2});\n"
        "console.log(JSON.stringify({forge:counts.forge,zero:api.computeActionBadgeCounts({}).forge}));"
    )
    assert out["forge"] == 2
    assert out["zero"] == 0


# ---- Release plumbing -------------------------------------------------------

def test_release_is_versioned_and_the_badge_core_pin_moved():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # The badge core changed in this release and again in v312, so its cache
    # pin has moved on everywhere — what matters is that it moves together.
    assert f'<script src="{VERSIONED_BADGE_CORE}"></script>' in html
    assert sw.count(f"'./{VERSIONED_BADGE_CORE}'") == 2
    assert "action_badge_core.js?v=distributed-game-hud-v244-20260810" not in html
    assert "action_badge_core.js?v=distributed-game-hud-v244-20260810" not in sw
    updater = UPDATER_PATH.read_text(encoding="utf-8")
    assert '"action_badge_core.js"' in updater
    story = STORY_PATH.read_text(encoding="utf-8")
    assert "The cost of the field, and the honest merge" in story
    assert "carried straight to the Bird Hospital" in story
