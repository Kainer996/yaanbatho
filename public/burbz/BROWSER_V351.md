# Forge screen evidence — v351

The 2026-09-05 Forge follow-up uses one original transparent anvil illustration
matching the existing painted equipment. Delivery is an 82,156-byte 512×512 WebP;
the generated alpha was retained. Prompt and provenance are in
`assets/forge/README.md`.

`tests/run_forge_v351.cjs` ran in Windows Chrome with touch-enabled phone viewports.
All 35 checks passed: actual Craft/Cancel/Collect/Upgrade/Equip taps, precise
material and coin changes, timed jobs, queue capacity, rarity locks, native upgrade
disclosure, default/explicit tab entry, maximum hearth, 320/360/390/768px fit,
44px crafting actions, reduced-motion highlight and no JavaScript page errors.
Seeded local data and a local-only test hook were used; neither ships to players.

The relevant maintained Python suites passed 69 checks on their initial run; one
Windows cp1252 subprocess decoding failure passed when rerun with `PYTHONUTF8=1`.
The broad release/cache selection passed 187 checks, skipped one and found one
remaining literal head-build assertion; that assertion was updated and its
focused rerun passed. Core module URL pins retain v350 because no core changed.
The full gameplay suite was not repeated for this presentation-only follow-up.

The pre-change live-art script verified all 1,545 required files. One best-effort
derived Rook Witch cutout remains absent; its existing painting fallback is
unchanged. No existing art or LFS bytes were replaced or downloaded from GitHub.

Machine-local evidence, production returning-save/offline cache checks and final
release SHA are recorded under the retained project's `.burbz-context/` directory.
Desktop phone emulation does not establish physical-phone frame rate.
