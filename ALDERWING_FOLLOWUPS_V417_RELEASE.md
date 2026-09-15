# Alderwing follow-ups v417

Release candidate `alderwing-followups-v417-20260914`, based on the verified Home/opening v416. Final local and installed-update verification passed. Publication and public verification are pending until recorded by the release owner.

## Result

- Four approved bright companion paintings (Blue Tit, Great Tit, Long-tailed Tit, Goldcrest) and a discreet, usable location control beneath each card. Both reference paintings and compact transparent sprites stay intact.
- Common saved prerequisite guidance for actual building, room, recruitment, Market, Forge, equipment, care, work, settlement, home and camp requirements. It recomputes real costs/readiness and returns to the original goal through detours/reloads. Existing transactions retain spending, dispatch, feeding, claims, rollback and ownership authority. See `PREREQUISITE_COMMON_V417_HANDOFF.md` and the 34-entry coverage inventory; representative native tests do not mean every mechanic received an exhaustive play-through.
- Retained-world player tents/fires, persistent exploration, separate additional homes, enemy outposts, permanent safe light and enhanced Fireball/audio. Walking charts dim explored geography; bright liberated territory is safe. Only the real GPS adapter can award physical-visit receipts. Existing real-scale terrain, shared scene, collision and quest separation remain.
- Native Camps/outpost controls remain clear of quests/minimap/movement. Home retains full independently scrolling lists and fits the tested viewports. Saved goals stay reachable beside the real current quest; header Camps no longer covers Saved photos.

## Integration corrections

The full opening test caught asynchronous initial shelter placement opening the picker before its anchor save completed. World entry now awaits the shared profile-scoped validation promise and rechecks save, screen and cancellation; settlement footprint permits and existing anchors remain protected. Five async race groups and independent review passed; the unchanged full opening then passed six native groups.

The final Home regression caught an invented Stores-unlock prerequisite preventing owned gear from being worn. That requirement was removed: existing equipment ownership and the original transaction remain authoritative, including before Stores unlocks. Missing copies still lead to the real wearer, anvil or recipe. The new case is included in 18 common guidance groups and the native equip/unequip proof.

## Verified locally

- Cards: 9 native groups, including six actual paintings, aliases, portrait/landscape, native location/equipment actions, installed/offline paintings and preserved save.
- World intake: 40 native groups — Fireball9, exploration/GPS/homes11, outposts8, home perimeter6, terrain/Auto6 — with zero page errors. Detailed contracts and evidence in `WORLD_RELEASE_INTAKE.md`.
- Guidance: recipe12, common8 and expanded Home/current-quest4 native groups; full actual opening6. Root Home24 passes all five viewport sizes, readable equipment text, no overlapping controls, canonical equipment/feed/building actions and complete inner lists.
- Source/transactions: common guidance18, recipe persistence8, recipe graph/all36 catalogue cases, actual adapter, shared equipment12, motivated opening13, initial home race5; Fireball effects/audio/provenance/cache5 and focused offline boot/card Python4 pass.
- Final installed v416→v417: 6 groups passed with zero page errors, verifying exact document/movie, all23 changed modules, four WebPs and three Fireball clips, preserved saves, real offline New Game/movie byte-range playback, Settings cancellation, Skip and subsequent restart. An initial final-navigation timeout was rerun with a 90-second cold-navigation limit; the same runtime and unchanged save/cache/behavior assertions then passed.

Durable evidence lives in the owner's `outputs/v417-local/` and `outputs/world-release-intake/`. Earlier rejected fixture runs and the separately labelled shelter-race image are not final acceptance. Old Python string-pin failures documented in the world intake are not claimed green.

## Release boundaries and limits

All23 changed runtime modules have matching consumer and three-worker-list revisions; the existing building_rooms_core v416 lazy pin is preserved. Seven new art/audio assets are in all lists and the updater. Runtime assets are ordinary committed bytes; sparse-checkout hydration is a local test concern. Gemini's £5 Europe/London monthly budget, durable photo queue and Cornell sound are unchanged.

These are laptop Chromium/software-WebGL and viewport tests, not physical-phone GPU/FPS or actual GPS fieldwork. Retained hostile-camp turning measured mean76.24ms/p95 83.5ms; combat CPU mean1.05ms/p95 3.8ms. Fireball phase CPU maxima were mean2.05ms/p95 5.1ms;26 visible flame particles used one draw, capacity384, with121 terrain chunks. These show bounded resources, not a proven hardware speedup. Final public real-provider and installed/offline checks belong to the release owner.

The rejected 3D Merlin and separately planned September15 enemy roster remain outside this release.
