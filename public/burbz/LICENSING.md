# Burbz — third-party licensing review (commercial release)

First reviewed 27 July 2026; updated 29 July 2026 during the BirdNET V3
accuracy audit. This is an engineering summary of published licence terms, not
legal advice. Confirm anything load-bearing with the licensor before taking
money.

## 1. The original blocker, and why it is gone

BirdNET V2.4's weights are **CC BY-NC-SA 4.0 — NonCommercial**. A monetised
Burbz build must never serve them.

Burbz instead pins the separate BirdNET+ V3.0 preview 3.1 Global 11K weights
published on
[Zenodo record 20703646](https://zenodo.org/records/20703646), plus BirdNET
Geomodel V3.0.2. Their published terms are **CC BY-SA 4.0**, which permits
commercial use with attribution and ShareAlike for adaptations.

| Part | Licence | Commercial use |
|---|---|---|
| BirdNET V3 source | MIT | Yes |
| BirdNET **V1.1–V2.4** weights | CC BY-NC-SA 4.0 | **No** |
| **Pinned V3 preview3.1 Global 11K weights** | **CC BY-SA 4.0** | **Yes**, with attribution |
| **Pinned Geomodel V3.0.2 weights** | **CC BY-SA 4.0** | **Yes**, with attribution |
| Perch 2.0 weights | Apache 2.0 | Yes |
| A classifier trained on V2.4 embeddings | CC BY-NC-SA 4.0 inherited | **No** |

BirdNET Live's newer pruned 10K/Geo3.0.4 bundle has its own Apache 2.0 model
licence, but Burbz does not ship that bundle. Do not describe the retained 11K
weights as Apache licensed.

## 2. What Burbz must honour

**Attribution.** Keep the factual “Powered by BirdNET” credit, model version,
licence link, and Kahl et al. citation on `audio-credits.html`.

**ShareAlike.** Plain inference does not place Burbz's game code under CC
BY-SA. Fine-tuning the weights or training a classifier head on their
embeddings may create an adaptation that must be shared under CC BY-SA 4.0.

**Acceptable use.** The published V3 terms prohibit poaching or illegal
wildlife exploitation and military uses including surveillance or targeting.
Burbz must also distinguish predictions from verified observations and avoid
implying endorsement by the BirdNET project.

The NonCommercial V2.4 path remains in source for explicit research and
rollback work. Production requires `BURBZ_SOUND_MODEL=birdnetv3`,
`BURBZ_SOUND_MODEL_FALLBACK=0`, and a second explicit opt-in before V2 can run.

Because the 11K release is still called a developer preview and its terms also
refer to research/evaluation, written clarification from BirdNET remains
prudent before a paid launch even though the published CC BY-SA licence does
not contain a NonCommercial restriction.

## 3. Preview and supply-chain risk

- The installer pins exact URLs and SHA-256 hashes rather than `latest`.
- Acoustic, label, geo, and geo-label identity is verified again at model load.
- The live endpoint must prove the exact acoustic hash, current decision
  policy, V3 provider, disabled fallback, and integration version.
- Re-read the terms and rerun phone-domain calibration before changing the
  model pin or shipping a paid release.

## 4. Why the broader 11K model is retained

BirdNET Live's aligned 9,789-class acoustic/Geo3.0.4 pair was downloaded and
tested during this audit. For every shared regression class it produced
numerically identical acoustic scores, so it did not improve
Great Tit/Chaffinch/Mistle discrimination. It prunes 944 bird outputs from the
11K model.

That pruning removes four genuine spawnable Australian birds from Burbz:

| Species | Scientific name |
|---|---|
| Short-tailed Grasswren | `Amytornis merrotsyi` |
| Eungella Honeyeater | `Bolemoreus hindwoodi` |
| Black-eared Miner | `Manorina melanotis` |
| Orange-bellied Parrot | `Neophema chrysogaster` |

No defensible replacement class exists for those taxa. Keeping the 11K model
preserves them. Geo3.0.2 maps 9,341 of its 9,834 bird classes; each of the 493
unmapped classes now receives the stricter `0.60` no-geo acoustic floor plus
temporal support rather than the permissive geo-present threshold.

One catalogue synonym is handled explicitly:
`Microptilotis imitatrix` and `Meliphaga imitatrix` are the same Cryptic
Honeyeater taxon. Results are canonicalised and deduplicated rather than
unlocking it twice.

## 5. Accuracy handling around V3

Model scores are not calibrated presence probabilities. Burbz adds:

- natural-level audio and high-quality band-limited resampling;
- near-silence and non-finite-score abstention;
- 50% overlapping three-second windows;
- rolling Log-Mean-Exp pooling and raw two-window temporal support;
- BirdNET Live's exact 17-class score-suppression list;
- place/week filtering with a per-unmapped-class safety floor;
- a reviewed Mistle Thrush evidence-shape gate;
- simultaneous multi-bird suggestions;
- a stronger independent, exact-provenance Birdex-unlock tier.

Validation includes six Great Tit + Chaffinch mixtures, three independent true
Mistle Thrush recordings, short and repeated Common Blackbird confusers, a
listener-shaped Tawny Owl positive, and silence. The original garden audio was
not retained, so its exact acoustics cannot be reconstructed from screenshots.

## 6. Operational work items

- [x] Make V3 the default and prohibit automatic fallback in production.
- [x] Pin and verify the broader V3 acoustic/geo assets.
- [x] Add temporal, geo, confuser, blacklist, and Birdex-unlock gates.
- [x] Add live model provenance and transactional deployment rollback.
- [ ] Run `scripts/install-birdnet-v3.sh` on the VPS. Nothing is live until
      that deployment succeeds.
- [ ] Keep calibrating on labelled recordings from actual player phones.
- [ ] Confirm no custom classifier was trained on V2.4 embeddings.
- [ ] Seek written licence clarification before a paid launch.

## 7. Everything else reviewed

- **Audio:** CC0, attributed CC BY 4.0 field recordings, and
  ElevenLabs-generated music/SFX. Verify the ElevenLabs plan carries
  commercial rights.
- **Textures:** ambientCG, CC0.
- **Species data:** source URLs and factual range/diet data are used; rewrite
  any prose found to have been copied verbatim.
- **Map/geodata:** OpenStreetMap-derived content requires ODbL attribution;
  confirm every map surface carries it.

## Sources

- https://github.com/birdnet-team/birdnet-V3.0-dev
- https://github.com/birdnet-team/birdnet-V3.0-dev/blob/main/TERMS_OF_USE.md
- https://zenodo.org/records/20703646
- https://github.com/birdnet-team/geomodel
- https://huggingface.co/tphakala/BirdNET-Geomodel
- https://github.com/birdnet-team/birdnet-live-app
- https://github.com/birdnet-team/BirdNET-Analyzer
- https://creativecommons.org/licenses/by-sa/4.0/
- https://creativecommons.org/licenses/by-nc-sa/4.0/
- https://github.com/google-research/perch
