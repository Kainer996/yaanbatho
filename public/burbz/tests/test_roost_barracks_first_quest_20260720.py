"""Fresh-player Academy onboarding: Roost + Barracks, recruit, first quest."""
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
CORE_PATH = ROOT / "academy_treehouse_core.js"
ECONOMY_PATH = ROOT / "scan_economy_core.js"
SW_PATH = ROOT / "sw.js"


def _node_json(source: str):
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def _required_int(pattern: str, text: str) -> int:
    match = re.search(pattern, text)
    assert match, pattern
    return int(match.group(1))


def _function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_roost_and_barracks_unlock_together_at_level_one():
    rooms = _node_json(
        "const core=require('./academy_treehouse_core.js');"
        "console.log(JSON.stringify(core.getAcademyRooms()));"
    )
    by_id = {room["id"]: room for room in rooms}
    assert by_id["dorm"]["unlockLevel"] == 1
    assert by_id["tavern"]["unlockLevel"] == 1


def test_fresh_resources_cover_both_buildings_and_the_guaranteed_first_recruit():
    html = HTML_PATH.read_text(encoding="utf-8")
    rooms = _node_json(
        "const core=require('./academy_treehouse_core.js');"
        "console.log(JSON.stringify(core.getAcademyRooms()));"
    )
    by_id = {room["id"]: room for room in rooms}
    starting_coins = _required_int(r"player: \{ name: 'Bird Trainer'.*?coins: (\d+)", html)
    first_recruit_cap = _required_int(r"const FIRST_RECRUIT_MAX_COST = (\d+);", html)
    required_coins = by_id["dorm"]["cost"] + by_id["tavern"]["cost"] + first_recruit_cap
    assert starting_coins >= required_coins, (starting_coins, required_coins)

    bundles = _required_int(r"const STARTER_TIMBER_BUNDLES = (\d+);", html)
    per_bundle = _required_int(r"const STARTER_TIMBER_PER_BUNDLE = (\d+);", html)
    required_timber = by_id["dorm"]["branches"] + by_id["tavern"]["branches"]
    assert bundles * per_bundle >= required_timber, (bundles * per_bundle, required_timber)


def test_starter_timber_stays_until_roost_and_barracks_are_built():
    html = HTML_PATH.read_text(encoding="utf-8")
    start = html.index("function starterTimberDone()")
    body = html[start:html.index("\nfunction starterTimberPickupsNear", start)]
    assert "isAcademyBuildingBuilt('dorm') && isAcademyBuildingBuilt('tavern')" in body


def test_tutorial_states_the_recruit_then_send_one_bird_sequence():
    html = HTML_PATH.read_text(encoding="utf-8")
    start = html.index("const MERLIN_TUTORIAL_STEPS = [")
    end = html.index("\n];", start)
    tutorial = html[start:end].lower()
    required = (
        "the roost and barracks unlock together",
        "recruit one",
        "send one bird on one starter quest",
        "quest roost",
        "longer journeys",
    )
    assert all(marker in tutorial for marker in required), [m for m in required if m not in tutorial]


def test_existing_tutorial_progress_replays_only_academy_and_quests():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const BURBZ_TUTORIAL_VERSION = 'merlin-gradual-chapters-v4-20260720'" in html
    assert "const BURBZ_PREVIOUS_TUTORIAL_VERSION = 'merlin-gradual-chapters-v3-20260720'" in html
    migration = html[
        html.index("function migratePreviousMerlinTutorialProgress()") :
        html.index("function merlinChaptersSeen()")
    ]
    assert "id !== 'academy' && id !== 'quests'" in migration
    assert "previousGiftKey" in migration and "BURBZ_TUTORIAL_GIFT_KEY" in migration


