import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
# The treehouse core's CURRENT ?v pin — later releases that touch the core
# move this on (the cache-lineage assert below keeps this release's own marker).
RELEASE_PIN = "midgame-progression-v227-20260805"


def _academy_core_json(script: str):
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_completed_training_never_revives_after_it_is_claimed():
    result = _academy_core_json(
        """
const academy = require('./academy_treehouse_core.js');
const bird = { id:'yellow-legged-gull', commonName:'Yellow-legged Gull' };
const session = academy.createTrainingSession(bird, 'wing_sprints', 1000);
const complete = academy.advanceTrainingSession(session, session.endMs + 1);
const claimed = academy.advanceTrainingSession({ ...complete, status:'claimed' }, session.endMs + 2);
console.log(JSON.stringify({ complete:complete.status, claimed:claimed.status }));
"""
    )
    assert result == {"complete": "complete", "claimed": "claimed"}


def test_terminal_activity_states_stay_terminal_when_progress_is_recalculated():
    result = _academy_core_json(
        """
const academy = require('./academy_treehouse_core.js');
const bird = { id:'gull', commonName:'Gull', power:80, int:40, spd:40, stamina:40 };
const training = academy.createTrainingSession(bird, 'wing_sprints', 1000);
const expedition = academy.createBirdExpedition(bird, 'find_seed', 2000);
const statuses = ['claimed', 'cancelled', 'failed'];
console.log(JSON.stringify({
  training: statuses.map(status => academy.advanceTrainingSession({ ...training, status }, training.endMs + 1).status),
  expedition: statuses.map(status => academy.advanceBirdExpedition({ ...expedition, status }, expedition.endMs + 1).status)
}));
"""
    )
    assert result == {
        "training": ["claimed", "cancelled", "failed"],
        "expedition": ["claimed", "cancelled", "failed"],
    }


def test_training_hall_hides_every_terminal_session_and_ships_the_new_core():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert "const active = sessions.filter(s => !['claimed','cancelled','failed'].includes(s.status));" in html
    assert f'academy_treehouse_core.js?v={RELEASE_PIN}' in html
    assert f'./academy_treehouse_core.js?v={RELEASE_PIN}' in sw
    assert "global-money-hud-v190-20260731-training-claim-terminal-v191-20260801" in sw
