from pathlib import Path
import re, subprocess
ROOT=Path(__file__).resolve().parents[1]
RELEASE='appearance-v362-20260907'
CURRENT_BUILD='side-chest-v383-20260910'

def test_appearance_behavior():
    subprocess.run(['node',str(ROOT/'tests/test_appearance_v362.cjs')],check=True)

def test_all_themes_and_switch_are_required_offline():
    sw=(ROOT/'sw.js').read_text()
    deps=[f'./{p}?v={RELEASE}' for p in ['appearance_core.js','appearance_ui.css','comic_ui.css']]+['./woodland_ui.css?v=woodland-finish-v360-20260907','./assets/comic-ui/ink-paper-v359.webp']
    for name in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
        entries=re.findall(r"['\"]([^'\"]+)['\"]",re.search(rf'const {name} = \[(.*?)\];',sw,re.S)[1])
        for dep in deps: assert entries.count(dep)==1
    html=(ROOT/'index.html').read_text()
    assert html.index('appearance_core.js?v=')<html.index('<body')
    assert 'BurbzAppearanceCore.choose(gameState.settings, input.value, () => durableSaveState(), document)' in html
    assert "appearance: 'normal'" in html
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)'",sw)[1].endswith('-'+CURRENT_BUILD)
    updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    for name in ['appearance_core.js','appearance_ui.css','comic_ui.css']:
        assert f'"{name}"' in updater

def test_comic_palette_is_exclusive_and_quest_panels_receive_it():
    css=(ROOT/'comic_ui.css').read_text()
    assert ':root {' not in css
    assert 'html[data-appearance="comic"] {' in css
    assert 'html, body.comic-ui' not in css
    ui=(ROOT/'appearance_ui.css').read_text()
    for root in ['#walkQuestSheet','#wqNpcDialog','#mapQuestFocusCard','#walkingQuestsList']:
        assert root in ui
    assert '[role="tabpanel"][hidden] { display:none !important; }' in ui


def test_map_brief_hardcoded_light_text_is_overridden_for_paper_theme():
    css=(ROOT/'appearance_ui.css').read_text()
    assert '.map-quest-focus-name { color:var(--comic-ink); }' in css
    assert ':is(.map-quest-focus-brief,.map-quest-focus-chip) { color:var(--comic-muted); }' in css
    assert '.map-quest-focus-close { color:var(--comic-ink);' in css
