"""Early-game battles are a near-certain win.

Until the player reaches level 12, every evil Burbz squad is a ragged
scouting party. Through player level 8 the squad is capped at three birds,
never more than the player's flock, with every stat cut to 35%. From level 9
the cut eases off level by level, so full difficulty arrives at player
level 12. The gate moved from "no county founded yet" to the player's level
in early-game-until-level-12-v262 — the county gate stranded low-level
players in unwinnable fights the moment their realm began. The functional
test drives the real engine with its own AI on both sides and expects the
player to win every run at the deepest ease.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
OWN_RELEASE_PIN = "early-game-easy-battles-v240-20260810"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_early_game_means_player_below_level_twelve():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "isEarlyGameBattles")
    assert "battlePlayerLevel() < EARLY_GAME_ENDS_AT_PLAYER_LEVEL" in src
    assert "const EARLY_GAME_ENDS_AT_PLAYER_LEVEL = 12;" in html


def test_early_squads_are_small_and_weak():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const EARLY_GAME_OPPONENT_EASE = 0.35;" in html
    ease = function_source(html, "easeEarlyOpponents")
    # Never more than the player's flock; capped at three through level 8.
    assert "clamp(Math.round(squadSize || 3), 1, maxSquad)" in ease
    for stat in ("atk", "def", "spd", "int", "cha", "mag", "stamina"):
        assert f"b.{stat} * e" in ease, stat
    gen = function_source(html, "leagueRivalOpponents")
    assert "easeEarlyOpponents(opponents, top.length)" in gen
    # No tier boost while the kindness holds: the squad sits below the flock.
    assert "Math.max(1, Math.round(avgLevel) - 1)" in gen
    # The rival preview is honest about the odds.
    assert "A ragged evil Burbz scouting party" in html
    assert "A ragged scouting party holds the village" in html


def test_fresh_flocks_beat_eased_squads_every_time():
    ease = 0.35
    script = """
const core = require('./battle_core.js');
function commonBird(name, species, i) {
  return { id: name + '_' + i, species, commonName: name, level: 1, rarity: 'common',
    maxHp: 85 + (i * 7) %% 20, hp: 85 + (i * 7) %% 20,
    atk: 44 + (i * 5) %% 12, def: 42 + (i * 3) %% 10, spd: 52 + (i * 11) %% 14,
    int: 48, cha: 52, stamina: 50 };
}
const EASE = %s;
function eased(name, species, i) {
  const b = commonBird(name, species, i + 3);
  const hp = Math.max(30, Math.round(b.maxHp * EASE));
  return { ...b, maxHp: hp, hp,
    atk: Math.max(6, Math.round(b.atk * EASE)), def: Math.max(6, Math.round(b.def * EASE)),
    spd: Math.max(6, Math.round(b.spd * EASE)), int: Math.max(6, Math.round(b.int * EASE)),
    cha: Math.max(6, Math.round(b.cha * EASE)), stamina: Math.max(6, Math.round(b.stamina * EASE)) };
}
const playerSpecies = ['European Robin', 'Blue Tit', 'Blackbird', 'House Sparrow'];
const foeSpecies = ['Carrion Crow', 'Common Wood Pigeon', 'Eurasian Magpie'];
const results = [];
for (const playerCount of [1, 2, 4]) {
  for (let seed = 0; seed < 40; seed++) {
    const player = playerSpecies.slice(0, playerCount).map((s, i) => core.buildFighter(commonBird('P' + i, s, i)));
    const foes = foeSpecies.slice(0, Math.min(3, playerCount)).map((s, i) =>
      core.buildOpponentFighter(eased('E' + i, s, i), 0, 'seed' + seed + '_' + i));
    const battle = core.createBattle({ playerFighters: player, opponentFighters: foes, seed: 'sim_' + playerCount + '_' + seed, tier: 0 });
    let guard = 0;
    while (battle.phase !== 'over' && guard++ < 600) {
      if (!core.tickToNextTurn(battle)) break;
      core.resolveAction(battle, core.aiChooseAction(battle));
    }
    results.push(battle.winner);
  }
}
console.log(JSON.stringify(results));
""" % ease
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    winners = json.loads(run.stdout)
    assert len(winners) == 120
    assert all(w == "player" for w in winners), winners.count("opponent")
