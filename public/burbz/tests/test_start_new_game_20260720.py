"""Settings offers Start New Game: confirm, then restart the whole game."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def test_settings_has_a_start_new_game_row_with_confirmation():
    assert 'id="startNewGameBtn"' in HTML
    assert "Start New Game" in HTML
    start = HTML.index("function startNewGame()")
    body = HTML[start:HTML.index("\n}", start)]
    # Asks "Are you sure?" before anything is touched.
    assert "confirm('Are you sure?" in body
    # Restart clears progress while retaining the installed offline app and trailer.
    assert "?reset=1" in body


def test_reset_url_clears_progress_without_removing_the_offline_app():
    start = HTML.index("function applyResetUrlIfRequested()")
    body = HTML[start:HTML.index("\nfunction loadState", start)]
    assert "clearBurbzLocalProgress()" in body
    assert "caches.delete" not in body
    assert "reg.unregister()" not in body


def test_button_is_wired_for_tap_and_keyboard():
    assert "$('startNewGameBtn')?.addEventListener('click'" in HTML
    assert "$('startNewGameBtn')?.addEventListener('keydown'" in HTML
