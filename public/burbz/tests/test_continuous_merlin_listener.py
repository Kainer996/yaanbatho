import json
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "sound_listener_core.js"
ART = ROOT / "assets" / "ui" / "merlin-wand-listener.webp"


def run_core(script):
    source = "global.window=global; require('./sound_listener_core.js'); const q=global.BurbzSoundListenerCore; " + script
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_merlin_wand_art_is_a_real_transparent_mobile_asset():
    assert ART.exists()
    assert ART.stat().st_size > 20_000
    with Image.open(ART) as image:
        assert image.size == (768, 768)
        assert image.mode == "RGBA"
        assert image.getchannel("A").getextrema() == (0, 255)


def test_sound_screen_centres_merlin_and_his_wand_in_the_live_listener():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="merlinListenerStage"' in html
    assert 'src="assets/ui/merlin-wand-listener.webp"' in html
    assert 'id="merlinWandTip"' in html
    assert 'id="merlinListenStatus"' in html
    assert 'id="merlinListenActivity"' in html
    assert "Merlin’s wand" in html


def test_sound_tab_starts_one_continuous_listener_and_has_an_explicit_stop():
    html = HTML.read_text(encoding="utf-8")
    assert "function startContinuousSoundListening" in html
    assert "function stopContinuousSoundListening" in html
    assert "startContinuousSoundListening();" in html
    assert 'id="scanBtn"' in html
    assert '>START MERLIN’S WAND<' in html
    # The stop control lives on the listener screen; the header icon only
    # reports that listening is happening and takes you back to it.
    assert 'id="merlinListenerStage"' in html
    assert "STOP LISTENING" in html


def test_recorder_windows_rotate_without_stopping_the_microphone_stream():
    html = HTML.read_text(encoding="utf-8")
    assert "function startSoundRecorderWindow" in html
    assert "function rotateContinuousSoundWindow" in html
    assert "queueSoundWindowForAnalysis" in html
    assert "beginNextWindowBeforeAnalysis" in html
    assert "stopRecording({ autoChunk: true })" not in html
    assert "ANALYSING BIRDSONG" not in html
    assert "async function processRecording" not in html


def test_stale_permission_and_recorder_callbacks_cannot_restart_an_old_session():
    html = HTML.read_text(encoding="utf-8")
    assert "let soundListenerGeneration = 0" in html
    start = html.split("async function startContinuousSoundListening", 1)[1].split("function handleContinuousSoundTrackEnded", 1)[0]
    recorder = html.split("function startSoundRecorderWindow", 1)[1].split("function rotateContinuousSoundWindow", 1)[0]
    stop = html.split("function stopContinuousSoundListening", 1)[1].split("// Live", 1)[0]
    assert "const generation = ++soundListenerGeneration" in start
    assert "generation !== soundListenerGeneration" in start
    assert "generation === soundListenerGeneration" in recorder
    assert "soundListenerGeneration += 1" in stop


def test_switching_burbz_screens_or_camera_view_does_not_stop_listening():
    html = HTML.read_text(encoding="utf-8")
    image_handler = html.split("$('scanImageBtn').addEventListener", 1)[1].split("});", 1)[0]
    navigation = html.split("function switchScreen(name)", 1)[1].split("// ============================================================================", 1)[0]
    assert "continuousSoundScanWanted = false" not in image_handler
    assert "stopContinuousSoundListening" not in image_handler
    assert "stopContinuousSoundListening" not in navigation
    assert "updateMerlinListeningUI" in navigation
    assert 'class="merlin-listening-dock" id="merlinDockReturn"' in html


def test_browser_tab_visibility_keeps_the_stream_and_reports_background_listening():
    html = HTML.read_text(encoding="utf-8")
    handler = html.split("CONTINUOUS_MERLIN_VISIBILITY", 1)[1].split("});", 1)[0]
    assert "stopContinuousSoundListening" not in handler
    assert "Listening in the background while Burbz stays open" in handler
    assert "startSoundRecorderWindow()" in handler


def test_local_frequency_energy_is_labelled_possible_until_birdnet_confirms_species():
    html = HTML.read_text(encoding="utf-8")
    assert "Possible birdsong" in html
    assert "Bird sound picked up!" not in html
    assert "soundCandidatesReadyToUnlock(suggestions, result, windowData)" in html
    assert "handleBirdCandidates(unlockReady[0], unlockReady.slice(1)" in html
    assert "if (result && result.species)" in html
    assert "randomBird" not in html


