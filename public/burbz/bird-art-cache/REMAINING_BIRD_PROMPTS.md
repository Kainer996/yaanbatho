# Burbz — remaining new-bird art prompts (Higgsfield `z_image`, 1:1)

The 2026-07-06 expansion added **7** new birds with real Higgsfield art
(Square-tailed Kite, Wedge-tailed Eagle, White-tailed Eagle, Common Pheasant,
Herring Gull, Green Woodpecker, Ring-necked Parakeet). The MCP credit balance
(1.18) only covered those 7 at ~0.15 credits each.

**Update 2026-07-07 (crows_perch_expansion):** a full set of **50 new birds**
is now wired into the game DATA — complete `BURBZ_SPECIES_PROFILES` entries
(including the new `personality` stat), `WILD_BIRDS`, `REAL_WORLD_COMMONNESS`
and UK whitelist entries in `public/burbz/index.html`. They render with the
automatic emoji-glyph placeholder until art exists. To give them real art:
top up Higgsfield credits, generate with the SAME prompt template below, save
each result to `public/burbz/bird-art-cache/<snake_name>_burbz_manga_YYYYMMDD.png`,
downscale to 1024×1024, and add ONLY a matching `BUILT_IN_BIRD_ART` entry —
everything else is already wired.

## The 50 wired species awaiting art (crows_perch_expansion_20260707)

Moorhen, Great Crested Grebe, Greylag Goose, Shelduck, Wigeon, Teal,
Tufted Duck, Eider, Whooper Swan, Little Egret, Bittern, Avocet,
Ringed Plover, Golden Plover, Dunlin, Turnstone, Redshank, Woodcock,
Common Crane, Black-headed Gull, Great Black-backed Gull, Kittiwake,
Arctic Tern, Fulmar, Manx Shearwater, Guillemot, Shag, Red Grouse,
Ptarmigan, Black Grouse, Capercaillie, Red-legged Partridge, Goshawk,
Hen Harrier, Marsh Harrier, Hobby, Short-eared Owl, Nightjar, Turtle Dove,
Stock Dove, Hooded Crow, Chough, Nightingale, Fieldfare, Redwing,
Mistle Thrush, Wheatear, Whitethroat, Spotted Flycatcher, Siskin.

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

## Candidate species (region-appropriate, ~44 to reach 50+)

UK/EU: Grey Wagtail-relative Yellow Wagtail, Whitethroat, Garden Warbler,
Spotted Flycatcher, Marsh Tit, Willow Tit, Crested Tit, Corn Bunting, Twite,
Hawfinch, Siskin, Redpoll, Brambling, Fieldfare, Redwing, Waxwing (have),
Woodcock, Snipe (have Common Snipe), Green Sandpiper, Redshank, Greenshank,
Dunlin, Ringed Plover, Golden Plover, Turnstone, Kittiwake, Fulmar, Shag,
Guillemot, Little Egret, Bittern, Water Rail, Marsh Harrier, Hen Harrier,
Hobby, Goshawk, Short-eared Owl, Long-eared Owl, Nightjar, Nightingale,
Whinchat, Wheatear, Ring Ouzel, Crossbill (have), Bearded Tit.

AU: Wedge-tailed Eagle (have), Square-tailed Kite (have), Whistling Kite,
Nankeen Kestrel, Australian Hobby, Powerful Owl, Southern Boobook,
Australian Owlet-nightjar, Rainbow Bee-eater, Sacred Kingfisher,
Azure Kingfisher, White-throated Treecreeper, Eastern Yellow Robin,
Scarlet Robin, Golden Whistler, Grey Shrikethrush, Australian Reed Warbler,
Welcome Swallow (have), Fairy Martin, Zebra Finch, Red-browed Finch,
Diamond Firetail, Yellow-tailed Black Cockatoo, Gang-gang Cockatoo,
Musk Lorikeet, Purple Swamphen relatives.
