/* Live desk panels borrow the existing inventory, care and management actions. */
(function(root){'use strict';const C=root.BurbzScanHomeCore;let options,targets=new Map(),boundSection;const signatures=new Map();let layoutModel,layoutFrame=0,layoutObserver,layoutKey="";
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=n=>n.toLocaleString('en-GB');
 const icon=key=>`<img src="${escape(options.icon(key))}" alt="" loading="lazy" decoding="async">`;
 const picture=(src,fallback)=>`<span class="desk-mini-art" aria-hidden="true"><span>${escape(fallback||'🪶')}</span>${src?`<img src="${escape(src)}" alt="" loading="lazy" decoding="async">`:''}</span>`;
 function update(id,value,html){const host=document.getElementById(id);if(!host)return;const next=JSON.stringify(value);if(signatures.get(id)===next)return;const scroll=host.scrollTop;signatures.set(id,next);host.innerHTML=html();host.scrollTop=scroll;}
 function row(id,name,detail,art,extra='',disabled=false){return `<button type="button" class="desk-mini-row" data-home-action="${escape(id)}"${disabled?' disabled':''}>${art||''}<span class="desk-mini-copy"><strong>${escape(name)}</strong><small>${escape(detail)}</small>${extra}</span></button>`;}
 function bar(value,label,tone=''){const pct=Math.round(Math.max(0,Math.min(100,value)));return `<span class="desk-mini-meter ${tone}" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>`;}
 function render(snapshot){if(!options?.visible())return;const m=C.derive(snapshot),focused=document.activeElement?.dataset?.homeAction;targets=new Map();
  targets.set('player-equipment',{kind:'player-equipment'});
  const academy=snapshot?.academy||{rows:[],built:0,total:0,ready:0},academyOpen=snapshot?.gates?.academy!==false;
  applyProgression(m,academy,academyOpen);
  const headings={academy:{kind:'academy'},stores:{kind:'forge'},kitchen:{kind:'kitchen'},training:{kind:'training'},hospital:{kind:'hospital'},completed:{kind:'villages'},building:{kind:'villages'}};for(const [id,target]of Object.entries(headings))targets.set('panel-'+id,target);
  const register=(prefix,rows)=>rows.forEach(r=>targets.set(prefix+r.id,r.target));register('store-',m.stores);m.equipment.forEach(i=>targets.set('equip-'+i.slot,i.target));register('feed-',m.kitchen);register('train-',m.training);register('patient-',m.hospital);register('complete-',m.completed);register('academy-',academy.rows);register('',m.builds);
  const brief=m.actions.filter(a=>a.id==='next-quest').slice(0,1);brief.forEach(a=>targets.set(a.id,a.target));
  update('scanHomeActions',brief,()=>brief.map(a=>`<button type="button" class="home-action" data-home-action="${escape(a.id)}" title="${escape(a.title)}">${icon(a.icon)}<span><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><span class="home-action-chevron" aria-hidden="true">›</span></button>`).join('')||'<p class="desk-empty">No active player goal.</p>');
  buildOptions=m.availableBuilds;renderBuildOption();
  const empty=copy=>`<p class="desk-empty">${escape(copy)}</p>`;
  update('desk-stores-list',{ready:m.forgeReady,open:m.gates.forge},()=>row('panel-stores',m.gates.forge?'Open the Forge':'Unlock Crafting',m.gates.forge?(m.forgeReady?m.forgeReady+' ready to collect':'Weapons, armour & spells'):'Follow your Quests',picture(options.icon('forge'),'⚒️')));
  update('desk-kitchen-list',{rows:m.kitchen,open:m.gates.kitchen},()=>m.kitchen.map(b=>{const full=100-b.hunger;return row('feed-'+b.id,b.name,(b.away?'Away · ':b.label+' · ')+Math.round(full)+'% full',picture(b.art),bar(full,'Fullness',b.level),b.away);}).join('')||empty(m.gates.kitchen?'Your birds are well fed.':'Kitchen unlocks as you progress.'));
  update('desk-training-list',{rows:m.training,open:m.gates.training},()=>m.training.map(s=>row('train-'+s.id,s.name,s.ready?'Finished · collect reward':s.detail+' · '+Math.max(1,Math.ceil(s.remaining/60000))+'m',null,bar(s.ready?100:s.progress,'Training progress'))).join('')||empty(m.gates.training?'No active drills. Choose a bird to train.':'Training unlocks as you progress.'));
  update('desk-hospital-list',{rows:m.hospital,open:m.gates.hospital},()=>m.hospital.map(b=>row('patient-'+b.id,b.name,Math.round(b.hp)+' / '+Math.round(b.maxHp)+' HP · '+(b.admitted?'Recovering':'Needs care'),picture(b.art),bar(b.hp/b.maxHp*100,'Health'))).join('')||empty(m.gates.hospital?'No injured birds.':'Hospital unlocks as you progress.'));
  targets.set('academy-free',{kind:'academy-room',room:'outdoors'});
  update('desk-academy-list',{rows:academy.rows.map(r=>[r.id,r.state,r.x,r.y,r.detail]),free:academy.free,open:academyOpen},()=>academyTree(academy,academyOpen));
  update('desk-completed-list',m.completed,()=>m.completed.map(n=>row('complete-'+n.id,n.name,n.detail,picture(null,n.icon))).join('')||empty('No unchecked buildings.'));
  for(const column of m.empire)for(const holding of column.rows)targets.set('holding-'+column.id+'-'+holding.id,holding.target);
  targets.set('building-notices',{kind:'home-notices'});
  let noticeButton=document.getElementById('desk-empire-notices');
  if(!noticeButton){noticeButton=document.createElement('button');noticeButton.id='desk-empire-notices';noticeButton.type='button';noticeButton.dataset.homeAction='building-notices';panelElement('building').querySelector('.desk-panel-heading').after(noticeButton);}
  noticeButton.hidden=!m.completed.length;noticeButton.textContent=m.completed.length+' completed · check';
  update('desk-building-list',m.empire,()=>m.empire.map(column=>`<section class="desk-empire-column" aria-labelledby="desk-empire-${column.id}"><h3 id="desk-empire-${column.id}">${column.title}</h3><div class="desk-empire-holdings" tabindex="0" role="region" aria-label="${column.title}">${column.rows.map(h=>`<button type="button" class="desk-empire-holding is-${h.tone}" data-banner="${column.id==='villages'?'saltmere':''}" data-work="${h.waiting?'✓'+h.waiting:h.buildCount?'🔨'+h.buildCount:h.underway?'⌛'+h.underway:''}" data-home-action="holding-${column.id}-${escape(h.id)}" title="${escape([h.name,h.status,h.governor?.name,h.work,...h.buildNames].filter(Boolean).join(' · '))}" aria-label="${escape(h.name+', '+h.status+(h.governor?', '+h.role+': '+h.governor.name:'')+(h.work?', '+h.work:''))}"><span class="desk-empire-name">${picture(h.governor?.art,h.assigned?'🪶':'!')}<strong>${escape(h.name)}</strong></span><small>${escape(h.status)}</small>${h.work?`<small class="desk-empire-work">${h.buildCount?'🔨 ':h.waiting?'✓ ':''}${escape(h.work)}</small>`:''}</button>`).join('')||empty('None yet')}</div></section>`).join(''));

  for(const [id,rows]of Object.entries({stores:Array.from({length:m.forgeReady}),kitchen:m.kitchen,training:m.training,hospital:m.hospital,academy:academy.rows.filter(r=>r.state==='ready'),completed:m.completed,building:m.empire.flatMap(c=>c.rows)})){const label=document.getElementById('desk-'+id+'-count');if(label)label.textContent=rows.length?number(rows.length):'';}
  if(focused&&document.activeElement?.dataset?.homeAction!==focused)Array.from(boundSection.querySelectorAll('[data-home-action]')).find(el=>el.dataset.homeAction===focused)?.focus({preventScroll:true});queueLayout();return m;
 }
 // The Academy box is a living painted tree. Only the houses the player has
 // built stand on it, each where they placed it on the Academy screen. The
 // boughs sway, houses rock gently, leaves fall and birds pass by.
 const TREE_ART='assets/academy-living-tree-20260925/';
 // After dusk each house fades to a lit-up night copy, and warm lamplight
 // pools on the bark around it (academy_daynight.js keeps the clock).
 const NIGHT_ART='assets/academy-night-20260925/home/';
 const TREE_HOUSES=new Set(['nursery','observatory','workshop','library','manager_office','crowbar','hospital','kitchen','training','magpie_market','quest_roost','tavern']);
 // Academy placements run x 10–90 and y 8–92; fit them onto the painted boughs.
 const treeSpot=r=>{const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(+v)?+v:50));return [clamp(50+(clamp(r.x,10,90)-50)*1.3,13,87).toFixed(1),(12+(clamp(r.y,8,92)-8)*0.88).toFixed(1)];};
 function academyTree(academy,open){
  const built=academy.rows.filter(r=>r.state==='built'&&TREE_HOUSES.has(r.id)).map(r=>({r,spot:treeSpot(r)})).sort((a,b)=>a.spot[1]-b.spot[1]);
  const houses=built.map(({r,spot:[x,y]},i)=>`<button type="button" class="home-tree-house" data-home-action="academy-${escape(r.id)}" style="--x:${x}%;--y:${y}%;z-index:${2+i};--bob:${(i%4)*-1.3}s" title="${escape(r.name+' · '+r.detail)}" aria-label="${escape(r.name+'. '+r.detail)}"${open?'':' disabled'}><img src="${TREE_ART}${escape(r.id)}.webp" alt="" decoding="async"><img class="home-tree-house-night" data-night-src="${NIGHT_ART}${escape(r.id)}.webp" alt="" decoding="async">${r.id==='kitchen'?'<i class="home-tree-smoke" aria-hidden="true"></i>':''}</button>`).join('');
  const ready=academy.rows.filter(r=>r.state==='ready');
  const readyChip=open&&ready.length?`<button type="button" class="home-tree-ready" data-home-action="academy-${escape(ready[0].id)}" aria-label="${ready.length} ${ready.length===1?'house':'houses'} ready to build">🔨 ${ready.length} ready</button>`:'';
  const free=academy.free?`<button type="button" class="home-tree-free" data-home-action="academy-free" aria-label="${academy.free} free ${academy.free===1?'bird':'birds'} waiting for a job">🕊️ ${academy.free}</button>`:'';
  const boughs=['nw','ne','w','e'].map(k=>`<i class="home-tree-bough is-${k}" aria-hidden="true"></i>`).join('');
  const pools=built.map(({spot:[x,y]})=>`<i class="home-tree-pool" style="--x:${x}%;--y:${y}%"></i>`).join('');
  const leaves=[0,1,2,3,4].map(i=>`<i class="home-tree-leaf" style="--x:${12+i*18}%;--fall:${9+i*2.3}s;--wait:${-i*2.7}s"></i>`).join('');
  const motes=[0,1,2,3,4,5].map(i=>`<i class="home-tree-mote" style="--x:${15+i*13}%;--y:${30+(i*23)%50}%;--drift:${6+i*1.4}s;--wait:${-i*1.9}s"></i>`).join('');
  const birds='<i class="home-tree-bird" aria-hidden="true"></i><i class="home-tree-bird is-late" aria-hidden="true"></i>';
  const note=!open?'Opens as you follow your Quests':built.length?'':'Build your first house in the Academy';
  return `<div class="home-tree${open?'':' is-closed'}" data-home-action="panel-academy" role="group" aria-label="Your Academy tree, ${built.length} ${built.length===1?'house':'houses'} built"><div class="home-tree-sway"><div class="home-tree-stage"><div class="home-tree-sky" data-dn-sky aria-hidden="true"></div><div class="home-tree-night" data-dn-art aria-hidden="true"></div><img class="home-tree-art" src="${TREE_ART}tree.webp" alt="" decoding="async"><img class="home-tree-art is-wide" src="${TREE_ART}tree-wide.webp" alt="" decoding="async">${boughs}<div class="home-tree-pools" aria-hidden="true">${pools}</div>${houses}</div></div>${birds}<div class="home-tree-light" aria-hidden="true"></div><div class="home-tree-dusk" aria-hidden="true"></div>${motes}${leaves}${readyChip}${free}${note?`<p class="home-tree-note">${note}</p>`:''}</div>`;
 }
 function applyProgression(m,academy,academyOpen){
  const summaries={stores:m.forgeReady?m.forgeReady+' ready to collect':'Weapons, armour & spells',kitchen:m.kitchen.length?m.kitchen.length+' to feed':'All well fed',training:m.training.length?(m.training.some(s=>s.ready)?m.training.filter(s=>s.ready).length+' ready to claim':m.training.length+' active drills'):'No active drills',hospital:m.hospital.length?m.hospital.length+' need care':'All healthy',completed:m.completed.length+' buildings to check',building:m.completed.length?m.completed.length+' completed':m.villageDesk.length+' villages',academy:academyOpen?academy.built+' of '+academy.total+' built'+(academy.ready?' · '+academy.ready+' ready':''):'Not open yet'};
  // Layout B is stable even before its features unlock. Native actions still
  // enforce real gates; empty/locked panels never imply ownership or progress.
  const ids=['building','discover','today','stores','kitchen','training','hospital','academy'],featured='building',main=boundSection.querySelector('.scan-home-main');
  for(const id of ['kitchen','training','hospital'])if(!m.gates[id])summaries[id]='Not built yet';
  if(!m.gates.forge)summaries.stores='Follow your Quests';
  boundSection.classList.add('progressive-home');main.dataset.panelCount=ids.length;boundSection.dataset.homeDensity=ids.length>4?'full':ids.length>2?'growing':'early';
  document.getElementById('desk-building-title').textContent='Your Empire';document.getElementById('desk-stores-title').textContent='Crafting';
  document.getElementById('homeNoticesVillages').hidden=!m.villageDesk.length;
  for(const id of ['discover','today','stores','kitchen','training','hospital','academy','building']){
   const el=panelElement(id);if(!el)continue;el.hidden=!ids.includes(id);el.dataset.homePanel=id;el.classList.toggle('home-panel-featured',id===featured);
   if(summaries[id]){let summary=el.querySelector('.desk-panel-summary');if(!summary){summary=document.createElement('p');summary.className='desk-panel-summary';el.querySelector('.desk-panel-heading').after(summary);}summary.textContent=summaries[id];}
  }
  layoutModel={ids,featured};
 }
 function panelElement(id){return boundSection.querySelector(id==='discover'?'.scan-home-start':id==='today'?'.scan-home-today':'.desk-panel-'+id);}
 function queueLayout(){if(layoutFrame||!layoutModel)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;fitLayout();});}
 function fitLayout(){
  if(!options?.visible()||!layoutModel)return;
  const main=boundSection.querySelector('.scan-home-main'),width=main.clientWidth,{ids,featured}=layoutModel;
  const shortLandscape=matchMedia('(orientation:landscape) and (max-height:550px)').matches,compactKit=false,kit=boundSection.querySelector('.desk-equipment-control'),kitHost=compactKit?boundSection.querySelector('.scan-home-command-bar'):panelElement('today');
  if(kit.parentElement!==kitHost)kitHost.append(kit);boundSection.dataset.equipmentInHeader=String(compactKit);
  const fullEmpire=ids.includes('building'),others=ids.filter(id=>!['building','discover','today','academy'].includes(id)),columns=shortLandscape||width>=760?4:2,careColumns=columns/2;
  const key=[width,main.clientHeight,columns,...ids,...ids.map(id=>!!panelElement(id).querySelector('.desk-panel-scroll button'))].join('|');if(key===layoutKey)return;layoutKey=key;
  const dense=main.clientHeight<440,tinyPortrait=matchMedia('(orientation:portrait) and (max-height:650px)').matches,scanHeight=tinyPortrait?48:dense?56:68,goalHeight=50,careRows=Math.ceil(others.length/careColumns),otherMin=dense?44:careColumns>1?88:54;
  const fitStyle=getComputedStyle(main),fitGap=parseFloat(fitStyle.rowGap)||0,fitPadding=(parseFloat(fitStyle.paddingTop)||0)+(parseFloat(fitStyle.paddingBottom)||0),trackCount=(fullEmpire?3:2)+careRows;
  const tile=Math.max(44,Math.min(width<760?104:128,Math.floor((width-36)/3),Math.floor(main.clientHeight-scanHeight-goalHeight-careRows*otherMin-(trackCount-1)*fitGap-fitPadding-70)));
  const tracks=[];let row=1;
  main.style.setProperty('--home-columns',columns);main.style.setProperty('--empire-tile-size',tile+'px');
  if(fullEmpire){panelElement('building').style.gridArea=`${row} / 1 / ${row+1} / ${columns+1}`;tracks.push((tile+70)+'px');row++;}
  panelElement('discover').style.gridArea=`${row} / 1 / ${row+1} / ${columns+1}`;tracks.push(scanHeight+'px');row++;
  panelElement('today').style.gridArea=`${row} / 1 / ${row+1} / ${columns+1}`;tracks.push(goalHeight+'px');row++;
  // Rooms stack down the left; the condensed Academy fills the right.
  others.forEach((id,i)=>{const r=row+Math.floor(i/careColumns),col=1+i%careColumns;panelElement(id).style.gridArea=`${r} / ${col} / ${r+1} / ${col+1}`;});
  for(const id of others)panelElement(id).classList.toggle('home-panel-stacked',careColumns===1);
  panelElement('academy').style.gridArea=`${row} / ${careColumns+1} / ${row+careRows} / ${columns+1}`;
  for(let i=0;i<careRows;i++)tracks.push(`minmax(${otherMin}px,1fr)`);
  const rows=tracks.length;main.style.setProperty('--home-rows',rows);main.style.setProperty('--home-tracks',tracks.join(' '));
  for(const id of ids){
   const el=panelElement(id),h=el.clientHeight;
   el.classList.toggle('home-panel-detail',h>=188&&el.clientWidth>=180);
   el.classList.toggle('home-panel-tight',el.classList.contains('home-panel-stacked')&&h<48);
   // Keep a complete, independently scrollable list when one whole action
   // fits below the heading/summary. Smaller panels retain their full-size
   // room heading and count rather than exposing a clipped half-button.
   const minimum=id==='building'?88:id==='academy'?96:100;
   el.classList.toggle('home-panel-list',!!el.querySelector('.desk-panel-scroll button')&&h>=minimum&&el.clientWidth>=140);
  }
  const style=getComputedStyle(main),gap=parseFloat(style.rowGap)||0,padding=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
  const required=(fullEmpire?tile+70:0)+scanHeight+goalHeight+careRows*otherMin+(rows-1)*gap+padding;
  boundSection.dataset.homeConstrained=String(main.clientHeight<required);
  main.dataset.minimumHeight=String(required);
 }
 function onClick(event){if(event.target.closest('[data-build-next]')){const i=buildOptions.findIndex(b=>b.id===buildSelection);buildSelection=buildOptions[(i+1)%buildOptions.length]?.id;renderBuildOption();return;}if(event.target.closest('[data-home-notices-close]')){closeNotices();return;}const button=event.target.closest('[data-home-action]');if(button&&boundSection.contains(button)){const target=targets.get(button.dataset.homeAction);if(target?.kind==='home-notices'){openNotices(button);return;}if(target){closeNotices(false);options.open(target);}}}
 let noticesFocus,buildOptions=[],buildSelection=null;
 function renderBuildOption(){
  const host=document.getElementById('deskBuildOptions');if(!host)return;const b=buildOptions.find(b=>b.id===buildSelection)||buildOptions[0];buildSelection=b?.id||null;targets.delete('available-build');if(b)targets.set('available-build',b.target);
  update('deskBuildOptions',{id:b?.id,count:buildOptions.length,name:b?.name},()=>b?`<button type="button" class="desk-build-open" data-home-action="available-build" title="${escape('Build '+b.name+' · '+b.place)}" aria-label="${escape('Build '+b.name+' at '+b.place)}">${picture(b.art,b.icon||'🔨')}</button><button type="button" data-build-next title="Next available building" aria-label="Next available building" ${buildOptions.length<2?'disabled':''}>›</button><small title="${escape(b.name)}">${escape(b.name)}</small>`:'<p class="desk-empty">Nothing to build yet</p>');
 }
 function openNotices(button){const el=document.getElementById('homeBuildingNotices');noticesFocus=button;el.showModal();el.classList.add('show');el.querySelector('button').focus();}
 function closeNotices(restore=true){const el=document.getElementById('homeBuildingNotices');if(!el?.classList.contains('show'))return;el.classList.remove('show');el.close();if(restore)noticesFocus?.focus({preventScroll:true});}
 function bind(next){options=next;const section=document.getElementById('screen-scan');if(boundSection!==section){boundSection?.removeEventListener('click',onClick);section.addEventListener('click',onClick);section.addEventListener('error',e=>{if(e.target.matches('.desk-mini-art img'))e.target.remove();},true);boundSection=section;
   if(!document.getElementById('homeBuildingNotices')){const modal=document.createElement('dialog');modal.id='homeBuildingNotices';modal.className='modal-overlay';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','homeBuildingNoticesTitle');modal.innerHTML='<div class="home-notices-card"><header><h2 id="homeBuildingNoticesTitle">Completed buildings</h2><button type="button" data-home-notices-close>Close</button></header><div class="home-notices-list"></div><button id="homeNoticesVillages" type="button" data-home-action="panel-completed">Open your villages</button></div>';modal.querySelector('.home-notices-list').append(section.querySelector('.desk-panel-completed'));section.append(modal);
    modal.addEventListener('cancel',e=>{e.preventDefault();closeNotices();});
    modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeNotices();}if(e.key==='Tab'){const focusable=[...modal.querySelectorAll('button')].filter(el=>!el.hidden&&!el.closest('[hidden]')&&el.offsetHeight>0),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    new MutationObserver(()=>{if(!modal.classList.contains('show')&&modal.contains(document.activeElement))noticesFocus?.focus({preventScroll:true});}).observe(modal,{attributes:true,attributeFilter:['class']});
   }
   signatures.clear();layoutKey='';layoutObserver?.disconnect();layoutObserver=new ResizeObserver(queueLayout);layoutObserver.observe(section.querySelector('.scan-home-main'));window.addEventListener('resize',queueLayout,{passive:true});
   const session=document.getElementById('scanHomeSession'),photo=document.getElementById('photoIdStatus');
   if(photo)new MutationObserver(()=>{if(!session.hidden&&!photo.hidden)session.open=true;}).observe(photo,{attributes:true,attributeFilter:['hidden']});
   section.addEventListener('click',e=>{if(e.target.closest('#captureBtn,#scanBtn,#scanImageBtn,#scanSoundBtn'))openSession();},true);
   session?.addEventListener('toggle',()=>{if(!session.open)closeSession();});
   const stop=document.getElementById('deskSessionStop'),syncStop=()=>{if(stop)stop.hidden=!options.listening?.();};stop?.addEventListener('click',()=>{options.stopListening?.();syncStop();});new MutationObserver(syncStop).observe(document.getElementById('scanBtn'),{childList:true,subtree:true});syncStop();
   section.addEventListener('keydown',e=>{if(e.key==='Escape'&&session?.open&&!document.getElementById('birdCropOverlay')?.classList.contains('show')){closeSession();document.getElementById('captureBtn')?.focus();e.stopPropagation();}});
}}
 function openSession(){if(!options?.visible())return;const session=document.getElementById('scanHomeSession');session.hidden=false;session.open=true;}
 function closeSession(){const session=document.getElementById('scanHomeSession');if(!session)return;const wasVisible=!session.hidden;session.open=false;session.hidden=true;if(wasVisible&&boundSection.classList.contains('camera-mode'))options.closeSession?.();}
 root.BurbzScanHome={bind,render,openSession,closeSession};
})(globalThis);