def test_audio_upload_and_optional_location_are_disclosed_before_capture():
    html = HTML.read_text(encoding="utf-8")
    assert "Sound windows are sent to the Burbz server for bird-sound analysis" in html
    assert 'id="merlinLocationAssist" type="checkbox" checked' in html
    assert "Use my location to improve local bird matches (recommended; you can turn this off)" in html
    assert "function soundLocationAssistEnabled" in html
    assert "storedLocationPreference === null ? true : storedLocationPreference === '1'" in html
    geo = html.split("async function getCurrentPositionForBirdnet", 1)[1].split("async function uploadRecording", 1)[0]
    assert "if (!soundLocationAssistEnabled()) return null" in geo
    assert "window.__burbzSoundTestDeps?.getCurrentPosition" in geo


def test_stop_aborts_active_analysis_and_late_results_cannot_mutate_birdex():
    html = HTML.read_text(encoding="utf-8")
    analyse = html.split("async function analyseContinuousSoundWindow", 1)[1].split("function handleBirdIdentified", 1)[0]
    stop = html.split("function stopContinuousSoundListening", 1)[1].split("// Live", 1)[0]
    assert "windowData.generation" in analyse
    assert "generation !== soundListenerGeneration" in analyse
    assert "new AbortController()" in analyse
    assert "soundAnalysisAbortController.abort()" in stop
    assert "generation" in html.split("queueSoundWindowForAnalysis({", 1)[1].split("})", 1)[0]


def test_success_copy_calls_results_model_suggestions_with_window_age_not_confirmation():
    html = HTML.read_text(encoding="utf-8")
    analyse = html.split("async function analyseContinuousSoundWindow", 1)[1].split("function handleBirdIdentified", 1)[0]
    # The engine is named by the server so BirdNET and Perch both attribute the
    # result to a recogniser rather than asserting the bird was objectively there.
    assert "const engine = soundEngineLabel(result)" in analyse
    assert "engine + ' suggestion'" in analyse
    assert "soundWindowAgeCue(windowData)" in analyse
    assert "accepted.map" in analyse
    assert "/100" in analyse
    assert "engine + ' identified '" not in analyse
    assert "% confidence" not in analyse
    assert "Heard ' + result.species" not in analyse
    assert "Merlin heard" not in analyse


def test_every_sound_result_surface_calls_scores_model_scores_not_probabilities():
    html = HTML.read_text(encoding="utf-8")
    encounter = html.split("function showScanEncounterCard", 1)[1].split(
        "function renderSoundSessionDiscoveries", 1
    )[0]
    session = html.split("function renderSoundSessionDiscoveries", 1)[1].split(
        "function recordSoundSessionDiscovery", 1
    )[0]
    unmatched = html.split("function showCatalogUnmatchedRecognition", 1)[1].split(
        "// ---- Player feedback", 1
    )[0]
    assert "source === 'sound'" in encounter
    assert "/100 model score" in encounter
    assert "/100 model score" in session
    assert "source === 'sound'" in unmatched
    assert "/100 model score" in unmatched


def test_missing_engine_provenance_stays_neutral_instead_of_claiming_birdnet():
    html = HTML.read_text(encoding="utf-8")
    helper = html.split("function soundEngineLabel(result)", 1)[1].split("}", 1)[0]
    assert "result.provider" in helper
    assert "result.providerVerified !== true" in helper
    assert "SOUND_ENGINE_LABELS.unknown" in helper
    assert "birdnetv3:'BirdNET V3'" in html
    assert "birdnetv2:'BirdNET V2 (legacy)'" in html
    assert "unknown:'Bird-sound model (unverified)'" in html
    # The client must pass the server's provider through for the label to work.
    upload = html.split("async function uploadRecording", 1)[1].split("window.__burbzSoundDebug", 1)[0]
    assert "provider: data.provider" in upload
    for field in (
        "configuredProvider", "providerVerified", "fallbackUsed",
        "providerVersion", "modelSha256", "labelsSha256", "policyVersion",
        "scoreBlacklistSha256", "geoModelName", "geoModelVersion",
        "geoModelSha256", "geoLabelsSha256",
        "serverIntegrationVersion",
    ):
        assert field in upload
    debug = html.split("window.__burbzSoundDebug", 1)[1].split("// =========================================", 1)[0]
    assert "provider: lastSoundProviderMeta" in debug


