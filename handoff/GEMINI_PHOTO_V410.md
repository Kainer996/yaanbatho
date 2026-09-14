# Gemini photo restoration and offline queue — implementation transfer

**Unfinished prototype. No production changes, paid API calls, or external photo transfers have been made in this implementation.** Photo-code and deployment writes are paused after this checkpoint for a fresh dedicated owner. Continue the existing code; do not restart from the historical local-model checkpoint.

## Controlling scope and authorization

Restore the previously successful **Gemini 2.5 Flash** backend recognition. The user explicitly approved sending identification photos to Google, production activation, and local continuation. They selected **£5 TOTAL per Europe/London calendar month across all players**; previous £1/day and larger-volume examples are superseded. Paid validation must count in the same allowance. No new permission is needed for this scope. Do not purchase credits/add a payment method; report any unavoidable billing prerequisite after completing independent work. A custom recognizer is deferred. Sound recognition must stay unchanged.

Durably save offline captured/imported photos on-device, show nonblocking pending status, preserve other offline gameplay, and identify on reconnect through the same capped Gemini route. Support reload/restart, preview/remove/pause/retry, storage errors/quota, profile/session isolation, interruption, budget exhaustion and exactly-once rewards. Recognition itself remains online.

## Baseline and checkout

Branch `codex/burbz-gemini-offline-v410` was created from verified current main **e7adaf5d596d82f41f9f7471d3b12b15ef7d672f**, Home farming v409. The historical photo v407 branch is not the implementation base. Fetch current main before continuing and again before any tested-head merge; preserve concurrent changes. The currently installed local recognizer remains the published BioCLIP 2.5/Birder v407, not this prototype.

The earlier single cloud task has finished READY. Its stale patch was not applied, merged or deployed. Its owner confirmed this local implementation owns the photo scope. Do not apply that cloud patch over current main or start another competing photo implementation. The new dedicated task takes ownership from this checkpoint.

## Files in this checkpoint

- `public/burbz/photo_budget.py`: stdlib SQLite ledger; explicit one-time initialization; read/write-only open thereafter; atomic immediate transactions; HMAC identifiers; shared integer nano-GBP reservations; fixed £5 cap; persistent rate limits, two concurrent jobs; cached replay; same-owner accepted-image deduplication; unknown-outcome retention; UK calendar month accounting; dated pricing review.
- `public/burbz/photo_gemini.py`: recovered former Gemini prompt/species/quality/crop functions plus fixed-host REST provider (no SDK hidden retries), two blind verification calls, pre-counted inputs, explicit output/thinking limits and Unix-socket service. No account/location context is sent to Google. It is NOT connected to the app or installed.
- `public/burbz/photo_queue.js` / `.css`: standalone, unregistered browser queue prototype. IndexedDB `burbz-pending-photos` / `captures`, original chosen upload Blob, SHA-256 duplicate detection, 20 captures / 80 MiB total, <=10 MiB each. Per-owner filtering; persistent leases; result/manual-retry states; inspect/remove/pause; deferred reconnect; no gameplay reward logic inside the module.
- `public/burbz/tests/test_photo_budget_v410.py`: **25 passing focused tests** against the actual ledger/worker with a mocked provider. They are not paid-model or browser accuracy tests.

## Validation performed at transfer

The exact current files pass:

```sh
python -m pytest public/burbz/tests/test_photo_budget_v410.py -q
node --check public/burbz/photo_queue.js
python -m py_compile public/burbz/photo_budget.py public/burbz/photo_gemini.py
git diff --check
```

The local venv Python used is the shared `work/venv/bin/python` in this task's workspace. Tests cover: full-attempt reservation, existing-ledger preservation, missing-ledger failure, restarts/unknown charge retention, crash without refund, owner/request/image replay boundaries, no repeated/third paid stage, 12 simultaneous requests racing for the final allowance (one succeeds), persistent rate limits, UK DST/year/month boundaries, no stage sent under a previous month's reservation, pricing expiry, invalid/excess usage, no provider call when guard unavailable, single-request negatives and replay, no automatic transport retry, and both verified calls charged.

No queue behavior tests or real browser checks have run. No actual Gemini request has run. No model accuracy or billing validity claim can be made from these mock checks.

## Budget design and review work remaining

Published tariff verified from Google's official pricing: $0.30 per million input, $2.50 per million output including thoughts, for Gemini 2.5 Flash. The prototype reserves 32,768 input tokens, 4,096 output plus an extra 1,024 thinking allowance PER call, two calls per attempt, no automatic paid retries. It uses GBP 1.25/USD plus 25% billing/tax overhead (combined 1.5625), deliberately a ceiling assumption rather than a live conversion. Actual valid usage can release unused reservation; malformed/unknown usage keeps the maximum. Full attempt maximum is about £0.07072. This is a calculated ceiling under the stated tariff/conversion assumptions, not measured photo cost or a Google invoice.

