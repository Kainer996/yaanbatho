'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),html=fs.readFileSync(require.resolve('../index.html'),'utf8');const a=html.indexOf('function scanHomeDeskSnapshot('),b=html.indexOf('\nfunction renderScanHome',a);
const ctx={console,Date:{now:()=>500},GEAR_ART_ROOT:'/',EMPIRE_BUILDING_INDEX:{cabin:{name:'Cabin'},quarry:{name:'Quarry'},well:{name:'Well'}},lootCore:()=>({GEAR_SLOTS:[],gearById:()=>null}),kitchenRosterEntries:()=>[],empireSettlementOfSeed:()=>null,rolePostState:()=>({bird:null}),empirePostTitleFor:()=> 'Project Manager'};
ctx.gameState={
  "flock": [],
  "inventory": {},
  "completionNotices": [
    {
      "id": "ready",
      "kind": "empire-building",
      "target": {
        "seed": 7,
        "wardSeed": 7,
        "readyToOpen": true
      }
    },
    {
      "id": "checked-later",
      "kind": "empire-building",
      "title": "Well opened",
      "target": {
        "seed": 7,
        "wardSeed": 7
      }
    }
  ],
  "empire": {
    "villages": {
      "7": {
        "seed": 7,
        "name": "Willow",
        "economy": {
          "constructions": [
            {
              "id": "well",
              "startMs": 100,
              "endMs": 1000
            }
          ],
          "readyToOpen": {
            "cabin": {
              "id": "cabin",
              "startMs": 100,
              "endMs": 200,
              "readyToOpenAt": 201
            }
          }
        }
      }
    },
    "towns": {
      "seat-7": {
        "hallConstruction": {
          "readyToOpenAt": 201
        }
      }
    },
    "wholesaleWorks": {
      "order": {
        "endMs": 300,
        "plan": [
          {
            "seed": 7,
            "buildingId": "quarry",
            "toLevel": 1
          },
          {
            "seed": 7,
            "buildingId": "cabin",
            "toLevel": 2
          }
        ]
      }
    }
  }
};
ctx.empireVillages=()=>Object.values(ctx.gameState.empire.villages);vm.createContext(ctx);vm.runInContext(html.slice(a,b),ctx);const before=JSON.stringify(ctx.gameState);const result=ctx.scanHomeDeskSnapshot();assert.equal(JSON.stringify(ctx.gameState),before);assert.equal(result.completed.length,1);assert.equal(result.completed[0].id,'checked-later');assert.equal(result.villageDesk[0].waiting,3);assert.equal(result.villageDesk[0].underway,1);assert.equal(result.villageDesk[0].finished,1);assert.deepEqual(Array.from(result.villageDesk[0].pendingNames),['Cabin','Quarry','Civic Hall']);console.log('PASS Home distinguishes ready village, bulk and Hall projects from operating completion notices without changing the save');

ctx.gameState.completionNotices.push({id:'bulk-opened',kind:'wholesale-upgrade',title:'Order opened',target:{seed:99,wardSeeds:[7,8]}});const unchanged=JSON.stringify(ctx.gameState),withOrder=ctx.scanHomeDeskSnapshot();assert.equal(withOrder.completed.length,2);assert.equal(withOrder.villageDesk[0].finished,2);assert.equal(JSON.stringify(ctx.gameState),unchanged);console.log('PASS A completed bulk order appears in the unchecked tray and every affected village row');
