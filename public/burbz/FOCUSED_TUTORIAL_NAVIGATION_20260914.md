# Current-action tutorial navigation — unpublished handoff

Base: `e082be8829e782e4cd9abd0c406e1ea933276012` (owner’s v415 trailer/Settings repair). No release/build/cache bump, deployment, progression, costs, rewards, Home module or Settings/reset handler changes.

## Behavior

- The guided opening hides future locked dock silhouettes using the existing gate classes. Every usable destination remains a native dock control, with at least 44px targets. Later broad navigation retains its ordinary layout.
- A gold current-action button occupies a reserved dock row or landscape rail. The dock and its existing event handlers move into the tutorial overlay while active, alongside the preserved Settings control. Home remains responsible for sizing its actual panels.
- The button reads `merlinTutCurrentStep()`/`merlinTutTargetSelector()` while an action is active, and the opening agent’s `openingObjective()` outside the lesson. A native target button is invoked once in the user gesture. A container target is labelled “Show: …”, scrolled into view, and focused; its purchase/food/reward choice is never guessed.
- The real free-step instruction and `merlinTutorialTaskSkip` live with the action. Deferred discovery therefore retains the opening agent’s “Continue with Merlin” semantics and visible text. The measured action row reserves its own height. Reward overlays hide simultaneous tutorial prompts.
- Pause and Escape use the existing `endMerlinTutorial(false, {pause:true})`. Resume reads the existing saved mode/step. Navigating to an unrelated usable dock destination pauses first; a required `tab:*` action retains its original event handler.
- Tab includes the exact live target, its controls, free-action screen/sheet controls, tutorial controls, Settings and usable dock destinations. Arrow/Enter handling no longer steals keys from inputs or active action controls. Missing/hidden targets lose their spotlight and shields while Pause/Settings stay reachable.
- The existing spotlight loop is retained, with target measurements capped at 10Hz. No second loop or state mutation was added.

## Checks actually run

- `node tests/test_focused_tutorial_navigation_20260914.cjs`: passed native handler identity, container reveal without accidental purchase, hidden/missing/disabled targets, pause, locked-route authority and no fabricated completion.
- All inline scripts parse with `node --check`; `git diff --check` passes.
- Three existing tutorial/dispatch suites: 25 passed, 2 failed. Both failures reproduce on `e082be88`: old four-story-step and zombie-copy expectations conflict with that baseline’s six-step Earthling/Home introduction. No tests were weakened.
- `node tests/run_focused_navigation_20260914.cjs`: disposable real-browser contexts at 390×844, 844×390, 667×375 and 1280×800; all 24 groups passed, zero page errors. Verified actual touch/click and Tab/Enter care opening, Pause and Settings exact-step restore without changed inventory/player/chapter state, hidden-target access, and paused reload. Current Home worker modules were routed from its isolated worktree for the final run. Map inputs and hydrated artwork used the existing deterministic browser fixture.
- Evidence: `/tmp/burbz-focused-navigation-20260914/results.json`, `free-390.png`, `free-844.png`, `free-667.png`, `free-1280.png`.

## Honest remaining checks / integration

The final screenshot review moved the old floating free-step instruction/Skip control into the reserved action area and corrected narrow-rail word wrapping. That last layout refinement has pure/parse checks but **has not had another full browser run** because the shared browser slot passed to Home/public-release verification. The owner must rerun the supplied native runner on the integrated commit and visually inspect all four layouts. Existing screenshots represent the prior reserved-button version, with the old instruction still floating.

The opening agent supplies the real objective, gates and action order. Resolve any `merlinFlowPointerTarget` conflict in favor of this UI implementation; its API only reads `openingObjective()`. Preserve its `maybeStartMerlinChapterForScreen` pause guard at entry **and inside delayed callbacks**, so navigating during the delay cannot reopen a paused lesson. This work guards `maybeStartMerlinTutorial` at both points.

A full fresh opening, resource-shortfall/reward sequence, overprepared saves, offscreen compound-action routing and dense Home at all unlock stages still need integrated owner acceptance. The navigation runner covers actual target touch but is not a physical phone/new-player usability study. No public or installed/offline acceptance is claimed for this unpublished navigation patch.
