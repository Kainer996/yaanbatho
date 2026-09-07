# Horizontal ink stripes: v357

The v356 depth sampler omitted an explicit precision qualifier. GLSL sampler precision defaults to lowp independently of float precision, so mobile implementations can quantize depth before the shader reconstructs distance. A smooth floor then becomes discrete distance bands and the outline pass draws them as horizontal black stripes. Desktop software WebGL did not expose this during the initial v356 checks.

Confirmed with a real-GL test that emulates reduced-precision texture results only for an unqualified/lowp depth sampler: the v356 declaration produces 33–99 dark rows across seven DPRs (1–3). With explicit highp sampling the same scenes produce zero dark rows; same-colour box silhouettes retain 582–5,240 dark edge pixels. Both runs have zero shader/page/GL errors. The emulation is explicit, not a physical-phone reproduction.

The fix only changes depth-sampler precision and requests highp compositor arithmetic. Devices lacking fragment highp bypass depth outlines while retaining cel shading. No geometry, artwork, shading-band palette, game state or gameplay changes. The new renderer URL is included in every service-worker shell list; the unchanged Academy URL remains at v356. Current-build test strings are mechanically advanced to v357.

Regression commands: `node tests/test_manga_world_v356.cjs` and `node tests/run_ink_precision_v357.cjs` (set PLAYWRIGHT_MODULE/CHROME_PATH for the available Chromium installation). Actual game scene checks use `tests/run_manga_world_v356.cjs` with the existing local preview server.

Evidence: `/root/burbz-ink-v357-evidence/`. Broad-suite baseline failures remain separately documented in MANGA_WORLD_V356.md. Live completion is recorded in the release PR and shared project notes.

Primary references: [GLSL ES precision defaults](https://registry.khronos.org/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf) and [Three r158 precision prefix](https://github.com/mrdoob/three.js/blob/r158/src/renderers/webgl/WebGLProgram.js). Neither float precision nor a high-bit-depth texture alone fixes a lowp sampler.
