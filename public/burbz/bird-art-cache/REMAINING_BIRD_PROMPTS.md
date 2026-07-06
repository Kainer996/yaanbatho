# Burbz — remaining new-bird ART prompts (Higgsfield `z_image`, 1:1)

## Status (2026-07-06, fifty_set_completion pass)

The "50 new birds" set is now FULLY WIRED into the game data. The
2026-07-06 expansions added:

- **7 birds with real Higgsfield manga art** (Square-tailed Kite,
  Wedge-tailed Eagle, White-tailed Eagle, Common Pheasant, Herring Gull,
  Green Woodpecker, Ring-necked Parakeet).
- **44 birds with full profiles but NO art yet** (26 UK + 18 AU, listed
  below). Each has realistic rebalanced stats, diet rules, habitat pools,
  commonness and regional whitelist entries in `public/burbz/index.html`
  (marker comment: `fifty_set_completion_20260706`). They spawn and render
  with the game's graceful emoji fallback until art exists.

The Higgsfield MCP credit balance (0.13 remaining; ~0.15/image, so ~6.6
credits for all 44) is the only thing blocking the art. Once topped up:

1. Generate each species below with the prompt template (SAME style).
2. Save to `public/burbz/bird-art-cache/<snake_name>_burbz_manga_YYYYMMDD.png`,
   downscaled to 1024×1024 (~1.6 MB) to match the existing art footprint.
3. Add matching entries (name + aliases) to `BUILT_IN_BIRD_ART` in
   `public/burbz/index.html` — that is the ONLY remaining wiring step;
   everything else is already done.

## Prompt template

> Dark fantasy manga trading-card illustration. A **<SPECIES + field marks>**,
> perched on **<natural perch>**. It wears a tiny tooled-leather adventurer
> strap with carved leaf/wave motifs across its chest. Setting: **<habitat>** at
> twilight, huge ancient trees framing the scene, glowing golden runic symbols
> carved into the bark, teal-blue mist between distant trunks, small glowing
> motes drifting. Style: bold clean dark ink outlines, rich painted cel-shading,
> warm golden rim light on feathers, high detail, storybook fantasy anime
> aesthetic. The bird is a real bird with wings and talons only — no human arms,
> no hands, no weapons, no text, no letters, no watermark.

## Species awaiting art (44 — all already wired in-game)

UK (26): Yellow Wagtail, Whitethroat, Garden Warbler, Spotted Flycatcher,
Marsh Tit, Crested Tit, Hawfinch, Siskin, Brambling, Fieldfare, Redwing,
Woodcock, Redshank, Ringed Plover, Turnstone, Kittiwake, Fulmar, Guillemot,
Little Egret, Bittern, Marsh Harrier, Hobby, Goshawk, Short-eared Owl,
Nightingale, Wheatear.

AU (18): Whistling Kite, Nankeen Kestrel, Australian Hobby, Powerful Owl,
Southern Boobook, Rainbow Bee-eater, Sacred Kingfisher, Azure Kingfisher,
White-throated Treecreeper, Eastern Yellow Robin, Scarlet Robin,
Golden Whistler, Grey Shrikethrush, Zebra Finch, Red-browed Finch,
Yellow-tailed Black Cockatoo, Gang-gang Cockatoo, Musk Lorikeet.

## Spare candidates (not wired; use only if swapping a species)

UK/EU: Willow Tit, Corn Bunting, Twite, Redpoll, Green Sandpiper,
Greenshank, Dunlin, Golden Plover, Shag, Water Rail, Hen Harrier,
Long-eared Owl, Nightjar, Whinchat, Ring Ouzel, Bearded Tit.

AU: Australian Owlet-nightjar, Fairy Martin, Australian Reed Warbler,
Diamond Firetail.
