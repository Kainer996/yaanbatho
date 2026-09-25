'use strict';
// Smooth sky, plain plot v485: the clouds show no straight seams, and the
// shelter or house plot has no ring of trees round it.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const BUILD='smooth-sky-plain-plot-v485-20260925';

test('the cloud shader has no seams',()=>{
 const sky=read('world_sky.js'),clouds=sky.slice(sky.indexOf('const CLOUDS='),sky.indexOf('function attach('));
 assert(clouds.includes('vec3 dir=normalize(vDir)'),'direction is normalised per pixel, so dome triangles never show');
 assert(!clouds.includes('vDir.xz'),'clouds are placed from the per-pixel direction');
 assert(!/sin\(dot\(p/.test(clouds),'the cloud hash does not rely on sin()');
 assert(clouds.includes('f*f*f*(f*(f*6.-15.)+10.)'),'quintic blend hides the lattice');
});

test('the plot has no trees round it',()=>{
 const C=require('../player_home_core.js');
 assert.equal(C.visibleTrees(C.initial()).length,0);
 assert.equal(C.visibleTrees({...C.initial(),tier:1}).length,0);
 assert(!read('player_home.js').includes('C.TREES'),'no hidden tree can still be chopped');
});

test('v485 ships together: build marker, cache, worker lists and loader',()=>{
 const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js');
 const shipped=[BUILD,'village-folk-v486-20260925'],cache=sw.match(/const BURBZ_CACHE = '([^']+)'/)[1];
 assert(shipped.some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));
 assert(cache.includes('-'+BUILD)&&shipped.some(b=>cache.endsWith('-'+b)));
 for(const file of ['world_sky.js','village_walk.js','player_home_core.js','player_home.js'])assert.equal(sw.split("'./"+file+'?v='+BUILD+"'").length-1,3,file+' in all three worker lists');
 assert(walk.includes("'world_sky.js':'"+BUILD+"'"));
 for(const file of ['village_walk.js','player_home_core.js','player_home.js'])assert(html.includes(file+'?v='+BUILD),file);
});
