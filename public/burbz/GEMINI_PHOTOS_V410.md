# Gemini photos and durable offline capture — v410

Photo recognition returns to the user-selected Gemini 2.5 Flash. Sound recognition is unchanged. The previous free-model deployment and its no-Google requirement are superseded by the user's explicit Gemini/Google-photo-processing approval.

## Player behavior

Capture or choose a photo, frame it, then select Identify or Use full photo. The selected image commits to IndexedDB before any upload. The camera can then close and the player can continue available offline game features. Saved photos is the queue: preview, pause, retry, remove or deliberately view a completed result. Background identification never opens a recruitment overlay over gameplay. Pending images survive reload/reopen; the original phone/gallery file is untouched.

A successful result commits the existing catalogue-gated discovery, coins/XP/quest/badge mutations and a provider receipt in ONE saved-game write. A failed write restores memory. The first discovery photo is stored separately under its random game-profile ID, with atomic put-if-absent preserving the first photo. Only after its journal flag is durably saved is the redundant outbox copy removed. A failed photo write keeps the result for retry, without awarding again. Browser clearing/eviction can remove local data; no promise of permanent storage. Limits: 20 pending captures / 80 MiB total, each below 10 MiB. Actual write failures are surfaced before claiming a capture was saved.

New games receive a new random photo profile. Cloud saves preserve it; save replacement/session changes invalidate in-flight claims. Stale browser tabs cannot overwrite a newer saved game. Owner-wide IndexedDB claim leases and browser Web Locks serialize reward commits; network requests keep the same ID through interrupted-response replay. The owner ID is an isolation handle, not authentication; server-side caller and global limits still apply.

## Shared £5 calendar-month guard

`/var/lib/burbz-photo/budget.sqlite` is the ONE persistent production and paid-validation ledger, outside served content. Deployment/rollback must never recreate, reset, replace or copy it. SQLite immediate transactions reserve both possible Gemini calls before any photo egress. At most two stages are paid; no fallback or SDK retries. Cached same-owner request/image results avoid another paid identification. Unknown outcomes retain their maximum cost; restarts do not refund them. Invalid/excess usage disables all new egress pending operator review.

The fixed model is `gemini-2.5-flash`. Each generation is preceded by token counting and limited to 32,768 input tokens, 4,096 output tokens, 1,024 thinking tokens, one candidate, JSON output, no tools/grounding/cache. Reservation additionally allows thoughts beyond output, conservatively. Two calls reserve at most £0.07072 under the ceiling below. Inputs are bounded, orientation-corrected JPEGs, longest edge 2,560 pixels. Explicit network deadlines stop slow headers/bodies; a connection completing after its deadline cannot send a late POST. No new egress starts in the final 45 seconds before a London month boundary.

Google's standard tariff checked 14 September 2026: $0.30 per million text/image input tokens and $2.50 per million output tokens including thinking. Source: [official Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash). [Image token documentation](https://ai.google.dev/gemini-api/docs/image-understanding) describes tiling; the exact request is counted before generation rather than estimating from dimensions alone.

Accounting uses £1.25 per USD plus another 25% billing/tax margin (effective £1.5625/USD). This deliberately conservative ceiling is not a live exchange quotation or a Google invoice. The application stops before its accounted total exceeds £5, across all players, resetting at Europe/London calendar boundaries. It cannot control unrelated account/API usage, provider tariff changes, or provider billing that violates the stated limits. Failed or interrupted calls can consume allowance. No credits or increased budget are authorized.

Pricing review expires no later than 16 October 2026, even after a redeploy. Before extending `meta.pricing_expires`, an operator must recheck the exact model tariff, GBP conversion and billing/tax margin. Update that metadata in a transaction in the existing ledger, with at most another 32 days from the dated review; preserve salt, jobs and calls. Never automatically clear `meta.disabled`: investigate unexpected usage first. If the ceiling is no longer valid, keep service paused until corrected. Price expiry/budget pause preserves queued photos and the rest of the game.

## Server retention and deployment

The existing Flask camera route is retained. Its two temporary images live only in `/run/burbz-photo-uploads/capture-*`; ownership is recorded before writing so partial uploads also clean up. The route removes both exact paths in `finally` on success, rejection, normalization error, provider error and timeout. A dedicated systemd runtime directory clears on service stop/crash restart. The worker handles image bytes only in memory; the ledger stores hashed identities, accounting and result metadata, never image blobs. No images are placed in request logs or release backups. Google's own retention is separate; Burbz cleanup does not delete Google's data.

The installer patches only that route's temporary-file lifecycle, checks compiled code, and backs up/restores the original server code, adapter, photo worker unit and upload-directory drop-in on failure. BirdNET configuration and inference are unchanged. Worker and ledger module hashes are checked against the actually running service. Paid release proofs use stable identities and the same ledger, with three fixtures and no automatic new-ID loops. App JS/CSS URLs appear in all three service-worker lists and the guarded updater.

## Verification status

The first actual Gemini check identified European Robin / Erithacus rubecula at 0.99, verified in two calls. Conservative ledger charge: £0.008988907. This established key/model access; it was a staging validation, not itself a live release.

Focused tests cover spending concurrency, replay and owner isolation, restart/unknown outcomes, UK month/DST/rollover, usage overruns, provider/socket deadlines, strict response gates, installer rollback and actual extracted-route cleanup. Browser and final deployment results are recorded in the release evidence; do not infer publication from this document alone.

Staged verification on 14 September: 152 focused backend/adapter/cleanup/installer/changed-contract tests passed; ten Chromium queue scenarios passed; the full staged service worker installed and proved offline native import/reload, inventory access, failed-save rollback, exactly-once claims, journal storage and budget waiting. The broader historical suite contains 249 baseline failures and 14 sandbox errors; the compared new failures were repaired or rerun successfully with socket access. Optional artwork absent in the sparse local checkout is not changed by this release; actual public artwork/PWA verification remains part of promotion.