def test_existing_v4_saves_receive_the_missing_opening_budget_once():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "academyBuilderVersion: 6" in html

    load = html[html.index("function loadState()") : html.index("function saveState()")]
    assert "const academyBuilderVersionBeforeDefaults = Number(gameState.academyBuilderVersion) || 0" in load
    assert "academyBuilderVersionBeforeDefaults < 6" in load
    assert "gameState.academyBuilderVersion = academyBuilderVersionBeforeDefaults" in load

    migration = html[
        html.index("function ensureAcademyBuildings(") :
        html.index("function academyBuildBuilding(")
    ]
    assert "const openingBuildingIds = ['dorm', 'tavern']" in migration
    assert "const recruitmentReserve = (gameState.flock || []).length ? 0 : FIRST_RECRUIT_MAX_COST" in migration
    assert "constructionCoins + recruitmentReserve" in migration
    assert "gameState.starterTimber.taken[i] = true" in migration
    assert "gameState.academyBuilderVersion = 6" in migration


def test_real_build_discovery_recruit_and_starter_dispatch_path_runs_end_to_end():
    html = HTML_PATH.read_text(encoding="utf-8")
    actual_functions = "\n".join(
        _function_source(html, name)
        for name in (
            "academyBuildBuilding",
            "recruitCostForBird",
            "rememberDiscoveredBird",
            "createBirdFromDiscovery",
            "recruitDiscoveredBird",
            "startBirdExpedition",
        )
    )
    result = _node_json(
        """
const FIRST_RECRUIT_MAX_COST = 110;
global.window = {
  BurbzScanEconomy: { recruitCostForBird: () => 500 },
  BurbzAcademyCore: { createBirdExpedition: (bird, templateId) => ({ id:'quest-1', birdId:bird.id, birdName:bird.commonName, templateId, label:'Find Seed', status:'active' }) }
};
global.BurbzScanEconomy = window.BurbzScanEconomy;
const ACADEMY_BUILDINGS = {
  dorm:{cost:50,branches:10,unlockLevel:1,room:'dorm',label:'The Roost',icon:'🏠',x:24,y:78},
  tavern:{cost:60,branches:8,unlockLevel:1,room:'tavern',label:'Barracks',icon:'🪶',x:76,y:80}
};
let academySelectedRoom = 'outdoors';
let gameState = {player:{level:1,coins:220,branches:18,totalCaptures:0},academyBuildings:{outdoors:{built:true}},discoveredSpecies:{},flock:[],birdExpeditions:[],pantry:{},inventory:{items:{}},activePetId:null};
const SFX={levelUp(){},capture(){},tap(){}};
function ensureAcademyBuildings(){}
function isAcademyBuildingBuilt(id){return !!gameState.academyBuildings[id]?.built;}
function isAcademyRoomBuilt(room){return room==='tavern' && isAcademyBuildingBuilt('tavern');}
function playerBranches(){return gameState.player.branches;}
function addCoins(n){gameState.player.coins+=n;return gameState.player.coins;}
function addBranches(n){gameState.player.branches+=n;return gameState.player.branches;}
function canonicalSpeciesName(x){return x;}
function speciesKey(x){return String(x).toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
function getDiscoveredRecordForSpecies(x){return gameState.discoveredSpecies[speciesKey(x)] || null;}
function getBirdArtUrl(){return null;}
function nextDiscoverySightingCount(){return 1;}
function discoveryKeysForSpecies(x){return [speciesKey(x)];}
function discoveryRewardForBird(){return 0;}
function createBirdEntry(commonName, scientificName){return {id:'bird-1',commonName,species:commonName,scientificName,rarity:'legendary'};}
function companionForSpecies(x){return gameState.flock.find(b=>b.commonName===x)||null;}
function ensureBirdAcademy(){}
function addPlayerXp(){}
function updateQuestProgress(){}
function activeWalkingQuest(){return null;}
function removeTavernPatronForSpecies(){}
function checkBadges(){}
function saveState(){}
function showCaptureOverlay(){}
function selectPet(id){gameState.activePetId=id;}
function renderPetCompanion(){}
function renderBirdex(){}
function updateHeader(){}
function renderProfile(){}
function showToast(){}
function renderAcademy(){}
function renderBirdExpeditions(){}
function academyBirdById(id){return gameState.flock.find(b=>b.id===id)||null;}
function isStarterExpeditionTemplate(id){return ['find_seed','find_coins','branch_run','scavenge'].includes(id);}
function birdHasActiveExpedition(){return false;}
""" + actual_functions + """
const roostBuilt=academyBuildBuilding('dorm');
const barracksBuilt=academyBuildBuilding('tavern');
const afterBuildings={coins:gameState.player.coins,branches:gameState.player.branches};
const discovered=rememberDiscoveredBird({species:'Golden Eagle',commonName:'Golden Eagle',scientificName:'Aquila chrysaetos',rarity:'legendary',confidence:.99});
const firstDisplayedCost=recruitCostForBird({rarity:'legendary'});
const recruited=recruitDiscoveredBird('golden_eagle');
const laterFullCost=recruitCostForBird({rarity:'legendary'});
startBirdExpedition('bird-1','find_seed',{});
console.log(JSON.stringify({roostBuilt,barracksBuilt,afterBuildings,discovered,firstDisplayedCost,recruited,laterFullCost,coins:gameState.player.coins,flock:gameState.flock.map(b=>b.commonName),quests:gameState.birdExpeditions}));
"""
    )
    assert result["roostBuilt"] and result["barracksBuilt"]
    assert result["afterBuildings"] == {"coins": 110, "branches": 0}
    assert result["discovered"] is True
    assert result["firstDisplayedCost"] == 110
    assert result["recruited"] is True
    assert result["laterFullCost"] == 500
    assert result["coins"] == 0
    assert result["flock"] == ["Golden Eagle"]
    assert result["quests"][0]["templateId"] == "find_seed"


