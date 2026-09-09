/* Small live home view; refresh rides the existing save/badge heartbeat. */
(function(root){'use strict';const C=root.BurbzScanHomeCore;let options,signature='',targets=new Map();
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function render(snapshot){if(!options?.visible())return;const model=C.derive(snapshot),next=JSON.stringify(model);if(signature===next)return;signature=next;const host=document.getElementById('scanHomeActions'),vhost=document.getElementById('scanHomeVillages');if(!host||!vhost)return;
  const focused=document.activeElement?.dataset?.homeAction;targets=new Map();
  host.innerHTML=model.actions.map(a=>{targets.set(a.id,a.target);return `<button type="button" class="home-action home-action-${a.tone}" data-home-action="${escape(a.id)}"><img src="${escape(options.icon(a.icon))}" alt=""><span><strong>${escape(a.title)}</strong><small>${escape(a.detail)}</small></span><span class="home-action-chevron" aria-hidden="true">›</span></button>`;}).join('');
  vhost.innerHTML=model.villages.map(v=>{const id='village-'+v.seed;targets.set(id,{kind:'village',seed:v.seed});const happiness=v.pop&&v.happiness!==null?Math.round(v.happiness*100):null;return `<button type="button" class="home-village" data-home-action="${id}"><span class="home-village-name">${escape(v.name)}</span><span class="home-village-mood">${!v.pop?'No residents yet':happiness===null?'Happiness unavailable':happiness+'% happy'}</span><span class="home-village-detail">${v.pop?v.pop+(v.pop===1?' resident':' residents'):'Visit your village'}</span>${happiness===null?'':`<span class="home-happiness-track" aria-hidden="true"><span style="width:${happiness}%"></span></span>`}</button>`;}).join('');
  document.getElementById('scanHomeVillageSection').hidden=model.villageCount===0;
  document.getElementById('scanHomeVillageCount').textContent=model.villageCount===1?'1 village':model.villageCount+' villages';
  const detail=[model.discovered?model.discovered+' species discovered':null,model.flockCount?model.flockCount+(model.flockCount===1?' companion':' companions'):null].filter(Boolean);
  document.getElementById('scanHomeSummary').textContent=detail.join(' · ')||'Every new bird is the start of something.';
  if(focused)document.querySelector(`[data-home-action="${CSS.escape(focused)}"]`)?.focus({preventScroll:true});
 }
 function bind(next){options=next;const section=document.getElementById('screen-scan');section.addEventListener('click',event=>{const button=event.target.closest('[data-home-action]');if(!button)return;const target=targets.get(button.dataset.homeAction);if(target)options.open(target);});document.getElementById('scanHomeAllVillages').addEventListener('click',()=>options.open({kind:'villages'}));}
 root.BurbzScanHome={bind,render};
})(globalThis);
