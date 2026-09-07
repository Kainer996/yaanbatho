# Illustrated world v366 — combined validation

Release integration, 7 September 2026. Geographic map final handoff and live promotion remain pending while this record is assembled.

## Collection and atlas

`run_illustrated_world_v366.cjs` loads the real integrated game into disposable localhost browser storage. The existing food migration runs before the snapshot; no real player storage, account, location or tutorial is reset. Native Chromium, 390×844 portrait and 1280×800 desktop, both Normal and Comic appearances.

Passed: compact mode/rarity/family controls; pointer filters; visible actual health/fullness; card-root Enter flip and inert back/front; nested Feed without flip; browser Back closes Feed; actual Academy activity navigation without a second modal; locked species do not reveal facts (including a direct unknown preview attempt); Escape closes bird information and restores focus; sourced facts precede a folded game-details section; both themes; coins, XP, names and inventory unchanged by viewing/filtering. The reverse measured 504px client height and 504px scroll height with placement folded. Generated art is loaded from same-origin WebPs. No uncaught browser errors.

Atlas: existing real saved village/frontier markers consume the generated atlas; Me/World controls update their pressed states and world zoom hides frontier markers. Marker coordinates/anchors, tier visibility, labels, difficulty, ownership and actions stay with the existing map model. Map bounds fit above the actual dock in phone and desktop layouts. No synthetic buildings, resources or rewards are added by illustration. The disposable village/GPS fixture is not a claim about a real player's location or holdings.

The focused Node check validates education identity/legacy aliases, HTML escaping, absence of generic placeholders, missing-section handling, official source domains and all three offline/updater registrations. Existing location, Personality, appearance and village core tests: 10 passed. Existing global-money HUD contract tests also run for the map-transform observer optimization. Runtime inline scripts parse and `git diff --check` passes.

## Walkable village, integrated snapshot

The feature owner ran `run_village_walk_20260907.cjs` against the integrated index and assets on localhost8872. Native fullscreen; WASD/mouse/arrows; simultaneous two-thumb move/look; rotation; fullscreen fallback; save/building-copy/level/camera/focus preservation; browser Back; blur/pause; four reentries; simulated context loss all passed. No page/shader errors. The borrowed renderer remains the same context and geometry/textures stay exactly607/22 across reentries.

Intel Iris Xe through hardware ANGLE: warmed desktop58.38fps, mean17.13ms/p9516.8ms; phone-layout portrait59.66fps, landscape59.22fps. These are desktop browser measurements and phone emulation, not physical-phone or locked60fps claims. Full feature design, fallback/collision/LOD contracts and earlier five-layout checks: VILLAGE_WALK_20260907.md.

## Sources and reproducible evidence

- Main runner: tests/run_illustrated_world_v366.cjs. QA_URL defaults to http://127.0.0.1:8872. Set PLAYWRIGHT_MODULE to the installed Playwright package; EVIDENCE_DIR selects output.
- Main evidence on authoring laptop: task outputs/follow-up/v366 (results.json, birds-portrait/desktop, card-reverse/comic, bird-information, empire-portrait/desktop PNGs).
- Integrated village evidence: ../burbz-3d-village-exploration/outputs/combined-v366 (results.json and desktop/portrait/landscape screenshots).
- Bird facts: BIRD_FACTS_V366.md and source links on every JSON record; artwork generation prompts: assets/illustrated-world-v366/README.md.

All QA browsers close in finally. The coordinating QA server is stopped after the final combined checks.
