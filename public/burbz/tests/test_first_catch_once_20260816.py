"""First Catch happens once — teaching quests retire when their lesson is learnt.

first-catch-once-v278-20260817 (born v273, renumbered merging main): Yaan's screenshot showed the daily board
offering "First Catch — Capture any bird" at trainer level 10, with a
"Quest complete — tap to claim" card popping every day. It was in
DAILY_QUESTS, so the midnight reset re-opened it forever. It now carries
`once: true` and a `done()` check against real game state: once the player
has ever captured a bird, the next daily reset marks it spent (claimed, full
progress) instead of re-opening it. New players still meet it exactly once.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "first-catch-once-v278-20260817"
CURRENT_BUILD = "merge-when-ready-v290-20260820"
PREVIOUS_RELEASE_PIN = "town-square-city-builder-v276-20260817"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def quest_harness(driver: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    quest_defs = html[html.index("const DAILY_QUESTS = ["):html.index("// PLAYER QUESTS")]
    functions = function_source(html, "initQuests") + "\n" + function_source(html, "updateQuestProgress")
    stubs = """
global.window = global;
const gameState = {
  player: { totalCaptures: 0, wins: 0 },
  flock: [],
  quests: null,
  questsLastReset: null,
  birdExpeditions: [],
  questClaimReceipts: {}
};
const PLAYER_QUESTS = [];
const saveState = () => {};
const syncActivePlayerQuest = () => {};
const activePlayerQuest = () => null;
const queueQuestCompleteNotice = () => {};
const showToast = () => {};
const claimedExpeditionCount = () => 0;
"""
    return stubs + quest_defs + "\n" + functions + "\n" + driver


def run_harness(driver: str):
    proc = subprocess.run(["node", "-e", quest_harness(driver)], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_first_catch_is_declared_a_once_only_teaching_quest():
    html = HTML.read_text(encoding="utf-8")
    block = html[html.index("const DAILY_QUESTS = ["):html.index("const WEEKLY_QUESTS")]
    first_catch = next(line for line in block.splitlines() if "id: 'daily_capture_1'" in line)
    assert "once: true" in first_catch
    assert "totalCaptures" in first_catch  # done() reads real game state
    # The other dailies stay honest daily chores.
    for line in block.splitlines():
        if "id: 'daily_" in line and "daily_capture_1" not in line:
            assert "once:" not in line, line


def test_a_new_player_meets_first_catch_and_a_veteran_never_does():
    out = run_harness("""
initQuests();
const fresh = { ...gameState.quests.daily_capture_1 };
// The player captures their bird sometime today.
gameState.player.totalCaptures = 1;
updateQuestProgress('capture', 1);
const doneToday = { ...gameState.quests.daily_capture_1 };
// Midnight: a new day resets the board.
gameState.questsLastReset = 'yesterday';
initQuests();
const nextDay = { ...gameState.quests.daily_capture_1 };
const fieldWork = { ...gameState.quests.daily_capture_3 };
console.log(JSON.stringify({ fresh, doneToday, nextDay, fieldWork }));
""")
    # Day one, no captures ever: the quest is open and waiting.
    assert out["fresh"] == {"progress": 0, "claimed": False}
    # The first capture completes it that same day.
    assert out["doneToday"]["progress"] == 1
    # From the next reset on it is spent — full bar, claimed, off the board.
    assert out["nextDay"] == {"progress": 1, "claimed": True}
    # Ordinary dailies still reset fresh.
    assert out["fieldWork"] == {"progress": 0, "claimed": False}


def test_a_veteran_save_retires_it_on_the_first_new_day():
    out = run_harness("""
gameState.player.totalCaptures = 42;   // Yaan's situation: lots of birds
gameState.questsLastReset = '2026-08-15';
initQuests();
const state = { ...gameState.quests.daily_capture_1 };
// A spent quest never progresses and never re-completes.
updateQuestProgress('capture', 3);
console.log(JSON.stringify({ state, after: { ...gameState.quests.daily_capture_1 } }));
""")
    assert out["state"] == {"progress": 1, "claimed": True}
    assert out["after"] == {"progress": 1, "claimed": True}


def test_spent_once_quests_leave_the_daily_board():
    html = HTML.read_text(encoding="utf-8")
    # renderSection already hides claimed quests — the spent state rides that:
    assert "const open = quests.filter(q => !(gameState.quests[q.id] && gameState.quests[q.id].claimed));" in html
    # and updateQuestProgress never advances a claimed quest, so no more
    # "Quest complete — tap to claim" cards for a retired teaching quest.
    update = function_source(html, "updateQuestProgress")
    assert "!gameState.quests[q.id].claimed" in update


def test_release_is_versioned_and_cache_lineage_kept():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)  # this fix reaches players
