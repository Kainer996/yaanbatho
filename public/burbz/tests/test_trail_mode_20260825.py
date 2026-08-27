"""Trail Mode — Burbz notices you have gone out for a walk.

Yaan's ask: when the map sees the player moving, go straight to the real-world
questing screen, pull the camera back, and say "eyes on the trail, be careful,
you are in questing mode, this is saved" — and pay a bonus for the phone
staying in a pocket.

The whole feature turns on one judgement: IS this a walk? Getting that wrong
costs a lot in one direction. A missed walk costs nothing — the player can
still start a wander by hand. A false positive takes over the screen of someone
sitting still, so the detector is deliberately hard to convince:

* ground covered is the NET displacement of each 30-second slice, never a sum
  of consecutive hops (summing hops is what turns a phone jittering on a table
  into half a kilometre of "walking");
* every slice is discounted by the accuracy the device itself reports;
* the distance bar rises with that accuracy, so vaguer fixes demand more real
  ground;
* and anything above walking-and-running pace is a vehicle, not a wander.

These tests drive the real core over synthetic GPS traces, 300 seeds a case.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CORE = (ROOT / "trail_mode_core.js").read_text(encoding="utf-8")
OWN_RELEASE_PIN = "trail-mode-v329-20260825"

# One deterministic trace generator, shared by every sweep below. `speed` is
# metres per second of real walking; `noiseM` is how far the fix wanders on its
# own, as a random walk, which is how a stationary phone actually behaves.
TRACE_HARNESS = """
const core = require('./trail_mode_core.js');
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function sweep(speed, accuracy, noiseM, ticks, seeds) {
  let walking = 0, vehicle = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const r = rng(seed), d = core.createWalkDetector();
    let t = 0, out = null, lat = 52.4862, lon = -1.8904, dx = 0, dy = 0;
    for (let i = 0; i < ticks; i++) {
      t += 4000;
      lat += speed * 4 / 111320;
      dy += (r() - 0.5) * noiseM; dx += (r() - 0.5) * noiseM;
      dy = Math.max(-noiseM * 2, Math.min(noiseM * 2, dy));
      dx = Math.max(-noiseM * 2, Math.min(noiseM * 2, dx));
      out = d.push({ lat: lat + dy / 111320,
        lon: lon + dx / (111320 * Math.cos(lat * Math.PI / 180)), at: t, accuracy });
    }
    if (out.walking) walking++;
    if (out.vehicle) vehicle++;
  }
  return { walking, vehicle, seeds };
}
"""


def run_node(body: str):
    result = subprocess.run(
        ["node", "-e", TRACE_HARNESS + body], cwd=ROOT, text=True, capture_output=True, timeout=180
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# --- The judgement ----------------------------------------------------------

def test_a_phone_sitting_still_is_never_judged_to_be_walking():
    """Across every accuracy Burbz will accept, and 300 drift traces each."""
    out = run_node("""
console.log(JSON.stringify({
  a8:  sweep(0, 8, 8, 45, 300),
  a12: sweep(0, 12, 12, 45, 300),
  a20: sweep(0, 20, 20, 45, 300),
  a25: sweep(0, 25, 25, 45, 300)
}));
""")
    for label, row in out.items():
        assert row["walking"] == 0, (label, row)


def test_a_real_walk_is_always_recognised():
    out = run_node("""
console.log(JSON.stringify({
  dawdle: sweep(0.9, 10, 5, 45, 300),
  stroll: sweep(1.35, 8, 5, 45, 300),
  brisk:  sweep(1.9, 8, 5, 45, 300),
  jog:    sweep(3.2, 8, 5, 45, 300)
}));
""")
    for label, row in out.items():
        assert row["walking"] == 300, (label, row)


def test_a_vehicle_is_a_journey_not_a_wander():
    """Burbz must never invite someone to look at their phone while driving."""
    out = run_node("""
console.log(JSON.stringify({
  cycling: sweep(7.0, 8, 5, 45, 300),
  town:    sweep(13.9, 8, 5, 45, 300),
  fast:    sweep(27.8, 8, 5, 45, 300)
}));
""")
    for label, row in out.items():
        assert row["walking"] == 0, (label, row)
        assert row["vehicle"] == 300, (label, row)


def test_a_fix_too_vague_to_prove_anything_is_thrown_away():
    out = run_node("""
const core2 = require('./trail_mode_core.js');
const d = core2.createWalkDetector();
let out = null, t = 0;
for (let i = 0; i < 45; i++) {
  t += 4000;
  out = d.push({ lat: 52.4862 + i * 4 * 1.35 / 111320, lon: -1.8904, at: t, accuracy: 60 });
}
console.log(JSON.stringify(out));
""")
    assert out["fixes"] == 0
    assert out["walking"] is False


def test_the_distance_bar_rises_with_the_accuracy_of_the_fixes():
    out = run_node("""
