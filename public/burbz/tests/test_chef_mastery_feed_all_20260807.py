"""Head Chef mastery and the level-10 Feed All service.

The chef improves through real time spent on duty. At Chef Level 10 the Kitchen
unlocks one button that uses compatible pantry/larder food to feed every hungry
bird it can, then names every bird that could not be fed.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
ROLES = ROOT / "bird_roles_core.js"
SW = ROOT / "sw.js"
OWN_RELEASE_PIN = "chef-mastery-feed-all-v261-20260813"
CURRENT_BUILD = "steward-project-manager-v294-20260820"
ROLES_PIN = "steward-project-manager-v294-20260820"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    brace = html.index("{", start)
    depth = 0
    for pos in range(brace, len(html)):
        if html[pos] == "{":
            depth += 1
        elif html[pos] == "}":
            depth -= 1
            if depth == 0:
                return html[start : pos + 1]
    raise AssertionError(f"unterminated function {name}")


def test_chef_career_levels_up_from_time_on_duty_and_keeps_earned_time_after_standing_down():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        const day = roles.CHEF_MS_PER_LEVEL;
        const started = roles.startChefCareer({}, 1000);
        const afterNineDays = roles.chefCareerProgress(started, 1000 + 9 * day);
        const paused = roles.pauseChefCareer(started, 1000 + 4 * day);
        const muchLater = roles.chefCareerProgress(paused, 1000 + 40 * day);
        console.log(JSON.stringify({
          fresh: roles.chefCareerProgress(started, 1000),
          mastered: afterNineDays,
          paused,
          muchLater
        }));
        """
    )
    assert out["fresh"]["level"] == 1
    assert out["fresh"]["rewardMultiplier"] == 1
    assert out["mastered"]["level"] == 10
    assert out["mastered"]["feedAllUnlocked"] is True
    assert out["mastered"]["rewardMultiplier"] > 1
    assert out["paused"]["activeSince"] is None
    assert out["muchLater"]["level"] == 5  # four completed days remain four days while off duty


def test_feed_all_plan_prefers_proper_meals_respects_stock_and_names_every_unfed_bird():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        const entries = [
          { key:'robin', name:'Robin', options:[
            { foodKey:'pantry:seeds', verdict:'secondary' },
            { foodKey:'larder:mealworms', verdict:'primary' }
          ]},
          { key:'gull', name:'Gull', options:[{ foodKey:'pantry:fish', verdict:'primary' }] },
          { key:'owl', name:'Owl', options:[{ foodKey:'larder:mouse', verdict:'primary' }] },
          { key:'crow', name:'Crow', options:[{ foodKey:'pantry:seeds', verdict:'secondary' }] }
        ];
        console.log(JSON.stringify(roles.chefFeedAllPlan(entries, {
          'pantry:seeds': 1,
          'larder:mealworms': 1,
          'pantry:fish': 0,
          'larder:mouse': 0
        })));
        """
    )
    assert out["assignments"] == [
        {"key": "robin", "foodKey": "larder:mealworms", "verdict": "primary"},
        {"key": "crow", "foodKey": "pantry:seeds", "verdict": "secondary"},
    ]
    assert out["unfed"] == ["gull", "owl"]


def test_feed_all_plan_maximises_birds_fed_instead_of_wasting_specialist_food():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        console.log(JSON.stringify(roles.chefFeedAllPlan([
          { key:'omnivore', options:[
            { foodKey:'pantry:fish', verdict:'primary' },
            { foodKey:'pantry:seeds', verdict:'primary' }
          ]},
          { key:'fish-specialist', options:[{ foodKey:'pantry:fish', verdict:'primary' }]}
        ], { 'pantry:fish':1, 'pantry:seeds':1 })));
        """
    )
    assert out["unfed"] == []
    assert {row["key"] for row in out["assignments"]} == {"omnivore", "fish-specialist"}
    assert next(row for row in out["assignments"] if row["key"] == "fish-specialist")["foodKey"] == "pantry:fish"
    assert next(row for row in out["assignments"] if row["key"] == "omnivore")["foodKey"] == "pantry:seeds"


