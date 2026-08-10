"""Early-game battles are a near-certain win.

Until the player founds their first county, every evil Burbz squad is a
ragged scouting party: capped at three birds, never more than the player's
flock, every stat at 45%, and no tier level boost. Full difficulty returns
the moment the realm begins. The functional test drives the real engine
with its own AI on both sides and expects the player to win every run.
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


def test_early_game_means_no_county_founded_yet():
    html = HTML_PATH.read_text(encoding="utf-8")
    src = function_source(html, "isEarlyGameBattles")
    assert "empireRegionsInfo().regions.length === 0" in src


def test_early_squads_are_small_and_weak():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const EARLY_GAME_OPPONENT_EASE = 0.45;" in html
    ease = function_source(html, "easeEarlyOpponents")
    # Never more than three foes, and never more than the player's flock.
    assert "clamp(Math.round(squadSize || 3), 1, 3)" in ease
    for stat in ("atk", "def", "spd", "int", "cha", "mag", "stamina"):
        assert f"b.{stat} * e" in ease, stat
    gen = function_source(html, "leagueRivalOpponents")
    assert "easeEarlyOpponents(opponents, top.length)" in gen
    # No tier boost while the realm sleeps: the squad sits below the flock.
    assert "Math.max(1, Math.round(avgLevel) - 1)" in gen
    # The rival preview is honest about the odds.
    assert "ragged evil Burbz scouting party prowls this perch" in html


def test_fresh_flocks_beat_eased_squads_every_time():
    ease = 0.45
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
