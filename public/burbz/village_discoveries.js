/* Bounded 3D discoveries and accessible on-foot journal. No extra renderer. */
(function(root){'use strict';
function attach(s){
 const T=root.THREE,core=root.BurbzVillageDiscoveryCore,api=s.options.discoveries;
 if(!api)return {update(){},dispose(){},closePanel(){return false;}};
 api.prepare();
 const get=()=>api.record(),q=()=>core.quest(get()),group=new T.Group();s.source.scene.add(group);
 const geos=[],mats=[],textures=[],objects=[],abort=s.abort.signal;
 const post=document.createElement('div');post.className='vd-hud';post.innerHTML='<button class="vd-journal" type="button">Journal</button><div class="vd-guide" aria-live="polite"></div><button class="vd-interact" type="button" hidden></button>';
 const panel=document.createElement('section');panel.className='vd-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Village journal');
 panel.innerHTML='<button class="vd-close" type="button">← Keep walking</button><div class="vd-body"></div>';
 s.root.append(post,panel);
 const guide=post.querySelector('.vd-guide'),interact=post.querySelector('.vd-interact'),body=panel.querySelector('.vd-body');let nearest=null,last=0,focusBefore=null;
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:abort});
 function closePanel(){if(panel.hidden)return false;panel.hidden=true;s.uiBusy=false;s.reset();focusBefore?.focus({preventScroll:true});return true;}
 function show(title,text,buttons=[]){focusBefore=panel.hidden?document.activeElement:focusBefore;s.reset();s.uiBusy=true;panel.hidden=false;body.replaceChildren();const h=document.createElement('h2');h.textContent=title;body.append(h);const p=document.createElement('p');p.textContent=text;body.append(p);for(const [label,action] of buttons){const b=document.createElement('button');b.type='button';b.textContent=label;on(b,'click',action);body.append(b);}panel.querySelector('.vd-close').focus({preventScroll:true});}
 function commit(type,id,giver){try{const result=api.act(type,id,giver);if(result)show(result.title|| (type==='loot'?'In your bag':q().title),result.text+(result.reward?'\n\n'+api.rewardText(result.reward):''));update(performance.now()/1000,true);}catch(e){show('Progress could not save','Nothing was taken or spent. '+e.message,[['Try again',()=>commit(type,id,giver)]]);}}
 function journal(){const r=get(),story=q();const status=r.completed?'Completed · '+story.outro:r.accepted?(r.step<story.steps.length?'Next: '+story.steps[r.step].label:'Return to a villager or the request post for your thanks.'):'Find a villager or the gold request post to begin.';
  show(story.title,status+'\n\nLoot found: '+r.collected.length+'/'+r.loot.length+' · Lore found: '+r.read.length+'/'+r.lore.length,[[r.completed?'Read the villagers’ request':'Read the request',()=>show(story.title,story.intro)],...r.read.map(id=>{const l=core.LORE.find(l=>l.id===id);return[l.title,()=>show(l.title,l.text)];})]);
 }
 on(panel.querySelector('.vd-close'),'click',closePanel);on(post.querySelector('.vd-journal'),'click',journal);
 function request(giver){const r=get(),story=q(),speaker=giver||r.giver||'The village folk';if(r.completed){show(story.title,speaker+': '+story.outro);return;}
  if(!r.accepted){show(giver||'Villagers’ request post',story.intro+'\n\n'+story.steps.map((x,i)=>(i+1)+'. '+x.label).join('\n')+'\n\nThanks: 30 coins and 2 Oak Twigs.',[['I’ll help',()=>commit('accept',null,giver)]]);return;}
  if(r.step===story.steps.length){show(speaker+' · '+story.title,'Everything is ready. Let the villagers know you have helped.',[['Finish quest',()=>commit('finish')]]);return;}
  show(speaker+' · '+story.title,'Next: '+story.steps[r.step].label+'\n\nFollow the blue marker. Your progress stays here when you leave.');
 }
 function use(){if(!nearest||s.uiBusy||s.failed)return;const o=nearest;if(o.kind==='board'||o.kind==='resident')request(o.name);else commit(o.kind,o.id);}
 on(interact,'click',use);
 const r=get(),points=core.positions(s.world,s.player,r.placementSeed,1+r.loot.length+r.lore.length+q().steps.length);let point=0;
 function material(color){const m=new T.MeshLambertMaterial({color});root.BurbzManga?.styleMaterial(m);mats.push(m);return m;}
 const wood=material(0x74472c),gold=material(0xf8c75a),paper=material(0xffe8b0),blue=material(0x65d6f0);
 function mesh(parent,geo,mat,x,y,z){geos.push(geo);const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
 function marker(kind,id,label){const pos=points[point++],g=new T.Group();g.position.set(pos.x,pos.y,pos.z);group.add(g);
  if(kind==='loot'){mesh(g,new T.BoxGeometry(.48,.30,.34),wood,0,.17,0);mesh(g,new T.BoxGeometry(.50,.08,.36),gold,0,.35,0);mesh(g,new T.BoxGeometry(.10,.15,.02),gold,0,.23,.18);}
  else if(kind==='lore'){const scroll=mesh(g,new T.CylinderGeometry(.10,.10,.52,8),paper,0,.3,0);scroll.rotation.z=Math.PI/2;mesh(g,new T.BoxGeometry(.09,.18,.2),gold,0,.3,0);}
  else{mesh(g,new T.CylinderGeometry(.045,.045,.85,6),wood,0,.43,0);mesh(g,new T.BoxGeometry(.5,.36,.06),kind==='board'?gold:blue,0,.87,0);}
  // A single sprite symbol keeps the action visible from every approach.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle=kind==='step'?'#65d6f0':kind==='lore'?'#ffe8b0':'#f8c75a';ctx.beginPath();ctx.arc(32,32,27,0,Math.PI*2);ctx.fill();ctx.fillStyle='#17291e';ctx.font='bold 38px Georgia';ctx.textAlign='center';ctx.fillText(kind==='board'?'!':kind==='step'?'◆':kind==='lore'?'?':'+',32,46);
  const tex=new T.CanvasTexture(canvas);textures.push(tex);const sm=new T.SpriteMaterial({map:tex,depthTest:true,depthWrite:false});mats.push(sm);const sprite=new T.Sprite(sm);sprite.position.y=1.48;sprite.scale.set(.44,.44,1);g.add(sprite);
  const obj={kind,id,label,group:g,pos};objects.push(obj);return obj;
 }
 const requestPost=marker('board','board','Read villagers’ request');
 s.player.yaw=Math.atan2(s.player.x-requestPost.pos.x,s.player.z-requestPost.pos.z);
 r.loot.forEach(l=>marker('loot',l.id,'Collect '+l.label));r.lore.forEach(id=>marker('lore',id,'Read a lore scroll'));q().steps.forEach((step,i)=>marker('step',i,step.label));
 // Greet actual ledger-backed Peeps; never add decorative population.
 const residentObjects=(s.source.movers||[]).filter((o,i,a)=>o.userData.resident&&a.indexOf(o)===i).map(o=>({kind:'resident',actor:o,name:o.userData.npc?.name||'A villager',label:'Talk to '+(o.userData.npc?.name||'a villager'),pos:{x:0,y:0,z:0}}));
 const v=new T.Vector3();
 function reachable(pos){const dist=Math.hypot(pos.x-s.player.x,pos.z-s.player.z);for(let k=1;k<Math.ceil(dist/.15);k++){const a=k/Math.ceil(dist/.15);if(!s.world.allowed(s.player.x+(pos.x-s.player.x)*a,s.player.z+(pos.z-s.player.z)*a))return false;}return true;}
 function update(t,force=false){if(!force&&t-last<.12)return;last=t;const r=get(),story=q();nearest=null;let best=2.4;
  for(const o of objects){o.group.visible=o.kind==='loot'?!r.collected.includes(o.id):o.kind==='lore'?!r.read.includes(o.id):o.kind==='step'?r.accepted&&!r.completed&&r.step===o.id:true;}
  for(const o of residentObjects){o.actor.getWorldPosition(v);Object.assign(o.pos,{x:v.x,y:v.y,z:v.z});}
  for(const o of [...objects,...residentObjects]){if(o.group&&!o.group.visible)continue;const d=Math.hypot(o.pos.x-s.player.x,o.pos.z-s.player.z);if(d<best&&reachable(o.pos)){best=d;nearest=o;}}
  interact.hidden=!nearest||s.uiBusy;const label=nearest?(nearest.label+(s.root.classList.contains('vw-touch')?'':' · E')):'';if(interact.textContent!==label)interact.textContent=label;
  const target=r.accepted&&r.step<story.steps.length?objects.find(o=>o.kind==='step'&&o.id===r.step):objects[0];
  let line;if(r.completed)line='Village helped · '+r.collected.length+'/'+r.loot.length+' loot · '+r.read.length+'/2 lore';else{const dx=target.pos.x-s.player.x,dz=target.pos.z-s.player.z,angle=Math.atan2(-dx,-dz)-s.player.yaw,bearing=Math.atan2(Math.sin(angle),Math.cos(angle));const direction=Math.abs(bearing)<.5?'ahead':Math.abs(bearing)>2.4?'behind':bearing>0?'left':'right';line=(r.accepted?(r.step<story.steps.length?story.steps[r.step].label:'Return to the villagers'):'Gold ! · Villagers’ request')+' · '+Math.round(Math.hypot(dx,dz))+' paces '+direction;}
  if(guide.textContent!==line)guide.textContent=line;
 }
 update(0,true);
 return {update,closePanel,key(code){if(code==='KeyE'){use();return true;}if(code==='KeyJ'){journal();return true;}return false;},diagnostics(){return{questId:get().questId,objects:objects.map(o=>({kind:o.kind,id:o.id,visible:o.group.visible,...o.pos})),residents:residentObjects.map(o=>({name:o.name,...o.pos})),nearest:nearest?{kind:nearest.kind,id:nearest.id}:null};},dispose(){group.removeFromParent();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());post.remove();panel.remove();}};
}
root.BurbzVillageDiscoveries={attach};
})(globalThis);
