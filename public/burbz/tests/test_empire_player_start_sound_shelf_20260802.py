"""Empire opens on the player; the sound screen grows a session shelf.

Three player-reported changes in one release:

1. The Empire atlas' FIRST framing centres on where the player is physically
   standing (live GPS fix, else the remembered home fix) instead of the realm.
   The realm framing survives behind the 👑 MY REALM button and as the
   explicit reframe after liberating a village.

2. The sound-recognition screen shows a compact grid of every bird discovered
   this listening session where the BirdNET data note used to sit; the note
   itself moved below the START button.

3. The full-width "bird heard" encounter banner only appears the FIRST time a
   species is heard in a listening session — repeats of the same bird tick up
   their shelf tile instead of re-covering the screen.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE_PIN = "free-birds-v318-20260824"
# This release's own marker stays on the cache lineage even after later
# releases move BURBZ_BUILD on.
OWN_RELEASE_PIN = "empire-player-start-sound-shelf-v196-20260802"


# ---------------------------------------------------------------------------
# 1. Empire atlas opens on the player
# ---------------------------------------------------------------------------

def test_frame_empire_player_centres_on_the_players_position():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("function frameEmpirePlayer()")
    body = html[start:html.index("function frameEmpireTerritory(", start)]
    # The player's own position drives the framing, at a close village-level zoom.
    assert "empirePlayerPosition()" in body
    assert "EMPIRE_PLAYER_ZOOM" in body
    # No position yet → fall back to the old realm framing, never a blank stare.
    assert "frameEmpireTerritory()" in body
    assert "empireMapHasFramed = true" in body
    assert "const EMPIRE_PLAYER_ZOOM" in html


def test_first_framing_uses_the_player_and_explicit_reframes_keep_the_realm():
    html = HTML.read_text(encoding="utf-8")
    refresh = html[html.index("function refreshEmpireMap("):html.index("function initialiseEmpireMap(")]
    # Explicit frame:true (village liberation) still frames the whole realm;
    # the session's first framing goes to the player instead.
    assert "if (options.frame) frameEmpireTerritory();" in refresh
    assert "else if (!empireMapHasFramed) frameEmpirePlayer();" in refresh
    init = html[html.index("function initialiseEmpireMap("):html.index("function renderEmpireWorldMap(")]
    # Map construction starts at the player when a position is already known...
    assert "const here = empirePlayerPosition();" in init
    assert "here ? EMPIRE_PLAYER_ZOOM" in init
    # ...and the post-load refresh no longer forces the realm framing.
    assert "refreshEmpireMap({ frame:true });" not in init
    # Liberating a village still explicitly reframes the realm.
    assert "refreshEmpireMap({ frame:true });" in html


def test_late_first_gps_fix_glides_to_the_player_zoom():
    html = HTML.read_text(encoding="utf-8")
    fix = html[html.index("function requestEmpireHomeFix()"):html.index("function frameEmpirePlayer()")]
    assert "zoom:EMPIRE_PLAYER_ZOOM" in fix
    assert "!empireMapUserAdjusted" in fix


# ---------------------------------------------------------------------------
# 2. Sound screen: session shelf where the data note was
# ---------------------------------------------------------------------------

def test_sound_scan_area_orders_shelf_then_button_then_data_note():
    html = HTML.read_text(encoding="utf-8")
    area = html[html.index('id="soundScanArea"'):html.index('id="imageScanArea"')]
    shelf = area.index('id="soundSessionShelf"')
    grid = area.index('id="soundSessionShelfGrid"')
    button = area.index('id="scanBtn"')
    note = area.index('id="merlinDataNote"')
    # The discovered-birds grid sits where the BirdNET note used to be; the
    # note now lives below the start button, much further down the screen.
    assert shelf < grid < button < note
    assert 'id="soundSessionShelfCount"' in area
    assert 'id="soundSessionShelfEmpty"' in area
    # The privacy/BirdNET copy itself is unchanged, just relocated.
    assert "BirdNET’s seasonal range model" in area


def test_session_shelf_renders_art_tiles_from_the_session_history():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("function renderSoundSessionShelf()")
    body = html[start:html.index("function renderSoundSessionDiscoveries(", start)]
    assert "soundDiscoveryHistory.snapshot()" in body
    assert "sound-session-tile" in body
    # Art falls back to the bird's emoji when no cached art resolves.
    assert "resolveBuiltInBirdArt(" in body
    assert "getBirdArtUrl(" in body
    # Repeat hearings badge the tile instead of duplicating it.
    assert "row.count > 1" in body
    assert "sound-session-tile-count" in body
    # Tapping a tile opens the bird in the Birdex.
    assert "showSpeciesInBirdex(" in body
    # Every add/reset re-renders the shelf via the existing session renderer.
    discoveries = html[html.index("function renderSoundSessionDiscoveries("):html.index("function setSoundDiscoveryCardFlipped(")]
    assert "renderSoundSessionShelf();" in discoveries
    # Shelf styling exists (grid + empty state swap).
    assert ".sound-session-shelf.has-birds .sound-session-shelf-grid { display:grid; }" in html
    assert ".sound-session-shelf.has-birds .sound-session-shelf-empty { display:none; }" in html


# ---------------------------------------------------------------------------
# 3. Encounter banner pops once per species per session
# ---------------------------------------------------------------------------

def test_encounter_banner_only_pops_on_first_hearing_of_a_species():
    html = HTML.read_text(encoding="utf-8")
    handle = html[html.index("function handleBirdCandidates("):html.index("function showCatalogUnmatchedRecognition(")]
    sound_branch = handle[handle.index("if (soundSession) {"):handle.index("} else {")]
    # The session history's own repeat count is the gate: count 1 = first
    # hearing this session → banner; count > 1 = the same bird again → silent.
    assert "const recorded = recordSoundSessionDiscovery(bird, isNew);" in sound_branch
    assert "if (!recorded || !(Number(recorded.count) > 1)) showScanEncounterCard(bird, isNew, opts.source);" in sound_branch
    # Photo scans (and other non-session sources) keep the banner every time.
    else_branch = handle[handle.index("} else {"):handle.index("try { questRegisterBirdEncounter(bird); }")]
    assert "showScanEncounterCard(bird, isNew, opts.source);" in else_branch
    # No unconditional call remains after the branch.
    tail = handle[handle.index("try { questRegisterBirdEncounter(bird); }"):]
    assert "showScanEncounterCard" not in tail


def test_repeat_suppression_matches_the_discovery_history_counts():
    # Drive the real createDiscoveryHistory: the first add of a species reports
    # count 1 (banner shows), every subsequent add reports count > 1 (silent).
    script = (
        "const q=require(process.argv[1]).BurbzSoundListenerCore||globalThis.BurbzSoundListenerCore;"
        "const h=q.createDiscoveryHistory();"
        "const pops=[];"
        "for(const key of['long_tailed_tit','long_tailed_tit','robin','long_tailed_tit','robin']){"
        "const rec=h.add({key,name:key,isNew:false});"
        "if(!rec||!(Number(rec.count)>1))pops.push(key);}"
        "console.log(JSON.stringify(pops));"
    )
    out = subprocess.run(
        ["node", "-e", script, str(ROOT / "sound_listener_core.js")],
        capture_output=True, text=True, check=True,
    )
    assert json.loads(out.stdout) == ["long_tailed_tit", "robin"]


# ---------------------------------------------------------------------------
# Release mechanics
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    assert OWN_RELEASE_PIN in SW.read_text(encoding="utf-8")  # lineage kept
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML.read_text(encoding="utf-8")
