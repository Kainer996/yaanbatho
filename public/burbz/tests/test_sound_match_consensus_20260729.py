import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_two_recent_matching_sound_windows_are_required():
    script = r"""
require('./sound_listener_core.js');
const S = globalThis.BurbzSoundListenerCore;
const c = S.createMatchConsensus({ required:2, ttlMs:60000 });
const first = c.observe('Common Linnet', 1000);
const mismatch = c.observe('Shore Lark', 2000);
const firstAgain = c.observe('Common Linnet', 3000);
const confirmed = c.observe('common linnet', 4000);
const afterConsume = c.observe('Common Linnet', 5000);
c.reset();
const expiredFirst = c.observe('Bittern', 1000);
const expiredSecond = c.observe('Bittern', 62001);
console.log(JSON.stringify({ first, mismatch, firstAgain, confirmed, afterConsume, expiredFirst, expiredSecond, snap:c.snapshot() }));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["first"]["confirmed"] is False
    assert out["mismatch"]["count"] == 1
    assert out["firstAgain"]["confirmed"] is True
    assert out["confirmed"]["confirmed"] is False
    assert out["afterConsume"]["confirmed"] is True
    assert out["expiredSecond"]["confirmed"] is False
    assert out["expiredSecond"]["count"] == 1
    assert out["snap"]["key"] == "bittern"


def test_parallel_species_each_require_two_windows_and_ui_filters_unconfirmed_matches():
    script = r"""
require('./sound_listener_core.js');
const S = globalThis.BurbzSoundListenerCore;
const c = S.createMatchConsensus({required: 2, ttlMs: 60000});
console.log(JSON.stringify([
  c.observe('Rook', 1000).confirmed,
  c.observe('Jackdaw', 1000).confirmed,
  c.observe('Rook', 13000).confirmed,
  c.observe('Jackdaw', 13000).confirmed
]));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, check=True)
    assert json.loads(result.stdout) == [False, False, True, True]

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "const confirmedSpeciesKeys = new Set();" in html
    assert "opts.confirmedSpeciesKeys" in html
    assert "result.allDetections || []" in html
