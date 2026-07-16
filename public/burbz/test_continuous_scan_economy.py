import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
CORE = ROOT / "scan_economy_core.js"


def run_node(source: str):
    result = subprocess.run(["node", "-e", source], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stderr or result.stdout
    return json.loads(result.stdout)


def test_recruitment_cost_uses_rarity_power_and_stats():
    assert CORE.exists(), "scan_economy_core.js must hold the testable pricing rules"
    result = run_node(
        "const c=require('./scan_economy_core.js');"
        "const weak=c.recruitCostForBird({rarity:'common',power:25,atk:20,def:20,spd:20,int:20,stamina:20,maxHp:20});"
        "const strong=c.recruitCostForBird({rarity:'common',power:180,atk:90,def:85,spd:95,int:80,stamina:88,maxHp:100});"
        "const rare=c.recruitCostForBird({rarity:'rare',power:180,atk:90,def:85,spd:95,int:80,stamina:88,maxHp:100});"
        "process.stdout.write(JSON.stringify({weak,strong,rare,parts:c.recruitCostBreakdown({rarity:'rare',power:180,atk:90,def:85,spd:95,int:80,stamina:88,maxHp:100})}));"
    )
    assert result["strong"] > result["weak"]
    assert result["rare"] > result["strong"]
    assert result["parts"]["rarityBase"] > 0
    assert result["parts"]["powerPremium"] > 0
    assert result["parts"]["statPremium"] > 0
    assert result["parts"]["total"] == result["rare"]


def test_continuous_scan_shows_a_non_blocking_card_for_every_detection():
    assert 'id="scanEncounterStack"' in HTML
    assert "function showScanEncounterCard" in HTML
    assert "showScanEncounterCard(top" in HTML
    assert "continuous-sound-discovery-v2-20260709" in HTML
    # Existing loop must remain user-controlled and continue after each chunk.
    assert "continuousSoundScanWanted = true" in HTML
    assert "const beginNextWindowBeforeAnalysis = continuousSoundScanWanted" in HTML
    assert "if (beginNextWindowBeforeAnalysis) startSoundRecorderWindow(generation);" in HTML


def test_only_the_confident_winner_is_auto_logged_not_weaker_alternatives():
    assert "if (top && rememberDiscoveredBird(top)) newDiscoveries.push(top);" in HTML
    assert "candidates.forEach(bird => { if (rememberDiscoveredBird(bird))" not in HTML


def test_encounter_card_explains_birdex_and_dynamic_price():
    assert "Always added to Birdex" in HTML
    assert "Recruitment value" in HTML
    assert "const cost = recruitCostForBird(bird)" in HTML
    assert "BurbzScanEconomy.recruitCostForBird" in HTML


def test_new_core_is_loaded_and_precached():
    assert '<script src="scan_economy_core.js' in HTML
    assert "./scan_economy_core.js" in SW
    assert "const BURBZ_CACHE = 'burbz-" in SW
