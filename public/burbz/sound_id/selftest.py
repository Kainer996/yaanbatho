"""Prove the installed recogniser actually identifies a known bird.

    python3 -m sound_id.selftest

Run it on the VPS after installing BirdNET V3. It loads the model, identifies
the tawny owl recording that ships in ``assets/audio/`` — a real field
recording of *Strix aluco* — and fails loudly if the answer is wrong. It also
checks the two failure modes that look like success from the outside:

* digital silence must produce no detections rather than NaN scores, because
  Burbz's listener rotates 12-second windows and silent ones are routine;
* the active engine must be one whose weights allow commercial use.

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
# audio-credits.html. V3 scores it around 0.95, so a correct install clears the
# threshold by a wide margin and a broken one is unambiguous.
REFERENCE_CLIPS = (
    ("assets/audio/bird-tawny-owl.ogg", "Strix aluco", "Tawny Owl"),
)

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


def run(verbose: bool = False) -> bool:
    if BURBZ_DIR not in sys.path:
        sys.path.insert(0, BURBZ_DIR)

    import sound_id

    failures = 0
    provider = sound_id.active_provider()
    print(f"\nBurbz sound recogniser self-test — engine: {provider}\n")

    # ---------------------------------------------------------------- licence
    if sound_id.is_commercial_safe(provider):
        _ok(f"{provider} weights permit commercial use")
    else:
        _fail(
            f"{provider} is the NON-COMMERCIAL BirdNET V2.4 path. Unset "
            "BURBZ_SOUND_MODEL or set it to birdnetv3."
        )
        failures += 1

    # ------------------------------------------------------------------ model
    try:
        from sound_id import birdnet_v3_provider as v3

        started = time.perf_counter()
        v3.load()
        _ok(f"model loaded in {time.perf_counter() - started:.1f}s")
    except Exception as exc:
        _fail(f"model failed to load: {exc}")
        return False

    try:
        import soundfile  # noqa: F401
    except ImportError:
        _warn("soundfile is not installed, so the identification check is skipped")
        _warn("install it with: pip install soundfile")
        return failures == 0

    # --------------------------------------------------------- identification
    for relative, scientific, common in REFERENCE_CLIPS:
        source = os.path.join(BURBZ_DIR, relative)
        if not os.path.exists(source):
            _warn(f"reference clip missing, skipping: {relative}")
            continue

        wav = _to_wav(source)
        try:
            started = time.perf_counter()
            results = v3.analyse(wav)
            elapsed = (time.perf_counter() - started) * 1000
        finally:
            os.unlink(wav)

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
        _warn("range filter not installed — identification works, but results "
              "are not narrowed by location")
    else:
        _ok("range filter loaded")

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
