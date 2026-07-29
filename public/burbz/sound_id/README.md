# Burbz sound recognition

Burbz uses **BirdNET+ V3.0** and, in production, is configured to fail closed
rather than silently swap to another recogniser. V3's pinned weights are
CC BY-SA 4.0, so commercial use is permitted with attribution. The legacy
BirdNET V2.4 weights are NonCommercial and must not serve a monetised build.
See
[`../LICENSING.md`](../LICENSING.md).

The network score is only the first layer. BirdNET scores are not calibrated
statements such as “90% probability this bird is present,” and a single strong
three-second activation is not enough to unlock a game character.

## Why the Mistle Thrush false positive happened

The exact garden incident cannot be replayed from screenshots; the original
audio is required for a definitive acoustic explanation. The code and pinned
model did expose several concrete causes:

- Burbz accepted a `0.15` one-window maximum from a 12-second recording.
- It peak-normalised every chunk, which strengthened the Mistle Thrush score on
  a reviewed reference clip.
- It used non-overlapping chunks, had no temporal-support rule, defaulted
  location assistance off, and discarded every accepted species except the
  first in the browser.
- It paired an 11,560-class acoustic model with a different 12,012-class
  geomodel; 493 acoustic bird classes had no geographic mapping but still
  received the permissive geo-present threshold.
- The old installer appended its hook after `app.run()`. In the live server
  shape that block could never execute, while a weak endpoint check could still
  report success from the legacy recogniser.
- The exact pinned V3 model itself ranks Mistle Thrush above Burbz's attributed
  Common Blackbird fixture. Repeating that fixture in a listener-sized window
  also activated American Robin. This is a real model confuser, not a shifted
  label file.

Great Tit and Common Chaffinch can sound together in one recording. A
single-label maximum can turn overlapping harmonics, phone processing,
reverberation, and background sound into a strong third-class activation. That
is the most plausible explanation for the reported mixture, but it remains an
inference until the original recording is available.

## Accuracy policy

The current policy is `burbz-v3-temporal-20260729.2`:

1. Decode with `soundfile` and band-limit resampling with `soxr`.
2. Keep the waveform's natural level; reject digital and near-silence by RMS.
3. Analyse 3-second windows with 50% overlap.
4. Pool a rolling five-window history with Log-Mean-Exp (`alpha=5`).
5. Require support in at least two windows, except a near-certain `0.98` latest
   window.
6. Require `0.35` only for classes actually mapped by valid geographic
   filtering, `0.60` without it or for an unmapped class, and `0.98` for a
   genuinely single-window recording.
7. For Mistle Thrush, require at least two raw windows at `0.90` inside the
   rolling history (or one near-certain `0.98` window). This rejects the known
   confuser without imposing a `0.90` pooled threshold that rejects real Mistle
   Thrush recordings.
8. Apply BirdNET Live's exact 17-class score-suppression list after pooling,
   while keeping temporal support based on unmodified raw windows.
9. Apply BirdNET Geomodel V3.0.2 at `0.03` when the player shares location;
   an acoustic class without an exact scientific-name mapping keeps the
   stricter `0.60` floor.
10. Return every independently accepted species, ranked by evidence; locality
   only breaks ties.
11. Let the continuous listener surface up to four unique accepted catalogue
    species from the same recording instead of forcing one winner.
12. Keep suggestions separate from irreversible Birdex rewards. Exact verified
    V3 provenance is mandatory; an unlock needs `0.98` immediately, or `0.75`
    with server temporal support, while a supported `0.60–0.749` suggestion
    must recur in two distinct listener windows within 60 seconds.

The safe result for ambiguous audio is **no unlock**. The UI calls outputs
“suggestions,” shows their `/100 model score`, names simultaneous suggestions,
and tells the player how old the analysed recording is.

