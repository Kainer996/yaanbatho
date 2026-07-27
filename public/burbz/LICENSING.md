# Burbz — third-party licensing review (commercial release)

Research date: 27 July 2026. This is an engineering summary of published licence
terms, not legal advice. Confirm anything load-bearing with the licensor and,
for the BirdNET question, with a solicitor before you take money.

## 1. The blocker: BirdNET models

BirdNET ships under a **split licence**:

| Part | Licence | Commercial use |
|---|---|---|
| BirdNET-Analyzer source code | MIT | Yes, unrestricted |
| BirdNET **model weights** (all versions, V1.1 → V2.4, incl. the app model) | CC BY-NC-SA 4.0 | **No** — NonCommercial |
| Custom classifiers you train on BirdNET embeddings | CC BY-NC-SA 4.0 (inherited) | **No** |

The models page states it plainly: "All models listed here are licensed under the
Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
(CC BY-NC-SA 4.0)." The FAQ's carve-out is only that "all educational and research
purposes are considered non-commercial use" — a monetised game is not that.

Two further consequences people miss:

- **NC covers more than paid downloads.** CC's NonCommercial means "not primarily
  intended for or directed toward commercial advantage or monetary compensation".
  Ads, IAP, a paid tier, a freemium funnel, or a free app that markets a paid
  product all sit on the wrong side of that line.
- **SA is a second, separate problem.** ShareAlike bites on *adaptations* of the
  model. Fine-tuned weights or a classifier head trained on BirdNET embeddings
  would have to be released under CC BY-NC-SA 4.0 — permanently non-commercial.

Running the model server-side (as Burbz does) does not avoid this. The NC term
constrains *use*, not just redistribution.

## 2. New versions — checked, nothing changes the answer

- **BirdNET-Analyzer 2.4.0** is the current release (PyPI, uploaded 10 Nov 2025).
  Code still MIT.
- **Model V2.4** (June 2023, 6,000+ species) is still the newest published model.
- **V2.5** is discussed but unreleased. Maintainer confirms it will add non-bird
  taxa using iNatSounds data. No licence change has been announced, and adding
  iNat-derived training data makes a permissive relicence *less* likely.
- **BirdNET-Analyzer-Sierra** (fork) carries the same CC BY-NC-SA 4.0 terms.

No newer version relaxes the restriction.

## 3. Options

### Option A — get written permission from the BirdNET team
CC licences are non-exclusive; the copyright holders can grant separate commercial
terms. There is no public commercial-licence programme or price list, but the
project's showroom features commercial hardware/apps (HaikuBox, BirdWeather, Terra),
so commercial arrangements clearly exist.

Contacts:
- ccb-birdnet@cornell.edu (K. Lisa Yang Center for Conservation Bioacoustics, Cornell)
- stefan.kahl@informatik.tu-chemnitz.de (Dr Stefan Kahl, TU Chemnitz — technical contact)

Note the models are a **Cornell + TU Chemnitz** collaboration, so permission may need
to come from both institutions. Treat this as a multi-week path, not a same-week one.

### Option B — swap to Perch 2.0 (Apache 2.0) — the unblocking move
Google's Perch is **Apache 2.0 licensed, including the weights** — commercial use
permitted with attribution, no ShareAlike, no permission needed.

- Perch 2.0: ~15,000 classes (~10,000 birds plus frogs, insects, mammals) vs
  BirdNET's ~6,000 — broader coverage, and SOTA on BirdSet/BEANS benchmarks.
- EfficientNet-B3 embedding model (~12M params) + ~91M-param classification head.
- Distributed as a TF2 SavedModel via Kaggle Models
  (`google/bird-vocalization-classifier`, variation `perch_v2`); load via
  `perch_hoplite.zoo.model_configs.load_model_by_name('perch_v2')`.

**On the GPU question — it does not need one.** Google's own model card says "This
version of the model requires TensorFlow 2.20.rc0 and a GPU. A CPU variant will be
added soon", but that applies to Google's official TF SavedModel path, not to the
model itself. The backbone is a 12M-parameter EfficientNet-B3, described in the
Perch 2.0 paper as "deployable on consumer-grade hardware". For CPU serving use the
`bioacoustics-model-zoo` (MIT) exports instead:

