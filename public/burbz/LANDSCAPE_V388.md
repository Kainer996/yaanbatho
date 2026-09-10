# Landscape village and town layout — v388

Local follow-up based on released v387 merge `c99a19ccc8af456bba0262b19b01eabb71e7e5a7`. This layout is now live through PR 321, merge 6af560cf5926ab9255ac04e4f48b84993a5d11de; public runtime files and the actual worker were verified after authorized publication.

## Layout

Landscape viewports at least 640px wide use the existing navigation buttons in a right-hand rail. Main destinations come first, with management and adventure destinations below. All 13 unlocked icons fit a 667×375 viewport at 44px or greater target sizes; the rail can still scroll when a smaller available height or safe-area inset needs it. Existing hidden/locked states, badges, accessible names, focus and routing stay attached to the original buttons. The rail makes room for right-side safe areas.

The village and town 3D overviews fill the left 50% of the viewport below the shared player header. The remaining space before the rail holds the current screen's existing tabs, settlement information, build desk, town ledger and management controls. This column scrolls independently, leaving the scene in place. Town headings reflow on narrow landscape screens, and its management sheet stays within the right side. The ordinary Empire atlas height reads the available screen bottom rather than the moved dock's top.

The small `landscape_ui.js` adapter moves the existing stage element into a layout slot while retaining its canvas, listeners and renderer. A comment marks its exact portrait location. Returning to portrait or changing screens restores the original node. Focus and scroll are retained, and the existing resize callbacks update the actual renderer and camera aspect after layout changes. No bird, inventory, economy, quest, world position or save data is read or written by the adapter.

The responsive split applies to overviews. Body-level village/town walking and geographic/house canvases retain their full-screen geometry and controls. When the house projects the existing app into its 3D monitor, its established composition is retained. Portrait keeps the existing full-width stages and bottom dock. Widths below 640px retain that layout too.

## Maintenance and checks

- Both new modules are loaded with `landscape-v388-20260910`, included exactly once in all three worker lists and in the updater. The app build/cache advance to v388; previous module pins remain unchanged. Historical latest-build test labels advance independently of the module versions they test.
- `tests/run_landscape_v388.cjs` uses a disposable save, real village/town renderers and native browser input. It measures the left half, canvas and camera aspect, independent panel scrolling, all 13 navigation targets, native routing, full-screen Town Walk/Escape, and restoration to portrait. Desktop 1440×900, phone landscape 844×390 and 667×375, and portrait 390×844 and 320×740 are covered.
- 69 related Python checks pass, including existing world/Home/footstep installation, town/village behavior, swiping and the new two-module offline-installation contract.
- All 12 main native browser groups pass. A separate thirteenth group verifies the town ledger at 667×375: it fills the management column with an 8px inset, scrolls without horizontal clipping, and closes using its reachable 44px button. Final screenshots were visually inspected.
- Browser fixture code waits for the existing screen entrance transition to finish before comparing positions. Earlier captures taken during that transition are retained as investigation evidence, not presented as final passing runs.
- Software WebGL is used for local proof; this is not a physical-phone frame-rate claim. Missing unchanged icons in the sparse checkout are supplied from the existing public release, with hashes in the evidence folder. No new artwork is included.

The layout changes are separate from the independently owned Merlin animation work, and neither was bundled into the approved v387 release.
