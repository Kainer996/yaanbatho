# Diet/Hunger Regression Final Evidence - 2026-07-23

## Runtime Release Pins

- `public/burbz/index.html` loads the changed diet/hunger runtime assets with `?v=diet-hunger-release-20260723`.
- `public/burbz/sw.js` cache name is `burbz-diet-hunger-release-v115-20260723`.
- Service-worker install precache includes:
  - `academy_treehouse_core.js?v=diet-hunger-release-20260723`
  - `kitchen_pantry_core.js?v=diet-hunger-release-20260723`
  - `data/bird-diet-records.js?v=diet-hunger-release-20260723`
  - `bird_diet_hunger_core.js?v=diet-hunger-release-20260723`
  - `diet_hunger_core.js?v=diet-hunger-release-20260723`
  - `merlin_companion_core.js?v=diet-hunger-release-20260723`

The full JSON record catalogue is build/test-only and is deliberately not loaded or precached. The browser JS payload is 838,780 bytes and contains the 952 canonical records plus only the compact legacy-name supplements needed by the in-page catalogue; the reproducible global 9,993-row source table is not shipped to browsers.

## Data Generation Check

Command:

```bash
PYTHONDONTWRITEBYTECODE=1 python public/burbz/scripts/check_bird_diets.py --check
```

Exit code: 0

Output:

```text
BirdFuncDat SHA-256: 97216eb1797da077169ebb1ebea275db293b09fc62f8bb8911f9beb98c50d321
BirdFuncDat source rows: 9993 usable scientific rows (9995 raw parsed rows)
National profile count: 951
Generated diet records: 952
Match counts:
  exact: 708
  scientific-alias: 7
  common-name: 156
  family-fallback: 67
  override: 1
  unmatched: 13
Family fallback list count: 67
Unmatched fallback list count: 13
Merlin record:
  Falco columbarius Diet-Vend=80 Diet-Inv=20 certainty=A primary=small_birds secondary=invertebrates
Check mode: enabled
```

## Focused Cache And Diet/Hunger Tests

Command:

```bash
python3 -m pytest -q -p no:cacheprovider public/burbz/tests/test_diet_hunger_release_integration_20260723.py public/burbz/tests/test_service_worker_cache_ownership_20260715.py public/burbz/tests/test_diet_hunger_contract_red_20260723.py
```

Exit code: 0

Output:

```text
...............                                                          [100%]
15 passed in 4.45s
```

## Full Regression Suite

Command:

```bash
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider public/burbz/tests public/burbz/test_continuous_scan_economy.py
```

Exit code: 0

Output:

```text
........................................................................ [ 21%]
........................................................................ [ 42%]
.................s...............................................ssss... [ 63%]
........................................................................ [ 84%]
......................................................                   [100%]
340 passed, 5 skipped in 22.81s
```

## Real Browser Harness

Server command:

```bash
python3 -m http.server 4173 --directory public --bind 127.0.0.1
```

Harness command:

```bash
node public/burbz/tests/run_diet_hunger_mobile_evidence.js http://127.0.0.1:4173/burbz/
```

Exit code: 0

Evidence JSON: `public/burbz/validation/diet-hunger-regression-browser-evidence-20260723.json`

Generated at: `2026-07-24T00:52:04.948Z`

Harness summary:

```json
{
  "allChecksPass": true,
  "viewports": [
    {
      "viewport": "320x568",
      "checks": {
        "companionHungerVisible": true,
        "companionDietVisible": true,
        "merlinFalconGuidance": true,
        "merlinNoMealwormPrimary": true,
        "kitchenReachable": true,
        "compatibleConsumesAndRecovers": true,
        "incompatibleRefusesNoConsumption": true,
        "reloadPersistsFeedState": true,
        "activityIdempotentAfterReload": true
      },
      "consoleErrorCount": 10
    },
    {
      "viewport": "360x730",
      "checks": {
        "companionHungerVisible": true,
        "companionDietVisible": true,
        "merlinFalconGuidance": true,
        "merlinNoMealwormPrimary": true,
        "kitchenReachable": true,
        "compatibleConsumesAndRecovers": true,
        "incompatibleRefusesNoConsumption": true,
        "reloadPersistsFeedState": true,
        "activityIdempotentAfterReload": true
      },
      "consoleErrorCount": 6
    }
  ]
}
```

Screenshots:

- `public/burbz/validation/diet-hunger-regression-320x568-companion.png`
- `public/burbz/validation/diet-hunger-regression-320x568-merlin-care.png`
- `public/burbz/validation/diet-hunger-regression-320x568-kitchen-initial.png`
- `public/burbz/validation/diet-hunger-regression-320x568-compatible.png`
- `public/burbz/validation/diet-hunger-regression-320x568-incompatible.png`
- `public/burbz/validation/diet-hunger-regression-320x568-reload.png`
- `public/burbz/validation/diet-hunger-regression-320x568-activity-idempotency.png`
- `public/burbz/validation/diet-hunger-regression-360x730-companion.png`
- `public/burbz/validation/diet-hunger-regression-360x730-merlin-care.png`
- `public/burbz/validation/diet-hunger-regression-360x730-kitchen-initial.png`
- `public/burbz/validation/diet-hunger-regression-360x730-compatible.png`
- `public/burbz/validation/diet-hunger-regression-360x730-incompatible.png`
- `public/burbz/validation/diet-hunger-regression-360x730-reload.png`

DOM/state observations captured in JSON:

- 320x568 and 360x730 companion DOM reports Goldfinch hunger state `hungry`, diet primary `Seeds`, and source-backed exact-match provenance.
- 320x568 and 360x730 Merlin DOM reports `Small-bird prey rations` as primary falcon food and does not mark mealworms as primary.
- Kitchen/Pantry is reachable at both viewports.
- Compatible Merlin feed changed small-bird rations `2 -> 1`, mealworms `2 -> 2`, Merlin hunger `78 -> 36`, Merlin hunger transactions `0 -> 1`.
- Incompatible mealworm attempt left small-bird rations `1 -> 1`, mealworms `2 -> 2`, Merlin hunger `36 -> 36`, Merlin hunger transactions `1 -> 1`.
- Reload after incompatible attempt preserved small-bird rations `1 -> 1`, mealworms `2 -> 2`, Merlin hunger `36 -> 36`, Merlin hunger transactions `1 -> 1`.
- Activity proof at 320x568 changed expedition bird hunger `20 -> 32` on first claim, recorded `expedition:browser-expedition-idempotency`, kept repeat claim unchanged before and after reload, and reported duplicate transaction protection.

Console observations:

- 320x568: `pageErrors=0`, `requestFailures=1`, `responseErrors=9`, unique response errors were `academy-tree-manga-20260629.png 404`, `burbz-intro-30s-seedance-20260629-discord.mp4 404`, and `/api/auth/config 404`.
- 360x730: `pageErrors=0`, `requestFailures=1`, `responseErrors=6`, unique response errors were the same static/API 404s.
- Browser console warnings also included existing Three.js deprecation, catalogue alias-collision warnings, WebGL read-pixel performance warnings, map missing-image warnings, and the cloud-auth JSON warning caused by the local static server returning HTML for `/api/auth/config`.
