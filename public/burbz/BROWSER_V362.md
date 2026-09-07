# Appearance and walking quests v362

This release starts from quest commit `dd3a0626d685b9bba22784c2f14341a8d6f93445`, which includes woodland polish `754d6846`. Main was `f0a80ac` (v359). No merge conflict or quest-workspace edits were required.

Settings → Appearance offers **Normal**, the polished woodland style and default for old saves, and **Comic Book**, the original bright v359 design. Both styles remain loaded with exclusive root/body selectors. Switching uses the existing durable save; only `settings.appearance` changes, a failed write restores the previous choice, and no new account/storage system is introduced. Default, migration, restart, unrelated settings/progress and failed-write behavior have Node coverage.

The new quest presentation receives Comic Book colours, including explicit corrections for hardcoded pale map-brief text. Short phone map briefs reserve visible route space and keep actions reachable; narrative/route-shape detail remains in Walk details. Theme changes remeasure and refit the same selected quest, preserving its vertices and progress.

## Validation

- Entire inline JavaScript, new core and service worker parse; `git diff --check` passes.
- Focused Appearance, current walking-route/encounter/UI/map contracts, woodland, full companion card, Academy/flock, onboarding and service-worker checks: **40 passed**. The underlying route/encounter suites are included through pytest wrappers; counts must not be added together.
- Combined broad run: **1,860 passed, 118 failed, 5 skipped**. Five `sound_id` collection modules were explicitly excluded because this sparse checkout lacks that separate package. Comparison with the quest task's independently confirmed baseline found 114 existing failures and four absent local UI assets. Those assets were supplied from existing local copies; all four affected checks then passed. Four prior missing-Three.js baseline checks also pass here. The full suite is not claimed green, and no broad rerun was needed after the final CSS-only phone correction.
- CUA browser checks used a disposable local save: level 20, 12,345 coins, four known companions, music/SFX disabled. Normal and Comic Book changed immediately, retained those fields and unrelated settings after reload, and rendered in the 390×676 phone viewport. Existing game UI and native radio/tab controls were exercised.
- A complete synthetic out-and-back quest displayed all seven vertices in the real MapLibre map. At 390×526, the corrected card reserved space above itself, with the route completely above the card and all seven vertices still rendered. This is simulated GPS evidence, not an outdoor walking test.
- Actual unchanged v359 service worker installed at a separate localhost origin. After a controlled source switch, the real v362 worker activated and the game's controller-change handler reloaded the client automatically. Its fixture retained the same level, coins, flock and unrelated settings, and old saves selected Normal. Both themes were selected, saved and restored with network connections deliberately dropped; required CSS/JS and the game's cached entry remained available.
- Art preflight checked **1,545 required** and **435 derived** existing assets against the real site. All required assets passed after nine timeout retries. One pre-existing optional derived Rook Witch cutout returned 404; its painting fallback remains available. No art was downloaded from GitHub.

Local evidence and disposable fixtures are retained in the coordinating task's `outputs/v362` and `work` directories. They are not part of the deployed game. Live deployment is verified separately against the final merged SHA and managed-file hashes.
