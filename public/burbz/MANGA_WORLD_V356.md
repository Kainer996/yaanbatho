# Manga world v356

Status: release approved by Yaan on 7 September 2026; verified on `codex/burbz-manga-world-v356`. Base is merged v355, `34e9a412ec1b87433d3e1feba4339509dd4ceffc`. Deployment completion is recorded in the release PR and shared project notes.

Yaan requested the missing Borderlands-like 2D/3D manga treatment while his Windows computer was unavailable. The last night's available branches were already merged and byte-equivalent to main. Their release notes explicitly excluded Academy, village-rendering and progression drafts; this implementation recreates the requested visual treatment from the current release without claiming to recover those unavailable drafts.

The 3D Academy, villages and towns share a small local renderer module: stepped diffuse light, cool shadow tint, and a depth/colour ink pass. Original meshes, material identities, textures, alpha cutouts, emissive windows, room selection and game logic stay in place. A depth-texture fallback keeps cel shading on older WebGL devices. Scene disposal releases the new render target, depth texture, full-screen material and geometry. Existing adaptive resolution and reduced-motion controls still apply. The painted 2D Academy remains available.

The new module and refreshed Academy URL are in all three service-worker lists and the legacy updater. The build/cache marker is `manga-world-v356-20260907`. Most changed test files only advance their existing current-build string.

## Verification

- Actual Chromium/SwiftShader screenshots compare the same village, town and all-room Academy before/after the effect; night scenes, portrait/landscape resizing and real touch-open building interiors passed without JavaScript or shader errors.
- Matched village: 269 to 270 draws, 53,826 to 53,828 triangles; town: 125 to 126 draws, 54,130 to 54,132 triangles. Each uses two additional textures and one extra shader program. These are software-WebGL phone-emulation measurements, not physical-phone speed guarantees.
- Node contracts pass: original material identity/hooks, shared materials, transparency exclusions, adaptive target dimensions, idempotent disposal, missing-depth fallback and renderer-state cleanup on failure.
- 53 Academy/settlement tests pass; another 37 touch-steering/Market/update tests pass after correcting two stale Academy URL assertions exposed by the new pin.
- Broad run initially reached 2,069 passed / 12 skipped / 36 failed. Running the exact 36 failures on an untouched v355 checkout reproduced 34 failures; the two introduced URL assertion failures were fixed and passed in the focused rerun. Existing failures concern earlier tutorial/card copy and release pins, the BirdNET float boundary, missing `python` alias and unhydrated Rook LFS art. No unrelated gameplay fixes were included.
- Inline scripts, renderer module, Academy module, service worker and diff checks pass. Both changed renderer URLs appear in every offline/update list.
- An isolated Chromium browser installed actual v355, then automatically updated to v356 through its normal service worker. Seeded coins, branches and a save marker survived; the new renderer was cached and an offline reload passed without page errors. This is a test save, not a player's populated account.
- Expanded renderer contracts pass with 99.29% measured line coverage, 95.35% branch coverage and 100% function coverage. Physical-phone performance remains unverified.

Evidence: `/root/burbz-manga-v356-evidence/` (screenshots and `results.json`). Reproduce with `tests/run_manga_world_v356.cjs` against the local preview server at port 8765; `PLAYWRIGHT_MODULE` and `CHROME_PATH` select the installed browser. The local preview substitutes existing VPS bytes only for checked-out LFS pointer images. It does not write to production or request images from GitHub.

Release safeguards: main was re-fetched and remains the verified v355 base; production managed-file checksums pass. A pre-release archive is saved alongside the evidence as `predeploy-v355.tgz`. Verify live page, service worker and renderer bytes against the immutable merge SHA after normal deployment.
