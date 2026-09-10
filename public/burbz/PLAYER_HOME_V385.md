# A larger homestead — v385

The personal clearing has twice its previous total area. Ground, walking and decorating radii all grow by `sqrt(2)`; the house and old decoration/discovery coordinates stay fixed. The overview fits the clearing on portrait and desktop screens. Decorating supports dragging the plan and +/− zoom, and keeps that view after placing or moving an item.

## Rooms and decorations

Upgrade the original shack to a cosy cottage for the existing 25 timber, then open Home options → Build & visit your rooms. The Keeper’s library costs 28 timber, Sunlit conservatory 34 and Maker’s workshop 42. Each adds a distinct modeled upper room to the exterior within the existing house footprint, a physical study doorway, a separate walkable interior, a themed reading/work area and its own decoration placements. The room’s exit and Back return to the study; the Rooms panel also provides direct access to built rooms. These rooms do not create settlement residents, production or fabricated player stats.

The catalogue contains 32 distinct modeled pieces, including the original eight: plants, trellises, an arch, pond, well, picnic table, bird shelter, sundial, log rack, loom, spinet, globe, furniture and work tables. Ownership is shared across the home; placements belong to a particular space. Each space holds at most 32 decorations and the whole home 96. Clear desk/door/reading-table paths remain reserved. Construction returns decorations in a new interior doorway approach to inventory, with a notice before building; it never removes ownership or existing garden placements.

## Woodland timber

Twenty-eight trees have stable IDs. Walk close and use the Chop interaction: three saved strikes yield three timber once per tree per UTC day. The final strike removes the tree geometry and trunk collision, leaving a stump. The existing atomic home adapter commits strike progress, tree state and actual timber together; failed storage restores all three and allows retry.

Render geometry and collision use the same frozen UTC day. When the date changes in an active yard view, the controller rebuilds both and moves a player standing on a regrowing stump to the nearest valid point while preserving view direction. Indoor and decorating views defer that refresh until the yard resumes; they do not gain invisible collisions at midnight.

## Save and rendering contracts

`player_home_core.js` normalizes v1 saves to version 2, retaining introduction, tiers, existing inventory, placement IDs/coordinates and discoveries. New `rooms` and `trees` maps default empty. Legacy `area:'room'` means the study; new room IDs are `library`, `conservatory` and `workshop`. Proposals remain pure. New actions are `{kind:'build-room',room:id}` and `{kind:'chop',id,area:'yard',x,z}`; chopping validates physical proximity. No new adapter callback or shared dependency is required.

The v384 exact app DOM and live desk projection remain intact. Additional rooms hide the projected surface without destroying its layout. Native controls, scanner listeners, inert state, scroll restoration, pause, resize, reduced motion, context recovery and disposal retain the same ownership rules. The outer home uses `overflow:clip` so focusing or scrolling an inner control cannot pan the entire fixed overlay around the projected app; the decoration panel remains independently scrollable.

## Verification

`tests/test_player_home_v385.cjs` (also run by pytest) checks migration, doubled radii, build gates/costs, ownership-safe doorway clearance, independent placements, capacity including cross-room moves, tree proximity/atomic proposals/reload/day rollover, safe regrowth relocation, 32 distinct THREE geometries, footprints, exterior additions, door targets and disposal. The existing v379 home core test remains applicable.

`tests/run_player_home_v385.cjs` exercises the actual app with disposable saves and native touch: room construction/storage retry, physical doors and walking, lore, per-room placement/rotation, expanded garden placement/move/store/zoom, tree strikes and failed-save retry, live UTC regrowth, renderer recovery and viewport alignment. Evidence lives in `/root/burbz-homestead-v385-evidence/home/`; consult its `results.json` for the current run’s authoritative outcome. Headless software WebGL is not a physical-phone performance measurement.
