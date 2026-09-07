# Bird natural history for v366

Reviewed 7 September 2026. `data/bird-facts-v366.json` contains 20 species profiles, written as original, short paraphrases of the official RSPB species pages, BTO profiles/reports and Cornell Lab of Ornithology pages linked in each record. All source URLs were opened and the relevant text read during this review. No photographs, audio, source datasets or article text are redistributed.

The content is educational natural history. It does not change generated diet records, game attributes, balance, saved companions, conservation categories or population estimates. A dietary example is not an exhaustive diet or a feeding instruction. Breeding numbers are qualified as typical or possible, rather than guarantees for an individual bird. Range descriptions are broad UK context, not local occurrence predictions.

The shape is `{species: [...], reviewed: "2026-09-07"}`. Each record includes `name`, `scientificName`, supported prose fields and a `sources` array of `{label, url}`. Match by scientific name or the existing canonical species resolver: `Peregrine` is `Falco peregrinus`, and `Herring Gull` is `Larus argentatus`. Character names are not species names. Render source links alongside the natural-history text. Hide absent sections; missing fields are deliberate and must not be filled with generic prose or inferred claims.

## Coverage

Word counts include only the eight possible prose fields. Each profile remains at or below 180 words, and below the 200-word summarisation allowance of any individual cited page. No direct quotations are used. The review focused on these priority species; this file does not claim to cover the complete catalogue.

| Species | Words | Omitted fields | Source coverage |
| --- | ---: | --- | --- |
| Tawny Owl | 152 | None | RSPB: appearance, habitat, UK range, residency. BTO owl profile: prey, calls, territorial season, cavity nesting and staggered hatching. |
| Goldcrest | 159 | None | RSPB supports the original fields; BTO BirdFacts adds the song description. |
| Carrion Crow | 137 | voice | RSPB species page supports all included fields. |
| Herring Gull | 149 | voice | RSPB species page supports all included fields. |
| Peregrine | 143 | voice | RSPB species page supports all included fields. |
| Merlin | 143 | voice | RSPB: appearance, movements, hunting and relative size. BTO: upland/saltmarsh habitat and typical breeding biology. |
| Rook | 144 | None | RSPB species page supports all included fields. |
| Robin | 150 | None | RSPB species page supports all included fields. |
| Blackbird | 168 | None | RSPB supports the original fields; BTO Research Report 195, pp. 42–43, adds diet. |
| Blue Tit | 147 | None | RSPB species page supports all included fields. |
| Great Tit | 148 | None | RSPB: appearance, feeding competition and winter flocks. BTO: breast stripe, UK/Ireland range, summer diet, vocal variety and nest boxes. |
| Wren | 149 | None | RSPB species page supports all included fields. |
| Magpie | 147 | None | RSPB: colour, feeding strategies and non-breeding flocks. BTO: range, habitat, calls, tail proportion and typical breeding biology. |
| Woodpigeon | 165 | None | RSPB: appearance, habitat, residency, behaviour, voice and migration uncertainty. BTO BirdFacts: eye colour and nesting season/clutch. BTO species focus: diet and crop milk. |
| Chaffinch | 153 | None | RSPB: identification, ground feeding and camouflage. BTO: male colours, habitat, winter visitors, seeds, song and clutch. |
| Starling | 175 | None | RSPB supports the original fields; BTO Research Report 195, pp. 43–44, adds diet and the BTO nesting guide adds breeding sites. |
| Kingfisher | 133 | voice, breeding | RSPB species page supports all included fields. |
| Kestrel | 149 | voice | RSPB supports the original fields; BTO BirdFacts adds breeding. |
| Barn Owl | 168 | None | RSPB: appearance, habitat, hunting time and flight. BTO BirdFacts: residency/range, prey dependence and dispersal. BTO owl profile: calls and nesting. |
| Mallard | 169 | None | RSPB: identification, freshwater occurrence, family behaviour and breeding. BTO: shallow/brackish habitats, residency and ringing-based origins. Cornell: diet and calls. |

## Validation and integration

Checked JSON parsing, the exact 20-species priority set, unique common/scientific names, allowed fields, nonempty plain-text values, 120–180 prose words per profile, and distinct HTTPS source links restricted to the official RSPB, BTO and Cornell All About Birds domains. All checks passed. The prose was also compared against the opened source text; fields without textual support were omitted rather than inferred from an embedded audio recording or a distribution-map image.

This additive delivery does not load the file into the game. The coordinating release owns the field-guide renderer, source-link display, service-worker registration, updater list and build/cache stamp. Register this JSON with the same offline/update guarantees as the other runtime data. No index, service worker, generated biology files or deployment scripts are changed by this dataset commit.

## Completeness follow-up

All 20 records now have a supported Diet field. Added diet for Blackbird, Woodpigeon, Starling and Mallard; nesting for Starling and Kestrel; and voice for Goldcrest, Barn Owl and Mallard. Barn Owl nesting now names its supported nest sites. The Tawny Owl link uses the verified current BTO project URL. There are 37 source links across the records, with 133–175 prose words per species.

The four requested diet gaps were checked against BTO species pages first. BTO's species-focus article and Research Report 195 supplied the first three diets. The accessible BTO/RSPB Mallard profiles did not provide a complete dietary description, so the directly read Cornell species account supplies broad food types and its companion sounds page supplies call descriptions. No North American distribution, regional food proportions or conservation claims were transferred into the UK profile. Research Report 195 appears in two records but is one source: its combined paraphrased contribution remains below 200 words. Link fragments open the relevant PDF pages, rather than implying separate source budgets.
