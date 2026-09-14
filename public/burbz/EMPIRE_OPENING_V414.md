# Empire and direct building opening — v414

Build: `empire-opening-v414-20260914`.

The Empire page uses a small centred heading, keeps its existing three tabs and village tiles, and removes the extra Ledger button, combined collection control and owned-village liberation-date banner. Saved dates, claim/battle/ward return and economy remain intact. The notice stack now leaves the tabs reachable on short screens.

A due unstaffed building opens when its actual overview model/tile or ready notification is tapped. This includes each village/town ward, civic Hall and bulk order. The Field desk lists ready buildings and its action commissions them directly. Passive completion still waits; assigned managers still open their own scope automatically. Existing project identity/due guards, original population/reward values and atomic save rollback are reused. No first-person trip is required. This user instruction supersedes the earlier physical-site-only rule in BUILDING_OPENING_V405.md.

Changed runtime: index.html and scan_home.js, exact scan_home URL in all three worker lists, appended global cache/build. Existing updater already includes both files; no deployment script change is needed.

Validation before merge:
- Native Chromium: failed overview opening and retry; one-time village tile opening; direct Field desk button; three working tabs and compact header at 390×844, 844×390 and 1280×800; actual town Hall model click; native bulk-order notification opens both buildings with original reward.
- 8 village transaction groups and 10 civic/bulk groups.
- 9 Market groups, all 36 current craft recipes; 12 shared equipment/rollback/quest groups.
- 10 real browser photo-queue scenarios including offline/reload, replay, cross-tab, quota and owner changes; no paid provider calls.
- 11 photo deployment/rollback checks with local fixtures passed; sound/provider code is unchanged.
- Inline scripts parse; exact three-list cache URLs and updater inclusion checked.
- Focused historical Python checks: 39 passed; three unchanged baseline assertions still pin obsolete v273/v350/v393 URLs/builds. Baseline bytes were compared directly; production pins are not reverted to satisfy stale tests.

Native evidence: /tmp/burbz-overview-proof/results.json and screenshots. Public old-to-new PWA and offline verification is recorded separately in /tmp/burbz-empire-opening-public/results.json; do not infer live status until that report is complete.

This release excludes unverified camp combat, house perimeter checks, Auto/vehicle/water/enemy progression work and independent art/combat/player-camp checkpoints. No story changes.

## Heading correction v414b
Visual review found the global title pseudo-elements still pulled the text left even though its container was centred. The Empire title now uses a block and hides those decorative pseudo-elements. Native layout validation measures the actual text range against the parent centre in all three viewports. Build/cache advances to `empire-title-v414b-20260914`; the unchanged Home runtime keeps its v414 pin.
