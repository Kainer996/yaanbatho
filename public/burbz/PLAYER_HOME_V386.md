# Connected home v386

Home state is version 3. The new `anchor` is either null or `{lat, lon, revision, source}`. It is separate from `lastKnownHome`, which remains the last real device position. Home anchoring never updates GPS, real walking quest progress, map collection reach or settlement ownership.

The core accepts `{kind:'anchor', lat, lon, source:'initial'|'chosen', expectedRevision}`. An initial anchor is allowed only while none exists. A chosen location must match the current revision (zero before the first anchor); successful placement increments it. Coordinates must be finite numbers within the supported map bounds, latitude ±85.0511287798066 and longitude ±180. There is no automatic fallback or silent coordinate clamp. The existing durable home adapter owns saving and rollback. Relocation spends nothing and retains all room, decoration, inventory, discovery and daily tree state.

The controller exposes these bound callbacks:

- `enterWorld({anchor, localPose, area, isCurrent, release, returnOptions})` leaves the study or the native garden editor. The default outside pose is `{x:0,y:0,z:4,yaw:Math.PI,pitch:0}` in home-local metres.
- `chooseHomeLocation(...)` receives the same handoff fields from **Move home on the map** in Home options.

Both reset and block home movement during the callback. The receiving adapter loads and validates its destination, checks `isCurrent()`, and calls `release()` immediately before transferring ownership. Release closes the old home renderer with reason `world` or `home-location`. Throwing or returning false before release leaves the home available for retry. An old asynchronous completion must not open a view after `isCurrent()` becomes false. `returnOptions` records the current home mode, room and local pose for cancellation.

`BurbzPlayerHome.open('room', {fromDesk:false, area, pose})` returns through an ordinary room/house entry without the command-desk stand animation. The pose is checked against current collision. `open('yard', {fromDesk:false, pose, decorate:true, returnToWorld:true})` opens the existing native decoration catalogue; leaving edit mode or using Back returns to the geographic world. Fresh-home onboarding retains its original clearing and desk steps. The existing Stand/Sit route keeps the same live application DOM, projection, scroll, listeners and media ownership.

`BurbzPlayerHomeScene.createYardContent(THREE, home, options)` returns the original modeled home, upper rooms, trees, decorations and discoveries as one local `group`, without a finite island, sky, lights or renderer. Coordinates use one unit per metre, x east, y up and z south. The geographic owner positions the group at the saved anchor and supplies terrain and light.

The returned object includes:

- `allowed(x,z)` and `world`: snapshot-day ground collision without an outer boundary; the house, furniture and surviving trees remain solid.
- `targets`: semantic `{kind:'home'|'tree'|'find', id, x, y, z, label, range}` records. Recheck the latest home state when acting and rebuild content after a committed change.
- `solids`: bounded `{id,x,z,w,d,minY,maxY}` boxes for the house, furniture, trunks and canopies.
- `entrance`, `radius` (the preserved clearing), `blendRadius` (an eight-metre terrain margin) and `day`.
- `dispose()`: removes the group from its parent and releases all owned geometry, materials and textures.

The optional `now` freezes tree geometry/collision to one UTC day; `portrait:false` permits pure THREE tests without image loading. The geographic owner handles live day changes and safe relocation on regrowth, using the same rules as the existing home controller.

`tests/test_player_home_v386.cjs` and its pytest wrapper cover migration, anchor validation, stale initial/manual updates, unchanged possessions and tree receipts, unbounded connected collision, shared actual THREE content and disposal. Existing v379/v385 home core and model regressions remain applicable. Browser integration, location permission, geographic camera ownership, failed durable relocation and installed/offline verification belong to the complete connected-world release proof.
