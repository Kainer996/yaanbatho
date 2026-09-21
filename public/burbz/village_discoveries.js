/* Saved requests and geometric field discoveries; one borrowed renderer. */
(function(root){'use strict';
const ART='assets/discoveries-v385/alderwing-objects.webp';
// Bounds follow the painted atlas for dialog illustrations only.
const CELLS=[[16,4,291,321],[327,55,299,251],[657,70,285,233],[959,54,288,245],
 [53,325,261,320],[404,307,172,328],[707,308,171,338],[961,327,260,301],
 [28,653,282,249],[325,630,326,297],[679,659,252,260],[946,646,306,258],
 [29,900,265,346],[325,928,336,293],[670,928,239,276],[959,967,286,230]];
function attach(s,options={}){
 const T=root.THREE,core=root.BurbzVillageDiscoveryCore,api=options.api||s.options.discoveries;
 const frame=options.frame||{x:0,y:0,z:0},world=options.world||s.world,player=()=>({...s.player,x:s.player.x-frame.x,y:s.player.y-(frame.y||0),z:s.player.z-frame.z});
 if(!api)return {update(){},dispose(){},closePanel(){return false;},hud(){return null;}};
 api.prepare();
 const get=()=>api.record(),q=()=>core.quest(get()),group=new T.Group();(options.scene||s.source.scene).add(group);
 const lifetime=new AbortController(),abort=lifetime.signal,abortFromHost=()=>lifetime.abort();s.abort.signal.addEventListener('abort',abortFromHost,{once:true});
 const geos=[],mats=[],objects=[];let disposed=false,artReady=true,paused=false;
 const post=document.createElement('div');post.className='vd-hud';post.innerHTML='<button class="vd-journal" type="button">Journal</button><div class="vd-guide" aria-live="polite"></div><button class="vd-interact" type="button" hidden></button>';
	 const panel=document.createElement('section');panel.className='vd-panel';panel.hidden=true;panel.tabIndex=-1;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','vd-panel-title');
 panel.innerHTML='<button class="vd-close" type="button">← Keep walking</button><div class="vd-body"></div>';
 s.root.append(post,panel);
 const journalButton=post.querySelector('.vd-journal'),guide=post.querySelector('.vd-guide'),interact=post.querySelector('.vd-interact'),body=panel.querySelector('.vd-body');let nearest=null,last=0,focusBefore=null,tracked=null,hudState=null;
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort});
	 function rewardLine(reward){if(!reward)return'';const text=api.rewardText?.(reward)||core.rewardSummary?.(reward)||'';return text?'\n\nReward: '+text+'.':'';}
	 function closePanel(focus=true){if(panel.hidden)return false;panel.hidden=true;s.uiBusy=false;s.reset();if(focus){const target=focusBefore?.isConnected?focusBefore:interact.hidden?journalButton:interact;target?.focus({preventScroll:true});}return true;}
 function setPaused(value){if(disposed)return;paused=!!value;post.hidden=paused;if(paused){closePanel(false);nearest=null;interact.hidden=true;guide.textContent='';return;}update(performance.now()/1000,true);}
 function show(title,text,buttons=[],art){
  focusBefore=panel.hidden?document.activeElement:focusBefore;s.reset();s.uiBusy=true;panel.hidden=false;body.replaceChildren();panel.scrollTop=0;
  if(Number.isInteger(art)){const figure=document.createElement('div');figure.className='vd-illustration';figure.setAttribute('aria-hidden','true');const [x,y,w,h]=CELLS[art];figure.style.cssText='width:104px;height:'+Math.round(104*h/w)+'px;background-image:url("'+ART+'");background-size:'+1254/w*104+'px '+1254/w*104+'px;background-position:-'+x/w*104+'px -'+y/w*104+'px';body.append(figure);}
	  const h=document.createElement('h2');h.id='vd-panel-title';h.textContent=title;body.append(h);const p=document.createElement('p');p.textContent=text;body.append(p);
  for(const [label,action] of buttons){const b=document.createElement('button');b.type='button';b.textContent=label;on(b,'click',action);body.append(b);}
  panel.querySelector('.vd-close').focus({preventScroll:true});
 }
	 function commit(type,id,giver){try{const result=api.act(type,id,giver);if(result){
	   const r=get(),story=q();let text=result.text,more=[],art=type==='loot'?1:type==='lore'?2:result.activity?core.ACTIVITIES.find(a=>a.id===result.activity)?.art:undefined;
	   if(type==='accept'){text='Accepted here at '+(r.giver||'the request post')+'.\n\nStart: '+story.steps[0].label+'. Follow the blue marker and use the nearby action when you reach it.';more=[['Follow the first marker',()=>{tracked=null;closePanel();update(performance.now()/1000,true);}]];}
	   else if(type==='step'){text=core.questStepDoneText(story,r,result.text);more=[[r.step<story.steps.length?'Follow the next marker':'Return for thanks',()=>{tracked=null;closePanel();update(performance.now()/1000,true);}]];}
	   else if(type==='finish'){text=result.text+'\n\nRequest complete. The reward is saved and cannot be claimed again.';}
	   else if(result.tryAgain)more=[['Look at the clues again',()=>activity(id)]];
	   else if(result.activity&&!result.completed){const a=core.activities(r).find(a=>a.story.id===result.activity);text=result.text+'\n\n'+(a?core.fieldworkObjectiveText(a.story,a.step):'Follow the next fieldwork marker.');more=[['Follow the next clue',()=>{tracked=result.activity;closePanel();update(performance.now()/1000,true);}]];}
	   else if(result.activity&&result.completed){text=result.text+'\n\nFieldwork complete. It is recorded in your journal.';}
	   show(result.title||(type==='loot'?'In your bag':story.title),text+rewardLine(result.reward),more,art);
	  }update(performance.now()/1000,true);}catch(e){show('Progress could not save','Nothing changed in this save. Stay here and try the same action again when storage is ready. '+e.message,[['Try again',()=>commit(type,id,giver)]]);update(performance.now()/1000,true);}}
 function activity(id){
  const [key,n]=String(id).split(':'),a=core.activities(get()).find(a=>a.story.id===key);if(!a)return;const node=a.story.steps[Number(n)];if(!node)return;
  if(a.completed){show(a.story.memory,a.story.outro,[],a.story.art);return;}
  const notes=a.story.steps.slice(0,a.step).map(x=>x.text).join('\n\n');
  if(Number(n)!==a.step){show(a.story.title,node.text+'\n\n'+(Number(n)<a.step?'Recorded in your journal.':'First: '+a.story.steps[a.step].label),[['Follow this story',()=>{tracked=key;closePanel();update(performance.now()/1000,true);}]],node.art);return;}
  const buttons=node.choices?node.choices.map(([choice,label])=>[label,()=>commit('activity',key+':'+a.step,choice)]):[[node.label,()=>commit('activity',key+':'+a.step)]];
	  show(a.story.title+' · '+(a.step+1)+' / '+a.story.steps.length,node.text+'\n\n'+core.fieldworkObjectiveText(a.story,a.step)+(node.choices&&notes?'\n\nYour field notes\n'+notes:''),buttons,node.art);
 }
	 function journal(){const r=get(),story=q(),sites=core.activities(r),status=core.questObjectiveText(story,r);
	  const trackRequest=()=>{tracked=null;request(null,true);update(performance.now()/1000,true);};
	  show('Field journal','Request: '+story.title+'\n'+status+'\n\nFieldwork: '+sites.filter(a=>a.completed).length+'/'+sites.length+' restored · Lore: '+r.read.length+'/'+r.lore.length+' scrolls · Loot: '+r.collected.length+'/'+r.loot.length+' chests.\n\nChoose a request, fieldwork clue or lore entry below.',
	   [[r.completed?'Track the request post':'Track the villagers’ request',trackRequest],...sites.map(a=>[(a.completed?'✓ ':a.step?'Continue: ':'Discover: ')+a.story.title+' · '+a.step+'/'+a.story.steps.length,()=>show(a.story.title,a.completed?a.story.outro:a.story.steps[a.step].label+'\n\n'+(a.step?a.story.steps.slice(0,a.step).map(n=>n.text).join('\n\n'):'Three linked objects keep this local story. Find the first clue; each step stays saved when you leave.'),a.completed?[]:[['Follow this story',()=>{tracked=a.story.id;closePanel();update(performance.now()/1000,true);}]],a.story.art)]),...r.read.map(id=>{const l=core.LORE.find(l=>l.id===id);return[l.title,()=>show(l.title,l.text,[],2)];})],13);
	 }
 on(panel.querySelector('.vd-close'),'click',closePanel);on(journalButton,'click',journal);
	 function request(giver,remote=false){const r=get(),story=q(),speaker=giver||r.giver||'The village folk';if(r.completed){show(story.title,speaker+': '+story.outro+'\n\nCompleted requests stay in the journal; the 30 coins and 2 Oak Twigs have already been saved.',[],0);return;}
	  if(!r.accepted){show(giver||'Villagers’ request post',core.questOfferText(story,core.REQUEST_REWARD)+(remote?'\n\nTrack this request, then accept it in person at the post or a nearby resident.':''),remote?[['Not now',closePanel]]:[['I’ll help',()=>commit('accept',null,giver)],['Not now',closePanel]],0);return;}
	  if(remote&&r.step===story.steps.length){show(story.title,core.questObjectiveText(story,r)+'\n\nThe journal cannot finish this request. Return to the reachable resident or request post for your thanks.',[['Not now',closePanel]],0);return;}
	  if(r.step===story.steps.length){show(speaker+' · '+story.title,'Everything is ready. Finish here, at the reachable request source, to receive 30 coins and 2 Oak Twigs once.',[['Finish quest',()=>commit('finish')]],0);return;}
	  show(speaker+' · '+story.title,core.questObjectiveText(story,r)+'\n\n'+story.steps.map((step,i)=>(i<r.step?'✓ ':i===r.step?'Next: ':'Later: ')+step.label).join('\n'),[['Follow the request',()=>{tracked=null;closePanel();update(performance.now()/1000,true);}]],0);
	 }
 function use(){if(paused||!nearest||s.player.mode==='fly'||s.uiBusy||s.failed)return;const o=nearest;if(o.kind==='board'||o.kind==='resident')request(o.name);else if(o.kind==='activity')activity(o.id);else commit(o.kind,o.id);}
 on(interact,'click',use);
 const r=get(),sites=core.activities(r),points=options.points||core.positions(world,world.spawn(),r.placementSeed,1+r.loot.length+r.lore.length+q().steps.length+sites.reduce((n,a)=>n+a.story.steps.length,0));let point=0;
 function material(color,extra={}){const m=new T.MeshLambertMaterial({color,...extra});root.BurbzManga?.styleMaterial(m);mats.push(m);return m;}
 const COLOR={wood:0x6f513e,dark:0x3b2f2a,brass:0xc6b36f,paper:0xeadfc6,cool:0x6bc9df,stone:0x71818a,leaf:0x6f9f86,cloth:0x8e6f7c};
 const glowMat=new T.MeshBasicMaterial({color:0x78e8ff,transparent:true,opacity:.68,side:T.DoubleSide,depthWrite:false});mats.push(glowMat);
 function mesh(parent,geo,mat,x,y,z,scale){geos.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);if(scale)m.scale.set(scale.x,scale.y,scale.z);parent.add(m);return m;}
 function piece(geo,color,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1]){return{geo,color,pos,rot,scale};}
 function solid(parent,type,pieces){
  const positions=[],normals=[],colors=[];
  for(const p of pieces){const g=p.geo.index?p.geo.toNonIndexed():p.geo.clone();
   g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p.pos),new T.Quaternion().setFromEuler(new T.Euler(...p.rot)),new T.Vector3(...p.scale)));
   const c=new T.Color(p.color),a=g.attributes.position.array,n=g.attributes.normal?.array;
   for(let i=0;i<a.length;i+=3){positions.push(a[i],a[i+1],a[i+2]);if(n)normals.push(n[i],n[i+1],n[i+2]);colors.push(c.r,c.g,c.b);}
   g.dispose();p.geo.dispose();
  }
  const geo=new T.BufferGeometry();geo.type=type;geo.setAttribute('position',new T.BufferAttribute(new Float32Array(positions),3));geo.setAttribute('color',new T.BufferAttribute(new Float32Array(colors),3));if(normals.length===positions.length)geo.setAttribute('normal',new T.BufferAttribute(new Float32Array(normals),3));else geo.computeVertexNormals();
  const mat=new T.MeshLambertMaterial({vertexColors:true});root.BurbzManga?.styleMaterial(mat);geos.push(geo);mats.push(mat);const m=new T.Mesh(geo,mat);parent.add(m);return m;
 }
 const box=(w,h,d,x,y,z,c,rot=[0,0,0])=>piece(new T.BoxGeometry(w,h,d),c,[x,y,z],rot);
 const cyl=(r1,r2,h,x,y,z,c,rot=[0,0,0],seg=10)=>piece(new T.CylinderGeometry(r1,r2,h,seg),c,[x,y,z],rot);
 const sph=(r,x,y,z,c,scale=[1,1,1])=>piece(new T.SphereGeometry(r,10,8),c,[x,y,z],[0,0,0],scale);
 const cone=(r,h,seg,x,y,z,c,rot=[0,0,0])=>piece(new T.ConeGeometry(r,h,seg),c,[x,y,z],rot);
 function stepArt(label){const t=label.toLowerCase();return /bell|clapper|music|tune/.test(t)?4:/lantern|light|wick/.test(t)?5:/ribbon|button|sew|cape|cloth/.test(t)?10:/stone|chalk|carv/.test(t)?7:/seed|plant|garden|flower/.test(t)?9:/wheel|repair|mend|pin|tool/.test(t)?11:/map|sketch|picture|card/.test(t)?13:/letter|note|apology|paper/.test(t)?2:/pebble|bowl|cup|game/.test(t)?15:/sign|path|post/.test(t)?12:3;}
 function chest(parent,variant){
  const parts=[];
  if(variant===0){
   parts.push(solid(parent,'AlderwingChestBody0Geometry',[box(.46,.24,.32,0,.18,0,COLOR.wood)]));const lid=new T.Group();lid.position.y=.35;parent.add(lid);solid(lid,'AlderwingChestLid0Geometry',[box(.48,.10,.34,0,0,0,COLOR.brass)]);parts.push(lid);
  }else if(variant===1){
   parts.push(solid(parent,'AlderwingChestBody1Geometry',[cyl(.18,.18,.52,0,.24,0,COLOR.dark,[0,0,Math.PI/2],12)]));const lid=new T.Group();lid.position.y=.25;parent.add(lid);solid(lid,'AlderwingChestLid1Geometry',[box(.08,.40,.36,0,0,0,COLOR.brass)]);parts.push(lid);
  }else{
   parts.push(solid(parent,'AlderwingChestBody2Geometry',[box(.42,.22,.34,0,.17,0,COLOR.wood)]));const lid=new T.Group();lid.position.y=.36;lid.rotation.y=Math.PI/4;parent.add(lid);solid(lid,'AlderwingChestLid2Geometry',[cone(.31,.18,4,0,0,0,COLOR.brass),sph(.055,0,.12,0,COLOR.cool)]);parts.push(lid);
  }
  return parts;
 }
 function clue(parent,art,kind){
  if(kind==='lore'){solid(parent,'AlderwingLoreScrollGeometry',[cyl(.08,.08,.42,0,.27,0,COLOR.paper,[0,0,Math.PI/2],10),box(.04,.09,.45,0,.27,0,COLOR.brass)]);return;}
  if(kind==='board'){solid(parent,'AlderwingRequestPostGeometry',[cyl(.045,.045,.82,0,.41,0,COLOR.dark,[0,0,0],6),box(.54,.36,.06,0,.83,0,COLOR.cool),box(.46,.05,.08,0,.91,.04,COLOR.paper)]);return;}
  const base=kind==='activity'?COLOR.leaf:COLOR.cool,pieces=[cyl(.18,.22,.09,0,.05,0,COLOR.stone,[0,0,0],8)];
  if([4,5,11].includes(art))pieces.push(cone(.13,.24,10,0,.28,0,base,[Math.PI,0,0]),sph(.04,0,.17,0,COLOR.brass));
  else if([7,12,13].includes(art))pieces.push(box(.34,.22,.05,0,.30,0,base),cyl(.025,.025,.36,0,.19,0,COLOR.dark,[0,0,0],6));
  else if([9,15].includes(art))pieces.push(sph(.16,0,.24,0,base),cyl(.03,.05,.28,0,.34,0,COLOR.dark,[0,0,0],6));
  else pieces.push(box(.28,.20,.22,0,.24,0,kind==='activity'?COLOR.cloth:COLOR.paper),box(.30,.05,.24,0,.37,0,COLOR.brass));
  solid(parent,kind==='activity'?'AlderwingFieldworkMarkerGeometry':'AlderwingQuestStepMarkerGeometry',pieces);
 }
 function marker(kind,id,label,art){const pos=points[point++],g=new T.Group(),solid=new T.Group();g.position.set(pos.x,pos.y,pos.z);group.add(g);g.add(solid);
  const variant=kind==='loot'?Number(String(id).match(/\d+/)?.[0]||objects.filter(o=>o.kind==='loot').length)%3:0,parts=kind==='loot'?chest(solid,variant):(clue(solid,art,kind),[]);
  const ring=mesh(g,new T.RingGeometry(.38,.43,24),glowMat,0,.035,0);ring.rotation.x=-Math.PI/2;ring.visible=false;
  const obj={kind,id,label,group:g,pos,solid,ring,variant,parts,art,actionable:true,open:false,glows:false,rewardGrantable:false,resolved:false};objects.push(obj);return obj;
 }
 const requestPost=marker('board','board','Read villagers’ request',0);
 if(!options.preserveHeading)s.player.yaw=Math.atan2(player().x-requestPost.pos.x,player().z-requestPost.pos.z);
 r.loot.forEach(l=>marker('loot',l.id,'Collect '+l.label,1));r.lore.forEach(id=>marker('lore',id,'Read a lore scroll',2));q().steps.forEach((step,i)=>marker('step',i,step.label,stepArt(step.label)));
 for(const a of sites)for(let i=0;i<a.story.steps.length;i++){const node=a.story.steps[i];marker('activity',a.story.id+':'+i,node.label,node.art);}
 // Only ledger-backed Peeps can speak. Empty places retain their request post.
 const residentObjects=(options.movers||s.source.movers||[]).filter((o,i,a)=>o.userData.resident&&a.indexOf(o)===i).map(o=>({kind:'resident',actor:o,name:o.userData.npc?.name||'A villager',label:'Talk to '+(o.userData.npc?.name||'a villager'),pos:{x:0,y:0,z:0}}));
 const v=new T.Vector3();
 function reachable(pos){const dist=Math.hypot(pos.x-player().x,pos.z-player().z);for(let k=1;k<Math.ceil(dist/.15);k++){const a=k/Math.ceil(dist/.15);if(!world.allowed(player().x+(pos.x-player().x)*a,player().z+(pos.z-player().z)*a))return false;}return true;}
 function updateChest(o,opened,grantable){o.open=opened;o.rewardGrantable=grantable;o.glows=!opened&&grantable;o.ring.visible=o.glows;if(o.parts[1]){o.parts[1].rotation.x=opened?-.75:0;o.parts[1].position.y=opened?0.43:(o.variant===1?0.25:0.35);o.parts[1].position.z=opened?-0.13:0;}}
 function update(t,force=false){if(disposed||paused||!force&&t-last<.12)return;last=t;const r=get(),story=q(),activities=core.activities(r);nearest=null;let best=2.4;
  for(const o of objects){
   if(o.kind==='loot'){const loot=r.loot.find(l=>l.id===o.id),opened=r.collected.includes(o.id),grantable=core.rewardHasGrantableLoot(loot?.reward,root.BurbzLootCore);o.group.visible=true;o.actionable=!opened;updateChest(o,opened,grantable);}
   else if(o.kind==='lore'){o.group.visible=!r.read.includes(o.id);o.actionable=o.group.visible;o.ring.visible=false;}
   else if(o.kind==='step'){o.group.visible=r.accepted&&!r.completed&&r.step===o.id;o.actionable=o.group.visible;o.ring.visible=false;}
   else if(o.kind==='board'){o.group.visible=true;o.actionable=true;o.ring.visible=false;}
   else if(o.kind==='activity'){const [id,n]=o.id.split(':'),a=activities.find(a=>a.story.id===id),current=!!a&&!a.completed&&Number(n)===a.step;o.group.visible=current;o.actionable=current;o.resolved=!!a&&(Number(n)<a.step||a.completed);o.ring.visible=false;}
  }
  for(const o of residentObjects){o.actor.getWorldPosition(v);Object.assign(o.pos,{x:v.x-frame.x,y:v.y-(frame.y||0),z:v.z-frame.z});}
  for(const o of [...objects,...residentObjects]){if(o.group&&(!o.group.visible||!o.actionable))continue;const d=Math.hypot(o.pos.x-player().x,o.pos.z-player().z);if(d<best&&reachable(o.pos)){best=d;nearest=o;}}
  interact.hidden=!nearest||s.player.mode==='fly'||s.uiBusy;const label=nearest?((nearest.resolved?'Inspect: ':'')+nearest.label+(s.root.classList.contains('vw-touch')?'':' · E')):'';if(interact.textContent!==label)interact.textContent=label;
  let active=activities.find(a=>a.story.id===tracked&&!a.completed);if(tracked&&!active)tracked=null;
  const target=active?objects.find(o=>o.id===active.story.id+':'+active.step):r.accepted&&r.step<story.steps.length?objects.find(o=>o.kind==='step'&&o.id===r.step):objects[0];
  const dx=target.pos.x-player().x,dz=target.pos.z-player().z,angle=Math.atan2(-dx,-dz)-s.player.yaw,bearing=Math.atan2(Math.sin(angle),Math.cos(angle)),direction=Math.abs(bearing)<.5?'ahead':Math.abs(bearing)>2.4?'behind':bearing>0?'left':'right';
  const objective=active?active.story.steps[active.step].label:r.completed?'Village helped':r.accepted?(r.step<story.steps.length?story.steps[r.step].label:'Return to the villagers'):'Request post · Villagers’ request';
	  const line=!active&&r.completed?'Village helped · '+r.collected.length+'/'+r.loot.length+' loot · '+r.read.length+'/'+r.lore.length+' scrolls · '+activities.filter(a=>a.completed).length+'/3 stories':'Next: '+objective+' · '+Math.round(Math.hypot(dx,dz))+' paces '+direction;
  if(guide.textContent!==line)guide.textContent=line;
  hudState={title:active?active.story.title:story.title,objective,completed:active?active.completed:r.completed,step:active?active.step:r.step,total:active?active.story.steps.length:story.steps.length,lootFound:r.collected.length,lootTotal:r.loot.length,loreFound:r.read.length,loreTotal:r.lore.length,activitiesFound:activities.filter(a=>a.completed).length,activitiesTotal:activities.length,bearing,distance:Math.round(Math.hypot(dx,dz)),direction};
 }
 update(0,true);
 return {update,closePanel,setPaused,positions:()=>points,hud(){return hudState?{...hudState}:null;},key(code){if(code==='KeyE'){use();return true;}if(code==='KeyJ'){journal();return true;}return false;},diagnostics(){return{questId:get().questId,artReady,paused,activities:core.activities(get()).map(a=>({id:a.story.id,title:a.story.title,step:a.step,completed:a.completed})),objects:objects.map(o=>({kind:o.kind,id:o.id,visible:o.group.visible,art:o.art,resolved:!!o.resolved,actionable:!!o.actionable,variant:o.variant,open:!!o.open,glows:!!o.glows,rewardGrantable:!!o.rewardGrantable,...o.pos,x:o.pos.x+frame.x,y:o.pos.y+(frame.y||0),z:o.pos.z+frame.z})),residents:residentObjects.map(o=>({name:o.name,...o.pos,x:o.pos.x+frame.x,y:o.pos.y+(frame.y||0),z:o.pos.z+frame.z})),nearest:nearest?{kind:nearest.kind,id:nearest.id}:null};},dispose(){closePanel(false);disposed=true;lifetime.abort();s.abort.signal.removeEventListener('abort',abortFromHost);const textures=new Set();mats.forEach(m=>Object.values(m||{}).forEach(v=>{if(v&&v.isTexture)textures.add(v);}));journalButton.remove();guide.remove();interact.remove();group.removeFromParent();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());post.remove();panel.remove();}};
}
root.BurbzVillageDiscoveries={attach};
})(globalThis);
