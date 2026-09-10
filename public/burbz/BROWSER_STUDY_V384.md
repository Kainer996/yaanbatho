# Study v384 — verification

Prepared locally on 2026-09-10; publication awaits Yaan's approval. Source branch `codex/burbz-study-v384`, based on main v383 `763f6cbb8fadedfe91d608f28beb24cb6560fb5b`.

## Actual application

`tests/run_study_v384.cjs` passes all 19 check groups against the final runtime. Served HTML, all six changed modules, the unchanged home core and the new painting match their source hashes. There are zero page errors.

Verified in both Normal and Comic appearances at 320px, 390px and desktop: readable unclipped layout and real scanner hit targets; native touch navigation through all 15 destinations; real quest claim and village state; active microphone survives stand/sit without repeated permission and Stop releases it; native file picker/crop/one upload; denied-microphone retry; beginner progression gates.

The original app, Home and scanner DOM nodes remain identical through stand, walking and seat. Actual intermediate camera/DOM frames prove both travel directions. CSS-projected corners agree with the real 3D monitor from both oblique sides. Player-value refresh updates the live room screen. Actual thumb walking and release, blur/pause/resume, reduced motion including a change mid-travel, resizing in each direction, interrupted disposal and saved reload all pass.

## Installed and offline

`tests/run_study_pwa_v384.cjs` passes all 10 groups. It installs the real v383 worker, retains an equipped bird and decorated house, automatically activates v384 and compares installed HTML/modules/art byte for byte with final source. Offline reload, native routes, active/suspended walk cards, unchanged route object, same-node stand/walk/sit, 600px scroll preservation through an outside visit and return, original purse/equipment/house retention and failed introduction-save retry all pass. The projected header retains one money display.

The local server's only missing requests are `api/auth/config` in the old/new fixtures; no required static art or modules are missing. Browser scanner-identification responses are controlled fixtures. Tests use desktop Chromium with software rendering and touch emulation; physical-phone performance and real outdoor GPS are not measured.

## Broad regression

Exact hydrated v383 baseline: 41 failed, 2,127 passed, 5 skipped. Final v384 after scroll/HUD corrections: 41 failed, 2,128 passed, 5 skipped. All 41 failure IDs are identical; zero added failures. The new dashboard core wrapper adds one passing test. Focused Home, scan dashboard, money-HUD and asset registration checks also pass.

## Findings fixed during verification

- Six-digit coin totals wrapped on 320px phones. The final stats retain exact accessible amounts without wrapping.
- Chromium reset nested scroll positions when the app moved into the monitor. The controller now captures/restores scrolled descendants in both directions, and hidden monitor views preserve layout.
- The money HUD mistook the overlaid room canvas for an overlay covering the app header. It now understands projected Home and keeps the normal header balance without adding a duplicate.
- Some initial runner taps landed beneath the fixed dock or during the existing village travel overlay. Runners now center the actual target and verify its unobscured native hit point. Initial failed evidence is retained; no runtime failure is concealed.

## Evidence

Folder `/root/burbz-study-v384-evidence/`: `browser/results.json`, `pwa/results.json`, `pytest-baseline-exact-hydrated.txt`, `pytest-final-scroll-hud.txt`, `pytest-comparison-final.json`, `final-runtime-hashes.json` and appearance/room/transition screenshots. `preview/study-home-house-preview.mp4` shows a real native-touch Home → Stand → walk → Sit journey; the raw WebM is retained and the export trims only startup, without changing speed. The image prompt and provenance are in `assets/home-v384/README.md`.

Required pre-change public artwork check: 1,545/1,545 required images served real bytes; the existing optional rook-witch cutout remains absent with the game's painting fallback. This preparation has not changed production.
