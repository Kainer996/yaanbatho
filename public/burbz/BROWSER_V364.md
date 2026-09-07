# Tutorial contrast v364 — 7 September 2026

The phone playtest found dark “Tap Merlin”, “Tap Feed” and explanatory text on the Normal tutorial's dark woodland bubble. Scoped CSS now gives the shared title/body bright cream, action hints cream on an explicit dark gold gradient, and the small labels/navigation readable gold. Comic retains ink on paper, with its actual speaker/counter selectors now covered.

## Focused verification

- 14 tests passed: concise onboarding, Merlin feed action and Appearance release suites. These cover stable lesson IDs/resume, the Feed action contract and mutually exclusive theme selection.
- A disposable localhost static preview used the actual game inline CSS and all three Appearance stylesheets in two 390 × 526 frames. It rendered the real tutorial classes and both action hints. Both themes were visually checked; title, body, hint, chapter, counter and navigation had no horizontal overflow.
- Computed Normal colors: title/body `#fff4dc`, hint `#fff1bd`, metadata `#efd49a`. Calculated contrast: title/body 11.64:1 against the lightest panel endpoint composited over white; hint 8.36:1 against the lightest hint endpoint; metadata 8.81:1 against that panel; primary button 7.35:1 against its lightest endpoint.
- Computed Comic colors remained `#152828` on `#fff9e8` (14.62:1); metadata `#66500c` (7.35:1). The preview confirmed readable ink/paper styling rather than inheriting Normal's cream.
- The preview loaded no game JavaScript, player save, service worker, location or network game data. Real phone progress was not accessed or reset. This patch changes no tutorial IDs, handlers, gameplay or storage code; the only JavaScript edits are the required build/cache stamps.
- Existing current-build test assertions move mechanically to `tutorial-contrast-v364-20260907`. Runtime module URLs, asset manifests and updater dependencies remain unchanged.

Map and Stores feedback remains separate. No map styles, inventory data or unlock behavior are changed by this release.
