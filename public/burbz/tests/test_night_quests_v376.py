import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def test_night_paths_and_palette_preserve_geometry_and_bound_work():
 script=r"""
const assert=require('node:assert/strict'),c=require('./geographic_daynight_core.js'),d=require('./daylight_core.js');
const points=[[-1.786,53.349],[-1.77,53.349]],paths=[{points,priority:2}],before=JSON.stringify(paths),view={center:points[0]};
const a=c.samplePaths(paths,view),b=c.samplePaths(paths,{center:points[1]});
assert(a.length>5);assert.deepEqual(a.map(x=>x.id).sort(),b.map(x=>x.id).sort());assert.equal(JSON.stringify(paths),before);
assert(c.samplePaths(paths,view,3).length===3);assert.equal(c.samplePaths(paths,view,0).length,0);
for(const r of a){assert(Math.abs(c.distance([r.lon,r.lat],[r.lon,53.349])-3.2)<.01);assert(r.distanceAlong>0);}
assert.equal(c.samplePaths([{points:[[0,0],[120,70]]}]).length,0);
assert.equal(c.samplePaths([{points:[[0,0],[NaN,1]]}]).length,0);
assert.equal(c.samplePaths(paths,{...view,accept:()=>false}).length,0);
assert.equal(c.samplePaths(paths,{bounds:[0,0,1,1]}).length,0);
assert(c.samplePaths(Array.from({length:1000},(_,i)=>({points:[[0,i/10000],[.1,i/10000]]}))).length<=48);
const expr=['match',['get','class'],'path','#aabbcc','#123456'],copy=JSON.stringify(expr);
assert.deepEqual(c.expression(expr,d.daylightGradeForHour(12),'road'),expr);
assert.notDeepEqual(c.expression(expr,d.daylightGradeForHour(23),'road'),expr);assert.equal(JSON.stringify(expr),copy);
for(let h=0;h<24;h+=.1)assert(/^#[a-f0-9]{6}$/.test(c.color('#aabbcc',d.daylightGradeForHour(h))));
assert.equal(c.color('rgba(0,0,0,0)',d.daylightGradeForHour(23)),'rgba(0,0,0,0)');
"""
 result=subprocess.run(['node','-e',script],cwd=ROOT,text=True,capture_output=True)
 assert result.returncode==0,result.stderr

def test_night_controller_lifecycle():
 result=subprocess.run(['node',str(ROOT/'tests/test_night_lifecycle_v376.cjs')],text=True,capture_output=True)
 assert result.returncode==0,result.stderr

def test_night_release_is_atomic_offline():
 import re
 release='night-quests-v376-20260908'
 files=['geographic_daynight_core.js','geographic_daynight.js','geographic_map_3d.js','geographic_map_3d.css','geographic_details_scene.js']
 html=(ROOT/'index.html').read_text();sw=(ROOT/'sw.js').read_text();updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
 assert "const BURBZ_BUILD = 'side-chest-v383-20260910';" in html
 assert re.search(r"const BURBZ_CACHE = '([^']+)';",sw).group(1).endswith('side-chest-v383-20260910')
 for file in files:
  assert (ROOT/file).is_file()
  asset_release='area-birds-v377-20260909' if file=='geographic_map_3d.js' else 'map-trails-v381-20260909' if file=='geographic_details_scene.js' else release
  assert f'{file}?v={asset_release}' in html
  assert f'"{file}"' in updater
  for name in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
   block=re.search(r'const '+name+r' = \[(.*?)\];',sw,re.S).group(1)
   assert block.count(f'./{file}?v={asset_release}')==1
