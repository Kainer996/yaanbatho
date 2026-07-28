"""Listening-session discoveries persist, quiz pacing, and discover-not-capture.

Three player reports from the same session of play:

1. The Bird Wisdom Check fired after EVERY claimed errand — and during the
   tutorial it opened underneath Merlin's dim, covering the parts of the
   screen the lesson needed. It now asks at most once every ten claims and
   never while a lesson is running (the counter holds, so the question waits
   its turn).

2. A long sound listen found several species and then they vanished from the
   "Discoveries this listen" sheet. The sheet was reset on every mic START,
   and a device-forced pause (screen lock, phone call) restarts the mic
   through that same path. The list now survives restarts and clears only on
   the player's own STOP — every bird is already in the Birdex on arrival.

3. Burbz DISCOVERS birds; it never "captures" them. The tutorial and the
   guided quest chain now use the game's own language.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def _slice(html, start_marker, end_marker):
    start = html.index(start_marker)
    return html[start:html.index(end_marker, start)]


def test_quest_quiz_asks_once_every_ten_claims():
    html = HTML.read_text(encoding="utf-8")
    assert "const QUEST_QUIZ_EVERY = 10;" in html
    body = _slice(html, "function maybeOpenQuestKnowledgeQuiz(", "\nfunction ")
    assert "quiz.claimsSinceQuiz = (Number(quiz.claimsSinceQuiz) || 0) + 1;" in body
    assert "if (quiz.claimsSinceQuiz < QUEST_QUIZ_EVERY) { saveState(); return; }" in body
    # An eligible quiz consumes the counter…
    assert "quiz.claimsSinceQuiz = 0;" in body


def test_quest_quiz_never_opens_over_merlins_lessons():
    html = HTML.read_text(encoding="utf-8")
    body = _slice(html, "function maybeOpenQuestKnowledgeQuiz(", "\nfunction ")
    # …but a lesson holds the counter at ten instead of consuming it, so the
    # question fires on the first claim after the lesson ends.
    assert "if (typeof merlinTutActive !== 'undefined' && merlinTutActive) { saveState(); return; }" in body
    # The 950ms delay re-checks, in case a chapter started in the meantime.
    assert "if (typeof merlinTutActive !== 'undefined' && merlinTutActive) return;" in body
    # The tutorial errand still never quizzes at all.
    assert "if (q.templateId !== 'merlin_first_flight') maybeOpenQuestKnowledgeQuiz(advanced, coins);" in html


def test_session_discoveries_survive_mic_restarts_and_clear_on_user_stop():
    html = HTML.read_text(encoding="utf-8")
    # The start path renders the (possibly surviving) list but never resets it.
    start_body = _slice(html, "async function startContinuousSoundListening()", "\nfunction ")
    assert "soundDiscoveryHistory.reset()" not in start_body
    assert "renderSoundSessionDiscoveries();" in start_body
    # The one gameplay reset left is the player's own STOP.
    stop_body = _slice(html, "function stopContinuousSoundListening(", "\nfunction ")
    assert "if (opts.userStop) { soundDiscoveryHistory.reset(); soundDiscoveryFlippedKeys.clear(); renderSoundSessionDiscoveries(); }" in stop_body
    # A device-forced pause keeps the list for the resume.
    ended_body = _slice(html, "function handleContinuousSoundTrackEnded(", "\nfunction ")
    assert "soundDiscoveryHistory.reset()" not in ended_body
    # The stop button is a genuine user stop.
    assert "stopContinuousSoundListening({ userStop:true })" in html


def test_session_list_has_no_cap_and_rerenders_on_return_to_scan():
    html = HTML.read_text(encoding="utf-8")
    core = (ROOT / "sound_listener_core.js").read_text(encoding="utf-8")
    history = _slice(core, "function createDiscoveryHistory()", "\n  root.")
    # Every species stays: the history dedupes by key and never truncates.
    assert "slice(" not in history and "shift(" not in history and "pop(" not in history
    # Reopening the Sound tab redraws whatever the session has found so far.
    sound_mode = _slice(html, "function showSoundScanMode()", "\nfunction ")
    assert "renderSoundSessionDiscoveries();" in sound_mode


def tutorial_and_chain_copy():
    html = HTML.read_text(encoding="utf-8")
    steps = _slice(html, "const MERLIN_TUTORIAL_STEPS = [", "\n];")
    quests = _slice(html, "const PLAYER_QUESTS = [", "\n];")
    return steps, quests


def test_burbz_discovers_birds_it_never_captures_them():
    steps, quests = tutorial_and_chain_copy()
    assert "captur" not in steps.lower()
    assert "captur" not in quests.lower()
    # The replacement language is the game's own.
    assert "Discover real birds" in steps
    assert "Every discovery is added to your Birdex." in steps
    assert "A discovered bird is not yours yet." in steps
    assert "The Barracks recruits discovered birds" in steps
    assert "desc:'Use Scan to discover any real bird'" in quests


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "discoveries-quiz-pacing-v152-20260728" in sw
