# Side chest repair v383

Two of the twelve side-chest food bundles contained only two units: one young rabbit plus one wood mouse, or one pigeon ration plus one field vole. The existing strict validator requires at least three units, two food types and prey, so these chests could not be claimed even with fresh GPS at the chest.

The generated helper and saved-chest claim adapter now use the existing `BurbzQuestCore.normaliseChestLoot`. Existing valid contents are retained; stable discovery/claim keys select deterministic additions for incomplete bundles. The validator is unchanged. Repair, food, coins, XP, claim flag and receipt commit together; a storage failure restores the original state, and the existing receipt prevents repeated rewards after reload. No IDs, coordinates, GPS gates, routes, pocket timing or resume actions change.

The page and service-worker cache advance to `side-chest-v383-20260910`. External modules are unchanged and keep their v382/v381/earlier URL pins; the updater already installs the changed index and worker, so its file list needs no change.

## Verification

`node public/burbz/tests/test_discovery_claims_v382.cjs` exercises all twelve generated bins using the actual quest validator and kitchen catalogue. Both legacy two-unit bundles exercise the real claim adapter, save-failure rollback, preserved contents/coordinates, retry, saved receipts and duplicate rejection after reload. Existing map/non-chest transaction tests remain included. Browser/PWA upgrade evidence is maintained separately in `/root/burbz-v383-release-evidence`; publication belongs to the release owner.
