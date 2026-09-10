/* Character and nearby actions, driven by the borrowed walking frame. */
(function(root){'use strict';
function attach(s){
 const el=s.root,abort=s.abort.signal,tools=document.createElement('div'),tracker=document.createElement('section'),tray=document.createElement('div');
 tools.className='fp-tools';tracker.className='fp-tracker';tracker.setAttribute('aria-label','Current adventure');tray.className='fp-actions';tray.setAttribute('aria-label','Nearby actions');
 const character=document.createElement('div');character.className='fp-character';character.innerHTML='<span class="fp-seal" aria-hidden="true"></span><span><strong></strong><small></small></span>';
 const compass=document.createElement('div');compass.className='fp-compass';compass.setAttribute('aria-label','Facing direction');compass.innerHTML='<span class="fp-compass-mark" aria-hidden="true">◇</span><span class="fp-bearing"></span>';
 const pack=document.createElement('button');pack.type='button';pack.className='fp-pack';pack.textContent='Satchel';pack.setAttribute('aria-expanded','false');
 const panel=document.createElement('section');panel.className='fp-panel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Your travelling satchel');panel.innerHTML='<button type="button" class="fp-close">← Keep exploring</button><h2>Your travelling satchel</h2><p class="fp-pack-caption">Supplies you can use at home and in the villages.</p><dl></dl><p class="fp-pack-note"></p>';
 tracker.innerHTML='<div class="fp-quest-heading"><span class="fp-quest-kicker">YOUR NEXT STEP</span><strong></strong></div><div class="fp-progress" role="progressbar" aria-label="Request progress" aria-valuemin="0"><span></span></div>';
 tools.append(pack);el.append(character,compass,tools,tracker,tray,panel);el.classList.add('fp-ready');
 let last=-Infinity,focusBefore=null,packKey='';const title=character.querySelector('strong'),level=character.querySelector('small'),bearing=compass.querySelector('.fp-bearing'),quest=tracker.querySelector('strong'),progress=tracker.querySelector('.fp-progress'),bar=progress.firstElementChild;
 const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
 const on=(node,event,fn)=>node.addEventListener(event,fn,{signal:abort});
 function closePanel(){if(panel.hidden)return false;panel.hidden=true;pack.setAttribute('aria-expanded','false');s.uiBusy=false;s.reset();last=-Infinity;update(performance.now()/1000);focusBefore?.focus({preventScroll:true});return true;}
 function showPack(){if(s.failed||s.uiBusy||typeof s.options.character!=='function')return;focusBefore=document.activeElement;s.reset();s.uiBusy=true;panel.hidden=false;pack.setAttribute('aria-expanded','true');paintPack();last=-Infinity;update(performance.now()/1000);panel.querySelector('button').focus({preventScroll:true});}
 function stats(){return s.options.character?.()||{};}
 function paintPack(){const c=stats(),dl=panel.querySelector('dl'),key=JSON.stringify([c.coins,c.branches,c.stone]);if(key===packKey)return;packKey=key;dl.replaceChildren();for(const [name,value] of [['Coins',c.coins],['Timber',c.branches],['Stone',c.stone]]){if(!Number.isFinite(value))continue;const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name;dd.textContent=Math.max(0,Math.floor(value)).toLocaleString();dl.append(dt,dd);}text(panel.querySelector('.fp-pack-note'),s.options.flight?'You are exploring the Academy. Room services open when you approach them.':'Face a tree to chop timber, read the illustrated scrolls, and talk to the village folk. Your finds stay saved when you leave.');}
 on(pack,'click',showPack);on(panel.querySelector('button'),'click',closePanel);
 if(typeof s.options.exploreWorld==='function'){
  for(const [label,mode] of [['Walk beyond this settlement','walk'],['Fly into the world','fly']]){
  const travel=document.createElement('button');travel.type='button';travel.className='fp-world';travel.textContent=label;panel.append(travel);
  on(travel,'click',async()=>{if(travel.disabled||s.room)return;for(const b of panel.querySelectorAll('.fp-world'))b.disabled=true;
   try{const opened=await s.options.exploreWorld({...s.player,mode});if(opened===false)throw Error('The world could not open. Please try again.');}
   catch(error){text(panel.querySelector('.fp-pack-note'),error.message||'The world could not open. Please try again.');}
   finally{for(const b of panel.querySelectorAll('.fp-world'))b.disabled=false;}
  });
  }
 }
 function move(selector,parent){const node=el.querySelector(selector);if(node&&node.parentNode!==parent)parent.append(node);return node;}
 function update(time){if(time-last<.12)return;last=time;
  for(const b of panel.querySelectorAll('.fp-world'))b.hidden=!!s.room;
  const c=stats();pack.hidden=typeof s.options.character!=='function';if(!s.room&&s.options.exitLabel)text(el.querySelector('.vw-exit'),s.options.exitLabel);text(title,c.name||'Alderwing keeper');text(level,Number.isFinite(c.level)?'Level '+Math.max(1,Math.floor(c.level))+' · '+(s.options.flight?'Academy explorer':'Wayfarer'):'Wayfarer');
  const angle=(((s.player?.yaw||0)*-180/Math.PI)%360+360)%360;const directions=['N','NE','E','SE','S','SW','W','NW'];text(bearing,directions[Math.round(angle/45)%8]+' · '+Math.round(angle)+'°');
  const journal=move('.vd-journal',tools);if(journal)journal.hidden=!!s.room;const guide=move('.vd-guide',tracker);
  for(const selector of ['.vr-door','.vr-service','.il-use','.vd-interact','.vh-use','.af-land','[data-walk-action]']){const node=move(selector,tray);if(node){node.classList.add('fp-action');if(s.root.classList.contains('vw-touch'))node.setAttribute('data-touch','true');}}
  const h=s.discoveries?.hud?.();tracker.hidden=!!s.room||!!s.options.flight||!guide||s.uiBusy;
  if(h){text(quest,h.title||'Explore this place');const total=Math.max(1,Number(h.total)||1),done=Math.min(total,Number(h.step)||0);progress.hidden=!h.total;progress.setAttribute('aria-valuemax',String(total));progress.setAttribute('aria-valuenow',String(done));bar.style.width=(done/total*100)+'%';tracker.classList.toggle('fp-complete',!!h.completed);}
  else{text(quest,'A little kindness goes a long way');progress.hidden=true;}
  tray.hidden=s.uiBusy||s.failed;character.hidden=s.uiBusy;compass.hidden=s.uiBusy;tools.hidden=s.uiBusy;
  el.classList.toggle('fp-busy',!!s.uiBusy);if(!panel.hidden)paintPack();
 }
 return{update,closePanel,key(code){if(code==='KeyB'){if(!closePanel())showPack();return true;}return false;},diagnostics(){return{character:stats(),actions:[...tray.children].filter(b=>!b.hidden).map(b=>({label:b.textContent,disabled:b.disabled})),trackerHidden:tracker.hidden,packOpen:!panel.hidden};},dispose(){for(const node of [tools,tracker,tray,character,compass,panel])node.remove();el.classList.remove('fp-ready');}};
}
root.BurbzFirstPersonHud={attach};
})(globalThis);
