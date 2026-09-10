# First-person HUD and shared equipment handoff

Feature pin: `first-person-kit-v1-20260910`. Base: released Market v389, `e713eb87a852253504e8beef92744a7514b2e6de`. This is an isolated feature checkout; the release owner's checkout was inspected read-only.

The quest tracker opens as a compact two-line objective with a progress hairline. Tapping its heading reveals a bounded, scrollable guide. Satchel and Journal use named SVG icons with tooltips and 46px targets. The Satchel opens equipment before supplies/travel, in village/town/Academy walking and the geographic world. B opens/closes it. Focus excludes disabled choices, Escape closes, and controls remain isolated from the background world.

`inventory.equipment['@player']` is the keeper's loadout. It uses the same five slots, 35 item definitions, Forge tempering, owned/crafted item bag and durable save as companions. Equipped copies leave `inventory.gear`, so existing Stores/Market sales cannot sell them. Swapping returns the prior item exactly once. There is no copied inventory, new item grant or eager save migration. Both bird and player equipment now use strict quantity/slot/owner validation and one durable transaction; failures restore the original object tree and defer quest announcements. The bird-equipment quest excludes the reserved player entry.

## Connected walking combat

The user confirmed wilderness-only walking zombie encounters between villages/towns. All equipment effects, weapons, scrolls and potions now connect to that runtime; settlement areas remain safe. See [FIRST_PERSON_COMBAT_V1.md](FIRST_PERSON_COMBAT_V1.md) for rules, shared renderer hooks and complete validation. No combat-location decision is pending.

## Integration

The release owner owns production merge, build number, cache promotion, offline update and live verification. This branch deliberately retains the v389 global build/cache while coordinating that promotion. **Before publishing, advance `BURBZ_BUILD` and append the coordinated release to `BURBZ_CACHE`, as usual.** New dependencies are already in index.html, all three worker lists and the updater. Changed HUD/walking/geographic module pins agree with the feature pin; unchanged assets retain theirs. The v387 dependency test is updated only for these changed module pins.

Shared-file boundaries:

- `first_person_hud.js/css`: compact quest, named icons, actual equipment sheet.
- `index.html`: shared dependencies, `walkingCharacterState` equipment/combat adapters, transactional bird/player mutations, Market copy and the player-quest owner guard.
- `village_walk.js`: HUD dependency pins, disabled-button focus filtering and four combat lifecycle hooks. Preserve the world owner's movement/renderer changes.
- `geographic_world.js`: Satchel icon, shared equipment mounting, B shortcut, accessibility and bounded combat/safety hooks. Preserve the world owner's terrain/continuity/performance edits.
- `sw.js`, updater, `AGENTS.md`: feature registration; reconcile with Merlin/other release changes.

## Validation

- `node tests/test_player_equipment_v1.cjs`: 8 groups, exercising all 35 definitions, equipment swap/unequip, shared bird/player counts, invalid/unavailable inputs, rollback with object identity, save reload, Market quotes, stale save adapters and Forge bonuses.
- `node tests/test_market_tabs_v389.cjs`: 8 existing groups pass, including all 35 collected Forge recipes and failed transaction rollback.
- `tests/run_player_equipment_v1.cjs`: 11 application-browser groups pass with native input: compact tracker, equipment at 320×740, 390×844, 667×375, 844×390 and 1440×900; owned spell equip, failed localStorage/retry, actual reload/unequip, companion-owned unavailable copies, and real Market Sell protection. No page errors.
- The same runner with `--sheet`: opening scroll reset and sticky close control verified during a full sheet scroll.
- The same runner with `--world`: 5 groups pass, including the actual geographic Satchel, shared equip, portrait/landscape/desktop fit and B open/close. No page errors.
- Selected equipment/Market/fieldwork/countryside Python suites: 35 pass, 3 unrelated tests excluded. Two excluded text assertions fail identically on clean v389 (obsolete card-art markup and v386 global release stamp); the other needs the discovery atlas, absent from this sparse local checkout and the inspected owner checkout. No unrelated assertions were weakened.
- Changed scripts, final inline application scripts and service worker parse; `git diff --check` passes.

Browser reports and screenshots are in the dedicated task directory's `evidence/ui`, `evidence/world-equipment`, and `evidence/sheet`. Tests use a disposable seeded save, local map fixtures and software Chromium. They do not claim physical-device frame rates or production/offline verification. Baseline unrelated failures were reproduced under `/tmp/burbz-equipment-baseline` without writing to the owner's tree.
