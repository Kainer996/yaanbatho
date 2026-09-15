'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),O=require('../open_land_core.js');
const f=(subclass,extra={})=>({sourceLayer:'landcover',geometry:{type:'Polygon'},properties:{class:'grass',subclass,...extra}});
test('only explicit mapped grassland/meadow and heath/fell become open land',()=>{
 for(const sub of ['grass','grassland','meadow'])assert.equal(O.kind(f(sub)),'grassland');
 for(const sub of ['heath','fell'])assert.equal(O.kind(f(sub)),'heath');
 for(const sub of [undefined,'park','scrub','garden','golf_course','farmland'])assert.equal(O.kind(f(sub)),null);
 assert.equal(O.kind(f('grassland',{class:'wood'})),null);assert.equal(O.kind({...f('grassland'),geometry:{type:'LineString'}}),null);
});
test('tree thinning is deterministic, strongest inside the mapped polygon and absent outside',()=>{
 const at=(x,z)=>x>=0&&x<=40&&z>=0&&z<=40?'grassland':null,inside=O.sample(20,20,at),edge=O.sample(0,20,at),outside=O.sample(-1,20,at);
 assert.equal(inside.weight,1);assert(edge.weight<inside.weight);assert.equal(outside.weight,0);
 const kept=l=>Array.from({length:1000},(_,i)=>O.keepTree(i/1000,l)).filter(Boolean).length;
 assert.equal(kept(inside),60);assert(kept(edge)>kept(inside));assert.equal(kept(outside),1000);
 assert.deepEqual(O.tint([.8,.8,.8],outside),[.8,.8,.8]);assert.notDeepEqual(O.tint([.8,.8,.8],inside),O.tint([.8,.8,.8],{kind:'heath',weight:1}));
});
