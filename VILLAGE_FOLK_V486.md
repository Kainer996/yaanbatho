# Village folk v486

Build: `village-folk-v486-20260925`.
Status: merged to main and live on yaanbatho.com from 25 September 2026.

## What Yaan asked for

"In Burbz, the human NPC characters look really silly. Can you make them look much much better please, and also make the animals that roam the villages look really AAA too."

## What changed

### Villagers

- Every villager is a storybook person about four and a half heads tall, with a neck, shoulders, a waist, elbows, knees, mitten hands and boots. Before, everyone was the same cone-hooded blob with floating arms.
- Faces hold up at first-person range: glossy eyes with a catch-light, brows, a button nose, a small smile and soft blush. Elders get bushy brows.
- Looks come from a hash of the person's id, so the baker you met yesterday is the baker today. There are 8 skin tones, 10 hair colours, 10 hairstyles, 5 beard types, many heights and builds, and natural medieval dyes: madder, woad, weld, moss, russet, teal, plum and indigo.
- Clothes are layered: tunics over a linen hem, laced kirtles, aprons, capelets, sashes, belts with buckles and pouches.
- Every role and trade reads at phone distance by hat, clothes and tool:
  - Guard: kettle hat, gambeson, tabard, spear and shield.
  - Fisher: wide hat, rod and line, creel.
  - Bard: feathered beret and lute.
  - Elder: stoop and staff.
  - Child: bigger head and a pinwheel.
  - Vendor: kerchief, apron and fruit basket.
  - Builder: hammer and plank.
  - Farmer: straw hat and pitchfork.
  - Woodcutter: checked shirt, knit cap and axe.
  - Miner: leather cap with candle and pick.
  - Tavern keeper: apron and tankard.
  - Water carrier: two buckets.
  - Hunter: hood, bow and quiver.
  - Friar: robe, rope belt, tonsure and book.
  - Merchant: fur-trimmed coat, chaperon, cane and purse.
  - Smith: leather apron and hammer.
  - Porter: a sack on the shoulder.
  - Performer: jester cap and juggling balls.
  - Clerk: spectacles, quill and scroll.
- The walk has knees that fold, heels that strike, feet that roll off the toe, a bobbing pelvis and swinging arms. Steps follow the ground actually covered, so feet never skate, and children take more steps than adults.
- Standing folk breathe, shift their weight and look about. Roles have their own idles: the guard stands to attention, the bard strums, the child fidgets, the vendor beckons, the smith and builder hammer. Carters lean in and push their handcarts. Unhappy and tired villagers droop.
- With reduced motion on, everyone stands perfectly still in a natural pose.

### Animals

- New module `village_animals.js`. Every animal is one skinned mesh with real anatomy: snouts, ears, eyes that blink, hooves, paws, manes, fleeces, feathers and tails.
- The seed picks the breed, and each breed has its own name for tap text:
  - Dogs: sheepdogs (sable, black-and-white, tricolour, blue merle), hounds and lurchers.
  - Cats: brown, grey and silver tabbies, a ginger tom, a calico, a tuxedo and a sleek black cat.
  - Hens: white, russet, black, speckled, Light Sussex and buff Orpington.
  - Roosters: red, golden, white with a black-laced cape, and black with a copper cape.
  - Sheep: white-faced and black-faced Suffolk ewes, Jacob, black Welsh Mountain, brown Shetland and a cream sheep with a toffee face.
  - Cattle: Friesian, Hereford, Jersey and a shaggy Highland.
  - Goats: Saanen, Toggenburg, Alpine, black-and-tan and pied.
  - Pigs: pink, Gloucester Old Spot, Saddleback, Berkshire and Tamworth.
  - Horses: bay, chestnut with a flaxen mane, liver chestnut, black, dappled grey and a dun cob with a dorsal stripe.
  - Ducks: mallards, a white farmyard duck and a Cayuga.
- Real gaits. Four-legged animals walk with a four-beat step. Their legs swing fore and aft, knees and hocks fold, and hooves plant.
- Pen animals now live real lives:
  - They amble between grazing spots and turn before they set off, stepping as they turn.
  - They stay inside their rails and keep out of each other's way.
  - They put their muzzles right down to the grass, chew the cud and rest a hind leg.
- Hens strut, freeze, glance about with jerky chicken turns and peck right down at the cobbles.
- Dogs trot with level paws and pant when they stop. The cat keeps its perch with a swishing tail.

### Village life fixes

