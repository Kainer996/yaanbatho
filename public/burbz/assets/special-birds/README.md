# Special bird portrait sprites · 2026-09-07

Eight generated poses per character, packed left-to-right across four columns, then the second row. Each RGBA WebP sheet is 1024×512: eight 256×256 cells with transparent margins. `packing.json` records source crops, fixed anchors, scale and selected generator filenames; `prompts.json` preserves the complete built-in image_gen prompt sequence. No external generation API was used. Original opaque/checkerboard outputs were rejected; the selected crow and gull retain generated alpha, and image-tool green/magenta plates for rook/peregrine were mechanically keyed, aligned and resized. No GitHub art download or LFS pointer ships in these assets.

| Runtime key | Identity / species | Action | Frame cadence (ms) | Sheet bytes |
|---|---|---|---|---|
| rook-witch | The Rook Witch / Rook | Wing spell flourish and settle | 180,140,140,140,200,140,140,220 | 147906 |
| peregrine-falcon | Peregrine Falcon | Alert turn, blink, compact wing stretch | 180,170,110,160,200,150,110,220 | 125110 |
| brandon-lee | Brandon Lee / Carrion Crow | Nod, ruffle, cape settle and blink | 180,160,140,180,170,160,100,220 | 173770 |
| steven-herring-gull | Steven / Herring Gull | Head-bob, quiet call and blink | 180,150,150,160,180,170,100,220 | 79980 |

The reference pictures were read from the live same-origin VPS and inspected on assembled cards before generation:

- `/burbz/bird-art-cache/rook_witch_blackfeather_hex_burbz_manga_20260904.png`
- `/burbz/bird-art-cache/cutouts/peregrine_falcon_burbz_manga_warrior_20260802_cutout.png` (canonical no-human-arms card replacement)
- `/burbz/bird-art-cache/carrion_crow_burbz_manga_20260624_v2.png`
- `/burbz/bird-art-cache/herring_gull_burbz_manga_20260706.png`

Three fixed 512px scene plates were edited from the same original paintings, removing their central bird so its animation retains the woodland/ruins/harbour setting. The peregrine keeps the existing transparent portrait/habitat treatment. Frames start/end in the reference standing/open-wing poses; a 100ms entry and 130ms exit blend restores the unchanged canonical still. Brandon Lee is a bird character name, with no human likeness or endorsement.

## Runtime and delivery

`special_bird_sprites.js` owns one active canvas/RAF cycle and at most two decoded sheet/scene pairs (about 6 MiB combined). Media downloads begin on deliberate portrait tap; repeat taps during loading/playback merge, and finished animations can be replayed. Each cycle lasts 1.30–1.31 seconds. Missing/invalid/late assets keep the original picture, with a six-second load timeout and deliberate retry. Reduced motion retains the original static interaction. Visibility, navigation/removal, closed overlays, offscreen portraits, flips and dragging stop/reset playback. Nothing writes game saves, spends care/items or awards XP.

Portrait buttons appear only in existing owned/discovered renderers and a discovery-gated field guide. Inactive carousel panels stay inert. The swipe handler permits this one portrait button as a swipe origin while retaining all other button exclusions; its capture click guard runs above the sprite handler. Full equipment portraits use the same canonical artwork as Birdex for these four birds while preserving eager decode/fallback wiring.

Names use the existing new/local/cloud default-only character migration. Explicit player nicknames win. The peregrine gains character metadata without acquiring a new nickname or changing its saved move. Steven matches Herring Gull, European Herring Gull or `Larus argentatus`; other gulls/crows remain separate. No old explicit nonempty name is removed.

Both module/CSS files are registered in all three service-worker shell lists. Seven media files are registered in `scripts/update-live-burbz.sh`; they use the existing same-origin on-demand cache, so the first offline tap without prior media download falls back to the original picture. The sole release owner must append the consolidated build/cache version and publish these files with that release. This feature does not independently deploy.

## Verification

`node tests/test_special_bird_sprites_20260907.cjs` checks identity/default migration, aliases, the complete frame timeline, WebP bytes and delivery registration. `node tests/run_special_bird_sprites_20260907.cjs` runs 58 real-game Chromium assertions in an isolated synthetic save, including touch swipes, vertical scrolling, cancellation, replay, locked/discovered cards, keyboard, reduced motion, bounded cache and missing/late/retried downloads. Set `PLAYWRIGHT_MODULE` to a Playwright installation if necessary, `CHROME_PATH` for Chromium, `OUT_DIR` for screenshots/results, and optionally `BURBZ_REFERENCE_DIR` to a folder containing the four canonical reference PNGs when testing a sparse checkout. The browser fixture uses the swipe feature's existing synthetic seed and requires that feature first.

The card route, Steven, full-card renderer and same-origin artwork focused Python checks passed (31 tests; the canonical rook file was hydrated from the VPS for the artwork assertion). All 32 exported sprite cells have non-clipped alpha margins. The browser pass exercises Normal and Comic class states on this feature base; the release owner still verifies the final combined theme implementation. These checks do not claim physical-device performance or a production deployment.
