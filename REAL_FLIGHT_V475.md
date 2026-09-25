# Real flight v475

Build: `realistic-flight-v475-20260925`.
Status: pushed on `claude/burbz-realistic-flight-77nufl`, built on main at v474. Not yet merged or published.

## What Yaan asked for

- Make flight feel really realistic, like a real bird.
- The player has to flap to take off and to hover.
- Heading slightly down builds speed, with no flapping.
- Pulling up slows the bird until it would stall without flapping.

## What changed

Both flights share one flight core: the wing-craft over Alderwing and the bird in the Academy's "Fly around". Both now fly by the same rules.

- **Gravity always pulls.** Nothing hangs in the air for free any more.
- **Wings need airspeed.** At cruise the wings carry the craft easily. Below half cruise speed they cannot, and it stalls.
- **The view steers the path.** Look down and the craft dives and gathers speed. Look up and it climbs, trading speed for height, until it stalls.
- **Wingbeats are real strokes.** Each beat pushes on the downstroke and rests on the upstroke. Once begun, a beat finishes, so a quick tap still gives one full stroke.
- **Hovering is hard work.** Holding Flap at low speed holds the craft up and climbs slowly, about 2.5 m/s. Let go and it stalls.
- **Take-off needs flapping.** Take off gives one strong wingbeat. Keep flapping to climb away, or flap ahead to run and lift off after about a second.
- **Birds do not strafe.** The stick's sideways push, and A/D, bank into a turn. Tight turns cost speed.
- **Momentum carries.** A glide survives a lost tap or a notification. A resumed flight picks up in a glide.

### Controls

| Control | Craft | Academy bird |
| --- | --- | --- |
| Flap: lift, hover, climb | Flap button, Space | Slide up, Space |
| Flap ahead: cruise | Stick up, W, Auto | Stick up, W |
| Airbrake | Stick down, S | Stick down, S |
| Turn | Stick sideways, A/D, look | Stick sideways, A/D, look |
| Dive: tuck the wings | Dive button, Shift | Slide down, Shift |

The old Climb and Descend buttons are now Flap and Dive, in the same places.

### What you feel

- The view bobs with each wingbeat and holds still in a glide.
- A stall shudders and the nose drops. The Flap button glows orange while stalling. In the Academy, the status line says "Stalling · flap or dive".
- A fast dive widens the view a little.
- The left cockpit dial now reads airspeed. Its red ticks mark speeds too slow to stay up. The heading strip above already showed the compass. The clock and altimeter stay.
- Reduced motion keeps the camera still.

### Numbers, for the craft

| | |
| --- | --- |
| Cruise, flapping ahead | about 19 m/s, holds height |
| Stall | 9 m/s |
| Gravity | 9.8 m/s² |
| Glide, no flapping | about 8 m ahead for each 1 m down |
| Level look, no flapping | slows from cruise to a stall in 6–7 s |
| 10° down, no flapping | 19 → 24 m/s in 15 s |
| 30° down | 19 → 39 m/s in 8 s |
| Fastest dive | 40 m/s |
| Pull up 20° from cruise | gains about 8 m, stalls after 2.5 s |

The Academy bird uses the same shape at its own 5.2 m/s cruise, so it floats more gently and beats its wings faster.

All the numbers live in one line at the top of `public/burbz/academy_flight_core.js`, so the feel is easy to tune.

## Checks

- New `tests/test_real_flight_v475.cjs`: 14 groups. Take-off, hover, tap-one-beat, stall, dive, pull-up, recovery, tuck, energy never appears from nowhere, floors and walls, resume, camera.
- `tests/test_flight_controls_v371.cjs`, `tests/test_geographic_world_v386.cjs` and the flight lines in `tests/test_academy_flight_v370.cjs` now check real flight instead of the old free hover.
- The v470 and v472 release tests accept v475 pins, as earlier releases did.
- Node suites: same results as main, plus the new test. Pytest: the same 312 failures as main, none new.
- Browser, real renderer, synthetic map: new `tests/run_real_flight_v475.cjs` passes 6/6. Take-off settles without flapping; Flap climbs; letting go stalls and lights Flap; a dive goes 18 → 22 m/s; a pull-up climbs then stalls; W holds height at cruise. `run_craft_controls_v427` (now using Flap and Dive) passes 9/9. `run_alderwing_steady_v472` and `run_alderwing_nature_v470` pass.
- Academy "Fly around" in the browser: glides, stalls with the status line, Space hovers it up, it lands on the Library deck and takes off with a wingbeat. No page errors.

## Open

- Yaan to feel it on his phone. Software WebGL is not phone hardware.
- The old `geographic_world.js` view still says Climb and Descend. The game never opens it now.
