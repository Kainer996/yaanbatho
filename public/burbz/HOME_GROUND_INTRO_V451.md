# Home ground and illustrated opening — v451 release candidate

Status: locally verified candidate, **not published by this task**. Build/cache suffix: `home-ground-intro-v451-20260923`. Base: `5fe481f8f4d2da7224cc648b8bbf932b595a8eb2`.

## Included

- Existing retained world terrain now grounds Home scenery/farm against its final rendered triangles. Removed stock paving/outlook obstacles and the exterior Merlin billboard, not paid ponds, discoveries, crops or the real UI companion.
- Eleven initial Merlin reading beats have static illustrated scenes using original existing game artwork. Stable lessons, rewards and later tutorial remain authoritative.
- The shelter teaches released, renderer-applied right-side turning before exit. Saved tutorial checkpoints reconcile the actual host and retain usable retries; Settings remains available. Older door/later/completed phases do not replay the new practice.

Independent feature review found no blockers and independently executed the 25 unit / 14 native tour scenarios plus terrain/story checks. Exact final reviewed feature bytes are preserved. Review and worker evidence are in `/root/.hermes/task-progress/burbz-home-ground-intro/{REVIEW,TERRAIN,INTRO,TOUR}.md`.

## Release integration

Ten files use the new pin in their actual consumers and all three worker lists (`BURBZ_ASSETS`, `BURBZ_CORE`, `BURBZ_INSTALL_REQUIRED`):

`player_home.css`, `player_home_core.js`, `player_home_scene.js`, `player_home.js`, `alderwing_intro.js`, `village_world_core.js`, `village_world.js`, `village_walk.js`, `merlin_story_scenes.js`, `merlin_story_scenes.css`.

The walking loader changed only its two world dependency pins, so its own consuming pin advances too. Home's lazy dependency tuples and exact-current-cache helper remain byte-identical to the baseline. In particular, `village_walk_core.js` remains pinned to `alderwing-followups-v417-20260914`; unchanged room modules retain their earlier versions.

Both new story modules are registered in `scripts/update-live-burbz.sh`. All six original story artwork URLs are required offline. The unversioned `assets/special-birds/rook-witch-scene.webp` entry was added alongside the pre-existing versioned sprite-scene entry because the presenter requests the unversioned URL. No artwork bytes changed. Other module versions and save epochs remain unchanged.

## Reproduce acceptance

Run from the repository root:

```sh
node public/burbz/tests/test_home_ground_intro_release_20260923.cjs
node public/burbz/tests/test_home_dependency_cache_20260923.cjs
node public/burbz/tests/test_home_ground_20260923.cjs
node public/burbz/tests/test_merlin_story_scenes_20260923.cjs
node --test public/burbz/tests/test_tour_resilience_20260923.cjs public/burbz/tests/test_tour_legacy_20260923.cjs
EVIDENCE_DIR=/root/.hermes/task-progress/burbz-home-ground-intro/release-pwa-sealed node public/burbz/tests/run_home_ground_intro_pwa_20260923.cjs
BASELINE_MEDIA_PROBE=1 EVIDENCE_DIR=/root/.hermes/task-progress/burbz-home-ground-intro/release-baseline-media node public/burbz/tests/run_home_ground_intro_pwa_20260923.cjs
```

Use a fresh EVIDENCE_DIR to preserve an earlier run. The runner supports `CHROMIUM_PATH`, `PLAYWRIGHT_MODULE` and `BURBZ_ASSET_ROOT`. It freezes each changed baseline runtime from exact Git HEAD and all candidate runtime bodies before serving. New story modules are absent from the baseline. Unchanged files come from the candidate; an optional read-only live fallback is permitted only when its SHA-256 equals the tracked LFS pointer. No production responses are substituted or owner saves used. Seed HTML instrumentation runs only in a separate worker-blocked context; installed app responses and cached bytes are unmodified.

Final installed proof: `release-pwa-sealed/results.json`, complete=true, nine check groups, no page errors or missing static files. The baseline is installed then reopened before update. Both repaired baseline and candidate open Home with a stalled cached dependency; candidate holds all three lazy-dependency origin paths without requesting them. Actual takeover reloads to v451. Exact hashes cover HTML, all ten module URLs, three unchanged lazy dependencies, six artwork URLs and the full original movie. Offline restart retains real Home rendering, advancing frames, native movement, command return and all save fields except measured canonical care timestamps/hunger. Chatter is checked against the unchanged companion core. Offline native New Game/Skip traverses all eleven scenes, all six image URLs decode, and a middle story scene survives restart with only its expected update timestamp advancing.

## Honest limits and publication handoff

- The unchanged movie has an offline `FFmpegDemuxer: data source error` after New Game in this software-Chromium fixture, including after native Retry. The same error reproduces on immutable v450; one intermediate candidate run played it. The full cached movie is hash-correct and native Skip works. **This release does not certify offline movie playback or repair that baseline behavior.** Diagnostic evidence: `release-baseline-media/results.json` and the final run's `offlineNewGameMedia`.
- Earlier test attempts caught optional-movie warming and an over-strict whole-tutorial timestamp assertion; only the test was corrected. Historical failed output directories are not acceptance evidence.
- No physical handset, outdoor GPS/provider, public HTTPS, full-suite or new no-cache browser-recovery certification. Existing wrong-version/absent/old-cache unit assertions pass unchanged; prior release owns the no-cache native Retry evidence. Independent terrain/tour fixtures use synthetic geography.
- No commit, push, merge, deploy, production writes or owner-save changes. Parent owns normal reviewed PR/merge/deploy, exact public byte/cache proof, and public offline acceptance. Recheck current main before publication; if it moves, integrate and rerun affected checks. Do not claim live from this document.

Exact runtime hashes, commands and final evidence identity are sealed in `/root/.hermes/task-progress/burbz-home-ground-intro/RELEASE.md` and `release-manifest.json`.
