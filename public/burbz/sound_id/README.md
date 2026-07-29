# Burbz sound recognition

Burbz identifies birds with **BirdNET+ V3.0**. V3's weights are CC BY-SA 4.0 —
commercial use permitted with attribution — where V2.4's were CC BY-NC-SA 4.0
and could not ship in a monetised build. See [`../LICENSING.md`](../LICENSING.md).

The recogniser is a runtime choice, not a rewrite:

| `BURBZ_SOUND_MODEL` | Engine | Weights licence | Commercial |
|---|---|---|---|
| unset / `birdnetv3` / `birdnet` | **BirdNET V3** (default) | CC BY-SA 4.0 | Yes |
| `perch` | Perch 2.0 via ONNX Runtime | Apache 2.0 | Yes |
| `birdnetv2` | Legacy BirdNET V2.4 | CC BY-NC-SA 4.0 | **No** |

A bare `birdnet` means V3. Reaching the non-commercial V2.4 path takes the
explicit `birdnetv2`, and nothing selects it automatically — if V3 fails
mid-request the call falls back to Perch, never to V2.4. A silent fallback to a
NonCommercial model in a paid build would look exactly like everything working.

## Install on the VPS

One command does the whole thing — runtime, weights, `server.py` wiring, restart
and verification:

```bash
curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/install-birdnet-v3.sh \
  | sudo bash
```

It is idempotent and self-verifying. It backs `server.py` up before touching it,
checks the patched file compiles, restarts the service, and then posts a known
tawny owl recording at the live endpoint to confirm a real identification comes
back. `--dry-run` shows what it would do; `--rollback` restores the backup;
`--no-patch` installs the models and leaves `server.py` alone.

No TensorFlow, no PyTorch, no GPU — just `onnxruntime` and `numpy`, plus
`soxr`/`soundfile` for better resampling and non-WAV decoding.

Weights (~72 MB acoustic, ~7 MB range filter) are pinned to a Zenodo record and
SHA-256 verified, and land in `/opt/burbz/models` by default.

### Check it at any time

```bash
cd /path/to/burbz && sudo -E python3 -m sound_id.selftest -v
```

That loads the model, identifies `assets/audio/bird-tawny-owl.ogg`, asserts it
comes back as *Strix aluco*, checks that silence produces no detections rather
than NaN, and confirms the active engine's weights allow commercial use. Exit
status 0 means the recogniser is genuinely working, not merely importable.

## How it hooks into server.py

The installer appends a block to `server.py` rather than editing its middle,
which makes the change easy to read and trivial to revert. The block re-binds
the two helpers the handler already calls: `_analyse_recording` returns a token
carrying the request, and `_aggregate_sound_detections` turns that token into a
V3 identification. The originals are kept, so `BURBZ_SOUND_MODEL=birdnetv2`
still reaches the old path unchanged, and a server without those helpers is left
completely alone rather than failing to boot.

If you would rather wire it by hand, the direct form is two edits. Replace

```python
detections = _analyse_recording(prepared_path, ...)
candidates = _aggregate_sound_detections(detections, allow)
```

with

```python
candidates = sound_id.analyse(prepared_path, allow=allow, lat=lat, lon=lon, week=week)
```

and, at start-up:

```python
import sound_id
sound_id.configure(
    birdnet_analyse=_analyse_recording,        # legacy V2.4 path
    birdnet_aggregate=_aggregate_sound_detections,
    common_name_for=lambda sci: (_catalog_lookup(sci) or {}).get("common_name"),
)
```

Both providers return the shape `_aggregate_sound_detections` already produced,
so everything downstream — `_catalog_lookup`, the private report path, the
response builder — is untouched:

```python
[{"common_name": str, "scientific_name": str,
  "max": float, "mean": float, "n": int, "is_local": bool}, ...]
```

`prepare_audio_for_birdnet` also stays as it is: the provider resamples to
32 kHz itself. Include the engine in the JSON response so the UI can name it:

```python
payload["provider"] = sound_id.active_provider()
```

The client defaults to "BirdNET" when the field is absent, so an un-updated
server keeps working.

### The `common_name_for` resolver

Unlike Perch, V3 predicts a common name as well as a binomial — but its wording
is not always the game's. V3 says "Eurasian Blackbird" where the Burbz catalogue
says "Common Blackbird". The resolver lets the catalogue's own name win, so the
match toast reads like the rest of the game. Without it, V3's name is used,
which still resolves through `_catalog_lookup`.

