/* Saved requests and illustrated field discoveries; one borrowed renderer. */
(function(root){'use strict';
const ART='assets/discoveries-v385/alderwing-objects.webp';
// Bounds follow the painted atlas, including its deliberately irregular silhouettes.
const CELLS=[[16,4,291,321],[327,55,299,251],[657,70,285,233],[959,54,288,245],
 [53,325,261,320],[404,307,172,328],[707,308,171,338],[961,327,260,301],
 [28,653,282,249],[325,630,326,297],[679,659,252,260],[946,646,306,258],
 [29,900,265,346],[325,928,336,293],[670,928,239,276],[959,967,286,230]];
function attach(s){
 const T=root.THREE,core=root.BurbzVillageDiscoveryCore,api=s.options.discoveries;
 if(!api)return {update(){},dispose(){},closePanel(){return false;},hud(){return null;}};
 api.prepare();
 const get=()=>api.record(),q=()=>core.quest(get()),group=new T.Group();s.source.scene.add(group);
 const geos=[],mats=[],textures=[],objects=[],abort=s.abort.signal;let disposed=false,artReady=false;
 const post=document.createElement('div');post.className='vd-hud';post.innerHTML='<button class="vd-journal" type="button">Journal</button><div class="vd-guide" aria-live="polite"></div><button class="vd-interact" type="button" hidden></button>';
 const panel=document.createElement('section');panel.className='vd-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Village journal');
 panel.innerHTML='<button class="vd-close" type="button">← Keep walking</button><div class="vd-body"></div>';
 s.root.append(post,panel);
 const guide=post.querySelector('.vd-guide'),interact=post.querySelector('.vd-interact'),body=panel.querySelector('.vd-body');let nearest=null,last=0,focusBefore=null,tracked=null,hudState=null;
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort});
 function closePanel(){if(panel.hidden)return false;panel.hidden=true;s.uiBusy=false;s.reset();focusBefore?.focus({preventScroll:true});return true;}
 function show(title,text,buttons=[],art){
  focusBefore=panel.hidden?document.activeElement:focusBefore;s.reset();s.uiBusy=true;panel.hidden=false;body.replaceChildren();panel.scrollTop=0;
  if(Number.isInteger(art)){const figure=document.createElement('div');figure.className='vd-illustration';figure.setAttribute('aria-hidden','true');const [x,y,w,h]=CELLS[art];figure.style.cssText='width:104px;height:'+Math.round(104*h/w)+'px;background-image:url("'+ART+'");background-size:'+1254/w*104+'px '+1254/w*104+'px;background-position:-'+x/w*104+'px -'+y/w*104+'px';body.append(figure);}
  const h=document.createElement('h2');h.textContent=title;body.append(h);const p=document.createElement('p');p.textContent=text;body.append(p);
  for(const [label,action] of buttons){const b=document.createElement('button');b.type='button';b.textContent=label;on(b,'click',action);body.append(b);}
  panel.querySelector('.vd-close').focus({preventScroll:true});
 }
 function commit(type,id,giver){try{const result=api.act(type,id,giver);if(result){
   const more=result.tryAgain?[['Look at the clues again',()=>activity(id)]]:result.activity&&!result.completed?[['Follow the next clue',()=>{tracked=result.activity;closePanel();update(performance.now()/1000,true);}]]:[];
   show(result.title||(type==='loot'?'In your bag':q().title),result.text+(result.reward?'\n\n'+api.rewardText(result.reward):''),more,type==='loot'?1:type==='lore'?2:result.activity?core.ACTIVITIES.find(a=>a.id===result.activity)?.art:undefined);
  }update(performance.now()/1000,true);}catch(e){show('Progress could not save','Nothing was taken or spent. '+e.message,[['Try again',()=>commit(type,id,giver)]]);}}
 function activity(id){
  const [key,n]=String(id).split(':'),a=core.activities(get()).find(a=>a.story.id===key);if(!a)return;const node=a.story.steps[Number(n)];if(!node)return;
  if(a.completed){show(a.story.memory,a.story.outro,[],a.story.art);return;}
  const notes=a.story.steps.slice(0,a.step).map(x=>x.text).join('\n\n');
  if(Number(n)!==a.step){show(a.story.title,node.text+'\n\n'+(Number(n)<a.step?'Recorded in your journal.':'First: '+a.story.steps[a.step].label),[['Follow this story',()=>{tracked=key;closePanel();update(performance.now()/1000,true);}]],node.art);return;}
  const buttons=node.choices?node.choices.map(([choice,label])=>[label,()=>commit('activity',key+':'+a.step,choice)]):[[node.label,()=>commit('activity',key+':'+a.step)]];
  show(a.story.title+' · '+(a.step+1)+' / '+a.story.steps.length,node.text+(node.choices&&notes?'\n\nYour field notes\n'+notes:''),buttons,node.art);
 }
 function journal(){const r=get(),story=q(),sites=core.activities(r),status=r.completed?'Completed · '+story.outro:r.accepted?(r.step<story.steps.length?'Next: '+story.steps[r.step].label:'Return to a villager or the request post for your thanks.'):'Find a villager or the gold request post to begin.';
  show('Field journal',story.title+'\n'+status+'\n\nLoot found: '+r.collected.length+'/'+r.loot.length+' · Scrolls read: '+r.read.length+'/'+r.lore.length+'\nLocal stories restored: '+sites.filter(a=>a.completed).length+'/'+sites.length,
   [[r.completed?'Read the completed request':'Track the villagers’ request',()=>{tracked=null;request();}],...sites.map(a=>[(a.completed?'✓ ':a.step?'Continue: ':'Discover: ')+a.story.title+' · '+a.step+'/'+a.story.steps.length,()=>show(a.story.title,a.completed?a.story.outro:a.story.steps[a.step].label+'\n\n'+(a.step?a.story.steps.slice(0,a.step).map(n=>n.text).join('\n\n'):'Three linked objects keep this local story. Find the first clue; each step stays saved when you leave.'),a.completed?[]:[['Follow this story',()=>{tracked=a.story.id;closePanel();update(performance.now()/1000,true);}]],a.story.art)]),...r.read.map(id=>{const l=core.LORE.find(l=>l.id===id);return[l.title,()=>show(l.title,l.text,[],2)];})],13);
 }
 on(panel.querySelector('.vd-close'),'click',closePanel);on(post.querySelector('.vd-journal'),'click',journal);
 function request(giver){const r=get(),story=q(),speaker=giver||r.giver||'The village folk';if(r.completed){show(story.title,speaker+': '+story.outro,[],0);return;}
  if(!r.accepted){show(giver||'Villagers’ request post',story.intro+'\n\n'+story.steps.map((x,i)=>(i+1)+'. '+x.label).join('\n')+'\n\nThanks: 30 coins and 2 Oak Twigs.',[['I’ll help',()=>commit('accept',null,giver)]],0);return;}
  if(r.step===story.steps.length){show(speaker+' · '+story.title,'Everything is ready. Let the villagers know you have helped.',[['Finish quest',()=>commit('finish')]],0);return;}
  show(speaker+' · '+story.title,story.steps.map((step,i)=>(i<r.step?'✓ ':i===r.step?'Next: ':'Later: ')+step.label).join('\n')+'\n\nFollow the blue marker. Your progress stays here when you leave.',[['Follow the request',()=>{tracked=null;closePanel();update(performance.now()/1000,true);}]],0);
 }
 function use(){if(!nearest||s.player.mode==='fly'||s.uiBusy||s.failed)return;const o=nearest;if(o.kind==='board'||o.kind==='resident')request(o.name);else if(o.kind==='activity')activity(o.id);else commit(o.kind,o.id);}
 on(interact,'click',use);
 const r=get(),sites=core.activities(r),points=core.positions(s.world,s.player,r.placementSeed,1+r.loot.length+r.lore.length+q().steps.length+sites.reduce((n,a)=>n+a.story.steps.length,0));let point=0;
 function material(color){const m=new T.MeshLambertMaterial({color});root.BurbzManga?.styleMaterial(m);mats.push(m);return m;}
 const wood=material(0x74472c),gold=material(0xf8c75a),paper=material(0xffe8b0),blue=material(0x65d6f0);
 const atlas=new T.TextureLoader().load(ART,()=>{if(disposed){atlas.dispose();return;}artReady=true;for(const t of textures)t.needsUpdate=true;for(const o of objects){o.fallback.visible=false;o.sprite.visible=true;}});atlas.colorSpace=T.SRGBColorSpace;textures.push(atlas);
 const spriteMats=CELLS.map(([x,y,w,h])=>{const tex=atlas.clone();tex.repeat.set(w/1254,h/1254);tex.offset.set(x/1254,1-(y+h)/1254);tex.colorSpace=T.SRGBColorSpace;textures.push(tex);
  // Alpha discard writes only the painted silhouette into the ink pass's depth.
  // Opaque interiors cannot blend with buildings or float through their walls.
  const m=new T.SpriteMaterial({map:tex,transparent:false,alphaTest:.5,depthTest:true,depthWrite:true,toneMapped:false});mats.push(m);return m;});
 function mesh(parent,geo,mat,x,y,z){geos.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
 function stepArt(label){const t=label.toLowerCase();return /bell|clapper|music|tune/.test(t)?4:/lantern|light|wick/.test(t)?5:/ribbon|button|sew|cape|cloth/.test(t)?10:/stone|chalk|carv/.test(t)?7:/seed|plant|garden|flower/.test(t)?9:/wheel|repair|mend|pin|tool/.test(t)?11:/map|sketch|picture|card/.test(t)?13:/letter|note|apology|paper/.test(t)?2:/pebble|bowl|cup|game/.test(t)?15:/sign|path|post/.test(t)?12:3;}
 function marker(kind,id,label,art){const pos=points[point++],g=new T.Group(),fallback=new T.Group();g.position.set(pos.x,pos.y,pos.z);group.add(g);g.add(fallback);
  if(kind==='loot'){mesh(fallback,new T.BoxGeometry(.48,.30,.34),wood,0,.17,0);mesh(fallback,new T.BoxGeometry(.50,.08,.36),gold,0,.35,0);}
  else if(kind==='lore'){const scroll=mesh(fallback,new T.CylinderGeometry(.10,.10,.52,8),paper,0,.3,0);scroll.rotation.z=Math.PI/2;}
  else{mesh(fallback,new T.CylinderGeometry(.045,.045,.85,6),wood,0,.43,0);mesh(fallback,new T.BoxGeometry(.5,.36,.06),kind==='board'?gold:blue,0,.87,0);}
  const spriteMat=spriteMats[art].clone();mats.push(spriteMat);
  const sprite=new T.Sprite(spriteMat),height=kind==='board'?1.2:kind==='loot'?.9:kind==='lore'?.8:1.15,[,,w,h]=CELLS[art];sprite.center.set(.5,0);sprite.position.y=.025;sprite.scale.set(height*w/h,height,1);sprite.visible=artReady;fallback.visible=!artReady;g.add(sprite);
  const seal=new T.Sprite(spriteMats[14]);seal.scale.set(.30,.33,1);seal.position.set(.36,height+.11,0);seal.visible=false;g.add(seal);
  const ringMat=new T.MeshBasicMaterial({color:kind==='board'?0xf8c75a:kind==='activity'?0x94e3ba:0x65d6f0,side:T.DoubleSide});mats.push(ringMat);const ring=mesh(g,new T.RingGeometry(.38,.43,20),ringMat,0,.035,0);ring.rotation.x=-Math.PI/2;
  const obj={kind,id,label,group:g,pos,sprite,fallback,ring,seal,art};objects.push(obj);return obj;
 }
 const requestPost=marker('board','board','Read villagers’ request',0);
 s.player.yaw=Math.atan2(s.player.x-requestPost.pos.x,s.player.z-requestPost.pos.z);
 r.loot.forEach(l=>marker('loot',l.id,'Collect '+l.label,1));r.lore.forEach(id=>marker('lore',id,'Read a lore scroll',2));q().steps.forEach((step,i)=>marker('step',i,step.label,stepArt(step.label)));
 for(const a of sites)for(let i=0;i<a.story.steps.length;i++){const node=a.story.steps[i];marker('activity',a.story.id+':'+i,node.label,node.art);}
 // Only ledger-backed Peeps can speak. Empty places retain their request post.
 const residentObjects=(s.source.movers||[]).filter((o,i,a)=>o.userData.resident&&a.indexOf(o)===i).map(o=>({kind:'resident',actor:o,name:o.userData.npc?.name||'A villager',label:'Talk to '+(o.userData.npc?.name||'a villager'),pos:{x:0,y:0,z:0}}));
 const v=new T.Vector3();
 function reachable(pos){const dist=Math.hypot(pos.x-s.player.x,pos.z-s.player.z);for(let k=1;k<Math.ceil(dist/.15);k++){const a=k/Math.ceil(dist/.15);if(!s.world.allowed(s.player.x+(pos.x-s.player.x)*a,s.player.z+(pos.z-s.player.z)*a))return false;}return true;}
 function update(t,force=false){if(disposed||!force&&t-last<.12)return;last=t;const r=get(),story=q(),activities=core.activities(r);nearest=null;let best=2.4;
  for(const o of objects){o.group.visible=o.kind==='loot'?!r.collected.includes(o.id):o.kind==='lore'?!r.read.includes(o.id):o.kind==='step'?r.accepted&&!r.completed&&r.step===o.id:true;
   if(o.kind==='activity'){const [id,n]=o.id.split(':'),a=activities.find(a=>a.story.id===id);o.ring.visible=!a.completed&&Number(n)===a.step;o.resolved=Number(n)<a.step;
    o.sprite.material.color.setHex(a.completed?0xfff3ce:Number(n)>a.step?0xa2b3aa:0xffffff);
    o.seal.visible=artReady&&a.completed&&Number(n)===a.story.steps.length-1;
   }
  }
  for(const o of residentObjects){o.actor.getWorldPosition(v);Object.assign(o.pos,{x:v.x,y:v.y,z:v.z});}
  for(const o of [...objects,...residentObjects]){if(o.group&&!o.group.visible)continue;const d=Math.hypot(o.pos.x-s.player.x,o.pos.z-s.player.z);if(d<best&&reachable(o.pos)){best=d;nearest=o;}}
  interact.hidden=!nearest||s.player.mode==='fly'||s.uiBusy;const label=nearest?((nearest.resolved?'Inspect: ':'')+nearest.label+(s.root.classList.contains('vw-touch')?'':' · E')):'';if(interact.textContent!==label)interact.textContent=label;
  let active=activities.find(a=>a.story.id===tracked&&!a.completed);if(tracked&&!active)tracked=null;
  const target=active?objects.find(o=>o.id===active.story.id+':'+active.step):r.accepted&&r.step<story.steps.length?objects.find(o=>o.kind==='step'&&o.id===r.step):objects[0];
  const dx=target.pos.x-s.player.x,dz=target.pos.z-s.player.z,angle=Math.atan2(-dx,-dz)-s.player.yaw,bearing=Math.atan2(Math.sin(angle),Math.cos(angle)),direction=Math.abs(bearing)<.5?'ahead':Math.abs(bearing)>2.4?'behind':bearing>0?'left':'right';
  const objective=active?active.story.steps[active.step].label:r.completed?'Village helped':r.accepted?(r.step<story.steps.length?story.steps[r.step].label:'Return to the villagers'):'Gold request post · Villagers’ request';
  const line=!active&&r.completed?'Village helped · '+r.collected.length+'/'+r.loot.length+' loot · '+r.read.length+'/'+r.lore.length+' scrolls · '+activities.filter(a=>a.completed).length+'/3 stories':objective+' · '+Math.round(Math.hypot(dx,dz))+' paces '+direction;
  if(guide.textContent!==line)guide.textContent=line;
  hudState={title:active?active.story.title:story.title,objective,completed:active?active.completed:r.completed,step:active?active.step:r.step,total:active?active.story.steps.length:story.steps.length,lootFound:r.collected.length,lootTotal:r.loot.length,loreFound:r.read.length,loreTotal:r.lore.length,activitiesFound:activities.filter(a=>a.completed).length,activitiesTotal:activities.length,bearing,distance:Math.round(Math.hypot(dx,dz)),direction};
 }
 update(0,true);
 return {update,closePanel,hud(){return hudState?{...hudState}:null;},key(code){if(code==='KeyE'){use();return true;}if(code==='KeyJ'){journal();return true;}return false;},diagnostics(){return{questId:get().questId,artReady,activities:core.activities(get()).map(a=>({id:a.story.id,title:a.story.title,step:a.step,completed:a.completed})),objects:objects.map(o=>({kind:o.kind,id:o.id,visible:o.group.visible,art:o.art,resolved:!!o.resolved,...o.pos})),residents:residentObjects.map(o=>({name:o.name,...o.pos})),nearest:nearest?{kind:nearest.kind,id:nearest.id}:null};},dispose(){disposed=true;group.removeFromParent();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());post.remove();panel.remove();}};
}
root.BurbzVillageDiscoveries={attach};
})(globalThis);
