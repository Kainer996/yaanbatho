# Shutdown checkpoint — resume before release

The user requested PC shutdown and cloud continuation through the existing controls/spells and release-owner tasks. This task was instructed to commit/push its WIP, send this handoff, and pause local edits/publication. **Do not assume a cloud task has started. Do not publish this checkpoint as a finished feature.**

Branch: `codex/exploration-camps` in `Kainer996/yaanbatho`.
Base: `b30621188d9472e6621ced055558f5bf5ca74aa4`.
Local checkout: `/home/yaan/Documents/Codex/2026-09-14/burbz-exploration-camps/work/exploration`.
Local intermediate scripts/logs: `/home/yaan/Documents/Codex/2026-09-14/burbz-exploration-camps/work/`.

Release owner: Burbz visual polish implementation, task `01a0777f-3e39-7982-bf6e-15ebca86308e`. Fireball owner: `01a08d0f-de5d-7883-9cbb-838a5468371b`. Originating task: `01a0a09d-1842-7732-809f-c254d3dcd39c`. Only the release owner promotes global build/cache, reviews/merges the PR and uses the guarded `burbz-sync` deployment. Camps follow the art and Fireball releases. Fetch fresh main before integration and retain their changes. No recognizer/combat runtime changes belong here.

## Implemented in this WIP

- Sparse persistent geographic terrain reveal from actual retained-world walking and flight; realm fog and minimap integration. Teleports reveal an arrival area only. Approximately 90 m radius. No fake real GPS movement.
- Free owned camp placement on loaded clear ground, including ground placement beneath flying avatars; UUID + canonical geographic location; map pins and compact camp sheet; free fast travel with safe ground-arrival validation.
- Actual 3D A-frame canvas tent, timber platform/supports, bedding, lantern and bounded scene lifecycle/collision. Up to twelve nearby camp models stream in the existing renderer. Corrected the initially inverted roof; actual browser screenshot is committed under tests/evidence.
- Campfire costs exactly 5 real timber (`player.branches`). The tent remains useful without it. The sheet explains normal home/village tree chopping and links to the primary home clearing. Saved fire flag + debit use the same durable save and rollback. Real stone ring/logs/three flame meshes persist. Reduced motion disables flicker.
- Physical visits use `GeographicPlacesCore.arrival`: <=45 m, accuracy <=50 m, fix age <=120 s, future tolerance <=10 s, and a fix at or after camp creation. Only `handleLivePosition` calls the camp visit adapter. One atomic receipt/eligibility/reward saves 500 coins + 250 XP + 50 timber. Prior paid locations within 90 m suppress another bonus but still allow home eligibility.
- After verified visit, free house conversion stores a separate full home record on that camp. Original `playerHome` is retained. Existing house models/interiors/upgrades/rooms are reused; current home selection is ephemeral UI state, and exits pass the selected house's geographic anchor. Outdoor decoration/farm projections were added near shutdown and need browser verification.
- New script/CSS and changed consuming pins agree across all three SW lists and updater files. Global build/cache remain at the base release intentionally. Camp sheet scroll/input isolation and preserving an already-open atlas's paused movement state are included.

Read `EXPLORATION_CAMPS_V413.md` for design details. New code: exploration_core.js (pure data rules), exploration.js (compact UI, fog painting, 3D campsite model/lifecycle), exploration.css. Existing files have narrow index adapter, village_world, first_person_map and village_walk hooks. `test_home_farming_v409.py` now accepts the changed world/walk module pins; its home module/global assertions remain unchanged.

## Verified

`node public/burbz/tests/test_exploration_camps_v413.cjs` passes, including on the final checkpoint: movement/reload, dateline, revisits, no teleport corridor, physical gate rejection, reward deduplication, actual save-adapter failure/retry/reload, 5-timber fire debit, primary-home preservation, additional-home actions, real 3D mesh grounding/disposal and three-list pins.

