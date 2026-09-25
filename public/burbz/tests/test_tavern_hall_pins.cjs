'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js'),home=read('player_home.js');
const tag='tavern-hall-open-v450-20260923';
const current=html.match(/const BURBZ_BUILD = '([^']+)'/)[1];
assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].endsWith(current),'current document and worker build agree');
// settlement_models.js moved to village-folk-v472; test_village_folk_v472.cjs pins it.
for(const name of ['building_interior_core.js','building_rooms_core.js','player_home.js','village_walk.js']){
 const url=name+'?v='+tag;
 assert.equal(sw.split('./'+url).length-1,3,name+' has exact pin in each worker list');
 if(name!=='building_rooms_core.js')assert(html.includes(url),name+' consuming URL');
 const versions=[...sw.matchAll(new RegExp(name.replaceAll('.','\\.')+'\\?v=([^\'"\\s]+)','g'))].map(m=>m[1]);
 assert(versions.every(v=>v===tag),name+' has no stale worker pin');
}
assert(walk.includes("'building_rooms_core.js':'"+tag+"'"),'village lazy loader');
assert(home.includes("['building_rooms_core.js','BurbzBuildingRoomsCore','"+tag+"']"),'home lazy loader');
assert(html.includes('scan_home.js?v=dashboard-banners-v443-20260922'));
assert(html.includes('scan_home.css?v=quest-pulse-v442-20260922'));
assert.equal(sw.split('./scan_home.css?v=quest-pulse-v442-20260922').length-1,3,'quest pulse CSS retained in every worker list');
assert(html.includes('<span class="desk-current-label">Quests</span>'));
console.log('PASS five runtime pins, both lazy loaders, three worker lists, current-build parity, retained dashboard v443 and quest pulse v442');
