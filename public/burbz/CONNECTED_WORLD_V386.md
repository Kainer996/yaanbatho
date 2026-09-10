# Connected geographic world — v386

The house door opens into a geographic homestead. Walk beyond the clearing on the same real landscape used by the quest map, or spread your wings to travel farther. A metre of avatar motion is a metre of geographic travel. The outdoor scene uses actual OpenFreeMap roads, water and building footprints, Mapterhorn elevation, and the game's existing village seeds and town centroids.

## Home and travel

- The first accepted device location anchors a new home. Old saves did not retain the original install coordinate; they adopt their valid saved real location once. Missing or malformed locations never become a fabricated home. A player without location can explicitly choose a place on the map.
- **Home options → Move home on the map** opens a dedicated map picker. Use **Use my location** for a fresh device-position preview, or move its crosshair, then choose **Place my home here**. Location permission is requested only by that button; the preview does not relocate the house or advance a quest. Rooms, decoration ownership and local placement, discoveries, tree receipts and wallet survive. Moving is free and does not replenish daily resources.
- Leave the real house door to enter its actual yard content on the world map. There is no boundary portal at the old garden radius. Return through the house doorway for the original study, live command desk and built rooms. The native decoration editor remains available at home.
- **Walk & fly** on the quest map resumes the saved virtual journey. Home and exploring markers use separate identities from the real phone marker. The locate control returns the map camera to the phone.
- WASD/the left pad moves; drag or arrow keys aim. Flight reuses Academy motion, with geographic cruise speed 18 m/s and climb speed 6 m/s; the Academy retains its own defaults. Looking and altitude are independent. Land close to verified, clear ground. Geographic altitude is limited to 400 m above ground.
- Nearby settlements retain their canonical saved IDs, ward building/home IDs and residents. Their geographic approach models are a compact authored layout of actual paid construction. Entering a settlement opens its established detailed Walk, rooms and activities; returning restores the geographic arrival pose. This does not claim that a compact game village is a surveyed real-world building plan.

## State and authority

`playerHome.version=3` preserves v2 home data and adds `anchor:{lat,lon,revision,source}`. The pure anchor proposal validates real finite coordinates and rejects stale revision writes. `commitPlayerHomeAction()` commits home, timber and relocation's journey reset in one durable write with rollback.

`worldJourney:{version:1,anchorRevision,pose:{lat,lon,altitude,yaw,pitch,mode}}` is separate from `lastKnownHome`, `liveMapLastPosition`, device accuracy and fix timestamps. Saving an outdoor session checks the active save object and anchor revision. Virtual walking/flying must never call the GPS update or quest-fix entrypoints, forge physical distance, discover real-walk trades or grant GPS-gated pickups. Existing village activities retain their existing authority.

Rendering projects into a floating local metre frame: x east, y up, z south. Longitude wraps at the dateline; the map's Mercator latitude limits are validated. Native terrain stays at exaggeration 1. The authored homestead/settlement plots are raised and blended into verified terrain so their local floors remain walkable; surrounding geography remains native. Missing DEM is not a zero-height fallback or proof that unloaded ground is empty. Building and water collision uses loaded provider footprints; absent or inaccurate provider geometry is not a surveyed collision guarantee.

## Offline and resource limits

The existing app shell service worker includes the new modules and the pinned local MapLibre renderer/CSS in all three installation lists. A renderer download must succeed before a new installed worker can take over. Failed map-library loads reject cleanly so retry remains available. `geographic_cache.js` independently caches visited OpenFreeMap/Mapterhorn data with bounded metadata and tile storage, so shell updates do not delete useful map coverage. Unvisited terrain still needs a connection. Terrain absence is shown and motion waits safely; a cached app shell alone does not establish cached world coverage.

The world controller owns one dedicated MapLibre session and its shared THREE custom layer. Native map tiles stream through MapLibre; nearby authored models, terrain samples, mapped collisions and woodland detail are bounded. Forced navigation/save replacement disposes the renderer and inputs; ordinary exit preserves failed-save recovery. Browser-hidden sessions stop interactive updates. Provider/source credits remain visible, with elevation notices in [the terrain credits](data/geographic-terrain-credits.html).

## Verification and recovery

Pure tests cover geographic transforms, dateline/poles, save validation and relocation retention, swept movement/flight/landing, missing terrain, canonical building identities, source cache behavior and disposal. Integrated browser, installed/offline, performance and publication results are tracked at `/root/burbz-connected-world-v386-evidence/`; consult its final release record for the verified source and any limits. Browser emulation does not establish real-phone or outdoor-GPS performance.

Base release: v385 `87298ff442c4e5d1db2f62355829ce0b781244c7`. Prefer a forward correction after release: an old home normalizer can discard the new anchor. Preserve an exported save before downgrading. Existing media is reused by exact local hash; the unrelated video working change is excluded.
