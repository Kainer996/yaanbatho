# Home squares and controls v421

Candidate build `home-squares-v421-20260917`, based on completed v420 and its public verification (PR357/358). Publication pending.

Your Empire retains Villages, Towns and Regions, each with its own scrolling list. Holdings are square, one across each category, with visible column dividers, native destinations, governor art and condition text/colours. The scanning buttons sit at the top of a snug box; the row immediately below uses the existing activePlayerQuest selection and reads Current / goal, then eligible building options and Equipment. Building options cycle through affordable, unlocked Academy and settlement construction and reopen the existing controls, with eligibility checked again before navigation. No automatic spending or invented construction rules.

Scan results & settings is hidden on the default hub. Sound/camera entry opens it; closing it or navigation hides it again while preserving ordinary Settings and existing scanner/results behavior. A stopped sound session can still show its results until dismissed; existing background-listening rules are preserved.

The former Stores panel is Crafting and opens the existing Forge, using its real progression gate. Kitchen retains its original panel and actions. Saved prerequisite intent/resume, player equipment, building notices and all v420 changes are preserved. Only the three Home modules and global build/cache pins advance.

Merlin’s approved styling uses a smaller dark guide, quieter Pause/Skip controls and 44px action targets. Cinematic introduction artwork and tutorial mechanics are preserved; its landscape guide width is bounded separately.

The recognition investigation is deliberately excluded by the user’s explicit hold. The production photo worker, adapter, prompt, thresholds, catalogue mapping, result decisions and monthly budget are byte-for-byte unchanged in this release. The existing saved-photo drawer opens through the Home session API, without changing recognition behavior. Kitchen remains in place; Crafting opens Forge. No additional inventory panel is introduced.

Local acceptance: 24 native Home/card/layout/navigation groups passed at 320×568, 390×844, 844×390 and 1280×800; 9 native prerequisite navigation/rollback groups passed against these Home changes. Home projection/Empire/core regressions passed. Nine native chooser/cropper interaction checks and seven installed/offline/tutorial-size groups passed on the isolated UI release, with zero page errors. The installed update retained saves, played and sought the real cached trailer, and resumed the same tutorial. Testing uses Chromium on the laptop with phone viewport/touch emulation, not a physical phone.

Publication proof will be added after deployment.
