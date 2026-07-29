"""The installer bootstrap must execute before a blocking Flask app.run()."""

import hashlib
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sound_id import server_patcher  # noqa: E402


DIRECT = """\
from flask import Flask
app = Flask(__name__)

def _analyse_recording(path, **kwargs):
    return []

@app.route('/api/identify/sound', methods=['POST'])
def identify_sound():
    detections = _analyse_recording('/tmp/a.wav')
    if not detections:
        detections = _analyse_recording('/tmp/a.wav')
    return {'found': bool(detections)}

if __name__ == '__main__':
    app.run(port=5055)
"""


AGGREGATE = """\
from flask import Flask
app = Flask(__name__)

def _analyse_recording(path, **kwargs):
    return []

def _aggregate_sound_detections(rows, allow=None):
    return rows

@app.post('/burbz/api/identify/sound')
def identify_sound():
    raw = _analyse_recording('/tmp/a.wav')
    rows = _aggregate_sound_detections(raw, allow={'robin'})
    return {'found': bool(rows)}

if __name__ == "__main__":
    app.run(port=5055)
"""


def test_direct_mode_is_derived_from_handler_and_inserted_before_main_guard():
    rendered, mode = server_patcher.patched_source(DIRECT)
    assert mode == "direct"
    assert "mode='direct'" in rendered
    assert rendered.index(server_patcher.BEGIN) < rendered.index("if __name__")
    assert rendered.count(server_patcher.BEGIN) == 1
    compile(rendered, "server.py", "exec")


def test_aggregate_mode_requires_the_handler_to_call_the_aggregate_helper():
    rendered, mode = server_patcher.patched_source(AGGREGATE)
    assert mode == "aggregate"
    assert "mode='aggregate'" in rendered

    dead_helper = DIRECT.replace(
        "def _analyse_recording(path, **kwargs):",
        "def _aggregate_sound_detections(rows, allow=None):\n"
        "    return rows\n\n"
        "def _analyse_recording(path, **kwargs):",
    )
    assert server_patcher.detect_mode(dead_helper) == "direct"


def test_patching_twice_is_byte_for_byte_idempotent(tmp_path):
    target = tmp_path / "server.py"
    target.write_text(DIRECT, encoding="utf-8")
    assert server_patcher.patch_file(target) == "direct"
    once = target.read_bytes()
    assert server_patcher.patch_file(target) == "direct"
    assert target.read_bytes() == once
    assert once.count(server_patcher.BEGIN.encode()) == 1


def test_old_append_only_block_is_removed_without_losing_main_guard():
    old = DIRECT.rstrip() + """

# BURBZ-BIRDNET-V3-BEGIN v2
try:
    import sound_id as _burbz_sound_id
except ImportError:
    _burbz_sound_id = None
"""
    rendered, mode = server_patcher.patched_source(old)
    assert mode == "direct"
    assert "_burbz_sound_id" not in rendered
    assert "app.run(port=5055)" in rendered
    assert rendered.count(server_patcher.BEGIN) == 1


def test_not_equal_main_guard_is_rejected_as_unreachable():
    unsafe = DIRECT.replace(
        "if __name__ == '__main__':",
        "if __name__ != '__main__':",
    )
    with pytest.raises(server_patcher.ServerPatchError, match="execute before"):
        server_patcher.patched_source(unsafe)


def test_known_unmarked_legacy_block_is_removed_but_lookalike_code_is_refused(tmp_path):
    historical = DIRECT.rstrip() + """

# BirdNET V3 — appended by scripts/install-birdnet-v3.sh
try:
    import sound_id as _burbz_sound_id
except ImportError:
    _burbz_sound_id = None
"""
    rendered, _ = server_patcher.patched_source(historical)
    assert "_burbz_sound_id" not in rendered
    assert "app.run(port=5055)" in rendered

    unrelated = DIRECT.rstrip() + """

import sound_id as _burbz_sound_id
KEEP_THIS_SERVER_CODE = True
"""
    target = tmp_path / "server.py"
    target.write_text(unrelated, encoding="utf-8")
    before = target.read_bytes()
    with pytest.raises(server_patcher.ServerPatchError, match="unrelated"):
        server_patcher.patch_file(target)
    assert target.read_bytes() == before


@pytest.mark.parametrize(
    "source",
    [
        "app = object()\n",  # no route
        """\
from flask import Flask
app = Flask(__name__)
@app.post('/api/identify/sound')
def first(): return {}
@app.post('/burbz/api/identify/sound')
def second(): return {}
""",
        """\
from flask import Flask
app = Flask(__name__)
@app.post('/api/identify/sound')
def identify_sound(): return {}
""",  # route does not use the expected helper
    ],
)
def test_unsupported_server_is_left_byte_identical(tmp_path, source):
    target = tmp_path / "server.py"
    target.write_text(source, encoding="utf-8")
    before = hashlib.sha256(target.read_bytes()).hexdigest()
    with pytest.raises(server_patcher.ServerPatchError):
        server_patcher.patch_file(target)
    assert hashlib.sha256(target.read_bytes()).hexdigest() == before
