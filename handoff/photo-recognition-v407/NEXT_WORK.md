# Current implementation request: Gemini photo recognition

This supersedes the historical local-model work in this branch. Start from current main and preserve all newer game releases. The local-model upgrade is already published; do not merge this old candidate over main.

The requested replacement is the previous Gemini 2.5 Flash photo integration. Restore server-side recognition with a shared **£5 total monthly budget across all players**, resetting on the first day of each calendar month in Europe/London. The user has explicitly approved recognition photos being sent to Google and production activation within this limit. Do not add payment methods, buy credits or enable unbounded spending. Paid validation is part of the same budget. Finish independent code and tests before reporting any unavoidable billing prerequisite.

Required controls:

- Persistent atomic accounting shared by all web workers and users, reserving conservative maximum cost before a request can leave the server.
- Bounded input, image size, output, thinking and retries; verification and retries must also consume the reservation. No fallback may bypass it.
- Safe concurrent requests, restart/crash recovery, unknown charged outcomes, and calendar rollover, including replies arriving after rollover.
- Conservative documented GBP/USD conversion and relevant charge overhead. Usage alerts alone do not enforce this limit.
- Bounded request rate and queue; explicit unavailable, budget-exhausted and provider-quota responses. Never turn these errors into a species or reward.
- Server-only secrets, current accepted-discovery and photo-journal behavior, unchanged sound recognition, and preserved offline game startup.

Use fixtures and mocks first to prove budget and lifecycle behavior. Then compare permitted actual recognition calls on known bird/lookalike/nonbird controls through the real camera normalization, recording request usage and cost. The user's original failed photos have not been provided. The previous successful model is recoverable from Git; do not substitute an extended model-selection project.

Current offline feasibility: native camera/file selection and framing do not inherently require network after the app is cached. Recognition still requires the backend; neither Gemini nor the current VPS model runs on a player's phone. The pending photo is presently an in-memory Blob/bitmap and does not survive reload. IndexedDB stores only the compressed first photo of an accepted discovery, not a pending identification queue. The user has now explicitly approved implementing a separate durable bounded pending-capture store alongside Gemini restoration. Save captured/imported photos before claiming they are safe; keep pending status nonblocking so the rest of the offline game remains usable. Photos must survive reload/restart where browser storage permits, with honest quota/storage-failure messages, correct player/session ownership, preview/remove controls and deduplication. Retry on reconnect through the same shared monthly budget, retaining items when network, API or budget fails; avoid automatic paid retry loops. Award only through the existing accepted-discovery/photo-save gate, exactly once. Validate an actually disconnected browser, reload/reopen, reconnect, interrupted requests and budget exhaustion. This is deferred online recognition, not immediate offline identification; no new on-device-model project is requested.

One cloud continuation already exists. Preserve single ownership and the requested local pause for shutdown. This document records requirements; it does not establish that the running task has received them or that any restoration has been implemented or deployed.
