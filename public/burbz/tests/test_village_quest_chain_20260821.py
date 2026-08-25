"""The player chain learns to run a village, not just free one.

Yaan asked for several village quests, "at the right places in the gameplay".
Before this the chain only ever mentioned villages twice — liberate one, then
liberate three — and never once asked the player to build in one, feed it,
staff it, tax it or merge it. Six links now cover that arc.

They start the moment a village is yours and interleave with the Academy and
collecting goals, so the late chain never runs six village errands back to
back. (Since free-your-first-village-v327 the liberation itself opens the
chain, so the arc no longer sits immediately behind it — the Academy and
collecting goals come between.) The two long ones close the chain: a
merge star, then a town charter — which needs three villages, so they sit
after "Kingdom of the free".

Every one of these actions had to grow a quest hook: not one village or
empire action reported to updateQuestProgress before this release.
"""
import json
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
HTML = (BURBZ / "index.html").read_text(encoding="utf-8")
SW = (BURBZ / "sw.js").read_text(encoding="utf-8")

RELEASE_PIN = "trail-mode-v329-20260825"
OWN_RELEASE_PIN = "village-chain-v307-20260821"

VILLAGE_LINKS = [
    "pq_village_build",
    "pq_village_food",
    "pq_village_steward",
    "pq_village_tax",
    "pq_merge_star",
    "pq_found_town",
]


def player_quests():
    start = HTML.index("const PLAYER_QUESTS = [")
    end = HTML.index("\n];", start) + 3
    source = HTML[start:end] + "\nconsole.log(JSON.stringify(PLAYER_QUESTS));"
    result = subprocess.run(
        ["node", "-e", source], cwd=BURBZ, text=True, encoding="utf-8", capture_output=True
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def block(start_marker: str, end_marker: str) -> str:
    start = HTML.index(start_marker)
    return HTML[start:HTML.index(end_marker, start)]


# ---------------------------------------------------------------------------
# Placement
# ---------------------------------------------------------------------------

def test_the_village_arc_opens_the_moment_a_village_is_yours():
    ids = [q["id"] for q in player_quests()]
    # Nothing about running a village may come before owning one.
    liberate = ids.index("pq_liberate")
    for link in VILLAGE_LINKS:
        assert ids.index(link) > liberate, link
    # Building in a village leads the arc.
    assert ids.index("pq_village_build") == min(ids.index(link) for link in VILLAGE_LINKS)


def test_the_arc_is_interleaved_not_a_run_of_six_errands():
    ids = [q["id"] for q in player_quests()]
    positions = sorted(ids.index(link) for link in VILLAGE_LINKS)
    # The four mid-chain links are each separated by a non-village goal.
    for earlier, later in zip(positions[:3], positions[1:4]):
        assert later - earlier >= 2, (earlier, later)


def test_a_town_charter_waits_for_three_villages_and_a_star():
    ids = [q["id"] for q in player_quests()]
    assert ids.index("pq_merge_star") > ids.index("pq_liberate_3")
    assert ids.index("pq_found_town") > ids.index("pq_merge_star")
    assert ids[-1] == "pq_found_town"


def test_every_village_link_lands_on_the_empire_screen():
    quests = {q["id"]: q for q in player_quests()}
    for link in VILLAGE_LINKS:
        assert quests[link]["go"] == "village", link
    # 'village' is the Empire tab — a real nav button, no map or GPS needed.
    assert '<button class="nav-item" data-game-route data-screen="village"' in HTML


# ---------------------------------------------------------------------------
# Every link is wired to a real action
# ---------------------------------------------------------------------------

def test_each_new_goal_has_a_hook_at_the_action_that_completes_it():
    hooks = {
        "village_built": "empireBuildStructure",
        "village_provisioned": "empireCompleteConstructions",
        "village_role_filled": "assignBirdRole",
        "tribute_collected": "notePaidTribute",
        "merge_star": "maybeAwardMergeStar",
        "town_founded": "empireMergeVillages",
    }
    types = {q["type"] for q in player_quests()}
    for event, fn in hooks.items():
        assert event in types, event
        assert f"updateQuestProgress('{event}'" in HTML, event
        # The hook sits inside the function that performs the action.
        start = HTML.index(f"function {fn}(")
        body = HTML[start:HTML.index("\nfunction ", start + 10)]
        assert f"updateQuestProgress('{event}'" in body, (fn, event)


def test_the_hooks_survive_being_lifted_out_of_the_page():
    # Several suites eval these settlement functions in a bare node context,
    # so the quest hook is announced the way logDiary already is.
    for event in ("village_built", "village_provisioned", "village_role_filled",
                  "tribute_collected", "merge_star", "town_founded"):
        line = next(l for l in HTML.splitlines() if f"updateQuestProgress('{event}'" in l)
        assert "typeof updateQuestProgress === 'function'" in line, event


def test_feed_and_water_is_measured_not_counted():
    # It asks for a food yard AND a well, so a finished build must re-read the
    # village rather than tick the bar by one — hence amount 0.
    line = next(l for l in HTML.splitlines() if "updateQuestProgress('village_provisioned'" in l)
    assert "'village_provisioned', 0)" in line
    quest = next(q for q in player_quests() if q["id"] == "pq_village_food")
    assert quest["type"] == "village_provisioned"
    body = block("function villagesFedAndWatered()", "\nconst PLAYER_QUESTS")
    assert "b.hut" in body and "b.farm" in body and "b.well" in body


def test_taxes_are_counted_because_nothing_else_recorded_them():
    # There was no cumulative collection counter anywhere in the save.
    assert "tributeCollections: 0" in HTML
    note = block("function notePaidTribute()", "\nfunction collectEmpireTribute()")
    assert "gameState.player.tributeCollections = (Number(gameState.player.tributeCollections) || 0) + 1;" in note
    # All three strongboxes — realm, Town and County — go through it.
    assert HTML.count("  notePaidTribute();") == 3


def test_the_measures_read_real_settlement_state():
    quests = {q["id"]: q for q in player_quests()}
    for link in VILLAGE_LINKS:
        assert quests[link].get("target", 0) >= 1, link
        assert quests[link]["reward"] > 0, link
        assert len(quests[link]["desc"]) <= 60, link
    helpers = block("function villageEconomies()", "\nconst PLAYER_QUESTS")
    assert "gameState.empire && gameState.empire.villages" in helpers
    assert "v.economy" in helpers
    chain = block("{ id:'pq_village_steward'", "{ id:'pq_species_10'")
    assert "gameState.birdRoles && gameState.birdRoles.villages" in chain
    charter = block("{ id:'pq_found_town'", "\n];")
    assert "gameState.empire.townCharters" in charter
    star = block("{ id:'pq_merge_star'", "{ id:'pq_found_town'")
    assert "eco.mergeStarSeen" in star


def test_release_stamp_reaches_runtime_and_service_worker():
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML
    assert RELEASE_PIN in SW
    assert OWN_RELEASE_PIN in SW  # lineage kept