def test_v6_migration_handles_missing_buildings_first_recruit_and_timber_once():
    html = HTML_PATH.read_text(encoding="utf-8")
    ensure_fn = _function_source(html, "ensureAcademyBuildings")
    result = _node_json(
        """
const FIRST_RECRUIT_MAX_COST=110;
const ACADEMY_BUILDINGS={dorm:{cost:50,branches:10},tavern:{cost:60,branches:8}};
const ACADEMY_ROOMS={outdoors:{},dorm:{},tavern:{}};
let academySelectedRoom='outdoors';
function showToast(){}
global.setTimeout=()=>0;
function isAcademyBuildingBuilt(id){return !!gameState.academyBuildings[id]?.built;}
function isAcademyRoomBuilt(room){return room==='outdoors'||isAcademyBuildingBuilt(room);}
""" + ensure_fn + """
function migrate(state){gameState=JSON.parse(JSON.stringify(state));ensureAcademyBuildings(true);return gameState;}
const base={player:{coins:0,branches:0},academyBuilderVersion:5,academyBuildings:{outdoors:{built:true}},flock:[],starterTimber:{taken:{0:true,1:true,2:true,3:true}}};
const missingBoth=migrate(base);
const barracksOnly=migrate({...base,academyBuildings:{outdoors:{built:true},tavern:{built:true}}});
const established=migrate({...base,player:{coins:3,branches:2},academyBuildings:{outdoors:{built:true},dorm:{built:true},tavern:{built:true}},flock:[{id:'bird-1',academy:{room:'outdoors'}}]});
console.log(JSON.stringify({missingBoth,barracksOnly,established}));
"""
    )
    assert result["missingBoth"]["player"] == {"coins": 220, "branches": 18}
    assert len(result["missingBoth"]["starterTimber"]["taken"]) == 6
    assert result["barracksOnly"]["player"] == {"coins": 160, "branches": 10}
    assert len(result["barracksOnly"]["starterTimber"]["taken"]) == 6
    assert result["established"]["player"] == {"coins": 3, "branches": 2}
    assert result["established"]["academyBuilderVersion"] == 6


def test_onboarding_release_is_query_busted_and_offline():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    version = "bird-levelling-20260722"
    assert f'academy_treehouse_core.js?v={version}' in html
    assert f"./academy_treehouse_core.js?v={version}" in sw
    assert "burbz-bird-levelling-v103-20260722" in sw
