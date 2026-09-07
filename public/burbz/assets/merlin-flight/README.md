# Merlin flight artwork

Original generated raster animation for the existing Merlin falcon. The perched four-layer puppet remains canonical and unchanged. This atlas supplies flight, turning, approach and grasping views in the same slate, buff, walnut and brass palette.

## Consuming files

- `merlin-flight-v1.webp`: 2048 × 2048, lossless RGBA WebP, 1,386,226 bytes; eight rows of eight 256px frames. Decoded image memory is 16 MiB.
- `atlas-config.js`: compact browser configuration with body pivot and per-frame talon anchors. Loaded before Play starts; no JSON fetch is needed.
- `merlin-flight-v1.mapping.json`: full frame rectangles, source pivots, body scale, alpha provenance and talon coordinates for maintainers.

Every frame has at least eight transparent pixels at its cell edge. The common body pivot is **[128,160]**, not the bounding-box centre: raised wings need room above the shoulders. Each view uses one consistent body scale across all eight phases. The renderer mirrors rightward travel and rotates the bird and its carried token about this same pivot. There are no labels, checkerboards, scenery or tokens baked into the consuming artwork.

| Row | View |
|---|---|
| 0 | Front |
| 1 | Front three-quarter, left |
| 2 | Left profile |
| 3 | Rear three-quarter, left |
| 4 | Back |
| 5 | Rising, left |
| 6 | Descending approach, fanned tail and open talons |
| 7 | Carrying, closed talons |

Columns follow one upstroke → extended downstroke → flexed recovery cycle. The runtime integrates wing phase continuously as speed changes; cadence is animation tuning, not a measured biological frequency.

## Generation and preparation

Generated on 2026-09-07 with the built-in image generation tool. The coding/reasoning model did not generate the raster pixels. Exact final prompts are in `prompts/`.

Identity references were the canonical Merlin painting (`merlin_burbz_manga_20260624_v2.png`) and the assembled four-layer perched character. Real local assets, already sourced from the live Burbz origin, were inspected before generation. The four live layer hashes were verified against the repository's Git blobs; no GitHub art downloads or LFS hydration were used.

Eight separate 4 × 2 sheets gave a usable complete wingbeat for each camera view. Source views 1 and 2 supplied real alpha, which was preserved. Other generated sheets used a uniform magenta export matte; technical packing removed that matte, recovered edge colours and emitted genuine RGBA. No feather anatomy or new poses were painted by the packer. The initial crowded 64-pose generation was rejected and is not consumed.

`pack-atlas.cjs` records the technical export; `source-anchors.json` records the visually reviewed anchors. With `sharp` available, run `node pack-atlas.cjs --input PATH_TO_EIGHT_GENERATED_SHEETS --anchors source-anchors.json --output PATH_TO_EXPORT`. Sources are named `00-front.png` through `07-carry.png` as recorded in the mapping. New generations require reviewed anchors; never scale individual frames to their wing bounding boxes. The original generation sheets remain in the animation task's `work/generated` directory, and the full PNG atlas is supplied as a user-facing output.

QA checked all 64 frames on light and dark backgrounds, clear cell margins, no residual magenta and exact alpha/visible-pixel agreement between the PNG and lossless WebP exports. Exact per-frame talon points are used in the live pickup/carry geometry.

## Motion references

[Cornell identification](https://www.allaboutbirds.org/guide/Merlin/id) describes compact broad-chested falcons with broad-based pointed wings and quick, stiff, powerful wingbeats. [RSPB](https://www.rspb.org.uk/birds-and-wildlife/merlin) describes agile twisting turns and short glides with wings nearer the body. [Cornell life history](https://www.allaboutbirds.org/guide/Merlin/lifehistory) describes fast horizontal or rising pursuit and, during courtship, a slow approach with extended legs and a fanned tail.

Cornell's embedded Macaulay clip **ML407300**, Timothy Barksdale, adult with Killdeer, 1 October 1997, was played and visually inspected through the identification page. Low powered transit, a nearly horizontal body, a climb toward a tree and the upright perched posture informed the flight-to-perch transition. The footage did not establish an exact wingbeat frequency or precise talon contact timing.

The implementation uses powered travel, brief glides, shallow approaches, banking and tail-flared reaches. Its numerical rates and trajectories are artistic choices. Pebble retrieval is fictional game play, not a claim that wild merlins collect stones.

## Release contract

All game requests remain relative/same-origin. Runtime JS, CSS, WebP and atlas configuration are registered in all three service-worker shell lists and the legacy updater. Their immutable pin is `merlin-flight-v1-20260907`. The coordinating release owner owns the subsequent `BURBZ_BUILD` and `BURBZ_CACHE` bump; this feature task does not publish or deploy.