def test_analysis_queue_keeps_only_the_latest_waiting_window():
    result = run_core(
        "let release; const first=new Promise(r=>release=r); const seen=[]; "
        "const queue=q.createLatestTaskQueue(async value=>{seen.push(value); if(value==='a') await first; return value;}); "
        "queue.enqueue('a'); queue.enqueue('b'); queue.enqueue('c'); "
        "setTimeout(()=>{const before=queue.snapshot(); release(); setTimeout(()=>console.log(JSON.stringify({before,after:queue.snapshot(),seen})),20);},0);"
    )
    assert result["before"] == {"active": 1, "pending": 1, "dropped": 1, "completed": 0}
    assert result["after"] == {"active": 0, "pending": 0, "dropped": 1, "completed": 2}
    assert result["seen"] == ["a", "c"]


def test_recording_filename_follows_the_browser_selected_mime_type():
    result = run_core("console.log(JSON.stringify(['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/wav',''].map(q.filenameForMime))); ")
    assert result == ["recording.webm", "recording.ogg", "recording.m4a", "recording.wav", "recording.audio"]


def test_result_age_cue_describes_the_recorded_window_not_the_current_sound():
    result = run_core(
        "console.log(JSON.stringify({"
        "aged:q.soundWindowAgeCue({endedAt:80000,durationMs:12000},100000),"
        "fresh:q.soundWindowAgeCue({endedAt:100000,durationMs:12000},100000),"
        "legacy:q.soundWindowAgeCue({},100000)"
        "}));"
    )
    assert result == {
        "aged": "sound recorded 32–20s ago",
        "fresh": "the last 12s of sound",
        "legacy": "the previous sound window",
    }


def test_queued_sound_window_carries_start_and_end_timestamps():
    html = HTML.read_text(encoding="utf-8")
    recorder = html.split("function startSoundRecorderWindow", 1)[1].split("function handleSoundRecorderFailure", 1)[0]
    assert "const startedAt = Date.now()" in recorder
    assert "const endedAt = Date.now()" in recorder
    assert "startedAt, endedAt, durationMs" in recorder


def test_listener_dependencies_are_injectable_for_real_browser_lifecycle_proof():
    html = HTML.read_text(encoding="utf-8")
    assert "function soundListenerDependencies" in html
    assert "window.__burbzSoundTestDeps" in html
    assert "deps.getUserMedia" in html
    assert "deps.MediaRecorder" in html
    assert "deps.audioContext" in html


def test_global_dock_reports_listening_while_player_uses_other_tabs():
    html = HTML.read_text(encoding="utf-8")
    # A 36px HUD button, not a panel over the map — but it must still announce
    # itself, so the label says what it is and the status is a live region.
    assert 'aria-label="Merlin is listening — open listener"' in html
    assert 'id="merlinDockStatus" aria-live="polite"' in html
    assert 'id="merlinDockReturn"' in html
    assert "currentScreen !== 'scan' || scanMode !== 'sound'" in html
    assert "Listening across Burbz" in html


def test_permission_track_end_and_api_failures_have_truthful_recoverable_states():
    html = HTML.read_text(encoding="utf-8")
    assert "Microphone permission needed" in html
    assert "Microphone unavailable" in html
    assert "listenerTrack.onended" in html
    cleanup = html.split("function handleContinuousSoundTrackEnded", 1)[1].split("function startSoundRecorderWindow", 1)[0]
    assert "clearTimeout(soundScanChunkTimer)" in cleanup
    assert "listenerTrack = null" in cleanup
    assert "mediaStream = null" in cleanup
    assert "mediaRecorder = null" in cleanup
    assert "soundAnalysisQueue.clear()" in cleanup
    assert "Listening paused by this device" in html
    assert "Sound check failed — still listening" in html
    failed_start = html.split("function cleanupFailedSoundStart", 1)[1].split("function handleContinuousSoundTrackEnded", 1)[0]
    assert "getTracks().forEach(track => track.stop())" in failed_start
    assert "listenerSourceNode.disconnect()" in failed_start
    assert "analyserNode.disconnect()" in failed_start


def test_continuous_listener_release_is_query_busted_and_cached_offline():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert 'sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729' in html
    assert './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729' in sw
    core = sw.split("const BURBZ_CORE = [", 1)[1].split("];", 1)[0]
    assert './sound_listener_core.js?v=birdnet-v3-accuracy-v5-20260729' in core
    assert './assets/ui/merlin-wand-listener.webp' in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
