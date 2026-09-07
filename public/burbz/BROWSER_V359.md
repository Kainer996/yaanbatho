# Bright comic UI and battlefield, v359

Release candidate on `codex/burbz-comic-ui-v359`, with publication authorised
by Yaan on 2026-09-07. Merge and deployment state are recorded in the PR;
the checks below describe the tested release content.

Yaan requested bold, bright comic panels throughout the UI and a generated
battlefield in the same manga/cel-shaded style as the world. `comic_ui.css`
is a body-scoped presentation layer: opaque ivory, yellow, teal and coral,
thick ink edges, offset shadows and the existing display fonts. All existing
bird artwork and gameplay/3D code are unchanged. The HTML diff adds one
stylesheet link and body class and advances the human-readable build label.

Two generated WebP images provide paper-corner accents and a sunlit woodland
battlefield. The latter appears in squad selection, live combat and results.
The existing opposing bird cards sit against the far edge and foreground.
Original image prompts, dimensions, file sizes and font licence notices are
in [the artwork README](assets/comic-ui/README.md). Runtime additions total
less than 500 KB, including CSS and three local WOFF2 fonts.

## Verification

- `tests/run_comic_ui_v359.cjs`: 12 destinations, settings, equipment, quest
  send, care and six Academy rooms; screenshots and approximate contrast
  diagnostics. No flagged visible-text contrast cases on sampled screens.
- Opening battles fit 390×844, 360×780, 360×667, 320×568, 844×390 and
  1280×900 viewports, with all move buttons above the dock and at least 44px
  tall. Small-phone and landscape aim/cancel and physical attack-confirmation
  layouts fit without arena scrolling. Real spell casting damages a rival;
  cancel leaves their health unchanged. Real bird switching, opponent targeting
  and physical attack confirmation work. Victory is a separate fixture routed
  through the real result/reward handler, not a claim of a full played victory.
- Short landscape uses side-by-side squads, a compact aiming grid and shared
  attack/move row. The smallest portrait uses compact padding without shrinking
  the slider or primary buttons below 44px. Reduced-motion mode stops target
  and button scaling. No new targeting overlays or gameplay handlers.
- `tests/run_comic_ui_pwa_v359.cjs`: installed v358 updates automatically to
  v359, caches the stylesheet, both backgrounds and all three fonts, preserves
  seeded coins/branches/save marker, and reloads with the battlefield offline.
- `tests/run_manga_world_v356.cjs`: village/town day/night, real building taps,
  portrait/landscape and Academy render pass without page/shader/GL errors.
- Existing renderer lifecycle, 13-model geometry and full-wave wing attachment
  unit tests pass. No renderer, combat core or existing artwork files changed.
- Required live art check: 1,545/1,545 images served as real image bytes.
  434/435 optional derived cutouts exist; the existing missing Rook Witch
  derived cutout retains the game's original fallback.
- Five new Python release/asset/protection checks pass. Full suite after
  mechanical release-label maintenance: **2,073 passed, 12 skipped, 34 failed**.
  The 34 failing IDs exactly match the untouched baseline; no new failures.
  Existing Academy core URL pins are retained because that module did not
  change. The separate release-preparation step advances 94 current-build
  literals in 93 historical test files; no gameplay expectations are weakened.

Evidence: `/root/.gstack/projects/Kainer996-yaanbatho/designs/comic-ui-v359/`.
The design review and screenshots cover before/after and interaction states.
This is Chromium emulation/software WebGL, not a physical-phone speed test or
a complete accessibility certification. The contrast scan approximates painted
backgrounds. Existing intro/tutorial rules and locked/hidden controls remain.

## Reproduce

For browser tests, set `PLAYWRIGHT_MODULE` to Playwright and `CHROME_PATH` to
a Chromium executable; `EVIDENCE_DIR` selects the output directory. The main
UI runner expects a local preview with real same-origin assets at
`http://127.0.0.1:8765/burbz/` (`BURBZ_URL` can override it). Test-only hooks
are injected into the intercepted HTML; none ship in the app.

For the PWA runner also set `OLD_BURBZ_ROOT` to an intact v358 deployment with
real artwork. Its controlled HTTP server uses port 8766 and only changes its
in-memory source selection; it never writes to that old deployment.

Run `python3 -m pytest public/burbz/tests/test_comic_ui_v359.py -q` for the
new static checks. The build/cache marker is `comic-ui-v359-20260907`.
The six new runtime URLs are in all three service-worker shell lists;
the legacy updater also includes their licences and artwork README. Both
generated WebPs use its local-only artwork staging list, never its GitHub
download loop; this is covered by the release regression test.
Publish only through the normal reviewed GitHub/guarded Burbz sync workflow.
