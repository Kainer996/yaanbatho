# Paced tutorial v467

Build: `paced-tutorial-v467-20260924`

## The ask

Yaan: after the player has been into Alderwing and come back to the Home terminal, the tutorial is too relentless. Spread it out. Drop the "play with Merlin" step, because Merlin flies behind the menu and the next lesson glitches over him. Use Raph Koster's *A Theory of Fun* to shape it.

## What Koster says, in short

- Fun is learning. The brain enjoys spotting a pattern and mastering it.
- Too many new patterns at once read as noise. The player stops learning and gets tired.
- A pattern already mastered gets boring. So the next one should arrive once the last has sunk in.
- Good difficulty zig-zags: a push, then a rest, then the next push.
- Players learn by doing, not by reading.

## What the game did

After Alderwing, 22 bubbles across 10 chapters fired back to back. Each chapter ended and the next began 1.2 seconds later, often on another screen. A fast player met them all in under a minute.

## What it does now

Five lessons, one idea each, 12 bubbles in total:

1. **Birdhouse** — Home, tap Academy, build it (3 bubbles).
2. **Discover a bird** — point Camera or Sound at a real bird (1 bubble).
3. **Meet Merlin** — tap him to see food, energy and bond (1 bubble). No Play step.
4. **The Kitchen** — build it, fetch supplies with Merlin, feed him (6 bubbles). This stays one lesson because each step pays for the next.
5. **Your world is open** — one closing line (1 bubble).

After each lesson Merlin rests for two minutes. During the rest no lesson starts and nothing drags the player to another screen. The Home goal chip always shows the next goal. Tapping it ends the rest and starts the lesson at once, so a keen player never waits. After the rest, the next lesson starts when the player next arrives on its screen.

Most reading steps became doing steps, and the copy is shorter.

## Merlin's play flight

The play sky sits below the care menu, and the old Play lesson held the menu open, so Merlin flew behind it. Then the next lesson popped up over both. Now:

- Takeoff always closes the care menu.
- Opening care during play lands Merlin on his perch first.
- Play waits while a lesson is on screen ("Let's finish this lesson first").
- No lesson starts during a flight, and a lesson started on request lands him first.

## Code

- `index.html`: `MERLIN_TUTORIAL_STEPS`, `MERLIN_TUTORIAL_CHAPTERS`, `nextOpeningChapter`, the Pacing block above `maybeStartMerlinChapterForScreen`, `endMerlinTutorial`, `activateHomeCurrentGoal`, `openMerlinCareMenu`, `careForMerlin`, `petFlyOutAndReturn`.
- The rest lives in `localStorage` under `burbzTutorialRest:<tutorial version>`. A clock set backwards cannot stretch it, and blocked storage never locks lessons away.

## Tests

- `node tests/test_paced_tutorial_v467.cjs` — lesson list, pacing rules, wiring and flight fixes.
- `node tests/run_paced_tutorial_v467.cjs` — real Chromium, phone size: 10 checks from the Home terminal to the Kitchen errand.
- Re-pinned on purpose: the lesson hash in `test_merlin_story_scenes_20260923.cjs`, the logo lesson in `test_separate_home_20260924.cjs`, and the build tag in `test_bird_patch_map_v466.cjs`.

## Heads-up

- Yaan's local opening evidence scripts (`run_opening_v4xx.cjs`, `run_hands_on_tutorial_v429.cjs`) walk the old chained order. They will now meet rests.
- Branch `claude/burbz-tutorial-dialogue-ui-qt8onp` (the five-beat story, not merged) edits the story beats before Alderwing. It should merge cleanly with this one, apart from the lesson hash pin, which will need one more re-pin.
