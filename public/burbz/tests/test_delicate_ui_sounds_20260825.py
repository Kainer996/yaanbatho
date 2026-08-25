"""The interface sounds like wood, not like a beep.

Yaan asked for click sounds that are much more delicate and much more RPG-like.
The palette was not chosen by reading filenames — every candidate was decoded
with `decodeAudioData` in a real browser and measured. "Body" is the point by
which 90% of a sound's energy has passed; "tail" is its last sample above 1% of
peak. A tap wants its body inside about 50 ms and to be gone inside 200 ms;
what makes an interface feel heavy is a click that rings on underneath the next
one.

    sfx-ui-tap.mp3    body 111 ms   tail 999 ms   <- rang for a full second
    ui-wood.mp3       body  47 ms   tail 200 ms   <- a wooden tick, and done
    ui-lock.mp3       body  67 ms   tail 150 ms
    ui-coins.mp3      body 281 ms   tail 448 ms
    ui-spell.mp3      body 247 ms   tail 507 ms
    sfx-resource.mp3  body 726 ms                 <- far too long for a pickup

So the short, characterful pack carries the interface and the bespoke
one-second Burbz sounds keep the big moments, where a tail belongs. Levels and
a little pitch drift do the rest.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
AUDIO_CORE = (ROOT / "audio_core.js").read_text(encoding="utf-8")

# role -> the file it must play, and the measured body/tail that earned it (ms).
INTERFACE_PALETTE = {
    "tap": ("ui-wood.mp3", 47, 200),
    "unlock": ("ui-lock.mp3", 67, 150),
    "coins": ("ui-coins.mp3", 281, 448),
    "specialHit": ("ui-spell.mp3", 247, 507),
}


def manifest():
    block = AUDIO_CORE.split("var DEFAULT_SOUND_MANIFEST = Object.freeze({", 1)[1].split("});", 1)[0]
    return dict(re.findall(r"(\w+):\s*'assets/audio/([^']+)'", block))


def table(name):
    block = AUDIO_CORE.split(f"var {name} = Object.freeze({{", 1)[1].split("});", 1)[0]
    return {k: float(v) for k, v in re.findall(r"(\w+):\s*([0-9.]+)", block)}


def test_the_interface_plays_the_short_characterful_sounds():
    sounds = manifest()
    for role, (filename, body_ms, tail_ms) in INTERFACE_PALETTE.items():
        assert sounds[role] == filename, (role, sounds[role])
        assert (ROOT / "assets" / "audio" / filename).exists(), filename
        assert body_ms < 300 and tail_ms < 600, (role, body_ms, tail_ms)
    # A tap is the one that matters most: it must be the tightest sound we have.
    assert INTERFACE_PALETTE["tap"][1] < 60


def test_the_big_moments_keep_their_bespoke_burbz_sounds():
    sounds = manifest()
    for role, filename in (
        ("capture", "sfx-capture.mp3"), ("victory", "sfx-victory.mp3"),
        ("defeat", "sfx-defeat-error.mp3"), ("questComplete", "sfx-quest-complete.mp3"),
        ("build", "sfx-build.mp3"), ("defend", "sfx-battle-defend.mp3"),
        ("hit", "sfx-battle-hit.mp3"), ("page", "sfx-page-wing.mp3"),
    ):
        assert sounds[role] == filename, (role, sounds[role])
    assert sounds["levelUp"] == "reward-level-up.mp3"   # a real sting, not the generic


def test_a_tap_is_felt_more_than_heard():
    volumes = table("DEFAULT_VOLUMES")
    assert volumes["tap"] <= 0.35
    assert volumes["page"] <= 0.45
    # Clicks sit well under the moments they lead to.
    for moment in ("victory", "questComplete", "levelUp", "capture"):
        assert volumes[moment] >= volumes["tap"] * 2, moment
    # Every role in the manifest has a level, or it plays at full blast.
    for role in manifest():
        assert role in volumes, role


def test_repeated_taps_are_never_identical():
    drift = table("DEFAULT_PITCH_DRIFT")
    assert 0 < drift["tap"] <= 0.1
    # A fanfare that wobbles sounds broken, so the rewards are left alone.
    for steady in ("victory", "levelUp", "questComplete", "capture"):
        assert steady not in drift, steady
    play = AUDIO_CORE.split("function play(name, playOptions)", 1)[1].split("\n    }", 1)[0]
    assert "rate = drift > 0 ? 1 + (random() * 2 - 1) * drift : 1;" in play


def test_a_shorter_tap_can_answer_the_finger_sooner():
    cooldowns = table("DEFAULT_COOLDOWNS")
    assert cooldowns["tap"] <= 70            # was 90, against a one-second sample
    assert cooldowns["tap"] >= 40            # still cannot machine-gun


def test_the_manager_actually_applies_the_level_and_the_drift():
    script = """
const core = require('./audio_core.js');
const played = [];
let t = 0;
const m = core.createAudioManager({
  Audio: function (src) { const a = { src, play: () => Promise.resolve(), addEventListener() {}, pause() {} }; played.push(a); return a; },
  now: () => (t += 1000)
});
Promise.all(['tap', 'tap', 'tap', 'victory'].map(n => m.play(n))).then(() => {
  console.log(JSON.stringify(played.map(a => ({ src: a.src, volume: a.volume, rate: a.playbackRate }))));
});
"""
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=120)
    assert run.returncode == 0, run.stderr
    rows = json.loads(run.stdout)
    taps = [r for r in rows if r["src"].endswith("ui-wood.mp3")]
    assert len(taps) == 3
    assert all(abs(t["volume"] - 0.3) < 0.001 for t in taps)
    assert len({round(t["rate"], 4) for t in taps}) == 3        # three taps, three pitches
    assert all(0.9 < t["rate"] < 1.1 for t in taps)             # and all of them subtle
    victory = next(r for r in rows if r["src"].endswith("sfx-victory.mp3"))
    assert victory["rate"] == 1                                  # the fanfare does not wobble


def test_the_fallback_synth_is_a_struck_thing_not_a_beep():
    """When files cannot play, the interface still sounds like an instrument."""
    pluck = HTML.split("function playPluck(freq, opts) {", 1)[1].split("\nfunction ", 1)[0]
    assert "lowpass" in pluck
    assert "exponentialRampToValueAtTime(gainPeak, t0 + 0.003)" in pluck   # 3 ms attack
    assert "exponentialRampToValueAtTime(0.0001, t0 + decay)" in pluck     # then it decays
    assert "Number(o.partial) || 2.76" in pluck                           # an upper partial
    assert "Math.random() * 2 - 1" in pluck                               # detuned per strike
    fallback = HTML.split("const oscillatorSfxFallback = {", 1)[1].split("\n};", 1)[0]
    for role in ("tap()", "page()", "coins()", "unlock()", "build()"):
        assert role in fallback, role
    assert "playPluck(1180" in fallback          # the tap is a pluck now
    assert "playTone(600, 0.05, 'sine', 0.05)" not in HTML   # ...and not a bare beep


def test_every_quest_sheet_button_is_actually_styled():
    """`.wq-detail-start` is used by nine sheets and had no rule at all."""
    assert HTML.count('class="wq-detail-start"') >= 8
    rule = HTML.split(".wq-detail-start {", 1)[1].split("}", 1)[0]
    assert "display:block" in rule and "width:100%" in rule
    assert "'Russo One'" in rule
    assert ".wq-detail-start:active" in HTML
    assert ".wq-attribution {" in HTML
