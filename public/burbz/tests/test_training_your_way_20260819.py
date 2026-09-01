"""training-your-way-v288 — the Training Hall works like the quests now.

Yaan's ask: the notice board carried too much fluff, and every drill ran on
one fixed timer. Now the player picks the run length — 15 minutes to a full
day, the classic mobile ladder — and the longer the run, the less it pays
per minute: many short runs always beat one long one, so attentive play
wins, while a day run still pays a real total for a player who is away.

The reward maths is anchored to each template's classic duration, so a run
at that duration pays exactly what it always did — old saves, old tests and
the night-school multipliers all hold.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
OWN_RELEASE_PIN = "roost-retired-v302-20260820"
PREVIOUS_RELEASE_PIN = "mercy-streak-attack-preview-v287-20260819"
CURRENT_BUILD = "release-polish-v342-20260901"
# magpie-market-v316 edited this core, so it ships under that tag now.
ACADEMY_CORE_PIN = "iron-ingot-errand-v326-20260825"
LADDER = [15, 30, 60, 120, 240, 480, 1440]


def _node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


# ---- The duration ladder and its diminishing economy ------------------------

def test_ladder_runs_from_a_quarter_hour_to_a_day():
    payload = _node("""
const core = require('./academy_treehouse_core.js');
console.log(JSON.stringify({
  ladder: core.TRAINING_DURATION_MINUTES,
  options: core.getTrainingDurationOptions('wing_sprints'),
  unknown: core.getTrainingDurationOptions('not_a_drill')
}));
""")
    assert payload["ladder"] == LADDER
    assert [o["minutes"] for o in payload["options"]] == LADDER
    assert payload["unknown"] == []


def test_short_runs_always_pay_best_per_minute():
    payload = _node("""
const core = require('./academy_treehouse_core.js');
console.log(JSON.stringify(core.getTrainingDurationOptions('wing_sprints')));
""")
    options = payload
    # Totals grow with the clock — a longer run is never a smaller payout.
    for a, b in zip(options, options[1:]):
        assert b["xp"] > a["xp"], (a, b)
        assert b["bonus"] >= a["bonus"], (a, b)
        assert b["hunger"] >= a["hunger"], (a, b)
    # But the payout per minute strictly falls, so repeated short runs beat
    # one long one — the classic attentive-play trade-off.
    rates = [o["xp"] / o["minutes"] for o in options]
    for a, b in zip(rates, rates[1:]):
        assert b < a, rates
    short, day = options[0], options[-1]
    runs = day["minutes"] // short["minutes"]  # 96 quarter-hours in a day
    assert short["xp"] * runs > day["xp"] * 2
    assert short["bonus"] * runs > day["bonus"] * 2


def test_classic_durations_pay_exactly_the_classic_rewards():
    # The anchor contract: with no duration chosen (legacy callers, old
    # saves), every drill keeps its classic timer and byte-identical payout.
    payload = _node("""
const core = require('./academy_treehouse_core.js');
const bird = { id:'b1', commonName:'Robin' };
const wing = core.createTrainingSession(bird, 'wing_sprints', 1000);
const focus = core.createTrainingSession(bird, 'focus_roost', 1000);
console.log(JSON.stringify({
  wing: { minutes: (wing.endMs - wing.startMs) / 60000, xp: wing.rewards.xp, bonus: wing.rewards.bonus, hunger: wing.rewards.hunger },
  focus: { minutes: (focus.endMs - focus.startMs) / 60000, xp: focus.rewards.xp, bonus: focus.rewards.bonus }
}));
""")
    assert payload["wing"] == {"minutes": 120, "xp": 38, "bonus": 1, "hunger": 10}
    assert payload["focus"] == {"minutes": 300, "xp": 92, "bonus": 2}


def test_sessions_honor_the_chosen_duration_and_refuse_junk():
    payload = _node("""
const core = require('./academy_treehouse_core.js');
const sleep = require('./bird_sleep_core.js');
const bird = { id:'b1', commonName:'Tawny Owl' };
const short = core.createTrainingSession(bird, 'wing_sprints', 1000, { durationMinutes: 15 });
const day = core.createTrainingSession(bird, 'wing_sprints', 1000, { durationMinutes: 1440 });
const junk = core.createTrainingSession(bird, 'wing_sprints', 1000, { durationMinutes: 47 });
const night = core.createTrainingSession(bird, 'wing_sprints', 1000, { durationMinutes: 15, nightBonus: sleep.NOCTURNAL_NIGHT_BONUS });
const feast = core.createTrainingSession(bird, 'pantry_gauntlet', 1000, { durationMinutes: 1440 });
console.log(JSON.stringify({
  shortMin: short.durationMinutes, shortEnd: (short.endMs - short.startMs) / 60000, shortXp: short.rewards.xp,
  dayMin: day.durationMinutes, dayXp: day.rewards.xp,
  junkMin: junk.durationMinutes,
  nightXp: night.rewards.xp, nightStat: night.rewards.bonus, sameTimer: night.endMs === short.endMs,
  feastHunger: feast.rewards.hunger
}));
""")
    assert payload["shortMin"] == 15 and payload["shortEnd"] == 15
    assert payload["dayMin"] == 1440 and payload["dayXp"] > payload["shortXp"] * 10
    assert payload["junkMin"] == 120                 # off-ladder → classic timer
    # Night school composes with the chosen duration: 3× XP, 2× stat, same clock.
    assert payload["nightXp"] == payload["shortXp"] * 3
    assert payload["nightStat"] == 2
    assert payload["sameTimer"] is True
    # The Pantry Gauntlet still FEEDS — its negative hunger scales, never flips.
    assert payload["feastHunger"] < -10


# ---- The cleaned-up notice board ---------------------------------------------

def test_the_board_has_one_dial_and_no_fluff():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "let trainingDurationChoice = 15;" in html
    pick = function_source(html, "selectTrainingDuration")
    assert "ladder.includes(Number(minutes))" in pick
    assert "renderAcademyRoomInterior();" in pick
    assert "selectTrainingDuration," in html          # window exposure list
    hall = function_source(html, "renderTrainingHallPanel")
    assert "training-duration-row" in hall
    assert "training-duration-chip" in hall
    assert "getTrainingDurationOptions" in hall
    assert "1 move session" in hall                   # the preview names the tier progress
    assert "Short runs pay the most for your time" in hall
    # The fluff is gone: no essay paragraphs, no 'Send X · fed' labels.
    assert "Choose a drill, then assign an available bird" not in html
    assert "Seven timed drills across the Academy rooms" not in html
    assert "'Send ' + birdDisplayName(b)" not in hall
    assert "Feed ' + birdDisplayName(b) + ' first'" in hall
    for cls in (".training-duration-chip", ".training-duration-chip.selected", ".training-reward-line"):
        assert cls in html, cls


def test_dispatch_sends_the_chosen_duration():
    html = HTML_PATH.read_text(encoding="utf-8")
    start = function_source(html, "startBirdTrainingSession")
    assert "durationMinutes: trainingDurationChoice" in start
    assert "nightBonus: nocturnalNightBonusFor(bird)" in start
    # The toast names the run length so the choice reads back.
    assert "fmtTrainingTime(session.durationMinutes" in start


# ---- Release plumbing ---------------------------------------------------------

def test_release_is_versioned_and_the_academy_core_shipped():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    pin = f"academy_treehouse_core.js?v={ACADEMY_CORE_PIN}"
    assert f'<script src="{pin}"></script>' in html
    assert sw.count(f"'./{pin}'") == 2
