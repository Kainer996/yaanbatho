# Birdhouse terminology

Base: live `48ea7df10cfc6ea94cef5cb00837b214f28ff0d2`.

Changes only whole-word visible `Barracks` / `BARRACKS` to `Birdhouse` / `BIRDHOUSE` in runtime building names, recruitment instructions, tutorial/quest copy, companion guidance, new diary entries and room labels. Matching visible-copy expectations in existing tests change the same way. Internal lowercase `barracks` and `tavern`, quest/event identifiers, CSS/DOM selectors, asset filenames, costs, inventories, rewards and saved state remain intact. Existing historical diary text is not rewritten. No Merlin 3D/model or Rowan story work is included; the academy renderer has a building label change only.

Verification: exact-transform review confirms every changed runtime/test file differs only by those two whole-word replacements; all changed JavaScript plus four executable inline scripts parse; diff check clean. Six existing Python suites produce 29 passed / 9 failed on both this patch and an untouched detached live baseline, with identical failing test names. Failures are absent art cutouts and older Market/quest/tutorial/migration assertions already stale on live. No new regression appeared; this is not a claim that all repository tests pass.

Integration: preserve this visible name when merging motivated-opening's newer dialogue and academy reward changes. Navigation/Settings/Home work is independent but overlaps index.html. Release owner must review merged visible copy and bump shared offline/cache pins. No independent deployment or live acceptance was performed.
