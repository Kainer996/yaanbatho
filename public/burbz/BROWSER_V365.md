# Field map and Stores v365 — 7 September 2026

The real geographic map now distinguishes dark woodland, sage open land, parchment paths and teal water. Place names use ink with a light halo. Provider geometry, road widths/zoom stops, quest route data, GPS and attribution remain unchanged. The new presentation module supplies a consistent brass/ink control and pickup-icon set; route pins keep the actual offer click handlers. Small-screen shading no longer obscures paths.

Stores entry now checks the existing inventory gate centrally before navigation. The same equipment milestone, evidence from equipped birds and level 12 fallback still apply. Resource balances remain in the global HUD, with truthful locked labels; food, equipment, rewards and saves are unchanged.

## Verification

- 25 existing focused tests passed: walking route network, walking release, Appearance release and quest zoom lock.
- The focused Node suite passed provider-data preservation, road/casing/water/label styling, existing pickup fallback, blocked Stores navigation before screen/history changes, eligible navigation, milestone/equipment/level 12 eligibility and all three service-worker dependency lists plus updater registration.
- Disposable Chromium game: simulated Sheffield GPS, synthetic connected path network and a separate local QA save. Actual map tiles rendered in Normal and Comic at 390px; both show legible path/water surfaces, clear control labels and the redesigned icons. No map or page JavaScript errors were reported.
- Pointer activation of Show Quests loaded two fixture offers and reframed the map. Selecting the loop marker opened its real brief with the 2.2km loop route, walking estimate and begin/details controls. Keyboard activation also worked. A real pointer check caught Merlin's invisible wrapper intercepting the quest button; scoped pointer handling now preserves the care button and lets empty wrapper space pass map taps through.
- All three HUD shortcut handlers with an early-level QA state stayed on the map and reported the existing Equip-a-bird milestone. An eligible level 20 QA state opened Stores. Inventory, coins 12345, five companions, their XP 23 and nicknames remained unchanged across these navigation checks. Theme selection and reload used the existing save flow. No real phone/user storage was accessed.
- A 760×390 landscape check exposed the old fixed header-height subtraction clipping controls beneath the dock; the map now fills its actual screen container and keeps the zoom/location strip inside it.
- The release adds only `field_map_ui.js/css`; both are registered in all three worker shell lists and the updater. Existing module pins stay unchanged, current-build test assertions follow v365 mechanically.

This is the bounded field-map/icon and Stores correction. The separately requested geographic3D, walkable village, Birds/cards/facts and empire generated-art work is not claimed as part of v365.
