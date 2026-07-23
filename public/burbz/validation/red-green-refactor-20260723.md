# Red-Green-Refactor Evidence Log - Diet And Hunger

Timestamp: 2026-07-23T20:22:00Z UTC

Order note: RED tests in `public/burbz/tests/test_diet_hunger_contract_red_20260723.py` were added first, then the focused pytest command below was run before any runtime production edits. This worker made no production code changes; only tests and this validation log are in scope.

## RED Focused Pytest

Command:

```bash
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider public/burbz/tests/test_diet_hunger_contract_red_20260723.py
```

Exit code: 1

Result summary:

```text
FFFFFFFFFF                                                               [100%]
10 failed in 0.38s
```

Failing tests:

```text
test_val_diet_001_source_backed_records_cover_all_profiles_and_merlin
test_val_diet_001_generated_diet_check_command_passes_and_guards_drift
test_val_diet_002_merlin_data_and_copy_are_small_falcon_prey_not_mealworm_primary
test_val_diet_003_compatibility_matrix_uses_source_families_and_refuses_wrong_food
test_val_hunger_001_migration_bounds_state_and_preserves_existing_bird_data
test_val_hunger_002_visible_hunger_markers_cover_health_and_readiness_surfaces
test_val_hunger_004_activity_hunger_is_idempotent_for_repeated_activity_completion
test_val_pantry_002_feeding_transactions_are_atomic_species_compatible_and_idempotent
test_val_pantry_001_and_003_reachable_kitchen_flow_exposes_diet_guidance_and_inventory_bridge
test_val_regression_001_cache_pins_new_diet_hunger_assets_and_keeps_protected_features
```

Representative failure snippets:

```text
AssertionError: No source-backed diet artifact found. Expected one of:
data/bird-diet-records.json, data/bird_diet_records.json, data/diet-provenance.json,
data/national-bird-completion/bird-diet-records.json,
data/national-bird-completion/diet-provenance.json
```

```text
AssertionError: No generated-data diet check script found. Expected one of:
scripts/check_bird_diets.py, scripts/build_burbz_diet_data.py,
scripts/build_bird_diet_records.py
```

```text
Error: Cannot find module './diet_hunger_core.js'
code: 'MODULE_NOT_FOUND'
requireStack: [ '/tmp/yaanbatho-diet-release/public/burbz/[eval]' ]
```

```text
AssertionError: Missing player-visible hunger meter/status markers:
data-hunger-surface="companion-card", data-hunger-surface="academy-room",
data-hunger-surface="expedition-dispatch", data-hunger-surface="training-dispatch",
data-hunger-surface="battle-readiness", data-hunger-surface="merlin-care"
```

```text
AssertionError: Kitchen/Pantry flow is missing contract-visible hooks:
data-kitchen-pantry-root, data-diet-guidance, data-diet-provenance,
data-compatible-foods, data-larder-count, data-pantry-count,
data-feed-transaction-id, data-feed-result-sheet, __burbzDietHungerDebug
```

```text
AssertionError: diet_hunger_core.js?v=diet-hunger-20260723 is not loaded by index.html
```

## RED Generated-Data Check

Command:

```bash
PYTHONDONTWRITEBYTECODE=1 python public/burbz/scripts/check_bird_diets.py --check
```

Exit code: 2

Output:

```text
python: can't open file '/tmp/yaanbatho-diet-release/public/burbz/scripts/check_bird_diets.py': [Errno 2] No such file or directory
```

## Contract Mapping

| Test or log item | Contract assertions |
| --- | --- |
| `test_val_diet_001_source_backed_records_cover_all_profiles_and_merlin` | VAL-DIET-001, VAL-PROFILES-001 |
| `test_val_diet_001_generated_diet_check_command_passes_and_guards_drift` | VAL-DIET-001, VAL-TEST-001 |
| `test_val_diet_002_merlin_data_and_copy_are_small_falcon_prey_not_mealworm_primary` | VAL-DIET-002, VAL-PROFILES-001 |
| `test_val_diet_003_compatibility_matrix_uses_source_families_and_refuses_wrong_food` | VAL-DIET-003, VAL-DIET-002, VAL-PANTRY-002 |
| `test_val_hunger_001_migration_bounds_state_and_preserves_existing_bird_data` | VAL-HUNGER-001 |
| `test_val_hunger_002_visible_hunger_markers_cover_health_and_readiness_surfaces` | VAL-HUNGER-002, VAL-HUNGER-003, VAL-BROWSER-001 |
| `test_val_hunger_004_activity_hunger_is_idempotent_for_repeated_activity_completion` | VAL-HUNGER-004 |
| `test_val_pantry_002_feeding_transactions_are_atomic_species_compatible_and_idempotent` | VAL-PANTRY-002, VAL-PANTRY-003, VAL-DIET-002 |
| `test_val_pantry_001_and_003_reachable_kitchen_flow_exposes_diet_guidance_and_inventory_bridge` | VAL-PANTRY-001, VAL-PANTRY-003, VAL-PROFILES-001, VAL-BROWSER-001 |
| `test_val_regression_001_cache_pins_new_diet_hunger_assets_and_keeps_protected_features` | VAL-REGRESSION-001, VAL-TEST-001 |
| RED focused pytest command/output above | VAL-TEST-001 RED evidence |
| RED generated-data check command/output above | VAL-DIET-001, VAL-TEST-001 generated-data RED evidence |

## GREEN Focused Contract Suite

Command:

```bash
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider public/burbz/tests/test_diet_hunger_contract_red_20260723.py public/burbz/tests/test_source_backed_diet_contract_20260723.py public/burbz/tests/test_hunger_lifecycle_contract_20260723.py public/burbz/tests/test_pantry_transaction_contract_20260723.py public/burbz/tests/test_ui_diet_hunger_disclosure_20260723.py public/burbz/tests/test_diet_hunger_release_integration_20260723.py public/burbz/tests/test_kitchen_pantry_20260722.py public/burbz/tests/test_merlin_permanent_companion_20260723.py public/burbz/tests/test_roost_barracks_first_quest_20260720.py public/burbz/tests/test_bird_levelling_system_20260722.py public/burbz/tests/test_sound_catalogue_unlock_20260722.py public/burbz/tests/test_service_worker_cache_ownership_20260715.py
```

Exit code: 0

Output:

```text
........................................................................ [ 94%]
....                                                                     [100%]
76 passed in 8.82s
```

## GREEN Generated-Data Check

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

## Full Regression Gate

Command:

```bash
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider public/burbz/tests public/burbz/test_continuous_scan_economy.py
```

Exit code: 0

Output:

```text
........................................................................ [ 21%]
........................................................................ [ 43%]
........s...............................................ssss............ [ 64%]
........................................................................ [ 86%]
.............................................                            [100%]
328 passed, 5 skipped in 27.13s
```

## Browser/Mobile Evidence

Harness command:

```bash
node public/burbz/tests/run_diet_hunger_mobile_evidence.js http://localhost:4173/burbz/
```

Evidence JSON:

```text
public/burbz/validation/diet-hunger-regression-browser-evidence-20260723.json
```

Summary:

```text
320x568 and 360x730 passed: Merlin falcon/small-bird guidance, no mealworm-primary claim, visible companion hunger meter, Kitchen/Pantry reachable, compatible food consumed once and lowered hunger, incompatible food refused without consumption or nourishment, reload persistence, and activity hunger idempotency after reload/repeated completion.
```
