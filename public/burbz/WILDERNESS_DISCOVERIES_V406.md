# Wilderness discoveries v406

Status: final local checks passed; authorized publication and public verification are coordinated by the release owner.

Three small inhabited shelters and an old carved memorial can be discovered between settlements in the retained Alderwing world. Each fixed geographic cell keeps a stable full identity and position; a shelter contains its own named keeper, a furnished room, a short two-object request and readable lore. The lantern and bell repairs change their actual visible objects. Rewards use the existing coin/material inventory and are paid once after durable save. Reloads and distant stream retirement never recycle a receipt.

These are authored wilderness encounters explicitly requested by the user. They do not add decorative population, owned buildings, production, settlement claims or player housing. Their identity, inventory and authority are separate from the canonical village economy and real GPS quest progression. The same scene, real-metre geography, DEM datum, terrain joining, fog, tree prototypes, light and movement loop are retained. Safe village/town/home boundaries are preserved; outside wayside huts remains wilderness. Entered rooms pause combat like existing interiors.

## Rendering and authority

- At most two nearby discoveries join the existing prepared-place queue; the existing twelve-place total and distance retirement remain bounded. Preparation waits for complete vector loading, known full sampled ground, gentle elevation variation and no sampled road/water coverage, including the real road corridor width. Missing terrain defers creation and retains existing conservative movement behavior. Placement checks sample the footprint on a two-metre grid plus its centre; they do not claim cadastral/exact land-use accuracy.
- Meshes use existing settlement architecture, resident rigs, batching and collision. Outdoor static objects have reachable interaction points. Keeper conversations work both outside and inside the corresponding room. General owned-room loot and management actions are excluded from waysides.
- The visibility regression fix updates a translated scene's world matrices before calculating local culling centres. A focused before/after test reproduced a nearby keeper being incorrectly hidden; the fix also benefits other translated settlement content.
- Rebuilt content with the same place identity reattaches its discovery controller, preventing a stale controller after retirement. Teardown removes reparented actions, local listeners and scene resources.
- Request reads never change game state. Accept, ordered physical steps, lore and completion use separate persistent receipts. Completion adds exactly 30 coins and 2 Oak Twigs, with in-place rollback on a failed durable save and a guard against save replacement. No equipment, GPS quest, bird assignment or settlement ledger is rewritten.
- The request journal and nearby-action tray reuse existing controls. Indoors, a narrow style override permits the current keeper dialog; leaving closes it. Lantern/bell changes and keeper motion respect reduced motion.

## Verification

Evidence is stored in the release owner's outputs/wilderness-places-v406 directory. The functional fixture uses disposable saves and an explicitly synthetic decoded DEM/vector map. Local close interaction setup uses debug positioning; the separate native travel test never writes poses and steers, flies, lands, walks and returns with actual key/button input. Quiet frame-time tests use one browser on the development laptop at phone-sized and desktop viewports, without recording or concurrent CPU suites. They are not measurements on a physical phone.

The initial indoor test caught a dialog hidden by an older room style. The initial long-trip test correctly refused to land on a well; its route was corrected to use a clear existing landing site. Original failure evidence is retained. The existing equipment installation test also pinned older HUD/walking versions; the same failure was reproduced on released v405, then its expectations were advanced to the actual unchanged HUD and current walking URLs. Final test and public verification results will be appended before completion.

## Release

All changed consuming URLs, all three service-worker lists and the guarded updater use wilderness-discoveries-v406-20260914. Unchanged modules keep their existing pins. Publication uses the existing reviewed branch, exact-head merge, prior-file backup and guarded deployment. Public acceptance must verify exact runtime/cache bytes, actual native discovery/room/reward behavior and cold offline startup with saved progress.

Photo recognition accuracy and the pre-existing real GPS map performance problem remain separate unfinished work. The rejected 3D Merlin model remains paused.

Local results: 9 core/save/actual-scene groups, 8 actual placement/recovery groups, 3 room-capability groups, 6 staged building-scene regressions, 12 shared-equipment groups, 9 Market groups and 7 Python behavior/install checks passed. The final functional browser run passed 7 checks including actual indoor completion, visible keeper, one reward, lore, layouts and reload. Both complete native travel runs passed 6 checks, with no pose writes. Phone-sized mean frame times: settlement 17.44 ms, clearing 17.29, distant wilderness 17.09, revisit 17.04, return 17.65; p95 16.8–33.3 ms. Desktop means: settlement 20.60, clearing 17.91, wilderness 17.39, revisit 17.09, return 17.96; p95 16.8–33.4 ms. The final placement-only refinements add the dense road-width check and stationary loading retry; both have direct behavior tests and the final functional run. These timing windows use the corrected visibility renderer but predate those final placement-only refinements. No constant-60-FPS or physical-phone claim.

The unmodified local runtime on actual map/elevation providers passed all 5 native checks: normal Home entry, flight and walking to a visible keeper, accepted request, furnished advancing room/native movement/return, three journal layouts and saved reload. No pose or game-action debug calls were used. Screenshots of the visible keeper, room and journal were retained.

## Room title follow-up v406b

Public v406 gameplay and all 129 worker-byte checks passed, but independent screenshot review found that leaving the wayside room labelled the outdoor view with the starting village name. v406b restores the actual current location from the retained world's navigation data; the renderer and player pose are unchanged. A focused actual-room test checks the returned title, and the real-provider/public driver now asserts it after native entry and exit. Its initial wait also handles the lazily loaded walking module. Only rooms, their loader, global build/cache and relevant verification/docs change. The remaining world modules keep their v406 consuming URLs. Final public/offline acceptance is recorded in release-wayside-room-title-v406b. Original v406 visual acceptance is superseded by this follow-up.
