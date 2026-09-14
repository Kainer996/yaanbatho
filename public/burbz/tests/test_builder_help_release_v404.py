"""A fresh offline walker must have every exact builder dependency before activation."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
def test_builder_dependencies_are_required_and_deployable():
    worker=(ROOT/'sw.js').read_text()
    loader=(ROOT/'village_walk.js').read_text()
    updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    for name in ('building_work_core.js','building_work.js','building_work.css','village_walk.js','first_person_hud.js'):
        pin='builder-help-v404-20260914' if name=='building_work_core.js' else 'wilderness-discoveries-v406-20260914' if name=='village_walk.js' else 'building-opening-v405-20260914' if name=='building_work.js' else 'builder-actions-v404b-20260914'
        url='./'+name+'?v='+pin
        for group in ('BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED'):
            entries=re.search(r'const '+group+r' = \[(.*?)\];',worker,re.S)[1]
            assert entries.count("'"+url+"'")==1,(name,group)
        assert '"'+name+'"' in updater
        if name!='village_walk.js': assert "'"+name+"':'"+pin+"'" in loader
        assert (ROOT/name).is_file()
