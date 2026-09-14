# Building opening v405

Construction clocks now finish the work without remotely activating an unstaffed building. The existing Project Manager/Lord Mayor assignment grants automatic opening through the canonical settlement scope. A player can open a completed site from its actual loaded, reachable scaffold in Alderwing. Existing operating levels remain usable while upgrades await opening. Crews are released at timer completion.

The nearby control retains the three-tap, once-per-project 25% assistance action while work is active, then becomes Open building. Civic Hall work and bulk-order sites use their own original ledgers. Bulk orders retain one duration, one assistance receipt and their original 30 XP total after every site is opened; they do not acquire single-project XP or first-quarry materials. Legacy bulk orders already paid above another pending level wait without overwriting the earlier work. Stable borough Hall records retain independent levels and clocks; all constituent Hall sites are represented in a City.

A single frame-owned job prepares replacement paid models and static batches while old geometry remains drawn. Save, proximity and player clearance are rechecked before installing the new model/collision pair. Failed saving or cancellation retains the old scene. The renderer, terrain, other buildings, player pose and camera are retained. Starting and streamed settlement frames share the transaction. Doors and 3D collision boxes refresh with the same installation; removed builder objects leave the animation registries. Existing residents retain their objects and routines.

Current paid plot coordinates are captured with the successful opening transaction. Other completed buildings keep their positions after rebuilding the overview or revisiting; an upgrade stays on its existing plot. The new building uses its scaffold plot. The Home village rows and management cards distinguish waiting sites from completed notices without occupying a construction crew or offering another same-building purchase.

## Local validation

- 6 actual Three.js scene groups: transformed coordinates, staged replacement, cancellation, cached collision and atomic object installation.
- 8 village opening/save groups and 9 Hall/bulk-order groups, including re-entrant Hall normalization, partial order receipts, failed-save rollback and legacy later-level orders.
- Existing 11 help/save/runtime groups and 64 selected settlement economy regressions pass.
- Local actual scaffold interaction passes village, town ward, Hall, bulk order, actual manager assignment and a house upgrade. Four viewport layouts, fixed player/canvas, reload and rebuilt-neighbour plot checks are covered (earliest village/town runs only checked saved plot data; later Hall/bulk/manager/upgrade runs also rebuild the scene).
- The streamed-destination run passes ten checks: actual outward/return/revisit flight, landing, opening the correct saved town ward, its journal/rewards/interior and return, retaining the canvas.
- The stronger room run proves twelve advancing frames, native walking and turning, no caught error, and return. A deliberately failed durable save retains the scaffold and level and permits a successful retry. Three separately plotted legacy bulk cottages survive the same room/reload/rebuild checks.
- The quiet laptop run at a 390×844 emulated touch viewport measured mean frame intervals of 18.85 ms before, 22.81 ms over the short 19-frame preparation window, and 19.37 ms after. Respective p95 values were 33.4/50.1/33.4 ms. No simultaneous browser or video recording was active. This is not physical-phone proof or a constant 60 FPS claim.

## Release verification

The global build, changed loader URLs and all three worker lists advance together to `building-opening-v405-20260914`. Public source equality, native play, installed worker and cold offline/restart/save verification belong to the release evidence and are required before reporting publication complete.

Existing resident objects and routines remain; the saved census reconciles with the new operating economy. Newly added outdoor resident actors and newly started manager work sites appear on the next settlement rebuild. Existing visible manager-completed sites refresh in place. Terrain, separate GPS quest authority and the paused 3D Merlin model are outside this change. Photo accuracy, wilderness discovery buildings and the pre-existing real GPS map performance limitation remain open.

Evidence directory: `/home/yaan/Documents/Codex/2026-09-13/realtime-voice-chat/outputs/building-opening-v405`. The first Hall browser failure exposed a waiting marker written onto a detached normalized construction record; the fixed run is `hall-current`. Earlier failed test artifacts are preserved. Renderer screenshots must be inspected separately from assertion results.
