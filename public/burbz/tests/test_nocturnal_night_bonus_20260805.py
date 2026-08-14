"""The Night Hunter bonus: nocturnal birds paid massively for night work.

The original design locked evening play to nocturnal birds, which broke the
bedtime loop: a player with no owl could not send anything out on the long
overnight expedition. The rule is now the other way round — ANY bird can be
worked at night (nothing new is ever blocked after dark), and a nocturnal
bird (owl, nightjar, frogmouth, kiwi…) used at night in any capacity earns
the Night Hunter bonus. Since night-hunter-ascendant-v258 the bonus is truly
massive: triple coins and XP, double timber, TWO guaranteed extra expedition
finds, triple training XP with doubled stat gains — and the new Night Wings
battle pack (pinned in test_night_hunter_ascendant_20260813.py).

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
RELEASE_PIN = "night-hunter-ascendant-v258-20260813"
# Both cores moved with the ascendant release: bird_sleep_core carries the
# bigger packs, academy_treehouse_core learned statBonus.
ACADEMY_CORE_PIN = "night-hunter-ascendant-v258-20260813"
CURRENT_BUILD = "empire-zoom-levels-v268-20260814"

ASCENDANT_PACK = {"coins": 3, "branches": 2, "xp": 3, "itemRolls": 2, "statBonus": 2}


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
    assert out["owlBonusAtNight"] == ASCENDANT_PACK
    assert out["owlBonusAtNoon"] is None
    assert out["robinBonusAtNight"] is None
    assert out["pack"]["coins"] >= 3 and out["pack"]["xp"] >= 3


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
        coinsTripled: night.rewards.coins === Math.round(day.rewards.coins * 3),
        branchesDoubled: night.rewards.branches === day.rewards.branches * 2,
        xpTripled: night.rewards.xp === Math.round(day.rewards.xp * 3),
        extraFinds: count(night.rewards.items) === count(day.rewards.items) + 2,
        sameTimer: day.endMs === night.endMs
      }));
    """)
    assert out["dayFlag"] is None
    assert out["nightFlag"] == {"coins": 3, "branches": 2, "xp": 3, "itemRolls": 2}
    assert out["coinsTripled"]
    assert out["branchesDoubled"]
    assert out["xpTripled"]
    assert out["extraFinds"]
    # The bonus multiplies the payout, never the timer.
    assert out["sameTimer"]


def test_training_triples_xp_and_doubles_stat_gains_under_the_pack():
    out = run_node("""
      const core = require('./academy_treehouse_core.js');
      const sleep = require('./bird_sleep_core.js');
      const owl = { id:'owl1', commonName:'Tawny Owl' };
      const day = core.createTrainingSession(owl, 'wing_sprints', 1000);
      const night = core.createTrainingSession(owl, 'wing_sprints', 1000, { nightBonus: sleep.NOCTURNAL_NIGHT_BONUS });
      const focusDay = core.createTrainingSession(owl, 'focus_roost', 1000);
      const focusNight = core.createTrainingSession(owl, 'focus_roost', 1000, { nightBonus: sleep.NOCTURNAL_NIGHT_BONUS });
      console.log(JSON.stringify({
        dayFlag: day.nightBonus, nightFlag: night.nightBonus,
        dayXp: day.rewards.xp, nightXp: night.rewards.xp,
        dayStat: day.rewards.bonus, nightStat: night.rewards.bonus,
        focusStats: [focusDay.rewards.bonus, focusNight.rewards.bonus],
        sameTimer: day.endMs === night.endMs
      }));
    """)
    assert out["dayFlag"] is False and out["nightFlag"] is True
    assert out["nightXp"] == out["dayXp"] * 3
    # Stat gains double at night — the drill's +1 becomes +2, the Focus
    # Roost's +2 becomes +4. The timer never moves.
    assert out["dayStat"] == 1 and out["nightStat"] == 2
    assert out["focusStats"] == [2, 4]
    assert out["sameTimer"]


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
    assert "Night Hunter 3×" in sheet
    # The claim celebration and the adventure log both say why the haul swelled.
    assert "NIGHT HUNTER RETURNS!" in function_source(html, "claimBirdExpedition")
    assert "q.nightBonus" in function_source(html, "buildQuestTimeline")
    # The Roost card advertises the perk on every nocturnal companion.
    assert "night work earns the Night Hunter bonus" in function_source(html, "academySleepStatusHTML")


def test_release_is_query_busted_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    for pin in (f"academy_treehouse_core.js?v={ACADEMY_CORE_PIN}", f"bird_sleep_core.js?v={RELEASE_PIN}"):
        assert pin in html
        assert f"./{pin}" in sw
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
