"""Merlin's wand stays quiet, and no bird card crops the bird.

Three of Yaan's reports from his phone, in one release.

The session shelf on the sound screen drew the bird's emoji and then laid the
painting on top of it, so the old placeholder glyph showed through wherever
the art was transparent. The stand-in now waits hidden behind loaded art and
steps out only if the picture fails.

Tapping START MERLIN'S WAND played `bird-blackbird.mp3` — a real Common
Blackbird recording — because the click classifier matched the word "scan".
On a screen whose whole job is telling the player which bird they just heard,
that is a lie. Every recorded bird call is out of the sound bank.

The recruit inspector and the companion cards filled their frames with square
paintings, cutting heads and tails off. The whole painting is fitted in now,
on a blurred wash of the same art.
"""
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
REPO = BURBZ.parents[1]
HTML = (BURBZ / "index.html").read_text(encoding="utf-8")
AUDIO_CORE = (BURBZ / "audio_core.js").read_text(encoding="utf-8")
SW = (BURBZ / "sw.js").read_text(encoding="utf-8")
DEPLOY = (REPO / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")

RELEASE_PIN = "field-any-bird-v330-20260826"
OWN_RELEASE_PIN = "quiet-wand-whole-art-v304-20260821"


def block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    return source[start:source.index(end_marker, start)]


# ---------------------------------------------------------------------------
# 1. No placeholder glyph behind a loaded painting
# ---------------------------------------------------------------------------

def test_the_stand_in_glyph_hides_behind_art_that_loaded():
    helper = block(HTML, "function birdArtOverFallback(", "// The session shelf on the sound screen")
    # No art at all: the glyph is the picture, so it shows.
    assert "if (!artUrl) return glyph('');" in helper
    # Art present: the glyph is hidden and only unhides if the picture fails.
    assert "glyph(' hidden')" in helper
    assert "onerror=\"this.previousElementSibling.hidden=false;this.remove()\"" in helper


def test_both_sound_session_surfaces_use_the_helper():
    shelf = block(HTML, "function renderSoundSessionShelf()", "function renderSoundSessionDiscoveries(")
    assert "birdArtOverFallback(artUrl, bird.emoji" in shelf
    assert "'sound-session-tile-fallback'" in shelf

    discoveries = block(HTML, "function renderSoundSessionDiscoveries(", "function setSoundDiscoveryCardFlipped(")
    assert "birdArtOverFallback(artUrl, discoveryBird.emoji" in discoveries
    assert "'scan-session-discovery-fallback'" in discoveries

    # Neither surface may stack an emoji and an image again.
    for surface in (shelf, discoveries):
        assert "'&#128038;') + (artUrl ?" not in surface


# ---------------------------------------------------------------------------
# 2. The game never plays a recorded bird
# ---------------------------------------------------------------------------

def test_no_recorded_bird_call_is_in_the_sound_bank():
    for gone in ("bird-blackbird.mp3", "bird-tawny-owl.mp3"):
        assert gone not in AUDIO_CORE, gone
    assert "bird: function(opts)" not in AUDIO_CORE
    assert "owl: function(opts)" not in AUDIO_CORE
    # The two mp3s no longer ship: not precached, not synced, not on disk.
    for gone in ("bird-blackbird.mp3", "bird-tawny-owl.mp3"):
        assert gone not in SW, gone
        assert gone not in DEPLOY, gone
        assert not (BURBZ / "assets" / "audio" / gone).exists(), gone


def test_the_ogg_fixtures_stay_for_the_sound_id_self_check():
    # The self-test identifies the owl and guards the blackbird confuser.
    for keep in ("bird-tawny-owl.ogg", "bird-blackbird.ogg"):
        assert (BURBZ / "assets" / "audio" / keep).exists(), keep
        assert f"assets/audio/{keep}" in DEPLOY, keep


def test_a_tap_can_no_longer_classify_as_a_bird_or_an_owl():
    classifier = block(AUDIO_CORE, "function classifyInteraction(", "function createAudioManager(")
    assert "return 'bird'" not in classifier
    assert "return 'owl'" not in classifier
    # "scan" and "bird" fall through to the neutral interface tap; a capture
    # still gets its made flourish.
    assert "if (/\\b(capture|discover)\\b/.test(text)) return 'capture';" in classifier
    assert "return 'tap';" in classifier


def test_the_night_expedition_lost_its_recorded_owl():
    assert "SFX.owl()" not in HTML
    assert "typeof SFX.owl" not in HTML


def test_the_credits_say_the_recordings_never_play():
    credits = (BURBZ / "audio-credits.html").read_text(encoding="utf-8")
    assert "Burbz never plays these to you." in credits
    # The CC BY attribution itself stays — the clips are still redistributed.
    assert "Common Blackbird song (Turdus merula)" in credits
    assert "Tawny owl calling at night" in credits


# ---------------------------------------------------------------------------
# 3. Whole paintings, never cropped
# ---------------------------------------------------------------------------

def test_bird_cards_fit_the_painting_over_a_wash_of_itself():
    assert ".card-art img.card-art-painting { object-fit: contain; filter: none; }" in HTML
    wash = block(HTML, ".card-art img.card-art-wash {", "}")
    assert "object-fit: cover" in wash and "blur(" in wash
    # Every card that draws a painting lays the wash under it first.
    assert HTML.count("${cardArtWashHTML(cardArt)}<img src=") == 3
    # A single full-width companion card gets room for the fitted painting.
    assert ".bird-grid.companions-grid.companions-count-1 .card-art { height:clamp(240px,70vw,320px); }" in HTML


def test_the_recruit_inspector_fits_the_painting_too():
    frame = block(HTML, ".barracks-detail-art {", "\n.barracks-detail-body")
    assert "position:relative" in frame and "overflow:hidden" in frame
    # Both layers are anchored to the frame, so their heights resolve.
    assert ".barracks-detail-wash { position:absolute; inset:0;" in frame
    assert ".barracks-detail-painting { position:absolute; inset:0;" in frame
    assert "object-fit:contain" in frame

    markup = block(HTML, "  const artHtml = art\n", "  const description =")
    assert 'class="barracks-detail-wash"' in markup
    assert 'class="barracks-detail-painting"' in markup


# ---------------------------------------------------------------------------
# Release stamp
# ---------------------------------------------------------------------------

def test_release_stamp_reaches_runtime_and_service_worker():
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML
    assert RELEASE_PIN in SW
    assert OWN_RELEASE_PIN in SW  # lineage kept
