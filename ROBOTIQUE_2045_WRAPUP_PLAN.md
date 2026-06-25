# ROBOTIQUE 2045 Wrap-Up Plan

Date: 2026-06-25

## Playable Tonight

This build is intended to be playable on desktop and mobile from the live site:

- Hub: `https://yaanbatho.com/robotique/`
- 3D version: `https://yaanbatho.com/robotique-3d/`
- 2D version: `https://yaanbatho.com/robotique-game/`

The current playable focus is Chapter 1: waking in New Meridian in 2045, earning credits, finding work, exploring interiors, using the 2D/3D mode switch, and testing the Sky-Cab pilot mode.

## What Is In This Build

- 2D and 3D versions remain linked by shared story/save transfer via the mode bridge.
- The 3D build has a mobile-friendly pause menu, inventory styling, graphics presets, and a playable Sky-Cab pilot HUD.
- The 2D and 3D builds share the new Meridian Array Annex interior and Quinn calibration job.
- New visual assets are wired for skyline, wet asphalt, menu/inventory, clinic, maker space, arcade, and annex interiors.
- 3D UI now releases pointer lock before opening panels/dialogue so mobile and desktop menus are easier to use.

## Tomorrow Test Checklist

- Open the hub on a phone and start the 3D version.
- Start a new game, move around, open menu, inventory, quests, and help.
- Use `CAB` to enter Sky-Cab pilot mode, steer, boost, then land.
- Use `2D` from the 3D version and confirm the story continues in the 2D version.
- In 2D, enter the Meridian Array Annex, talk to Quinn, complete the calibration job, then return outside.
- Reload the page and confirm the save can continue.

## Remaining Plan

1. Content density
   - Add more named NPCs with short schedules, local gossip, and repeatable small jobs.
   - Add more interior rooms around Transit Plaza, Velvet Row, clinic, maker space, and arcade.
   - Give each district a clear reason to revisit after the first quest pass.

2. Main story
   - Expand Quinn and Okafor into a stronger Chapter 1 ending path.
   - Add clearer quest tracker wording for the wormhole/exotic-matter arc.
   - Add optional background lore for 2026 to 2045 history without blocking play.

3. Sky-Cab and vehicles
   - Add better takeoff/landing animation and audio hooks.
   - Add clearer pilot boundaries and rooftop destinations.
   - Add traffic layers so the city feels busy while flying.

4. Mobile polish
   - Tune touch joystick size/placement after real phone testing.
   - Add an explicit mobile onboarding line on the title screen.
   - Check small-screen text wrapping across dialogue, inventory, and quest panels.

5. Visual pass
   - Replace remaining placeholder geometry with stronger 2045 props.
   - Add more signs, reflections, window variety, street details, and interior lighting.
   - Keep performance presets working before adding heavier effects.

6. Save and deployment hardening
   - Add a versioned save migration note before changing save structure again.
   - Keep `index.html` and `play.htm` entry points in sync for server compatibility.
   - Run desktop and mobile smoke checks before each live upload.

