# Photo Merlin v494

Yaan watched a raven over Lancashire. Burbz called his photo "Anhinga or Great Blue Heron or Grey Heron". A clear jackdaw failed too. He asked for photo ID that works like Merlin, for every bird.

## Why it failed

Merlin and Burbz do not run the same software. Merlin uses a bird model trained on millions of Macaulay Library photos, and it first asks where and when. Burbz asks Gemini, a general model. Four things made Burbz worse than it had to be:

1. **No place, no date.** Gemini never knew the photo came from Lancashire in September. Anhinga and Great Blue Heron are American birds.
2. **Rushed looking.** v453 cut both Gemini views to "low" thinking to beat a timeout.
3. **One bird, three names.** The two views compared Latin names as plain text. `Corvus monedula` and `Coloeus monedula` are the same jackdaw, but the check saw two birds and refused.
4. **No choice.** An unsure answer showed names in a sentence. The player could not say "that one".

## What changed

**Where and when.** The page sends the rough place (two decimals) and the BirdNET week with the photo. It does so only for a fresh camera shot, or a library photo whose camera capture time (EXIF) is from the last two days, and only while the location switch is on. Phones hand a picked photo over with a fresh file time, so the file time never counts for library photos. The position must be from the last few minutes; a saved home is not "here". The switch now shows on the photo screen too, and it is checked again at upload. `photo_id.py` runs the BirdNET Geomodel V3.0.2 that already serves sound, in the same Flask process. It rounds the place to 0.1° first. Nothing is stored.

**Gemini sees the local list.** The worker (`photo_gemini.py`) sends the picture first, then the question: the place to half a degree, the season ("late September") and up to 300 local species, most likely first. The list comes from a range-model run at that half-degree cell and the season's week, so it reveals no more than the words sent with it. Gemini looks once, with "medium" thinking. It gives field marks, a bird box and up to five ranked species with a plumage.

**The range decides the order.** The adapter maps every name onto the geomodel's labels. The model's English name is the surer half, so "Rainbow Lorikeet, Trichoglossus haematodus" is the Rainbow Lorikeet, not the Coconut Lorikeet that now owns that binomial. Old Latin names, Grey = Gray and genus moves with the same bird word all count as one bird. When the place says the named bird does not live there and a sister species of the same split does, the sister is taken, with its own name: Herring Gull in Maine becomes American Herring Gull, Stonechat in Lancashire European Stonechat, Cattle Egret in Sydney Eastern Cattle-Egret. Sisters come from the shared eBird code and a short list. Each score is the model's probability times a range weight: 1 for a bird expected here (occurrence ≥ 0.05), fading to 0.15 for a bird not expected. The weight only ever lowers a score; what it takes away goes to "something else", never onto the birds that remain. Kept and domestic birds (chicken, budgerigar…) carry no range weight. A bird the model gave 10% or more is always shown.

**The player confirms.** The result shows the photo, then ranked bird cards with art, the Latin name, a match label, "Likely here", "Rare here" or "Not expected here", and the plumage. Each card has **This is my bird**. Nothing enters the Birdex until the player taps it. Each answer's receipt allows one bird, ever: the ledger replays the same answer when the same photo is checked again, so the second time the cards show "You already chose …". A bird outside the Burbz catalogue shows "Not in Burbz yet" and cannot be chosen.

A match counts as strong (HTTP 200, `found`) only when all hold: the score is at least 0.80, it leads by 0.20, the bird box passes the pixel check, there are two field marks, and, where the place is known, it is likely here. Because weights never inflate, a strong score means Gemini itself was at least 80% sure. Everything else is `pick-your-bird` (HTTP 422) with the same cards.

## Decisions

- This replaces the v425 rule "never turn tentative output into a discovery". Merlin's own flow is ranked matches plus "This is my bird", and Yaan asked for Merlin. The player picks only from the receipted matches of this photo. There is still no catalogue picker or manual correction.
- One Gemini call per photo instead of two. The time and money go into looking harder once.
- Google gets the picture, the place to half a degree, the season and the species list. It gets no account, device, exact place or notes.

## Contract

Policy `photo-gemini-v494`, page contract `merlin-v494`. Pages older than v494 get "Close and reopen Burbz to update photo identification" and cost nothing. The place stays out of the photo's ledger digest: a stored reading is what Gemini saw, and the adapter re-weighs it by the place of each request. So the stable proof id never meets `request-conflict` if the range model is up on one deploy and down on the next. The release proof posts robin, crow and an empty scene from London in week 20. The robin must lead its ranking; the crow must be among the matches and never be confirmed as another species; the empty scene names no bird. A fixture that fails gets one fresh attempt per UTC day under a dated owner and id, after the three-per-minute window. The ledger replays stored answers for ever, so without this one service hiccup or one unlucky reading would block every later deploy.

## Evidence and limits

- Python photo tests pass, including runs against the real Geomodel: a raven the model gave only 25% ranks first at Clitheroe, week 36, ahead of Anhinga and Great Blue Heron; "Western Jackdaw, Corvus monedula" is found as the jackdaw; and the reading Yaan actually got (Anhinga, Great Blue Heron, Grey Heron) now ends as an honest "Grey Heron, 15%, possible" rather than a strong wrong answer. Reviewer probes pass in Sydney, Hanoi, Cairns, Ho Chi Minh City, Madrid, Miami and Seattle.
- 17 client photo tests and 4 release tests pass.
- Gemini itself was not called from this workspace: there is no key here. Real accuracy is measured on the server by the release proof and by Yaan's phone. This is not an accuracy guarantee.
- The ledger's price review ends on 16 October 2026 (`meta.pricing_expires`). After that, photo ID pauses until someone extends it on the server.
