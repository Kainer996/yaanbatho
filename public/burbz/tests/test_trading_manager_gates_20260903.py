"""Trading and village Project Manager progression (v346)."""

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
ACADEMY_CORE = ROOT / "academy_treehouse_core.js"
RELEASE = "rook-recognition-special-characters-v347-20260904"


def html() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


def function_source(source: str, name: str) -> str:
    start = source.index(f"function {name}(")
    end = source.find("\nfunction ", start + 10)
    assert end > start
    return source[start:end]


def run_node(source: str):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8",
        capture_output=True, check=False, timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_market_is_an_early_real_building_and_the_quest_teaches_it_immediately():
    rooms = run_node(
        f"const c=require({json.dumps(str(ACADEMY_CORE))});"
        "process.stdout.write(JSON.stringify(c.getAcademyRooms()));"
    )
    market = next(room for room in rooms if room["id"] == "magpie_market")
    assert market["unlockLevel"] == 4
    chain = html()[html().index("const PLAYER_QUESTS = ["):html().index("function activePlayerQuest()")]
    ids = re.findall(r"id:'(pq_[a-z_0-9]+)'", chain)
    assert ids.index("pq_build_market") == ids.index("pq_build_quest_roost") + 1
    assert ids.index("pq_market_trade") == ids.index("pq_build_market") + 1
    assert "focusRoom:'magpie_market'" in chain


def test_every_item_trade_path_has_the_market_hard_gate_and_visible_prompt():
    source = html()
    for name in ("storesSellItem", "magpieMarketSell", "magpieMarketBuy"):
        assert "requireMagpieMarketTrade()" in function_source(source, name)
    for name in ("buyTrailTavernDrink", "empireSendSupplyCart"):
        body = function_source(source, name)
        assert body.index("requireMagpieMarketTrade()") < body.index("addCoins(-")
    village_buy = function_source(source, "villageBuy")
    assert village_buy.index("item.effect === 'quests'") < village_buy.index("requireMagpieMarketTrade()")
    assert "BUILD MAGPIE MARKET TO TRADE" in function_source(source, "storesSellRowHTML")
    assert "Trading is locked until the Magpie Market is built" in function_source(source, "renderAcademyBuildPanel")
    assert "MARKET REQUIRED" in function_source(source, "villageOpenShop")


def test_build_shortfalls_open_a_matching_bird_dispatch_sheet_directly():
    source = html()
    routes = source[source.index("const RESOURCE_QUEST_ROUTES"):source.index("function resourceQuestOverlayEl")]
    assert "templateId:'find_coins'" in routes
    assert "templateId:'branch_run'" in routes
    assert "templateId:'stone_run'" in routes
    shortfall = function_source(source, "showResourceQuestPrompt")
    assert "setQuestCategoryOpen(route.category, true)" in shortfall
    assert "switchScreen('quests')" in shortfall
    assert "openQuestSend(route.templateId)" in shortfall
    # A short town purse must leave the button tappable so the shared gate runs.
    town = function_source(source, "townBuildingSheetHTML")
    assert "crewFree && wardFree ? '' : ' disabled'" in town
    village_build = function_source(source, "empireBuildStructure")
    for kind in ("coins", "branches", "stone"):
        assert f"showResourceQuestPrompt('{kind}'" in village_build
    assert "showBuildResourceQuest(next.cost" in function_source(source, "beginTownHallUpgrade")
    assert "showBuildResourceQuest(plan.cost" in function_source(source, "beginWholesaleUpgrade")


def test_stone_quest_really_pays_building_stone():
    result = run_node(
        f"const c=require({json.dumps(str(ACADEMY_CORE))});"
        "const t=c.getQuestTemplates().find(x=>x.id==='stone_run');"
        "const q=c.createBirdExpedition({id:'strong-bird',power:120,stamina:120,int:40,spd:40,cha:40},'stone_run',1000,{durationMinutes:5});"
        "process.stdout.write(JSON.stringify({template:t,options:c.getQuestDurationOptions('stone_run'),reward:q.rewards.stone}));"
    )
    assert result["template"]["starter"] is True
    assert result["template"]["category"] == "materials"
    assert all(option["stone"][1] > 0 for option in result["options"])
    assert result["reward"] > 0


