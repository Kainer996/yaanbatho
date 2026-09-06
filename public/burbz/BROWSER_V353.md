# Concise onboarding and stable dock — v353

Release: `concise-onboarding-v353-20260906`.

Local browser verification (2026-09-06):
- Fresh start: Meet Merlin → actual Feed → Quests → First Flight → Send.
- Legacy v7 save paused at story step 9 / careLessonVersion 1 resumes at “Start your first quest”, step 4/4. No compulsory rest or repeated feeding.
- That migrated flow sends Merlin, presents Claim, and unlocks Academy after the actual reward claim. Academy's aria-disabled changes to false and its label becomes “Academy”; unrelated features retain their locked hints.
- All 13 destinations remain visible. Phone screenshot at 390×650 confirms muted original-art silhouettes, preserved woodland palette, readable action prompt and stable two-row dock.
- Tutorial total: 35 steps across 18 chapters; opening 4 steps. Required care/action events, first-flight dispatch, reward and building handoffs remain real actions.

Validation: 102 tutorial/rest/gate/badge tests plus 37 swipe/level-12/progression tests pass. Both inline JavaScript blocks and changed badge module parse. Legacy migration tests cover every old chapter/full-replay position and every current stable lesson ID. Badge regression verifies locked hints, suppressed locked badges, unlocked action counts and restored plain labels. Original core unlock rules are unchanged.

The full backend/asset suite was not rerun for this frontend-only release. No 3D Merlin asset is integrated.
