'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const state = require('../destination_state_core.js');
const now = 1800000000000, point = {lat:51.5, lon:-.12}, fix = {...point, at:now, accuracy:5};
function fixture(legacy = false) {
  const root = {profileId:'repair-synthetic', revision:0, coins:13, destinationQuests:{...state.emptyDestinationState(), active:{
    schemaVersion:1, kind:'destination-quest', id:'walk', phase:'active', route:{}, quote:{}, receipts:{encounters:{}},
    entries:['building','character','bird'].map((kind,i)=>({schemaVersion:1, id:kind, kind, route:{...point, lon:point.lon+i*.02, distanceM:i*1000, sourceSegment:{}}, generatedGameEncounter:true, observedRealWorld:false, nativeAction:{method:'open'}}))
  }}};
  if (legacy) delete root.destinationQuests.previews;
  return root;
}
function discoverAndReload(root, atFix = fix) {
  let saved, calls = 0;
  const adapter = {persist(actual){assert.equal(actual,root); calls++; saved=JSON.parse(JSON.stringify(actual)); return true;}};
  const result = state.observeDestinationEncounters(root,atFix,adapter,{now});
  assert.equal(result.status,'committed');
  assert.deepEqual(result.value.entries,['building']);
  assert.deepEqual(root.destinationQuests.active.receipts.discoveries?.building,{entryId:'building',lat:atFix.lat,lon:atFix.lon,at:atFix.at});
  assert.equal(state.encounterGate(saved,'building',null,now+900000).ready,true,'durable no-GPS revisit after reload');
  assert.deepEqual(saved.destinationQuests.active.receipts.encounters,{});
  assert.equal(saved.coins,13);
  assert.equal(state.observeDestinationEncounters(saved,atFix,{persist(){calls++;return true;}},{now}).status,'unchanged');
  assert.equal(calls,1,'matching valid receipt never saves again');
}
test('legacy missing previews installs discovery on the persisted normalized quest and reloads',()=>{
  const root=fixture(true); discoverAndReload(root); assert.deepEqual(root.destinationQuests.previews,{});
});
for (const legacy of [false,true]) for (const failure of ['false','throw']) {
  test(`discovery normalization rollback is exact (${legacy?'legacy':'current'}, persist ${failure})`,()=>{
    const root=fixture(legacy), before=JSON.stringify(root), container=root.destinationQuests, quest=container.active, entry=quest.entries[0];
    const result=state.observeDestinationEncounters(root,fix,{persist(actual){
      assert(actual.destinationQuests.active.receipts.discoveries.building,'receipt must exist on the root being saved');
      if(failure==='throw')throw Error('storage denied'); return false;
    }},{now});
    assert.equal(result.status,'failed'); assert.equal(JSON.stringify(root),before);
    assert.equal(root.destinationQuests,container); assert.equal(container.active,quest); assert.equal(quest.entries[0],entry);
    discoverAndReload(root);
  });
}
test('corrected canonical coordinates allow a fresh actual arrival to replace the stale receipt',()=>{
  const root=fixture(); discoverAndReload(root);
  root.destinationQuests.active.entries[0].route.lon+=.01;
  assert.equal(state.encounterGate(root,'building',null,now).ready,false);
  discoverAndReload(root,{...fix,lon:fix.lon+.01});
});
const valid={entryId:'building',...point,at:now-10000};
const invalidReceipts={wrongEntry:{...valid,entryId:'other'},wrongLatitude:{...valid,lat:point.lat+.01},wrongLongitude:{...valid,lon:point.lon+.01},zeroTime:{...valid,at:0},negativeTime:{...valid,at:-1},infiniteTime:{...valid,at:Infinity},nanTime:{...valid,at:NaN},stringTime:{...valid,at:String(now)},markerOnly:{discovered:true},booleanMarker:true};
for (const [name,receipt] of Object.entries(invalidReceipts)) {
  test(`invalid ${name} cannot grant eligibility or block genuine rediscovery`,()=>{
    const root=fixture(); root.destinationQuests.active.receipts.discoveries={building:receipt};
    assert.equal(state.encounterGate(root,'building',null,now).ready,false);
    const before=structuredClone(root);
    for(const badFix of [null,{...fix,lon:fix.lon+.1},{...fix,at:now-130000},{...fix,at:now+11000},{...fix,accuracy:90}]) {
      assert.equal(state.observeDestinationEncounters(root,badFix,{persist(){assert.fail('invalid GPS must not persist');}},{now}).status,'unchanged');
      assert.deepEqual(root,before);
    }
    discoverAndReload(root);
  });
}
for(const legacy of [false,true]) for(const failure of ['false','throw']) {
  test(`replacement rollback preserves stale receipt and retries (${legacy?'legacy':'current'}, persist ${failure})`,()=>{
    const root=fixture(legacy);root.destinationQuests.active.receipts.discoveries={building:{...valid,lon:point.lon+.01}};
    const before=JSON.stringify(root);
    assert.equal(state.observeDestinationEncounters(root,fix,{persist(){if(failure==='throw')throw Error('storage denied');return false;}},{now}).status,'failed');
    assert.equal(JSON.stringify(root),before);assert.equal(state.encounterGate(root,'building',null,now).ready,false);
    discoverAndReload(root);
  });
}
