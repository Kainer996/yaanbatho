# Living Home desk and centred solo battles

Release marker: `living-desk-v395-20260913`, based on the published landscape/atlas release. The user explicitly requested publication of ready work. This checkout isolates the finished Home/battle changes from ongoing world, tutorial, photo and combat work.

Home uses an original generated walnut desk painting, with large Sound and Camera controls, compact quest/village/navigation rows and real affordable building suggestions. A suggestion is derived from the existing costs, unlock gates and free construction crews, including the shared Town crew limit. It opens the existing building management sheet; it cannot purchase a building. Next Player Quest and ready rewards can appear together. Rows update through the existing save/screen/heartbeat refresh. The existing top home-entry control is labelled Enter Alderwing; the new shelter/tutorial route is not part of this release.

A solo arena bird keeps the normal squad-card width and is centred independently on its side. Four-bird squads and the DOM-based attack targeting remain unchanged.

All three changed Home module URLs, all three service worker asset lists, the global build/cache and the updater's image manifest are promoted together. No save migration, recognition worker change or new third-party runtime is introduced.

## Verification

- Twenty focused Home, same-origin art and complete offline-startup contract checks pass.
- 16 native Home browser checks pass, covering eight layouts (320, 390, 667 and 1280 widths in both appearances), real management navigation, affordable/unavailable crews, unchanged currency/inventory on render or navigation, saved reload, reduced motion and a fresh empty Home projection.
- Twelve actual arena renders cover independent 1/1, 1/4, 4/1 and 4/4 squads on portrait phone, landscape phone and desktop dimensions. Solo cards centre without increasing in size.
- Test browsers use disposable saves on this laptop with emulated phone sizes. No physical-phone performance claim is made. Local screenshots resolve pre-existing artwork from same-origin live/cache sources where the sparse checkout omits it.

Public hash, service-worker and cold offline-startup proof is recorded by the release owner after deployment. Current evidence directory: `2026-09-13/realtime-voice-chat/outputs/release-desk-v395`.

The expanded continuous-world arrivals, shelter opening/build-house quest, camera-recognition correction, Help the builder interaction and revised zombie/bow/Fireball behavior remain independent unfinished follow-ups. They are not claimed as shipped by this release. The separate 3D Merlin work remains paused.
