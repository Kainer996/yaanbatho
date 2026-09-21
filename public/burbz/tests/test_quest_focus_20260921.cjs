'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'(');assert(start>=0,name);const end=html.indexOf('\nfunction ',start+1);return html.slice(start,end);}
const layers={},sources={};const shell={classList:{toggle:(name,on)=>{shell[name]=on;}}};
const ctx={questOverview:{on:true,selectedIndex:null,offers:[{name:'Recorded shape',routeSchemaVersion:1,points:[{lat:54,lon:-2},{lat:54.001,lon:-2.003},{lat:54.002,lon:-2.001},{lat:54,lon:-2}]}]},liveMap:{getSource:id=>sources[id],addSource:(id,s)=>sources[id]={...s,setData(d){this.data=d;}},addLayer:l=>layers[l.id]=l,on(){},getLayer:id=>layers[id],getLayoutProperty:(id,k)=>layers[id].layout?.[k],setLayoutProperty:(id,k,v)=>{(layers[id].layout||={})[k]=v;}},$:()=>shell,geographicDayNight:null,drawWalkingQuestRoute(){},liveMapHabitatLayers:[],console,questOverviewColor:()=> '#fff',questOfferDisplayPoints:o=>o.points};vm.createContext(ctx);
vm.runInContext(fn('syncQuestOverviewVisibility')+'\n'+fn('questOverviewGeoJSON')+'\n'+fn('drawQuestOverviewLines')+'\n'+fn('ensureBurbzMapSources'),ctx);vm.runInContext('ensureBurbzMapSources()',ctx);
assert(layers['burbz-quest-offers-line'].paint['line-opacity'].at(-1)>=.7,'unselected routes must be visible immediately');
assert.deepEqual(JSON.parse(JSON.stringify(sources['burbz-quest-offers'].data.features[0].geometry.coordinates)),ctx.questOverview.offers[0].points.map(p=>[p.lon,p.lat]));
vm.runInContext(fn('syncQuestOverviewVisibility'),ctx);vm.runInContext('syncQuestOverviewVisibility()',ctx);
assert.equal(shell['quest-overview'],true);assert.equal(layers['burbz-habitat-zones-fill'].layout.visibility,'none');
ctx.questOverview.on=false;vm.runInContext('syncQuestOverviewVisibility();drawQuestOverviewLines()',ctx);assert.equal(shell['quest-overview'],false);assert.equal(layers['burbz-habitat-zones-fill'].layout.visibility,'visible');assert.equal(sources['burbz-quest-offers'].data.features.length,0);
assert.match(fn('showAllLocalQuests'),/if \(questOverview.on\)/,'button must toggle off');
for(const cls of ['burbz-pickup-marker','burbz-village-marker','geographic-place-marker','burbz-map-bird-chip','camp-marker'])assert(html.includes('#liveMapShell.quest-overview .'+cls),cls+' hidden');
console.log('PASS visible complete geometry, clutter gating, restoration and toggle contracts');
