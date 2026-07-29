import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def test_sighting_counter_counts_real_repeat_discoveries_but_not_silent_migrations():
    source = INDEX.read_text(encoding="utf-8")
    match = re.search(r"function nextDiscoverySightingCount\(existing, opts = \{\}\) \{.*?\n\}", source, re.S)
    assert match, "pure sighting counter helper is missing"
    script = match.group(0) + "\nconsole.log(JSON.stringify([nextDiscoverySightingCount(null),nextDiscoverySightingCount({sightingCount:1}),nextDiscoverySightingCount({sightingCount:1},{silent:true}),nextDiscoverySightingCount({sightingCount:'broken'},{silent:true})]));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [1, 2, 1, 1]


def test_pair_of_tits_badge_unlocks_on_second_great_tit_sighting():
    source = INDEX.read_text(encoding="utf-8")
    assert "sightingCount: nextDiscoverySightingCount(existing, opts)" in source
    assert "id: 'pair_of_tits'" in source
    assert "name: 'A Pair of Tits'" in source
    assert "greatTit && Number(greatTit.sightingCount || 0) >= 2" in source
    assert "checkBadges();" in source
