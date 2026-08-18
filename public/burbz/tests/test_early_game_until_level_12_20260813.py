"""Early wins until player level 12 — the difficulty ramp release.

Yaan's report: a level-8 player was destroyed by a level-5 garrison. The old
early-game gate ended with the first county, so difficulty snapped to full
mid-story no matter the player's level. The gate is now the PLAYER's level:

- Through player level 8, squads fight at 35%% strength, capped at three
  birds — near-free wins even for a flock of one bird of prey and one large
  bird, whatever the matchup.
- From level 9 the ease climbs level by level (roughly 0.5 / 0.65 / 0.8), so
  by level 11 four completely wrong birds start losing while four right
  birds still win easily and four right birds with gear win a whitewash.
- At player level 12, full difficulty returns and the forge starts to
  matter.

The functional tests drive the real engine with its own AI on both sides.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
OWN_RELEASE_PIN = "early-game-until-level-12-v262-20260813"
CURRENT_BUILD = "offroad-side-quests-v283-20260818"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_gate_is_the_players_level_not_the_realm():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const EARLY_GAME_ENDS_AT_PLAYER_LEVEL = 12;" in html
    assert "const EARLY_GAME_CRUISE_LEVEL = 8;" in html
    level = function_source(html, "battlePlayerLevel")
    assert "gameState.player && gameState.player.level" in level
    gate = function_source(html, "isEarlyGameBattles")
    assert "battlePlayerLevel() < EARLY_GAME_ENDS_AT_PLAYER_LEVEL" in gate
    # The county gate is gone for good — it stranded low-level players.
    assert "empireRegionsInfo().regions.length === 0" not in gate


def test_ease_ramps_from_deep_cruise_to_full_difficulty():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const EARLY_GAME_OPPONENT_EASE = 0.35;" in html
    assert "const EARLY_GAME_RAMP_TOP_EASE = 0.95;" in html
    ramp = function_source(html, "earlyGameOpponentEase")
    assert "if (level <= EARLY_GAME_CRUISE_LEVEL) return EARLY_GAME_OPPONENT_EASE;" in ramp
    assert "(level - EARLY_GAME_CRUISE_LEVEL) / (EARLY_GAME_ENDS_AT_PLAYER_LEVEL - EARLY_GAME_CRUISE_LEVEL)" in ramp
    ease = function_source(html, "easeEarlyOpponents")
    # Three foes max while cruising; the flock-size cap holds through the ramp.
    assert "battlePlayerLevel() <= EARLY_GAME_CRUISE_LEVEL ? 3 : 4" in ease
    assert "clamp(Math.round(squadSize || 3), 1, maxSquad)" in ease
    # A level-up re-rolls the squad at the new ease.
    gen = function_source(html, "leagueRivalOpponents")
    assert "'_early_game_pl' + battlePlayerLevel()" in gen


def test_cruise_levels_win_even_with_the_wrong_birds():
    # Player level <= 8: even four tiny songbirds against three eased raptor
    # counters win every run. One strong bird alone does too.
    script = """
const core = require('./battle_core.js');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BIRDS = {
  wren:      { species:'Eurasian Wren', hp:72, atk:28, def:30, spd:62, int:50, cha:55, stamina:45, mag:85 },
  bluetit:   { species:'Blue Tit', hp:70, atk:28, def:28, spd:65, int:55, cha:55, stamina:45, mag:88 },
  goldcrest: { species:'Goldcrest', hp:62, atk:24, def:26, spd:66, int:50, cha:50, stamina:40, mag:92 },
  swallow:   { species:'Barn Swallow', hp:70, atk:30, def:28, spd:75, int:50, cha:50, stamina:45, mag:82 },
  hawk:      { species:'Eurasian Sparrowhawk', hp:120, atk:78, def:55, spd:72, int:55, cha:38, stamina:55, mag:35 },
  heron:     { species:'Grey Heron', hp:165, atk:85, def:70, spd:45, int:50, cha:38, stamina:60, mag:28 },
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
const EASE = 0.35;
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
    const battle = core.createBattle({ playerFighters: player, opponentFighters: foes, seed: 'cruise_' + seed, tier: 0 });
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
  pair: run(['hawk', 'heron'], 5, 2),
  wrong: run(['wren', 'bluetit', 'goldcrest', 'swallow'], 8, 3)
}));
"""
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    out = json.loads(run.stdout)
    for name, winners in out.items():
        assert len(winners) == 40, name
        assert all(w == "player" for w in winners), (name, winners.count("opponent"))


def test_level_eleven_separates_right_birds_from_wrong_birds():
    # Player level 11 (ease 0.8): four hard-countered songbirds lose most
    # runs; four counter-picked birds win every run; the same birds with
    # forged gear barely take a scratch.
    script = """
