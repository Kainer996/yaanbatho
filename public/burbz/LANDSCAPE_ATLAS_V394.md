# Landscape controls, walking atlas and quest recovery v394

Build: `landscape-atlas-v394-20260913`. Prepared on top of the released photo v393 commit `d6c4427`; this release does not change photo recognition, game economy, terrain, combat rules or Merlin assets.

## Player behavior

Landscape walking now places the quest notice at the upper left, compass at the top, and Map, Satchel, journal and minimap at the upper right. Flight sits above the left movement stick. Look, aiming and the equipped weapon/spell/potion controls stay near the right thumb. Nearby interactions scroll horizontally beside movement rather than stacking over the horizon. All tested interactive targets are at least 44 pixels. The original portrait controls remain available.

Tap the minimap or Map, or press M, to open the existing realm atlas. It shows the actual walking avatar position with the current realm's original settlement markers and controls. Close or Escape resumes the same player pose, heading, camera and scene. Ordinary atlas travel still uses the original navigation actions. Indoors, the outdoor map is hidden.

Show Quests opens the existing walking quest board immediately, including its loading state, available mapped walks, Side Quest and any active saved quest. Selecting a walk opens its existing map brief and story. Network failures offer a plain explanation and Retry. Recently loaded walks remain available for the existing five-minute/same-area cache window and are labelled when offline. Uncached offline discovery and a complete map with no useful route have distinct honest states.

## Causes and implementation

- The previous walking CSS stacked combat, nearby actions and the Wings button upward from the bottom centre. The new scoped landscape edge layout preserves input ownership and the existing HUD frame.
- A 192px 2D minimap reads the retained world's current polygons, corridors and decoded geographic features. Projection paths are weakly cached; drawing shares the existing HUD update at no more than 4 Hz. No additional WebGL context, terrain fetch or render loop is created for the minimap.
- The full map temporarily borrows the original Empire atlas DOM, callbacks and camera. Its walking marker is separate from the GPS marker and never becomes GPS, home-anchor or quest authority. Close, retry, teardown and deliberate navigation restore the lease.
- Trail discovery accepted HTTP 200 before checking Overpass's partial-data/error `remark`. Such a response rejected outside the provider fallback loop, skipping a healthy secondary. Validation now happens inside that loop. The request deadline also covers JSON response-body loading, so headers cannot prematurely cancel the timeout. Neither partial evidence nor failed requests become empty successful results. Same-area concurrent clicks share discovery; stale-location guards remain.
- The old Show Quests action only drew map pins; its failure path showed the vague “scouts … trail archives” toast without opening the quest system. It now opens the real board, preserving original offers, route certification, story, activation and reward flows.
- The quest map brief assumed the navigation dock was below the map. In desktop landscape the dock sits at the right; using its top edge lifted the brief above the viewport. Only a bottom dock overlapping the map now reduces usable height.

The user's exact transient network failure was not available for replay. A fresh real-provider browser check on the previous release loaded six valid walks. A separate public provider returned HTTP 504 in that session. The partial-response fallback defect was reproduced deterministically against the exact old source, with a complete recorded secondary response available; old code attempted only the primary. The new code and actual quest UI recover under that condition. This does not guarantee public map services are always reachable.

## Verification

Evidence lives in `/home/yaan/Documents/Codex/2026-09-13/realtime-voice-chat/outputs/landscape-hud-v394`, `show-quests-v394` and `release-v394`.

- Actual village/town walking in Chromium: 568×320, 667×375, 844×390, 320×740, 390×844 and desktop 1280×800/1440×900. Named 44px targets, visible clipped hit areas, central view, map open/close/zoom/key/position, exact pose return, Satchel, journal and quest dismissal pass.
- Native outward and return walking preserves renderer/scene/camera and updates the minimap. Flight/climb/descend/land, three simultaneous movement/look/aim touches, cancellation and attack release pass. Town actions scroll to the real request; a physical door enters and leaves the same room with exact outdoor pose restoration. Atlas settlement cards retain native interaction.
- Map failure/Retry and teardown preserve pose, inventory, currency and GPS/quest state. Minimap cadence is at most four updates per second.
- The repaired Show Quests button is tested with a fresh level-one save and an established save, complete recorded OpenStreetMap data, an actual live provider, partial/failed/empty responses, offline cached/uncached behavior, effective Retry, portrait/landscape/desktop, real route details, native Begin and saved quest reload. Both browser runs finish without page errors.
- Five focused discovery tests cover partial/error HTTP 200, HTTP/JSON/network failures, a hung body and late completion, exhausted providers, and a complete empty network. Related equipment/combat/world/Market/room/quest regression selections pass. One unrelated legacy bird-card assertion expecting inline `card-xp-bar` fails identically on base `d6c4427`; its exact baseline proof is recorded and it is excluded from the release selection. The quest-pocket Python wrapper explicitly selects TAP so Node's changed default reporter cannot create a false failure.
- Changed dependencies have v394 URL pins in their consumers and all three worker lists. The new map module is in the legacy updater. Global build and cache advance together. Production HTTP and actual worker cache bytes are verified against the merged source during release.

Phone sizes and touch input are emulated Chromium conditions on this laptop's GPU, not measurements from a physical phone or an outdoor GPS walk. Deterministic terrain/vector fixtures exercise the actual renderers; live-provider evidence is separately labelled. UI placement draws on the peripheral grouping visible in the official [Skyrim manual](https://steamcdn-a.akamaihd.net/steam/apps/72850/manuals/skyrim_gfw_manual-07.pdf), without copying artwork.
