# Your home in Alderwing — v379 / v380

A new player arrives above a small woodland clearing. Merlin introduces the shack, invites a house tap, and leads into a first-person room. Walk to the medieval brass-and-timber command desk and sit: its screen matches the viewport aspect, and the camera approaches until that screen fills the phone or desktop. The existing Scan/Home interface is the command centre. Returning launches open there without starting media capture, including when a walking quest remains saved. Stand up returns to the desk chair; walk indoors, leave through the door, explore the clearing or use its overview.

## Personal progress

`player_home_core.js` owns a small versioned personal-home record: introduction stage, house tier, decoration inventory/placements and discoveries. It does not create a village, resident, job, claim or production timer. Existing saves receive a finished introduction; new and interrupted introductions progress through welcome → house → desk → done. Cloud imports normalize the home record and close a stale rendered home before refreshing the replaced save.

The shack grows into a cosy cottage for 25 timber and a stone hearthhome for 60 more. Eight decorations can be made with existing timber: bench, flowerpot, lantern, birdbath, rug, armchair, bookshelf and tea table. A starter bench, flowerpot and rug cost nothing to place. Decorating presents an overhead plan: select a decoration, tap the ground, rotate if desired, then confirm. Tap placed furniture to move or put it away. Clear routes to the desk and doorway, the house's future footprint and outdoor discovery spaces are reserved. At most 32 placed decorations keep rendering bounded.

Eight fictional home discoveries have physical objects and journal entries. One grants a flowerpot once; the others add lore. They do not award repeated currency or village progress. The adapter commits home changes and the actual timber balance in one durable save, restores memory on storage failure, and does not roll back a committed save if a subsequent display refresh fails.

## Rendering and input

`player_home_scene.js` builds the clearing with the same `BurbzSettlementModels`, room furniture, manga rendering and local-clock daylight grade as the villages. The existing Merlin cutout and room assets are reused. Foreground canopies fade in the overhead view so garden furniture remains visible; first-person exploration restores them. Indoor decorating clips the ceiling into an overhead plan. The monitor is real modeled geometry with a generated canvas face, brass frame and keyboard, rather than a pasted UI screenshot.

`player_home.js` owns one disposable renderer and animation loop. It reuses `BurbzVillageWalkCore` for movement/collision. WASD/left thumb walks; drag looks; E/F or the contextual button interacts. Input resets on release, blur, resize, modal panels and view changes. Background content is inert, Tab stays within visible home controls, and Back closes a panel before leaving a room. Hidden/blurred views pause; context loss stops rendering and offers retry or the command centre. Close aborts listeners, disposes scene/material/texture and manga targets, releases the renderer and restores background focusability. Late loads check generation before creating a scene. Reduced motion skips camera travel.

The existing scanner buttons, sound session, background listening and photo crop/upload remain on the command centre. Opening the home or desk does not request microphone, camera or location permission. Later-game decorating/menu controls stay out of the initial welcome.

## Verification and bounds

- `tests/test_player_home_v379.cjs` covers migration, placement/move/store, reserved paths, costs, finite balances, upgrades, duplicate discoveries and invalid saves.
- `tests/run_player_home_v379.cjs` exercises fresh welcome, actual house tap and keyboard walk, portrait/landscape monitor, computer transition, reload at the desk, stand-up/outdoor return, real decoration placement/rotation/move/store, upgrades/reload, once-only gift, storage rollback, real touch thumbstick, renderer pause, graphics context-loss/retry and night grade. Screenshots include 320/390/1280, indoor plan and night clearing.
- `tests/run_player_home_pwa_v379.cjs` installs v379, upgrades automatically, checks all four cached home files against final source bytes, opens/walks/decorates offline, reloads the placement and keeps existing saves/equipment. Third-village return/claim/reload remain covered. The fixture's missing auth-config endpoint is expected and recorded.
- Broad suite: 2,123 passed, 5 skipped and the same 41 existing v378 baseline failure IDs; no new failures. Subsequent small cloud/post-save changes receive focused checks. Physical-phone performance and outdoor play are not measured by headless software rendering.
- Public runner uses `--public`, checks six runtime hashes, injects disposable test saves and enables only the existing local QA positioning/context-loss hooks in its intercepted copy of the controller. Gameplay is the published source; touch/movement, transactions and persistence remain actual handlers.

## Release and recovery

Build/cache: `player-home-v380-20260909`. v380 keeps the command-centre bar within narrow phones by hiding its secondary label there; desktop text can shrink safely. This fixes an overflow found by the final live scanner check after the v379 home journey passed. Include `player_home_core.js`, `player_home_scene.js`, `player_home.js` and `player_home.css` with matching query pins in the entry page, all three worker lists and the guarded updater. Keep the shared rooms/walking dependencies on their existing `map-pictures-v374-20260908` cache pins. No new raster assets or recognition backend are required.

Source: `/root/burbz-interiors-v368`, feature branch `codex/burbz-player-home-v379`, final correction `codex/burbz-home-phone-fix-v380`. Evidence: `/root/burbz-player-home-v379-evidence/`, including browser/PWA reports, screenshots, tests and publication record. Retained checkouts `/root/burbz-v378-baseline` and `/root/burbz-v379-baseline`; recovery archives `release/predeploy-v378.tgz` and `release/predeploy-v379.tgz`. Publish using the existing GitHub merge and guarded `burbz-sync.service`, then verify exact trees, live marker, complete managed/public hashes, Pages and service health. Do not overwrite production directly.
