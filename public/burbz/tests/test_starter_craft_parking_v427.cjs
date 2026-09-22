'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const C=require('../flight_craft_core.js'),G=require('../geographic_world_core.js'),text=fs.readFileSync(path.join(__dirname,'../flight_craft.js'),'utf8');
const provision=text.slice(text.indexOf(' function provision(){'),text.indexOf(' function initialize(){'));
const home={lat:54.45,lon:-2.65},pose=(x,z)=>({...G.unproject(home,{x,y:120,z}),altitude:120,yaw:0,pitch:0,mode:'walk'});
function run({record=null,intro=true,ok=true,known=true}={}){
 const c={record,C,G,homeBerthPending:false,closed:false,aboard:false,onDeck:false,writes:[],opts:{getHome:()=>({anchor:home}),craft:{shelterIntro:()=>intro}},env:{local:p=>G.project(home,p),geo:p=>G.unproject(home,p),sample:()=>known?{height:120,kind:'ground'}:null,parkingClear:()=>true,clear:()=>true}};
 c.local=()=>c.record&&c.env.local(c.record);c.commit=n=>{c.writes.push(n);if(ok)c.record=n;return ok;};vm.createContext(c);vm.runInContext(provision+'result=provision();',c);return c;
}
test('new and obstructing tutorial craft park left of the actual home doorway',()=>{
 for(const record of [null,C.at(pose(0,8))]){const c=run({record});assert(c.result);assert.equal(c.writes.length,1);const p=G.project(home,c.record);assert(p.x>7.99);assert(p.z>4.99&&p.z<5.01);}
});
test('existing travelled, occupied and completed-player craft are never relocated',()=>{
 for(const [record,intro]of [[C.at(pose(0,8)),false],[C.at(pose(0,8),'boarded'),true],[C.at(pose(0,8),'flying'),true],[C.at(pose(0,8),'deck'),true],[C.at(pose(10,10)),true],[C.at(pose(0,40)),true]]){const c=run({record,intro});assert.equal(c.record,record);assert.equal(c.writes.length,0);}
});
test('unknown terrain or failed durable write keeps the original starter parking record',()=>{
 const record=C.at(pose(0,8));for(const params of [{known:false},{ok:false}]){const c=run({record,...params});assert.equal(c.result,false);assert.equal(c.record,record);}
});
