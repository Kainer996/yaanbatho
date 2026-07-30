"""Repeated status messages must never stack into a wall of banners.

The quest route alignment retry re-fires on every MapLibre tile event
(`sourcedata`/`idle`/`styledata`). Before this fix each retry called
`startWalkingQuestFromOffer` again, which raised the same
"Mapped footpaths are still loading" toast every time — three or more identical
full-width banners piled over the header and map on a phone.

Three defences ship together:
  * showToast de-duplicates an identical message that is already on screen
    (and caps how many toasts can be visible at once);
  * automatic retries pass `{ retry: true }` so they update the quest status
    line instead of re-announcing;
  * the readiness listeners are removed once the route certifies or there is
    nothing left to align.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def html_source():
    return HTML.read_text(encoding="utf-8")


def extract(name, source=None):
    """Pull a top-level `function name(...)` (or `const name =`) body out of index.html."""
    src = source if source is not None else html_source()
    match = re.search(r"^(?:async )?function " + re.escape(name) + r"\(", src, re.M)
    assert match, "could not find " + name
    start = match.start()
    # Skip the parameter list — it may itself contain braces (destructured opts).
    i, paren = match.end() - 1, 0
    while i < len(src):
        if src[i] == "(":
            paren += 1
        elif src[i] == ")":
            paren -= 1
            if paren == 0:
                break
        i += 1
    depth, i, opened = 0, src.index("{", i), False
    while i < len(src):
        if src[i] == "{":
            depth += 1
            opened = True
        elif src[i] == "}":
            depth -= 1
            if opened and depth == 0:
                return src[start:i + 1]
        i += 1
    raise AssertionError("could not extract " + name)


TOAST_DOM_SHIM = """
let now = 0;
const timers = new Map();
let timerSeq = 0;
global.setTimeout = (fn, ms) => { timerSeq += 1; timers.set(timerSeq, { fn, at: now + ms }); return timerSeq; };
global.clearTimeout = id => { timers.delete(id); };
const advance = ms => {
  now += ms;
  [...timers.entries()].filter(([, t]) => t.at <= now).forEach(([id, t]) => { timers.delete(id); t.fn(); });
};

function makeEl() {
  const el = {
    className: '', textContent: '', dataset: {}, style: {}, offsetWidth: 1,
    children: [], parentNode: null,
    get firstChild() { return this.children[0] || null; },
    appendChild(child) { child.parentNode = this; this.children.push(child); return child; },
    removeChild(child) {
      const i = this.children.indexOf(child);
      if (i >= 0) this.children.splice(i, 1);
      child.parentNode = null;
      return child;
    },
  };
  return el;
}
const container = makeEl();
global.document = { createElement: () => makeEl() };
global.$ = id => (id === 'toastContainer' ? container : null);
const messages = () => container.children.map(c => c.textContent);
"""


def run_toast(script):
    source = html_source()
    body = TOAST_DOM_SHIM + extract("dismissToast", source) + extract("showToast", source)
    const_lines = "\n".join(
        line for line in source.splitlines()
        if re.match(r"^const TOAST_(VISIBLE_MS|MAX_VISIBLE) =", line.strip())
    )
    assert "TOAST_VISIBLE_MS" in const_lines and "TOAST_MAX_VISIBLE" in const_lines
    result = subprocess.run(
        ["node", "-e", const_lines + "\n" + body + "\n" + script],
        cwd=ROOT, text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_identical_messages_never_stack_into_multiple_banners():
    shown = run_toast(
        "for (let i = 0; i < 6; i++) { showToast('Mapped footpaths are still loading'); advance(200); }"
        "console.log(JSON.stringify(messages()));"
    )
    assert shown == ["Mapped footpaths are still loading"]


def test_repeating_a_message_keeps_it_alive_then_lets_it_expire():
    shown = run_toast(
        "showToast('still loading'); advance(2500); showToast('still loading'); advance(2500);"
        "const alive = messages(); advance(1000);"
        "console.log(JSON.stringify({ alive, after: messages() }));"
    )
    assert shown["alive"] == ["still loading"], "a refreshed toast must not vanish early"
    assert shown["after"] == [], "a toast must still expire once it stops repeating"


def test_distinct_messages_are_capped_so_they_cannot_bury_the_screen():
    shown = run_toast(
        "['a', 'b', 'c', 'd', 'e'].forEach(m => showToast(m));"
        "console.log(JSON.stringify(messages()));"
    )
    assert len(shown) <= 3
    assert shown == ["c", "d", "e"], "the newest messages survive, the oldest are dropped"


def test_automatic_alignment_retries_do_not_re_announce_the_same_status():
    src = html_source()
    body = extract("activateWalkingQuestFromOffer", src)
    assert "async function startWalkingQuestFromOffer(offer, { retry = false } = {})" in src
    assert "startWalkingQuestFromOffer(walkQuestPendingActivation, { retry: true })" in src, \
        "the tile-readiness retry must identify itself as an automatic retry"
    assert "retry ? null : setTimeout(" in body, \
        "an automatic retry never re-announces the wait, it updates the status line"
    assert "setWalkQuestAlignmentStatus(message)" in body, \
        "the pending status must still be reported on the quest sheet/HUD"
    # A blocked verdict is final, so it is announced even on an automatic retry.
    assert "if (!retry || blocked) showToast(message)" in body


def test_readiness_listeners_are_removed_once_there_is_nothing_to_align():
    src = html_source()
    assert "function uninstallWalkQuestAlignmentReadinessRetry()" in src
    install = extract("installWalkQuestAlignmentReadinessRetry", src)
    uninstall = extract("uninstallWalkQuestAlignmentReadinessRetry", src)
    for event in ("sourcedata", "idle", "styledata"):
        assert event in src
    assert "map.off(eventName, handler)" in uninstall, "listeners must actually be detached"
    assert "uninstallWalkQuestAlignmentReadinessRetry();" in install, \
        "a rebuilt map must not leave the old listeners bound"
    align = extract("alignActiveQuestRouteToMapPaths", src)
    assert "uninstallWalkQuestAlignmentReadinessRetry();" in align, \
        "a certified route must stop the tile-readiness retry loop"


def test_concurrent_tile_events_cannot_start_the_same_quest_twice():
    src = html_source()
    start = extract("startWalkingQuestFromOffer", src)
    assert "walkQuestActivationInFlight" in start
    assert "if (walkQuestActivationInFlight) return;" in start


def test_toast_banners_wrap_instead_of_spanning_the_whole_phone_screen():
    src = html_source()
    css = src[src.index(".toast-container {"):src.index("@keyframes toastIn")]
    assert "white-space: nowrap" not in css, "long messages must wrap, not run off both edges"
    assert "white-space: normal" in css
    assert "width: min(92vw, 460px)" in css
    assert "env(safe-area-inset-top" in css, "toasts must clear the header on notched phones"
