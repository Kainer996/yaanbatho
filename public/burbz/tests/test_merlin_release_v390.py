"""The v2 renderer, rectangles and pixels must be installed as one release."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PIN = 'merlin-flight-v390-20260910'


def test_merlin_v2_loader_and_all_offline_lists_agree():
    html = (ROOT / 'index.html').read_text()
    worker = (ROOT / 'sw.js').read_text()
    updater = (ROOT.parents[1] / 'scripts/update-live-burbz.sh').read_text()
    files = ['merlin_flight.js', 'assets/merlin-flight/atlas-config.js']
    urls = [name + '?v=' + PIN for name in files]
    asset = 'assets/merlin-flight/merlin-flight-v2.webp'
    assert f"atlasUrl: '{asset}'" in html
    assert asset in (ROOT / 'assets/merlin-flight/atlas-config.js').read_text()
    assert 'merlin_flight.css?v=merlin-flight-v1-20260907' in html
    for url in urls:
        assert url in html
    for name in files + [asset]:
        assert (ROOT / name).is_file()
        assert f'"{name}"' in updater
    for name in ['BURBZ_ASSETS', 'BURBZ_CORE', 'BURBZ_INSTALL_REQUIRED']:
        section = re.search(rf'const {name} = \[(.*?)\];', worker, re.S)[1]
        for url in urls + [asset]:
            assert section.count("'./" + url + "'") == 1
        assert 'merlin_flight.js?v=merlin-flight-v1-' not in section
        assert 'atlas-config.js?v=merlin-flight-v1-' not in section
    assert f"const BURBZ_BUILD = '{PIN}';" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)'", worker)[1].endswith(PIN)
