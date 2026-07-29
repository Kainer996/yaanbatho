"""Recognised birds that exist in the client catalogue must unlock.

Regression guard for the bug where BirdNET recognised a catalogued bird
(e.g. a Mallard) but the app flashed "not in the Burbz catalogue yet" and
refused to unlock it, because the frontend blindly trusted the backend's
`catalogMatched` flag. The backend's species index can drift out of sync
with the client catalogue (BURBZ_SPECIES_PROFILES), which is the real source
of truth for what is playable. The client now verifies catalogue membership
itself and unlocks any recognised bird it holds a profile for.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def test_client_verifies_catalogue_membership_itself():
    # The client-side check covers common, canonical and scientific names.
    assert "const birdInCatalogue = bird =>" in HTML
    assert "findSpeciesProfile(bird.species)" in HTML
    assert "findSpeciesProfile(bird.commonName)" in HTML
    assert "findSpeciesProfile(bird.scientificName)" in HTML
    assert "const inGameCatalogue = birdInCatalogue(top);" in HTML


def test_catalog_match_decision_uses_client_catalogue_not_only_backend_flag():
    # The unlock gate must OR the client-catalogue check with the backend flag,
    # so a stale backend `catalogMatched:false` can no longer block a bird the
    # client can play.
    assert "opts.catalogMatched === false && !inGameCatalogue" in HTML


def test_unmatched_notification_still_reachable_for_genuinely_uncatalogued_birds():
    # Birds with no client profile at all must still take the "not yet in the
    # catalogue" path — the fix does not remove that behaviour.
    assert "showCatalogUnmatchedRecognition(top)" in HTML
    assert "is not in the Burbz catalogue yet." in HTML


def test_mallard_is_present_in_the_client_catalogue():
    # The species from the bug report must be catalogued so that, once
    # recognised, it unlocks under the fixed logic.
    assert re.search(r'id:\s*"mallard",\s*name:\s*"Mallard"', HTML)
