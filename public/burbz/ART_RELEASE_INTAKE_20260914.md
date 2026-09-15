# Four bird cards — current release intake

Prepared from approved artwork commit `d0063a3d808fa01dde87328afda88b3d1808c839` on current released main `095ec945771147d0e7aa7f7b61a104f883f673e4` (v415). Branch: `codex/burbz-art-release-intake`. No production merge or deployment performed by the intake task.

## Included

- Exact final bright manga WebPs for **Blue Tit, Great Tit, Long-tailed Tit and Goldcrest**, plus their existing common-name aliases. Each is an opaque 1254 × 1254 ordinary Git blob, together 2,600,720 bytes. No GitHub LFS download is needed for these new assets.
- Full scenic paintings in framed cards, Bird information and full-card equipment inspection. Compact moving sprites and all other no-arms guards retain their existing route.
- Location icon beneath the picture in the identity row: 16px graphic inside a 44 × 44px target, using the original label and navigation handler.
- Exact module pin `illustrated_world.css?v=species-manga-cards-v411-20260914` in the page and all three worker lists, plus four new assets in all three lists and guarded updater.
- Original artwork/generation history and previously captured browser evidence retained explicitly as historical evidence. Standing species-specific/no-human-arms direction added to the handbook without changing unrelated guidance.

The current v415 global build/cache are deliberately retained in this integration commit. The release owner must promote one new build/cache with the actual combined release. No current trailer, Settings, pending-reset, recognition, Gemini ledger/photo queue, sound, economy or world behavior was replaced by the old source checkout.

## Checks completed on this intake

- Visual review of the **actual four exact final WebPs**: bright coherent woodland illustrations, distinctive species outfits and plumage; no visible human arms, hands or extra limbs. This is artistic review, not a bird-identification accuracy claim.
- Byte-for-byte equality of all four files with approved `d0063a3d`, WebP decode, dimensions/opacity, all three offline list memberships and updater membership.
- Both unchanged LFS reference records match main/source and the original materialized files: Treecreeper `7fcad1a2d4e9e2d45e4e5b2c6ca6f6836393c9181e1f1637023fd28470c408e6` (2,264,957 bytes); Great Spotted Woodpecker `573c1259af30b39ab78cc98b6bfae4ad3cdd9342552721633e0c9be68bf183dd` (2,802,286 bytes). No reference or original was edited/deleted.
- Required public-art health script: **1,545 / 1,545** required paths present, **434 / 435** optional derived cutouts present. The absent optional Rook cutout is pre-existing. Raw report: `/tmp/burbz-art-check-20260914-222514.tsv`.
- Six focused existing pytest files: **31 passed, 9 failed**, exactly the same nine failures on isolated unchanged v415 base. Four are stale release/count assertions, three refer to an older card-back template, two need unmaterialized old assets. Exact cases/output recorded in `tests/evidence/art-release-intake/regressions.json`; no blanket green-suite claim.
- The full-card renderer test now supplies its new `getBirdCardArtUrl` dependency while retaining all original assertions: **3 / 3 pass**. No runtime compatibility workaround added for an incomplete unit-test fixture.
- All four inline page scripts, worker and browser runner parse; guarded updater shell syntax and diff whitespace pass.

Exact asset hashes, references and preservation checks: `tests/evidence/art-release-intake/provenance.json`.

## Required remaining acceptance

**No browser was started for this intake** because the shared laptop browser queue belongs to the release owner. The original source's nine browser groups are useful historical proof only. The current owner must rerun actual combined desktop and phone portrait/landscape cards, aliases, small location controls, native location/full-card/picture/Bird information behavior, current worker upgrade and offline save/art reload, then actual public byte parity and public gameplay proof after guarded deployment.

The retained runner is `tests/run_species_manga_cards_v411.cjs`. Its intake update explicitly polls the current worker cache and verifies all four cached hashes; it uses actual native controls and persisted save after an offline public reload, because the public worker correctly caches uninstrumented HTML. This test-only refinement parses but has not yet run on this intake.

Example commands from the eventual integrated checkout:

```sh
TEST_PWA=1 node public/burbz/tests/run_species_manga_cards_v411.cjs /tmp/burbz-art-integrated-proof
BURBZ_URL=https://yaanbatho.com/burbz/ TEST_PWA=1 node public/burbz/tests/run_species_manga_cards_v411.cjs /tmp/burbz-art-public-proof
```

The runner uses a disposable seeded save and a closure hook on the online page only. It does not invoke photo/sound identification. Desktop and phone dimensions are browser emulation, not a physical-device claim. Do not let two runners contend for its local port 8981; retain prior result directories.

Only the release owner merges/deploys through the existing guarded process, preserving current main and live-only files. All four final cards are explicitly authorized for publication; no new artwork generation or user confirmation is needed.
