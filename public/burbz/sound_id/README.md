# Burbz sound recognition — swapping BirdNET for Perch 2.0

BirdNET's model weights are CC BY-NC-SA 4.0 (non-commercial), so Burbz cannot
ship a monetised build on them. Perch 2.0 is Apache 2.0 **including the
weights**. See [`../LICENSING.md`](../LICENSING.md) for the full position.

This package makes the recogniser a runtime choice rather than a rewrite.
**BirdNET is still here, still wired up, and still the default.** Nothing
changes until you set an environment variable, and rolling back is unsetting it.

| `BURBZ_SOUND_MODEL` | Engine | Commercial use |
|---|---|---|
| unset / `birdnet` | BirdNET (unchanged) | No — CC BY-NC-SA 4.0 |
| `perch` | Perch 2.0 via ONNX Runtime | Yes — Apache 2.0 |

## Install on the VPS

```bash
pip install onnxruntime numpy huggingface_hub
# optional but recommended — better resampling than the numpy fallback
pip install soxr soundfile
```

No TensorFlow, no GPU, no CUDA. The ONNX weights (~`perch_v2_no_dft.onnx`) and
`labels.csv` download once from Hugging Face and are cached. For an air-gapped
box, fetch them by hand and set `BURBZ_PERCH_ONNX_PATH` and
`BURBZ_PERCH_LABELS_PATH`.

## Wire it into server.py

Two edits. First, at start-up, hand the package the helpers it delegates to:

```python
import sound_id

sound_id.configure(
    birdnet_analyse=_analyse_recording,
    birdnet_aggregate=_aggregate_sound_detections,
    common_name_for=_common_name_for_scientific,   # optional, see below
)
```

Second, in the `/api/identify/sound` handler, replace the two-step BirdNET call

```python
detections = _analyse_recording(prepared_path, ...)
candidates = _aggregate_sound_detections(detections, allow)
```

with the provider dispatch, which returns the identical shape:

```python
candidates = sound_id.analyse(
    prepared_path, allow=allow, lat=lat, lon=lon, week=week,
)
```

`prepare_audio_for_birdnet` stays exactly as it is — Perch resamples to 32 kHz
itself. Everything downstream (`_catalog_lookup`, the private report path, the
response builder) is untouched, because both providers return

```python
[{"common_name": str, "scientific_name": str,
  "max": float, "mean": float, "n": int, "is_local": bool}, ...]
```

Finally, include the engine in the JSON response so the UI can name it:

```python
payload["provider"] = sound_id.active_provider()
```

The client defaults to "BirdNET" when the field is absent, so an un-updated
server keeps working.

### The `common_name_for` resolver

Perch predicts **scientific binomials only** (`Passer domesticus`), where
BirdNET also gave a common name. Pass a resolver that maps a binomial to the
Burbz catalogue's common name:

```python
def _common_name_for_scientific(scientific):
    entry = _catalog_lookup(scientific)
    return entry.get("common_name") if entry else None
```

Without it the scientific name is used for both fields. That still resolves,
since `_catalog_lookup` accepts either name — but players would see Latin in
the match toast, so wire the resolver up.

## Roll back

```bash
# systemctl edit burbz  ->  remove or flip the line
Environment=BURBZ_SOUND_MODEL=birdnet
systemctl restart burbz
```

Unsetting the variable is equally fine — BirdNET is the default. No code
changes, no redeploy, no client change.

There is also an automatic safety net: if Perch fails to load or throws during
a request, the call falls back to BirdNET for that request and logs the
exception, rather than failing the player's scan. Set
`BURBZ_SOUND_MODEL_FALLBACK=0` to disable that and surface errors instead —
worth doing while you are testing Perch, so failures are loud rather than
silently served by a non-commercial model.

> Watch for this before release: with the fallback on, a broken Perch install
> serves BirdNET results indefinitely and looks healthy. Check the logs and
> `provider` field in production, not just that scans succeed.

## Tuning

| Variable | Default | Notes |
|---|---|---|
| `BURBZ_PERCH_MIN_CONFIDENCE` | `0.5` | **Tune this first.** Sigmoid over logits. Perch's score scale is not BirdNET's — do not carry the old threshold across. |
| `BURBZ_PERCH_MAX_RESULTS` | `8` | Candidates returned per clip. |
| `BURBZ_PERCH_OVERLAP` | `0.0` | Window overlap 0–1. Raising it costs CPU roughly linearly and catches calls that straddle a boundary. |
| `BURBZ_PERCH_BATCH` | `8` | Windows per inference call. |
| `BURBZ_PERCH_THREADS` | auto | ONNX Runtime intra-op threads. Cap it on a shared VPS. |
| `BURBZ_PERCH_RAW_LOGITS` | off | Skip the sigmoid, for threshold calibration. |
| `BURBZ_PERCH_ONNX_PATH` / `BURBZ_PERCH_LABELS_PATH` | unset | Local checkpoints instead of Hugging Face. |

## Behaviour differences to expect

- **No geographic prior.** BirdNET biases by location and week; Perch does not.
  `lat`/`lon`/`week` are accepted and ignored by the Perch provider, and
  locality is applied only through the existing `allow` set — which makes that
  allowlist matter more than it did. Expect more out-of-range candidates if the
  allowlist is empty.
- **Broader class list.** ~14,795 classes including frogs, insects and mammals,
  against BirdNET's ~6,000 birds. Non-bird detections are now possible and will
  simply fail the catalogue lookup; if they prove noisy, filter to the
  catalogue's binomials before aggregation.
- **Thresholds are not comparable.** Recalibrate against real recordings before
  judging accuracy — a bad threshold looks exactly like a bad model.

## Attribution

Shipping Perch requires Apache 2.0 attribution. Add to the credits page:

> Bird sound identification uses **Perch 2.0** by Google Research, licensed
> under the Apache License 2.0. ONNX conversion via the Kitzes Lab
> bioacoustics-model-zoo (MIT).
