"""Real households, authoritative work allocation, navigation and planted paws."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def node(source):
    code = "const c=require('./settlement_life_core.js');\n" + source
    result = subprocess.run(['node', '-e', code], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', check=True)
    return json.loads(result.stdout)


def test_census_preserves_names_home_jobs_and_monotonic_ids_across_reload():
    out = node("""
const options={seed:42,population:6,homes:[{id:'cabin:0',capacity:6}],jobs:[{id:'hut',capacity:1}]};
const first=c.reconcile({},options);
const reload=c.reconcile(JSON.parse(JSON.stringify(first)),options);
const smaller=c.reconcile(reload,{...options,population:3});
const larger=c.reconcile(smaller,options);
console.log(JSON.stringify({first,reload,larger}));
""")
    assert out['first'] == out['reload']
    first, larger = out['first']['residents'], out['larger']['residents']
    assert first[:3] == larger[:3]
    assert len({p['id'] for p in larger}) == 6
    assert not {p['id'] for p in first[3:]} & {p['id'] for p in larger[3:]}
    assert sum(p['jobId'] == 'hut' for p in larger) == 1


def test_unbuilt_or_removed_homes_and_jobs_do_not_create_fake_capacity():
    out = node("""
const a=c.reconcile({}, {seed:9,population:9,homes:[{id:'cabin:0',capacity:6}],jobs:[{id:'quarry',capacity:3}]});
const b=c.reconcile(a, {seed:9,population:9,homes:[{id:'cottages:0',capacity:4}],jobs:[{id:'farm',capacity:1}]});
console.log(JSON.stringify({a,b}));
""")
    assert sum(p['homeId'] is None for p in out['a']['residents']) == 3
    people = out['b']['residents']
    assert sum(p['homeId'] == 'cottages:0' for p in people) == 4
    assert sum(p['homeId'] is None for p in people) == 5
    assert sum(p['jobId'] == 'farm' for p in people) == 1
    assert all(p['jobId'] != 'quarry' and p['homeId'] != 'cabin:0' for p in people)


def test_hostile_duplicate_census_is_reconciled_to_population():
    out = node("""
const raw={nextId:1008,residents:[{id:'7:resident:1',name:'Pip',homeId:'castle',jobId:'fake'},{id:'7:resident:1'},{id:'another ward'},{id:'7:resident:NaN'}]};
console.log(JSON.stringify(c.reconcile(raw,{seed:7,population:2,homes:[],jobs:[]})));
""")
    assert len(out['residents']) == 2 and out['nextId'] == 1009
    assert all(p['homeId'] is None and p['jobId'] is None for p in out['residents'])
    assert out['residents'][1]['id'] == '7:resident:1008'


def test_workforce_matches_existing_food_first_partial_staffing_law():
    out = node("""
const definitions=[{id:'chapel',workers:1,workPriority:5},{id:'minehut',workers:3,workPriority:3},{id:'hut',workers:1,workPriority:1}];
console.log(JSON.stringify([0,1,3,6].map(pop=>c.workforce(pop,{chapel:1,minehut:1,hut:1},definitions))));
""")
    assert [row['assigned'] for row in out] == [{}, {'hut': 1}, {'hut': 1, 'minehut': 2}, {'hut': 1, 'minehut': 3, 'chapel': 1}]
    assert all(row['required'] == 5 for row in out)


def test_sample_is_bounded_and_represents_each_town_ward():
    out = node("""
const people=[1,2,3].flatMap(seed=>c.reconcile({}, {seed,population:200,homes:[],jobs:[{id:'farm',capacity:1}]}).residents);
console.log(JSON.stringify({zero:c.visibleResidents([],10),sample:c.visibleResidents(people,11)}));
""")
    assert out['zero'] == [] and len(out['sample']) == 11
    assert {p['id'].split(':')[0] for p in out['sample']} == {'1', '2', '3'}
    assert all(p['jobId'] == 'farm' for p in out['sample'][:3])


def test_day_routines_visit_real_doors_and_reload_at_the_same_point():
    out = node("""
const person={id:'1:resident:0',homeId:'cabin:0',jobId:'farm'};
const paths={home:[{x:-4,z:0},{x:0,z:0}],leisure:[{x:-4,z:0},{x:0,z:0}],work:[{x:-4,z:0},{x:0,z:0},{x:3,z:5}]};
const states=Array.from({length:350},(_,i)=>c.routine(person,paths,i*1000,13));
console.log(JSON.stringify({states,reload:c.routine(JSON.parse(JSON.stringify(person)),paths,120000,13),night:c.routine(person,paths,120000,23),unhoused:c.routine({...person,homeId:null,jobId:null},paths,120000,23)}));
""")
    assert out['states'][120] == out['reload']
    assert {'At home', 'Walking to work', 'Working', 'Heading home', 'Taking a break'} <= {s['activity'] for s in out['states']}
    assert out['night']['inside'] and not out['night']['moving']
    assert (out['night']['x'], out['night']['z']) == (-4, 0)
    assert not out['unhoused']['inside']


def test_routes_go_around_buildings_and_refuse_a_sealed_start():
    out = node("""
