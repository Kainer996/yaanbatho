'use strict';
const assert=require('node:assert/strict');
const Scan=require('../scan_home_core.js');
const Academy=require('../academy_treehouse_core.js');

const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const ids=Academy.getAcademyRooms().map(room=>room.id);
const names=rooms=>Object.fromEntries(rooms.map(room=>[room.id,room]));

assert.equal(ids.length,13,'canonical Academy catalog has 13 rooms');

{
  const snapshot=freeze({
    academyBuilderVersion:8,
    player:{level:99,coins:999999,branches:999999},
    playerHome:{rooms:{kitchen:true,library:true}},
    academyBuildings:{outdoors:{built:true,builtAt:'starter'},tavern:{built:false,builtAt:'rejected'},training:{built:'true'},unknown_room:{built:true,x:1,y:2}},
    flock:[
      {id:'garden-bird',nickname:'Garden',academy:{room:'outdoors'}},
      {id:'ghost',nickname:'Ghost',academy:{room:'library'}},
      {id:'birdhouse-saved',nickname:'Birdhouse Save',academy:{room:'tavern'}},
      {id:'kitchen-saved',nickname:'Kitchen Save',academy:{room:'kitchen'}},
      {id:'unknown-saved',nickname:'Unknown Save',academy:{room:'market'}},
      {id:'missing-room',nickname:'Missing Save',academy:{}}
    ],
    birdExpeditions:[]
  });
  const before=JSON.stringify(snapshot);
  const model=Scan.projectAcademyRooms(snapshot,{catalog:Academy.getAcademyRooms()});
  assert.equal(JSON.stringify(snapshot),before,'projection is read-only on frozen fresh/state snapshots');
  assert.deepEqual(model.rooms.map(room=>room.id),ids,'projection preserves exact canonical order');
  const byId=names(model.rooms);
  assert.equal(byId.outdoors.owned,true,'outdoors is canonically owned');
  assert.equal(byId.outdoors.status,'owned');
  assert.equal(byId.tavern.owned,false,'built:false does not grant the Birdhouse');
  assert.equal(byId.training.owned,false,'truthy non-boolean built value does not grant ownership');
  assert.equal(byId.kitchen.owned,false,'level, resources and personal-home rooms do not grant Academy ownership');
  assert.equal(byId.library.owned,false,'personal-home library does not grant Academy ownership');
  assert.equal(byId.tavern.label,'Birdhouse');
  assert.equal(byId.crowbar.label,'The Crowbar');
  assert.deepEqual(model.ownedIds,['outdoors']);
  assert(model.buildableIds.includes('tavern'),'fresh/malformed saves still expose starting Build room IDs');
  assert.equal(model.unknownRecords.length,1);
  assert.equal(model.unknownRecords[0].id,'unknown_room');
  assert.deepEqual(byId.outdoors.occupants.map(bird=>bird.id),['garden-bird','ghost','birdhouse-saved','kitchen-saved','unknown-saved','missing-room']);
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='ghost').savedRoom,'library');
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='ghost').displayReason,'unowned-room');
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='birdhouse-saved').displayReason,'nonresidential-room');
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='kitchen-saved').displayReason,'nonresidential-room');
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='unknown-saved').displayReason,'unknown-room');
  assert.deepEqual(model.excludedOccupants,[]);
}

{
  const migrated=freeze({
    academyBuilderVersion:8,
    academyBuildings:{
      outdoors:{built:true,builtAt:'starter',x:12,y:91},
      tavern:{built:true,builtAt:'2026-09-01T10:00:00Z',x:80.25,y:70.5,movedAt:'2026-09-02T09:00:00Z'},
      magpie_market:{built:true,builtAt:'2026-09-03T10:00:00Z',x:23,y:67},
      library:{built:true,builtAt:'2026-09-04T10:00:00Z',x:74,y:26},
      kitchen:{built:false,x:50,y:55},
      market:{built:true,x:99,y:99}
    },
    flock:[
      {id:'free',commonName:'Robin',academy:{room:'outdoors'}},
      {id:'recruiter',commonName:'Blackbird',academy:{room:'tavern'}},
      {id:'seller',commonName:'Magpie',academy:{room:'magpie_market'}},
      {id:'reader',commonName:'Raven',academy:{room:'library'}},
      {id:'away-reader',commonName:'Crow',academy:{room:'library'}},
      {id:'bad-room',commonName:'Finch',academy:{room:'market'}}
    ],
    birdExpeditions:[{id:'trip-1',birdId:'away-reader',status:'active'}],
    birdRoles:{academy:{library:'reader',kitchen:'ghost-chef'}}
  });
  const before=JSON.stringify(migrated);
  const model=Scan.projectAcademyRooms(migrated,{catalog:Academy.getAcademyRooms()});
  assert.equal(JSON.stringify(migrated),before,'migrated coordinates and obsolete records remain byte-equivalent');
  const byId=names(model.rooms);
  assert.deepEqual(model.ownedIds,['outdoors','tavern','magpie_market','library']);
  assert.equal(byId.tavern.status,'owned');
  assert.equal(byId.tavern.coordinates.x,80.25);
  assert.equal(byId.tavern.coordinates.y,70.5);
  assert.equal(byId.tavern.coordinateSource,'ledger');
  assert.deepEqual(byId.tavern.ledger,{built:true,builtAt:'2026-09-01T10:00:00Z',x:80.25,y:70.5,movedAt:'2026-09-02T09:00:00Z'});
  assert.equal(byId.kitchen.owned,false,'built:false saved Kitchen remains unowned after migration');
  assert.deepEqual(byId.outdoors.occupants.map(bird=>bird.id),['free','recruiter','seller','bad-room']);
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='recruiter').displayReason,'nonresidential-room');
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='seller').savedRoom,'magpie_market');
  assert.equal(byId.outdoors.occupants.find(row=>row.id==='bad-room').displayReason,'unknown-room');
  assert.deepEqual(byId.library.occupants.map(bird=>bird.id),['reader']);
  assert.equal(byId.library.awayCount,1);
  assert.equal(byId.library.role.birdId,'reader');
  assert.equal(byId.library.role.staffed,true);
  assert.equal(model.awayOccupants[0].id,'away-reader');
  assert.deepEqual(model.excludedOccupants,[]);
  assert.deepEqual(model.unknownRecords.map(record=>record.id),['market']);
}

for(const malformed of [null,undefined,[],{outdoors:null,tavern:'yes',training:[],hospital:{built:true}}]) {
  const snapshot=freeze({academyBuilderVersion:8,academyBuildings:malformed,flock:[{id:'patient',academy:{room:'hospital'}}]});
  const model=Scan.projectAcademyRooms(snapshot,{catalog:Academy.getAcademyRooms()});
  const byId=names(model.rooms);
  assert.equal(byId.outdoors.owned,true);
  assert.equal(byId.tavern.owned,false);
  assert.equal(Array.isArray(model.buildableIds),true);
  assert(model.buildableIds.includes('tavern'));
  assert.doesNotThrow(()=>JSON.stringify(model));
}

console.log('PASS academy Home projection: canonical 13-room catalog, strict built ownership, safe Outdoors display fallback, migrated coordinates, malformed ledgers, unknown records, away exclusion and read-only inputs');
