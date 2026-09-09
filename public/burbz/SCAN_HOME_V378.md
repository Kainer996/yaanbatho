# Scan home v378

Opening Burbz now presents Home: an original woodland lookout, prominent Start Sound Scan and Open Camera buttons, current tasks and village happiness. The existing Scan destination and active-walk startup exception remain. Both normal and Comic appearances support narrow phones and desktop.

The painting is fictional decorative scenery, not the player's settlement. The original generated source, mode, exact prompt and WebP encoding are recorded in [the artwork README](assets/home-v378/README.md).

## State and actions

`scan_home_core.js` derives a read-only view; `scan_home.js` escapes and renders it, retains focus on refresh and delegates native button actions. The index adapter uses existing badge counts, completed quests, actual forge completions, construction notices, current walks and `villageEconomySnapshot`. It refreshes through the existing save/badge heartbeat and screen entry, without another timer or save schema.

Only unlocked services appear. Kitchen distinguishes an unbuilt room from hungry companions. Village cards show actual residents and happiness; empty villages have no invented percentage. Three cards prioritize populated villages with lower happiness, and All villages opens the complete existing view. Actions use existing Kitchen, Hospital, Training, Forge, quest, completion-notice and village routes, rechecking gates at click time. Completion notices retain their existing consumption behavior. Opening Home never grants rewards, spends resources or advances the economy.

The actual existing scanner buttons moved into the prominent pair; their IDs and pipelines remain unique. Camera opens the native picker synchronously within the gesture, then keeps crop/upload/result handling. Sound starts only after a tap and retains its generation guards, explicit stop, background listening, return dock and privacy controls. Permission errors appear beside the primary buttons. Returning to Home does not restart the microphone.

## Verification

- Node projection cases cover honest counts, priorities, gates, invalid/empty data and input preservation. Pytest verifies atomic asset registration and artwork dimensions/size.
- `tests/run_scan_home_v378.cjs` checks the actual home, both appearances at 320/390/1280, village economy agreement, Kitchen/village/quest navigation, real quest claim refresh, fake-device microphone start/stop/background return, native picker/crop/POST, denied permission and progression gating. Identification responses are mocked; this is not a new recognition-accuracy evaluation.
- `tests/run_scan_home_pwa_v378.cjs` installs v377, automatically upgrades to v378, compares cached home modules and painting byte-for-byte with final source, reloads offline and uses Home/Kitchen/village actions. Old save/equipment and third liberation return, birdhouse claim and reload survive. The fixture has no auth-config endpoint; its one expected missing request is recorded.
- Required broad suite: 2,121 passed, 5 skipped, exactly the same 41 failure IDs as the v377 baseline; no new failures. Historical tests that expected the Scan label or the old button placement now assert the requested Home label and promoted controls.
- Public verification uses the same browser runner with `--public`, requiring six public runtime hashes to match tested source. Existing v376 village evidence additionally covers eligible manual merging. Physical-phone performance is unmeasured.

## Atomic release and recovery

Build/cache marker: `scan-home-v378-20260909`. Keep `scan_home.css`, `scan_home_core.js`, `scan_home.js` and `assets/home-v378/woodland-lookout.webp` in all three worker lists and the guarded updater. Home modules share the build query pin; the painting has its own versioned directory. Preserve unrelated module pins.

Source: `/root/burbz-interiors-v368`, branch `codex/burbz-scan-home-v378`. Evidence: `/root/burbz-scan-home-v378-evidence/`, including browser screenshots/results, PWA results, broad suite and release hashes. Recovery archive: `release/predeploy-v377.tgz`; old baseline: `/root/burbz-v377-baseline`. Publish through the existing GitHub review/merge and guarded `burbz-sync.service`, then verify exact trees, managed/public hashes, live marker, Pages and services. Never overwrite production directly.
