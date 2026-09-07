# Companion life v363 integration

Build `companion-life-v363-20260907` combines the tested Appearance/walking-quest release with first-only discovery rewards, visible existing Personality/CHA, Goldcrest's targeted migration, continuous card swiping and haptics, four special portrait animations/names, and Merlin flight/interactive Play.

Handoffs: discovery e9cb680, Personality9691666, swipe2f56ef2, Merlin3ee19ac and special cardscdcb41a. Only handbook notes and the additive legacy-updater file list conflicted; both sets of entries were preserved. Full-card Personality, local/cloud migration, image decode/fallback, inert neighbors and the special-portrait swipe exception remain intact. No progression formulas or care rewards were added by integration.

All13 new runtime/media dependencies are in the three service-worker shell lists and legacy updater. This includes all seven special-card WebPs so their first tap also works offline. Image decoding still happens lazily with the sprite module's bounded cache. The existing module pins remain `appearance-v362-20260907`, `walking-quests-v361-20260907`, `merlin-flight-v1-20260907` and `special-card-sprites-20260907`; only the current build and appended cache suffix advance.

## Combined checks

- Initial41 focused Python tests passed with two independently confirmed historical failures excluded: obsolete v312 action-badge pin and obsolete diplomacy copy.
- After all handoffs and final stamping,23 focused Python tests passed for discovery, Personality, full card, swipe, Appearance, walking route/encounter/UI/map/release and Merlin controller/alpha atlas. The special-sprite Node identity, naming, asset and registration suite also passed.
- Every inline script, the service worker, both new runtime scripts and the updater shell script pass syntax checks. The13 new dependencies have real local bytes and exactly one registration in each offline list.
- Actual in-app Chromium with a disposable save checked390×676 and320×526 layouts in both themes. Goldcrest's real1254px artwork loaded; CHA40 migrated to90 while nickname Pip and companion XP23 remained. Carousel commit moved to Carrion Crow with matching Personality60, decoded artwork and an8ms haptic. One active plus two inert panels remained. First Chaffinch detection gave8XP/14coins;25 further detections kept totals fixed and one shelf tile. Reload preserved theme, currency, companions and XP. Both themes' narrow Personality row, close and bond section were inspected.
- Merlin's integrated Play controls opened in both themes at320×526; the play-sky input and Finish control worked. Its owner supplied146 passing game assertions,21 controller tests and58 prior contracts. Special cards supplied58 passing browser assertions,31 focused Python checks and32 verified alpha frame bounds. Detailed feature evidence: BROWSER_MERLIN_FLIGHT.md, BROWSER_CARD_SWIPE_20260907.md, BIRD_DISCOVERY_PERSONALITY_20260907.md and assets/special-birds/README.md.

The test fixture uses fixed synthetic location before initialization and no existing user account/save. It is outside the shipped repository. Physical-phone frame rate/haptics and outdoor quest walking are not claimed by these checks. Existing whole-save cloud synchronization is not an atomic cross-device discovery ledger.

## Saved-client update

The prior real v362 worker was installed on an isolated localhost origin, then loaded with a saved level20,12345coins,five companions and Goldcrest CHA40/XP23/nickname Pip. The real worker updated and automatically reloaded the game to v363. Level20,12345coins,five companions,XP23 and nickname Pip remained; Goldcrest becameCHA90 and default Carrion Crow becameBrandon Lee. The fixture then dropped network connections: offline reload succeeded with the same progress and no JavaScript errors. A previously untapped Brandon Lee portrait loaded and animated from the new offline cache in both Normal and Comic Book, with the correct species label, active carousel panel and close controls. No live user save was accessed or reset.
