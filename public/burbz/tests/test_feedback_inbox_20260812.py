"""The settings menu reads the Burbz inbox.

feedback-menu-v259-20260813 (renumbered from v254: raven v255 and night
mode v257 landed on main first): Send Feedback gains a sibling — a Feedback
Inbox row in Settings. It opens an in-game reader that unlocks with the
admin key (the same key and localStorage slot inbox.html uses), lists every
message players sent, and can mark them done, reopen or delete them. Yaan
can now check tester feedback without leaving the game.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
INBOX = (ROOT / "inbox.html").read_text(encoding="utf-8")
UPDATER = (ROOT.parents[1] / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")

OWN_RELEASE_PIN = "feedback-menu-keyless-v263-20260813"
CURRENT_BUILD = "arm-your-bird-v306-20260821"


def test_settings_has_the_inbox_row_next_to_send_feedback():
    assert 'id="feedbackInboxBtn"' in HTML
    assert "📥 Feedback Inbox" in HTML
    assert "Read what players have sent" in HTML
    # The reader sits directly under the send box, both styled as feedback rows.
    send = HTML.index('id="sendFeedbackBtn"')
    inbox = HTML.index('id="feedbackInboxBtn"')
    assert send < inbox < HTML.index('id="toggleSfx"')
    row = HTML[HTML.rindex("<button", 0, inbox):inbox]
    assert "settings-feedback settings-inbox" in row


def test_inbox_row_opens_the_reader_and_closes_settings():
    wiring = (
        "$('feedbackInboxBtn')?.addEventListener('click', () => { "
        "$('settingsModal')?.classList.remove('show'); "
        "try { SFX.tap(); } catch (e) {} openFeedbackInbox(); });"
    )
    assert wiring in HTML
    assert "function openFeedbackInbox()" in HTML


def test_reader_talks_to_the_admin_api_with_the_shared_key():
    # Same endpoint, header and localStorage slot as inbox.html — one unlock
    # covers the in-game reader and the full inbox page.
    assert "const FEEDBACK_INBOX_TOKEN_KEY = 'burbz_admin_token'" in HTML
    assert "'burbz_admin_token'" in INBOX
    assert "fetch('api/admin/reports', { headers: { 'X-Burbz-Admin': token() } })" in HTML
    assert "'X-Burbz-Admin': TOKEN" in INBOX
    assert "fetch('api/admin/reports/' + encodeURIComponent(id)" in HTML


def test_reader_gates_lists_and_acts():
    src = HTML[HTML.index("function openFeedbackInbox()"):HTML.index("// ====", HTML.index("function openFeedbackInbox()"))]
    # A rejected or missing key shows the gate and forgets a bad key.
    assert "renderGate('That key was rejected. Try again.')" in src
    assert "if (!token()) { renderGate(''); return; }" in src
    # Feedback only, newest first, resolved hidden until asked for.
    assert ".filter(r => r.type === 'feedback')" in src
    assert "showDone || r.status !== 'resolved'" in src
    assert "(b.createdAt || 0) - (a.createdAt || 0)" in src
    # Done / reopen / delete round-trip through the admin API.
    assert "data-inbox-act=" in src
    assert "confirm('Delete this message for good?')" in src
    # New-bird reports point at the full inbox page.
    assert 'href="inbox.html"' in src
    # Messages are escaped before they touch innerHTML.
    assert "feedbackInboxEsc(r.message || '')" in src


def test_send_path_is_still_wired():
    # The box the testers use: the send button posts multipart to api/feedback.
    assert "fetch('api/feedback', {" in HTML
    assert 'id="sendFeedbackBtn"' in HTML
    assert "function openFeedbackPrompt()" in HTML


def test_live_updater_ships_the_inbox_page():
    assert '"inbox.html"' in UPDATER


def test_release_pins():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
