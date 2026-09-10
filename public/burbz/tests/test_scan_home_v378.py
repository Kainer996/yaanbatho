"""Home state projection and complete offline update contract."""
import re
import subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
RELEASE='enchanted-study-v384-20260910'
CURRENT_BUILD = 'merlin-flight-v390-20260910'
def test_home_state_is_honest_and_gated():
    result=subprocess.run(['node',str(ROOT/'tests/test_scan_home_v378.cjs')],text=True,capture_output=True)
    assert result.returncode==0,result.stdout+result.stderr

def test_home_runtime_and_art_install_together():
    html=(ROOT/'index.html').read_text();sw=(ROOT/'sw.js').read_text()
    updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)';",sw)[1].endswith(CURRENT_BUILD)
    for file in ['scan_home.css','scan_home_core.js','scan_home.js','assets/home-v384/enchanted-study.webp']:
        url=file if file.startswith('assets/') else file+'?v='+('home-countryside-v387-20260910' if file=='scan_home.css' else RELEASE)
        assert url in html
        assert f'"{file}"' in updater
        for name in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
            block=re.search(r'const '+name+r' = \[(.*?)\];',sw,re.S)[1]
            assert block.count('./'+url)==1
    image=Image.open(ROOT/'assets/home-v384/enchanted-study.webp')
    assert image.size==(1536,1024)
    assert (ROOT/'assets/home-v384/enchanted-study.webp').stat().st_size<400000
