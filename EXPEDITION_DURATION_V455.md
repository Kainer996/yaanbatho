# Expedition duration slider v455

Status: independent specification and code-quality reviews PASS; 38 focused tests and 18 full-game/browser/installed-upgrade/offline checks PASS on corrected candidate bytes. Publication and public-origin acceptance are pending.

Handbook exception: the protected `public/burbz/AGENTS.md` update was blocked by an approval timeout and remains unchanged; no retry or workaround was attempted.

Base: `aff8a91c46de160cfec330f95dbdd21a9d1fcbb9`.
Build and Academy core revision: `expedition-duration-v455-20260923`; matching exact core URLs are in all three worker lists. Other module pins are unchanged.

## Behavior

- Native indexed slider stops: 1–15 minutes individually, then 30, 60, 120, 240, 480, 720 and 1440 minutes. Labels use minutes, hours and 1 day.
- Input updates only selection/label/preview; the original slider and focus remain while dragging or using the keyboard.
- Preview and dispatch share canonical reward calculations, bird/night modifiers, Quartermaster rounding and carrying policy. Random finds are explicitly before carrying limits; timber/finds share capacity and displayed maxima are not guaranteed together.
- Preview inputs are read-only snapshots. Existing real dispatch defaults continue nap completion, role housekeeping and equipment normalization; preview never performs those writes or tutorial events.
- Authored tutorial timers and existing banked jobs/rewards remain unchanged. Claims require the exact end time rather than rounded percentage completion.
- Failed dispatch preserves the open SEND sheet, duration and retry feedback. Only a newly banked job dismisses it. Existing eligibility and atomic save/claim behavior remain authoritative.

## Executed local checks

Parent independently ran the following against corrected candidate bytes: **38 passed, 0 failed**.

```sh
node --test public/burbz/tests/test_expedition_preview_purity_20260923.cjs public/burbz/tests/test_expedition_slider{,_ui,_transactions}_20260923.cjs public/burbz/tests/test_motivated_opening_20260914.cjs
git diff --check
```

This includes real dependency purity checks for expired naps, missing care/roles/empire/equipment, stale chef roles, hungry Merlin and equipped nocturnal birds, plus native Chromium range interaction in an extracted fixture. Whole-game/browser/PWA verification is separate and not implied by these tests.

The purity correction recorded RED (8 mutation failures among 9 groups) before implementation, then GREEN (9/9). Its additional dispatch comparison reports 154 entire saves/save counts/tutorial event sequences unchanged from pre-correction code. The original implementation/spec review independently compared 1,596 historical jobs against the base.

Legacy focused pytest comparison: candidate21 passed/11 failed versus baseline25 passed/7 failed. Four new failures expect the retired seven-stop/button UI or mistakenly use the new one-minute first entry as a five-minute anchor. Seven baseline failures concern stale pins, a function extractor, Market-gate assumptions and a missing fixture dependency. They were not weakened to manufacture a pass.

## Release gates

- Final independent specification and code-quality review.
- Actual full-game native SEND/dispatch/reload/once-only claim and failure feedback.
- Installed baseline-to-candidate update, exact cached file hashes, offline reopening and saved-state retention.
- PR/merge under repository policy; deploy the exact read-back merge SHA through `burbz-sync`.
- Public HTML/core/worker byte comparison and public native/installed/offline verification.

Server-local recovery/evidence: `/root/.hermes/task-progress/burbz-first-village/SLIDER_RELEASE.md`, `SLIDER_IMPLEMENTATION.md`, `slider-purity/RESULT.md`, and `slider-browser/`.

This release excludes the separate unfinished Hall tutorial and ASMR/music work.
