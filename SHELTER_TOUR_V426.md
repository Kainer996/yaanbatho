# Shelter tour location recovery — v426

The introductory shelter door previously opened the house-location picker when initial GPS placement had no anchor. Permission being enabled did not prevent this: a fix could still be pending, or the actual placement validator could reject a village/town overlap.

During the saved Alderwing intro only, world entry now waits for existing initial placement, then checks a bounded set of nearby clearings using the existing settlement/house-footprint validator and durable anchor transaction. Without a usable fix it uses the existing map fallback center. The shelter stays tier zero; no house is built, resources spent, GPS receipt invented, or tutorial step awarded by placement. Normal house selection for other players is unchanged. Existing anchors are retained. Cancellation, navigation, profile changes and failed saves cannot open a stale scene or picker. If no clearing can load, the shelter stays open with a retry message.

Validation:
- Six regression groups: missing GPS, enabled GPS with rejected placement, pending GPS, existing anchors/completed players, cancellation/profile/navigation, exhausted search/save failure.
- Five original initial-placement race groups and thirteen opening transaction groups pass.
- Connected-home migration/transaction/handoff test passes.
- Nine cache ownership/update checks pass. Two old worker harness checks fail identically on the unmodified main baseline (outdated required-runtime assertion and missing worker location.href); neither worker behavior was changed. The legacy geographic picker harness also lacks clearTimeout; native tutorial tests cover the relevant handoff instead.
- Both native phone viewport runs passed (six groups each, zero page errors). They use actual shelter movement, door, first-person world, return door, chair, orientation gates, saved-phase reload and failed-dialogue-save retry. Geographic rendering inputs are fixtures; this is desktop Chromium touch emulation, not a physical S22 Ultra.

Build and worker cache are promoted together as shelter-tour-v426-20260919. Only index.html and the cache name change at runtime.
