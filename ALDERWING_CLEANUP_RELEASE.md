# Alderwing Village Cleanup Release

Date: 2026-09-21
Candidate branch: `codex/alderwing-cleanup-v433`
Base inspected: `origin/main` at `b653c92828e82b270b6ea06c498846efa6450c97` (`Merge pull request #373 from Kainer996/ava/quest-focus-20260921`)
Build/cache marker: `alderwing-life-int-v433-20260921`

## Product changes

- Removed first-person pickup, item, lore/task, and chest 2D billboard sprites from the village discovery surface. Quest markers remain as subtle geometric markers.
- Replaced village loot pickups with procedural Three.js chest geometry. The live proof sees at least three distinct chest variants: `AlderwingChestBody0/1/2Geometry` and `AlderwingChestLid0/1/2Geometry`.
- Kept chest glow conditional: unopened and holding grantable loot only. Opened, empty, lore, task, and request-post markers do not glow.
- Reduced first-person village clutter by hiding completed/future steps and using quiet geometric lore/fieldwork/request markers.
- Tightened village quest interactions: accept and finish only in-person at a villager/request post, clearer current objectives, clearer reward copy, decline/`Not now`, reload-safe exactly-once rewards, and journal guidance without remote accept/finish.
- Reworked the village discovery UI from older green/gold panels into a polished charcoal/cool-accent sheet with mobile-friendly controls, focus handling, Escape close, and reduced-motion stability.
- Pauses discovery panels/HUD while entering building interiors and restores them on exit/dispose.
- Preserves existing save IDs, claim IDs, old-save readback, failed-save rollback behavior, keyboard/touch controls, reduced-motion transforms, scene lifecycle, and the single village renderer.
- No Rowan story, Merlin 3D, recognition/backend/billing/provider changes, paid calls, or webroot hot edits are included.

## Changed files

- `public/burbz/building_rooms.js`
- `public/burbz/building_work.css`
- `public/burbz/index.html`
- `public/burbz/sw.js`
- `public/burbz/village_discoveries.css`
- `public/burbz/village_discoveries.js`
- `public/burbz/village_discovery_core.js`
- `public/burbz/village_walk.js`
- `public/burbz/tests/run_building_opening_native_v405.cjs`
- `public/burbz/tests/run_building_opening_v405.cjs`
- `public/burbz/tests/run_village_discoveries_20260908.cjs`
- `public/burbz/tests/test_village_quest_writing_v431.cjs`
- `public/burbz/tests/test_village_walk_loading_v414.cjs`
- `public/burbz/tests/village_walk_fixture_20260907.cjs`
- `scripts/check-alderwing-life-int-pins.cjs`
- `scripts/prove-alderwing-life-int-pwa.cjs`
- `scripts/prove-alderwing-life-int.cjs`
- `scripts/prove-alderwing-qst-ui-save.cjs`
- `scripts/prove-alderwing-remediation.cjs`
- `scripts/prove-alderwing-vis-act.cjs`
- `scripts/red-alderwing-baseline.cjs`
- `ALDERWING_CLEANUP_RELEASE.md`

Local `.agents/`, `.claude/`, `.codex/`, `.hermes/`, `.mcp.json`, and root `AGENTS.md` files are environment/runtime artifacts and were intentionally left unstaged. No LFS normalization noise is part of this release.

## Final local verification

Main final evidence root: `/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z`.

Passing commands from that run:

- `node --check public/burbz/village_discovery_core.js`
- `node --check public/burbz/village_discoveries.js`
- `node --check public/burbz/village_walk.js`
- `node --check public/burbz/sw.js`
- `node --check scripts/red-alderwing-baseline.cjs`
- `node --check scripts/prove-alderwing-vis-act.cjs`
- `node --check scripts/prove-alderwing-qst-ui-save.cjs`
- `node --check scripts/prove-alderwing-life-int.cjs`
- `node --check scripts/prove-alderwing-life-int-pwa.cjs`
- `node --check scripts/prove-alderwing-remediation.cjs`
- `node public/burbz/tests/test_village_walk_loading_v414.cjs`
- `node public/burbz/tests/test_village_quest_writing_v431.cjs`
- `node public/burbz/tests/test_village_fieldwork_v385.cjs`
- `node public/burbz/tests/test_discovery_claims_v382.cjs`
- `node scripts/check-alderwing-life-int-pins.cjs` — 44 cache/pin/deploy-list checks passed, covering `index.html`, all three `sw.js` worker lists, `village_walk.js` dependency pins, and `scripts/update-live-burbz.sh` file inventory.
- `git -c filter.lfs.process= -c filter.lfs.required=false diff --check`
- `EVIDENCE_DIR=/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/redgreen TARGET_DIR=/home/ubuntu/burbz-alderwing-cleanup/public/burbz TARGET_NAME=candidate node scripts/red-alderwing-baseline.cjs` — 8/8 checks passed.
- `EVIDENCE_DIR=/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/vis-act node scripts/prove-alderwing-vis-act.cjs` — 24/24 checks passed.
- `EVIDENCE_DIR=/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/qst-ui-save node scripts/prove-alderwing-qst-ui-save.cjs` — 30/30 checks passed.
- `EVIDENCE_DIR=/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/pwa node scripts/prove-alderwing-life-int-pwa.cjs` — 8/8 installed/offline/update checks passed.

