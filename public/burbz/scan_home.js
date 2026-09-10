/* The live field desk. Refresh uses the existing save/badge heartbeat. */
(function(root){'use strict';const C=root.BurbzScanHomeCore;let options,targets=new Map(),boundSection;const signatures=new Map();
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const number=n=>n.toLocaleString('en-GB');
 const statNumber=n=>n>=1000000?n.toLocaleString('en-GB',{notation:'compact',maximumFractionDigits:1}):number(n);
 const icon=key=>`<img src="${escape(options.icon(key))}" alt="" loading="lazy" decoding="async">`;
 function update(id,value,html){const host=document.getElementById(id);if(!host)return;const next=JSON.stringify(value);if(signatures.get(id)===next)return;signatures.set(id,next);host.innerHTML=html();}
 function render(snapshot){if(!options?.visible())return;const model=C.derive(snapshot),focused=document.activeElement?.dataset?.homeAction;targets=new Map();
  model.actions.forEach(a=>targets.set(a.id,a.target));model.routes.forEach(a=>targets.set(a.id,a.target));model.villages.forEach(v=>targets.set('village-'+v.seed,{kind:'village',seed:v.seed}));if(model.walk)targets.set('walk',model.walk.target);
  update('scanHomeActions',model.actions,()=>model.actions.map(a=>`<button type="button" class="home-action home-action-${a.tone}" data-home-action="${escape(a.id)}">${icon(a.icon)}<span><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><span class="home-action-chevron" aria-hidden="true">›</span></button>`).join('')||'<p class="home-empty">All caught up. A new bird could be waiting just outside.</p>');
  update('scanHomeRoutes',model.routes,()=>model.routes.map(a=>`<button type="button" class="home-route home-route-${a.group}" data-home-action="${escape(a.id)}">${icon(a.icon)}<span><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><span class="home-route-arrow" aria-hidden="true">↗</span></button>`).join(''));
  const taskSummary=document.querySelector('.scan-home-today .scan-home-section-head>span');if(taskSummary)taskSummary.textContent=model.readyCount?number(model.readyCount)+' ready to collect':'Your next small step';
  const routeSection=document.getElementById('scanHomeRouteSection');if(routeSection)routeSection.hidden=!model.routes.length;
  const walkSection=document.getElementById('scanHomeWalkSection');if(walkSection)walkSection.hidden=!model.walk;
  update('scanHomeWalkSection',model.walk,()=>{if(!model.walk)return '';const walk=model.walk;return `<button type="button" class="home-walk" data-home-action="walk">${icon('map')}<span class="home-walk-copy"><small class="home-walk-label">YOUR WALK IS WAITING</small><strong>${escape(walk.name)}</strong><span class="home-walk-detail">${escape(walk.detail)}</span>${walk.progress===null?'':`<span class="home-walk-track" role="progressbar" aria-label="Walk progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(walk.progress*100)}"><span style="width:${walk.progress*100}%"></span></span>`}</span><span class="home-walk-resume">Continue <span aria-hidden="true">↗</span></span></button>`;});
  update('scanHomePlayer',[model.player,model.flockCount,model.discovered],()=>{
   const stats=[];if(model.player.level!==null)stats.push(['level','Level',model.player.level,'profile']);if(model.player.coins!==null)stats.push(['coins','Coins',model.player.coins,'coin']);stats.push(['companions','Companions',model.flockCount,'birdex'],['species','Species',model.discovered,'scan']);
   return stats.map(([id,label,value,key])=>`<div class="home-stat home-stat-${id}">${icon(key)}<span><strong aria-label="${number(value)}" title="${number(value)}">${statNumber(value)}</strong><small>${label}</small></span></div>`).join('');
  });
  update('scanHomeVillages',model.villages,()=>model.villages.map(v=>{const happiness=v.pop&&v.happiness!==null?Math.round(v.happiness*100):null;return `<button type="button" class="home-village" data-home-action="village-${v.seed}"><span class="home-village-header">${icon('village')}<span class="home-village-name">${escape(v.name)}</span><span class="home-route-arrow" aria-hidden="true">↗</span></span><span class="home-village-mood">${!v.pop?'A new beginning':happiness===null?'Happiness unavailable':happiness+'% happy'}</span><span class="home-village-detail">${v.pop?number(v.pop)+(v.pop===1?' resident':' residents'):'No residents yet'}</span>${happiness===null?'':`<span class="home-happiness-track" aria-hidden="true"><span style="width:${happiness}%"></span></span>`}</button>`;}).join(''));
  const villageSection=document.getElementById('scanHomeVillageSection');if(villageSection)villageSection.hidden=model.villageCount===0;
  const villageCount=document.getElementById('scanHomeVillageCount');if(villageCount)villageCount.textContent=model.villageCount===1?'1 village':number(model.villageCount)+' villages';
  const summary=document.getElementById('scanHomeSummary');if(summary)summary.textContent=model.player.name&&model.player.name!=='Bird Trainer'?'Welcome home, '+model.player.name+'.':'Your birds. Your world. Your next adventure.';
  if(focused&&document.activeElement?.dataset?.homeAction!==focused)Array.from(document.querySelectorAll('[data-home-action]')).find(el=>el.dataset.homeAction===focused)?.focus({preventScroll:true});
  return model;
 }
 function onClick(event){const button=event.target.closest('[data-home-action]');if(button&&boundSection.contains(button)){const target=targets.get(button.dataset.homeAction);if(target)options.open(target);}else if(event.target.closest('#scanHomeAllVillages'))options.open({kind:'villages'});}
 function bind(next){options=next;const section=document.getElementById('screen-scan');if(boundSection!==section){boundSection?.removeEventListener('click',onClick);section.addEventListener('click',onClick);boundSection=section;signatures.clear();}}
 root.BurbzScanHome={bind,render};
})(globalThis);
