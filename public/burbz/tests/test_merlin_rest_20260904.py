"""A saved Merlin nap takes time and can finish only once."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_js(code):
    result = subprocess.run(
        ['node', '-e', "const c = require('./merlin_companion_core.js');\n" + code],
        cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True,
    )
    return json.loads(result.stdout)


def test_nap_cannot_be_restarted_or_rewarded_by_repeated_presses():
    result = run_js("""
const now = 1000000;
const before = c.sanitizeMerlinCare({energy:72, happiness:70, bondXp:20}, now);
const start = c.applyMerlinCareAction(before, {small_bird_prey_ration:2}, 'rest', now);
let state = start.state;
const attempts = ['rest','rest','play','feed'].map((action, i) => {
  const result = c.applyMerlinCareAction(state, start.pantry, action, now + 100 + i);
  state = result.state;
  return {ok:result.ok, end:state.restEndsAt, energy:state.energy, bond:state.bondXp, pantry:result.pantry};
});
console.log(JSON.stringify({start, attempts}));
""")
    start = result['start']
    assert start['ok']
    assert start['state']['restEndsAt'] - start['state']['restStartedAt'] == 10000
    assert start['state']['energy'] == 72
    assert start['state']['bondXp'] == 20
    for attempt in result['attempts']:
        assert not attempt['ok']
        assert attempt['end'] == start['state']['restEndsAt']
        assert attempt['energy'] == 72 and attempt['bond'] == 20
        assert attempt['pantry']['small_bird_prey_ration'] == 2


def test_saved_nap_finishes_once_at_deadline_or_after_reload():
    result = run_js("""
const start = c.applyMerlinCareAction({energy:40,happiness:70,bondXp:98}, {}, 'rest', 1000000).state;
const before = c.completeMerlinRest(JSON.parse(JSON.stringify(start)), start.restEndsAt - 1);
const finish = c.completeMerlinRest(JSON.parse(JSON.stringify(start)), start.restEndsAt);
const later = c.tickMerlinCare(JSON.parse(JSON.stringify(finish)), 0, start.restEndsAt + 5000);
const retry = c.applyMerlinCareAction(later, {}, 'rest', start.restEndsAt + 5000);
console.log(JSON.stringify({before,finish,later,retry}));
""")
    assert result['before']['energy'] == 40
    done = result['finish']
    assert done['energy'] == 100 and done['happiness'] == 73
    assert done['restEndsAt'] is None and done['restStartedAt'] is None
    assert done['lastRestedAt'] == 1010000
    assert (done['bondLevel'], done['bondXp']) == (2, 1)
    assert (result['later']['bondLevel'], result['later']['bondXp']) == (2, 1)
    assert not result['retry']['ok']


def test_play_has_a_breather_and_tired_wings_need_rest():
    result = run_js("""
const play = c.applyMerlinCareAction({energy:50,happiness:50}, {}, 'play', 1000000);
const repeat = c.applyMerlinCareAction(play.state, {}, 'play', 1000001);
const after = c.applyMerlinCareAction(play.state, {}, 'play', 1000000 + c.MERLIN_PLAY_COOLDOWN_MS);
const tired = c.applyMerlinCareAction({energy:10}, {}, 'play', 1000000);
console.log(JSON.stringify({play,repeat,after,tired}));
""")
    assert result['play']['ok'] and result['after']['ok']
    assert not result['repeat']['ok'] and not result['tired']['ok']
    assert result['repeat']['state']['energy'] == result['play']['state']['energy']
    assert result['repeat']['state']['bondXp'] == result['play']['state']['bondXp']


def test_old_care_saves_stay_awake_with_their_progress_intact():
    result = run_js("""
console.log(JSON.stringify(c.completeMerlinRest({energy:45,happiness:80,bondXp:61,bondLevel:3,lastRestedAt:999000},1000000)));
""")
    assert result['restEndsAt'] is None
    assert result['energy'] == 45 and result['happiness'] == 80
    assert (result['bondLevel'], result['bondXp'], result['lastRestedAt']) == (3, 61, 999000)
