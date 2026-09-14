# New-game trailer and tutorial access v415

The shelter/Home-first bootstrap bypassed the existing intro movie, and returning to the desk could mark it seen without playback. New and interrupted openings now use a separate pending receipt and play the original 29.486-second trailer before Merlin. Existing games without a legacy seen flag remain existing games. Skip and native completion lead to the tutorial; a failed request has Retry/Skip. Late playback promises cannot restart a dismissed movie.

Start New Game still requires its native confirmation and clears progress through the established reset path. It preserves the installed worker and cached assets. A same-tab, one-use receipt retains the explicit confirmation until the next document consumes it, including an offline navigation whose cached URL is normalized. Cancellation creates no receipt. The worker warms the original 17,742,035-byte movie as an optional asset and serves cached full responses as valid byte ranges for offline playback and seeking. Offline entry navigation now prefers the current cached canonical index over any older cached directory URL. An old directory entry could otherwise win before the current index; a focused mixed-cache regression covers the narrower app-entry fallback. The installed acceptance also checks that the actual offline document retains the current build. Other documents retain their own fallback.

A first installation without a successfully downloaded movie still offers a deliberate Skip; the movie is not an installation gate.

The opening says “Welcome, Earthling!” and keeps Merlin’s falcon-friend introduction. The repeated speaker/chapter labels are hidden while stable lesson IDs and saved positions remain unchanged. The same Settings button moves into the active tutorial layer, outside the inert header and above interaction shields, with a 44px target. Opening Settings pauses the lesson; closing, Escape or browser Back resumes its saved position. Cancelled New Game does not change possessions, balances, seen chapters or rewards. A deliberate replay replaces the paused presentation.

## Validation

- 7 native phone-sized/desktop trailer groups: actual advancing original movie, full native EOF, Skip, fresh reset, failed request/Retry, existing reload and save retention.
- 9 native Settings groups: dialogue, spotlight and free action at 390×844, 844×390 and 1280×800; actual clicks/keyboard, cancelled reset, Close/Escape/browser Back and exact saved lesson/economy.
- 11 cached-video full/range/suffix/invalid-range cases and 8 current-versus-old offline entry/reset/scope cases, plus cancellation/normalized-URL/one-use reset-intent checks.
- 20 focused reset, save migration, feeding, first-flight target and offline/cache regression checks pass. Two obsolete source-count assertions were excluded: chapter counters expect pre-shelter order; concise lesson test expects the old fixed 36-step copy. They fail identically on the release base; neither is a new runtime regression.
- 6 final installed/offline groups pass: actual old-to-new worker; retained existing save with no forced movie; exact installed document and full original movie SHA-256; confirmed offline New Game; native cached video seek in landscape; Skip, Settings cancellation and subsequent offline restart. Zero page errors. The fixture deliberately blocks outside map/font/auth requests; those expected network failures do not stand in for gameplay results.
- Public release evidence is recorded by the release owner before publication is reported complete.

Limits: automated and owner-run Chromium checks on this laptop, with phone viewport/touch emulation. These are not physical-device or independent new-player usability studies. No paid recognition calls, real user resets or changed game rewards.

This slice does not implement the newly approved Birdhouse/discovery/need/errand opening sequence, progressive Home layout, or world WIP. Those remain separate active tasks and must not be described as shipped with v415.
