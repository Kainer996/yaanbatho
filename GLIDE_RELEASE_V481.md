# Glide on release v481

Build: `glide-release-v481-20260925`.
Status: pushed on `claude/burbz-realistic-flight-77nufl`. It builds on main after Merlin flight v479 and the smoother Earth, whose cache name took v480, so this is v481.

## What Yaan asked for

- Move the Flap button further to the right, and remove the Dive button.
- When the player takes their finger off Flap, the wings stop and the craft glides. It keeps gliding until it loses height naturally.

## What changed

- **Only Flap beats the wings.** That means the Flap button, Space, or the Academy slider pushed up. The stick, W and Auto no longer flap. While you hold Flap, pushing the stick forward still drives the beats ahead.
- **Let go and you glide.** The wings go still within one beat. The craft tips its nose gently into a steady glide at cruise speed. It sinks about 1 m for every 8 m it flies, all the way to the ground.
- **A slow craft finds its speed.** Let go of a hover and the craft drops its nose, picks up speed, then glides. It falls about 12 to 25 m while it does. No stall warning shows for this drop.
- **Flap at speed climbs on.** Before, holding Flap in flight slowed the craft to a hover, so letting go stalled it. Now Flap climbs at about 13 m/s and 3.5 m/s up. You hover only when you're already slow.
- **Take-off is unchanged.** Hold Flap on the ground and the craft rises straight up, clear of the trees.
- **Pull-ups still stall.** Look up hard with still wings and it slows into a stall. The Flap button glows, as before.
- **Looking down still dives.** Look down to gather speed. With Dive gone, that is the way down on touch. Shift still tucks the wings on a keyboard.

### Buttons

- One Flap button, by the right thumb.
- Landscape: above the health panel, beside Attack.
- Portrait: above Attack.
- The Dive button is gone.

### Hints

- Touch: "Slide up to flap · Let go to glide · Stick: turn · Look down to dive".
- Keys: "Space: flap · Let go to glide · A/D: turn · Look down to dive · F: land".

### Numbers, for the craft

| | |
| --- | --- |
| Glide, no input, level look | 18 m/s, sinking 2.2 m/s (8:1) |
| Holding Flap at speed | about 13 m/s, climbing about 3.5 m/s |
| Holding Flap on the ground | rises straight up, about 3 m/s |
| Letting go of a hover | drops about 12–25 m, then glides |
| Look up 25° with still wings | stalls in about 3 s |
| Look down 10° | 18 → 33 m/s over 14 s |

The Academy bird follows the same rules at its own 5.2 m/s cruise.

## Checks

- `node tests/test_glide_release_v481.cjs`: 9 groups.
  - Only Flap beats the wings.
  - Letting go glides without a stall, from a climb and from a hover.
  - A level look holds a steady 8:1 glide at cruise.
  - A glide reaches the ground.
  - Flap hovers when slow and climbs at speed.
  - Pull-ups stall and looking down builds speed.
  - The Academy bird glides the same way.
  - One Flap button sits on the right, with no Dive.
  - The v481 release markers match.
- Updated: `test_real_flight_v478.cjs`, `test_flight_controls_v371.cjs`, `test_geographic_world_v386.cjs`, and the Alderwing release lists.
- Node and pytest suites: the same failures as main, and no new ones.
- Browser, real renderer (`tests/run_glide_release_v481.cjs`, 8/8):
  - Take-off settles.
  - Flap climbs clear.
  - Letting go of a hover glides on at 15 m/s with no stall.
  - A level glide holds 18 m/s at 8.1:1.
  - A dive goes from 18 to 22 m/s.
  - A pull-up stalls.
  - W never flaps, and Space climbs.
  - Flap sits right, with no Dive.
- `run_craft_controls_v427.cjs` (9/9): nothing overlaps at five screen sizes, and the craft glides down to land.
- The Alderwing runners pass. An Academy probe passes: glide, hover, Library landing, take-off.
- Older runners that still pressed Climb and Descend now use Flap and the glide. `run_wilderness_layout_v1`, `run_landscape_hud_v394` and `run_flight_craft_v418` still fail for older reasons, before any flying. The first two fail the same way on main. The v418 runner stops at a "Board craft" button that was renamed long ago.

## Open

- Feel it on a phone. If the glide is too long or short, or a hover drops too far on release, those are quick tunes.
