# One connected Alderwing world

Release build: `unified-alderwing-v400-20260913`. Publication and public verification are still pending.

A traveller uses the retained village renderer across real-metre countryside and into the actual next village/town, generated from its canonical saved settlement and economy. Destination materials use the host sky/light and the same horizontal fog. Prepared settlements, fixed tree chunks and conservative visibility margins keep movement, turning and return travel continuous. Complete decoded terrain remains a prerequisite for the visible horizon; missing data must never become invented flat terrain or a visible map edge.

The original settlement and prepared destinations stay cached outside the render graph beyond opaque fog. Spatial batches and actors use conservative bound wrappers; each actor retains its own indoor/outdoor visibility. Destination preparation yields between scene parts, street routes, residents, collision work and discovery placement. The source builder's global registries are captured/restored for every chunk and animation step. No competing renderer or GPS quest route is introduced.

Building doors retain unresolved approaches until the streamed ground is available. Interior people and the journal resolve against the destination's saved identity. Journal controls moved by the shared HUD are explicitly disposed when entering another settlement. Manage/Visit opens the normal village/town management page without starting a legacy first-person route.

Fresh players begin on Home. Merlin introduces Enter Alderwing, the actual Home DOM pulls back into the bare temporary shelter, and the door opens into the shared world. The first outlook has a clear path, framed trees, rocks and a pond. Old saved gardens retain their trees and possessions. The introductory chapter pauses while exploring and resumes the Home management lesson only after returning to the desk.

The Build your house quest uses the player's actual virtual position. The confirmation requires clear loaded ground, the current save and anchor revision; Yes pays the existing 25 timber once and saves the permanent cottage location across game views. No spends nothing. Failed durable saves restore the shelter, world pose and timber. Existing cottage/upgraded homes remain intact.

Ordinary real-world GPS quests, BirdNET sound and the current camera policy remain unchanged. Wilderness enemy/archery, shared Equipment and the full Home dashboard are inherited from the current release. On-site commissioning, one-time Help the builder, new wayside encounters and camera-accuracy repair remain separate unfinished work. No rejected 3D Merlin work is included.

## Verification

Local disposable-save evidence and videos are under the release owner's `outputs/world-v397` directory. Tests use actual Three/MapLibre decoding and native keyboard/touch controls. Synthetic terrain and real-provider runs must be labelled separately; laptop touch emulation does not establish physical-phone frame rates. Final release evidence must identify the tested source, merged source, exact public bytes, complete worker installation and cold offline/save behavior.

All changed runtime URLs must agree between synchronous/lazy consumers and all three service-worker lists. Existing updater entries already cover these modules; no binary asset hydration is required.

Local results: desktop and portrait touch-emulation trips pass outward, return and revisit with one retained canvas, actual destination doors and management. The full destination interaction check also verifies the canonical journal, durable loot and furnished tavern return. A real-provider landscape journey passes nine checks with zero game errors or loading pauses over three 830-metre legs. Moving frame means range 18.5–25.7 ms; p95 is normally 33.4 ms and reaches 50 ms on return. This is host Chromium evidence, not a physical-phone or universal 60 fps guarantee. Real hill flight uses native climb to clear trees; collision is not disabled. The initial failed constant-altitude harness correctly struck rising canopy and is retained as diagnostic evidence.

Fresh Home-to-shelter-to-world-to-desk tutorial checks pass on portrait; house No/Yes, exact timber payment, reload and injected save-failure rollback pass on desktop. The integrated source passes 15 selected world/home/settlement Python checks and the shelter state suite. Home source and artwork are byte-identical to the reviewed Home v399 release. The sky and additional real-world quest-building revisions are explicitly not included here.