const core = require('./battle_core.js');
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BIRDS = {
  wren:      { species:'Eurasian Wren', hp:72, atk:28, def:30, spd:62, int:50, cha:55, stamina:45, mag:85 },
  bluetit:   { species:'Blue Tit', hp:70, atk:28, def:28, spd:65, int:55, cha:55, stamina:45, mag:88 },
  goldcrest: { species:'Goldcrest', hp:62, atk:24, def:26, spd:66, int:50, cha:50, stamina:40, mag:92 },
  swallow:   { species:'Barn Swallow', hp:70, atk:30, def:28, spd:75, int:50, cha:50, stamina:45, mag:82 },
  crow:      { species:'Carrion Crow', hp:130, atk:65, def:55, spd:55, int:72, cha:45, stamina:55, mag:42 },
  jackdaw:   { species:'Western Jackdaw', hp:108, atk:55, def:48, spd:60, int:65, cha:48, stamina:50, mag:48 },
  starling:  { species:'Starling', hp:95, atk:45, def:42, spd:58, int:55, cha:50, stamina:50, mag:60 },
  robin:     { species:'European Robin', hp:78, atk:32, def:32, spd:60, int:50, cha:60, stamina:45, mag:80 },
  e_hawk:    { species:'Sparrowhawk', hp:120, atk:78, def:55, spd:72, int:55, cha:38, stamina:55, mag:35 },
  e_heron:   { species:'Grey Heron', hp:165, atk:85, def:70, spd:45, int:50, cha:38, stamina:60, mag:28 },
  e_kestrel: { species:'Kestrel', hp:105, atk:65, def:48, spd:70, int:55, cha:40, stamina:50, mag:40 },
  e_gull:    { species:'Herring Gull', hp:135, atk:62, def:58, spd:55, int:50, cha:42, stamina:58, mag:36 }
};
function atLevel(key, level, id) {
  const b = BIRDS[key]; const m = level > 1 ? 1 + level * 0.04 : 1;
  const s = k => clamp(Math.floor(b[k] * m), 10, 999);
  return { id, species: b.species, commonName: b.species, level, rarity: 'common',
    maxHp: clamp(Math.floor(b.hp * m), 50, 999), hp: clamp(Math.floor(b.hp * m), 50, 999),
    atk: s('atk'), def: s('def'), spd: s('spd'), int: s('int'), cha: s('cha'),
    stamina: s('stamina'), mag: s('mag') };
}
// index.html's ramp at player level 11: 0.35 + 0.75 * (0.95 - 0.35) = 0.8
const EASE = 0.8;
function eased(b) {
  const hp = Math.max(30, Math.round(b.maxHp * EASE));
  const s = v => Math.max(6, Math.round(v * EASE));
  return { ...b, maxHp: hp, hp, atk: s(b.atk), def: s(b.def), spd: s(b.spd),
    int: s(b.int), cha: s(b.cha), mag: s(b.mag), stamina: s(b.stamina) };
}
const GEAR = { atk: 14, def: 10, mag: 8, res: 8, spd: 6, maxHp: 35, critBonus: 0.05 };
function run(playerKeys, gear) {
  let wins = 0, hpSum = 0; const N = 60;
  for (let seed = 0; seed < N; seed++) {
    const player = playerKeys.map((k, i) => {
      const b = atLevel(k, 11, 'P' + i);
      return gear ? core.buildFighter({ ...b, gear: GEAR }) : core.buildFighter(b);
    });
    const foes = ['e_hawk', 'e_heron', 'e_kestrel', 'e_gull']
      .map((k, i) => core.buildOpponentFighter(eased(atLevel(k, 10, 'E' + i)), 1, 's' + seed + '_' + i));
    const battle = core.createBattle({ playerFighters: player, opponentFighters: foes, seed: 'ramp_' + seed, tier: 1 });
    let guard = 0;
    while (battle.phase !== 'over' && guard++ < 600) {
      if (!core.tickToNextTurn(battle)) break;
      core.resolveAction(battle, core.aiChooseAction(battle));
    }
    if (battle.winner === 'player') {
      wins++;
      hpSum += battle.teams.player.reduce((s, f) => s + f.hp / f.maxHp, 0) / battle.teams.player.length;
    }
  }
  return { winRate: wins / N, avgHpLeft: wins ? hpSum / wins : 0 };
}
console.log(JSON.stringify({
  wrong: run(['wren', 'bluetit', 'goldcrest', 'swallow'], false),
  right: run(['crow', 'jackdaw', 'starling', 'robin'], false),
  geared: run(['crow', 'jackdaw', 'starling', 'robin'], true)
}));
"""
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    out = json.loads(run.stdout)
    # Four completely wrong birds lose the fight most of the time.
    assert out["wrong"]["winRate"] <= 0.25, out["wrong"]
    # Four right birds win every run with plenty of health to spare.
    assert out["right"]["winRate"] == 1.0, out["right"]
    assert out["right"]["avgHpLeft"] >= 0.5, out["right"]
    # The same birds with forged gear win a whitewash.
    assert out["geared"]["winRate"] == 1.0, out["geared"]
    assert out["geared"]["avgHpLeft"] >= 0.75, out["geared"]
    assert out["geared"]["avgHpLeft"] > out["right"]["avgHpLeft"], out


def test_release_pins():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    sw = SW_PATH.read_text(encoding="utf-8")
    cache_line = next(l for l in sw.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
