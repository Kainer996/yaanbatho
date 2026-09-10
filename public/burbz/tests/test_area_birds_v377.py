"""Local field guide evidence, lifecycle and atomic offline release."""
import re
import subprocess
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
RELEASE='area-birds-v377-20260909'
@pytest.mark.parametrize('script',['test_area_birds_v377.cjs','test_area_birds_lifecycle_v377.cjs'])
def test_area_birds_behavior(script):
    result=subprocess.run(['node',str(ROOT/'tests'/script)],capture_output=True,text=True)
    assert result.returncode==0,result.stdout+result.stderr

def test_area_birds_offline_release():
    html=(ROOT/'index.html').read_text();sw=(ROOT/'sw.js').read_text()
    updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    assert "const BURBZ_BUILD = 'side-chest-v383-20260910';" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)';",sw)[1].endswith('side-chest-v383-20260910')
    for file in ['area_birds.css','area_birds_core.js','area_birds.js','area_birds_taxonomy.js','geographic_map_3d.js']:
        assert f'{file}?v={RELEASE}' in html
        assert f'"{file}"' in updater
        for name in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
            block=re.search(r'const '+name+r' = \[(.*?)\];',sw,re.S)[1]
            assert block.count(f'./{file}?v={RELEASE}')==1
