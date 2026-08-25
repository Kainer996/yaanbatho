"""The Scan screen leads with sound, and Merlin's painting carries no text.

Burbz opens on the Scan screen with Merlin's wand ready to listen. Both mode
buttons keep to the left, clear of the falcon perched against the right edge,
and the listener panel that used to sit across his portrait is gone.

START MERLIN'S WAND follows the painting directly. The button already says what
the wand is doing — START, OPENING MICROPHONE…, STOP LISTENING — so the state
line behind it is a live region for screen readers and shows on screen only
when something has gone wrong and the player needs to read why.

The microphone is never opened by landing here. It still takes the player's own
tap on Sound or on START MERLIN'S WAND.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")

MERLIN_PERCH_WIDTH_PX = 108   # .merlin-perch-assembly, pinned to the right edge


def scan_screen_markup() -> str:
    return HTML.split('id="screen-scan"', 1)[1].split('<!-- BIRD PHOTO CROPPER', 1)[0]


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start, name
    return HTML[start:end]


def test_the_scan_screen_opens_on_sound():
    markup = scan_screen_markup()
    assert '<button class="scan-mode-btn active" id="scanSoundBtn"' in markup
    assert '<button class="scan-mode-btn" id="scanImageBtn"' in markup
    assert '<div id="soundScanArea">' in markup
    assert '<div id="imageScanArea" style="display:none;">' in markup
    # The screen no longer boots into the camera view.
    assert '<div class="screen" id="screen-scan" data-scan-path="camera-only">' in HTML
    assert "let scanMode = 'sound';" in HTML


def test_sound_comes_before_camera_in_the_toggle():
    markup = scan_screen_markup()
    toggle = markup.split('class="scan-mode-toggle"', 1)[1].split("</div>", 1)[0]
    assert toggle.index('id="scanSoundBtn"') < toggle.index('id="scanImageBtn"')


def test_both_mode_buttons_keep_clear_of_merlins_perch():
    css = HTML.split(".scan-mode-toggle {", 1)[1].split("}", 1)[0]
    assert "justify-content: flex-start" in css
    assert "width: fit-content" in css
    reserved = int(re.search(r"max-width: calc\(100% - (\d+)px\)", css).group(1))
    assert reserved >= MERLIN_PERCH_WIDTH_PX
    button = HTML.split(".scan-mode-btn {", 1)[1].split("}", 1)[0]
    # Buttons size to their words instead of stretching across the screen.
    assert "flex: 0 0 auto" in button


def test_merlins_listener_art_carries_no_text():
    assert 'class="merlin-listener-copy"' not in HTML
    assert "merlin-listener-kicker" not in HTML
    assert "merlin-listener-privacy" not in HTML
    stage = HTML.split('id="merlinListenerStage"', 1)[1].split("</div>", 1)[0]
    assert "merlinListenStatus" not in stage
    assert 'id="merlinListenStatus"' in HTML
    assert 'id="merlinListenActivity"' in HTML
    # The microphone disclosure stays on the screen, under the start button.
    note = HTML.split('id="merlinDataNote"', 1)[1].split("</div>", 1)[0]
    assert "Microphone active only while the green listening light is shown" in note
    assert "Sound windows are sent to the Burbz server for bird-sound analysis" in note


def test_the_start_button_stands_where_the_ready_to_listen_line_was():
    area = HTML.split('id="soundScanArea"', 1)[1].split('id="imageScanArea"', 1)[0]
    assert area.index('id="merlinListenerStage"') < area.index('id="scanBtn"') < area.index('id="waveformContainer"')
    assert 'class="scan-btn scan-btn-lead" id="scanBtn"' in area


def test_the_state_line_is_silent_on_screen_until_something_goes_wrong():
    line = HTML.split(".merlin-listener-line {", 1)[1].split("}", 1)[0]
    # Off-screen for sighted players, still announced by aria-live.
    assert "clip-path:inset(50%)" in line
    assert 'aria-live="polite"' in HTML.split('id="merlinListenStatus"', 1)[0][-120:] \
        or 'id="merlinListenStatus" aria-live="polite"' in HTML
    shown = HTML.split(".merlin-listener-line.is-error {", 1)[1].split("}", 1)[0]
    assert "position:static" in shown and "clip-path:none" in shown
    # Two of the listener's error paths raise no toast, so the class must be
    # driven by the real listener state.
    ui = HTML.split("function updateMerlinListeningUI() {", 1)[1].split("\nfunction ", 1)[0]
    assert "$('merlinListenerLine')?.classList.toggle('is-error', soundListenerState === 'error')" in ui


def test_the_game_lands_on_the_sound_tab_without_opening_the_microphone():
    landing = function_source("landOnSoundScanScreen")
    assert "switchScreen('scan')" in landing
    assert "startContinuousSoundListening" not in landing
    # A walk already underway keeps the map.
    assert "sideQuestActive()" in landing
    assert "activeWalkingQuest()" in landing
    # init() is the last function in the file, so read it to the end.
    init = HTML.split("function init() {", 1)[1]
    assert "landOnSoundScanScreen();" in init
