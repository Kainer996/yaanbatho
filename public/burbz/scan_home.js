/* Live desk panels borrow the existing inventory, care and management actions. */
(function(root){'use strict';const C=root.BurbzScanHomeCore;let options,targets=new Map(),boundSection;const signatures=new Map();let layoutModel,layoutFrame=0,layoutObserver,layoutKey="",lastModel=null,buildDialog,buildDialogFocus;
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=n=>n.toLocaleString('en-GB');
 const icon=key=>`<img src="${escape(options.icon(key))}" alt="" loading="lazy" decoding="async">`;
 const picture=(src,fallback)=>`<span class="desk-mini-art" aria-hidden="true"><span>${escape(fallback||'🪶')}</span>${src?`<img src="${escape(src)}" alt="" loading="lazy" decoding="async">`:''}</span>`;
 function ensureOuterHomeRails(){
  const section=boundSection||document.getElementById('screen-scan');if(!section||section.querySelector(':scope > .academy-home-screen-rail'))return;
  for(const side of ['left','right']){const rail=document.createElement('span');rail.className='academy-home-screen-rail academy-home-screen-rail-'+side;rail.setAttribute('aria-hidden','true');section.prepend(rail);}
 }
 function update(id,value,html){const host=document.getElementById(id);if(!host)return;const next=JSON.stringify(value);if(signatures.get(id)===next)return;const detailKey=(el,i)=>((el.id&&'id:'+el.id)||'summary:'+i+':'+(el.closest('[data-home-native-room]')?.dataset.homeNativeRoom||el.closest('[data-room]')?.dataset.room||'')+':'+(el.querySelector('summary')?.textContent||'').trim());const scroll=host.scrollTop,openDetails=[...host.querySelectorAll('details')].map((el,i)=>el.open?detailKey(el,i):null).filter(Boolean);signatures.set(id,next);host.innerHTML=html();[...host.querySelectorAll('details')].forEach((el,i)=>{if(openDetails.includes(detailKey(el,i)))el.open=true;});host.scrollTop=scroll;}
 function row(id,name,detail,art,extra='',disabled=false){return `<button type="button" class="desk-mini-row" data-home-action="${escape(id)}"${disabled?' disabled':''}>${art||''}<span class="desk-mini-copy"><strong>${escape(name)}</strong><small>${escape(detail)}</small>${extra}</span></button>`;}
 function bar(value,label,tone=''){const pct=Math.round(Math.max(0,Math.min(100,value)));return `<span class="desk-mini-meter ${tone}" role="progressbar" aria-label="${escape(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>`;}
 function roomArt(room){return options.roomArt?.(typeof room==='string'?room:room.id)||'';}
 function ensureAcademyHomeHost(){
  let host=document.getElementById('academyHomeTree');if(host)return host;
  ensureOuterHomeRails();
  const main=boundSection.querySelector('.scan-home-main');host=document.createElement('section');host.id='academyHomeTree';host.className='academy-home-tree';host.dataset.homePanel='academy';
  host.innerHTML='<header class="academy-home-header"><div><h2>Academy Home</h2><p id="academyHomeSummary">Rooms and companions</p></div><div class="academy-home-tools"><button type="button" data-home-action="build-rooms">Build rooms</button><button type="button" class="academy-home-explore" data-home-action="academy-explore">3D</button></div></header><div id="academyHomeRooms" class="academy-home-rooms" role="list" aria-label="Academy rooms"></div>';
  main.insertBefore(host,document.getElementById('scanHomeDeskPanels'));
  return host;
 }
 function roomCard(room){
  const img=roomArt(room)||options.icon(room.id);
  const occupied=room.occupantCount?room.occupantCount+' inside':'No one inside';
  const away=room.awayCount?' · '+room.awayCount+' away':'';
  const role=room.role?.staffed?' · '+room.role.name:'';
  const detail=[room.effect,occupied+away+role].filter(Boolean).join(' · ');
  const native=options.roomPanel?.(room.id)||'';
  const artStyle=img?` style="--room-art:url(${escape(img)})"`:'';
  const manage=room.id==='outdoors'?'Focus':room.id==='kitchen'?'Kitchen':room.id==='training'?'Hall':room.id==='hospital'?'Ward':'Full room';
  return `<article class="academy-home-room" data-room="${escape(room.id)}" role="listitem">`+
   `<div class="academy-home-room-banner"${artStyle}>`+
    `<div class="academy-home-room-copy"><h3>${escape(room.icon?room.icon+' ':'')}${escape(room.label)}</h3><p>${escape(detail||'Owned Academy room')}</p><div class="academy-home-room-meta"><span class="academy-home-chip">${escape(room.occupantCount+' birds')}</span></div></div>`+
    `<button type="button" class="academy-home-room-open" data-home-action="academy-room-${escape(room.id)}">${escape(manage)}</button>`+
   `</div>`+
   `<div class="academy-home-room-native">${native}</div>`+
  `</article>`;
 }
 function renderAcademyHome(m){
  const host=ensureAcademyHomeHost(),model=m.academy||{rooms:[],counts:{owned:0,catalog:0}},owned=(model.rooms||[]).filter(room=>room&&room.owned);
  host.dataset.ownedCount=String(owned.length);host.classList.toggle('academy-home-few',owned.length<=4);host.classList.toggle('academy-home-many',owned.length>6);
  const summary=document.getElementById('academyHomeSummary');if(summary)summary.textContent=owned.length+' of '+(model.counts?.catalog||model.rooms?.length||13)+' rooms built · '+(model.counts?.occupants||0)+' birds home';
  targets.set('build-rooms',{kind:'build-rooms'});targets.set('academy-explore',{kind:'academy-explore'});
  owned.forEach(room=>{targets.set('academy-room-'+room.id,{kind:'academy-room',id:room.id});});
  update('academyHomeRooms',{panel:options.roomPanelSignature?.(),owned:owned.map(room=>({id:room.id,label:room.label,count:room.occupantCount,away:room.awayCount,role:room.role?.birdId,coord:room.coordinates}))},()=>owned.map(roomCard).join('')||'<p class="desk-empty">Build the Birdhouse to start the Academy rooms.</p>');
 }
 function ensureBuildDialog(){
  if(buildDialog)return buildDialog;
  buildDialog=document.createElement('dialog');buildDialog.id='academyBuildPicker';buildDialog.className='academy-build-picker';buildDialog.setAttribute('aria-modal','true');buildDialog.setAttribute('aria-labelledby','academyBuildPickerTitle');
  buildDialog.innerHTML='<div class="academy-build-picker-card"><header><div><h2 id="academyBuildPickerTitle">Build rooms</h2><p>Choose a room, then confirm Build.</p></div><button type="button" data-build-picker-close>Close</button></header><div id="academyBuildPickerList" class="academy-build-picker-list" role="list"></div></div>';
  document.body.append(buildDialog);
  buildDialog.addEventListener('cancel',e=>{e.preventDefault();closeBuildPicker();});
  buildDialog.addEventListener('click',e=>{if(e.target.closest('[data-build-picker-close]'))closeBuildPicker();});
  buildDialog.addEventListener('click',onClick);
  buildDialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeBuildPicker();return;}if(e.key==='Tab'){const focusable=[...buildDialog.querySelectorAll('button,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&!el.closest('[hidden]')&&el.offsetHeight>0),first=focusable[0],last=focusable.at(-1);if(!first)return;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  return buildDialog;
 }
 function renderBuildPicker(m=lastModel,focusId){
  if(!m)return;const dialog=ensureBuildDialog(),rows=m.academyBuildRows||[],host=dialog.querySelector('#academyBuildPickerList');
  rows.forEach(row=>{targets.set('academy-build-'+row.id,{kind:'academy-build-explicit',id:row.id});targets.set('academy-build-open-'+row.id,{kind:'academy-room',id:row.room||row.id});targets.set('academy-build-help-'+row.id,{kind:'academy-build-help',id:row.id});});
  host.innerHTML=rows.map(row=>{
   const disabled=row.status!=='available'&&!(row.id==='kitchen'&&row.status==='unaffordable'),built=row.status==='built',action=built?'academy-build-open-'+row.id:'academy-build-'+row.id,help=row.status==='available'||built?'':'academy-build-help-'+row.id;
   const actionLabel=built?'Open':'Build',chip=row.chip||row.status;
   return `<article class="academy-building-card ${escape(row.status)}${row.recommended?' recommended':''}" data-building="${escape(row.id)}" role="listitem">`+
    `<img class="academy-building-art" src="${escape(row.asset||options.icon(row.id))}" alt="" loading="lazy" decoding="async">`+
    `<div class="academy-building-body"><h3>${escape(row.icon?row.icon+' ':'')}${escape(row.label)}</h3><p>${escape(row.effect||'Academy room')}</p><div class="academy-building-meta"><span class="academy-building-chip">${escape(chip)}</span><span>${escape(row.costLabel||'')}</span></div></div>`+
    `<div class="academy-building-actions"><button type="button" data-home-action="${escape(action)}"${disabled&&!built?' disabled':''}>${escape(actionLabel)}</button>${help?`<button type="button" data-home-action="${escape(help)}">Help</button>`:''}</div>`+
   `</article>`;
  }).join('')||'<p class="desk-empty">No Academy rooms are available.</p>';
  if(focusId)requestAnimationFrame(()=>host.querySelector('[data-building="'+CSS.escape(focusId)+'"] button:not(:disabled),[data-building="'+CSS.escape(focusId)+'"]')?.focus({preventScroll:true}));
 }
 function openBuildPicker(focusId){const dialog=ensureBuildDialog();buildDialogFocus=document.activeElement;renderBuildPicker(lastModel,focusId);if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>dialog.querySelector(focusId?'[data-building="'+CSS.escape(focusId)+'"] button:not(:disabled)':'button[data-build-picker-close]')?.focus({preventScroll:true}));}
 function closeBuildPicker(restore=true){const dialog=buildDialog;if(!dialog?.open)return;dialog.close();if(restore)buildDialogFocus?.focus({preventScroll:true});}
 function focusRoom(roomId){const el=document.querySelector('#academyHomeRooms [data-room="'+CSS.escape(roomId)+'"]');if(!el)return false;el.classList.add('quest-guided');el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});el.querySelector('button')?.focus({preventScroll:true});setTimeout(()=>el.classList.remove('quest-guided'),3200);return true;}
 // Room refreshes replace native controls as well as Home action buttons.
 function restoreHomeFocus(active){
  if(!active||active.isConnected)return;
  let next=active.id?document.getElementById(active.id):null;
  if(!next){
   const attribute=active.dataset?.tradeKey?'tradeKey':'homeAction',key=active.dataset?.[attribute];
   if(key)next=Array.from(boundSection.querySelectorAll(attribute==='tradeKey'?'[data-trade-key]':'[data-home-action]')).find(el=>el.dataset[attribute]===key);
  }
  if(next&&boundSection.contains(next))next.focus({preventScroll:true});
 }
 function render(snapshot){if(!options?.visible())return;const m=C.derive(snapshot),focused=boundSection.contains(document.activeElement)?document.activeElement:null;lastModel=m;targets=new Map();
  targets.set('player-equipment',{kind:'player-equipment'});
  applyProgression(m);
  renderAcademyHome(m);
  const headings={stores:{kind:'forge'},kitchen:{kind:'kitchen'},training:{kind:'training'},hospital:{kind:'hospital'},completed:{kind:'villages'},building:{kind:'villages'}};for(const [id,target]of Object.entries(headings))targets.set('panel-'+id,target);
  const register=(prefix,rows)=>rows.forEach(r=>targets.set(prefix+r.id,r.target));register('store-',m.stores);m.equipment.forEach(i=>targets.set('equip-'+i.slot,i.target));register('feed-',m.kitchen);register('train-',m.training);register('patient-',m.hospital);register('complete-',m.completed);register('',m.builds);
  if(buildDialog?.open)renderBuildPicker(m);
  const brief=m.actions.filter(a=>a.id==='next-quest').slice(0,1);brief.forEach(a=>targets.set(a.id,a.target));
  update('scanHomeActions',brief,()=>brief.map(a=>`<button type="button" class="home-action" data-home-action="${escape(a.id)}" title="${escape(a.title)}">${icon(a.icon)}<span><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><span class="home-action-chevron" aria-hidden="true">›</span></button>`).join('')||'<p class="desk-empty">No active player goal.</p>');
  buildOptions=m.availableBuilds.filter(b=>b.target?.kind!=='academy-build');renderBuildOption();
  const empty=copy=>`<p class="desk-empty">${escape(copy)}</p>`;
  update('desk-stores-list',{ready:m.forgeReady,open:m.gates.forge},()=>row('panel-stores',m.gates.forge?'Open the Forge':'Unlock Crafting',m.gates.forge?(m.forgeReady?m.forgeReady+' ready to collect':'Weapons, armour & spells'):'Follow your Quests',picture(options.icon('forge'),'⚒️')));
  update('desk-kitchen-list',{rows:m.kitchen,open:m.gates.kitchen},()=>m.kitchen.map(b=>{const full=100-b.hunger;return row('feed-'+b.id,b.name,(b.away?'Away · ':b.label+' · ')+Math.round(full)+'% full',picture(b.art),bar(full,'Fullness',b.level),b.away);}).join('')||empty(m.gates.kitchen?'Your birds are well fed.':'Kitchen unlocks as you progress.'));
  update('desk-training-list',{rows:m.training,open:m.gates.training},()=>m.training.map(s=>row('train-'+s.id,s.name,s.ready?'Finished · collect reward':s.detail+' · '+Math.max(1,Math.ceil(s.remaining/60000))+'m',null,bar(s.ready?100:s.progress,'Training progress'))).join('')||empty(m.gates.training?'No active drills. Choose a bird to train.':'Training unlocks as you progress.'));
  update('desk-hospital-list',{rows:m.hospital,open:m.gates.hospital},()=>m.hospital.map(b=>row('patient-'+b.id,b.name,Math.round(b.hp)+' / '+Math.round(b.maxHp)+' HP · '+(b.admitted?'Recovering':'Needs care'),picture(b.art),bar(b.hp/b.maxHp*100,'Health'))).join('')||empty(m.gates.hospital?'No injured birds.':'Hospital unlocks as you progress.'));
  update('desk-completed-list',m.completed,()=>m.completed.map(n=>row('complete-'+n.id,n.name,n.detail,picture(null,n.icon))).join('')||empty('No unchecked buildings.'));
  for(const column of m.empire)for(const holding of column.rows)targets.set('holding-'+column.id+'-'+holding.id,holding.target);
  targets.set('building-notices',{kind:'home-notices'});
  let noticeButton=document.getElementById('desk-empire-notices');
  if(!noticeButton){noticeButton=document.createElement('button');noticeButton.id='desk-empire-notices';noticeButton.type='button';noticeButton.dataset.homeAction='building-notices';panelElement('building').querySelector('.desk-panel-heading').after(noticeButton);}
  noticeButton.hidden=!m.completed.length;noticeButton.textContent=m.completed.length+' completed · check';
  update('desk-building-list',m.empire,()=>m.empire.map(column=>`<section class="desk-empire-column" aria-labelledby="desk-empire-${column.id}"><h3 id="desk-empire-${column.id}">${column.title}</h3><div class="desk-empire-holdings" tabindex="0" role="region" aria-label="${column.title}">${column.rows.map(h=>`<button type="button" class="desk-empire-holding is-${h.tone}" data-banner="${column.id==='villages'?'saltmere':''}" data-work="${h.waiting?'✓'+h.waiting:h.buildCount?'🔨'+h.buildCount:h.underway?'⌛'+h.underway:''}" data-home-action="holding-${column.id}-${escape(h.id)}" title="${escape([h.name,h.status,h.governor?.name,h.work,...h.buildNames].filter(Boolean).join(' · '))}" aria-label="${escape(h.name+', '+h.status+(h.governor?', '+h.role+': '+h.governor.name:'')+(h.work?', '+h.work:''))}"><span class="desk-empire-name">${picture(h.governor?.art,h.assigned?'🪶':'!')}<strong>${escape(h.name)}</strong></span><small>${escape(h.status)}</small>${h.work?`<small class="desk-empire-work">${h.buildCount?'🔨 ':h.waiting?'✓ ':''}${escape(h.work)}</small>`:''}</button>`).join('')||empty('None yet')}</div></section>`).join(''));

  for(const [id,rows]of Object.entries({stores:Array.from({length:m.forgeReady}),kitchen:m.kitchen,training:m.training,hospital:m.hospital,completed:m.completed,building:m.empire.flatMap(c=>c.rows)})){const label=document.getElementById('desk-'+id+'-count');if(label)label.textContent=rows.length?number(rows.length):'';}
  restoreHomeFocus(focused);queueLayout();return m;
 }
 function applyProgression(m){
  ensureOuterHomeRails();
  const summaries={stores:m.forgeReady?m.forgeReady+' ready to collect':'Weapons, armour & spells',kitchen:m.kitchen.length?m.kitchen.length+' to feed':'All well fed',training:m.training.length?(m.training.some(s=>s.ready)?m.training.filter(s=>s.ready).length+' ready to claim':m.training.length+' active drills'):'No active drills',hospital:m.hospital.length?m.hospital.length+' need care':'All healthy',completed:m.completed.length+' buildings to check',building:m.completed.length?m.completed.length+' completed':m.villageDesk.length+' villages'};
  const ids=['discover','today','stores','building'],featured='academy',main=boundSection.querySelector('.scan-home-main');
  for(const id of ['kitchen','training','hospital'])if(!m.gates[id])summaries[id]='Not built yet';
  if(!m.gates.forge)summaries.stores='Follow your Quests';
  boundSection.classList.add('progressive-home','academy-home-active');main.dataset.panelCount=ids.length+1;boundSection.dataset.homeDensity=(m.academy?.counts?.owned||0)>6?'full':'growing';boundSection.dataset.academyOwnedCount=String(m.academy?.counts?.owned||0);
  document.getElementById('desk-building-title').textContent='Your Empire';document.getElementById('desk-stores-title').textContent='Crafting';
  document.getElementById('homeNoticesVillages').hidden=!m.villageDesk.length;
  for(const id of ['discover','today','stores','kitchen','training','hospital','building']){
   const el=panelElement(id);if(!el)continue;el.hidden=!ids.includes(id);el.dataset.homePanel=id;el.classList.toggle('home-panel-featured',id===featured);
   if(summaries[id]){let summary=el.querySelector('.desk-panel-summary');if(!summary){summary=document.createElement('p');summary.className='desk-panel-summary';el.querySelector('.desk-panel-heading').after(summary);}summary.textContent=summaries[id];}
  }
  layoutModel={ids,featured,owned:m.academy?.counts?.owned||0};
 }
 function panelElement(id){return boundSection.querySelector(id==='discover'?'.scan-home-start':id==='today'?'.scan-home-today':'.desk-panel-'+id);}
 function queueLayout(){if(layoutFrame||!layoutModel)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;fitLayout();});}
 function fitLayout(){
  if(!options?.visible()||!layoutModel)return;
  const main=boundSection.querySelector('.scan-home-main'),width=main.clientWidth,{ids}=layoutModel;
  const shortLandscape=matchMedia('(orientation:landscape) and (max-height:550px)').matches,compactKit=false,kit=boundSection.querySelector('.desk-equipment-control'),kitHost=compactKit?boundSection.querySelector('.scan-home-command-bar'):panelElement('today');
  if(kit.parentElement!==kitHost)kitHost.append(kit);boundSection.dataset.equipmentInHeader=String(compactKit);
  const key=[width,main.clientHeight,shortLandscape,layoutModel.owned,...ids,...ids.map(id=>!!panelElement(id).querySelector('.desk-panel-scroll button'))].join('|');if(key===layoutKey)return;layoutKey=key;
  main.style.removeProperty('--home-columns');main.style.removeProperty('--home-tracks');main.style.removeProperty('--home-rows');
  for(const id of ['discover','today','stores','building','kitchen','training','hospital']){const el=panelElement(id);if(el)el.style.gridArea='';}
  const tile=Math.max(44,Math.min(width<760?104:128,Math.floor((width-36)/3)));main.style.setProperty('--empire-tile-size',tile+'px');
  for(const id of ids){
   const el=panelElement(id),h=el.clientHeight;
   el.classList.toggle('home-panel-detail',h>=188&&el.clientWidth>=180);
   // Keep a complete, independently scrollable list when one whole action
   // fits below the heading/summary. Smaller panels retain their full-size
   // room heading and count rather than exposing a clipped half-button.
   const minimum=id==='building'?88:100;
   el.classList.toggle('home-panel-list',!!el.querySelector('.desk-panel-scroll button')&&h>=minimum&&el.clientWidth>=140);
  }
  const required=main.scrollHeight;
  boundSection.dataset.homeConstrained=String(main.clientHeight<required);
  main.dataset.minimumHeight=String(required);
 }
 function onClick(event){if(event.target.closest('[data-build-next]')){const i=buildOptions.findIndex(b=>b.id===buildSelection);buildSelection=buildOptions[(i+1)%buildOptions.length]?.id;renderBuildOption();return;}if(event.target.closest('[data-home-notices-close]')){closeNotices();return;}const button=event.target.closest('[data-home-action]');if(!button)return;const insideHome=boundSection?.contains(button),insideBuild=buildDialog?.contains(button);if(!insideHome&&!insideBuild)return;const target=targets.get(button.dataset.homeAction);if(target?.kind==='home-notices'){openNotices(button);return;}if(!target)return;closeNotices(false);if(target.kind==='build-rooms'){options.open(target);return;}if(insideBuild&&target.kind==='academy-room')closeBuildPicker(false);if(target.kind==='academy-build-explicit'){button.disabled=true;button.dataset.busy='true';try{options.open(target);}finally{setTimeout(()=>{if(button.isConnected){button.disabled=false;delete button.dataset.busy;}},600);}return;}options.open(target);}
 let noticesFocus,buildOptions=[],buildSelection=null;
 function renderBuildOption(){
  const host=document.getElementById('deskBuildOptions');if(!host)return;const b=buildOptions.find(b=>b.id===buildSelection)||buildOptions[0];buildSelection=b?.id||null;targets.delete('available-build');targets.set('build-rooms',{kind:'build-rooms'});if(b)targets.set('available-build',b.target);
  update('deskBuildOptions',{rooms:true,id:b?.id,count:buildOptions.length,name:b?.name},()=>`<button type="button" class="desk-build-open academy-build-rooms-trigger" data-home-action="build-rooms" title="Build Academy rooms" aria-label="Build Academy rooms">${picture(options.icon('academy'),'🔨')}</button>${b?`<button type="button" data-home-action="available-build" title="${escape('Build '+b.name+' · '+b.place)}" aria-label="${escape('Build '+b.name+' at '+b.place)}">${picture(b.art,b.icon||'🏗️')}</button>`:`<button type="button" disabled title="No settlement build ready" aria-label="No settlement build ready">›</button>`}<small title="${escape(b?b.name:'Rooms')}">${escape(b?b.name:'Rooms')}</small>`);
 }
 function openNotices(button){const el=document.getElementById('homeBuildingNotices');noticesFocus=button;el.showModal();el.classList.add('show');el.querySelector('button').focus();}
 function closeNotices(restore=true){const el=document.getElementById('homeBuildingNotices');if(!el?.classList.contains('show'))return;el.classList.remove('show');el.close();if(restore)noticesFocus?.focus({preventScroll:true});}
 function bind(next){options=next;const section=document.getElementById('screen-scan');if(boundSection!==section){boundSection?.removeEventListener('click',onClick);buildDialog?.removeEventListener('click',onClick);section.addEventListener('click',onClick);section.addEventListener('error',e=>{if(e.target.matches('.desk-mini-art img'))e.target.remove();},true);boundSection=section;
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
 root.BurbzScanHome={bind,render,openSession,closeSession,openBuildPicker,closeBuildPicker,refreshBuildPicker:focusId=>renderBuildPicker(lastModel,focusId),focusRoom};
})(globalThis);
