"""Seven selectable duration tiers, including bedtime-length quests, for every normal Kingdom errand."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "academy_treehouse_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "roost-retired-v302-20260820"


def node_json(source: str):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    depth = 0
    for i in range(start, len(html)):
        if html[i] == "{":
            depth += 1
        elif html[i] == "}":
            depth -= 1
            if depth == 0:
                return html[start:i + 1]
    raise AssertionError(name)


def test_normal_quests_offer_the_seven_requested_duration_tiers_including_eight_hours():
    data = node_json("""
      const A = require('./academy_treehouse_core.js');
      const templates = A.getQuestTemplates().filter(t => !t.tutorial);
      console.log(JSON.stringify({
        durations: A.QUEST_DURATION_MINUTES,
        options: templates.map(t => ({id:t.id, ds:A.getQuestDurationOptions(t.id).map(x => x.minutes)}))
      }));
    """)
    assert data["durations"] == [5, 10, 30, 60, 120, 480, 1440]
    assert data["options"]
    assert all(row["ds"] == data["durations"] for row in data["options"])


def test_duration_curve_increases_totals_but_quick_quests_pay_best_per_minute():
    rows = node_json("""
      const A = require('./academy_treehouse_core.js');
      console.log(JSON.stringify(A.QUEST_DURATION_MINUTES.map(minutes => ({
        minutes, multiplier:A.questDurationMultiplier(minutes)
      }))));
    """)
    totals = [row["multiplier"] for row in rows]
    hourly = [row["multiplier"] / row["minutes"] for row in rows]
    assert totals == sorted(totals) and len(set(totals)) == len(totals)
    assert all(a > b for a, b in zip(hourly, hourly[1:])), hourly
    # A 24-hour dispatch remains worthwhile in total, but an attentive player
    # repeating five-minute quests earns substantially more over the same day.
    assert totals[-1] > totals[0] * 100
    assert 288 * totals[0] > totals[-1]
    loot_rows = node_json("""
      const A = require('./academy_treehouse_core.js');
      console.log(JSON.stringify(A.getQuestDurationOptions('find_coins').map(x => x.expectedItemRolls)));
    """)
    assert loot_rows == sorted(loot_rows)
    assert loot_rows[-1] < 20, "a 24-hour quest should offer useful loot, not hundreds of impossible carry items"
    branch_rows = node_json("""
      const A = require('./academy_treehouse_core.js');
      console.log(JSON.stringify(A.getQuestDurationOptions('find_coins').map(x => x.branches[1])));
    """)
    assert branch_rows[-1] < 20, "physical timber loot should respect the gentler carry curve"


def test_selected_duration_controls_clock_and_scaled_loot_and_xp():
    data = node_json("""
      const A = require('./academy_treehouse_core.js');
      const bird = {id:'b1', commonName:'Robin', power:160, int:40, spd:40, stamina:160, cha:40};
      const short = A.createBirdExpedition(bird, 'moon_scout', 1000000, {durationMinutes:5});
      const long = A.createBirdExpedition(bird, 'moon_scout', 1000000, {durationMinutes:1440});
      console.log(JSON.stringify({short,long}));
    """)
    short, long = data["short"], data["long"]
    assert short["durationMinutes"] == 5
    assert long["durationMinutes"] == 1440
    assert short["endMs"] - short["startMs"] == 5 * 60 * 1000
    assert long["endMs"] - long["startMs"] == 24 * 60 * 60 * 1000
    assert long["rewards"]["coins"] > short["rewards"]["coins"]
    assert long["rewards"]["xp"] > short["rewards"]["xp"]
    assert short["rewards"]["xp"] / 5 > long["rewards"]["xp"] / 1440
    assert long["rewards"]["branches"] < 40
    assert long["rewards"]["itemRolls"] > short["rewards"]["itemRolls"]


def test_send_sheet_has_mobile_duration_choices_and_dispatches_selected_tier():
    html = HTML.read_text(encoding="utf-8")
    assert 'class="quest-duration-grid"' in html
    assert 'function selectQuestDuration(' in html
    assert "durationMinutes: questSendState.durationMinutes" in function_source(html, "confirmQuestSend")
    sheet = function_source(html, "renderQuestSendSheet")
    assert "getQuestDurationOptions" in sheet
    assert "Quick quests pay best per hour" in sheet
    assert "7 durations" in html
    assert ".quest-duration-grid" in html
    assert "grid-template-columns:repeat(2,minmax(0,1fr))" in html.replace(" ", "")


def test_release_is_cache_busted_in_html_and_service_worker():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert RELEASE in html
    assert RELEASE in sw
    assert "academy_treehouse_core.js?v=" + RELEASE in html


def test_tutorial_errand_remains_seconds_long_and_has_no_duration_picker():
    data = node_json("""
      const A = require('./academy_treehouse_core.js');
      const t = A.getQuestTemplates().find(x => x.id === 'merlin_first_flight');
      const exp = A.createBirdExpedition({id:'merlin-guide', commonName:'Merlin'}, t.id, 1000000, {durationMinutes:1440});
      console.log(JSON.stringify({options:A.getQuestDurationOptions(t.id), ms:exp.endMs-exp.startMs}));
    """)
    assert data["options"] == []
    assert data["ms"] == 5 * 1000
