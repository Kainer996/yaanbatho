"""Read-only release snapshot + feature patch, never edit the release checkout."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

p = argparse.ArgumentParser()
p.add_argument('--owner', type=Path, required=True)
p.add_argument('--destination', type=Path, required=True)
a = p.parse_args()
ours = Path(__file__).resolve().parents[3]
owner, destination = a.owner.resolve(), a.destination.resolve()
assert destination != owner and owner not in destination.parents
assert destination != ours and ours not in destination.parents
source, target = ours / 'public/burbz', destination / 'public/burbz'
shutil.copytree(source, target, dirs_exist_ok=True)
names = ['index.html', 'village_world.js', 'village_world_core.js', 'village_walk.js', 'village_walk_core.js', 'village_walk_scene.js', 'village_harvest.js', 'geographic_forest_core.js', 'building_rooms.js', 'village_discoveries.js']
manifest = {}
for name in names:
    data = (owner / 'public/burbz' / name).read_bytes()
    manifest[name] = hashlib.sha256(data).hexdigest()
    (target / name).write_bytes(data)
patch = subprocess.check_output(['git', 'diff', 'e713eb87a852253504e8beef92744a7514b2e6de', '--', 'public/burbz/index.html'], cwd=ours)
patch_path = destination / 'ui-index.patch'
patch_path.write_bytes(patch)
subprocess.run(['git', 'apply', '--check', '--unsafe-paths', '--directory=' + str(destination), str(patch_path)], cwd=ours, check=True)
subprocess.run(['git', 'apply', '--unsafe-paths', '--directory=' + str(destination), str(patch_path)], cwd=ours, check=True)
walk = target / 'village_walk.js'
s = walk.read_text()
for before, after in [
    ("on(document,'keydown',e=>{\n", "on(document,'keydown',e=>{\n      if(['Space','Enter'].includes(e.code)&&e.target.closest?.('button,a,input,select,textarea'))return;\n"),
    ('s.harvest?.dispose();', 's.combat?.dispose();s.harvest?.dispose();'),
    ("knob.style.transform='';s.flight?.reset();", "knob.style.transform='';s.flight?.reset();s.combat?.reset();"),
    ('s.rooms?.update(ts/1000);s.harvest?.update', 's.combat?.update(dt);s.rooms?.update(ts/1000);s.harvest?.update'),
    ('s.hud=root.BurbzFirstPersonHud.attach(s);', 's.hud=root.BurbzFirstPersonHud.attach(s);\n      s.combat=root.BurbzWildernessCombat?.attach(s);'),
    ('return {open:true,continuity:', 'return {open:true,combat:s.combat?.diagnostics(),continuity:'),
]:
    assert s.count(before) == 1, before
    s = s.replace(before, after)
walk.write_text(s)
# Flying requires a whole view of loaded terrain; a projectile only needs its
# swept points loaded. Reuse the same tree/building collision with that gate off.
world_file = target / 'village_world.js'
s = world_file.read_text()
old = 'function allowed3(x,y,z){const h=height(x,z);if(h===null||!visibleCoverage(x,z))return false;'
assert s.count(old) == 1
s = s.replace(old, 'function allowed3(x,y,z,requireCoverage=true){const h=height(x,z);if(h===null||(requireCoverage&&!visibleCoverage(x,z)))return false;')
s = s.replace('const world={radius:Infinity,allowed3,', 'const world={radius:Infinity,combatAllowed3:(x,y,z)=>allowed3(x,y,z,false),allowed3,')
world_file.write_text(s)
(destination / 'OWNER_SNAPSHOT.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Prepared isolated retained-renderer compatibility fixture:', destination)
