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
  applyProgression(m);
  const headings={stores:{kind:'stores-gear'},kitchen:{kind:'kitchen'},training:{kind:'training'},hospital:{kind:'hospital'},completed:{kind:'villages'},building:m.completed.length?{kind:'home-notices'}:{kind:'villages'}};for(const [id,target]of Object.entries(headings))targets.set('panel-'+id,target);
  const register=(prefix,rows)=>rows.forEach(r=>targets.set(prefix+r.id,r.target));register('store-',m.stores);m.equipment.forEach(i=>targets.set('equip-'+i.slot,i.target));register('feed-',m.kitchen);register('train-',m.training);register('patient-',m.hospital);register('complete-',m.completed);register('',m.builds);
  const brief=m.actions.filter(a=>['next-quest','quests','forge'].includes(a.id)).slice(0,1);brief.forEach(a=>targets.set(a.id,a.target));if(m.walk&&!brief.length){targets.set('walk',m.walk.target);brief.push({id:'walk',title:m.walk.name,detail:'Resume your walk',icon:'map'});}
  update('scanHomeActions',brief,()=>brief.map(a=>`<button type="button" class="home-action" data-home-action="${escape(a.id)}">${icon(a.icon)}<span><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><span class="home-action-chevron" aria-hidden="true">›</span></button>`).join('')||'<p class="desk-empty">Your next adventure starts with a bird.</p>');
  const empty=copy=>`<p class="desk-empty">${escape(copy)}</p>`;
  update('desk-stores-list',{rows:m.stores,open:m.gates.inventory},()=>m.stores.map(s=>`<button type="button" class="desk-gear" data-home-action="store-${escape(s.id)}" aria-label="${escape(s.name)}, ${s.count} in Stores">${picture(s.art,s.icon)}<span>${escape(s.name)}</span><b>×${s.count}</b></button>`).join('')||empty(m.gates.inventory?'No weapons or armour in Stores.':'Stores unlock as you progress.'));
  update('desk-kitchen-list',{rows:m.kitchen,open:m.gates.kitchen},()=>m.kitchen.map(b=>{const full=100-b.hunger;return row('feed-'+b.id,b.name,(b.away?'Away · ':b.label+' · ')+Math.round(full)+'% full',picture(b.art),bar(full,'Fullness',b.level),b.away);}).join('')||empty(m.gates.kitchen?'Your birds are well fed.':'Kitchen unlocks as you progress.'));
  update('desk-training-list',{rows:m.training,open:m.gates.training},()=>m.training.map(s=>row('train-'+s.id,s.name,s.ready?'Finished · collect reward':s.detail+' · '+Math.max(1,Math.ceil(s.remaining/60000))+'m',null,bar(s.ready?100:s.progress,'Training progress'))).join('')||empty(m.gates.training?'No active drills. Choose a bird to train.':'Training unlocks as you progress.'));
  update('desk-hospital-list',{rows:m.hospital,open:m.gates.hospital},()=>m.hospital.map(b=>row('patient-'+b.id,b.name,Math.round(b.hp)+' / '+Math.round(b.maxHp)+' HP · '+(b.admitted?'Recovering':'Needs care'),picture(b.art),bar(b.hp/b.maxHp*100,'Health'))).join('')||empty(m.gates.hospital?'No injured birds.':'Hospital unlocks as you progress.'));
  update('desk-completed-list',m.completed,()=>m.completed.map(n=>row('complete-'+n.id,n.name,n.detail,picture(null,n.icon))).join('')||empty('No unchecked buildings.'));
  for(const v of m.villageDesk)targets.set('village-'+v.seed,v.target);
  const assignment=v=>`<span class="desk-assignment ${v.assignment?.assigned?'assigned':'unassigned'}">${picture(v.assignment?.art,v.assignment?.assigned?'🪶':'!')}<span><b>${escape(v.assignment?.role||'Project Manager')}</b><small>${escape(v.assignment?.assigned?v.assignment.name:'Unassigned')}</small></span></span>`;
  const villageBadge=v=>v.waiting?v.waiting+' ready to open':v.underway?v.underway+' building':v.finished?v.finished+' building'+(v.finished===1?'':'s')+' finished':v.builds.length?'Can build':'No work waiting';
  update('desk-building-list',{villages:m.villageDesk,builds:m.builds},()=>m.villageDesk.map(v=>`<section class="desk-village"><button type="button" class="desk-village-head" data-home-action="village-${v.seed}">${icon('village')}<span><strong>${escape(v.name)}</strong><small class="desk-village-badge ${v.waiting?'waiting':v.underway?'underway':v.finished?'finished':v.builds.length?'available':'idle'}">${escape(villageBadge(v))}</small>${assignment(v)}</span></button>${v.waiting?`<p class="desk-village-note">${escape(v.pendingNames.join(', '))} · Tap the finished building or its notice to open</p>`:v.underway?`<p class="desk-village-note">${escape(v.underwayNames.join(', '))}</p>`:''}${v.builds.map(b=>row(b.id,b.name,b.detail,picture(null,b.icon))).join('')}</section>`).join('')||empty('Liberate a village to start building.'));

  for(const [id,rows]of Object.entries({stores:m.stores,kitchen:m.kitchen,training:m.training,hospital:m.hospital,completed:m.completed,building:m.villageDesk})){const label=document.getElementById('desk-'+id+'-count');if(label)label.textContent=rows.length?number(rows.length):'';}
  if(focused&&document.activeElement?.dataset?.homeAction!==focused)Array.from(boundSection.querySelectorAll('[data-home-action]')).find(el=>el.dataset.homeAction===focused)?.focus({preventScroll:true});queueLayout();return m;
 }
 // This is a display preference only. Saved game gates are rechecked on every
 // render; a remembered feature can never reveal an unbuilt/locked panel.
 function preferredFeature(panels){
  const ids=panels.items.map(p=>p.id),key='burbz_home_panel_preference_v1';let saved=null;
  try{saved=JSON.parse(localStorage.getItem(key));}catch(_){}
  const added=saved&&Array.isArray(saved.ids)?ids.filter(id=>!saved.ids.includes(id)&&!['today','completed'].includes(id)&&panels.items.find(p=>p.id===id)?.feature!==false):[];
  const featured=added.length?added.reduce((best,id)=>panels.items.find(p=>p.id===id).at>=panels.items.find(p=>p.id===best).at?id:best):ids.includes(saved?.featured)&&panels.items.find(p=>p.id===saved.featured)?.feature!==false?saved.featured:panels.featured;
  const next={ids,featured,dates:JSON.stringify(panels.items)};
  try{if(JSON.stringify(saved)!==JSON.stringify(next))localStorage.setItem(key,JSON.stringify(next));}catch(_){}
  return featured;
 }
 function applyProgression(m){
  const summaries={stores:m.stores.length?m.stores.reduce((n,s)=>n+s.count,0)+' spare items':'No spare gear',kitchen:m.kitchen.length?m.kitchen.length+' to feed':'All well fed',training:m.training.length?(m.training.some(s=>s.ready)?m.training.filter(s=>s.ready).length+' ready to claim':m.training.length+' active drills'):'No active drills',hospital:m.hospital.length?m.hospital.length+' need care':'All healthy',completed:m.completed.length+' buildings to check',building:m.completed.length?m.completed.length+' completed':m.villageDesk.length+' villages'};
  const ids=m.panels.items.map(p=>p.id),featured=preferredFeature(m.panels),main=boundSection.querySelector('.scan-home-main');
  boundSection.classList.add('progressive-home');main.dataset.panelCount=ids.length;boundSection.dataset.homeDensity=ids.length>4?'full':ids.length>2?'growing':'early';
  document.getElementById('desk-building-title').textContent=m.completed.length?'Buildings':'Your villages';
  document.getElementById('homeNoticesVillages').hidden=!m.villageDesk.length;
  for(const id of ['discover','today','stores','kitchen','training','hospital','building']){
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
  const shortLandscape=matchMedia('(orientation:landscape) and (max-height:550px)').matches,compactKit=shortLandscape||(ids.length>4&&width<400&&innerHeight<700),kit=boundSection.querySelector('.desk-equipment-control'),kitHost=compactKit?boundSection.querySelector('.scan-home-command-bar'):panelElement('today');
  if(kit.parentElement!==kitHost)kitHost.append(kit);boundSection.dataset.equipmentInHeader=String(compactKit);
  const columns=ids.length<=2?1:ids.length>=5&&width>=(shortLandscape?350:460)?3:2,others=ids.filter(id=>id!==featured),rows=columns===3?Math.ceil((ids.length+1)/3):1+Math.ceil(others.length/columns);
  const key=[width,main.clientHeight,columns,...ids,featured,...ids.map(id=>!!panelElement(id).querySelector('.desk-panel-scroll button'))].join('|');if(key===layoutKey)return;layoutKey=key;
  main.style.setProperty('--home-columns',columns);main.style.setProperty('--home-rows',rows);
  const compact=ids.length>4,firstMin=compact?88:128,otherMin=compact?66:88;
  main.style.setProperty('--home-tracks',`minmax(${firstMin}px,1.35fr) repeat(${rows-1},minmax(${otherMin}px,1fr)) 44px`);
  const first=panelElement(featured);first.style.gridArea=`1 / 1 / 2 / ${columns===3?3:columns+1}`;
  others.forEach((id,i)=>{const row=columns===3?1+Math.floor((i+2)/3):2+Math.floor(i/columns),col=columns===3?1+(i+2)%3:1+i%columns,remaining=others.length-i;panelElement(id).style.gridArea=`${row} / ${col} / ${row+1} / ${remaining===1?(columns===3?Math.min(columns+1,col+2):columns+1):col+1}`;});
  const session=document.getElementById('scanHomeSession');session.style.gridArea=`${rows+1} / 1 / ${rows+2} / ${columns+1}`;
  for(const id of ids){
   const el=panelElement(id),h=el.clientHeight;
   el.classList.toggle('home-panel-detail',h>=188&&el.clientWidth>=180);
   // Keep a complete, independently scrollable list when one whole action
   // fits below the heading/summary. Smaller panels retain their full-size
   // room heading and count rather than exposing a clipped half-button.
   const minimum=id==='building'?200:100;
   el.classList.toggle('home-panel-list',!!el.querySelector('.desk-panel-scroll button')&&h>=minimum&&el.clientWidth>=140);
  }
  const style=getComputedStyle(main),gap=parseFloat(style.rowGap)||0,padding=(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0);
  const required=firstMin+(rows-1)*otherMin+44+rows*gap+padding;
  boundSection.dataset.homeConstrained=String(main.clientHeight<required);
  main.dataset.minimumHeight=String(required);
 }
 function onClick(event){if(event.target.closest('[data-home-notices-close]')){closeNotices();return;}const button=event.target.closest('[data-home-action]');if(button&&boundSection.contains(button)){const target=targets.get(button.dataset.homeAction);if(target?.kind==='home-notices'){openNotices(button);return;}if(target){closeNotices(false);options.open(target);}}}
 let noticesFocus;
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
   if(photo)new MutationObserver(()=>{if(!photo.hidden)session.open=true;}).observe(photo,{attributes:true,attributeFilter:['hidden']});
   section.addEventListener('click',e=>{if(e.target.closest('#captureBtn,#scanImageBtn'))session.open=true;});
   session?.addEventListener('toggle',()=>{if(!session.open&&section.classList.contains('camera-mode'))options.closeSession?.();});
   const stop=document.getElementById('deskSessionStop'),syncStop=()=>{if(stop)stop.hidden=!options.listening?.();};stop?.addEventListener('click',()=>{options.stopListening?.();syncStop();});new MutationObserver(syncStop).observe(document.getElementById('scanBtn'),{childList:true,subtree:true});syncStop();
   section.addEventListener('keydown',e=>{if(e.key==='Escape'&&session?.open&&!document.getElementById('birdCropOverlay')?.classList.contains('show')){session.open=false;session.querySelector('summary')?.focus();e.stopPropagation();}});
}}
 root.BurbzScanHome={bind,render};
})(globalThis);