def test_feed_all_plan_deduplicates_corrupt_duplicate_bird_ids():
    out = run_node(
        """
        const roles = require('./bird_roles_core.js');
        console.log(JSON.stringify(roles.chefFeedAllPlan([
          { key:'same-bird', options:[{ foodKey:'pantry:seeds', verdict:'primary' }] },
          { key:'same-bird', options:[{ foodKey:'pantry:seeds', verdict:'primary' }] }
        ], { 'pantry:seeds':2 })));
        """
    )
    assert out["assignments"] == [{"key": "same-bird", "foodKey": "pantry:seeds", "verdict": "primary"}]
    assert out["remainingStock"]["pantry:seeds"] == 1


def test_feed_all_runtime_consumes_real_stock_rewards_fed_birds_and_names_unfed_birds():
    html = HTML.read_text(encoding="utf-8")
    feed_all = function_source(html, "chefFeedAllBirds")
    out = run_node(
        f"""
        const rolesCore = require('./bird_roles_core.js');
        var gameState = {{
          pantry:{{ seeds:1, fish:0 }}, player:{{ mealsServed:0 }},
          flock:[
            {{ id:'robin', commonName:'Robin', care:{{}}, training:{{}}, academy:{{}}, maxHp:50, hp:40 }},
            {{ id:'gull', commonName:'Gull', care:{{}}, training:{{}}, academy:{{}}, maxHp:50, hp:40 }}
          ]
        }};
        const entries = [
          {{ key:'robin', name:'Robin', hungry:true, target:{{ birdId:'robin' }}, options:[{{ kind:'pantry', id:'seeds', accepted:true, verdict:'primary' }}] }},
          {{ key:'gull', name:'Gull', hungry:true, target:{{ birdId:'gull' }}, options:[] }}
        ];
        const notices = [], toasts = [], quests = [];
        let saveFails = false;
        const window = {{}};
        const MERLIN_CORE = null;
        const SFX = {{ capture(){{}}, tap(){{}} }};
        function birdRolesCore() {{ return rolesCore; }}
        function kitchenDietCore() {{ return {{
          applyFeedingTransaction(state, target, spec) {{
            const next = structuredClone(state);
            const key = spec.pantryKey;
            if (!key || !(next.pantry[key] > 0)) return {{ state:next, ok:false, duplicate:false }};
            next.pantry[key] -= 1;
            return {{ state:next, ok:true, duplicate:false, compatibility:{{ verdict:'primary' }} }};
          }}
        }}; }}
        function rolePostState() {{ return {{ staffed:true, bird:{{ id:'chef', commonName:'Chef Robin' }} }}; }}
        function headChefCareerProgress() {{ return {{ feedAllUnlocked:true }}; }}
        function kitchenBoardEaterRows() {{ return entries; }}
        function kitchenBoardIsHungry(entry) {{ return entry.hungry; }}
        function kitchenAllInStockFoods() {{ return [{{ kind:'pantry', id:'seeds', count:gameState.pantry.seeds }}]; }}
        function kitchenRosterFoodOptions(entry) {{ return entry.options; }}
        function feedRewardsForVerdict() {{ return {{ birdXp:4, trainerXp:2, bondXp:0 }}; }}
        function academyBirdById(id) {{ return gameState.flock.find(b => b.id === id); }}
        function ensureBirdAcademy() {{}}
        function levelUpBird(bird, xp) {{ bird.xp = (bird.xp || 0) + xp; }}
        function clamp(value, lo, hi) {{ return Math.max(lo, Math.min(hi, value)); }}
        function recalcBirdPower() {{}}
        function updateQuestProgress(key, value) {{ quests.push([key, value]); }}
        function applyPlayerXpState(xp) {{ gameState.player.xp = (gameState.player.xp || 0) + xp; }}
        function snapshotGameState() {{ return JSON.parse(JSON.stringify(gameState)); }}
        function restoreGameStateSnapshot(snapshot) {{ gameState = snapshot; return gameState; }}
        function saveState() {{ if (saveFails) return {{ ok:false }}; gameState.saved = true; return {{ ok:true }}; }}
        function showToast(message) {{ toasts.push(message); }}
        function showFeedNotePopup(title, body) {{ notices.push({{ title, body }}); }}
        function refreshFeedSurfaces() {{ gameState.refreshed = true; }}
        function birdDisplayName(bird) {{ return bird.commonName; }}
        function escapeHtml(value) {{ return String(value); }}
        {feed_all}
        chefFeedAllBirds();
        const success = {{ gameState:JSON.parse(JSON.stringify(gameState)), notices:[...notices], toasts:[...toasts], quests:[...quests] }};
        saveFails = true;
        gameState = {{
          pantry:{{ seeds:1, fish:0 }}, player:{{ mealsServed:0 }},
          flock:[
            {{ id:'robin', commonName:'Robin', care:{{}}, training:{{}}, academy:{{}}, maxHp:50, hp:40 }},
            {{ id:'gull', commonName:'Gull', care:{{}}, training:{{}}, academy:{{}}, maxHp:50, hp:40 }}
          ]
        }};
        notices.length = 0; toasts.length = 0; quests.length = 0;
        chefFeedAllBirds();
        console.log(JSON.stringify({{ success, failed:{{ gameState, notices, toasts, quests }} }}));
        """
    )
    success = out["success"]
    assert success["gameState"]["pantry"]["seeds"] == 0
    assert success["gameState"]["flock"][0]["care"]["lastFed"]
    assert success["gameState"]["flock"][0]["xp"] == 4
    assert "lastFed" not in success["gameState"]["flock"][1]["care"]
    assert success["gameState"]["player"]["mealsServed"] == 1
    assert success["gameState"]["saved"] is True and success["gameState"]["refreshed"] is True
    assert "fed 1 bird" in success["toasts"][0]
    assert len(success["notices"]) == 1 and "Gull" in success["notices"][0]["body"]
    failed = out["failed"]
    assert failed["gameState"]["pantry"]["seeds"] == 1
    assert "lastFed" not in failed["gameState"]["flock"][0]["care"]
    assert failed["gameState"]["player"]["mealsServed"] == 0
    assert any("couldn’t save" in toast for toast in failed["toasts"])


