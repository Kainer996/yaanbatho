# Burbz — third-party licensing review (commercial release)

First reviewed 27 July 2026; revised the same day when BirdNET V3 was found to
be licensed differently from V2.4. This is an engineering summary of published
licence terms, not legal advice. Confirm anything load-bearing with the
licensor before you take money.

## 1. The blocker, and why it is gone

The original finding was correct for the model Burbz was running: **BirdNET
V2.4's weights are CC BY-NC-SA 4.0 — NonCommercial — so a monetised build
could not ship on them.** That has not changed.

What changed the answer is that **BirdNET+ V3.0 is licensed CC BY-SA 4.0**, with
no NonCommercial term:

| Part | Licence | Commercial use |
|---|---|---|
| BirdNET-Analyzer / V3 source code | MIT | Yes |
| BirdNET **V1.1 – V2.4** model weights | CC BY-NC-SA 4.0 | **No** — NonCommercial |
| **BirdNET+ V3.0 model weights** | **CC BY-SA 4.0** | **Yes**, with attribution |
| **BirdNET Geomodel V3.0.2** weights | **CC BY-SA 4.0** | **Yes**, with attribution |
| Custom classifiers trained on V2.4 embeddings | CC BY-NC-SA 4.0 (inherited) | **No** |

Sources: the V3 repository's [`TERMS_OF_USE.md`](https://github.com/birdnet-team/birdnet-V3.0-dev/blob/main/TERMS_OF_USE.md)
and the [Zenodo record](https://zenodo.org/records/20703646), which states the
licence as Creative Commons Attribution Share Alike 4.0 International. The
geomodel weights carry their own CC BY-SA 4.0 `MODEL_LICENSE.txt`.

**Burbz now runs V3.** See [`sound_id/`](sound_id/) and its
[README](sound_id/README.md).

## 2. What you still have to honour

CC BY-SA is permissive about commerce and strict about two other things.

**Attribution (BY).** The terms require that use is credited "either through
citation or acknowledgment (e.g. 'Powered by BirdNET')". This is on
`audio-credits.html`, along with the Kahl et al. 2021 citation, a link to the
licence, and a statement that the weights are used unmodified. Do not remove it.

**ShareAlike (SA).** This bites on *adaptations of the model*, not on its
output and not on Burbz's own code. Running inference and shipping the
predictions — what Burbz does — creates no ShareAlike obligation on the game.
But if you ever **fine-tune the V3 weights, or train a classifier head on V3
embeddings** (the model exposes a 1,280-dimension embedding, so this is a
tempting way to specialise it to the Burbz species list), the resulting weights
must be released under CC BY-SA 4.0. That is a real constraint on a proprietary
release, and it is the single most likely way to walk back into a licensing
problem. Plain inference is safe; training is not.

**Prohibited uses.** The V3 terms carve out two absolute prohibitions that
override the permissive grant: the models may not be used for poaching or
facilitating illegal wildlife exploitation, nor for military applications
including surveillance or targeting. Neither is a concern for Burbz, but they
travel with the weights and would bind a licensee if the game were ever sold.

## 3. The one open risk: V3 is a developer preview

V3.0 is published as a **developer preview** (currently preview 3.1, June 2026),
and the project says models, labels and code are expected to change before the
final release. Two consequences:

- **Pin what you ship.** The installer fetches a specific Zenodo record and
  verifies SHA-256 checksums, so a silent upstream change cannot reach players
  without someone noticing. Do not switch that to "latest".
- **Re-read the terms at final release.** The licence is very unlikely to become
  *more* restrictive, but "we relied on the preview's terms" is a weak position
  if it does. Check before a paid launch, and keep a dated copy of the terms as
  they stood when you shipped.

Until the final release lands, the position is: commercially usable on the
published terms, with a preview-status caveat worth a solicitor's ten minutes
before money changes hands.

## 4. Options considered

### Option A — BirdNET V3 (chosen)
Licence-clean, and independently the better model. Already implemented.

### Option B — written permission from the BirdNET team for V2.4
No longer needed. Worth doing only if you specifically want to keep V2.4, which
there is now no reason to do. Contacts, if it ever matters:
ccb-birdnet@cornell.edu and stefan.kahl@informatik.tu-chemnitz.de. Note the
models are a Cornell + TU Chemnitz collaboration, so permission may need to come
from both.

### Option C — Perch 2.0 (Google, Apache 2.0)
Still implemented and still selectable with `BURBZ_SOUND_MODEL=perch`. Apache
2.0 including weights, no ShareAlike at all, so it is the cleanest licence of
the three and a genuine second source if V3's preview status ever becomes
awkward. Retained deliberately as the fallback engine.

### Option D — the Claude spectrogram path
`app/api/identify-sound/route.ts` identifies species from a spectrogram via the
Anthropic API against the game's own species list. Governed by ordinary API
terms, no NC problem. Weaker as a general identifier; a viable ensemble partner.

### Option E — release non-commercially
No longer necessary.

## 5. Why V3 is also the better model

Not just a licence fix — the reason to want it anyway:

| | V2.4 | V3.0 preview 3.1 |
|---|---|---|
| Classes | ~6,000 | 11,560 (9,834 birds) |
| Sample rate | 48 kHz | 32 kHz |
| Input | fixed 3 s | variable length |
| Range filter | built-in | Geomodel V3.0.2, 12,012 species |
| Extras | — | 1,280-d embeddings |

Measured on this repo's own CC BY field recordings: the tawny owl is identified
as *Strix aluco* at 0.95, and a realistic 12-second window with a blackbird
buried in noise returns *Turdus merula* correctly.

Two V3-specific behaviours are handled in the provider and are worth knowing
about, because both look like a broken model rather than a handling detail:

- **The FP16 weights return NaN for every class on near-silent audio.** The
  model normalises internally, and a quiet window underflows FP16. Burbz's
  listener rotates 12-second windows continuously, so silent windows are
  routine. Chunks are peak-normalised and digital silence is skipped.
- **Zero-padding a short clip corrupts the result.** Padding this repo's 2.2 s
  blackbird clip out to 3 s drops Common Blackbird from 0.46 to 0.04 and
  promotes American Robin — a bird from the wrong continent — to the top. V3
  takes variable-length input, so the provider never pads.

Thresholds are not comparable across versions. V3 scores are already
sigmoid-activated; upstream's own default is 0.15. Recalibrate against real
recordings rather than carrying V2.4's number across.

## 6. Work items

- [x] Establish which BirdNET versions may be used commercially.
- [x] Build V3 inference behind the existing sound-scan contract, CPU-only via
      ONNX Runtime, with Perch and the legacy V2.4 path still selectable.
- [x] Make V3 the default, and make sure a mid-request failure can never fall
      back to the NonCommercial V2.4 weights.
- [x] Add the CC BY-SA 4.0 attribution to the credits page.
- [x] Ship a server installer that pins and checksums the weights, wires
      `server.py` reversibly, and proves a known recording still identifies.
- [ ] Run `scripts/install-birdnet-v3.sh` on the VPS. **Nothing is live until
      this is done.**
- [ ] Tune `BURBZ_BIRDNET_V3_MIN_CONFIDENCE` against real recordings, and
      benchmark scan latency under concurrent load.
- [ ] Re-read the V3 terms when it leaves developer preview, before a paid
      launch.
- [ ] Confirm no custom classifier was ever trained on V2.4 embeddings; if one
      was, it inherits CC BY-NC-SA 4.0 and must be retrained on V3.

## 7. Everything else — clean

Reviewed as part of the same pass; no other commercial blockers found.

- **Audio** (`assets/audio/ATTRIBUTION.md`, `audio-credits.html`): CC0 (rubberduck,
  WobbleBoxx), CC BY 4.0 with attribution already given (Wikimedia field recordings
  by Diana Tudor and W.carter), and ElevenLabs-generated music/SFX. Commercial use is
  fine; the ElevenLabs assets remain subject to the account's plan terms — verify the
  plan carries commercial rights.
- **Textures** (`assets/tex/CREDITS.md`): ambientCG, CC0. Fine.
- **Species data**: iNaturalist and GBIF appear as *citation URLs* in the bird data
  files, not runtime API calls. No eBird API integration exists in this repo
  (apparent "ebird" matches are substrings of names like Wattlebird/Figbird).
  Factual range and diet data is not copyrightable in itself, but if any prose was
  copied verbatim from a source, rewrite it.
- **Map/geodata**: OpenStreetMap-derived content requires ODbL attribution; confirm
  the map screens carry it.

## Sources

- https://github.com/birdnet-team/birdnet-V3.0-dev
- https://github.com/birdnet-team/birdnet-V3.0-dev/blob/main/TERMS_OF_USE.md
- https://zenodo.org/records/20703646
- https://github.com/birdnet-team/geomodel
- https://huggingface.co/tphakala/BirdNET-Geomodel
- https://github.com/birdnet-team/BirdNET-Analyzer
- https://birdnet-team.github.io/BirdNET-Analyzer/models.html
- https://birdnet-team.github.io/BirdNET-Analyzer/faq.html
- https://birdnet.cornell.edu/legal/
- https://creativecommons.org/licenses/by-sa/4.0/
- https://creativecommons.org/licenses/by-nc-sa/4.0/
- https://github.com/google-research/perch
- https://github.com/kitzeslab/bioacoustics-model-zoo