Important evidence files:

- RED-before-GREEN baseline: `/root/burbz-alderwing-cleanup-evidence/red/2026-09-21T13-04-44-503Z-baseline/baseline-red-results.json` exited 1 as expected against the old billboard/sprite baseline.
- Final RED/GREEN candidate: `/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/redgreen/2026-09-21T15-55-21-236Z-candidate/baseline-red-results.json`.
- Final visual/action browser proof: `/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/vis-act/2026-09-21T15-55-26-086Z/results.json`.
- Final quest/UI/save browser proof: `/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/qst-ui-save/2026-09-21T15-55-39-737Z/results.json`.
- Final installed/offline PWA proof: `/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/pwa/2026-09-21T15-57-53-081Z/life-int-pwa-report.json`.
- Final remediation proof: `/root/burbz-alderwing-cleanup-evidence/final-release/2026-09-21T15-55-19Z/remediation/2026-09-21T15-58-15-512Z/remediation-results.json`.
- Prior full remediation pass before the final rerun: `/root/burbz-alderwing-cleanup-evidence/appmedian-remediation-full/2026-09-21T15-39-29-442Z/remediation-results.json`.

## Verified behavior highlights

- Real browser scene traversal sees zero visible item/pickup sprites in the Alderwing village pickup paths.
- Real browser scene traversal sees multiple geometric chest variants and quiet geometric lore/request/fieldwork markers.
- Loot/open glow truth table is covered for unopened loot, opened loot, empty/no-reward records, lore, activities, and quest steps.
- Quest flow is exercised through actual village UI: accept, decline, step completion, finish, reload, exactly-once rewards, and journal guidance without remote completion.
- Failed-save rollback is exercised by faulting storage writes through the transaction adapter while keeping player-visible state coherent.
- Phone portrait, short landscape, 44px controls, focus trap, Escape, keyboard action, touch action, reduced motion, and joystick/look controls are covered by browser evidence.
- Home, interior, and wilderness pickup surfaces are checked to retain discovery/collection behavior while removing first-person item sprites; Merlin's existing home sprite remains intentionally allowed by canon.
- Resource lifecycle checks cover discovery DOM release, listener aborts, geometry/material disposal, single RAF ownership, retained village residents, interior pause, draw calls, triangles, and PWA install/offline update.

## Limits and known non-blocking issue

- `scripts/prove-alderwing-life-int.cjs` still has a noisy synthetic performance median assertion. In the final local run it exited 1 only on `performance_median_bound`: baseline median `16.700000000000728ms`, candidate median `33.30000000000018ms`, allowed `25.87500000000091ms`. The same report had 15/16 checks passing, including RAF release, listener aborts, DOM cleanup, resource disposal, retained residents, interior pause, draw calls and triangles.
- `scripts/prove-alderwing-remediation.cjs` exited 1 only because its three lifecycle reruns require every median performance run to pass. Two of its three lifecycle repeats passed; the third repeated the same median-bound failure. Its other 17/18 checks passed.
- Zenith independent app-median validation reached the same conclusion: the scene/lifecycle/geometry checks passed, while VAL-LIFE-003 remained unstable on synthetic median frame time. Per the 2026-09-21 urgent steering, this is reported as a limitation rather than a reason for indefinite polishing.
- Browser probes use local static Chromium, synthetic flat walkable worlds, disposable localStorage saves, and external network blocking. They do not call paid/provider/backend services.
