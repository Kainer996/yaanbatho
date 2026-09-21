# Destination State Core

`destination_state_core.js` is the library/data layer for destination quests. It does not render UI, register service-worker files or write saves directly.

## Exports

- Browser global: `BurbzDestinationStateCore`
- Node export: `require('./destination_state_core.js')`
- Main calls:
  - `buildDestinationRecord({ route, quote, content, catalogue, context, evidence, commonBirdCount, now, idSeed })`
  - `stageDestinationPreview(rootState, record, { previewId, generation, profileId, revision, now })`
  - `cancelDestinationPreview(rootState, previewId, { profileId, revision, now })`
  - `beginDestinationQuest(rootState, record, adapter, guard)`
  - `finishDestinationWalk(rootState, adapter, guard)`
  - `applyDestinationEncounter(rootState, entryId, choice, adapter, guard)`
  - `completeDestinationQuest(rootState, adapter, guard)`
  - `reviewEntries(rootState)`
  - `sanitizeDestinationState(value)`
  - `createBrowserAdapter(windowLike)`

`guard` is `{ expectedProfileId, expectedRevision, previewId, now }`. A mismatch returns `stale-profile`, `stale-revision`, `preview-cancelled` or `preview-replaced` before mutation.

## Adapter Contract

State transitions are single-save transactions. The adapter may provide:

- `getProfileId(rootState) -> string`
- `getRevision(rootState) -> number|string`
- `snapshot(rootState) -> clone`
- `restore(rootState, snapshot) -> rootState`
- `persist(rootState) -> { ok:true }`, `{ ok:false, error }`, `false` or throw
- `beginDeferredEffects(rootState)`, `commitDeferredEffects(rootState)` and `discardDeferredEffects(rootState)` are optional transaction hooks. When present they bracket the mutation and single durable save; commit hooks run only after persistence succeeds, and discard hooks run after rollback.
- `applyPlayerXpState(amount, rootState)`
- `addCoinsState(amount, rootState)`
- `addLootState(loot, rootState)`
- `isSpeciesUnlocked(species) -> boolean`
- `unlockSpeciesForDestination(species, meta) -> result`

The bundled `createBrowserAdapter` maps these to the existing browser names when available: `snapshotGameState`, `restoreGameStateSnapshot`, `durableSaveState({ throwOnFailure:true, queueCloud:false })`, `applyPlayerXpState`, `addCoins`, `rememberDiscoveredBird`, and `gameState.inventory.items`. It deliberately uses state-only XP and one durable save per transaction. Discovery unlocks call the canonical `rememberDiscoveredBird` with a deferred `effects` array; those effects flush only after the destination save succeeds, and failed transactions discard them after restoring the snapshot. If the canonical deferred discovery helper is absent, destination unlock fails before mutating Birdex state; callers must construct this adapter inside the actual game closure or pass explicit canonical functions.

Read-only guard checks use a non-mutating sanitized view. Live destination references are normalized only inside the transaction snapshot, then restored in place on failure, including the active quest object during failed completion retries.

## Record Shape

Destination records are `schemaVersion:1`, `kind:"destination-quest"`, and move through:

- `planned`
- `active`
- `review`
- `completed`

Every successful record stores:

- the validated `destination_route_core.js` route and fingerprint
- the immutable `destination_reward_core.js` quote
- route-ordered stable entries with at least one `building`, one `character`, and one `bird`
- route fraction, cumulative distance and source segment metadata for every entry
- receipts for begin, finish, final payment and every encounter
- `generatedGameEncounter:true` and `observedRealWorld:false`

Buildings and characters must be supplied as meaningful native actions in `content.buildings[]` and `content.characters[]`; label-only or empty categories reject. Common birds come from `BurbzAreaBirdsCore.rank` when available, using the supplied catalogue/context/evidence rather than canned species.

## Same-Species Unlock Metadata

Bird encounter receipts update `destinationQuests.meetings[speciesKey]`. Three distinct destination encounter IDs for the same common species return `eligibleForUnlock:true` and call `unlockSpeciesForDestination` unless the adapter already reports the species unlocked. Replaying an entry, reloading, or visiting the same entry in review does not count again.

## Evidence

Falling-first and green logs for the original state slice live under:

`/root/.zenith/projects/20260921T123009Z-user-authorized-destination-quest-implementation/.zenith/missions/mission-001/evidence/state-worker/`

The state integrity repair red/green logs live under:

`/root/.zenith/projects/20260921T123009Z-user-authorized-destination-quest-implementation/.zenith/missions/mission-001/evidence/state-integrity-repair-1/`

Focused commands:

- `node --test-reporter=tap public/burbz/tests/test_destination_state_core_20260921.cjs`
- `pytest -q public/burbz/tests/test_destination_state_core_20260921.py`
