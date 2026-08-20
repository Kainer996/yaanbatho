"""The level-12 difficulty gate is retired — the win streak decides now.

This suite once pinned the v262 rule (easy fights until player level 12).
That rule is exactly what destroyed Yaan's level-12 flock of three raptors:
the moment he levelled past the gate, full-strength squads arrived whether
or not he could beat them. Rewritten for mercy-streak-attack-preview-v287:

- Difficulty is gated on the WIN STREAK, not the player's level. Until the
  flock takes MERCY_WIN_STREAK (4) wins in a row, squads fight at
  MERCY_OPPONENT_EASE (0.3) — almost guaranteed wins at any level.
- From the fourth straight win MERCY_RAMP_EASE climbs 0.5 / 0.7 / 0.85,
  and the seventh straight win brings full strength.
- One loss resets the streak to zero, so the game turns kind again the
  moment the player struggles.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
OWN_RELEASE_PIN = "early-game-until-level-12-v262-20260813"
CURRENT_BUILD = "equip-card-swipe-v297-20260820"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_gate_is_the_win_streak_not_the_players_level():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const MERCY_WIN_STREAK = 4;" in html
    streak = function_source(html, "battleWinStreak")
    assert "ensureLeagueState().streak" in streak
    gate = function_source(html, "isMercyBattles")
    assert "battleWinStreak() < MERCY_WIN_STREAK" in gate
    # The level gate is gone for good — it threw levelled-up players to
    # full-strength squads no matter their record.
    assert "EARLY_GAME_ENDS_AT_PLAYER_LEVEL" not in html
    assert "battlePlayerLevel" not in html
    # The streak lives in league state and survives sanitising.
    assert "streak: 0" in html
    assert "gameState.league.streak = Math.max(0, Math.round(Number(gameState.league.streak) || 0));" in html


def test_ease_ramps_from_the_fourth_straight_win():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const MERCY_OPPONENT_EASE = 0.3;" in html
    assert "const MERCY_RAMP_EASE = [0.5, 0.7, 0.85];" in html
    ramp = function_source(html, "mercyOpponentEase")
    assert "if (streak < MERCY_WIN_STREAK) return MERCY_OPPONENT_EASE;" in ramp
    assert "step < MERCY_RAMP_EASE.length ? MERCY_RAMP_EASE[step] : 1" in ramp
    ease = function_source(html, "easeMercyOpponents")
    # Three foes max under full mercy; the flock-size cap holds on the ramp.
    assert "isMercyBattles() ? 3 : 4" in ease
    assert "clamp(Math.round(squadSize || 3), 1, maxSquad)" in ease
    # A streak change re-rolls the squad at the new ease, and squads only
    # ease while the ease is real.
    gen = function_source(html, "leagueRivalOpponents")
    assert "'_mercy_ws' + battleWinStreak()" in gen
    assert "const eased = mercyEase < 1;" in gen


def test_wins_grow_the_streak_and_a_loss_resets_it():
    html = HTML_PATH.read_text(encoding="utf-8")
    end = function_source(html, "endPerchBattle")
    assert "league.streak = (league.streak || 0) + 1;" in end
    assert "league.streak = 0;" in end
    # The battle-select screen says where the streak stands.
    assert "rival-streak-line" in html
    assert "Win streak " in html


def test_streak_seven_brings_full_strength_and_the_ramp_is_real():
    # The pure maths of the ramp, run through the page's own constants.
    script = """
const MERCY_WIN_STREAK = 4;
const MERCY_OPPONENT_EASE = 0.3;
const MERCY_RAMP_EASE = [0.5, 0.7, 0.85];
function easeAt(streak) {
  if (streak < MERCY_WIN_STREAK) return MERCY_OPPONENT_EASE;
  const step = streak - MERCY_WIN_STREAK;
  return step < MERCY_RAMP_EASE.length ? MERCY_RAMP_EASE[step] : 1;
}
console.log(JSON.stringify([0,1,2,3,4,5,6,7,12].map(easeAt)));
"""
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    eases = json.loads(run.stdout)
    assert eases[:4] == [0.3, 0.3, 0.3, 0.3]      # mercy holds through three wins
    assert eases[4:7] == [0.5, 0.7, 0.85]          # the fourth win starts the ramp
    assert eases[7] == 1 and eases[8] == 1         # seven straight wins = full fight
    # Every step up is a real step: strictly harder, never a cliff past 2x.
    for a, b in zip(eases, eases[1:]):
        assert b >= a and b / a < 2.0, (a, b)


def test_release_pins():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    sw = SW_PATH.read_text(encoding="utf-8")
    cache_line = next(l for l in sw.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
