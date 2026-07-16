import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
CORE = ROOT / "sound_listener_core.js"
CATALOG_ADDITIONS = ROOT / "data" / "catalog-additions.json"
BUZZARD_ART = ROOT / "bird-art-cache" / "buzzard_burbz_manga_20260624_v2.png"
BUZZARD_CUTOUT = ROOT / "bird-art-cache" / "cutouts" / "buzzard_burbz_manga_20260624_v2_cutout.png"


def run_core(script):
    source = "global.window=global; require('./sound_listener_core.js'); const q=global.BurbzSoundListenerCore; " + script
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_common_buzzard_is_a_complete_catalogued_burbz_species_with_real_art():
    html = HTML.read_text(encoding="utf-8")
    profile = html.split('id: "buzzard"', 1)[1].split("  },", 1)[0]
    assert 'name: "Buzzard"' in profile
    assert 'scientificName: "Buteo buteo"' in profile
    assert 'aliases: ["Common Buzzard"' in profile
    assert 'rarity: "uncommon"' in profile
    assert "'Buzzard': '/burbz/bird-art-cache/buzzard_burbz_manga_20260624_v2.png'" in html
    assert "'Common Buzzard': '/burbz/bird-art-cache/buzzard_burbz_manga_20260624_v2.png'" in html
    assert "'Buzzard': '/burbz/bird-art-cache/cutouts/buzzard_burbz_manga_20260624_v2_cutout.png'" in html
    for path in (BUZZARD_ART, BUZZARD_CUTOUT):
        assert path.exists() and path.stat().st_size > 20_000
        with Image.open(path) as image:
            assert image.width >= 768 and image.height >= 768

    additions = json.loads(CATALOG_ADDITIONS.read_text(encoding="utf-8"))["species"]
    buzzard = next(row for row in additions if row["species_id"] == "common_buzzard")
    assert buzzard["common_name"] == "Buzzard"
    assert buzzard["latin_name"] == "Buteo buteo"
    assert {"Common Buzzard", "European Buzzard", "Buteo buteo"} <= set(buzzard["aliases"])
    assert buzzard["rarity_tier"] == "uncommon"


def test_sound_discovery_history_keeps_unique_birds_and_updates_repeat_counts():
    result = run_core(
        "const h=q.createDiscoveryHistory();"
        "h.add({key:'buzzard',name:'Buzzard',scientificName:'Buteo buteo',confidence:.75,rarity:'uncommon',isNew:true});"
        "h.add({key:'wood_pigeon',name:'Wood Pigeon',scientificName:'Columba palumbus',confidence:.71,rarity:'common',isNew:true});"
        "h.add({key:'buzzard',name:'Buzzard',scientificName:'Buteo buteo',confidence:.82,rarity:'uncommon',isNew:false});"
        "const before=h.snapshot();h.reset();console.log(JSON.stringify({before,after:h.snapshot()}));"
    )
    assert [row["name"] for row in result["before"]] == ["Buzzard", "Wood Pigeon"]
    assert result["before"][0]["count"] == 2
    assert result["before"][0]["confidence"] == 0.82
    assert result["before"][0]["isNew"] is True
    assert result["after"] == []


def test_merlin_sound_results_render_as_a_persistent_accessible_session_list():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="scanResultList"' in html
    assert 'role="log"' in html
    assert 'aria-live="polite"' in html
    assert 'id="scanResultCount"' in html
    assert "function recordSoundSessionDiscovery(" in html
    assert "function renderSoundSessionDiscoveries(" in html
    assert "soundDiscoveryHistory.add(" in html
    assert "soundDiscoveryHistory.snapshot()" in html
    assert "opts.source === 'sound' && continuousSoundScanWanted" in html
    assert "Discoveries this listen" in html
    assert "heardCount" in html

    start = html.split("async function startContinuousSoundListening", 1)[1].split("function cleanupFailedSoundStart", 1)[0]
    stop = html.split("function stopContinuousSoundListening", 1)[1].split("// Live", 1)[0]
    assert "soundDiscoveryHistory.reset()" in start
    assert "soundDiscoveryHistory.reset()" not in stop
    assert ".scan-result-list" in html
    assert ".scan-session-discovery" in html


def test_sound_discovery_cards_show_real_artwork_and_have_an_accessible_flip_front():
    html = HTML.read_text(encoding="utf-8")
    assert "const discoveryBird = createRosterBird(row.name);" in html
    assert "const artUrl = resolveBuiltInBirdArt(row.name, discoveryBird.commonName) || getBirdArtUrl(discoveryBird);" in html
    assert 'class="scan-session-discovery-art"' in html
    assert 'data-action="flip-discovery"' in html
    assert 'aria-expanded="\' + (flipped ? \'true\' : \'false\')' in html
    assert "function setSoundDiscoveryCardFlipped(card, flipped)" in html
    assert ".scan-session-discovery-inner" in html
    assert "transform:rotateY(180deg)" in html


def test_flipped_sound_discovery_card_shows_bird_information_and_birdex_action():
    html = HTML.read_text(encoding="utf-8")
    assert 'class="scan-session-discovery-back"' in html
    assert "info.summary || info.rationale" in html
    assert "info.habitat" in html
    assert "info.diet" in html
    assert 'data-action="show-in-birdex"' in html
    assert ">Show in Birdex<" in html
    assert 'data-action="flip-discovery-back"' in html
    assert 'aria-hidden="true" inert' in html


def test_show_in_birdex_opens_discovered_species_and_focuses_its_card():
    html = HTML.read_text(encoding="utf-8")
    assert "function showSpeciesInBirdex" in html
    function = html.split("function showSpeciesInBirdex", 1)[1].split("function ", 1)[0]
    assert "currentBurbzMode = 'birdex'" in function
    assert "currentBirdexDiscovery = 'discovered'" in function
    assert "currentFilter = 'all'" in function
    assert "switchScreen('birdex')" in function
    assert "renderBirdex()" in function
    assert "dataset.speciesKey === key" in function
    assert "scrollIntoView" in function
    assert "target.focus" in function
    assert 'data-species-key="${speciesKey(canonicalSpeciesName(bird.species || bird.commonName))}"' in html
