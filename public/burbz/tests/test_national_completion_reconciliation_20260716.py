from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_reconciled_national_catalogue_runtime_survives_the_buzzard_release():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    assert '<script src="national_bird_completion_20260715.js?v=national-completion-20260715"></script>' in html
    assert '<script src="spain_boundary_20260715.js?v=spain-mainland-balearics-20260715"></script>' in html
    assert "const NATIONAL = window.BURBZ_NATIONAL_BIRD_COMPLETION_20260715" in html
    assert "NATIONAL.names.forEach(addUniqueWildBird);" in html
    assert "addNationalSpeciesProfiles(BURBZ_SPECIES_PROFILES, NATIONAL.profiles);" in html
    assert "importScripts('./national_bird_completion_20260715.js?v=national-completion-20260715');" in sw
    assert "burbz-village-life-v85-20260716" in sw

    required = {
        ROOT / "national_bird_completion_20260715.js": 4_000_000,
        ROOT / "spain_boundary_20260715.js": 40_000,
        ROOT / "data" / "national-bird-completion" / "profiles.json": 5_000_000,
        ROOT / "data" / "national-bird-completion" / "education.json": 3_000_000,
        ROOT / "data" / "national-bird-completion" / "manifest.json": 5_000,
    }
    for path, minimum_size in required.items():
        assert path.exists() and path.stat().st_size > minimum_size, path
