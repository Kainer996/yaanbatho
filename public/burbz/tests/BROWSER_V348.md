# Alderwing phone checks

Run a local static server from the repository root:

```sh
python -m http.server 8765 --bind 127.0.0.1 --directory public
```

With Playwright installed, run these in a second terminal:

```sh
node public/burbz/tests/run_tutorial_coins_v348.cjs
node public/burbz/tests/run_merlin_journey_v348.cjs
node public/burbz/tests/run_settlement_life_v348.cjs
node public/burbz/tests/run_dense_settlement_v348.cjs
```

`PLAYWRIGHT_MODULE` can point to an existing Playwright installation and
`CHROME_PATH` to an installed Chrome executable. Otherwise Playwright uses its
bundled browser. `EVIDENCE_DIR` chooses the output directory; the default is
the system temporary directory. Set `PHONE_WIDTH=320` and `PHONE_HEIGHT=568`
for the shortest care/recruitment journey.

These isolated browser contexts load only localhost, block service workers,
and expose a test evaluator only in their intercepted local HTML. Fixtures
never write production discoveries or saves. The runners test actual touch
actions, saved care and first quest, named companions, real building selection,
census reconciliation, routes and actor limits. Software-rendered timings are
diagnostics, not evidence of frame rate on a physical phone. Production cache
handoff and live bytes must be verified separately during release.
