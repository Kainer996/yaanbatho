# Full cards v375

Birdex and Companions keep two equal portrait columns, including one or three companions and narrow phones. Tapping a discovered/owned card, its Full card button, Enter or Space opens the complete card directly. Locked species remain locked.

The full card shows original bird artwork, level/XP, ten stat cells, fullness/health, care actions, all five equipment slots and bond/preening. Natural-history accounts and their existing source/licence links, diet, size, personal story and Academy placement share an expandable section. Longer battle guidance is expandable too. The normal and comic palettes remain selectable. At 390×844 every equipment slot is visible without scrolling; a 320×568 screen needs a short scroll. No physical-phone performance claim.

Equipment and placement use the existing game transactions. Discovered birds are read-only previews: slot, equip, unequip, preen and care adapters require an owned companion. Recruitment closes the preview before the existing celebration. Keyboard focus excludes hidden details and inactive swipe neighbours; closing restores the grid opener, including after a grid refresh. Async facts refresh current and prepared neighbour panels without replacing decoded portrait DOM.

## Verification

- `tests/run_full_cards_v375.cjs`: actual local UI at 320, 390, 768 and 1024 widths in both themes; 1–4 birds; direct card opening, ten stats, portrait decode, all five equip/unequip transactions, inventory and reload, Academy placement, preview guards, recruitment and locked cards. `--public` compares published index/worker/style hashes and repeats UI checks using a disposable save.
- `tests/run_continuous_card_swipe_20260907.cjs`, served by `tests/serve_card_swipe_fixture_20260907.py`: real touch drag, cancellation, continuous opaque panels, neighbour image preservation, keyboard, focus, reduced motion, unsupported haptics and missing/pending portrait fallbacks. Updated fixture marker and special-bird fault injection match current source.
- `tests/run_full_cards_pwa_v375.cjs`: installed v374 automatically activates v375, retaining old save/equipment. After normal online portrait caching, full cards and unequip work offline and survive reload. Optional unauthenticated API config is unavailable in the local fixture.
- Required broad command: `python3 -m pytest tests/ test_continuous_scan_economy.py -q`. Result: 2,112 passed, 5 skipped, 41 unchanged baseline failures; no new failure IDs compared with v374. One stale owned-card handler fixture now passes.

Evidence: `/root/burbz-full-cards-v375-evidence/`, including screenshots, reports, broad output and publication/recovery record in `release/`. Browser runners use Playwright/Chromium from environment variables documented by prior release runners.

## Release

Build/cache suffix `full-cards-v375-20260908`; only changed `illustrated_world.css` gets a new asset query in the entry page and all three worker lists. Existing module pins remain intact. Existing updater already manages index, worker and this stylesheet. Release-head test constants advance independently from the unchanged quest-core pin.

Publish through the normal PR and guarded `burbz-sync.service`; verify tested/merged tree equality, live marker, all managed hashes, public runtime bytes, backend/timer and Pages. Preserve unrelated video/LFS normalization and the retained v374 baseline.
