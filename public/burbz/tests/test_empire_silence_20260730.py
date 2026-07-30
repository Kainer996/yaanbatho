from pathlib import Path


BURBZ = Path(__file__).resolve().parents[1]
RELEASE = "empire-silent-v181-20260730"
AMBIENCE = "ambience-empire-treetops.mp3"


def test_empire_screen_has_no_ambient_audio_runtime():
    index = (BURBZ / "index.html").read_text(encoding="utf-8")

    assert "const EMPIRE_AMBIENCE" not in index
    assert "EMPIRE_AMBIENCE." not in index
    assert AMBIENCE not in index


def test_empire_ambience_is_not_precached():
    sw = (BURBZ / "sw.js").read_text(encoding="utf-8")

    assert AMBIENCE not in sw


def test_empire_silence_release_markers_match():
    index = (BURBZ / "index.html").read_text(encoding="utf-8")
    sw = (BURBZ / "sw.js").read_text(encoding="utf-8")

    assert f"const BURBZ_BUILD = '{RELEASE}';" in index
    assert RELEASE in sw
