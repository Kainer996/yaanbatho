"""Night Hunter Ascendant: a nocturnal bird at night is the best bird you own.

Yaan's ask (2026-08-13): the advantage for using a nocturnal bird late at
night must be absolutely massive, wired deep — economy, training and battle,
with the UI and graphics carrying it everywhere. The law now has two halves:

- The reward pack (bird_sleep_core.NOCTURNAL_NIGHT_BONUS): 3× coins, 3× XP,
  2× timber, two guaranteed extra finds, and 2× training stat gains. The
  reward maths is pinned in test_nocturnal_night_bonus_20260805.py.
- Night Wings (bird_sleep_core.NOCTURNAL_NIGHT_BATTLE): the battle half.
  buildFighter applies the pack to a fighter's stats — half again the ATK,
  SPD and MAG, +25% DEF and HP, +15% crit — and stamps f.nightHunter for the
  arena's moon badge. Only the player's own nocturnal birds ever get it, and
  only after dark; rival squads fight classic.

Nothing is ever BLOCKED at night — that contract lives in the nocturnal
suite. This one pins the new battle law, the default-identity contract
(no pack means byte-identical classic stats), and the UI/graphics wiring.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
RELEASE_PIN = "night-hunter-ascendant-v258-20260813"
CURRENT_BUILD = "early-game-until-level-12-v262-20260813"

BATTLE_PACK = {"atk": 1.5, "spd": 1.5, "mag": 1.5, "def": 1.25, "maxHp": 1.25, "critBonus": 0.15}


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_night_wings_pack_lives_in_the_sleep_core():
    out = run_node("""
      const core = require('./bird_sleep_core.js');
      const owl = { commonName:'Barn Owl', traits:['nocturnal'] };
      const robin = { commonName:'European Robin', traits:['songbird'] };
      console.log(JSON.stringify({
        pack: core.NOCTURNAL_NIGHT_BATTLE,
        owlAtNight: core.nocturnalNightBattleBoost(owl, 23),
        owlAtNoon: core.nocturnalNightBattleBoost(owl, 12),
        robinAtNight: core.nocturnalNightBattleBoost(robin, 23),
        nightjarByName: core.nocturnalNightBattleBoost({ commonName:'European Nightjar' }, 22) !== null
      }));
    """)
    assert out["pack"] == BATTLE_PACK
    assert out["owlAtNight"] == BATTLE_PACK
    assert out["owlAtNoon"] is None
    assert out["robinAtNight"] is None
    # Detection rides the same nocturnal word-list as the reward pack.
    assert out["nightjarByName"] is True


def test_build_fighter_applies_night_wings_and_stays_classic_without():
    out = run_node("""
      const B = require('./battle_core.js');
      const sleep = require('./bird_sleep_core.js');
      const owl = { id:'owl1', commonName:'Tawny Owl', species:'Tawny Owl', level:5,
                    atk:60, def:48, spd:52, int:60, cha:40, stamina:60, maxHp:100, hp:100 };
      const classic = B.buildFighter(owl, { gear: { atk: 10, critBonus: 0.05 } });
      const night = B.buildFighter(owl, { gear: { atk: 10, critBonus: 0.05 }, nightBoost: sleep.NOCTURNAL_NIGHT_BATTLE });
      const plain = B.buildFighter(owl, {});
      console.log(JSON.stringify({
        classic: { atk: classic.atk, def: classic.def, spd: classic.spd, maxHp: classic.maxHp, crit: classic.critBonus, flag: classic.nightHunter },
        night: { atk: night.atk, def: night.def, spd: night.spd, maxHp: night.maxHp, mag: night.mag, crit: night.critBonus, flag: night.nightHunter },
        classicMag: classic.mag,
        plainAtk: plain.atk, plainCrit: plain.critBonus, plainFlag: plain.nightHunter,
        resGrows: night.res > classic.res,
        hpFollows: night.hp === night.maxHp
      }));
    """)
    # Default identity: no pack, classic numbers — gear adds, nothing multiplies.
    assert out["classic"] == {"atk": 70, "def": 48, "spd": 52, "maxHp": 100, "crit": 0.05, "flag": False}
    assert out["plainAtk"] == 60 and out["plainCrit"] == 0 and out["plainFlag"] is False
    # Night Wings: gear first, then the pack multiplies the fighting stats.
    assert out["night"]["atk"] == round(70 * 1.5)
    assert out["night"]["spd"] == round(52 * 1.5)
    assert out["night"]["def"] == round(48 * 1.25)
    assert out["night"]["maxHp"] == round(100 * 1.25)
    # JS Math.round half-up, not Python's banker's rounding.
    assert out["night"]["mag"] == int(out["classicMag"] * 1.5 + 0.5)
    assert abs(out["night"]["crit"] - 0.20) < 1e-9
    assert out["night"]["flag"] is True
    # Resistance derives from boosted DEF/INT/MAG, so it rises too; and a
    # healthy bird enters at its boosted full HP.
    assert out["resGrows"] and out["hpFollows"]


def test_app_wires_night_wings_into_the_arena():
    html = HTML_PATH.read_text(encoding="utf-8")
    # The helper mirrors nocturnalNightBonusFor and asks the sleep core.
    helper = function_source(html, "nocturnalNightBattleBoostFor")
    assert "nocturnalNightBattleBoost" in helper
    # Player fighters carry the pack into battle; the log announces it.
    start = function_source(html, "startPerchBattle")
    assert "nightBoost: nocturnalNightBattleBoostFor(b)" in start
    assert "NIGHT WINGS!" in start
    # Rival squads never get the pack — the advantage is the player's.
    assert "buildOpponentFighter(b, league.tier" in start
    opponent_call = start[start.index("buildOpponentFighter"):]
    opponent_call = opponent_call[:opponent_call.index(")") + 1]
    assert "nightBoost" not in opponent_call
    # The battle select glows: aura + chip on nocturnal cards, a hint at night.
    select = function_source(html, "renderBattleSelect")
    assert "nocturnalNightBattleBoostFor(b)" in select
    assert "pk-night-chip" in select
    assert "Night Wings" in select
    assert "isNightRightNow()" in select
    # The arena unit wears the moon badge and the aura while boosted.
    unit = function_source(html, "arenaUnitHTML")
    assert "au-night-moon" in unit
    assert "f.nightHunter" in unit


def test_training_hall_and_roost_teach_the_ascendant_numbers():
    html = HTML_PATH.read_text(encoding="utf-8")
    hall = function_source(html, "renderTrainingHallPanel")
    # Night school: the hall banners the rule and marks nocturnal birds.
    assert "isNightRightNow()" in hall
    assert "TRIPLE XP and DOUBLE stat gains" in hall
    assert "Night Hunter 3×" in hall
    # The Roost status line burns while the perk is live and teaches it by day.
    roost = function_source(html, "academySleepStatusHTML")
    assert "NIGHT HUNTER — in its element right now" in roost
    assert "Night Wings" in roost
    # Dispatch and training toasts sell the true multipliers.
    assert "3× coins & XP, 2× timber, two extra finds" in html
    assert "3× XP and double stat gains" in html


def test_night_hunter_graphics_ship_in_the_stylesheet():
    html = HTML_PATH.read_text(encoding="utf-8")
    # The moonlit aura, its pulse, the chip, the hint card and the arena moon.
    for token in (".night-hunter-aura", "@keyframes nightHunterPulse", ".pk-night-chip",
                  ".battle-night-hint", ".au-night-moon", "@keyframes nightMoonBob"):
        assert token in html, token
    # Reduced motion stills the glow like every other Burbz animation.
    reduced = re.search(r"@media \(prefers-reduced-motion: reduce\) \{[^}]*\.night-hunter-aura[^}]*\}", html, re.S)
    assert reduced is not None


def test_release_is_query_busted_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    for core in ("bird_sleep_core.js", "academy_treehouse_core.js", "battle_core.js"):
        pin = f"{core}?v={RELEASE_PIN}"
        assert pin in html, core
        assert sw.count(f"'./{pin}'") == 2, core
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