Existing Node farming and continuous-world suites passed. Existing pytest geography/world/home/farming selection: 5 passed. In this desktop environment pytest is available via `/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/venv/bin/python`; neither system nor bundled Python has pytest.

Actual browser + actual MapLibre/Three renderer with an explicit synthetic DEM/MVT provider fixture verified native tent placement and native walking/flight terrain reveal, with unchanged real GPS and no visit rewards. Committed evidence: `tests/evidence/exploration_camps_v413/` (tent/flight screenshots and precise partial test results/source hashes). These are disposable synthetic saves, not live-player or actual physical-location evidence. The 500 km data benchmark uses ~95.7 KB/353 tiles; revisit size stays fixed.

## Immediate next work

1. **Verify/finalize the fast-travel fullscreen race fix.** Browser travel closed the old walk, then the new walk returned false with no surviving world. Instrumentation showed only the exported `close('world')`, suggesting the new session's internal fullscreen-exit listener closed it when the prior session's asynchronous `exitFullscreen()` completed. The final patch stores that promise as `closingFullscreen`, exports `BurbzVillageWalk.whenClosed()`, and awaits it before opening the next walking root. This fix is not yet browser-tested: the immediate rerun hit EADDRINUSE from the older still-running test. Local test was then stopped for shutdown.
2. Run the browser harness through free fast travel, grounded arrival, no phantom GPS visits, zero-timber rejection, two native home-tree chops (6 timber), travel back, 5-timber fire build, fire/tent/fog reload, stale/imprecise versus valid synthetic GPS, repeated event no-reward, free conversion preserving the primary home, entering/exiting the additional interior at its camp anchor, phone sheet and atlas. Later stages are coded in the harness but have not passed yet.
3. Add/execute explicit flying camp placement, separated distant camps/no fog corridor, reload/stream-out-and-return of actual camp models, save-failure retry in the browser, native real-map camp selection, and relevant offline/PWA checks. Pure tests already cover transaction failures and reward uniqueness. Verify cached offline terrain behavior honestly; existing world loading requires map data for unvisited regions.
4. Check minimap behavior preserves discovered villages and home semantics (realm atlas keeps existing village/region fog holes). Check projected additional-home farm/furniture grounding, collision and correspondence to saved edits. Current model limits are twelve nearby camp models and eighty nearest map markers; ordinary saved camp counts are not capped.
5. Remove or tidy temporary `CAMP_TRACE` browser instrumentation once the race is resolved, rerun an uninterrupted full browser pass, inspect the final camp/fire/house/map phone screenshots, and run relevant regressions. Current browser harness accepts `SKIP_MOVEMENT=1` only for debugging; do not call that run complete movement acceptance.
6. Reconcile fresh main after art/Fireball, provide the release owner a tested commit + evidence, obtain their coordinated integration, then verify deployed bytes, actual build/service worker and browser/offline/save behavior. No paid Gemini calls are needed. Update this draft and AGENTS only when the feature is actually verified and released. Report back to the originating task with the live state and concrete use/reward rules.

Local browser command (adapt package/browser paths in cloud):

```bash
PLAYWRIGHT_MODULE=/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright \
EVIDENCE_DIR=/path/to/new-evidence-directory \
ASSET_CACHE=/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/wilderness-discoveries-v406/public/burbz \
node public/burbz/tests/run_exploration_camps_v413.cjs
```

The harness uses port 8963 and `/usr/bin/chromium` by default. Existing same-origin artwork can be supplied via ASSET_CACHE; never fetch art from GitHub/LFS as a deployment workaround. Browser logs/results browser-1 through browser-9 are preserved in local work; the final browser-9 failed to start due to occupied port. Stop only processes belonging to this isolated test, never global browser processes or another task's runtime.

## Shutdown state

Local edits/publication are paused after the committed and remotely verified checkpoint. No independent cloud task, PR merge, deployment, automation or paid service has been started by this task. Remaining work is implementation verification/integration, not a user product-decision blocker. Continue through the release owner's approved cloud coordination.
