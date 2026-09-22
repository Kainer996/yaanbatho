# GPS shelter, permanent house and swimming — v439 candidate

Building a house replaces the temporary shelter with the permanent house at the player's chosen coordinates. Only the temporary shelter follows a fresh real GPS fix on door entry. A built house never follows subsequent GPS changes and is shown at its exact saved anchor on the real quest map.

The temporary room is a muted, rough 3.4 × 4.6 m shack around the existing desk and computer. Its room bounds, desk, chair, spawn and doorway use shared dimensions; furnishings that no longer fit remain owned and available in storage. The exterior is a small patched timber shack. A temporary clearing around the GPS anchor reserves a level, walkable doorstep even where procedural village scenery overlaps; this affects private travelling-scene copies, never the settlement's paid building ledger. Ordinary scenery returns after replacement.

Home-door entry starts on foot instead of resuming an occupied flight. An occupied craft is docked on verified clear ground beside home; deliberately parked craft retain their chosen parking coordinates. Missing, denied or stale GPS leaves the temporary home open with a retry message. Navigation/profile changes and a house built while GPS is pending cancel the old handoff. Concurrent initial GPS anchoring is tolerated without losing other home fields.

Craft landing accepts loaded, physically clear flat surfaces, including water and mixed shorelines. Full-hull flatness and swept descent still reject solid obstructions and unknown terrain. Pedestrian river/path restrictions no longer decide craft landing, and nearby collision coverage is independent of far-away scenery loading. Water exits put the player beside the boat in swimming mode, with a low camera, movement, shore transitions, re-entry from shore and nearby reboarding. Craft and traveller saves remain atomic, including failed-save rollback.

The document, nine changed runtime modules, their lazy loaders and all three service-worker lists use `gps-shelter-swimming-v439-20260922`.

## Validation

- Twelve focused Node test files pass: GPS/house/swimming, house-entry/landing, craft core, craft save, wounded craft control, home core v379/v385, farming, house quest goal, geographic core, flight controls and starter craft parking.
- Native browser house flow: fresh GPS, real door handoff despite a saved flight, forward walking, moved GPS, a GPS fix inside village scenery, actual 25-timber build confirmation, fixed house entry without GPS, and exact real-map marker after reload.
- The seven native house/map scenarios also pass with real OpenFreeMap and Mapterhorn responses (124 provider requests), including a GPS fix inside a village and the saved marker after reload.
- Native water flow: fly through streamed terrain, land on a rendered water polygon from 30 m, exit into water, swim away, reboard, reach shore, swim back and retrieve the same boat.
- Existing v438 native regression: 12 groups pass, including blocked-landing feedback, cruising-height landing, rejected-save rollback, touch Auto, five viewports, house quest entry and reload.
- Installed v438 → v439 update: complete shells, exact document/nine-module cache hashes, and offline native shelter entry with inventory, unfinished quest and craft/journey preservation pass. Disposable Chromium profiles use `/dev/shm`: root-disk storage pressure had evicted an earlier test registration/cache.
- Two historical fixtures still fail before exercising this change (`inputLocked` and `empireSettlementsInfo` are missing from their VM stubs). The same failures were reproduced against unchanged v438 source.

Evidence: `/root/burbz-gps-shelter-swimming-evidence/`. Controlled GPS is explicit: this server's Chromium returned `POSITION_UNAVAILABLE` even with granted CDP geolocation. Software WebGL and browser fixtures do not certify physical-phone GPS accuracy. Publication and production verification are still pending.
