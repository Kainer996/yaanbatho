"""Completion notices — the city-builder corner cards release.

Yaan's ask: when a building finishes in the Academy or the Empire, or a
quest completes, a classic city-builder / Crusader Kings style notification
button appears in the top-right of the screen. Tapping it takes the player
straight to that building or quest; a small ✕ waves it away instead.

The cards live in gameState.completionNotices (saved, so they survive a
reload), stack under the money HUD, hide during battles, respect reduced
motion, and prune themselves once a quest is claimed.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")

OWN_RELEASE_PIN = "completion-notices-v265-20260813"
PREVIOUS_RELEASE_PIN = "real-place-names-v264-20260813"
CURRENT_BUILD = "fish-in-the-water-v271-20260815"


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start, name
    return HTML[start:end]


def test_release_is_versioned():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(l for l in SW.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)


def test_notice_queue_lives_in_saved_state():
    # DEFAULT_STATE carries the queue, so loadState backfills old saves.
    assert "completionNotices: []" in HTML
    src = function_source("ensureCompletionNotices")
    assert "gameState.completionNotices" in src
    q = function_source("queueCompletionNotice")
    assert "COMPLETION_NOTICE_LIMIT" in q
    # One card per subject — a fresh completion replaces its older card.
    assert "JSON.stringify(notice.target || null)" in q


def test_stack_markup_and_style():
    assert 'id="completionNoticeStack"' in HTML
    assert ".completion-notice-stack { position:fixed;" in HTML
    # The battle screen keeps its full drama — no corner cards over it.
    assert 'body[data-active-screen="battle"] .completion-notice-stack { display:none; }' in HTML
    # Calm for players who ask for less motion.
    assert ".completion-notice, .completion-notice-icon { animation:none; }" in HTML


def test_empire_builds_raise_a_notice_inside_the_commit():
    src = function_source("empireCompleteConstructions")
    assert "kind: 'empire-building'" in src
    assert "target: { seed: rec.seed >>> 0 }" in src
    # The notice queues before durableSaveState, so a failed save rolls the
    # card back with the building — and the rollback repaints the stack.
    assert src.index("kind: 'empire-building'") < src.index("durableSaveState")
    assert "restoreGameStateSnapshot(snapshot);\n    renderCompletionNotices();" in src


def test_academy_builds_raise_a_notice():
    src = function_source("academyBuildBuilding")
    assert "kind: 'academy-building'" in src
    assert "target: { room: id }" in src


def test_quests_raise_notices_when_they_complete():
    src = function_source("updateQuestProgress")
    # Dailies/weeklies, the two absolute-count achievement paths, and the
    # player-quest chain all announce the moment they cross their target.
    assert src.count("queueQuestCompleteNotice(") == 4
    walk = function_source("completeWalkingQuest")
    assert "queueCompletionNotice({ kind: 'quest'" in walk


def test_tapping_a_notice_travels_and_clears_it():
    go = function_source("completionNoticeGo")
    assert "takeCompletionNotice(id)" in go
    assert "openEmpireVillage(notice.target.seed)" in go
    assert "focusAcademyBuilding(notice.target.room)" in go
    assert "focusQuestFromNotice(notice.target" in go
    take = function_source("takeCompletionNotice")
    assert "saveState();" in take
    academy = function_source("focusAcademyBuilding")
    assert "academyQuestGuidanceRoom = room" in academy
    quest = function_source("focusQuestFromNotice")
    assert "switchScreen('quests')" in quest
    assert "data-quest-card" in quest
    assert "quest-target-card" in quest


def test_claimed_quests_drop_their_notice_on_the_badge_heartbeat():
    render = function_source("renderCompletionNotices")
    assert "questNoticeClaimed" in render
    badges = function_source("updateActionBadges")
    assert "renderCompletionNotices()" in badges


def test_hospital_add_list_shows_health_bars():
    # Same release, Yaan's follow-up: the Bird Hospital's "add a bird" list
    # shows each candidate's health bar and sorts the hurt birds first.
    src = function_source("renderAcademyRoomInterior")
    assert "sort((a, b) => birdHpRatio(a) - birdHpRatio(b))" in src
    assert "room === 'hospital'" in src
    assert "room-bird-option-hp" in src
    assert "' + hp + '/' + maxHp + '" in src
    # Green when whole, yellow when bruised, red at 35% and under.
    assert ".academy-meter-fill.hp.bruised { background:var(--hp-yellow); }" in HTML
    assert ".academy-meter-fill.hp.low { background:var(--hp-red); }" in HTML


def test_guide_callout_names_the_guided_room():
    # The treehouse quest ring used to always say Kitchen & Pantry; corner
    # cards guide every room, so the callout names the real one.
    assert ">Tap ' + escapeHtml(r.label) + ' ↓</span>" in HTML
