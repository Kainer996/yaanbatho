"""The Barracks build tutorial must not advertise an unrelated locked market."""
import json
import subprocess
from pathlib import Path
HTML = (Path(__file__).resolve().parents[1] / 'index.html').read_text()


def function(name):
    start = HTML.index('function ' + name + '(')
    return HTML[start:HTML.index('\n}', start) + 2]


def run(code):
    return json.loads(subprocess.run(['node', '-e', code], capture_output=True, text=True, check=True).stdout)


def test_barracks_build_panel_keeps_guidance_without_market_banner():
    result = run(function('renderAcademyBuildPanel') + """
const panel={innerHTML:''}, $=()=>panel, ensureAcademyBuildings=()=>{};
const ACADEMY_BUILDING_ORDER=['barracks','magpie_market'];
const ACADEMY_BUILDINGS={barracks:{label:'Barracks',room:'barracks',unlockLevel:1,cost:10,effect:'Train birds'},magpie_market:{label:'Magpie Market',room:'magpie_market',unlockLevel:4,cost:40,effect:'Trade'}};
const gameState={player:{level:1,coins:100}}, playerBranches=()=>20;
const academyBuildingProgressLock=()=>null, academyPlacementTarget=null, academyQuestGuidanceRoom='barracks', escapeHtml=s=>s;
let marketBuilt=false;const isAcademyBuildingBuilt=id=>id==='magpie_market'&&marketBuilt;
renderAcademyBuildPanel();const before=panel.innerHTML;
marketBuilt=true;renderAcademyBuildPanel();console.log(JSON.stringify({before,after:panel.innerHTML}));
""")
    for html in result.values():
        assert 'Trading is locked' not in html
        assert 'SHOW ME THE MAGPIE MARKET' not in html
        assert 'academy-market-nudge' not in html
        assert 'academy-build-grid' in html
        assert 'quest-guided" data-building="barracks"' in html
        assert "academyStartPlaceBuilding('barracks')" in html
        assert 'data-building="magpie_market"' in html


def test_explicit_trade_still_requires_market_and_guides_to_build():
    result = run(function('magpieMarketTradeReady') + function('requireMagpieMarketTrade') + """
let built=false, guided=0;const isAcademyBuildingBuilt=id=>id==='magpie_market'&&built;
const focusMagpieMarketBuild=()=>guided++;
const locked=requireMagpieMarketTrade();built=true;const unlocked=requireMagpieMarketTrade();
console.log(JSON.stringify({locked,unlocked,guided}));
""")
    assert result == {'locked': False, 'unlocked': True, 'guided': 1}
    for name in ['storesSellItem', 'magpieMarketSell', 'magpieMarketBuy']:
        assert 'if (!requireMagpieMarketTrade()) return' in function(name)
