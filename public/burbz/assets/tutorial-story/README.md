# Merlin opening paintings — 24 September 2026

Five original 1536×1024 illustrations generated with the built-in `image_gen` tool for the user's tutorial-artwork request. The tool did not expose a model version; no “2.5” claim is made. Full prompts are in `prompts.json`.

The existing `assets/merlin-tutorial.png` supplied Merlin's identity/costume reference. The first generated painting supplied visual continuity for the other four. Finished PNG originals are preserved in the task's `outputs/tutorial-art/`; these WebP runtime copies use quality 88 without cropping or resizing (about 2.57 MB total).

- `merlin-arrival-20260924.webp`: welcome, multiverse and Alderwing introduction.
- `alderwing-spell-20260924.webp`: captive bird warriors and zombie bird guards.
- `message-to-earth-20260924.webp`: Merlin's spell reaches the app on Earth.
- `warrior-freed-20260924.webp`: discovering an Earth bird frees its counterpart.
- `shelter-invitation-20260924.webp`: shelter invitation and Home/desk introduction.

`merlin_story_scenes.js` maps the five opening beats to these paintings, one each (v466 cut the story from eleven bubbles to five). The generated images replace CSS planet/phone/camera stand-ins and unrelated reused scenery. Ordinary bird anatomy, species markings, bright manga ink and coherent luminous environments follow the project art direction.

The latest scope is artwork only. All dialogue strings, ten cinematic bubbles, lesson IDs, ordering, actions and save behavior remain byte-identical to main `d727d2a9`. Earlier unfinished first-village and dialogue-reduction work remains isolated in the previous `work/tutorial` checkout and is not part of this change. World/craft/camera work was canceled before edits.

Validation: scene mappings, same-origin assets, all three worker lists, updater registration, unchanged lesson hash and 13 existing motivated-opening tests pass. Browser verification exercises all ten story steps at 390×844, 844×390, 320×568 and 1280×800, checks decoded images and visible Next controls, and uses native Next through the illustrated hub into the unchanged shelter-entry action. No browser page errors. Physical phones and installed-worker/public deployment are not verified here.

An unrelated existing v429 test still fails its shelter `allowExit` assertion; that module and test are unchanged. The historical v451 release test pins a superseded build tag and was not used as current release acceptance.
