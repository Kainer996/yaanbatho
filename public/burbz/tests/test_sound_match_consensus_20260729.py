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
    assert out["firstAgain"]["count"] == 1
    assert out["confirmed"]["confirmed"] is True
    assert out["afterConsume"]["confirmed"] is False
    assert out["expiredSecond"]["confirmed"] is False
    assert out["expiredSecond"]["count"] == 1
    assert out["snap"]["key"] == "bittern"
