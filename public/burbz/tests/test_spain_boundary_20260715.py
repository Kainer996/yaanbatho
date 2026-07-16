import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOUNDARY = ROOT / "spain_boundary_20260715.js"
INDEX = ROOT / "index.html"


def test_authoritative_mainland_and_balearic_boundary_cases():
    assert BOUNDARY.exists()
    cases = {
        "madrid": [40.4168, -3.7038, True],
        "barcelona": [41.3874, 2.1686, True],
        "bilbao": [43.2630, -2.9350, True],
        "cuevas": [37.3, -1.87, True],
        "mallorca": [39.5696, 2.6502, True],
        "lisbon": [38.7223, -9.1393, False],
        "andorra": [42.5063, 1.5218, False],
        "perpignan": [42.6887, 2.8948, False],
        "gibraltar": [36.1408, -5.3536, False],
        "tenerife": [28.2916, -16.6291, False],
        "ceuta": [35.8894, -5.3213, False],
        "melilla": [35.2923, -2.9381, False],
    }
    script = "const b=require('./spain_boundary_20260715.js'); const c=" + json.dumps(cases) + "; console.log(JSON.stringify(Object.fromEntries(Object.entries(c).map(([k,v])=>[k,b.contains(v[0],v[1])]))));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    observed = json.loads(result.stdout)
    assert observed == {key: row[2] for key, row in cases.items()}


def test_runtime_uses_boundary_module_and_claims_only_supported_spain_scope():
    source = INDEX.read_text(encoding="utf-8")
    tag = '<script src="spain_boundary_20260715.js?v=spain-mainland-balearics-20260715"></script>'
    assert tag in source
    assert source.index(tag) < source.index("<script>\n/* ============================================================================")
    assert "SPAIN_BOUNDARY.contains(lat, lon)" in source
    assert "mainland Spain and the Balearics" in source
    assert "const SPAIN_MAINLAND_POLYGON" not in source