- Farm animals no longer walk sideways, and their legs no longer swing on the wrong axis.
- Handcarts keep their pusher. Before, the retire filter took the carter away.
- Wheels roll the right way, by the distance travelled.
- The cart horse walks between raised shafts.
- The builder's floating hammer is gone. The builder now hammers with their own.
- Residents no longer march in lockstep or snap round their turns.
- The jetty fisher faces the water.

## Phone performance

Measured in software WebGL at 390×844, main at v485 against this build, same villages and views. This is a relative proxy, not phone FPS.

| Scene | Main draw calls | New draw calls | Main frame (p50) | New frame (p50) |
| --- | --- | --- | --- | --- |
| Village, lighting runner | 660 | 560 | 16 ms | 18 ms |
| Town, lighting runner | 231 | 138 | 25 ms | 8 ms |
| Dense town, lighting runner | 261 | 160 | 25 ms | 21 ms |
| Village overview (16 m) | 338 | 270–273 | — | — |
| Village street (6 m) | 166–173 | 154–159 | — | — |

- Each villager and animal is now one draw call. Before, a villager was six meshes.
- Triangles rise because the folk have real shapes: about 48k to 61–63k in the village overview, 41k to 48k in the street view. Frame times stay within the noise of software rendering.
- Budgets, worst case over many seeds: a villager 2,421 of 2,600 triangles. Animals: dog 1,394, cat 1,350, hen 1,156, rooster 1,370, duck 936 (all of 1,400). Sheep 1,778, goat 1,800 and pig 1,792 (of 1,800). Cattle 2,592 and horse 2,592 (of 2,600).
- Building a villager takes about 1.2 ms in node, and an animal 0.5–2 ms. Opening the village took 1.1–1.5 s on main and 1.2–1.7 s here, within the run-to-run noise.
- Animating a villager costs about 2 µs and an animal 2–4 µs. Neither creates objects per frame.
- Phones that cannot skin on the GPU (no float vertex textures) get jointed rigid pieces instead, so nothing breaks there.

## Verification

- Merged with main at v485 and renumbered to v486. Main took v472 to v485 while this was in flight. Only the release markers clashed. `BURBZ_CACHE` keeps main's generations and adds this one last. Main's own release tests (v472, v481, v482, v483 and v485) now count v486 among the builds that may follow them.
- Node suite: 136 pass, 33 fail. The 33 match main exactly. The new `tests/test_village_folk_v486.cjs` passes 7 tests: the rig and its skinned mesh, the rigid fallback, pen animals walking head first inside their rails, grazing muzzles and leg axes, hens pecking at any frame rate, the game wiring, and the release pins.
- `tests/test_peeps_20260905.cjs` passes unchanged: stable looks, opposing limbs, and a still pose under reduced motion.
- Python suite: 312 failed, 1711 passed, 17 errors, identical to main.
- `tests/run_village_folk_v486.cjs` passes 13 checks in a real phone browser: GPU skinning, one skinned mesh per villager and animal, named animals, rigged pens, hens, carts with their horse or pusher, 30 seconds of pen life (wandering, head first, inside the rails, muzzles on the grass), hens pecking, and no script errors.
- The browser runners `run_humanoid_residents_v350`, `run_settlement_life_v348` and `run_settlement_lighting_v350` give the same results on main and on this build. Their existing failures are pre-existing.
- The models were chosen from three villager and two animal designs by two independent judges each, then polished, reviewed adversarially from renders, and fixed.

## Release integrity

- New module: `village_animals.js`. Changed module: `settlement_models.js`.
- Both load from `index.html` with `?v=village-folk-v486-20260925` and appear once in each of the three worker lists. The updater lists `village_animals.js`.
- `BURBZ_CACHE` ends with the new marker, and `BURBZ_BUILD` names it.
- `index.html` changes: the villager, carter, builder, livestock, pen, dog, cat, chicken and traffic code. Every maker keeps its random draw count, so village layouts stay put.
- `tests/test_tavern_hall_pins.cjs` no longer pins `settlement_models.js`. `tests/test_village_folk_v486.cjs` pins it now.

## Limits

- Software WebGL is not a phone. Please feel it on a real phone.
- Inside buildings, `interior_life.js` still drives the walk from the clock, not the distance. Villagers there step a little faster than they move.
- The big bodies (horse and cattle) are at their triangle budget, so some cel facets still show on shoulders and haunches.
- Spots and patches are painted per vertex, so their edges are soft.
- The village pond code that would place ducks is not wired into any scene, so ducks are ready but do not appear yet.
