'use strict';
// v497: neighbouring settlements never share ground, and a parked craft is
// solid to anyone on foot.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
const world=read('village_world.js'),craft=read('flight_craft.js');

test('a settlement whose footprint reaches another one is not built',()=>{
 const gap=world.match(/PLACE_GAP=(\d+)/)[1],line=world.slice(world.indexOf(' function crowded('),world.indexOf(' function shelterGround('));
 const places=new Map([['near',{x:400,z:0,content:{radius:60}}]]);
 const c={Math,PLACE_GAP:Number(gap),actualRadius:50,places};vm.createContext(c);vm.runInContext(line,c);
 assert.equal(c.crowded(120,0,60),'origin','overlaps the starting settlement');
 assert.equal(c.crowded(470,0,40),'near','overlaps a settlement already standing');
 assert.equal(c.crowded(800,0,60),null,'far apart is fine');
 // The check runs once the real radius is known, and a skipped neighbour
 // waits for its blocker to go before it is tried again.
 assert.match(world,/const crowd=row\.record\.kind==='home'\?null:crowded\(row\.p\.x,row\.p\.z,radius\);if\(crowd\)\{content\.dispose\(\);apart\.set\(row\.record\.id,crowd\);return;\}/);
 assert.match(world,/const blocker=apart\.get\(row\.record\.id\);if\(blocker&&\(blocker==='origin'\|\|places\.has\(blocker\)\)\)continue;/);
});

test('a parked craft blocks a walker but lets one already inside step out',()=>{
 const consts=craft.match(/const HULL=\{[^;]+;/)[0].replace('(BOW+STERN)/2','-.25'),body=craft.slice(craft.indexOf(' function depth('),craft.indexOf(' function save(){'));
 const c={Math,Infinity,record:{yaw:0},aboard:false,onDeck:false,closed:false,s:{room:null,player:{x:0,y:0,z:5,mode:'walk'}},local:()=>({x:0,y:0,z:0})};
 vm.createContext(c);vm.runInContext(consts+body,c);
 assert.equal(c.blocked(0,0),true,'the middle of the hull');
 assert.equal(c.blocked(.9,0),true,'beside the floats');
 assert.equal(c.blocked(0,-1.9),true,'the bow');
 assert.equal(c.blocked(1.3,0),false,'clear of the side');
 assert.equal(c.blocked(0,5),false,'well away');
 c.record.yaw=Math.PI/2;assert.equal(c.blocked(-1.9,0),true,'the footprint turns with the craft');assert.equal(c.blocked(0,-1.9),false);
 c.record.yaw=0;Object.assign(c.s.player,{x:0,z:-.5});
 assert.equal(c.blocked(0,-.9),false,'stepping outward from inside');
 assert.equal(c.blocked(0,-.2),true,'stepping deeper from inside');
 Object.assign(c.s.player,{x:0,z:5});
 c.aboard=true;assert.equal(c.blocked(0,0),false,'aboard, the pilot rides inside it');c.aboard=false;
 c.s.player.y=6;assert.equal(c.blocked(0,0),false,'far above the craft');c.s.player.y=0;
 assert.match(world,/function allowed\(x,z\)\{if\(campRuntime\?\.blocked\(x,null,z\)\|\|craftRuntime\?\.blocked\(x,z\)/);
});
