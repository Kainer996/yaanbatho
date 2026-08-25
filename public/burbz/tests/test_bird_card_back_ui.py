from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def _card_template() -> str:
    start = HTML.index("function createBirdCardHTML")
    end = HTML.index("function createKnownSpeciesCardHTML", start)
    return HTML[start:end]


def test_card_back_starts_at_the_top_and_never_centres_overflow_offscreen():
    assert ".card-back { transform:rotateY(180deg); padding:9px; display:flex; flex-direction:column; justify-content:flex-start; gap:7px; overflow:hidden; }" in HTML
    assert ".card-back { justify-content:flex-start; gap:6px; overflow:auto; }" not in HTML


def test_card_back_has_a_crisp_header_and_compact_stat_grid():
    card = _card_template()
    assert 'class="card-back-head"' in card
    assert 'class="card-back-meta"' in card
    assert card.count('class="card-back-stat"') == 8
    assert ".card-back-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr));" in HTML
    assert ".card-back-stat { display:grid; grid-template-columns:1fr auto;" in HTML


def test_card_back_separates_rooms_from_primary_actions():
    card = _card_template()
    assert 'class="card-back-section-label">Academy placement<' in card
    assert 'class="card-back-rooms"' in card
    assert 'class="card-back-utilities"' in card
    assert ".card-back-rooms { display:grid; grid-template-columns:repeat(3,minmax(0,1fr));" in HTML
    assert ".card-back-utilities { display:grid; grid-template-columns:repeat(3,minmax(0,1fr));" in HTML


def test_academy_room_chips_use_compact_text_with_full_accessible_labels():
    start = HTML.index("function academyRoomButtonsHTML")
    end = HTML.index("// ---- Diet-aware feeding", start)
    fn = HTML[start:end]
    # free-birds-v318 added the "set free" case: standing a bird down is not
    # sending it to a room, so it gets its own compact word.
    assert "const shortLabel = current ? cfg.icon + (free ? ' Free' : ' Here') : free ? cfg.icon + ' Free' : built ? cfg.icon + ' Send' : '🔒 ' + cfg.icon;" in fn
    assert "const free = room === FREE_BIRD_ROOM;" in fn
    assert "aria-label=\"' + escapeHtml(label) + '\"" in fn


def test_card_back_keeps_rename_and_field_guide_but_removes_pet_choice():
    card = _card_template()
    assert "Your Pet" not in card
    assert "Choose as Pet" not in card
    assert "Make Pet" not in card
    assert "Rename" in card
    assert "Field Guide" in card


def test_card_back_release_uses_a_versioned_pwa_cache():
    assert "const BURBZ_CACHE = 'burbz-" in SW
