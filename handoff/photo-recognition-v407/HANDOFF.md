# Camera recognition v407 — paused cloud-transfer checkpoint

Status on 14 September 2026: **WORK IN PROGRESS, NOT RELEASED, NOT READY TO CLAIM FIXED.** The user needs to shut down the laptop and explicitly requested a remote checkpoint and cloud continuation. Local implementation/publication is paused. No cloud execution has been started by this owner.

## Repository and ownership

- Remote: https://github.com/Kainer996/yaanbatho
- Checkpoint branch: `codex/burbz-photo-recognition-v407`.
- Base/main/verified public release at pause: `8f2eed08394e2005ced837eb9f1bb3ad14bffc4a`, `wayside-room-title-v406b-20260914`.
- All Home dashboard/equipment, world/shelter, combat, builder and wayside releases through v406b are live and verified. Do not redo those changes. Only the rejected 3D Merlin work is paused separately.
- Current task owns camera recognition/release; the existing first-person controls/equipment/spells task is coordinating cloud transfer. Do not create competing local implementations.
- Standing user authorization covers testing and publishing finished Burbz work through the existing PR/merge/guarded deployment process. This checkpoint is deliberately not a production merge or deployment.

## Actual problem and candidate

The existing free local BioCLIP 2 worldwide worker confidently calls one public European Herring Gull an American Herring Gull; another clear European photo abstains. Birder EU knows European Herring Gull but has no American class, so cannot independently distinguish them. Cropping and letterboxing did not repair the taxonomy failure. No user's original photo was supplied or tested.

Candidate upgrades only the primary model to pinned BioCLIP 2.5 ViT-H-14 with matching worldwide embeddings (10,785 bird species). Its stock generic common name `Herring gull` still confuses the split. Provisioning changes exactly the English common name for unchanged scientific `Larus argentatus` to `European herring gull`, reproducing the authors' exact SINGLE-template recipe `an image of {c}.` (full seven-rank taxonomy + common name). The old original vector reproduction cosine is 1.000000119. Every other bird column stays unchanged. No GPS prior, forced geographic relabeling, threshold reduction or paid API is used. Old Birder mappings are carried through scientific identities: all 628 shared species remain cross-checked.

Runtime contains only unchanged visual model tensors plus scale, avoiding allocation of the unused text encoder. Provisioner writes seven checksummed runtime files, manifest `photo-models-v407`. It also derives a small photo/illustration embedding matrix: veto only when BOTH views confidently indicate illustration (>=.90). This is not camera liveness, calibrated accuracy or screen-photo protection. An earlier positive-photo minimum wrongly rejected a real Great Tit and was discarded.

Species gates stay unchanged: exactly one strong bird detection; original-pixel framing; two padded views; both views same species with >=.60 scores and >=.20 margins; the SAME primary or secondary model >=.90 in both views; cross-model agreement when mapped. `POLICY=photo-local-v393` deliberately remains backward-compatible; accepted `MODEL` becomes `bioclip25-birder-local`. Adapter rejects the old model identity under the new candidate. Ambiguous messages now ask for another angle showing head/wings/tail rather than insisting on an even tighter crop.

## Validation that actually ran

- Exact checkpoint: **30 Python contract tests pass**, **8 Node camera client groups pass**. Contract tests inject responses; they do not establish recognition accuracy.
- Actual prepared-model worker: **18 original controls pass**. Two original European photos now correctly identify; both American comparison photos correctly identify; original clear bird controls, negatives, Australian Magpie, dog and illustrations behave as expected. This includes a permitted abstention for an ambiguous flying Raven.
- Six additional visually inspected public photographs with predeclared expectations: **5/6 pass**. Clear side-on European gull and two further American gulls identify correctly; permitted ambiguous/multiple-bird cases abstain. **A close frontal European gull still abstains with `uncertain-species`, failing its required-positive expectation.** Keep this failure visible; never rewrite it as a pass. There were no wrong accepted identities among these 24 observations. This is a small diagnostic set, not independent global field accuracy; training overlap is unknown.
- `evidence/worker-results.json`: 24 rows, 23 pass, peak RSS 5,260,212 KiB under a 6 GiB/200% CPU diagnostic limit. Accepted-image inference was approximately 8–12 seconds. This does not establish phone experience, service concurrency, complete HTTP latency or global accuracy.
- That 24-photo run used source hash `0c3f440852e111543d2d7f9743414d78ec478055ce12a038b138b7b98676ef90`, before the equivalent two-view illustration condition was extracted into a tested helper and the clearer uncertainty message was added. **Exact current source still needs the full HTTP run.**
- `worker-style-floor-results.json`, `candidate-results.json`, `inat-gull-results.json`, `bio25-gull-results.json` preserve discarded failures, including stock BioCLIP 2.5 misidentifying American gulls. Do not report those as final successes.
- `single-label-probe-results.json` records the exact-author-recipe fix. The older 80-template probe is exploratory and NOT the final method.

## What is committed

Candidate worker/adapter; model provisioner with exact URLs/revisions/checksums; installer model-directory/health changes; guarded updater's five fixture entries; mandatory old-nine plus new-five HTTP proof; contract tests; five normalized public JPEGs with original+normalized checksums, licences and attribution; these checkpoint notes, diagnostic scripts and compact result reports. No weights, private photos, user saves, credentials or runtime secrets are committed. New fixture JPEGs are test data, never PWA precache/game art.

No build/cache promotion, PR, production worker restart, immutable runtime model installation or frontend deployment has happened. Installer documentation/licensing/AGENTS integration remains a release follow-up; `LOCAL_PHOTO_V407.md` currently points to this WIP handoff.