def test_kitchen_wires_persisted_career_progress_level_10_button_and_unfed_notification():
    html = HTML.read_text(encoding="utf-8")
    assert "chefCareers: {}" in html
    load_state = function_source(html, "loadState")
    assert "resumeAssignedHeadChefCareer" in load_state
    ensure_roles = function_source(html, "ensureRolesState")
    assert "staleChefId" in ensure_roles and "pauseHeadChefCareer(staleChefId)" in ensure_roles
    assign = function_source(html, "assignBirdRole")
    clear = function_source(html, "clearBirdRole")
    assert "startHeadChefCareer(bird.id)" in assign
    assert "pauseHeadChefCareer(before.bird.id)" in clear

    progress = function_source(html, "headChefCareerProgress")
    assert "chefCareerProgress" in progress
    rewards = function_source(html, "feedRewardsForVerdict")
    assert "headChefCareerProgress" in rewards and "rewardMultiplier" in rewards

    board = function_source(html, "kitchenHeadChefBoardHTML")
    assert "Chef Level" in board
    assert "data-action=\"chef-feed-all\"" in board
    assert "Feed all birds" in board
    assert "feedAllUnlocked" in board

    feed_all = function_source(html, "chefFeedAllBirds")
    assert "chefFeedAllPlan" in feed_all
    assert "showFeedNotePopup" in feed_all
    assert "weren’t fed" in feed_all
    assert "entry.name" in feed_all
    assert "chefFeedAllBirds," in html  # exported for the inline button


def test_release_pins_the_changed_page_roles_core_and_service_worker():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    assert f'src="bird_roles_core.js?v={ROLES_PIN}"' in html
    assert f"'./bird_roles_core.js?v={ROLES_PIN}'" in sw