1. **Review before production:** current `finish_call` conservatively retains the reservation on invalid/excess usage but does not yet trip a global circuit breaker for a genuine provider overrun. Add/verify fail-closed response to unexpected tariff/usage/price/FX conditions. Dated review currently expires 32 days after explicit ledger initialization; decide/document a safe operational renewal path without resetting monthly charges. Never treat application accounting as control of unrelated Google account spend.
2. `countTokens` checks each exact request before generation. Verify API availability/schema and the output/thinking upper bound for this exact model. Keep all paid calls behind the already-persistent reservation. Clock/deadline and slow-body behavior need real socket/error tests. Whole-attempt reservation is retained on crash; unstarted stages are released only when finishing safely.
3. A second stage crossing into another London month is blocked. Replies are charged to the request's original reservation month. Test concurrent rollover and clarify invoice-vs-application attribution; no new-month request should spend an old-month hold.
4. Caller rate identity is supplied to the worker by the not-yet-written adapter. Derive it from a trustworthy server/proxy boundary; never trust arbitrary forwarded IP headers. Browser owner IDs are not authentication; use appropriate profile/session isolation and shared caller/global caps.
5. Do not silently reset/move/delete the persistent ledger on deployment/rollback. Paid staging tests and production MUST use the same monthly ledger. The worker's generic unexpected-exception message currently says accounting unavailable even for some provider errors; refine honest error classification.

## App integration still to do

`index.html`, `photo_id.py`, installer, updater, service-worker lists and global build are UNCHANGED in this checkpoint. Neither new module is registered or active.

- Current `photo_id.py` talks only to the old local worker. Preserve its image normalization (24 MP cap, EXIF transpose, RGB JPEG90, longest side 2560), but adapt the Unix request/response to the Gemini worker's JSON payload (`image` base64, `owner`, `requestId`, `caller`). The existing live Flask camera route is not tracked as `public/burbz/server.py`; inspect its real interface read-only rather than inventing a new server. It imports/calls the adapter. A narrow adapter request-context integration may avoid touching the untracked server.
- New response gate is `photo-gemini-v410`, `model=gemini-vision`, `modelName=gemini-2.5-flash`, accepted/verified with finite >=.90 score. Update client/proof together; do not make the client accept arbitrary old/unknown provider results. Give old clients an honest update-needed failure during promotion if necessary.
- Register queue script/CSS with exact consuming pins in **all three** existing worker asset lists and guarded updater; advance one global build/cache after integration. Existing capture `identifyImage` must enqueue durably before upload. Close framing only after confirmed storage commit, and let the player return to other screens.
- `BurbzPhotoQueue.create` expects owner/message/count/preview/claim/autoClaim callbacks. Supply a stable game-profile owner that survives reload, respects cloud account/save replacement and is not an exposed credential or email. A save failure must prevent falsely claiming ownership/storage success. Recheck owner after awaits. Current queue code has syntax checks only.
- Queue lease acquisition was just corrected to compare its own nonce, preserving cross-tab exclusivity. Network-unknown retry keeps the same request ID to recover a cached server result; known model/provider failures explicitly renew only on deliberate retry. Budget/rate/busy/month failures can wait for their given retry time; other provider failures remain manual to avoid paid loops. Review/test these transitions, timeout recovery and busy fallback when retry time is absent.
- Queue result claim is currently delegated to an UNIMPLEMENTED callback. Existing `handleBirdCandidates` awards discoveries/coins/XP and calls `saveState` in several places; it is not a transaction or exactly-once queue receipt. Add a durable per-capture claim receipt atomically with all game mutations, with snapshot rollback on failed localStorage commit. Prevent partial nested saves during that transaction. Defer async `rememberPlayerBirdPhoto` until after the game commit; retain ready queue item if final photo/game storage fails. Replayed results must not award twice or increment sightings twice. Keep profile/session/cross-tab claim boundaries safe.
- The existing accepted-photo journal is IndexedDB `burbz-player-photos/photos`, 1024px JPEG82 after accepted discovery. It does NOT save pending captures. Reuse it only for final accepted photos, not as a substitute for the pending store.
- Avoid intrusive result/recruit overlays when background processing finishes while playing elsewhere. Retain a ready result and expose a small Saved photos control; claim on deliberate View result, or automatically only in the active scan flow. Verify that all normal offline gameplay remains available.
- New queue panel needs real visual/accessibility/keyboard/short landscape/phone testing and action/error tests. Do not claim device storage is permanent against browser eviction; surface write/quota failures before any 'saved' status.

## Deployment and proof still to do

Read `public/burbz/AGENTS.md` (§7 invariants, §6 cache, §5 LFS), `scripts/update-live-burbz.sh`, `scripts/install-photo-id.sh`, existing camera client/installer tests and current `PHOTO_RECOGNITION_V407.md`.

The guarded updater currently stages the old ML worker and requires its bundle. Refactor promotion transactionally for the lightweight Gemini worker and ledger, retaining old worker/adapter rollback. Existing sound proof must still pass; never alter BirdNET dependencies/service configuration. Keep server credentials outside Git/browser/logs and runtime SQLite outside served content. The API key/configuration was checked only for presence previously; validity, free/paid tier, credit and provider quota are not established. If setup/top-up is required, finish independent integration/tests and report the precise account action; no purchase is authorized.

Required new proof includes real disconnected browser capture, storage failure, reload/reopen, continuing Home/gameplay, reconnect, interrupted upload/response, profile changes, two tabs, budget exhaustion, removing a pending capture, and exactly-once reward/photo persistence. Use the existing public diagnostic bird/lookalike/nonbird fixtures for bounded live Gemini tests, all charged through the shared ledger. User original failing photos are still unavailable. Preserve prior sound checks and installed-PWA/offline/save verification. There is no reason to rerun an open-ended model selection study.

Publish only through the existing reviewed branch/merge/guarded deployment process, matching the exact tested head and fresh main. Verify actual deployed revision, managed hashes, worker health and public behavior; a dispatch/lock/no-op return is not proof of deployment. This checkpoint has no PR, merge, deployment or paid-test receipt.