def test_resource_route_opens_the_matching_picker_at_runtime():
    source = html()
    routes = source[source.index("const RESOURCE_QUEST_ROUTES"):source.index("function resourceQuestOverlayEl")]
    prompt = function_source(source, "showResourceQuestPrompt")
    result = run_node(
        routes + prompt + "\n" +
        "const gameState={player:{coins:0}};"
        "const playerBranches=()=>0,playerStone=()=>0;"
        "const calls=[];"
        "const closeResourceQuestPrompt=()=>calls.push('close');"
        "const showToast=msg=>calls.push('toast:'+msg);"
        "const setQuestCategoryOpen=(id,open)=>calls.push('category:'+id+':'+open);"
        "let currentScreen='academy';"
        "const renderBirdExpeditions=()=>calls.push('render');"
        "const switchScreen=id=>{currentScreen=id;calls.push('screen:'+id);};"
        "const requestAnimationFrame=fn=>fn();"
        "const openQuestSend=id=>calls.push('send:'+id);"
        "showResourceQuestPrompt('coins',10,'The Market');"
        "showResourceQuestPrompt('branches',8,'The Office');"
        "showResourceQuestPrompt('stone',6,'The Hall');"
        "process.stdout.write(JSON.stringify(calls));"
    )
    assert "send:find_coins" in result
    assert "send:branch_run" in result
    assert "send:stone_run" in result


def test_specialist_build_material_selects_its_exact_quest_at_runtime():
    helper = function_source(html(), "showBuildResourceQuest")
    result = run_node(
        helper + "\n" +
        "const gameState={player:{coins:999}};"
        "const playerBranches=()=>999,playerStone=()=>999,townCostMaterialCount=()=>0;"
        "const window={BurbzAcademyCore:{getQuestTemplates:()=>[{id:'oak_gather',material:'oak_twig',icon:'🪵'}]}};"
        "const lootCore=()=>({materialById:id=>({icon:'🪵',label:'Oak Twig'})});"
        "const calls=[];const showResourceQuestPrompt=(...args)=>calls.push(args);"
        "const routed=showBuildResourceQuest({materials:{oak_twig:2}},'The Hall');"
        "process.stdout.write(JSON.stringify({routed,calls}));"
    )
    assert result["routed"] is True
    assert result["calls"][0][3]["templateId"] == "oak_gather"
    assert result["calls"][0][3]["category"] == "materials"


def test_stone_claim_pipeline_banks_and_displays_the_reward():
    source = html()
    claim = function_source(source, "claimBirdExpedition")
    assert "advanced.rewards.stone" in claim
    assert "addStone(stone)" in claim
    assert "coins, branches, stone, xp:questXp" in claim
    assert "coins, branches, stone, xp: questXp" in claim
    assert "rewards.stone > 0" in function_source(source, "playQuestClaimCelebration")


def test_unaffordable_bulk_build_buttons_stay_clickable_for_quest_routing():
    source = html()
    region = function_source(source, "renderRegionScreen")
    town = function_source(source, "renderTownScreen")
    assert "data-action=\"region-upgrade-all\"' + (affordable ? '' : ' disabled')" not in region
    assert "data-action=\"town-upgrade-all\"' + (planAffordable(townPlan) ? '' : ' disabled')" not in town
    assert "const crewFree = activeProjects < slots, affordable = townCostAffordable(next.cost), enabled = gateMet && crewFree;" in town


def test_manager_office_exists_but_only_unlocks_after_a_complete_village():
    rooms = run_node(
        f"const c=require({json.dumps(str(ACADEMY_CORE))});"
        "process.stdout.write(JSON.stringify(c.getAcademyRooms()));"
    )
    office = next(room for room in rooms if room["id"] == "manager_office")
    assert office["label"] == "Project Manager's Office"
    assert office["role"] == "management" and office["cost"] > 0
    source = html()
    complete = function_source(source, "villageHasEveryBuilding")
    assert "villageTierBuildings().every" in complete
    assert "villageBuildingLevel(rec, b.id) > 0" in complete
    lock = function_source(source, "academyBuildingProgressLock")
    assert "completedVillageCount()" in lock
    assert "BUILD ALL VILLAGE BUILDINGS" in lock
    for name in ("academyBuildBuilding", "academyStartPlaceBuilding"):
        assert "academyBuildingProgressLock(id)" in function_source(source, name)
    result = run_node(
        complete + "\n" +
        "const villageTierBuildings=()=>[{id:'home'},{id:'well'},{id:'yard'}];"
        "let levels={home:1,well:1,yard:0};"
        "const villageBuildingLevel=(rec,id)=>levels[id]||0;"
        "const out=[villageHasEveryBuilding({})];"
        "levels.yard=1;out.push(villageHasEveryBuilding({}));"
        "process.stdout.write(JSON.stringify(out));"
    )
    assert result == [False, True]


