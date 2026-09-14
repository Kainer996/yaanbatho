# Home farming v409

Build `home-farming-v409-20260914` adds a Farm category alongside Garden,
Furniture and House. The outdoor Build action opens the existing home yard
editor and Done returns to the saved continuous world journey.

## Farming rules

Each adjoining 2 m square costs two timber; up to 64 plots fit in the clear
home yard. House, path, roots, finds and furniture footprints remain protected.
Neighbouring plots omit their internal borders to form a field.

- Reeds: 20 minutes; three river reeds at harvest; packet costs four coins.
- Sunflowers: 30 minutes; three sunflower seeds; packet costs five coins.
- Berries: 45 minutes; three hedgerow berries; packet costs six coins.
- Pondweed: 15 minutes; three pondweed tangles; packet costs three coins.

Packets contain three plantings. Planting spends one packet seed first, or
one existing material/Kitchen item if available. Water each planting once;
growth uses elapsed real time, including offline time. Crops do not wither.
Harvest also gives one seed for replanting. Water all and Harvest ready operate
atomically. Empty plots can be removed without a timber refund.

## Save and rendering invariants

`playerHome.farm` owns plots and seeds. Old homes migrate without changing
rooms/decorations or replaying free supplies. Proposed actions validate ids,
counts, bounds and anchor revisions. Home, inventory, coins, timber and journey
restore together on failed durable saving. Harvest clears the crop in the same
transaction as its reward, preventing repeated collection.

The shared farm appears in the home yard, village overview and first-person
world. Soil vertices and individual plants follow the supplied ground heights.
A full mixed field has 576 plants / 1,152 crop instances, using at most nine
farm draw calls. Existing renderer, frame and disposal ownership are retained.

## Validation

- Seven Node scopes cover costs/placement, inventory/watering/offline harvest,
  packets/bulk actions, corrupt state/stale anchors, actual adapter save rollback,
  full-field geometry/disposal and individual plants on sloped ground.
- Existing v379/v385/v386 home behavior and v408 terrain scopes pass.
- Native phone browser checks exercise Build tabs, four adjacent plots,
  planting, watering, reload, harvest and short landscape. A native click-through
  regression is fixed and covered. Mature-crop fixtures age only saved timestamps.
- Actual v408-to-v409 worker upgrade preserves the complete old home/inventory;
  all eight cached runtime files match source. Shared-world Build/Done and
  offline reload retain the same farm and resources.
- Full required pytest scope: 2,046 passed, five skipped, 196 failures. The
  failure identifiers exactly match the v408 baseline; no new failures.

Evidence: `/root/burbz-home-farming-evidence/`, especially `test-comparison.json`,
`final-full.xml`, `browser-instanced/results.json`, `pwa-grounded/results.json`
and `release-manifest.json`. Browser tests use software-rendered phone emulation;
physical-phone performance is unmeasured. Publication is approved by Yaan;
post-publication receipts are recorded separately in the evidence release folder.
