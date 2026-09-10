# Illustrated field stories — v385

On-foot villages and town squares now share the original saved request/loot record and three additional local field stories. Twelve new authored stories cover a welcome chime, returning lantern, three-colour casket, waymark repair, keepsake bowl, ivy window, bell tuning, sealed reply, quiet pebble game, returning ribbon, practice mechanism and leaf-stone keepsake. Each has three separate reachable world objects: inspect the clue, prepare the object, then make a choice using the recorded clues. A wrong answer offers a specific hint without spending anything or advancing the story.

Each completion unlocks its own readable memory and pays its listed modest reward once (8–10 coins, sometimes one existing material). That adds 36 authored checkpoint interactions and twelve distinct memories alongside the original fifty requests and thirty scrolls. Field notes remain readable in the journal between stages. Completed sites retain a warm restored appearance and a feather keepsake seal after leaving, reentering or reloading. Nothing changes settlement population, homes, needs, stores, tax clocks or growth.

## Saved-state contract

The original `questId`, `accepted`, `step`, `completed`, `giver`, `loot`, `lore`, `collected`, `read` and `placementSeed` remain unchanged. Original first-fifty assignment and loot/scroll decks remain untouched. `core.activities(record)` derives three stable assignments from `placementSeed + ':fieldwork:v1'`; reading a legacy record does not mutate it. The v1 selection pool is fixed to IDs `vf01`–`vf12`, so later appended content cannot reroll saved sites.

An action `adapter.act('activity', 'vf01:0', choiceId)` runs through the existing atomic `villageDiscoveryAdapter`. Only valid ordered interactions add `record.fieldwork.vf01 = {step: 1}`. The third interaction requires the authored answer. Invalid, duplicate and out-of-order actions return null; a valid wrong answer returns explanatory text with no mutation or reward. The final progress flag and inventory reward commit in the same durable transaction. Failed persistence restores both; failures updating the HUD after commit cannot undo a paid reward.

Town entry must use its actual canonical ward seed with that same adapter. A town and its ward therefore cannot reroll or double-claim the same discovery. The request post remains usable where there are no real residents; only actual saved Peeps are offered as speakers.

## Rendering and HUD

`assets/discoveries-v385/alderwing-objects.webp` is one original generated 1254×1254 RGBA atlas containing sixteen painted objects. It replaces the anonymous floating symbol discs. Original request checkpoints choose relevant illustrations from their actual labels; scroll and loot identities remain their original saved IDs. Explicit UV rectangles accommodate the artwork's irregular packing without modifying the source painting. The browser keeps geometry fallbacks until loading succeeds.

The previous marker sprites blended their colour without writing depth. The new materials use `transparent:false`, `alphaTest:0.5`, `depthTest:true`, `depthWrite:true`. Three's opaque branch forces surviving fragments opaque while alpha discard leaves the silhouette's holes out of the depth buffer. Walls occlude the cutouts, and the manga pass outlines the painted silhouette instead of an invisible square. One source image is shared by the atlas texture views. Every texture/material/geometry is tracked and disposed; a late image callback after leaving cannot restore the scene.

`discoveries.hud()` supplies `{title, objective, completed, step, total, lootFound, lootTotal, loreFound, loreTotal, activitiesFound, activitiesTotal, bearing, distance, direction}`. The shared first-person HUD owns permanent controls, reusing `.vd-interact`, `.vd-journal` and `.vd-guide`; this module owns only the `.vd-panel` reading/choice surface and discovery-scoped stylesheet. Selecting Follow this story points the tracker to the actual next object. E and J preserve their previous native interaction paths.

## Evidence and asset provenance

`tests/test_village_fieldwork_v385.cjs` exercises 300 complete field stories and 900 ordered interactions, every new definition, stable legacy assignment, informed/wrong choice handling, duplicate prevention, exact catalogue materials, reload, and real index-adapter storage failure/retry with a final reward. Its pytest wrapper includes these checks in the broad suite. The original 2,200 lifecycle discovery suite continues to pass.

Full original image prompt, source path, rejected checkerboard variant and encoding details are in `assets/discoveries-v385/PROVENANCE.json`. The selected source was encoded losslessly to WebP, preserving its alpha and size. The rejected edit is never referenced by runtime. Runtime fetches only the same-origin final atlas.
