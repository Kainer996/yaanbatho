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
    assert "showScanEncounterCard(bird" in HTML
    assert "continuous-sound-discovery-v2-20260709" in HTML
    # Existing loop must remain user-controlled and continue after each chunk.
    # (The hop clock re-opens recording lanes; the finished clip is only queued
    # for analysis while the session is still wanted and the mic is live.)
    assert "continuousSoundScanWanted = true" in HTML
    assert "const beginNextWindowBeforeAnalysis = continuousSoundScanWanted" in HTML
    assert "queueSoundWindowForAnalysis({ blob, sequence, startedAt, endedAt, durationMs, generation });" in HTML
    hop = HTML[HTML.index("function runSoundHop(generation)"):]
    hop = hop[:hop.index("\n}")]
    assert "startSoundRecorderWindow(generation);" in hop
    assert "scheduleSoundHop(generation);" in hop


def test_only_confirmed_confident_catalogue_matches_are_auto_logged():
    assert "const confirmedSpeciesKeys = new Set();" in HTML
    assert "const SOUND_REQUIRED_POLICY = 'burbz-v3-temporal-20260729.2';" in HTML
    assert "const SOUND_REQUIRED_MODEL_SHA =" in HTML
    assert "const SOUND_REQUIRED_LABELS_SHA =" in HTML
    assert "const SOUND_REQUIRED_SCORE_BLACKLIST_SHA =" in HTML
    assert "const SOUND_REQUIRED_GEO_MODEL_SHA =" in HTML
    assert "const SOUND_REQUIRED_GEO_LABELS_SHA =" in HTML
    assert "function soundCandidatesReadyToUnlock" in HTML
    assert "const unlockReady = soundCandidatesReadyToUnlock" in HTML
    assert "eligibleCandidates.filter" in HTML
    assert "surfaced.forEach(bird =>" in HTML
    assert "rememberDiscoveredBird(bird)" in HTML


def test_encounter_card_explains_birdex_and_dynamic_price():
    assert "Always added to Birdex" in HTML
    assert "Recruitment value" in HTML
    assert "const cost = recruitCostForBird(bird)" in HTML
    assert "BurbzScanEconomy.recruitCostForBird" in HTML


def test_new_core_is_loaded_and_precached():
    assert '<script src="scan_economy_core.js' in HTML
    assert "./scan_economy_core.js" in SW
    assert "const BURBZ_CACHE = 'burbz-" in SW
