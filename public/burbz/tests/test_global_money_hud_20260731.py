from pathlib import Path

HTML = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")
SW = (Path(__file__).resolve().parents[1] / "sw.js").read_text(encoding="utf-8")


def test_header_names_the_players_money_in_plain_language():
    assert 'class="hud-chip-label">Coins</span>' in HTML
    assert 'id="hudCoins"' in HTML


def test_global_money_hud_exists_for_layers_that_cover_the_header():
    assert 'id="globalMoneyHud"' in HTML
    assert 'id="globalMoneyValue"' in HTML
    assert 'aria-label="Player money"' in HTML
    assert '.global-money-hud.show { display:flex; }' in HTML
    assert "candidates.length === 1 ? ' bird awaiting recruitment' : ' birds awaiting recruitment'" in HTML
    assert "'Trainer funds: '" not in HTML


def test_global_money_hud_uses_the_same_live_balance_as_the_header():
    assert "setHudChipValue('globalMoneyHud', 'globalMoneyValue', gameState.player.coins || 0);" in HTML
    assert "setAttribute('aria-label', 'Player money: ' + amount + ' coins')" in HTML


def test_global_money_hud_detects_any_layer_covering_the_header_without_an_overlay_allowlist():
    assert 'document.elementsFromPoint' in HTML
    assert 'new MutationObserver' in HTML
    assert "attributeFilter:['class','style','hidden']" in HTML
    assert 'initGlobalMoneyHud();' in HTML
    assert 'barracksRecruitOverlay' not in _function_source('syncGlobalMoneyHud')


def test_release_cache_is_bumped_for_the_global_money_hud():
    marker = 'global-money-hud-v190-20260731'
    assert marker in SW
    # Later releases legitimately replace BURBZ_BUILD; the shared build/cache
    # contract is covered by test_sw_self_update_20260728.py.
    assert "const BURBZ_BUILD = '" in HTML


def _function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    brace = HTML.index('{', start)
    depth = 0
    for idx in range(brace, len(HTML)):
        if HTML[idx] == '{':
            depth += 1
        elif HTML[idx] == '}':
            depth -= 1
            if depth == 0:
                return HTML[start:idx + 1]
    raise AssertionError(f"Could not extract {name}")
