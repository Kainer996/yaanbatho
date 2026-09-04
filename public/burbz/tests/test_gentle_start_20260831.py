"""Gentle start: the game introduces itself one destination at a time.

Yaan's asks (2026-08-31), after friends found the game overwhelming:

1. Keep every feature, but do not have them all unlocked at once — only
   what is relevant to the player quests. The chain is the teacher, so the
   dock grows as the chain reaches each destination; the save's own
   evidence (a flock, a built room, wins) opens a gate early, and trainer
   level 12 — the old early-game line — opens everything.
2. Long explanations move behind a small eye icon: tap to read, tap to
   put away. Nothing sits permanently on screen.
3. The Empire build buttons wrapped mid-bill ("60 🪙" stranding its coin
   on the next line, "+ 0 stone" saying nothing). Orders now read as two
   clean lines — the action, then unbreakable cost chips — and a zero
   cost says nothing.

Pinned as `gentle-start-v338`.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "onboarding_gate_core.js"
UPDATER = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "gentle-start-v338-20260831"
CURRENT_BUILD = "alderwing-living-settlements-v348-20260904"


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8",
        capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


GATE_PRELUDE = "const G = require('./onboarding_gate_core.js');"

# The chain as index.html orders it — kept in lockstep by
# test_every_gate_link_is_a_real_chain_link below.
CHAIN = [
    "pq_open_empire", "pq_liberate", "pq_first_bird", "pq_expedition",
    "pq_claim_errand", "pq_build_barracks", "pq_recruit", "pq_true_diet",
    "pq_preen", "pq_build_training", "pq_training_drill",
    "pq_build_quest_roost", "pq_build_market", "pq_market_trade",
    "pq_equip_gear", "pq_first_win", "pq_build_kitchen", "pq_meal",
    "pq_diet_badge", "pq_build_hospital", "pq_hospital_rest", "pq_win_3",
    "pq_walk_adventure", "pq_quiz", "pq_village_build", "pq_craft_gear",
    "pq_village_food", "pq_complete_village", "pq_build_manager_office",
    "pq_build_crowbar", "pq_village_steward",
    "pq_species_10", "pq_village_tax", "pq_build_workshop", "pq_liberate_3",
    "pq_merge_star", "pq_found_town",
]


def unlocked(claimed, evidence=None, level=1):
    src = "\n".join([
        GATE_PRELUDE,
        "const out = G.unlockedFeatures({",
        "  chainIds: " + json.dumps(CHAIN) + ",",
        "  claimedIds: " + json.dumps(claimed) + ",",
        "  evidence: " + json.dumps(evidence or {}) + ",",
        "  playerLevel: " + json.dumps(level) + ",",
        "});",
        "console.log(JSON.stringify(out));",
    ])
    return run_node(src)


# ---------------------------------------------------------------------------
# 1. The pure gate: a brand-new save meets a near-empty dock
# ---------------------------------------------------------------------------

def test_a_new_save_opens_on_the_essentials_only():
    out = unlocked([])
    always_open = ["map", "quests", "village", "scan"]
    for feature in always_open:
        assert out[feature] is True, feature
    for feature, state in out.items():
        if feature not in always_open:
            assert state is False, feature


def test_each_destination_joins_when_the_chain_reaches_its_link():
    # Feature → the link whose ACTIVATION (every earlier link claimed)
    # opens it. Claiming everything before the link makes it active.
    expectations = {
        "academy": "pq_build_barracks",
        "birdex": "pq_preen",
        "diary": "pq_preen",
        "training": "pq_build_training",
        "forge": "pq_equip_gear",
        "inventory": "pq_equip_gear",
        "battle": "pq_first_win",
        "kitchen": "pq_true_diet",
        "hospital": "pq_build_hospital",
        "leaderboards": "pq_win_3",
        "quests_daily": "pq_build_barracks",
        "quests_weekly": "pq_first_win",
        "quests_achievements": "pq_first_win",
        "quests_walks": "pq_walk_adventure",
    }
    for feature, link in expectations.items():
        i = CHAIN.index(link)
        before = unlocked(CHAIN[: i - 1] if i > 0 else [])
        at = unlocked(CHAIN[:i])
        if i > 0:
            assert before[feature] is False, f"{feature} opened a link early"
        assert at[feature] is True, f"{feature} still shut at its own link"


def test_gates_never_relock_after_the_link_passes():
    out = unlocked(CHAIN)  # the whole chain claimed
    assert all(out.values())


def test_the_saves_own_evidence_opens_a_gate_early():
    checks = [
        ({"academy": True}, "academy"),
        ({"birdex": True}, "birdex"),
        ({"forge": True}, "forge"),
        ({"inventory": True}, "inventory"),
        ({"battle": True}, "battle"),
        ({"kitchen": True}, "kitchen"),
        ({"leaderboards": True}, "leaderboards"),
        ({"quests_walks": True}, "quests_walks"),
    ]
    for evidence, feature in checks:
        out = unlocked([], evidence)
        assert out[feature] is True, feature
        # Evidence for one feature opens that feature alone.
        assert out["training"] is False


def test_level_12_is_the_master_valve():
    # The early game ends at trainer level 12 (v262) — from there a
    # veteran's dock looks exactly as it always did.
    assert all(unlocked([], None, 12).values())
    assert unlocked([], None, 11)["battle"] is False


def test_a_link_the_chain_no_longer_carries_never_locks_its_feature():
    src = "\n".join([
        GATE_PRELUDE,
        "const out = G.unlockedFeatures({ chainIds: ['pq_open_empire'],",
        "  claimedIds: [], evidence: {}, playerLevel: 1 });",
        "console.log(JSON.stringify({ battle: out.battle }));",
    ])
    assert run_node(src) == {"battle": True}


def test_the_swipe_road_skips_locked_screens_and_keeps_order():
    src = "\n".join([
        GATE_PRELUDE,
        "const road = ['inventory','forge','leaderboards','map','quests','village','scan','academy','battle','birdex'];",
        "const open = { inventory:false, forge:false, leaderboards:false, map:true, quests:true, village:true, scan:true, academy:false, battle:false, birdex:false };",
        "console.log(JSON.stringify(G.filterRoad(road, open)));",
    ])
    assert run_node(src) == ["map", "quests", "village", "scan"]


def test_every_gate_link_is_a_real_chain_link():
    html = html_text()
    core = CORE.read_text(encoding="utf-8")
    links = set(re.findall(r"'(pq_[a-z0-9_]+)'", core))
    for link in links:
        assert f"id:'{link}'" in html, f"{link} is not in PLAYER_QUESTS"
    # And the copy of the chain this suite tests with matches index.html.
    ids = re.findall(r"\{ id:'(pq_[a-z0-9_]+)'", html)
    assert ids == CHAIN


# ---------------------------------------------------------------------------
# 2. The gate wired into the game
# ---------------------------------------------------------------------------

def test_the_gate_rides_the_badge_heartbeat_and_boot():
    html = html_text()
    beat = function_source(html, "updateActionBadges")
    assert "applyFeatureGates()" in beat
    # init() is the file's last function — slice to the boot call instead.
    boot = html[html.index("function init() {"):html.index("\ninit();")]
    assert "applyFeatureGates(); // fold the dock" in boot
    assert boot.index("loadState();") < boot.index("applyFeatureGates();")


def test_apply_walks_the_dock_and_folds_empty_rows():
    html = html_text()
    apply_src = function_source(html, "applyFeatureGates")
    assert "'[data-game-route][data-screen],[data-quick-destination]'" in apply_src
    assert "item.hidden = map[key] === false;" in apply_src
    assert "dock-compact" in apply_src
    # A hidden nav item must beat its own display:flex.
    assert ".nav-item[hidden], .dock-row[hidden], .dock-pair[hidden], .header-diary-btn[hidden] { display: none !important; }" in html
    # One row tall once the whole top deck is folded.
    assert "body.dock-compact { --nav-height: 50px; }" in html


def test_the_swipe_road_reads_the_gate():
    html = html_text()
    neighbour = function_source(html, "screenSwipeNeighbour")
    assert "filterRoad(SCREEN_SWIPE_ROAD, featureGateMap)" in neighbour


def test_quest_boards_wait_their_turn():
    html = html_text()
    quests = function_source(html, "renderQuests")
    assert "if (featureGateOpen('quests_daily'))" in quests
    assert "if (featureGateOpen('quests_weekly'))" in quests
    assert "if (featureGateOpen('quests_achievements'))" in quests
    assert "if (featureGateOpen('quests_walks'))" in quests
    # A quest whose board is still shut completes without a corner card…
    notice = function_source(html, "queueQuestCompleteNotice")
    assert "featureGateOpen('quests_daily')" in notice
    # …and without lighting the Quests dot it cannot clear.
    badge_state = function_source(html, "normalizeActionBadgeState")
    assert "featureGateOpen('quests_daily') ? DAILY_QUESTS : []" in badge_state


def test_evidence_reads_the_save_not_the_chain():
    html = html_text()
    ev = function_source(html, "featureGateEvidence")
    # The tutorial's own beat opens the Academy the moment Merlin says
    # "To the Academy!" — before any chain link is claimed.
    assert "tutorialFlowState().errandClaimed" in ev
    # New saves start with gear in the bag, so the bag proves nothing;
    # gear on a bird does.
    assert "inventory.equipment" in ev
    assert "inventory.gear" not in ev
    # The first liberation also counts a win, so one win is not the arena.
    assert "wins >= 2" in ev
    assert "wins >= 3" in ev


def test_the_tutorials_own_targets_never_hide():
    # Merlin's story chapter spotlights Scan and Quests, and the game
    # boots onto the Scan screen — those gates must never exist.
    src = "\n".join([
        GATE_PRELUDE,
        "console.log(JSON.stringify({",
        "  map: G.FEATURE_UNLOCKS.map, quests: G.FEATURE_UNLOCKS.quests,",
        "  scan: G.FEATURE_UNLOCKS.scan, village: G.FEATURE_UNLOCKS.village,",
        "}));",
    ])
    out = run_node(src)
    assert out == {"map": None, "quests": None, "scan": None, "village": None}


# ---------------------------------------------------------------------------
# 3. The little eye
# ---------------------------------------------------------------------------

def test_the_eye_is_one_component_with_one_listener():
    html = html_text()
    assert "function infoDotHTML(" in html
    assert "function infoNoteHTML(" in html
    # Capture phase, so an eye inside a tappable card only toggles its note.
    handler = html[html.index("const dot = ev.target && ev.target.closest ? ev.target.closest('[data-info-dot]')"):]
    assert "}, true);" in handler[:700]
    assert ".info-note[hidden] { display:none !important; }" in html


def test_the_long_explanations_live_behind_eyes_now():
    html = html_text()
    notes = [
        "infoNoteVillageIncome", "infoNoteTownWorks", "infoNoteTownStrongbox",
        "infoNoteTownUpgrade", "infoNoteTownHall", "infoNoteTownNetworks",
        "infoNoteTownProvisions", "infoNoteTownPolicy", "infoNoteTownVisit",
        "infoNoteTownMayor", "infoNoteTownCounty", "infoNoteRegionUpgrade",
        "infoNoteCountyRules", "infoNoteVillageStar", "infoNoteTownStar",
        "infoNoteStoresMaterials", "infoNoteStoresYards", "infoNoteForgeIntro",
        "infoNoteForgeMaterials", "infoNoteTrainingBoard", "infoNoteErrandBoard",
        "infoNoteCountyChart", "infoNoteNightWings",
    ]
    for note in notes:
        assert html.count(note) >= 2, f"{note} needs a dot and a note"


def test_the_village_desk_says_the_number_not_the_lecture():
    html = html_text()
    assert "This village pays <b>+" not in html
    assert "every 8h" in html
    # The scan screen's privacy note folded behind its eye, but the
    # button's accessible description still points at the full text.
    assert 'aria-describedby="merlinDataNote"' in html
    assert '<div class="merlin-data-note info-note" id="merlinDataNote" hidden>' in html


def test_hidden_merlin_clues_say_the_how_once():
    notebook = function_source(html_text(), "renderMerlinClueNotebook")
    assert "hintSaid" in notebook
    assert notebook.count("Send birds from the Quest Roost to uncover it") == 1


# ---------------------------------------------------------------------------
# 4. Build orders: the action, then the bill in unbreakable chips
# ---------------------------------------------------------------------------

def test_the_bill_chips_never_break_and_zero_says_nothing():
    html = html_text()
    chips = function_source(html, "buildCostChipsHTML")
    assert "Number(cost.coins) > 0" in chips
    assert "Number(cost.stone) > 0" in chips
    assert ".build-cost-bit { white-space:nowrap;" in html
    # Behaviour: zero stone renders no stone chip at all.
    src = "\n".join([
        "const lootCore = () => ({ materialById: () => null });",
        "const escapeHtml = s => String(s);",
        function_source(html, "formatBuildDuration"),
        function_source(html, "buildCostChipsHTML"),
        "console.log(JSON.stringify({",
        "  plain: buildCostChipsHTML({ coins: 60, branches: 20, stone: 0 }, 240000),",
        "  free: buildCostChipsHTML({ coins: 0, branches: 0, stone: 0 }),",
        "}));",
    ])
    out = run_node(src)
    assert "0 🪨" not in out["plain"]
    assert "stone" not in out["plain"]
    assert out["plain"].count("build-cost-bit") == 3  # coins, timber, clock
    assert out["free"] == ""


def test_every_build_order_reads_as_action_then_bill():
    html = html_text()
    # Village desk, region upgrade, town upgrade, hall upgrade, network,
    # town sheet build, liberation birdhouse.
    assert html.count("build-btn-act") >= 10
    # step-inside-buildings-v341: the desk grid and the town network cards
    # became door tiles; their build orders (and bills) moved inside the
    # buildings, so two chip call sites folded into the interior cards.
    assert html.count("buildCostChipsHTML(") >= 7
    # The old single-string bill is gone from the village desk button.
    assert "' 🪙 + ' + cost.branches + ' 🪵 + ' + cost.stone + ' stone" not in html


def test_the_buttons_stack_their_two_lines():
    html = html_text()
    assert ".province-build-btn, .town-action { display:flex; flex-direction:column;" in html
    assert "flex-direction:column" in html.split(".village-claim-btn {")[1].split("}")[0]


# ---------------------------------------------------------------------------
# 5. Release plumbing
# ---------------------------------------------------------------------------

def test_release_plumbing():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    # The segment is in the lineage. It led the cache name only until the next
    # release appended its own (polished-ui-notifications-v339 was the first).
    assert sw.count(f"-{OWN_RELEASE_PIN}") == 1
    assert f'<script src="onboarding_gate_core.js?v={OWN_RELEASE_PIN}"></script>' in html
    assert sw.count(f"./onboarding_gate_core.js?v={OWN_RELEASE_PIN}") == 2
    # The VPS updater ships the new core, or live 404s the feature.
    assert '"onboarding_gate_core.js"' in UPDATER.read_text(encoding="utf-8")
