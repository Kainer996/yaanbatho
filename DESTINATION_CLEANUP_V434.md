# Destination walks and Alderwing cleanup — v434

Build/cache: `destination-cleanup-v434-20260921`.
Base: `b653c92828e82b270b6ea06c498846efa6450c97` (v430 / PR373).

This release integrates the preserved destination-quest implementation and cleanup commit `17b81ca`. The old destination orchestrator process tree was stopped before taking a source snapshot; the original checkouts and evidence remain intact. Only intentional game code, tests and release notes are included.

## Player changes

- Main Quests plan a start-to-destination walk on mapped public walking paths. Start uses precise browser GPS when available, or a manual/map choice. The preview shows distance, evidenced elevation (or an explicit neutral fallback), and the exact saved reward. Previous walks remain Side Quests with their existing saves and rules.
- Begin saves buildings, characters, common-bird meetings and the ordered timeline before departure. A player can pocket the phone or take another route. Finishing the real walk is an explicit confirmation, separate from reviewing/completing the story. Visits, three distinct same-species meetings, rewards, retries and the completed archive use canonical, atomic receipts.
- Saved building visits open the game's furnished room renderer as a guest, before recording the visit. Kitchen access does not invent Academy ownership: visitors can inspect the room and use the bird feeding guide/registry; an already-built kitchen opens the existing feeding table. Loading failure, save failure or cancellation leaves the visit retryable. Old asynchronous completions cannot close a newer walking session.
- Village pickups use geometric chests, with glow only for unopened grantable loot. Lore/request markers are quiet geometry. Quests accept/finish in person, with clearer objectives/rewards and charcoal discovery sheets. Interior entry pauses discovery controls and restores them on exit.

## Verification

- 22 combined native destination-browser assertions passed with zero page exceptions: actual browser geolocation callback (emulated fixed public Hyde Park coordinates), native map pan/taps and manual endpoints, ordinary configured routing providers, Begin, reload, offline timeline, honor finish, failed-save retry, furnished room plus native service, dialogue, three meetings/unlock, exact reward payment, duplicate protection, archive, stale cancellation and denied GPS.
- Real configured Overpass response: 207 m / 12 points via `overpass-api.de`; Mapterhorn measured 7 m ascent. No provider override, private location, real-player save, paid recognition request or backend change was used.
- 24 cleanup visual/action and 30 quest/UI/save browser checks passed on the combined source. Explicit synthetic flat-world fixtures; real Chromium input/renderer and native transaction surfaces.
- Destination route/state/UI/readiness groups: 32 passed; separate guest-load cancellation/session-ownership regression passes. Existing quest overview, 22 pocket/transaction and 16 walking-encounter groups pass. Discovery claims18, village fieldwork/content and walking-loader checks pass.
- 71 consuming URL / three-worker-list / updater checks pass. All executable inline scripts parse; `git diff --check` passes.
- Installed v430-to-v434 upgrade passes: actual new worker takeover, preserved existing save/inventory/Side Quests/inversion, exact document plus 12 runtime/style cache hashes, offline ordered timeline and native furnished guest-room entry. The harness explicitly waits for controller replacement before going offline.

## Limits

Browser checks use laptop Chromium and phone-sized/touch emulation, not a physical outdoor walk. Destination browser proof uses test basemap tiles to bound software rendering, while routing and elevation requests use the real configured providers. Public path data is advisory; unavailable routes fail honestly, and unavailable elevation uses neutral rewards. The browser does not promise background GPS tracking.

The cleanup handoff's synthetic frame-time median was unstable (some 16.7 ms versus 33.3 ms runs); scene lifecycle, resource disposal, controls and geometry checks passed. This is retained as a performance measurement limit, not represented as proof of equal hardware frame rate.

Publication follows a reviewed PR and merged immutable SHA through `/usr/local/bin/burbz-sync`, with its live-drift guard intact. Measured staging capacity before merge: 10.47 GB free; managed app 2.09 GB. No art, provider credentials, photo/sound policy or live files are edited directly.
