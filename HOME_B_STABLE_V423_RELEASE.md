# Stable screenshot-B composition v423

Build `home-b-stable-v423-20260917` corrects the remaining visual mismatch after v422. The populated 390×844 test save matched B, but progression-based visibility removed Empire, Crafting, Training and Hospital from sparse saves. That produced the user's reported Goal/Kitchen-only screen. Capping the Kitchen height in v422 did not restore the missing composition.

Home now retains the actual B section positions for every save. Empire's three columns show real holdings or None yet; unavailable rooms show Not built yet, and Crafting points to current progression. Native action gates still enforce all prerequisites. No unlock, building, inventory or reward is granted. Charcoal styling, Current Goal relocation, portrait two-row navigation and landscape rails remain as explicitly requested. No extra inventory panel or new grid design.

The correction changes only the Home view module and its exact consuming/three-worker-list pin, plus global build/cache. The recognition replacement remains held; Deep Rest removal is separately preserved locally and not part of this release. Verification uses disposable Chromium saves and viewport/touch emulation, not a physical phone.

Local verification passed: 26 native dashboard/navigation groups, including direct fresh/Kitchen-only composition checks at 320×568, 390×844, 844×390 and 1280×800, zero page errors. All seven B slots remain visible, Kitchen and Crafting share the same row, Empire stays above Goal, unavailable rooms show truthful status and no outer page scrolling occurs. Existing populated-view actions still pass.