This follows the public shape of the
[BirdNET Live inference engine](https://birdnet-team.github.io/birdnet-live-app/developer/inference-engine/)
while adding Burbz-specific precision gates for automatic game rewards.

BirdNET Live's aligned 9,789-class pair was tested too. It produced the same
scores on every shared UK regression but pruned 944 bird classes from the 11K
acoustic model, including four spawnable Australian species in Burbz. Keeping
the broader V3 model plus the per-unmapped-class `0.60` safeguard preserves
global recall without weakening this incident's precision.

## What Merlin adds beyond a classifier

Cornell's public description of Merlin Sound ID documents a stack around its
neural network:

- a curated spectrogram classifier trained on bird sounds and explicit
  non-bird/background examples;
- precise expert time-frequency annotations that avoid teaching the model that
  unrelated background belongs to the labelled bird;
- iterative expert review and field testing;
- place-and-date likelihood from eBird to narrow plausible species;
- simultaneous, time-localised suggestions rather than one winner for the
  entire recording;
- reference recordings, range, habitat, and a human confirmation step.

Sources:
[Merlin Sound ID overview](https://merlin.allaboutbirds.org/merlin-sound-id-project-overview/),
[behind the scenes](https://www.macaulaylibrary.org/2021/06/22/behind-the-scenes-of-sound-id-in-merlin/),
and [Sound ID best practices](https://support.ebird.org/en/support/solutions/articles/48001214056-merlin-sound-id-best-practices).

Burbz now implements the layers available around BirdNET V3—temporal evidence,
place/date filtering, multi-bird results, abstention, provenance, diagnostics,
and reviewed regression gates. It does not claim to reproduce Merlin's private
training data, unpublished model internals, or every BirdNET Live
post-processing rule.

## Install on the VPS

Deploy the current Burbz files first, then run:

```bash
curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/install-birdnet-v3.sh \
  | sudo bash
```

The installer is idempotent and transactional for the backend integration. It:

- installs the mandatory ONNX/audio runtime;
- downloads and SHA-256 verifies the pinned acoustic and geographic assets;
- detects the live server's direct or aggregate sound-handler contract;
- inserts the tested adapter before `app.run()`;
- sets `BURBZ_SOUND_MODEL=birdnetv3` and disables fallback;
- restarts the backend;
- proves the live response came from the exact V3 model and policy;
- checks a Tawny Owl positive, the known blackbird confuser, and request-local
  provenance;
- restores the previous server, environment, and systemd drop-in if proof
  fails.

Weights land in `/opt/burbz/models` by default. No TensorFlow, PyTorch, GPU, or
audio retention is required.

### Run the gate at any time

```bash
cd /path/to/burbz
sudo -E python3 -m sound_id.selftest -v
```

The gate requires:

- the active provider to be exactly `birdnetv3`;
- the reviewed acoustic and label hashes and current decision-policy version;
- `soundfile`, `soxr`, and the pinned geographic range model;
- correct Tawny Owl identification in a listener-shaped 12-second window;
- no Mistle Thrush or American Robin result from short and repeated known
  Common Blackbird audio;
- no result from 12 seconds of silence.

Exit status `0` means every check passed. A missing fixture or range model is a
failure, not a skipped proof.

## Server integration and provenance

`server_patcher.py` inspects the live handler with Python's AST and selects one
of two tested adapters:

- **direct:** the route consumes raw `_analyse_recording` detections itself;
- **aggregate:** the route calls `_aggregate_sound_detections`.

The adapter preserves multiple accepted candidates and adds request-local
provenance to every response:

```json
{
  "provider": "birdnetv3",
  "configuredProvider": "birdnetv3",
  "fallbackUsed": false,
  "providerVerified": true,
  "providerVersion": "3.0-preview3.1",
  "modelSha256": "69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24",
  "labelsSha256": "8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0",
  "scoreBlacklistSha256": "a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366",
  "geoModelName": "BirdNET+ Geomodel V3.0.2 Global 12K FP16",
  "geoModelVersion": "3.0.2",
  "geoModelSha256": "2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017",
  "geoLabelsSha256": "c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784",
  "policyVersion": "burbz-v3-temporal-20260729.2",
  "serverIntegrationVersion": 4
}
```

Malformed requests report `provider: null`; they cannot inherit the previous
request's engine. The browser treats missing or mismatched provenance neutrally
instead of claiming that BirdNET answered, and never lets an unverified result
change the player's Birdex.

## Tuning

| Variable | Default | Purpose |
|---|---:|---|
| `BURBZ_BIRDNET_V3_MIN_CONFIDENCE` | `0.35` | Base evidence threshold. |
| `BURBZ_BIRDNET_V3_NO_GEO_MIN_CONFIDENCE` | `0.60` | Precision floor when place/date filtering is unavailable or a class has no geomodel mapping. |
| `BURBZ_BIRDNET_V3_SINGLE_WINDOW_CONFIDENCE` | `0.98` | Floor when temporal confirmation is impossible. |
| `BURBZ_BIRDNET_V3_VERY_HIGH_CONFIDENCE` | `0.98` | Immediate single-window exception in a longer recording. |
| `BURBZ_BIRDNET_V3_MISTLE_THRUSH_MIN_CONFIDENCE` | `0.90` | Raw high-window cutoff for the reviewed Mistle Thrush confuser. |
| `BURBZ_BIRDNET_V3_MISTLE_THRUSH_MIN_HIGH_WINDOWS` | `2` | High Mistle windows required in one rolling history. |
| `BURBZ_BIRDNET_V3_OVERLAP` | `0.50` | Fractional overlap between 3-second windows. |
| `BURBZ_BIRDNET_V3_TEMPORAL_ALPHA` | `5.0` | Log-Mean-Exp pooling sharpness. |
| `BURBZ_BIRDNET_V3_TEMPORAL_MAX_WINDOWS` | `5` | Rolling evidence-history length. |
| `BURBZ_BIRDNET_V3_MIN_SUPPORT_WINDOWS` | `2` | Required temporally supporting windows. |
| `BURBZ_BIRDNET_V3_SUPPORT_THRESHOLD_FRACTION` | `0.60` | Support threshold relative to the decision threshold. |
| `BURBZ_BIRDNET_V3_SUPPORT_THRESHOLD_FLOOR` | `0.25` | Absolute support threshold floor. |
| `BURBZ_BIRDNET_V3_GEO_THRESHOLD` | `0.03` | Minimum place/week occurrence score. |
| `BURBZ_BIRDNET_V3_MIN_RMS` | `0.0001` | Near-silence guard. |
| `BURBZ_BIRDNET_V3_MAX_RESULTS` | `8` | Server-side accepted candidate cap. |
| `BURBZ_BIRDNET_V3_BIRDS_ONLY` | on | Exclude non-bird classes from the bird game. |
| `BURBZ_BIRDNET_V3_VERIFY_HASHES` | on | Refuse mismatched weights or labels. |
| `BURBZ_BIRDNET_V3_DIAGNOSTICS` | off | Log scores/support/timing without retaining audio. |
| `BURBZ_SOUND_MODEL_FALLBACK` | on in the library; `0` in production | Production must prove V3 rather than silently swap engines. |

Threshold changes must be validated on labelled recordings from the same
phones and environments players use. BirdNET Analyzer explicitly cautions that
confidence thresholds are dataset- and model-dependent:
[segment review guidance](https://birdnet-team.github.io/BirdNET-Analyzer/best-practices/segment-review.html).

## Player location and privacy

Location assistance is recommended and on by default, but the browser still
asks the player for permission and preserves an explicit opt-out. Coordinates
are used for the request's range filter. If they are unavailable, Burbz raises
the acoustic threshold to `0.60`; it does not pretend geographic evidence was
applied.

## Attribution

Keep the existing credit on `audio-credits.html`:

> Powered by **BirdNET**. Bird sound identification uses **BirdNET+ V3.0** by
> the K. Lisa Yang Center for Conservation Bioacoustics (Cornell Lab of
> Ornithology) and Chemnitz University of Technology, with species narrowed by
> **BirdNET Geomodel V3.0.2**.

Plain inference requires attribution. Fine-tuning these weights or training a
head on their embeddings may create an adaptation subject to CC BY-SA 4.0.
