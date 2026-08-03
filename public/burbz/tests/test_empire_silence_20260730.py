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

    # This release must stay in the service worker's cache lineage...
    assert RELEASE in sw
    # ...but BURBZ_BUILD names the NEWEST release and later ones move it on, so
    # pin only that the build tag is itself a real marker in that lineage.
    # Hardcoding this release's tag here goes red on the very next release.
    build = index.split("const BURBZ_BUILD = '", 1)[1].split("';", 1)[0]
    assert build in sw