## Tuning

| Variable | Default | Notes |
|---|---|---|
| `BURBZ_BIRDNET_V3_MIN_CONFIDENCE` | `0.15` | **Tune this first.** Upstream's own default. V3 scores are already sigmoid-activated and are *not* on V2.4's scale — do not carry the old threshold across. |
| `BURBZ_BIRDNET_V3_MAX_RESULTS` | `8` | Candidates returned per clip. |
| `BURBZ_BIRDNET_V3_OVERLAP` | `0.0` | Chunk overlap, 0–0.95. Costs CPU roughly linearly; catches calls straddling a boundary. |
| `BURBZ_BIRDNET_V3_BATCH` | `8` | Chunks per inference call. |
| `BURBZ_BIRDNET_V3_THREADS` | auto | ONNX Runtime intra-op threads. Cap it on a shared VPS — unset takes every core. |
| `BURBZ_BIRDNET_V3_BIRDS_ONLY` | on | Drops the ~1,700 frog, insect and mammal classes, which in a bird game can only crowd out a real bird. |
| `BURBZ_BIRDNET_V3_GEO` | on | Range filter. Needs lat/lon; ignored without them. |
| `BURBZ_BIRDNET_V3_GEO_THRESHOLD` | `0.01` | Occurrence probability below which a species is treated as absent. Deliberately permissive. |
| `BURBZ_BIRDNET_V3_MODEL_DIR` | `/opt/burbz/models` | Where the weights live. |
| `BURBZ_BIRDNET_V3_ONNX_PATH` / `_LABELS_PATH` | unset | Point at specific files instead. |
| `BURBZ_BIRDNET_V3_GEO_ONNX_PATH` / `_GEO_LABELS_PATH` | unset | Same, for the range filter. |
| `BURBZ_BIRDNET_V3_AUTO_DOWNLOAD` | off | Fetch missing weights on first use. Off deliberately — otherwise the first scan after a deploy waits on a 72 MB download. |
| `BURBZ_SOUND_MODEL_FALLBACK` | on | Set `0` while testing, so a broken install is loud rather than quietly served by the other engine. |

> Watch for this before release: with the fallback on, a broken V3 install
> serves Perch results indefinitely and looks healthy. Check the logs and the
> `provider` field in production, not just that scans succeed.

## Behaviour worth knowing about

- **Quiet audio used to return NaN.** The FP16 weights normalise internally, and
  a near-silent window underflows to NaN for every class. Burbz's listener
  rotates 12-second windows continuously, so this is routine, not rare. Chunks
  are peak-normalised and digital silence is skipped — which also *improves*
  accuracy: a quiet tawny owl went from 0.81 to 0.95.
- **Short clips are never padded.** V3 takes variable-length input. Padding the
  repo's 2.2 s blackbird clip to 3 s collapses Common Blackbird from 0.46 to
  0.04 and promotes American Robin to the top, so a short final chunk runs at
  its true length and a tail under 0.5 s is dropped.
- **The range filter replaces V2.4's built-in one.** Geomodel V3.0.2 scores
  12,012 species for the player's latitude, longitude and week; anything below
  the threshold is treated as absent. Verified: the same tawny owl clip is
  identified in London and filtered out in Sydney. Species the geomodel does not
  know are always kept — an unknown range is not evidence of absence. Results
  are cached per rounded location and week.
- **Locality still flows through `allow`.** The existing "seen nearby" set marks
  `is_local` and sorts local birds first, exactly as before.

## Roll back

```bash
sudo bash scripts/install-birdnet-v3.sh --rollback
```

Or, to switch engine without touching code:

```bash
# /etc/burbz-sound.env
BURBZ_SOUND_MODEL=perch      # or birdnetv2 for the legacy non-commercial path
systemctl restart burbz
```

## Attribution

CC BY-SA 4.0 requires it, and it is already on `audio-credits.html`:

> Powered by **BirdNET**. Bird sound identification uses **BirdNET+ V3.0** by
> the K. Lisa Yang Center for Conservation Bioacoustics (Cornell Lab of
> Ornithology) and Chemnitz University of Technology, with species narrowed by
> **BirdNET Geomodel V3.0.2** — both licensed CC BY-SA 4.0 and used unmodified.

Keep it there. And note the ShareAlike term: running inference is fine, but
fine-tuning these weights or training a head on their embeddings would put
CC BY-SA 4.0 on the result.
