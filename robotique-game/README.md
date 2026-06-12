# ROBOTIQUE — Chapter 1: Waking in 2045

A pixel-art, side-scrolling open-world RPG. You fall asleep in 2026 and wake up
on a park bench in **New Meridian, June 12 2045** — the Singularity year. Earn
credits, find a roof, and discover the one piece of physics that can take you home.

**Everything is hand-built in a single `index.html`** — no dependencies, no build
step. Open it in any browser and play.

## Controls

| Key | Action |
|---|---|
| ◄ ► / A D | walk |
| SPACE / W | jump |
| E | talk · doors · advance dialogue · punch (in a fight) |
| F | punch |
| 1 2 3 (or ▲▼ + E) | dialogue choices |
| I | bag / inventory |
| J | quest log |
| H | help |
| M | sound on/off |

**On phones/tablets** touch controls appear automatically: ◄ ► to walk, **E** to
talk/use, ▲ to jump, plus quest-log and sound buttons in the top-right. Tap the
dialogue box (or the screen) to advance conversations, tap replies to choose them.
The **⛶ button** enters fullscreen and locks landscape orientation.

Progress autosaves to `localStorage` (sleep in your apartment to be safe).

## Chapter 1 content

- **Five districts**: Memorial Park → Residential Block → Market Street → Transit Plaza → Meridian Research Campus
- **Six enterable interiors**: GreenGrid Market (groceries + "gardening equipment"), Kaiten-45 sushi bar (conveyor belt, eat at the counter), the Crooked Bean café, and Tanaka Towers — lobby, stairwell, second-floor hallway with cyberpunk neighbours (Vex the synth musician, D3X behind his intercom, POST-3 the mailbot), and your own Unit 4
- **Survival**: hunger meter that drains over time — eat sushi, toasties, printed bentos; starving slows you down and drains HP. HP regenerates when fed; sleeping fully heals
- **Combat**: a mugger ambushes you back in the park — fist-fight him (E/F to punch, back off when he winds up). His dropped chip funds your apartment. Shock Knuckles (+8 damage) sold at the market
- **Inventory** (I): carry food, use it anywhere
- **Ten story NPCs** + wandering pedestrians, all with branching dialogue
- **Economy**: courier runs (₣60), café shifts (₣50), freelance gigs, ₣300 apartment
- **Six quests**, ending with the apartment and Dr. Okafor's wormhole briefing
- Hand-authored outlined-and-shaded pixel sprites, parallax neon skyline with searchlights, tower beacons, sagging cables, fire escapes, holo-billboards, crosswalks, puddle reflections, drones, hovercars, a robo-dog

## The science (it checks out)

The 2045 worldbuilding follows real published predictions, mostly Ray Kurzweil's:

- AI passes the Turing test in **2029**; the **Singularity in 2045**
- Medical **nanorobots** in the bloodstream; **longevity escape velocity** in the early 2030s
- **Neocortex-to-cloud** interfaces, full-immersion VR
- **Solar-dominated energy** (negative midday prices), **vertical farming**, cultivated meat, 3D-printed clothing and buildings
- **Universal basic income** ("Basic"), autonomous vehicle fleets

The time travel uses real theoretical physics — Kip Thorne's 1988 wormhole time
machine: a **Morris–Thorne traversable wormhole** held open by **exotic matter**
(negative energy density from **Casimir-effect** vacuum engineering). One mouth
stays in the 2026 lab; the other rides a relativistic shuttle so time dilation
desynchronizes the two ends. Hard rule, straight from the literature: such a
machine can never take you earlier than the moment it was created — which is why
2026, the year the throat opened, is exactly as far back as you can go. Hawking's
**chronology protection conjecture** is the standing threat in the lore.

## Art credits

Most art is original to this project. The city is additionally dressed with
open-source pixel art by **Luis Zuno (@ansimuz)** — see `assets/LICENSES.txt`:

- **Warped City** ([OpenGameArt](https://opengameart.org/content/warped-city), CC0):
  sunset skyline, neon megatowers, animated banners/signs (incl. the sushi bar
  banner and HOTEL sign), hover-cars, patrol drone
- **Cyberpunk Street Environment** ([OpenGameArt](https://opengameart.org/content/cyberpunk-street-environment), CC-BY 3.0):
  the warm street-level architecture on Market Street and Transit Plaza

The game still runs fully offline — if the asset files can't load it falls
back to the original procedural art.

## Roadmap

- Chapter 2: *The Exotic Vacuum* — charge the Array, open the door to 2026
- Playable 2026 city; travel freely between both years
- Inventory, more jobs, apartment upgrades, NPC schedules
- (Maybe) swap pixel art for painted/photographic art once the world is proven