## Cloud prerequisites and server evidence

A normal cloud checkout can run the Python/Node contract tests. Actual model work needs the repository's pinned `scripts/photo-local-requirements.txt`, CPU PyTorch/OpenCLIP 3.3.0/Birder 0.4.15, approximately 6 GiB inference memory, 8 GiB provisioning memory, and roughly 15–20 GB free disk for sources plus temporary/bundled copies. Model download network access is needed unless using the already-verified source cache. The cloud environment being arranged is the saved `yaanbatho` environment; this handoff does not establish that it has VPS credentials or network access.

The existing verified Burbz VPS retains everything independent of laptop power:

- SSH alias `hostinger` on laptop (root at saved Tailscale address); **do not copy laptop SSH keys into Git/cloud prompts**. Use an already-authorized cloud secret/connection if available, otherwise report that deployment/VPS inference access is blocked while continuing local cloud checks.
- Diagnostic directory `/root/burbz-photo-diagnostic-v407`; `prepared-models/` holds the completed seven-file candidate bundle and manifest. `source-cache/` contains verified cached inputs (some symlinks). Full model/name/vector sources and all diagnostic reports are retained there.
- Current exact worker, adapter, provisioner and HTTP proof script have been copied to the diagnostic directory only. No diagnostic inference service is running at pause.
- Existing production photo runtime `/opt/burbz-photo/venv/bin/python`; current worker source under `/opt/burbz-photo/releases/85282a97bcf53725fb55552403eec29f9407375ef04d486fd97283966b3b0628/`; original models `/opt/burbz-photo/models`; socket `/run/burbz-photo/recognizer.sock`. **Leave it active until a tested transactional release.**
- Original nine fixtures `/root/burbz-photo-accuracy-v393/public/burbz/tests/fixtures/photo-v350/`; original two gulls `/root/burbz-gull-diagnostic-v395/`; other public controls `/root/burbz-local-photo-evidence/`; five normalized release fixtures `/root/burbz-photo-diagnostic-v407/fixtures-v407/`; six heldouts `heldout-1.jpg` through `heldout-6.jpg` with `heldout-manifest.json`.
- Prior real-route staging example `/root/burbz-local-photo-evidence/http_proof.py` starts a private worker/socket and Flask endpoint using the actual server `identify_image` AST, only stubbing catalog lookup/report persistence to avoid user records. Reuse with current candidate and fixtures; it is not yet rerun for v407.

## Exact next steps

1. Read this handoff, changed files, `public/burbz/AGENTS.md` invariants and evidence. Check whether main advanced after the verified v406b base, preserving concurrent work.
2. Do not claim the reported close-up problem fully fixed: decide honestly whether the remaining frontal false negative warrants more model investigation. Do not tune thresholds/expectations to hide it. The user's original photo is still unavailable.
3. Verify exact current worker against the actual HTTP adapter/normalization route using original nine and new five fixtures: `scripts/verify-photo-id.py --help`. Existing live worker cannot run this proof because it has the old model. Use a private staging worker/socket, not production. Test missing/noncamera/invalid uploads, busy/concurrent requests, timeout/cancellation, correct identities and no accidental discovery writes. Normalization recompresses JPEGs and could move scores; these final normalized HTTP cases have NOT run yet.
4. Confirm prepared bundle checksums and unchanged visual tensors/all untouched taxonomy columns. New bundle target `/opt/burbz-photo/models-photo-models-v407` must be immutable, complete, correctly readable and byte-verified. Do not overwrite the original `/opt/burbz-photo/models`. `prepare-local-photo.py --destination NEW --cache CACHE` supports offline provisioning; refuses existing destination.
5. Finish release docs, model/fixture licensing and AGENTS entry. Advance global build and three-list cache using existing conventions only when ready. No model weights/test fixtures belong in service-worker precache.
6. Commit finished reviewed source, push a review branch, open PR, merge only the tested head and let existing guarded VPS deployment run. No direct replacement of webroot files. Site https://yaanbatho.com/burbz/; repo existing origin; webroot comes from `/etc/burbz-webroot`. Guard `/usr/local/bin/burbz-sync`, deployment lock `/run/lock/burbz-sync.lock`, backups `/var/backups/burbz-releases`. Confirm `.burbz-deployed-sha` and all `.burbz-managed-hashes.sha256`, not merely a successful dispatch/lock return.
7. Installer must pass candidate camera HTTP proof AND unchanged BirdNET sound proof before frontend copying; preserve transactional worker+adapter rollback. Never modify the sound model/service for this camera repair. Public API/browser/offline/save verification remains required; previous v406b evidence is a template, not evidence for this unpublished candidate.
8. Report actual deployed/verified scope and known recognition limits to the coordinating task. Separate remaining real-GPS map FPS work was not fixed by v403 camera correction; 3D Merlin remains rejected/paused. These do not justify claiming unfinished work complete.

## Checkpoint validation commands

```sh
python -m pytest public/burbz/tests/test_photo_local_20260911.py -q
node public/burbz/tests/test_photo_client_gate_20260905.cjs
bash -n scripts/install-photo-id.sh scripts/update-live-burbz.sh
python -m py_compile public/burbz/photo_local.py public/burbz/photo_id.py scripts/prepare-local-photo.py scripts/verify-photo-id.py
```

Local evidence beyond this checkpoint remains under `/home/yaan/Documents/Codex/2026-09-13/realtime-voice-chat/outputs/photo-recognition-v407/`. The cloud should not depend on the laptop being powered on. Public metadata/manifests and downloadable source pins are included or retained on the VPS.
