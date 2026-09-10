# Enchanted study and live command desk — v384

The home screen uses a new original medieval study painting: carved oak, candlelight, feathers and a little turquoise magic. Cream type, parchment action cards and woodland navigation fit the existing game. The same live application becomes the house monitor when the player stands; sitting returns that exact screen to full size.

## Player information and navigation

The field desk shows actual player level, coins, companions and discovered species. Tutorial coin hiding applies to the desk as well as the existing HUD. A current walking quest shows saved distance and reached checkpoints; active side quests show distance and unclaimed finds; a paused original or saved detour remains visible with an honest saved-progress message. The Continue control returns to the existing map.

Ready quest/training/forge claims and companion food/treatment needs use the existing action-badge/economy snapshot. The next player quest has a direct action. Village cards show actual residents and happiness. Fifteen destinations cover map, quests, birds, Academy, Empire, battle, Kitchen, Hospital, Training, Forge, Stores, ranks, diary, profile and settings. Existing progression gates decide which appear and are checked again when pressed. Native scanner controls retain their IDs, gesture handling and sensor permissions. No home render awards rewards or spends resources.

## The same screen in the room

`player_home.js` moves the existing `#app` node into `.ph-screen-surface`, preserving every listener, scanner node, state value and scroll position. Its CSS matrix is derived from the actual THREE camera projection and the modeled screen plane. The room canvas is alpha-enabled; a depth-tested, non-blended transparent aperture in the monitor exposes that live DOM only where the real screen is visible. Furniture and walls occlude it normally. There is no screenshot, duplicate dashboard or parallel game state.

Stand and Sit each use 1.55 seconds of eased camera travel. During travel the room controls fade out; the camera begins/ends where the monitor fills the viewport. Once standing, actual thumbstick/keyboard movement remains available, and the chair, monitor or contextual interaction seats the player. The projected app is inert while walking so gestures cannot accidentally trigger scans or game actions. Closing restores the same app node and its focus/scroll. Scrolled descendants are captured/restored around both DOM moves; hidden monitor views retain layout so an outside visit cannot erase the screen position. The existing coin HUD understands the room projection and does not add a duplicate balance over the monitor.

Resize retargets the camera and the viewport aspect; blur/background pauses travel, reduced motion skips it, navigation/disposal restores the app, and graphics failure exposes recovery controls. Existing house upgrades, decorations and saves are preserved. Personal-home state remains separate from settlement ownership/economy.

## Assets and installation

Build/cache: `enchanted-study-v384-20260910`. Changed modules `scan_home.css`, `scan_home_core.js`, `scan_home.js`, `player_home.css`, `player_home_scene.js`, `player_home.js` use this pin in index and all three service-worker lists. The unchanged `player_home_core.js` stays on `player-home-v380-20260909`. The new `assets/home-v384/enchanted-study.webp` is included in every offline/install list and the guarded updater; it is 1536 × 1024 and 365,308 bytes. The previous home artwork remains available for older installed-client fixtures.

Artwork source, tool mode and full prompt: [assets/home-v384/README.md](assets/home-v384/README.md). The built-in generator did not expose a model-version selector; no exact model version is claimed.

## Verification and publication

Focused core checks: `tests/test_scan_home_v384.cjs` (also pytest), the existing home/scan cores and asset registration tests. Browser evidence runner: `tests/run_study_v384.cjs`. Installed-update runner: `tests/run_study_pwa_v384.cjs`. Results and screenshots are stored at `/root/burbz-study-v384-evidence/`; the final verification record records authoritative outcomes and limitations.

Worktree `/root/burbz-study-v384`, branch `codex/burbz-study-v384`, based on v383 main `763f6cbb8fadedfe91d608f28beb24cb6560fb5b`. Publication is pending; publish only through the existing GitHub review/merge and guarded sync process after Yaan's approval. Preserve the unrelated `videos/friend-shaped.mp4` working-tree difference.