const core2 = require('./trail_mode_core.js');
function required(accuracy) {
  const d = core2.createWalkDetector();
  let out = null, t = 0;
  for (let i = 0; i < 45; i++) {
    t += 4000;
    out = d.push({ lat: 52.4862 + i * 4 * 1.4 / 111320, lon: -1.8904, at: t, accuracy });
  }
  return out.requiredM;
}
console.log(JSON.stringify({ sharp: required(5), fair: required(12), vague: required(25) }));
""")
    assert out["sharp"] == 80                     # the floor, at a good fix
    assert out["fair"] < out["vague"]             # and it climbs from there
    assert out["vague"] == 150                    # 25 m accuracy => 150 m of ground


def test_out_of_order_and_repeated_fixes_cannot_poison_the_window():
    out = run_node("""
const core2 = require('./trail_mode_core.js');
const d = core2.createWalkDetector();
d.push({ lat: 52.4862, lon: -1.8904, at: 10000, accuracy: 8 });
d.push({ lat: 52.5000, lon: -1.8904, at: 9000, accuracy: 8 });   // older than the last
d.push({ lat: 52.6000, lon: -1.8904, at: 10000, accuracy: 8 });  // same instant
console.log(JSON.stringify(d.read()));
""")
    assert out["fixes"] == 1
    assert out["walking"] is False


# --- The pocket bonus -------------------------------------------------------

def test_the_pocket_bonus_pays_for_the_phone_being_away():
    out = run_node("""
const core2 = require('./trail_mode_core.js');
console.log(JSON.stringify({
  none:  core2.pocketBonus(0, 20 * 60000),
  brief: core2.pocketBonus(20 * 1000, 20 * 60000),
  half:  core2.pocketBonus(10 * 60000, 20 * 60000),
  all:   core2.pocketBonus(20 * 60000, 20 * 60000),
  over:  core2.pocketBonus(40 * 60000, 20 * 60000)
}));
""")
    assert out["none"]["multiplier"] == 1 and out["none"]["earned"] is False
    assert out["brief"]["multiplier"] == 1        # under a minute is not a bonus
    assert out["half"]["multiplier"] == 1.25
    assert out["all"]["multiplier"] == 1.5
    assert out["over"]["multiplier"] == 1.5       # never more than the cap


# --- The wiring -------------------------------------------------------------

def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start, name
    return HTML[start:end]


# INVERTED by walk-detection-removed-v334-20260827: the detector fired in
# cars and vans and took the screen over while Yaan was driving at work, so
# the game no longer watches the position stream for a walk at all. These
# tests used to pin the auto-detection wiring; they now pin its absence.
# The pure detector stays in trail_mode_core.js (untested code is shipped
# above), and the pocket-time Trail Bonus below survives — it pays for a
# wander the player chose to start.

def test_the_position_stream_never_reaches_a_walk_detector():
    assert "trailModeOnPositionFix" not in HTML
    assert "createWalkDetector" not in HTML  # the game never builds one


def test_nothing_opens_questing_by_itself():
    assert "enterTrailMode" not in HTML
    assert "openTrailModeSheet" not in HTML
    assert "Eyes on the trail" not in HTML
    assert "Burbz sees you walking" not in HTML
    # A wander starts from the player's own button and nowhere else.
    start_fn = function_source("startSideQuest")
    assert "opts" not in start_fn


def test_the_dead_settings_toggle_is_gone_too():
    assert 'id="toggleTrailMode"' not in HTML
    assert "gameState.settings.trailMode" not in HTML


def test_pocket_time_counts_only_while_the_screen_is_away():
    accrue = function_source("trailPocketAccrue")
    assert "trailPocketSince" in accrue
    assert "active.pocketMs" in accrue
    changed = function_source("trailPocketVisibilityChanged")
    assert "if (document.hidden) {" in changed
    assert "if (sideQuestActive()) trailPocketSince = Date.now();" in changed
    assert "document.addEventListener('visibilitychange', trailPocketVisibilityChanged);" in HTML
    # And it is paid at the end of the wander, on top of the distance cap.
    end = HTML.split("async function endSideQuest() {", 1)[1].split("\nfunction ", 1)[0]
    assert "trailPocketAccrue();" in end
    assert "const xp = Math.round(baseXp * pocket.multiplier);" in end
    assert "TRAIL BONUS ×" in end


def test_release_is_pinned_and_the_new_core_is_precached():
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    pin = f"trail_mode_core.js?v={OWN_RELEASE_PIN}"
    assert f'<script src="{pin}"></script>' in HTML
    assert sw.count(f"'./{pin}'") == 2
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert (ROOT / "trail_mode_core.js").exists()
    # The core stays pure: no DOM, no game globals, so the sweeps above are real.
    # Prose is not code — the comments talk about the rolling "window" quite
    # legitimately, so they are stripped before the check.
    code = re.sub(r"/\*.*?\*/", "", CORE, flags=re.S)
    code = re.sub(r"//[^\n]*", "", code)
    for forbidden in ("document.", "window.", "gameState", "localStorage"):
        assert forbidden not in code, forbidden
