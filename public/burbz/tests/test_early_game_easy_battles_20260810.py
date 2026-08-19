"""Easy battles are a near-certain win while the mercy rule holds.

Rewritten for mercy-streak-attack-preview-v287: the kindness is no longer an
"early game" at all. Until the player takes MERCY_WIN_STREAK (4) wins in a
row, every evil Burbz squad is a ragged scouting party — capped at three
birds, never more than the player's flock, one level below it, every stat
cut to MERCY_OPPONENT_EASE (0.3). A loss resets the streak, so a struggling
player at ANY level gets easy fights. The functional test drives the real
engine with its own AI on both sides and expects the player to win every
run at the mercy ease — including Yaan's own reported case, three raptors
at level 12.
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


def test_mercy_holds_until_four_straight_wins():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const MERCY_WIN_STREAK = 4;" in html
    assert "const MERCY_OPPONENT_EASE = 0.3;" in html
    gate = function_source(html, "isMercyBattles")
    assert "battleWinStreak() < MERCY_WIN_STREAK" in gate
    # The old gates are gone for good: neither the county nor the player's
    # level decides difficulty any more.
    assert "EARLY_GAME_ENDS_AT_PLAYER_LEVEL" not in html
    assert "empireRegionsInfo().regions.length === 0" not in gate


def test_mercy_squads_are_small_and_weak():
    html = HTML_PATH.read_text(encoding="utf-8")
    ease = function_source(html, "easeMercyOpponents")
    # Never more than the player's flock; capped at three under full mercy.
    assert "isMercyBattles() ? 3 : 4" in ease
    assert "clamp(Math.round(squadSize || 3), 1, maxSquad)" in ease
    for stat in ("atk", "def", "spd", "int", "cha", "mag", "stamina"):
        assert f"b.{stat} * e" in ease, stat
    gen = function_source(html, "leagueRivalOpponents")
    assert "easeMercyOpponents(opponents, top.length)" in gen
    # No tier boost while the kindness holds: the squad sits below the flock.
    assert "Math.max(1, Math.round(avgLevel) - 1)" in gen
    # The rival preview is honest about the odds.
    assert "A ragged evil Burbz scouting party" in html
    assert "A ragged scouting party holds the village" in html


def test_fresh_flocks_beat_mercy_squads_every_time():
    script = """
const core = require('./battle_core.js');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BIRDS = {
  wren:      { species:'Eurasian Wren', hp:72, atk:28, def:30, spd:62, int:50, cha:55, stamina:45, mag:85 },
  bluetit:   { species:'Blue Tit', hp:70, atk:28, def:28, spd:65, int:55, cha:55, stamina:45, mag:88 },
  goldcrest: { species:'Goldcrest', hp:62, atk:24, def:26, spd:66, int:50, cha:50, stamina:40, mag:92 },
  swallow:   { species:'Barn Swallow', hp:70, atk:30, def:28, spd:75, int:50, cha:50, stamina:45, mag:82 },
  hawk:      { species:'Eurasian Sparrowhawk', hp:120, atk:78, def:55, spd:72, int:55, cha:38, stamina:55, mag:35 },
  kestrel:   { species:'Common Kestrel', hp:105, atk:65, def:48, spd:70, int:55, cha:40, stamina:50, mag:40 },
  buzzard:   { species:'Common Buzzard', hp:150, atk:80, def:65, spd:55, int:52, cha:36, stamina:60, mag:30 },
  e_hawk:    { species:'Sparrowhawk', hp:120, atk:78, def:55, spd:72, int:55, cha:38, stamina:55, mag:35 },
  e_heron:   { species:'Grey Heron', hp:165, atk:85, def:70, spd:45, int:50, cha:38, stamina:60, mag:28 },
  e_kestrel: { species:'Kestrel', hp:105, atk:65, def:48, spd:70, int:55, cha:40, stamina:50, mag:40 }
};
function atLevel(key, level, id) {
  const b = BIRDS[key]; const m = level > 1 ? 1 + level * 0.04 : 1;
  const s = k => clamp(Math.floor(b[k] * m), 10, 999);
  return { id, species: b.species, commonName: b.species, level, rarity: 'common',
    maxHp: clamp(Math.floor(b.hp * m), 50, 999), hp: clamp(Math.floor(b.hp * m), 50, 999),
    atk: s('atk'), def: s('def'), spd: s('spd'), int: s('int'), cha: s('cha'),
    stamina: s('stamina'), mag: s('mag') };
}
const EASE = 0.3;  // MERCY_OPPONENT_EASE
function eased(b) {
  const hp = Math.max(30, Math.round(b.maxHp * EASE));
  const s = v => Math.max(6, Math.round(v * EASE));
  return { ...b, maxHp: hp, hp, atk: s(b.atk), def: s(b.def), spd: s(b.spd),
    int: s(b.int), cha: s(b.cha), mag: s(b.mag), stamina: s(b.stamina) };
}
function run(playerKeys, flockLevel, foeCount) {
  const results = [];
  for (let seed = 0; seed < 40; seed++) {
    const player = playerKeys.map((k, i) => core.buildFighter(atLevel(k, flockLevel, 'P' + i)));
    const foes = ['e_hawk', 'e_heron', 'e_kestrel'].slice(0, foeCount)
      .map((k, i) => core.buildOpponentFighter(eased(atLevel(k, Math.max(1, flockLevel - 1), 'E' + i)), 0, 's' + seed + '_' + i));
    const battle = core.createBattle({ playerFighters: player, opponentFighters: foes, seed: 'mercy_' + seed, tier: 0 });
    let guard = 0;
    while (battle.phase !== 'over' && guard++ < 600) {
      if (!core.tickToNextTurn(battle)) break;
      core.resolveAction(battle, core.aiChooseAction(battle));
    }
    results.push(battle.winner);
  }
  return results;
}
console.log(JSON.stringify({
  solo: run(['hawk'], 3, 1),
  yaan: run(['hawk', 'kestrel', 'buzzard'], 12, 3),
  wrong: run(['wren', 'bluetit', 'goldcrest', 'swallow'], 8, 3)
}));
"""
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    out = json.loads(run.stdout)
    for name, winners in out.items():
        assert len(winners) == 40, name
        assert all(w == "player" for w in winners), (name, winners.count("opponent"))
