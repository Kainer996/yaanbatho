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
    start = HTML.index("panel.innerHTML = navTabsHtml")
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


def test_locator_and_guide_are_quiet_popdowns_at_the_very_bottom():
    block = panel_block()
    # Footer last, after the tax chest; both drawers share one accordion name.
    assert block.index("empire-tribute-btn") < block.index("footerHtml")
    footer = HTML[HTML.index("const footerHtml"):]
    footer = footer[:footer.index("panel.innerHTML")]
    assert "'locator', false, '📍', 'FIND YOURSELF'" in footer
    assert footer.count('name="empire-footer"') == 2
    assert "helpHtml" in footer
    # The chips themselves survive inside the drawer, taps intact.
    assert 'data-action="locator-me"' in HTML
    assert 'class="empire-drawer is-footer"' in footer
    # And the panel no longer carries the inline ledger block.
    assert "ROYAL LEDGER" not in block
    assert "empire-stats-row" not in block


def test_the_village_subtitle_is_one_line_not_a_lecture():
    assert "Govern it below" not in HTML
    assert "sub.textContent = 'Tap a building to step inside.'" in HTML
    # The unliberated and in-ruins teachings survive untouched.
    assert "The darkness left " in HTML
    assert "Your village, still in ruins. " in HTML


def test_the_footer_and_ledger_styles_exist():
    for selector in (".empire-title-row", ".empire-ledger-btn", ".empire-ledger-pop", ".empire-footer", ".empire-drawer.is-footer"):
        assert selector + " {" in HTML or selector + "[open]" in HTML, selector
