"""The Empire screen shows the map and the realm; the reference bits wait.

Yaan's ask, from a screenshot with the fluff circled in yellow: the locator
chips, the Royal Ledger block, the "How your empire works" scroll and the
village governance lecture all sat between the tabs and the content he
actually uses. The ledger becomes a tiny 👑 button beside the screen title
with a stylish drop-down; the locator and the guide fold into two quiet
pop-downs at the very bottom; the village subtitle shrinks to one line.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def panel_block() -> str:
    # empire-grid-v320-20260825 lifted the tax chest to the top of the panel,
    # so the assignment no longer opens on the tier markup.
    start = HTML.index("  panel.innerHTML =\n")
    return HTML[start:HTML.index("panel.querySelectorAll", start)]


def test_the_ledger_lives_in_a_tiny_button_beside_the_title():
    # The pill and its pop-down sit in the screen scaffold, next to the title.
    scaffold = HTML[HTML.index('<div class="empire-title-row">'):HTML.index('id="empireMapCard"')]
    assert 'class="screen-title">YOUR EMPIRE' in scaffold
    assert 'id="empireLedgerBtn"' in scaffold and '👑 LEDGER' in scaffold
    assert 'id="empireLedgerPop"' in scaffold and 'hidden' in scaffold
    # The render fills the pop-down with the title and the five stat chips.
    fill = HTML[HTML.index("const ledgerPop = $('empireLedgerPop')"):]
    fill = fill[:fill.index("const footerHtml")]
    for marker in ("YOUR TITLE", "empireCrownTitle()", "Holdings", "Subjects", "Taxes / 8h", "Timber / 8h", "Stone / 8h"):
        assert marker in fill, marker
    # The button toggles it, with the open state mirrored for styling and a11y.
    wiring = HTML[HTML.index("const ledgerBtn = $('empireLedgerBtn')"):]
    wiring = wiring[:wiring.index("};") + 2]
    assert "pop.hidden = !opening" in wiring
    assert "aria-expanded" in wiring


def test_the_screen_ends_at_the_tax_chest():
    """empire-declutter-v317: FIND YOURSELF and HOW YOUR EMPIRE WORKS are gone.

    v300 folded them into two quiet pop-downs at the very bottom. Yaan's ask
    (2026-08-24) was to take them off the screen entirely, so the Empire panel
    now ends at the tax chest and the footer is an empty string.
    """
    block = panel_block()
    assert "const footerHtml = '';" in HTML
    # empire-grid-v320-20260825 lifted the chest ABOVE the boxes at Yaan's ask,
    # so the chest now opens the panel — but nothing still follows the footer.
    assert block.index("empire-tribute-btn") < block.index("footerHtml")
    assert block.index("empire-tribute-btn") < block.index("tiersHtml")
    # Nothing builds either drawer any more. (The words survive only in the
    # comment that records why they went, so this checks the code, not prose.)
    for gone in ("'FIND YOURSELF'", "'HOW YOUR EMPIRE WORKS'", "locatorChipsHtml",
                 'data-action="locator-me"', "empire-help-row", 'name="empire-footer"'):
        assert gone not in HTML, gone
    # And the panel still does not carry the inline ledger block v300 moved out.
    assert "ROYAL LEDGER" not in block
    assert "empire-stats-row" not in block


def test_the_footer_and_ledger_styles_exist():
    for selector in (".empire-title-row", ".empire-ledger-btn", ".empire-ledger-pop"):
        assert selector + " {" in HTML or selector + "[open]" in HTML, selector
    # v317 removed the footer, so its rules must not linger as dead CSS.
    for gone in (".empire-footer", ".empire-drawer.is-footer", ".empire-locator"):
        assert gone not in HTML, gone
