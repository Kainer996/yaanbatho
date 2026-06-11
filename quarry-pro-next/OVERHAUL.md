# QuarryPro 2026 Overhaul

This directory is the overhauled QuarryPro game (physics, economy, graphics),
staged inside the `yaanbatho` repo. The game normally lives in the separate
`Kainer996/quarry-pro` repository and is served at
https://yaanbatho.com/quarry-pro/ — to ship this overhaul, copy the contents
of this directory over the root of that repo (or point the deployment here).

## What changed

### Physics — machines drive like machines
- New `js/quarry-physics-core.mjs`: acceleration, braking distance, limited
  steering rate (trucks arc through turns), grade-dependent speed (loaded
  trucks crawl uphill), body pitch/roll matched to the bench, suspension
  bob, and wheel spin tied to true ground speed.
- The heightfield is sampled bilinearly, so vehicles ride slopes smoothly
  instead of stepping between grid vertices.
- Dumpers route via the haul ramp when a bench wall separates them from
  their destination — no more driving up a 50° rock face.
- Blasts throw ballistic fly-rock that bounces and settles, with a ground
  shockwave, detonation flash, rising smoke column and camera shake, all
  scaled to the shot size.

### Economy — it works like a real quarry
- Costs: drilling + explosives per tonne shot, fuel per plant/haul cycle,
  machine standing costs, operator wages, and hourly interest on the loan
  balance (one game hour passes every 20 seconds).
- Revenue: product only earns when hauled to the edge stockpiles and sold.
  A live market drifts demand per product each hour, so the best product
  to sell changes over a shift; the AI hauls whatever pays best.
- Mass balance through the plant: 92% graded product (10/20/40mm + dust on
  a realistic 3-deck split), 5% oversize recirculated to the crusher feed,
  3% scalpings waste.
- Progression: XP comes mostly from selling; each level proves out 8,000t
  of deeper bench reserve and unlocks the next bench floor.
- Bank: start debt-free, borrow £10k at a time, repay any time; overdraft
  is allowed so you can always blast your way out of trouble.

### Graphics — modern PBR rendering
- ACES filmic tone mapping + sRGB output, PMREM environment reflections,
  4k soft shadow maps, physically based materials throughout.
- Gradient sky dome with sun glow and clouds; fog matched to the horizon.
- Limestone strata banding revealed as benches cut deeper, plus a
  procedural rock detail texture on the terrain.
- Fixed the desktop layout bug that collapsed the simulator panel to 0px.

## Local development

```bash
python3 -m http.server 8901   # from this directory
# open http://localhost:8901/ → "Simulator" in the sidebar
```

The dashboard panels read the static JSON snapshots under `api/`.
