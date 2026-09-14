# Village houses and Alderwing scenery

Build: `houses-terrain-v408-20260914`. Prepared locally; publication pending.

A permanent player house built inside a village now appears in its overhead
scene at the same saved geographic position. Town overviews use the same
projection. The actual cabin and purchased upper rooms share one model builder
with first-person Home. Moving, upgrading or extending the home invalidates
cached overviews; a temporary shelter and a home outside the settlement remain
outside the village scene. Personal housing does not create population,
production, village ownership or another timber charge.

The overhead copy is hidden before walking collision and batching begin, then
restored on exit. The continuous world retains its existing home/yard and
interior lifecycle. A home within the host settlement now uses its joined
terrain elevation instead of an unrelated raw DEM height.

The continuous world adds coherent woodland/clearing variations, exposed rocky
slopes, clustered boulders, and animated cascades on existing village rivers
and decoded map waterways. Water follows loaded downhill elevations; flat or
unknown streams do not receive fabricated drops. Short rock shelves support
uneven waterfall curtains, with foam and rocky banks. Broad geographic terrain,
GPS authority and physical walking rewards remain unchanged. Rocks respect
path and river footprints and provide walking/flight collision. All scenery
uses the existing renderer, chunk lifetime, fog, lighting and fixed identities;
there are no new image downloads or background animation loops. Water animation
respects reduced motion and pauses with the world.

Trees require known ground beneath the centre and sixteen root-footprint
samples. A rise/run over 0.65 (about 33 degrees) rejects the site. This prevents
trunks on steep cliff faces and uncertain terrain edges while retaining forest
on gentler ground. Walking samples the same ground triangles as the scenery.

## Verification

Evidence root: `/root/burbz-houses-terrain-evidence/`.

- Six Node behavioral groups cover saved-house projection, untouched economy,
  moved/upgraded/extended-house invalidation, cliff roots, stable rock fields,
  missing ground, rotated rock collisions and downhill-only watercourses. The original implementation
  fails the new house and tree checks (`baseline-regression.txt`).
- Phone browser journey builds within a village using native No/Yes controls,
  verifies one 25-timber payment, returns overhead, reloads, enters first-person
  again and restores the overhead house on exit. It audits actual loaded tree
  roots, scene liveness and shader/page errors. `final-phone/results.json`.
- Controlled steep DEM and actual OpenFreeMap/Mapterhorn runs are separate.
  The real-provider run includes 72 map requests, 9,662 trees, 256 boulders and
  12 cascade sections at its initial observation. These are sampled scene
  counts, not guarantees for every location. Screenshots were inspected.
- The existing native crossing regression checks retained scene/camera/canvas,
  outward and return walking, flight, original rooms and timber harvesting.
- Full suite before the final footprint and bank-collision adjustments: 2,044 passed,
  five skipped, and exactly the same 196 baseline failure IDs; no new failures.
  Focused terrain/home/install checks pass after those adjustments. Final
  receipts below supersede these intermediate results when present.

The paired software-renderer comparison before the final bank-collider cleanup
measured 8.86 fps / 250 ms p95 on baseline and 12.56 fps / 200 ms p95 on the
new scene, with zero terrain-loading stalls in either. It uses identical phone
viewports and source fixtures; this is a bounded no-regression observation,
not a physical-phone performance claim. `performance.json` retains exact
served hashes. The earlier concurrent full journey ran more slowly (5.5 fps).

Browser runs use disposable saves and phone-sized Chromium, not a physical
phone. Synthetic steep terrain deliberately stresses cliffs; the real-provider
run verifies integration separately. No user's save was accessed.

## Final source verification

`pwa-verified/results.json` passes the real v407b→v408 service-worker upgrade,
exact installed HTML/four-module hashes, unchanged home/room/decor/balances,
first-person home presence, and offline reload into both overhead and previously
visited terrain. `final-real/results.json` runs the final runtime bytes on
actual provider data: 9,683 trees, 300 field/bank rocks and 12 cascade sections;
9,458 trees with fully loaded neighbouring ground pass the runtime root audit.
Both runs report zero page errors; screenshots were inspected. The extreme
synthetic cliff and native build/refund/return journeys remain separately
labelled in the earlier phone and landscape receipts.

Final footprint/bank cleanup passes nine focused Python checks and six Node
behavioral groups, including rotated stone collisions. The complete final
regression run has 2,044 passes, five skips and exactly the same 196 baseline
failure IDs, with no new failures (`release-full.xml` and `test-comparison.json`).
`release-manifest.json` pins every changed runtime file for publication.

## Update and recovery

Index, worker and the lazy walking loader pin the four changed modules to v408
in all three worker lists. Existing guarded-updater entries already cover every
changed runtime file. Deploy through the reviewed GitHub merge and guarded
`burbz-sync` workflow, then verify live marker, managed/public bytes and a fresh
production canary. No live files have been edited by this work. The unrelated
`videos/friend-shaped.mp4` worktree change is excluded.
