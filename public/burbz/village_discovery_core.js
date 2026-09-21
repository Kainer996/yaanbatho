/* Saved, seeded village discoveries. Transactions/presentation live in the adapters. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./village_discovery_content.js'):root.BurbzVillageDiscoveryContent);if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzVillageDiscoveryCore=api;})(globalThis,function(content){
'use strict';
	 const QUESTS=content.quests,LORE=content.lore,ACTIVITIES=content.activities,REQUEST_REWARD={coins:30,materials:{oak_twig:2}};
 function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
 function rng(seed){let a=hash(seed);return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
 function shuffled(values,random){const a=values.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function positive(value){const n=Number(value);return Number.isFinite(n)&&n>0;}
	 function rewardHasGrantableLoot(reward,catalogue){
  if(!reward||typeof reward!=='object'||Array.isArray(reward))return false;
  if(positive(reward.coins)||positive(reward.branches))return true;
  const materials=reward.materials&&typeof reward.materials==='object'&&!Array.isArray(reward.materials)?reward.materials:{};
  const gear=reward.gear&&typeof reward.gear==='object'&&!Array.isArray(reward.gear)?reward.gear:{};
  for(const [id,count] of Object.entries(materials))if(positive(count)&&(!catalogue?.materialById||catalogue.materialById(id)))return true;
  for(const [id,count] of Object.entries(gear))if(positive(count)&&(!catalogue?.gearById||catalogue.gearById(id)))return true;
	  return false;
	 }
	function titleCase(text){return String(text||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
	function rewardSummary(reward=REQUEST_REWARD){
	 const bits=[];if(positive(reward.coins))bits.push(Number(reward.coins)+' coins');if(positive(reward.branches))bits.push(Number(reward.branches)+' branches');
	 for(const [id,count]of Object.entries(reward.materials||{}))if(positive(count))bits.push(Number(count)+' '+titleCase(id)+(Number(count)===1?'':'s'));
	 for(const [id,count]of Object.entries(reward.gear||{}))if(positive(count))bits.push(Number(count)+' '+titleCase(id)+' equipment');
	 return bits.join(' and ');
	}
	function questWorkSummary(q){return q.steps.map((step,i)=>(i+1)+'. '+step.label).join('\n');}
	function questOfferText(q,reward=REQUEST_REWARD){
	 return q.intro+'\n\nNeed: help the village finish '+q.steps.length+' practical jobs in order.\nWork:\n'+questWorkSummary(q)+'\n\nReward: '+rewardSummary(reward)+'.\nAccept only here at a resident or the request post. The journal can guide you back, but it cannot accept or finish for you.';
	}
	function questObjectiveText(q,rec){
	 if(rec.completed)return 'Completed. The village request is recorded in your journal.';
	 if(!rec.accepted)return 'Start at a villager or the request post, then accept the request in person.';
	 if(rec.step<q.steps.length)return 'Current task: '+q.steps[rec.step].label+'. Follow the blue marker and use the nearby action when you reach it.';
	 return 'All tasks are done. Return to a villager or the request post for '+rewardSummary(REQUEST_REWARD)+'.';
	}
	function questStepDoneText(q,rec,doneText){
	 if(rec.step<q.steps.length)return doneText+'\n\nNext: '+q.steps[rec.step].label+'. Follow the blue marker to the next object.';
	 return doneText+'\n\nAll request steps are complete. Return to a resident or the request post for '+rewardSummary(REQUEST_REWARD)+'.';
	}
	function fieldworkObjectiveText(story,step){
	 if(step>=story.steps.length)return 'Completed. '+story.outro;
	 const node=story.steps[step];
	 return 'Current fieldwork: '+node.label+'. Follow this story marker, read the clue, then choose only what the clue supports.';
	}
	function editorialInventory(){
	 return {
	  requestIds:QUESTS.map(q=>q.id),
	  loreIds:LORE.map(l=>l.id),
	  requests:QUESTS.map(q=>({id:q.id,title:q.title,stageCount:q.steps.length,offer:questOfferText(q),objectives:q.steps.map((step,i)=>({stage:i,label:step.label,guidance:'Current task: '+step.label+'. Follow the blue marker and use the nearby action when you reach it.',done:step.done,next:i+1<q.steps.length?q.steps[i+1].label:'Return to a villager or request post'})),completion:'Return to a villager or request post for '+rewardSummary(REQUEST_REWARD)+'.'})),
	  fieldwork:ACTIVITIES.filter(a=>/^vf(0[1-9]|1[0-2])$/.test(a.id)).map(a=>({id:a.id,title:a.title,stageCount:a.steps.length,objectives:a.steps.map((step,i)=>({stage:i,label:step.label,guidance:fieldworkObjectiveText(a,i),done:step.done||step.text,next:i+1<a.steps.length?a.steps[i+1].label:'Recorded in the field journal'})),completion:a.outro,reward:rewardSummary(a.reward)}))
	 };
	}
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
// Derived assignments never mutate a legacy save just by opening its journal.
// The fixed v1 pool is append-safe: later story packs cannot reroll these sites.
function activities(rec){
 const deck=shuffled(ACTIVITIES.filter(a=>/^vf(0[1-9]|1[0-2])$/.test(a.id)),rng(rec.placementSeed+':fieldwork:v1')).slice(0,3);
 return deck.map(story=>{const raw=rec.fieldwork?.[story.id]?.step;const step=Number.isInteger(raw)?Math.max(0,Math.min(story.steps.length,raw)):0;
  return {story,step,completed:step===story.steps.length};});
}
function activityAct(rec,id,choice){
 const parts=String(id).split(':');if(parts.length!==2||!/^\d+$/.test(parts[1]))return null;
 const a=activities(rec).find(a=>a.story.id===parts[0]);if(!a||a.completed||Number(parts[1])!==a.step)return null;
 const node=a.story.steps[a.step];
 if(node.choices){if(!node.choices.some(c=>c[0]===choice))return null;
  if(choice!==node.answer)return {title:a.story.title,text:node.wrong,tryAgain:true};}
 if(!rec.fieldwork||typeof rec.fieldwork!=='object'||Array.isArray(rec.fieldwork))rec.fieldwork={};
 rec.fieldwork[a.story.id]={step:a.step+1};
 const done=a.step+1===a.story.steps.length;
 return {title:a.story.title,text:done?a.story.outro:node.done,reward:done?JSON.parse(JSON.stringify(a.story.reward)):undefined,activity:a.story.id,completed:done};
}
function act(rec,type,id,giver){
 if(type==='activity')return activityAct(rec,id,giver);
 const q=quest(rec);
 if(type==='accept'&&!rec.accepted){rec.accepted=true;rec.giver=String(giver||'The village folk').slice(0,90);return {text:q.intro};}
 if(type==='step'&&rec.accepted&&!rec.completed&&Number(id)===rec.step&&rec.step<q.steps.length){const step=q.steps[rec.step++];return {text:step.done};}
	 if(type==='finish'&&rec.accepted&&!rec.completed&&rec.step===q.steps.length){rec.completed=true;return {text:q.outro,reward:JSON.parse(JSON.stringify(REQUEST_REWARD))};}
 if(type==='loot'&&!rec.collected.includes(id)){const loot=rec.loot.find(l=>l.id===id);if(loot){rec.collected.push(id);return{text:'Found '+loot.label+'.',reward:loot.reward};}}
 if(type==='lore'&&rec.lore.includes(id)){const lore=LORE.find(l=>l.id===id);if(!rec.read.includes(id))rec.read.push(id);return{text:lore.text,title:lore.title};}
 return null;
}
// Flood only walkable space connected to the real spawn. Every edge is sampled
// more finely than a player's radius, so pickups cannot land across walls/water.
function* positionSteps(world,spawn,seed,count){
 const step=.8,nodes=[{x:spawn.x,z:spawn.z}],seen=new Set(['0,0']),queue=[[0,0]],limit=Math.ceil(world.radius*2/step);
 function clear(a,b){for(let i=1;i<=8;i++)if(!world.allowed(a.x+(b.x-a.x)*i/8,a.z+(b.z-a.z)*i/8))return false;return true;}
 for(let head=0;head<queue.length&&nodes.length<15000;head++){
  if(head%16===0)yield;
  const [ix,iz]=queue[head],a={x:spawn.x+ix*step,z:spawn.z+iz*step};
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const x=ix+dx,z=iz+dz,key=x+','+z;if(seen.has(key)||Math.abs(x)>limit||Math.abs(z)>limit)continue;seen.add(key);
   const b={x:spawn.x+x*step,z:spawn.z+z*step};if(!clear(a,b))continue;nodes.push(b);queue.push([x,z]);
  }
 }
 const candidates=shuffled(nodes,rng(seed)),chosen=[];
 // First point is the request post, just ahead of the spawn where possible.
 let nearest=nodes[0],best=Infinity;
 for(const node of nodes){const distance=Math.hypot(node.x-spawn.x,node.z-spawn.z);if(distance>=1.5&&distance<best){nearest=node;best=distance;}}
 chosen.push(nearest);
 for(const gap of [3,1.5,.4])for(const node of candidates){if(chosen.length>=count)break;if(chosen.every(p=>Math.hypot(p.x-node.x,p.z-node.z)>=gap))chosen.push(node);}
 while(chosen.length<count)chosen.push(nodes[chosen.length%nodes.length]);
 return chosen.map(p=>({...p,y:world.height(p.x,p.z)}));
}
function positions(...args){const steps=positionSteps(...args);let r;do{r=steps.next();}while(!r.done);return r.value;}
	 return {QUESTS,LORE,ACTIVITIES,LOOT,REQUEST_REWARD,hash,rng,rewardHasGrantableLoot,rewardSummary,questOfferText,questObjectiveText,questStepDoneText,fieldworkObjectiveText,editorialInventory,village,quest,activities,act,positions,positionSteps};
 });
