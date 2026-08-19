"""The inbox unlocks from a magic link — no typing a key.

feedback-menu-keyless-v263-20260813: opening burbz/?inboxkey=… stores the
admin key on that device and scrubs it from the URL and history. Yaan taps
a link once (Ava sends it from the VPS, where the key lives) and the
Feedback Inbox just opens from then on. The server still checks the key on
every request, so testers without the link stay locked out.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")

OWN_RELEASE_PIN = "feedback-menu-keyless-v263-20260813"
CURRENT_BUILD = "tavern-flock-rounds-v286-20260819"


def test_link_key_is_adopted_then_scrubbed():
    src = HTML[HTML.index("function adoptInboxKeyFromLink()"):]
    src = src[:src.index("})();") + 5]
    # Reads the inboxkey param into the shared token slot…
    assert "params.get('inboxkey')" in src
    assert "localStorage.setItem(FEEDBACK_INBOX_TOKEN_KEY, key)" in src
    # …then leaves no trace in the address bar or history.
    assert "params.delete('inboxkey')" in src
    assert "history.replaceState" in src
    # A plain visit without the param changes nothing.
    assert "if (!key) return;" in src


def test_adoption_runs_before_the_inbox_opens():
    assert HTML.index("function adoptInboxKeyFromLink()") < HTML.index("function openFeedbackInbox()")


def test_gate_copy_offers_the_link_first():
    assert "Open your magic link, or enter the admin key once" in HTML


def test_admin_key_survives_resets_and_new_games():
    # clearBurbzLocalProgress wipes every burbz* key on fresh-start epochs,
    # Start New Game and ?reset=1 — it must spare the inbox credential, or the
    # magic link dies on any device whose epoch isn't stamped yet.
    src = HTML[HTML.index("function clearBurbzLocalProgress()"):]
    src = src[:src.index("\n}") + 2]
    assert "key !== 'burbz_admin_token'" in src


def test_server_side_lock_is_untouched():
    # Keyless means keyless FOR YAAN — every admin request still carries the
    # header and the server still answers 401 without it.
    assert "fetch('api/admin/reports', { headers: { 'X-Burbz-Admin': token() } })" in HTML


def test_release_pins():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
