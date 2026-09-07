# Bird natural history for v366

Reviewed 7 September 2026. `data/bird-facts-v366.json` contains 20 species profiles, written as original, short paraphrases of the official RSPB species pages and BTO BirdFacts or owl profiles linked in each record. All source URLs were opened and the relevant text read during this review. No photographs, audio, source datasets or article text are redistributed.

The content is educational natural history. It does not change generated diet records, game attributes, balance, saved companions, conservation categories or population estimates. A dietary example is not an exhaustive diet or a feeding instruction. Breeding numbers are qualified as typical or possible, rather than guarantees for an individual bird. Range descriptions are broad UK context, not local occurrence predictions.

The shape is `{species: [...], reviewed: "2026-09-07"}`. Each record includes `name`, `scientificName`, supported prose fields and a `sources` array of `{label, url}`. Match by scientific name or the existing canonical species resolver: `Peregrine` is `Falco peregrinus`, and `Herring Gull` is `Larus argentatus`. Character names are not species names. Render source links alongside the natural-history text. Hide absent sections; missing fields are deliberate and must not be filled with generic prose or inferred claims.

## Coverage

Word counts include only the eight possible prose fields. Each profile remains below 180 words, and below the 200-word summarisation allowance of any individual cited page. No direct quotations are used. The review focused on these priority species; this file does not claim to cover the complete catalogue.

| Species | Words | Omitted fields | Source coverage |
| --- | ---: | --- | --- |
| Tawny Owl | 152 | None | RSPB: appearance, habitat, UK range, residency. BTO owl profile: prey, calls, territorial season, cavity nesting and staggered hatching. |
| Goldcrest | 143 | voice | RSPB species page supports all included fields. |
| Carrion Crow | 137 | voice | RSPB species page supports all included fields. |
| Herring Gull | 149 | voice | RSPB species page supports all included fields. |
| Peregrine | 143 | voice | RSPB species page supports all included fields. |
| Merlin | 143 | voice | RSPB: appearance, movements, hunting and relative size. BTO: upland/saltmarsh habitat and typical breeding biology. |
| Rook | 144 | None | RSPB species page supports all included fields. |
| Robin | 150 | None | RSPB species page supports all included fields. |
| Blackbird | 148 | diet | RSPB species page supports all included fields. |
| Blue Tit | 147 | None | RSPB species page supports all included fields. |
| Great Tit | 148 | None | RSPB: appearance, feeding competition and winter flocks. BTO: breast stripe, UK/Ireland range, summer diet, vocal variety and nest boxes. |
| Wren | 149 | None | RSPB species page supports all included fields. |
| Magpie | 147 | None | RSPB: colour, feeding strategies and non-breeding flocks. BTO: range, habitat, calls, tail proportion and typical breeding biology. |
| Woodpigeon | 144 | diet | RSPB: appearance, habitat, residency, behaviour, voice and migration uncertainty. BTO: eye colour and flexible nesting season/clutch. |
| Chaffinch | 153 | None | RSPB: identification, ground feeding and camouflage. BTO: male colours, habitat, winter visitors, seeds, song and clutch. |
| Starling | 137 | diet, breeding | RSPB species page supports all included fields. |
| Kingfisher | 133 | voice, breeding | RSPB species page supports all included fields. |
| Kestrel | 134 | voice, breeding | RSPB species page supports all included fields. |
| Barn Owl | 149 | voice | RSPB: appearance, habitat, hunting time and flight. BTO: residency/range, prey dependence, breeding success and juvenile dispersal. |
| Mallard | 137 | diet, voice | RSPB: identification, freshwater occurrence, family behaviour and breeding. BTO: shallow/brackish habitats, residency and ringing-based origins. |

## Validation and integration

Checked JSON parsing, the exact 20-species priority set, unique common/scientific names, allowed fields, nonempty plain-text values, 120–180 prose words per profile, and distinct HTTPS source links restricted to the official RSPB/BTO domains. All checks passed. The prose was also compared against the opened source text; fields without textual support were omitted rather than inferred from an embedded audio recording or a distribution-map image.

This additive delivery does not load the file into the game. The coordinating release owns the field-guide renderer, source-link display, service-worker registration, updater list and build/cache stamp. Register this JSON with the same offline/update guarantees as the other runtime data. No index, service worker, generated biology files or deployment scripts are changed by this dataset commit.
