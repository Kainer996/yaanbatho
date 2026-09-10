"""Home state projection and complete offline update contract."""
import re
import subprocess
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
RELEASE='scan-home-v378-20260909'
def test_home_state_is_honest_and_gated():
    result=subprocess.run(['node',str(ROOT/'tests/test_scan_home_v378.cjs')],text=True,capture_output=True)
    assert result.returncode==0,result.stdout+result.stderr

def test_home_runtime_and_art_install_together():
    html=(ROOT/'index.html').read_text();sw=(ROOT/'sw.js').read_text()
    updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    assert "const BURBZ_BUILD = 'pocket-detours-v382-20260910';" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)';",sw)[1].endswith('pocket-detours-v382-20260910')
    for file in ['scan_home.css','scan_home_core.js','scan_home.js','assets/home-v378/woodland-lookout.webp']:
        url=file if file.startswith('assets/') else file+'?v='+RELEASE
        assert url in html
        assert f'"{file}"' in updater
        for name in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
            block=re.search(r'const '+name+r' = \[(.*?)\];',sw,re.S)[1]
            assert block.count('./'+url)==1
    image=Image.open(ROOT/'assets/home-v378/woodland-lookout.webp')
    assert image.size==(1024,1536)
    assert (ROOT/'assets/home-v378/woodland-lookout.webp').stat().st_size<400000
