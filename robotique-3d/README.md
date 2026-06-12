# ROBOTIQUE 3D — Chapter 1: Waking in 2045

The same game — same story, same NPCs, same quests, same city — rebuilt as a
**first-person 3D open world**. You wake on the bench in Memorial Park and the
whole of New Meridian stretches east: the residential block, Market Street,
Transit Plaza with Velvet Row running north, and the Research Campus where the
Array's wormhole ring turns slowly over the rooftops.

Runs on PC and mobile from a single page. No build step, no server, no music
(by design — the soundtrack slot is reserved).

## Controls

**PC** — click the world once to capture the mouse. WASD walk (SHIFT jogs),
mouse looks, **E** talks/uses/advances dialogue, **F** punches, **I** bag,
**J** quests, **H** help, **ESC** releases the mouse.

**Mobile** — left thumb stick walks, drag anywhere else to look, the big **E**
button talks/uses/punches. ⛶ goes fullscreen and locks landscape.

A golden **light pillar** always marks your current objective.

## Architecture (built to grow)

```
robotique-3d/
  index.html          UI shell (HUD, dialogue, panels, touch controls)
  js/three.module.min.js   three.js r160, vendored — works offline
  js/content.js       ALL game data: state, quests, dialogue trees, NPC cast,
                      scene graph, pixel-sprite builders. Engine-agnostic —
                      it ran the 2D game and now runs the 3D one.
  js/ui.js            DOM layer: dialogue box, HUD, panels, joystick, input
  js/game.js          three.js engine: world build, FP controller, billboards,
                      combat, interaction, save/load, main loop
  assets/             CC0/CC-BY pixel art (ansimuz) used as neon sign textures
```

- **Content is decoupled from the engine** via a small injected context
  (`setCtx`), so quests/dialogue are testable headlessly in node and reusable
  if the renderer ever changes again.
- **NPCs are 2.5-D sprite billboards** built from the same hand-authored
  pixel characters as the 2D game — an intentional Octopath-style look that
  keeps every character recognizable and renders fast on phones.
- **Mobile-first performance**: unlit/emissive materials everywhere (the neon
  look is free), one draw call per building, capped pixel ratio, fog-limited
  draw distance, no shadows, sprite crowds.

## Packaging as an Android app later

The game is a static, self-contained, offline-capable folder — exactly what
wrappers want:

1. **Capacitor** (recommended): `npx cap init && npx cap add android`, point
   `webDir` at this folder, build in Android Studio. Add a `manifest.json` +
   service worker first if you also want installable-PWA behaviour.
2. **TWA / Bubblewrap**: host this folder on any HTTPS URL and
   `npx @bubblewrap/cli init --manifest=...` produces a Play-Store-ready APK.

Nothing in the code assumes a server: all paths are relative, storage is
`localStorage`, input already handles touch, and fullscreen/orientation-lock
are wired.

## Time

A full **day/night cycle** runs on the in-game clock (HUD shows time and day
count; one game-day ≈ 48 real minutes). The sun and moon arc across the sky,
stars fade in, dawn and dusk get a golden-hour wash, and the city's neon takes
over after dark. **Time gates content**: Velvet Row works nights — Roxy, Sable
and Big Sef are only out between evening and dawn. Sleeping advances to the
next morning. Quests can hook the clock (`npcPresent`, hour-based schedules).

Dev mode (`?dev=1`) adds time controls next to the turbo button: **▶ cycles
time speed** (paused / ×1 / ×60 / ×360 ≈ an 8-second day) and **+1h skips an
hour** — keys `[` `]` and `N` on desktop.

## City life

- **Flying cars**: thirteen hover-cars (including two air-taxis) stream along
  lit lanes above both sides of the street, plus crossing traffic over Velvet
  Row. **Sky-Cab pads** at Memorial Park, Transit Plaza and the Research
  Campus fly you across the city — the first courier hop is free, and Otto,
  the cab's AI, has opinions about when you'll own a flying car of your own.
  (Player-owned flying cars are on the roadmap — Otto promised.)
- **Street food**: VN-D0R sells noodle bowls, SKW-R 7 grills vat-yakitori at
  Transit Plaza, and every interior serves something.
- **Item pickups**: ten glowing pickups hidden around the world and interiors —
  food and anonymous credit chips. Walk into them; they go straight to the bag.
- **Furnished interiors**: every room is dressed — stocked shelves, freezer
  doors and a living hydroponic wall at GreenGrid; tables, pastry case and a
  city window at the Bean; conveyor plates, lanterns and a bottle wall at
  Kaiten-45; mailboxes, sofa and dead elevator in the lobby; numbered doors on
  Floor 2; a kitchenette, wardrobe and skyline window in Unit 4; bottle wall,
  booth and jukebox at The Static.
- **Seven more citizens**: Juno the busker, SKW-R 7, Tomas the tourist, Hex
  the loop tech, Nia, Goro, and Pim the bar poet.

## Chapter 1 content

Identical beats to the 2D version: wake in the park → Elias → VN-D0R's three
deliveries (café, transit, campus) → the Raze ambush back in the park
(first-person fist fight; his dropped chip funds the flat) → ₣300 to Mr. Tan →
Tanaka Towers lobby/stairs/Floor 2 (Vex, D3X, POST-3) → Unit 4, sleep →
Dr. Okafor's wormhole briefing (Morris–Thorne throat, Casimir exotic matter,
the 2026 rule) → chapter end. Plus the full survival loop (hunger/HP/food at
GreenGrid, Kaiten-45, the Crooked Bean), Shock Knuckles, freelance gigs, and
all of **Velvet Row**: Roxy, Sable, Big Sef, the Neon Garden lockout, and The
Static with Dee and Crow.

## Art credits

Pixel art accents — animated neon banners, HOTEL sign, hover-cars, drones — by
**Luis Zuno (@ansimuz)**: "Warped City" (CC0) and "Cyberpunk Street
Environment" (CC-BY 3.0). See `assets/LICENSES.txt`. Everything else is
original to this project.
