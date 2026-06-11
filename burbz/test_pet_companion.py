import json
from pathlib import Path

HTML = Path(__file__).with_name("index.html").read_text(encoding="utf-8")
BIRD_DATA = json.loads((Path(__file__).parents[1] / "public" / "burbz" / "data" / "birds.json").read_text(encoding="utf-8"))


def test_pet_state_is_persisted_and_migrated():
    assert "activePetId: null" in HTML
    assert "pet: { hunger: 20, happiness: 80" in HTML
    assert "activePetId" in HTML and "ensureActivePetStillExists" in HTML


def test_bird_cards_offer_pet_selection():
    assert "Make Pet" in HTML
    assert "data-action=\"make-pet\"" in HTML
    assert "selectPet(" in HTML


def test_companion_dom_and_animation_exist():
    assert "petCompanion" in HTML
    assert "pet-companion" in HTML
    assert "startPetWander" in HTML
    assert "pet-walk" in HTML
    assert "setPetOnPerch" in HTML
    assert "petFlyOutAndReturn" in HTML


def test_pet_lives_on_corner_perch_not_bottom_overlay():
    assert "top: calc(var(--safe-top) + 76px)" in HTML
    assert "right: 14px" in HTML
    assert "pet-nameplate { display: none; }" in HTML
    pet_css = HTML[HTML.index(".pet-companion {"):HTML.index(".pet-companion.show")]
    assert "bottom: calc(var(--nav-height)" not in pet_css


def test_pet_interactions_cover_tamagotchi_basics():
    assert "feedPet" in HTML
    assert "playWithPet" in HTML
    assert "petHungerFill" in HTML
    assert "petHappyFill" in HTML


def test_sound_id_sends_location_and_parses_backend_messages():
    assert "function demoIdentify" not in HTML
    assert "getCurrentPositionForBirdnet" in HTML
    assert "formData.append('lat'" in HTML
    assert "await response.json().catch" in HTML


def test_photo_id_sends_capture_source_and_uses_live_camera_frame():
    assert 'id="imageInput"' not in HTML
    assert "function openNativeImageCapture()" not in HTML
    assert "function captureCameraFrame()" in HTML
    assert "$('captureBtn').addEventListener('click', async () =>" in HTML
    assert "$('uploadArea').addEventListener('click', async () =>" in HTML
    assert "formData.append('captureSource', captureSource)" in HTML
    assert "await startCamera()" in HTML
    assert "await identifyImage(blob, 'camera')" in HTML


def test_photo_id_backend_has_real_classifier_hook():
    photo_id = Path(__file__).with_name("photo_id.py").read_text(encoding="utf-8")
    assert "MobileNetV2" in photo_id
    assert "BIRD_LABELS" in photo_id
    assert "normalise_image_file" in photo_id


def test_demo_birds_are_opt_in_only():
    assert "get('demo') === '1'" in HTML
    assert "if (new URLSearchParams(window.location.search).get('demo') === '1') addDemoBirds();" in HTML


def test_card_art_does_not_overlay_wrong_emoji_when_art_exists():
    assert "const cardArtUrl = getBirdArtUrl(bird)" in HTML
    assert "${birdIcon}" in HTML
    assert "${artBg}\n            <div class=\"bird-emoji\">" not in HTML


def test_built_in_art_resolves_aliases_and_corrects_saved_birds():
    assert "function resolveBuiltInBirdArt" in HTML
    assert "function getBirdArtUrl" in HTML
    assert "'Carrion Crow': '/burbz/bird-art-cache/raven_yaan_square_20260608.png'" in HTML
    assert "'Common Blackbird': '/burbz/bird-art-cache/blackbird_yaan_square_20260608.png'" in HTML
    assert "b.artUrl = mappedArt" in HTML


def test_pet_speech_bubble_renders_above_sprite():
    assert ".pet-speech {" in HTML
    assert "z-index: 6" in HTML
    assert ".pet-sprite {" in HTML
    assert "z-index: 3" in HTML


def test_common_uk_bird_coverage_is_extended_in_data_and_ui():
    names = {s["common_name"] for s in BIRD_DATA["species"]}
    for species in [
        "Common Blackbird", "Great Tit", "Coal Tit", "Long-tailed Tit",
        "Dunnock", "Common Chaffinch", "Common Wood Pigeon",
        "Eurasian Collared Dove", "Feral Pigeon", "Common Chiffchaff",
        "Eurasian Blackcap", "White Wagtail",
    ]:
        assert species in names

    # The active single-page app has profile aliases for BirdNET-style names.
    for alias in ["Eurasian Blackbird", "European Starling", "Common Swift", "Great Tit", "White Wagtail"]:
        assert alias in HTML


def test_sound_backend_uses_catalog_aliases_and_low_confidence_second_pass():
    server = Path(__file__).with_name("server.py").read_text(encoding="utf-8")
    assert "BIRD_DATA_PATH" in server
    assert "GAME_BIRD_CATALOG" in server
    assert "min_conf=0.18" in server
    assert "min_conf=0.08" in server
    assert "catalogMatched" in server
