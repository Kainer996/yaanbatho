# Map trails v381

Release: `map-trails-v381-20260909`.

Lantern Post and Wayfarer’s Rest story checkpoints now have physical models; the wandering tavern uses the shared settlement tavern mesh. These follow exact current checkpoint/tavern coordinates and join the existing bounded two-draw geographic details layer, with verified DEM elevation, viewport culling, night lighting and disposal. Existing waypoint/story/tavern actions remain authoritative; decorative models grant no ownership or rewards. Existing enterable wayside cabins/lodges remain separate.

The active quest draws two dotted gold edges six metres either side of its saved centreline. `map_trail_core.js` computes physical offsets, handles duplicate points, corners, retraced paths and the date line, and bounds sharp joins. The canonical `burbz-quest-route` source, saved coordinates, checkpoint positions, walk distance and certification stay unchanged. The new `burbz-quest-route-edges` source is presentation only and clears on completion/abandonment.

All map gathering uses the yellow circle's 185 m radius. Its geodesic outline and claim guard share one constant. Claims require valid GPS no older than two minutes and accuracy within 60 m. Daily items, starter timber, woodland timber and side-quest chest/weapon claims cannot pay outside the circle or without location. Starter bundles stay safely inside. Distant side-quest items remain at their saved coordinates; finish/automatic return cannot bank them and keeps the side quest active for collection. Lore and conversations with met NPCs are not item gathering.

Walking treasure uses exactly 45 m, including old saves and closely spaced checkpoints. Previously a missed earlier flag suppressed chest intents at 11 m while tapping only repeated “within 45 m”. Chests now emit at most one proximity intent per fix independently of earlier flags; the existing durable chest transaction owns rewards, receipts, reached flags, rollback and duplicate protection. Other waymarkers remain ordered and finish still requires every checkpoint. A nearby chest tap retries the same fresh accurate fix through the real handler. No fabricated position is used.

## Checks and recovery

- `tests/test_map_trails_v381.cjs` / `.py`: reported 11 m regression, exact 45 m boundary, bad fixes, duplicate prevention, 185 m outline/range agreement, six-metre edges at several latitudes/turns/date line, immutable coordinates and finite volumetric meshes. Old quest core fails the regression.
- `tests/run_map_trails_v381.cjs`: disposable real-provider browser map, buildings/terrain/night/phone views, actual chest tap, rewards/save/reload and gathering guards; `--public` checks runtime bytes first.
- `tests/run_map_trails_pwa_v381.cjs`: installed v380→v381, exact cached modules, active quest coordinates, offline chest claim/reload, earlier flag retained and home/equipment retained.
- Evidence: `/root/burbz-map-buildings-v381-evidence/`. Browser phone emulation and controlled geolocation do not establish physical-phone outdoor accuracy.

New map_trail_core and changed quest/details/place modules have v381 queries in index and all three worker lists; the updater includes the new module. Unchanged home modules retain v380 pins. Publish through guarded sync only; retain v380 source and predeploy archive for recovery.
