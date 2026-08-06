"""The Night Hunter bonus: nocturnal birds paid massively for night work.

The original design locked evening play to nocturnal birds, which broke the
bedtime loop: a player with no owl could not send anything out on the long
overnight expedition. The rule is now the other way round — ANY bird can be
worked at night (nothing new is ever blocked after dark), and a nocturnal
bird (owl, nightjar, frogmouth, kiwi…) used at night in any capacity earns
the Night Hunter bonus: double coins and XP, half-again timber, a guaranteed
extra expedition find, and double training XP.

The window/multiplier rules live in bird_sleep_core.js (which already owns
nocturnal detection); academy_treehouse_core.js applies whatever pack it is
handed so the reward maths stays deterministic; index.html decides whether
the pack applies at dispatch time.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
RELEASE_PIN = "nocturnal-night-bonus-v229-20260805"
CURRENT_BUILD = "real-walk-go-map-v230-20260806"


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


def test_night_window_and_bonus_pack_live_in_the_sleep_core():
    out = run_node("""
      const core = require('./bird_sleep_core.js');
      const owl = { commonName:'Tawny Owl', traits:['nocturnal','silent flyer'] };
      const robin = { commonName:'European Robin', traits:['songbird'] };
      console.log(JSON.stringify({
        nightAt22: core.isNightHour(22),
        nightAt18: core.isNightHour(18),
        nightAt5: core.isNightHour(5),
        dayAt6: !core.isNightHour(6),
        dayAtNoon: !core.isNightHour(12),
        owlBonusAtNight: core.nocturnalNightBonus(owl, 22),
        owlBonusAtNoon: core.nocturnalNightBonus(owl, 12),
        robinBonusAtNight: core.nocturnalNightBonus(robin, 22),
        pack: core.NOCTURNAL_NIGHT_BONUS
      }));
    """)
    assert out["nightAt22"] and out["nightAt18"] and out["nightAt5"]
    assert out["dayAt6"] and out["dayAtNoon"]
    # The bonus is genuinely massive, and only for nocturnal birds at night.
    assert out["owlBonusAtNight"] == {"coins": 2, "branches": 1.5, "xp": 2, "itemRolls": 1}
    assert out["owlBonusAtNoon"] is None
    assert out["robinBonusAtNight"] is None
    assert out["pack"]["coins"] >= 2 and out["pack"]["xp"] >= 2


def test_diurnal_birds_are_never_scheduled_asleep_at_night():
    # The whole point of the redesign: the bedtime quest can always be flown.
    out = run_node("""
      const core = require('./bird_sleep_core.js');
      const robin = { commonName:'European Robin', traits:['songbird'] };
      const rested = core.sanitizeSleepCare({ tiredness: 20, lastTirednessAt: 0 }, 0);
      const plans = [22, 23, 2].map(h => core.sleepPlan(rested, robin, { now:0, localHour:h, roostBuilt:true, busy:false }));
      console.log(JSON.stringify({ anyForcedSleep: plans.some(p => p.scheduled || p.shouldSleep) }));
    """)
    assert out["anyForcedSleep"] is False


def test_expedition_payout_multiplies_under_the_night_hunter_pack():
    out = run_node("""
      const core = require('./academy_treehouse_core.js');
      const sleep = require('./bird_sleep_core.js');
      const owl = { id:'owl1', commonName:'Tawny Owl', power:90, int:60, spd:50, stamina:60, cha:40, traits:['nocturnal'] };
      const now = 1754400000000;
      const day = core.createBirdExpedition(owl, 'moon_scout', now, { durationMinutes: 1440 });
      const night = core.createBirdExpedition(owl, 'moon_scout', now, { durationMinutes: 1440, nightBonus: sleep.NOCTURNAL_NIGHT_BONUS });
      const count = items => Object.values(items).reduce((a, b) => a + b, 0);
      console.log(JSON.stringify({
        dayFlag: day.nightBonus, nightFlag: night.nightBonus,
        coinsDoubled: night.rewards.coins === Math.round(day.rewards.coins * 2),
        branches: [day.rewards.branches, night.rewards.branches],
        xpDoubled: night.rewards.xp === Math.round(day.rewards.xp * 2),
        extraFind: count(night.rewards.items) === count(day.rewards.items) + 1,
        sameTimer: day.endMs === night.endMs
      }));
    """)
    assert out["dayFlag"] is None
    assert out["nightFlag"] == {"coins": 2, "branches": 1.5, "xp": 2, "itemRolls": 1}
    assert out["coinsDoubled"]
    # JS Math.round half-up, not Python's banker's rounding.
    assert out["branches"][1] == int(out["branches"][0] * 1.5 + 0.5)
    assert out["xpDoubled"]
    assert out["extraFind"]
    # The bonus multiplies the payout, never the timer.
    assert out["sameTimer"]


def test_training_xp_doubles_under_the_night_hunter_pack():
    out = run_node("""
      const core = require('./academy_treehouse_core.js');
      const sleep = require('./bird_sleep_core.js');
      const owl = { id:'owl1', commonName:'Tawny Owl' };
      const day = core.createTrainingSession(owl, 'wing_sprints', 1000);
      const night = core.createTrainingSession(owl, 'wing_sprints', 1000, { nightBonus: sleep.NOCTURNAL_NIGHT_BONUS });
      console.log(JSON.stringify({
        dayFlag: day.nightBonus, nightFlag: night.nightBonus,
        dayXp: day.rewards.xp, nightXp: night.rewards.xp,
        sameStat: day.rewards.bonus === night.rewards.bonus,
        sameTimer: day.endMs === night.endMs
      }));
    """)
    assert out["dayFlag"] is False and out["nightFlag"] is True
    assert out["nightXp"] == out["dayXp"] * 2
    assert out["sameStat"] and out["sameTimer"]


def test_app_wires_the_bonus_into_every_capacity():
    html = HTML_PATH.read_text(encoding="utf-8")
    helper = function_source(html, "nocturnalNightBonusFor")
    assert "nocturnalNightBonus" in helper
    # Dispatch and training both hand the pack to the reward core.
    assert "nightBonus: nocturnalNightBonusFor(bird)" in function_source(html, "startBirdExpedition")
    assert "{ nightBonus: nocturnalNightBonusFor(bird) }" in function_source(html, "startBirdTrainingSession")
    # The send sheet teaches the rule at night and marks nocturnal chips.
    sheet = function_source(html, "renderQuestSendSheet")
    assert "isNightRightNow()" in sheet
    assert "Night Hunter" in sheet
    # The claim celebration and the adventure log both say why the haul swelled.
    assert "NIGHT HUNTER RETURNS!" in function_source(html, "claimBirdExpedition")
    assert "q.nightBonus" in function_source(html, "buildQuestTimeline")
    # The Roost card advertises the perk on every nocturnal companion.
    assert "night work earns the Night Hunter bonus" in function_source(html, "academySleepStatusHTML")


def test_release_is_query_busted_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    for pin in (f"academy_treehouse_core.js?v={RELEASE_PIN}", f"bird_sleep_core.js?v={RELEASE_PIN}"):
        assert pin in html
        assert f"./{pin}" in sw
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
