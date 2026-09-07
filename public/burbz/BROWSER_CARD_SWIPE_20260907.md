# Continuous companion-card swipe validation

The old full-card swipe faded the sole body out, waited 160ms, replaced its
HTML, then faded the incoming body in. At 390×844, the captured committed
transition contains a completely empty card area. A drag also exposed empty
space beside the only rendered card.

The replacement keeps three real panels on one translated track. The incoming
panel and its loaded image survive promotion to the center. Neighbor panels are
inert and hidden from assistive technology; only the center receives focus and
actions. Full back-card scrolling, existing wrapping and gameplay handlers are
preserved. Haptics are one 8ms request after an actual committed change, honoring
the existing setting. Physical vibration was not tested; unsupported platforms
have no haptic effect.

## Reproduce with disposable state

From `public/burbz`, start the checked-in fixture server:

```sh
BURBZ_ART_ORIGIN=https://yaanbatho.com python3 tests/serve_card_swipe_fixture_20260907.py
```

The server binds only to 127.0.0.1:8792. Its test page seeds four synthetic
companions and a fresh test state before the real game's initialization. It
never reads a browser profile, live save, token, or account. APIs and service
workers are blocked. `BURBZ_ART_ORIGIN` is optional when assets are hydrated;
when specified, only public bird art/assets are fetched, without authentication.

Run Chromium with Playwright:

```sh
PLAYWRIGHT_CORE_PATH=/path/to/playwright \
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium \
BURBZ_EVIDENCE_DIR=/tmp/burbz-card-swipe \
node tests/run_continuous_card_swipe_20260907.cjs
```

`BURBZ_URL` can select another localhost fixture port. On a base predating the
Appearance release, `BURBZ_COMIC_CSS=/path/to/appearance-release/public/burbz/comic_ui.css`
checks the release's actual scoped Comic stylesheet. The suite explicitly
loads and enables it and asserts the resulting computed theme color.

The browser suite uses actual CDP touches, records every animation frame during
an initial drag/commit, and checks that the visible viewport remains covered by
opaque card panels. It verifies retained incoming DOM/image identity, no tick
while moving, one commit tick, wrapping, cancellation, reversal, regrabbing,
rapid repetition, vertical scrolling, loadout and favorite taps, keyboard/pager
navigation, focus containment, close/reopen, changing and empty rosters,
reduced motion, muted/unsupported vibration, failed/pending portrait fallbacks,
and Normal/Comic layouts at 320, 390, 430 and 1100px. PNG sequences and a JSON
frame log provide actual visual and geometry evidence. This is a desktop
Chromium phone-viewport test, not a physical-phone performance claim.

Final run: **48 browser checks passed; 110 intermediate frames inspected**,
with no page errors. Normal and the Appearance release's actual Comic stylesheet
(`ab79977`, PR #291) were visually inspected at 390×844; both themes also passed
320, 430 and 1100px layout checks.

## Focused existing contracts

```sh
python -m pytest tests/test_equip_card_swipe_20260820.py \
  tests/test_full_card_polish_20260906.py \
  tests/test_owned_card_route_20260906.py \
  tests/test_bird_card_back_ui.py \
  tests/test_bird_card_carry_charm_20260824.py \
  tests/test_bird_equipment_screen_20260721.py -q
```

41 passed. One pre-existing failure in `test_no_core_pin_moved_because_no_core_changed`
expects the action-badge core to retain its old v312 URL; the unchanged base
`dd3a062` already pins it to `barracks-tutorial-callout-v354-20260906`. No core
URL, release build or service-worker cache was changed here; the sole release
owner integrates the release pin with the related discovery and sprite work.