def test_project_manager_assignment_is_blocked_in_the_ui_and_at_mutation_time():
    source = html()
    gate = function_source(source, "projectManagerAppointmentGate")
    assert "rolePostTitle(scope, key) !== 'Project Manager'" in gate
    assert "isAcademyBuildingBuilt('manager_office')" in gate
    assert "completedVillageCount()" in gate
    assert "projectManagerAppointmentGate(scope, key)" in function_source(source, "openRolePicker")
    assert "projectManagerAppointmentGate(scope, key)" in function_source(source, "assignBirdRole")
    assert "is-locked" in function_source(source, "rolePostRowHTML")
    # The shared village save slot also represents a Town Lord Mayor; it must
    # not be caught by the standalone Project Manager licence.
    result = run_node(
        gate + "\n" +
        "let office=false, complete=0, title='Project Manager';"
        "const rolePostTitle=()=>title;"
        "const isAcademyBuildingBuilt=()=>office;"
        "const completedVillageCount=()=>complete;"
        "const out=[];"
        "out.push(projectManagerAppointmentGate('village','1'));"
        "complete=1;out.push(projectManagerAppointmentGate('village','1'));"
        "office=true;out.push(projectManagerAppointmentGate('village','1'));"
        "office=false;title='Lord Mayor';out.push(projectManagerAppointmentGate('village','1'));"
        "process.stdout.write(JSON.stringify(out));"
    )
    assert "every kind" in result[0]
    assert "Office" in result[1]
    assert result[2:] == ["", ""]


def test_locked_manager_picker_and_mutation_stop_before_opening_or_assignment():
    source = html()
    result = run_node(
        function_source(source, "openRolePicker") + "\n" + function_source(source, "assignBirdRole") + "\n" +
        "const gameState={flock:[{id:'bird-1'}]};let rolePickerOpen=null;let opened=0,assigned=0,focused=0;"
        "const roleDefFor=()=>({});const projectManagerAppointmentGate=()=>\"locked\";"
        "const focusProjectManagerOffice=()=>{focused+=1;};const closeRolePicker=()=>{};"
        "const rolePickerRoot=()=>{opened+=1;return {classList:{add(){}},setAttribute(){}};};"
        "const rolePickerSheetHTML=()=>'';const SFX={tap(){}};"
        "const birdRolesCore=()=>({assignRole(){assigned+=1;return {};}});"
        "openRolePicker('village','1','');assignBirdRole('village','1','bird-1');"
        "process.stdout.write(JSON.stringify({opened,assigned,focused}));"
    )
    assert result == {"opened": 0, "assigned": 0, "focused": 2}


def test_existing_roles_never_bypass_the_complete_village_office_unlock():
    source = function_source(html(), "loadState")
    assert "needsProjectManagerOfficeMigration" not in source
    assert "legacyVillageRoles" not in source
    assert "legacy-project-manager" not in source


def test_blocked_purchase_paths_return_before_mutating_money_or_stock():
    source = html()
    for name in ("storesSellItem", "magpieMarketSell", "magpieMarketBuy", "buyTrailTavernDrink", "empireSendSupplyCart"):
        body = function_source(source, name)
        gate = body.index("requireMagpieMarketTrade()")
        mutation_tokens = ("addCoins(", "addBranches(", "addStone(", "saveState(", "storesSellItem(")
        mutations = [i for token in mutation_tokens if (i := body.find(token, gate + 1)) >= 0]
        assert mutations and gate < min(mutations), name


def test_release_and_all_changed_academy_cores_are_pwa_pinned():
    source, sw = html(), SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = 'companion-card-polish-v355-20260906';" in source
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert cache_line.rstrip("';").endswith("companion-card-polish-v355-20260906")
    for core in ("academy_treehouse_core.js", "academy_alive_core.js", "academy_3d_core.js"):
        pin = f"{core}?v={RELEASE}"
        assert pin in source
        assert f"'./{pin}'" in sw
    card_animation = source.index(".academy-building-card.quest-guided { border-color")
    reduced_motion = source.index("@media (prefers-reduced-motion:reduce) { .academy-building-card.quest-guided")
    assert reduced_motion > card_animation
