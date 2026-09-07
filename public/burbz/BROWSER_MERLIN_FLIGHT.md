# Merlin flight and interactive Play validation

Integration base: `ab79977` on `codex/burbz-appearance-release-v362` (Appearance plus walking quests). Feature assets and runtime use `merlin-flight-v1-20260907`. The release owner retains the combined build/cache bump and deployment; this feature was not independently published.

## Behavior

Merlin → Play performs the existing care action once, then opens a 25-second flight. Tap the marked play sky to drop a harmless pebble. Merlin turns, follows a shallow approach, fans his tail, reaches with his talons, carries the pebble and returns it. A new target replaces an uncollected one; at most one additional target waits while he carries. Care opens the real care menu. Finish returns him to his original branch. Rest remains the existing saved ten-second nap and immediately stops the visual flight.

Flight and retrieval contain no inventory, reward or save calls. Active Play cannot run a second care transaction after the old ten-second breather expires. Current controls remain native controls through holes in the temporary play hit surface. The full-page canvas accepts no pointer events. Navigation, expedition absence, hidden/pagehide, resize/orientation and motion preference changes dispose the session. Reduced motion uses a stationary pose and short feedback instead of screen travel or wingbeats.

## Tests and evidence

- `node tests/test_merlin_flight_20260907.cjs`: 21 passing tests. Real atlas anchors cover pickup/carry continuity, exact contact, bounded paths, all views, rapid retargeting, phase continuity, control cutouts, load failure, stale load rejection, one RAF and lifecycle cleanup.
- Existing Merlin/rest/rig/bond, Appearance and service-worker Python contracts: 58 passing functions, executed directly because pytest is not installed in this desktop runtime. These include the existing real Node care and Appearance contracts invoked by the Python tests.
- `tests/test_merlin_flight_20260907.py` adds the Node suite to normal pytest discovery and checks the consuming WebP: 64 nonempty frames, real alpha, opaque artwork and eight clear margin pixels in every cell. The bitmap check passed with Pillow.
- Every inline script and new/changed runtime script parses. All four consuming dependencies exist, are registered in all three SW shell lists and are in the legacy updater.
- `tests/run_merlin_flight_v1.cjs` runs the full game on an ephemeral loopback server. Each theme gets a fresh disposable Chromium context, no existing user profile or save, blocked service workers and blocked remote requests. It uses actual Play, Care, Rest, Settings and Appearance controls.

The browser harness verifies one Play reward, unchanged inventory/currency for retrieval, no duplicate reward after the breather, real nap completion across reload and exactly once, mid-flight theme changes, control access, Finish/perch geometry, reduced motion, portrait/landscape containment, backgrounding/pagehide, resize, away-until-claimed and navigation. Screenshots and the complete assertion report are supplied in the animation task's `outputs/validation/` directory. The final run passed 146 assertions with zero JavaScript errors; details are recorded in `results.json` there.

The standalone `outputs/merlin-flight-preview.html` uses byte-identical game runtime JS/CSS and the same atlas/configuration. It works from a local file or loopback URL and supplies a slow wingbeat inspector. The accompanying MP4 shows interactive fetching and the inspector.

## Visual corrections and limits

Using the production talon coordinates exposed a 44px single-frame jump at a tight mobile turn. Facing now progresses through front/back views; the final approach settles its facing before contact. A continuous mesh below the stable torso keeps the rendered talons attached during the grasp-to-carry pose change. Shared vertices remove the strip seams caught in visual review; the exact three affected poses were rendered again and inspected. Claw pixels remain within 0.61px of the grip. Regression cases now stay below 4.3px body movement and 4px held-token movement per 60Hz model step. Finish previously remeasured a hidden host moved by the old fixed-flight CSS; the hidden host now retains its absolute position on the branch.

Atlas export was inspected on light/dark backgrounds and has no baked labels, checkerboard or magenta residue. PNG and lossless WebP match exactly in alpha and visible pixels. 2048² RGBA consumes 16 MiB decoded; transport is 1,386,226 bytes. There is one canvas at a maximum DPR of two and one RAF, no animation dependency or backend. Chromium mobile emulation is not a physical-phone frame-rate guarantee.

The required pre-art VPS check verified all 1,545 required artworks after retrying six transient timeouts. Of 435 optional derived cutouts, 434 answered successfully; the existing witch-rook optional cutout returned 404 and retains its game's fallback. No old art was replaced or fetched from GitHub. All Burbz care/save and Appearance modules remain intact.
