# Tavern and separate Village Hall — v444 candidate

Status: locally verified; not committed, pushed, merged or deployed by this preparation task.
Base: `3748a73b546a60b088e78e6c2942eb99c4472cb1` (PR387), including dashboard banners and the current-quest pulse.

- `tavern` remains Tavern: three levels, level-6 unlock, 45 coins/15 timber/zero stone base cost, 50-minute base construction, 12 joy capacity per level and existing bar services.
- `village_hall` is separate: one level, unlocked immediately at player level 1 with no additional progression prerequisites, 45 coins/15 timber/zero stone, 50 minutes, no joy or resource production. Unlocking does not grant or automatically build it: ownership, ordinary available crews, payment and completion remain authoritative. Existing completion/manager catalogue logic includes this new village building.
- The Hall uses shared `BurbzPlayerHomeScene.createCommandDesk` geometry and the existing command centre. A saved owned Hall returns to its original standalone village/town ward or geographic pose. Old `tavern` desk saves use the existing home fallback without ownership conversion or a free Hall.
- Reuses the existing entertainment painting only for the 2D card; no bird/art/data/model assets added or changed. Walkable room and civic exterior have real furniture, collision, door and footprint metadata.
- PR386 banners, scan-home module and Quests heading remain; PR387's quest-pulse CSS keeps its v442 pin in the document and all worker lists. Global build is v444 because v443 was already used.

## Reproducible focused verification

From `public/burbz`, run `node tests/<name>` for:

- `test_village_hall_desk.cjs`
- `test_tavern_hall_separation.cjs`
- `test_tavern_hall_pins.cjs`
- `test_building_rooms_v368.cjs`
- `test_room_capabilities_v403.cjs`
- `test_destination_room_cancel_v434.cjs`
- `test_dashboard_banners.cjs`
- `test_home_quest_pulse_20260922.cjs`
- `test_craft_home_repair.cjs`
- `test_player_home_v379.cjs`
- `test_player_home_v385.cjs`

Native Chromium evidence verifies actual paid Build, commissioning, Hall door, shared desk/return at 320/390/844 widths, geographic pose persistence, standalone and town-ward exits, storage-failure rollback and legacy/home fallback (21 groups). Unmodified-byte local installed current-main quest-pulse→v444 worker upgrade verifies exact cached HTML plus five modules and offline Hall round trips/save preservation (8 groups).

Private evidence/runners: `/root/.hermes/task-progress/burbz-tavern-final/`.
The 23 September immediate-unlock correction changes only the Hall catalogue gate from 6 to 1, its regression assertion and this note; all existing prices, timers, Tavern behavior and Hall routes are preserved. Fresh evidence is isolated under `immediate-hall/`: a level-1/no-quest-progress/no-existing-village-buildings fixture pays exactly 45 coins and 15 timber, starts the unchanged 50-minute timer, commissions via native interaction, enters the actual Hall, uses its shared computer and returns/reloads at 320/390/844 widths. Separate upgraded-Tavern, town/legacy/rollback and installed/offline reruns pass. The timer was advanced in the synthetic fixture, not waited in real time. The parent owns final review, latest-main reconciliation and publication after the separate 3D fix; do not overwrite that release's host/cache/loader pins with this candidate's older pins.
Native runner: `EVIDENCE_DIR=<output> PORT=8995 node <evidence>/native.cjs`.
Additional runner: `EVIDENCE_DIR=<output> PORT=8996 node <evidence>/acceptance-extra.cjs`.
Installed runner: `node <evidence>/offline.cjs` (local port8997, frozen HEAD baseline; unchanged live assets used read-only as fallback).

## Honest limits

Seeded saves, software WebGL and synthetic terrain in native tests are not physical-phone/outdoor GPS certification. Installed testing uses a private localhost origin, real worker/cache and CDP closure access without altering served/cached bytes; no public post-deploy verification is claimed. Existing Python compatibility suites return identical baseline results:12 passed,4 historical failures (old trade-handler expectations, incomplete prerequisite fixture and stale v360 marker). No full-suite-green claim. Publisher must recheck current main/build uniqueness and verify public bytes after the separately owned release.