- `bmz.Perch2ONNX` — ONNX Runtime, no TensorFlow dependency at all. Supports
  `headless=True` for an embedding-only model that is "much smaller and more
  efficient" if you train your own head over the Burbz species list.
- `bmz.Perch2LiteRT` — TFLite. Reported at roughly a 10x CPU inference speedup over
  the TensorFlow path.

The zoo notes these "may be well suited for scenarios where installing TensorFlow is
undesirable" — which describes a Node/Caddy VPS accurately. ONNX Runtime is the
recommended route: the backend is already Python, and it drops the TF 2.20 pin.

Still benchmark end-to-end latency on the VPS against the current sound-scan UX
before committing — the risk is response time under concurrent scans, not capability.

Perch has no geographic/seasonal prior equivalent to BirdNET's location filter, so
the existing Burbz "seen nearby" biasing becomes more important, not less.

### Option C — keep the Claude spectrogram path
`app/api/identify-sound/route.ts` already identifies species from a spectrogram via
the Anthropic API against the game's own species list. Commercial use is governed by
ordinary API terms — no NC problem. Weaker as a general-purpose identifier, but it is
already written, already constrained to the in-game catalogue, and is a viable
fallback or ensemble partner.

### Option D — release non-commercially
Free, no ads, no IAP, no paid tier, and BirdNET credited under CC BY-NC-SA. Legal,
but it forecloses the commercial release.

## 4. Recommendation

Run B and A in parallel. Start the Perch 2.0 port now so the release is not gated on
anyone's reply, and email Cornell/TU Chemnitz the same day — if permission arrives,
BirdNET can come back as an option rather than a dependency.

Until one of those lands, do not ship a monetised build on BirdNET.

## 5. Work items

- [ ] Email ccb-birdnet@cornell.edu and stefan.kahl@informatik.tu-chemnitz.de
      describing Burbz, the deployment (server-side inference), and the intended
      monetisation. Ask explicitly for written commercial permission.
- [ ] Audit `server.py` on the VPS: confirm which model files are installed, which
      version, and whether any custom classifier was trained on BirdNET embeddings
      (that would inherit CC BY-NC-SA and must be retrained on Perch).
- [ ] Prototype Perch 2.0 inference behind the existing `api/identify/sound`
      contract; benchmark accuracy and latency against current BirdNET results.
- [ ] Serve Perch 2.0 on CPU via `bmz.Perch2ONNX` (ONNX Runtime, no TensorFlow) and
      benchmark scan latency under concurrent load. Fall back to `Perch2LiteRT` if
      ONNX disappoints.
- [ ] Once switched, update player-facing copy — `index.html` names "BirdNET" in the
      data note, tutorial, listener states and toasts; the tests in
      `tests/test_continuous_merlin_listener.py` and
      `tests/test_scan_anti_cheat_no_manual_correction_20260715.py` assert that
      wording and will need updating with it.
- [ ] Add the Apache 2.0 attribution for Perch to the credits page.

## 6. Everything else — clean

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

- https://github.com/birdnet-team/BirdNET-Analyzer
- https://birdnet-team.github.io/BirdNET-Analyzer/faq.html
- https://birdnet-team.github.io/BirdNET-Analyzer/models.html
- https://pypi.org/project/birdnet-analyzer/
- https://github.com/birdnet-team/BirdNET-Analyzer/discussions/443
- https://github.com/birdnet-team/BirdNET-Analyzer-Sierra
- https://birdnet.cornell.edu/showroom/
- https://birdnet.cornell.edu/legal/
- https://github.com/google-research/perch
- https://huggingface.co/cgeorgiaw/Perch
- https://www.kaggle.com/models/google/bird-vocalization-classifier
- https://creativecommons.org/licenses/by-nc-sa/4.0/
- https://github.com/kitzeslab/bioacoustics-model-zoo
- https://arxiv.org/abs/2508.04665
