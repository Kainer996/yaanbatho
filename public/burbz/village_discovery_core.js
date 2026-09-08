/* Saved, seeded village discoveries. Transactions/presentation live in the adapters. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./village_discovery_content.js'):root.BurbzVillageDiscoveryContent);if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzVillageDiscoveryCore=api;})(globalThis,function(content){
'use strict';
const QUESTS=content.quests,LORE=content.lore;
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function rng(seed){let a=hash(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffled(values,random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const LOOT=[
 {label:'Coin pouch',reward:{coins:12}}, {label:'Branch bundle',reward:{branches:4}},
 {label:'Oak twigs',reward:{materials:{oak_twig:3}}}, {label:'Iron grit',reward:{materials:{iron_grit:2}}},
 {label:'River reeds',reward:{materials:{river_reed:3}}}, {label:'Thorn Talons',reward:{gear:{thorn_talons:1}}},
 {label:'Willow Wing-Wand',reward:{gear:{willow_wand:1}}}, {label:'Reed Vest',reward:{gear:{reed_vest:1}}},
 {label:'Tonic of Vigour',reward:{gear:{tonic_of_vigour:1}}}, {label:'Bronze Spurs',reward:{gear:{bronze_spurs:1}}}
];
function village(state,seed,entropy){
 if(!Number.isFinite(Number(seed)))throw Error('A village identity is needed.');
 let st=state.villageDiscoveries;
 if(!st||typeof st!=='object'||Array.isArray(st))st=state.villageDiscoveries={version:1,seed:hash(entropy||String(Date.now())),villages:{}};
 if(!st.villages||typeof st.villages!=='object'||Array.isArray(st.villages))st.villages={};
 const key=String(Number(seed));if(Object.hasOwn(st.villages,key))return st.villages[key];
 const ordinal=Object.keys(st.villages).length,cycle=Math.floor(ordinal/QUESTS.length);
 const deck=shuffled(QUESTS.map(q=>q.id),rng(st.seed+':deck:'+cycle));
 const used=new Set(Object.values(st.villages).filter(v=>Math.floor(v.ordinal/QUESTS.length)===cycle).map(v=>v.questId));
 const random=rng(st.seed+':village:'+key),loot=shuffled(LOOT,random).slice(0,3+Math.floor(random()*3));
 const lore=shuffled(LORE,random).slice(0,2).map(l=>l.id);
 const rec={ordinal,questId:deck.find(id=>!used.has(id))||deck[ordinal%50],accepted:false,step:0,completed:false,giver:'',loot:loot.map((l,i)=>({id:'loot'+i,...JSON.parse(JSON.stringify(l))})),lore,collected:[],read:[],placementSeed:hash(st.seed+':place:'+key)};
 st.villages[key]=rec;return rec;
}
function quest(rec){const q=QUESTS.find(q=>q.id===rec.questId);if(!q)throw Error('This village story is unavailable.');return q;}
function act(rec,type,id,giver){
 const q=quest(rec);
 if(type==='accept'&&!rec.accepted){rec.accepted=true;rec.giver=String(giver||'The village folk').slice(0,90);return {text:q.intro};}
 if(type==='step'&&rec.accepted&&!rec.completed&&Number(id)===rec.step&&rec.step<q.steps.length){const step=q.steps[rec.step++];return {text:step.done};}
 if(type==='finish'&&rec.accepted&&!rec.completed&&rec.step===q.steps.length){rec.completed=true;return {text:q.outro,reward:{coins:30,materials:{oak_twig:2}}};}
 if(type==='loot'&&!rec.collected.includes(id)){const loot=rec.loot.find(l=>l.id===id);if(loot){rec.collected.push(id);return{text:'Found '+loot.label+'.',reward:loot.reward};}}
 if(type==='lore'&&rec.lore.includes(id)){const lore=LORE.find(l=>l.id===id);if(!rec.read.includes(id))rec.read.push(id);return{text:lore.text,title:lore.title};}
 return null;
}
// Flood only walkable space connected to the real spawn. Every edge is sampled
// more finely than a player's radius, so pickups cannot land across walls/water.
function positions(world,spawn,seed,count){
 const step=.8,nodes=[{x:spawn.x,z:spawn.z}],seen=new Set(['0,0']),queue=[[0,0]],limit=Math.ceil(world.radius*2/step);
 function clear(a,b){for(let i=1;i<=8;i++)if(!world.allowed(a.x+(b.x-a.x)*i/8,a.z+(b.z-a.z)*i/8))return false;return true;}
 for(let head=0;head<queue.length&&nodes.length<15000;head++){
  const [ix,iz]=queue[head],a={x:spawn.x+ix*step,z:spawn.z+iz*step};
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=ix+dx,z=iz+dz,key=x+','+z;if(seen.has(key)||Math.abs(x)>limit||Math.abs(z)>limit)continue;seen.add(key);
   const b={x:spawn.x+x*step,z:spawn.z+z*step};if(!clear(a,b))continue;nodes.push(b);queue.push([x,z]);
  }
 }
 const candidates=shuffled(nodes,rng(seed)),chosen=[];
 // First point is the request post, just ahead of the spawn where possible.
 const near=nodes.filter(n=>Math.hypot(n.x-spawn.x,n.z-spawn.z)>=1.5).sort((a,b)=>Math.hypot(a.x-spawn.x,a.z-spawn.z)-Math.hypot(b.x-spawn.x,b.z-spawn.z));
 chosen.push(near[0]||nodes[0]);
 for(const gap of [3,1.5,.4])for(const node of candidates){if(chosen.length>=count)break;if(chosen.every(p=>Math.hypot(p.x-node.x,p.z-node.z)>=gap))chosen.push(node);}
 while(chosen.length<count)chosen.push(nodes[chosen.length%nodes.length]);
 return chosen.map(p=>({...p,y:world.height(p.x,p.z)}));
}
return {QUESTS,LORE,LOOT,hash,rng,village,quest,act,positions};
});
