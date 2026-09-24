# Bird patch map (v463)

Release: `bird-patch-map-v463-20260924`.

## Yaan's ask

Yaan hears the same two tawny owls at work every night. He only learned they were the same two by asking a chatbot. Burbz should teach that birds keep a home patch.

## What it does

- A bird heard by Merlin's wand, or named by a photo, opens a "Where it lives" card. The card shows the real map around the player.
- A circle in the bird's colour marks its home patch. A robin's patch is 50 m. A tawny owl's is 250 m. A raven's is 2.5 km.
- The circle pulses while the bird keeps singing. Each five-second sound window that hears the bird keeps it pulsing. It settles when the bird goes quiet.
- Meet the same kind of bird inside its patch on another visit, and Merlin says it is almost certainly the same bird, or the same pair.
- The live Map screen shows every known patch, and pulses the ones singing now.

## How it works

- `bird_home_range_core.js` is pure. It holds about 110 curated ranges (radius, colour, faithfulness, pair, one-line fact). Other birds get an estimate from body mass and way of life, marked as an estimate.
- Meetings live on the phone only, in localStorage `burbz.birdPatches.v1`, capped at 800. The server copy line on the Sound screen now says so.
- Hearings less than 45 minutes apart count as one visit, so an owl calling all evening is one night.
- `bird_patch_map.js` owns the card, the MapLibre mini map, the pulse and a precise GPS watch while Merlin listens.
- `handleBirdCandidates` calls it for confirmed birds. Queued photos (`commitOnly`) are skipped, because they can be claimed far from where they were taken.

## Checks

- `node tests/test_bird_patch_map_v463.cjs`
- `node tests/run_bird_patch_map_evidence.js` (real Chromium; 12 checks)
- The pytest suite fails the same 311 tests as clean main. None are new.
