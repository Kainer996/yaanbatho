# Broad bird information coverage, 7 September 2026

`data/bird-education-enrichment-v366.json` adds 141 imported encyclopedia
accounts under existing game common-name keys. Merge after the four older
education datasets and before the 20 verified primary-guide profiles. These
rows must **not** be passed through the `verifiedPrimary` loader.

The pre-remediation game catalogue has 1,515 WILD names, resolving to 1,514
canonical profile names, plus profile-only Blackcap. These are catalogue
counts, not an independently deduplicated taxonomy. The additive object covers
all 56 original unmatched entries, Fork-tailed Swift which lost all visible
facts after boilerplate filtering, 70 summaries containing game prose, and
legacy imports that pointed to a group, split page or disambiguation. Reasons
are retained per row; some categories overlap. The dataset does not change
gameplay names, saves, encounter rules, aliases or biological identities.

## Sources and limits

Accounts were retrieved from the English Wikipedia MediaWiki API on
7 September 2026, using catalogue binomials and API redirects. Cabot's Tern
used its exact common-name article because the legacy binomial spelling
`acuflavida` did not resolve. All responses were checked for missing pages,
disambiguation and empty extracts. Each row records the exact article title,
page ID, revision ID, revision timestamp, retrieval time, permanent revision
link and source link. These are imported secondary accounts, not 141 newly
reviewed primary-authority profiles. Their factual depth and freshness vary.

Long accounts contain complete selected paragraphs and source section headings,
ordered for field-guide reading, up to 5,500 characters each. Original full API
responses are retained in task research files, outside shipped assets. The
shipped object is approximately 927 kB before compression. Summary and longer
account should both be available; attribution and source links must remain
visible. Show the longer account collapsed initially.

## Source-subject boundaries

Immediately visible taxonomy notes explain Feral Pigeon as a domestic-derived
form, Lesser and Arctic Redpoll as traditional forms within the current
combined Redpoll treatment, Stejneger's Stonechat within the imported Siberian
Stonechat account, and the modern narrower accounts for Island Thrush,
Purple Swamphen, Eclectus Parrot and Northern Goshawk. In particular,
`Turdus poliocephalus` now refers to the extinct Tasman Sea Island Thrush;
that account must not imply that a living bird can be found today.

The [BTO Redpoll account](https://www.bto.org/learn/about-birds/birdfacts/redpoll)
independently confirms the combined Redpoll treatment. The
[BTO British List](https://www.bto.org/learn/about-birds/british-list) is linked
for its separate Stejneger's Stonechat treatment; the imported account itself
describes its broader treatment. Source differences are disclosed, not turned
into changes to the game catalogue.

Education-only spelling/genus updates are explicit for Cabot's Tern,
White-winged Chough and Musk Lorikeet. The old requested scientific identity
is retained in `requestedScientificName` for provenance, not used to create
global gameplay aliases.

## Attribution and licence

Wikipedia contributors retain authorship of the imported extracts. The
extracts and adaptations in this JSON are distributed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The adaptations select complete paragraphs, adjust section order, remove empty
pronunciation marks and prepend explicit taxonomy notes where indicated.
Every row links the source and exact revision; these preserve access to
article history and contributor attribution. No images or other media were
copied. See
[Wikipedia reuse guidance](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content).

The small BTO taxonomy notes are original concise paraphrases, with direct
source links; no BTO source text was copied verbatim.

## Validation and reproduction

`tests/test_bird_education_enrichment_20260907.py` checks the independent frozen
missing-name fixture, primary-profile separation, paragraph size, attribution,
taxonomic scope and replacement of known wrong-subject pages. The full
catalogue audit executes the integrated loader, lookup and actual HTML
renderer; integration ownership and cache registration remain with the
release task.

To regenerate from retrieved MediaWiki records, run
`scripts/build_bird_education_enrichment_20260907.py --records RECORDS_JSON
--output OUTPUT_JSON`. It makes no network calls. The records retain full
source extracts so paragraph selection is deterministic and reviewable.