const obstacle={minX:-1,maxX:1,minZ:-3,maxZ:3};
const road=c.streetRoute({x:-4,z:0},{x:4,z:0},[obstacle]);
const points=Array.from({length:201},(_,i)=>c.samplePath(road,i/200));
const sealed=c.streetRoute({x:0,z:0},{x:6,z:0},[{minX:-2,maxX:2,minZ:-2,maxZ:2}]);
console.log(JSON.stringify({road,points,sealed}));
""")
    assert out['road'] and out['sealed'] is None
    assert all(not (-1 < p['x'] < 1 and -3 < p['z'] < 3) for p in out['points'])


def test_rotated_roofs_leave_their_real_diagonal_street_open():
    out = node("""
const diamond={minX:-4,maxX:4,minZ:-4,maxZ:4,polygon:[{x:0,z:-4},{x:4,z:0},{x:0,z:4},{x:-4,z:0}]};
const start={x:3.2,z:3.2},end={x:8,z:8};
console.log(JSON.stringify({rotated:c.streetRoute(start,end,[diamond]),box:c.streetRoute(start,end,[{minX:-4,maxX:4,minZ:-4,maxZ:4}])}));
""")
    assert out['rotated'] and out['box'] is None


def test_changed_runtime_is_required_before_the_updated_shell_can_activate():
    sw = (ROOT / 'sw.js').read_text(encoding='utf-8')
    required = sw.split('const BURBZ_INSTALL_REQUIRED = [', 1)[1].split('];', 1)[0]
    for name in ('audio_core', 'settlement_life_core', 'settlement_models'):
        assert f'./{name}.js?v=little-folk-residents-v350-20260905' in required


def test_dog_stance_is_planted_and_joint_solution_reaches_the_paw():
    out = node("""
const frames=Array.from({length:101},(_,i)=>{
  const phase=i/100,foot=c.dogFoot(phase),angles=c.legAngles(foot.x,foot.y-.245,.14,.14);
  return {phase,foot,actual:{x:.14*Math.sin(angles.hip)+.14*Math.sin(angles.hip+angles.knee),y:-.14*Math.cos(angles.hip)-.14*Math.cos(angles.hip+angles.knee)}};
});
console.log(JSON.stringify({frames,idle:c.dogFoot(.3,false)}));
""")
    assert out['idle'] == {'x': 0, 'y': 0}
    for frame in out['frames']:
        foot, actual = frame['foot'], frame['actual']
        assert abs(actual['x'] - foot['x']) < 1e-5
        assert abs(actual['y'] - (foot['y'] - .245)) < 1e-5
        if frame['phase'] < .6:
            assert foot['y'] == 0
    assert max(f['foot']['y'] for f in out['frames']) > .08


def test_all_paid_building_models_are_batched_and_have_real_doors():
    out = node("""
const T=require('./lib/three.min.js');require('./settlement_models.js');
const fs=require('fs'),html=fs.readFileSync('index.html','utf8');
const begin=html.indexOf('const EMPIRE_BUILDINGS = ['),end=html.indexOf('// ---- Ruins & rubble',begin);
const definitions=new Function(html.slice(begin,end)+';return EMPIRE_BUILDINGS;')();
console.log(JSON.stringify(definitions.map(b=>{const g=global.BurbzSettlementModels.building(T,b.id,b.maxLevel,()=>.42,{});return {id:b.id,parts:g.children.length,door:g.userData.door,vertices:g.children.reduce((n,o)=>n+o.geometry.attributes.position.count,0),finite:g.children.every(o=>[...o.geometry.attributes.position.array].every(Number.isFinite))};})));
""")
    assert len(out) == 15
    assert all(1 <= b['parts'] <= 2 and b['finite'] and b['door']['z'] > 0 for b in out)
    assert max(b['vertices'] for b in out) < 25000


def test_v348_species_correction_keeps_the_same_people_and_assignments():
    out = node("""
const raw={version:1,nextId:12,residents:[{id:'42:resident:7',name:'Moss',species:'Robin',homeId:'cabin:0',jobId:'hut'}]};
const corrected=c.reconcile(raw,{seed:42,population:1,homes:[{id:'cabin:0',capacity:6}],jobs:[{id:'hut',capacity:1}]});
console.log(JSON.stringify(corrected));
""")
    assert out == {'version':2,'nextId':12,'residents':[{'id':'42:resident:7','name':'Moss','kind':'humanoid','homeId':'cabin:0','jobId':'hut'}]}
