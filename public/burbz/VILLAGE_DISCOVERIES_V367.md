# Village discoveries v367

Release candidate based on main `c8aa650c`; Yaan approved publication on 8 September 2026. The guarded GitHub/VPS release and final live verification follow this recorded candidate.

## Player behavior

Walk into a 3D village and meet its actual Peep residents or read their gold request post. Each village receives one saved request from 50 original stories, in a shuffled order with no repeats in the first 50 distinct walked villages. Leaving requests unfinished cannot consume another assignment for that village or cause repeats elsewhere. Later groups of 50 use another shuffled cycle.

Accept the request, follow the blue task markers in order, and return to a villager or the request post for thanks. Stories cover lost belongings, repairs, picture clues, neighbour disputes, deliveries and celebrations. All 50 have distinct titles, requests, ordered actions and endings. The post remains usable when nobody lives in the current clearing; this does not add decorative residents, homes or economic production. A resident spoken to supplies their real saved name.

Each village also contains 3–5 randomized loot chests and two scrolls drawn from 30 original fictional Alderwing lore passages. Loot goes to real inventory: modest coins/branches, Oak Twigs, River Reeds, Iron Grit, Thorn Talons, Bronze Spurs, Willow Wing-Wands, Reed Vests and Tonics of Vigour. Existing equipment and commerce gates remain intact. Each completed request pays 30 coins and two Oak Twigs once. No passive or daily refill.

Nearby actions work with the interaction button or E. J opens the journal, which keeps quest status and collected lore for rereading. A direction/distance hint leads to the current task. Escape/Back closes the journal before leaving the walk; touch scrolling works inside the journal while movement resets. Standard on-foot controls and the Village exit remain available.

## Implementation and saved state

- `village_discovery_content.js`: the 50 hand-authored quests and 30 lore entries.
- `village_discovery_core.js`: seeded assignment, no-repeat cycles, reward definitions, ordered/idempotent transitions, and reachable placement.
- `village_discoveries.js`: bounded 3D chest/scroll/post geometry, real resident interactions, directions and journal.
- `village_walk.js/css`: lazy loading, input/modal lifecycle and cleanup integration.
- `index.html`: transaction adapter. `gameState.villageDiscoveries` keeps the world seed, village assignments, loot, lore and claim flags. These survive the existing local/cloud whole-save load. No old progress or catalogue data is reset.

Claim flags and balances/items are committed in one durable save. Storage failure restores the previous in-memory state; retry is safe. HUD refresh follows commit and cannot undo a completed transaction. This follows the app's existing whole-save model; it does not introduce cross-device server transactions.

A flood fill starts at the actual walking spawn. Every edge is sampled at 0.1-unit intervals through the existing collision authority; placements come only from that connected component. Geometry changes can move remaining markers to newly reachable positions while their saved IDs and claim flags stay intact. No second scene renderer or WebGL context is created. All added geometries/materials/sprite textures dispose on exit; sprite quads do not write depth, avoiding square manga outlines.

All discovery modules and the walking dependency group are versioned `village-discoveries-v367-20260908` in the three service-worker shell lists and the legacy guarded updater. Unrelated runtime asset pins are preserved. Ninety-six older release assertions were mechanically advanced to the new current build/walking pins; no gameplay assertion was removed.

## Verification

- `node tests/test_village_discoveries_20260908.cjs`: 2,200 complete quest lifecycles across 20 player seeds, all 50 definitions, two non-repeating 50-village cycles, unfinished-request uniqueness, reload/revisit stability, exact catalogue IDs, randomized weapons/lore coverage, duplicate-claim rejection, connected-space placement, real index-adapter storage-failure rollback/retry and all cache/updater registrations.
- `node tests/test_village_walk_20260907.cjs`: movement, collision, sliding, boundary, bridge, spawn and quality rules pass.
- Full pytest: **2,108 passed, 5 skipped, 42 failed**. All 42 failures reproduced individually on unchanged main `c8aa650c`; no newly failing case. Baseline comparison and full output are under `/root/burbz-village-discoveries-evidence/`. Thirteen focused discovery/walking/release/updater tests pass. All four inline scripts and changed standalone JavaScript parse; `git diff --check` passes.
- `tests/run_village_discoveries_20260908.cjs`: real Chromium with a disposable local game save; actual keyboard movement; acceptance from a real saved Peep; every ordered step; leave/reenter; finish once; every loot/scroll; real page reload retaining claims; 390px, 320px and landscape journals; an empty village's distinct request; repeated-entry resource budgets; blur reset and recoverable context-loss exit. No page errors. Screenshots inspected under `/root/burbz-village-discoveries-evidence/discoveries/`.
- The original walking browser runner's fixed 750ms movement assertion is unsuitable for this server's software WebGL (approximately 4 fps in the observed frame window). The new runner waits for actual distance under real input and covers navigation/lifecycle independently. No physical-phone performance claim is made.
- Installed-app upgrade and offline play proof: `tests/run_village_discovery_pwa_20260908.cjs` passes. An actually installed/reopened v366 client automatically activates v367, preserves seeded coins/branches/save marker, caches every new dependency, opens the 3D village offline, collects loot offline and retains that claim after a further offline reload. No page errors. Evidence: `/root/burbz-village-discoveries-evidence/pwa/results.json` and `offline-journal.png`. The local preview has no auth backend; its expected `/api/auth/config` 404 is unrelated to static game play.

Browser runners accept `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `EVIDENCE_DIR` and (for the interaction runner) `QA_URL`; the PWA runner accepts `BASELINE_ROOT`. The interaction runner expects `public/` served on localhost:8871; the PWA runner opens its own localhost:8876 server and closes it in `finally`. Fixtures only expose local test access, use synthetic saves and never connect to production accounts or location.
