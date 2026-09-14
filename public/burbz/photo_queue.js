/* Device-local pending captures. A stored photo is not a discovery. */
(function (global) {
  'use strict';
  const DB = 'burbz-pending-photos', STORE = 'captures', MAX_COUNT = 20, MAX_BYTES = 80 * 1024 * 1024;
  const validResult = r => r && r.found === true && r.accepted === true && r.verified === true &&
    r.policy === 'photo-gemini-v410' && r.model === 'gemini-vision' && r.modelName === 'gemini-2.5-flash' &&
    typeof r.confidence === 'number' && Number.isFinite(r.confidence) && r.confidence >= .9 && r.confidence <= 1 &&
    typeof r.species === 'string' && typeof r.scientificName === 'string' && /^[A-Z][a-z]+ [a-z][a-z-]+$/.test(r.scientificName);
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onerror = () => reject(request.error || Error('Photo storage unavailable'));
      request.onblocked = () => reject(Error('Close another Burbz tab to update photo storage'));
      request.onsuccess = () => resolve(request.result);
    });
  }
  async function mutate(fn) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite'), store = tx.objectStore(STORE), read = store.getAll();
        let answer, error;
        read.onsuccess = () => { try { answer = fn(read.result, store); } catch (e) { error = e; tx.abort(); } };
        tx.oncomplete = () => resolve(answer);
        tx.onerror = tx.onabort = () => reject(error || tx.error || Error('Photo could not be saved'));
      });
    } finally { db.close(); }
  }
  const list = owner => mutate(rows => rows.filter(row => row.owner === owner).sort((a,b) => a.created-b.created));
  async function add(owner, blob) {
    if (!owner || !(blob instanceof Blob) || !blob.size || blob.size > 10*1024*1024) throw Error('This photo is too large to save. Choose a smaller photo.');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(x => x.toString(16).padStart(2,'0')).join('');
    return mutate((rows, store) => {
      const existing = rows.find(row => row.owner === owner && row.hash === hash);
      if (existing) return existing;
      if (rows.length >= MAX_COUNT || rows.reduce((sum,row) => sum+row.blob.size,0)+blob.size > MAX_BYTES) throw Error('Saved photos are full. Remove a pending photo before saving another.');
      const item = { id:crypto.randomUUID(), requestId:crypto.randomUUID(), owner, hash, blob, created:Date.now(), status:'queued', message:'Saved on this device. Waiting for a connection.', retryAt:0, manual:false };
      store.put(item); return item;
    });
  }
  const update = (owner,id,fn) => mutate((rows,store) => {
    const item=rows.find(row => row.id===id && row.owner===owner);
    if (!item) return null;
    const value=fn(item);
    if (value) store.put(value); else store.delete(id);
    return value;
  });
  function create(options) {
    let processing=false, active=null, timer=null, stopped=false, panel=null, urls=[], lastOwner='';
    const owner = () => options.owner();
    const notify = message => options.message?.(message);
    function revoke() { urls.forEach(URL.revokeObjectURL); urls=[]; }
    async function render() {
      const scope=owner();
      if (!scope) return;
      const rows=await list(scope);
      if (owner()!==scope) return;
      options.count?.(rows.length);
      if (!panel || panel.hidden) return;
      revoke(); const body=panel.querySelector('[data-photo-list]'); body.replaceChildren();
      panel.querySelector('[data-photo-summary]').textContent = rows.length ? `${rows.length} saved on this device. Identification uses a connection and the shared monthly allowance.` : 'No pending photos. You can keep playing while saved photos wait.';
      rows.forEach(item => {
        const row=document.createElement('article'); row.className='pending-photo-row';
        const img=document.createElement('img'); img.alt='Your saved bird photo'; img.src=URL.createObjectURL(item.blob); urls.push(img.src);
        const details=document.createElement('div'), text=document.createElement('p');
        text.textContent=item.result?.found ? `Ready: ${item.result.species}` : item.message;
        details.append(text);
        const actions=document.createElement('div'); actions.className='pending-photo-actions';
        function button(label,fn) { const b=document.createElement('button'); b.type='button'; b.textContent=label; b.onclick=fn; actions.append(b); }
        button('View photo',() => options.preview?.(item.blob));
        if (validResult(item.result)) button('View result',() => claim(item));
        else if (item.status!=='checking') button('Retry',() => retry(item.id));
        else button('Pause',() => pause(item.id));
        button('Remove',() => remove(item.id));
        details.append(actions);row.append(img,details);body.append(row);
      });
    }
    async function claim(item) {
      if (owner()!==item.owner || !validResult(item.result)) return;
      const token=crypto.randomUUID();
      const latest=await update(item.owner,item.id,current => (current.claimUntil||0)>Date.now()?current:{...current,claimToken:token,claimUntil:Date.now()+60000});
      if (!latest || latest.claimToken!==token || owner()!==item.owner) return;
      try {
        const done=await options.claim(latest);
        if (done && owner()===item.owner) await update(item.owner,item.id,() => null);
        else notify('The result is saved. It could not yet be added to this game; try View result again.');
      } catch (_) { notify('The result is saved, but game storage could not be updated. Try View result again.'); }
      await update(item.owner,item.id,current => current.claimToken===token?{...current,claimToken:null,claimUntil:0}:current);
      await render();
    }
    async function process() {
      if (processing || stopped || navigator.onLine===false) return;
      const scope=owner(); if (!scope) return;
      processing=true;
      try {
        const rows=await list(scope);
        for (const candidate of rows) {
          if (stopped || owner()!==scope || navigator.onLine===false) break;
          if (candidate.result || candidate.manual || candidate.retryAt>Date.now()) continue;
          const lease=crypto.randomUUID();
          const item=await update(scope,candidate.id,current => {
            if (current.manual || current.result || (current.leaseUntil||0)>Date.now()) return current;
            return { ...current,status:'checking',leaseUntil:Date.now()+70000,lease,requestId:current.renewRequest?crypto.randomUUID():current.requestId,renewRequest:false,message:'Checking with Gemini. You can keep playing.' };
          });
          if (!item || item.lease!==lease) continue;
          const controller=new AbortController(); active={id:item.id,owner:scope,controller};
          const timeout=setTimeout(() => controller.abort(),50000);
          await render();
          try {
            const form=new FormData();form.append('image',item.blob,'photo.jpg');form.append('captureSource','camera');
            form.append('photoOwner',scope);form.append('photoRequestId',item.requestId);
            const response=await fetch('api/identify/image',{method:'POST',body:form,signal:controller.signal});
            const result=await response.json();
            if (owner()!==scope || controller.signal.aborted) continue;
            const accepted=response.ok && validResult(result);
            const entry=await update(scope,item.id,current => {
              if (current.lease!==item.lease || current.manual) return current;
              return { ...current,leaseUntil:0,lease:null,status:accepted?'ready':'waiting',
                result:accepted?result:null, manual:!accepted && !['photo-budget-exhausted','photo-rate-limit','photo-busy','month-changed'].includes(result.reason),renewRequest:!accepted,
                retryAt:Math.max(0,Number(result.retryAt)||0)*1000,
                message:accepted?`Ready: ${result.species}`:String(result.message || 'Photo not confirmed. It remains saved; choose Retry or Remove.') };
            });
            if (accepted && entry && !entry.manual && options.autoClaim?.() && owner()===scope) await claim(entry);
          } catch (_) {
            await update(scope,item.id,current => current.lease!==item.lease ? current : { ...current,lease:null,leaseUntil:0,status:'waiting',
              manual:navigator.onLine!==false,message:navigator.onLine===false?'Saved on this device. Waiting for a connection.':'Connection interrupted. Your photo is saved; choose Retry.' });
          } finally { clearTimeout(timeout);active=null;await render(); }
        }
      } catch (_) { notify('Saved photos could not be opened. Your game is still available.'); }
      finally { processing=false; }
    }
    async function enqueue(blob) {
      const scope=owner(); if (!scope) throw Error('Wait for your current game profile to finish loading.');
      const item=await add(scope,blob);
      if (owner()!==scope) throw Error('The photo was saved for the previous game profile.');
      notify('Photo saved on this device. You can keep playing while it waits or is checked.');
      await render();process();return item;
    }
    async function retry(id) {
      const scope=owner();
      await update(scope,id,item => {
        if (item.result) return item;
        // Same request ID recovers a finished response after a broken connection.
        // A known service/model failure needs an explicit new attempt instead.
        return { ...item,requestId:item.renewRequest?crypto.randomUUID():item.requestId,renewRequest:false,status:'queued',manual:false,lease:null,leaseUntil:0,retryAt:0,message:'Saved. Waiting to check.' };
      });
      await render();process();
    }
    async function pause(id) {
      const scope=owner();if(active?.id===id) active.controller.abort();
      await update(scope,id,item => ({...item,manual:true,status:'paused',lease:null,leaseUntil:0,message:'Paused. Your photo stays saved; an already-sent check may finish.'}));await render();
    }
    async function remove(id) {
      const scope=owner();if(active?.id===id) active.controller.abort();
      await update(scope,id,() => null);await render();
    }
    async function show() {
      if (!panel) {
        panel=document.createElement('section');panel.className='pending-photo-panel';panel.hidden=true;
        panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Saved photos');
        panel.innerHTML='<header><h2>Saved photos</h2><button type="button" data-photo-close aria-label="Close saved photos">Close</button></header><p data-photo-summary></p><div data-photo-list></div>';
        panel.querySelector('[data-photo-close]').onclick=hide;
        panel.addEventListener('keydown',e => {if(e.key==='Escape'){e.preventDefault();hide();}});
        document.body.append(panel);
      }
      panel.hidden=false;await render();panel.querySelector('button').focus();
    }
    function hide() {if(panel)panel.hidden=true;revoke();}
    const online=() => {render().catch(()=>{});process();};
    const offline=() => active?.controller.abort();
    window.addEventListener('online',online);window.addEventListener('offline',offline);
    timer=setInterval(() => {
      const scope=owner();
      if(scope!==lastOwner){lastOwner=scope;active?.controller.abort();hide();online();}
      // Recover expired cross-tab leases after an app crash. Failed API results
      // remain manual; this does not turn provider errors into paid retry loops.
      else if(navigator.onLine!==false)process();
    },15000);
    setTimeout(online,0);
    return {enqueue,show,hide,process,retry,pause,remove,claim,list:()=>list(owner()),
      dispose(){stopped=true;clearInterval(timer);active?.controller.abort();revoke();panel?.remove();window.removeEventListener('online',online);window.removeEventListener('offline',offline);}};
  }
  global.BurbzPhotoQueue={create,validResult,storage:{add,list,update,DB,MAX_COUNT,MAX_BYTES}};
})(typeof window==='undefined'?globalThis:window);
