"""Regression: a companion nickname is additive and never replaces its species name."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def source() -> str:
    return HTML.read_text(encoding="utf-8")


def test_owned_birdex_card_keeps_species_as_primary_name_and_adds_nickname_line():
    html = source()
    assert "function birdNickname(bird)" in html
    assert '<div class="card-name">${escapeHtml(birdSpeciesLabel(bird))}</div>' in html
    assert '<div class="card-nickname">${escapeHtml(birdNickname(bird))}</div>' in html


def test_identity_rows_cannot_be_squashed_out_of_mobile_cards():
    html = source()
    assert ".card-name,\n.card-nickname,\n.card-species { flex:0 0 auto; }" in html


def test_capture_card_keeps_species_name_while_naming_updates_only_nickname_line():
    html = source()
    capture = html[html.index("function showCaptureOverlay(bird)"):html.index("$('captureDismiss').addEventListener", html.index("function showCaptureOverlay(bird)"))]
    assert '<div class="card-name">${escapeHtml(birdSpeciesLabel(bird))}</div>' in capture
    assert '<div class="card-nickname">${escapeHtml(birdNickname(bird))}</div>' in capture
    assert "querySelector('.card-nickname')" in capture
    assert "cardName.textContent = birdDisplayName(bird)" not in capture


def test_nickname_is_stored_separately_without_mutating_species_identity():
    html = source()
    rename = html[html.index("function renameCompanionBird(birdId)"):html.index("function renderInventory()", html.index("function renameCompanionBird(birdId)"))]
    assert "bird.customName = clean || null;" in rename
    assert "bird.commonName = clean" not in rename
    assert "bird.species = clean" not in rename


def test_nickname_release_is_query_busted_for_existing_installs():
    marker = "nickname-line-v167-20260729"
    assert marker in source()
    assert marker in SW.read_text(encoding="utf-8")
