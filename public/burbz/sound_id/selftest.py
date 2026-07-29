"""Prove the installed recogniser is the exact, accuracy-gated BirdNET V3 build.

    python3 -m sound_id.selftest

Run it on the VPS after installing BirdNET V3. It loads the pinned model,
identifies the real Tawny Owl recording in ``assets/audio/``, and exercises the
known Common Blackbird recording that the preview model can confuse with
Mistle Thrush. It also checks failure modes that look like success outside:

* digital silence must produce no detections rather than NaN scores, because
  Burbz's listener rotates 12-second windows and silent ones are routine;
* the configured engine must be BirdNET V3, not merely another working engine;
* the exact model hashes and decision-policy version must match the reviewed build;
* the geographic model and high-quality audio dependencies must be installed.

Exit status is 0 on success and 1 on failure, so a deploy script can gate on
it.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
import time

PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))
BURBZ_DIR = os.path.dirname(PACKAGE_DIR)

# A real Tawny Owl (Strix aluco) field recording by W.carter, CC BY 4.0 — see
# audio-credits.html. V3 scores it around 0.95 raw (about 0.69 after Live's
# Tawny Owl multiplier), so a listener-shaped positive clears the threshold by
# a wide margin and a broken install is unambiguous.
REFERENCE_CLIPS = (
    ("assets/audio/bird-tawny-owl.ogg", "Strix aluco", "Tawny Owl"),
)
CONFUSER_CLIP = "assets/audio/bird-blackbird.ogg"
FORBIDDEN_CONFUSERS = {
    "Turdus viscivorus": "Mistle Thrush",
    "Turdus migratorius": "American Robin",
}
SELFTEST_LAT = 53.228
SELFTEST_LON = -2.598
SELFTEST_WEEK = 28
EXPECTED_POLICY_VERSION = "burbz-v3-temporal-20260729.2"
EXPECTED_INTEGRATION_VERSION = 4
EXPECTED_MODEL_SHA256 = "69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24"
EXPECTED_LABELS_SHA256 = "8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0"
EXPECTED_GEO_MODEL_SHA256 = "2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017"
EXPECTED_GEO_LABELS_SHA256 = "c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784"
EXPECTED_SCORE_BLACKLIST_SHA256 = (
    "a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366"
)
EXPECTED_SCORE_MULTIPLIERS = {
    "Common Hoopoe": 0.50,
    "Eurasian Golden Oriole": 0.50,
    "Great Cormorant": 0.50,
    "Mute Swan": 0.50,
    "Red Fox": 0.50,
    "Little Bittern": 0.50,
    "Eurasian Bittern": 0.50,
    "Eurasian Eagle-Owl": 0.80,
    "Long-eared Owl": 0.80,
    "Red Crossbill": 0.80,
    "Northern Raven": 0.75,
    "Common Moorhen": 0.66,
    "Common Pheasant": 0.10,
    "Rock Dove": 0.66,
    "Tawny Owl": 0.75,
    "Barred Owl": 0.85,
    "Great Horned Owl": 0.85,
}

GREEN, RED, YELLOW, DIM, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"


def _ok(message: str) -> None:
    print(f"  {GREEN}✔{RESET} {message}")


def _fail(message: str) -> None:
    print(f"  {RED}✘{RESET} {message}")


def _warn(message: str) -> None:
    print(f"  {YELLOW}!{RESET} {message}")


def _to_wav(source: str) -> str:
    """Decode a reference clip to a temporary WAV, as the server would."""
    import soundfile

    data, rate = soundfile.read(source, dtype="float32", always_2d=True)
    handle = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    handle.close()
    soundfile.write(handle.name, data.mean(axis=1), rate, subtype="PCM_16")
    return handle.name


def _silence_wav(seconds: float = 12.0, rate: int = 48000) -> str:
    import wave

    handle = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    handle.close()
    with wave.open(handle.name, "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(rate)
        out.writeframes(b"\x00\x00" * int(seconds * rate))
    return handle.name


def _repeated_wav(source: str, seconds: float = 12.0, gap_seconds: float = 0.8) -> str:
    """Repeat a short field clip as a realistic rotating-listener window."""
    import numpy as np
    import soundfile

    data, rate = soundfile.read(source, dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    gap = np.zeros(int(rate * gap_seconds), dtype=np.float32)
    blocks = []
    while sum(block.size for block in blocks) < int(rate * seconds):
        blocks.extend((mono, gap))
    repeated = np.concatenate(blocks)[:int(rate * seconds)]
    handle = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    handle.close()
    soundfile.write(handle.name, repeated, rate, subtype="PCM_16")
    return handle.name


def run(verbose: bool = False) -> bool:
    if BURBZ_DIR not in sys.path:
        sys.path.insert(0, BURBZ_DIR)

    import sound_id

    failures = 0
    provider = sound_id.active_provider()
    print(f"\nBurbz sound recogniser self-test — engine: {provider}\n")

    # ---------------------------------------------------------- exact engine
    if provider != "birdnetv3":
        _fail(
            f"configured engine is {provider!r}, not 'birdnetv3'. Set "
            "BURBZ_SOUND_MODEL=birdnetv3 and BURBZ_SOUND_MODEL_FALLBACK=0."
        )
        failures += 1
    else:
        _ok("configured engine is exactly birdnetv3")

    if sound_id.fallback_enabled():
        _fail(
            "sound-model fallback is enabled. Set BURBZ_SOUND_MODEL_FALLBACK=0 "
            "so a V3 failure cannot silently serve a different recogniser."
        )
        failures += 1
    else:
        _ok("sound-model fallback is disabled")

    if sound_id.is_commercial_safe(provider):
        _ok(f"{provider} weights permit commercial use")
    else:
        _fail(f"{provider} weights are not approved for a commercial Burbz build")
        failures += 1

    # ------------------------------------------------ accuracy dependencies
    try:
        import soundfile  # noqa: F401
        import soxr  # noqa: F401
    except ImportError as exc:
        _fail(
            f"accuracy dependency {exc.name!r} is missing; install soundfile "
            "and soxr before serving phone audio"
        )
        return False
    _ok("soundfile and soxr accuracy dependencies are installed")

    # ------------------------------------------------------------------ model
    try:
        from sound_id import birdnet_v3_provider as v3
        from sound_id.server_integration import INTEGRATION_VERSION

        started = time.perf_counter()
        v3.load()
        _ok(f"model loaded in {time.perf_counter() - started:.1f}s")
    except Exception as exc:
        _fail(f"model failed to load: {exc}")
        return False

    meta = v3.model_meta()
    expected_meta = {
        "modelSha256": EXPECTED_MODEL_SHA256,
        "labelsSha256": EXPECTED_LABELS_SHA256,
        "scoreBlacklistSha256": EXPECTED_SCORE_BLACKLIST_SHA256,
        "policyVersion": EXPECTED_POLICY_VERSION,
    }
    wrong_meta = {
        key: (meta.get(key), expected)
        for key, expected in expected_meta.items()
        if meta.get(key) != expected
    }
    if wrong_meta:
        _fail(f"model/policy identity mismatch: {wrong_meta}")
        failures += 1
    else:
        _ok(
            f"pinned model {meta.get('version')} and policy "
            f"{meta.get('policyVersion')} verified"
        )

    if INTEGRATION_VERSION != EXPECTED_INTEGRATION_VERSION:
        _fail(
            "server integration identity mismatch: "
            f"{INTEGRATION_VERSION!r} != {EXPECTED_INTEGRATION_VERSION!r}"
        )
        failures += 1
    else:
        _ok(f"server integration v{INTEGRATION_VERSION} verified")

    if v3.SCORE_MULTIPLIERS_BY_COMMON_NAME != EXPECTED_SCORE_MULTIPLIERS:
        _fail("score-blacklist contents differ from the reviewed 17-class map")
        failures += 1
    else:
        _ok(
            "reviewed 17-class score blacklist verified "
            f"({EXPECTED_SCORE_BLACKLIST_SHA256[:12]}...)"
        )

    # --------------------------------------------------------- identification
    for relative, scientific, common in REFERENCE_CLIPS:
        source = os.path.join(BURBZ_DIR, relative)
        if not os.path.exists(source):
            _fail(f"required reference clip is missing: {relative}")
            failures += 1
            continue

        wav = _repeated_wav(source)
        try:
            started = time.perf_counter()
            results = sound_id.analyse(
                wav,
                lat=SELFTEST_LAT,
                lon=SELFTEST_LON,
                week=SELFTEST_WEEK,
            )
            elapsed = (time.perf_counter() - started) * 1000
        finally:
            os.unlink(wav)

        served_provider = sound_id.last_served_provider()
        if served_provider != "birdnetv3":
            _fail(
                f"listener-shaped positive was served by {served_provider!r}, "
                "not the required BirdNET V3 provider"
            )
            failures += 1
        else:
            _ok("listener-shaped positive was served by BirdNET V3")

        if verbose:
            for item in results[:5]:
                print(f"      {DIM}{item['max']:.4f}  {item['scientific_name']} "
                      f"({item['common_name']}){RESET}")

        names = [item["scientific_name"] for item in results]
        if names and names[0] == scientific:
            _ok(f"{common} identified from {os.path.basename(relative)} "
                f"({results[0]['max']:.3f}, {elapsed:.0f} ms)")
        elif scientific in names:
            _warn(f"{common} found but ranked #{names.index(scientific) + 1} "
                  f"behind {names[0]}")
        else:
            _fail(f"{common} NOT identified — got {names[:3] or 'nothing'}")
            failures += 1

    # -------------------------------------------------- known false-positive
    confuser_source = os.path.join(BURBZ_DIR, CONFUSER_CLIP)
    if not os.path.exists(confuser_source):
        _fail(f"required confuser regression clip is missing: {CONFUSER_CLIP}")
        failures += 1
    else:
        variants = (
            ("short fixture", _to_wav(confuser_source)),
            ("12s repeated listener window", _repeated_wav(confuser_source)),
        )
        for description, wav in variants:
            try:
                results = v3.analyse(
                    wav,
                    lat=SELFTEST_LAT,
                    lon=SELFTEST_LON,
                    week=SELFTEST_WEEK,
                )
            finally:
                os.unlink(wav)
            names = [item["scientific_name"] for item in results]
            forbidden = [FORBIDDEN_CONFUSERS[name] for name in names if name in FORBIDDEN_CONFUSERS]
            if forbidden:
                _fail(
                    f"known Common Blackbird {description} produced forbidden "
                    f"false positive(s): {forbidden}"
                )
                failures += 1
            elif names and names[0] != "Turdus merula":
                _fail(
                    f"known Common Blackbird {description} returned an unreviewed "
                    f"top species: {names[0]}"
                )
                failures += 1
            else:
                verdict = "Common Blackbird" if names else "abstained"
                _ok(f"known confuser {description}: {verdict}, never Mistle Thrush")

    # ----------------------------------------------------------- silent input
    quiet = _silence_wav()
    try:
        results = v3.analyse(quiet)
    finally:
        os.unlink(quiet)

    if results:
        _fail(f"silence produced {len(results)} detection(s) — expected none")
        failures += 1
    else:
        _ok("12s of silence produces no detections (no NaN scores)")

    # ------------------------------------------------------------ range filter
    if v3._load_geo() is None:
        _fail(
            "range filter is not installed; production needs it to exclude "
            "species implausible for the player's place and date"
        )
        failures += 1
    else:
        geo_meta = v3.geo_model_meta()
        expected_geo_meta = {
            "modelSha256": EXPECTED_GEO_MODEL_SHA256,
            "labelsSha256": EXPECTED_GEO_LABELS_SHA256,
        }
        wrong_geo_meta = {
            key: (geo_meta.get(key), expected)
            for key, expected in expected_geo_meta.items()
            if geo_meta.get(key) != expected
        }
        if wrong_geo_meta:
            _fail(f"geographic model identity mismatch: {wrong_geo_meta}")
            failures += 1
        else:
            _ok(
                f"pinned geographic model {geo_meta.get('version')} and labels verified"
            )

    print()
    if failures:
        print(f"{RED}FAILED{RESET} — {failures} check(s) did not pass\n")
        return False
    print(f"{GREEN}All checks passed.{RESET} Sound scanning is ready.\n")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="print the full candidate list for each clip")
    args = parser.parse_args()
    return 0 if run(verbose=args.verbose) else 1


if __name__ == "__main__":
    raise SystemExit(main())
