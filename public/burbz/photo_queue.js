/* Device-local pending captures. A stored photo is not a discovery. */
(function (global) {
  'use strict';
  const DB = 'burbz-pending-photos', STORE = 'captures', MAX_COUNT = 20, MAX_BYTES = 80 * 1024 * 1024;
  const LEASE_MS = 70000, REQUEST_MS = 50000;
  const receipt = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const validResult = r => r && r.found === true && r.accepted === true && r.verified === true &&
    r.policy === 'photo-gemini-v487' && r.model === 'gemini-vision' && r.modelName === 'gemini-3.8-flash' && receipt(r.receiptId) &&
    typeof r.confidence === 'number' && Number.isFinite(r.confidence) && r.confidence >= .8 && r.confidence <= 1 &&
    typeof r.species === 'string' && typeof r.scientificName === 'string' && /^[A-Z][a-z]+ [a-z][a-z-]+$/.test(r.scientificName);
  // Saved photos have no match cards: name the matches and send the player
  // back to the cropper, where This is my bird lives.
  const matchNote = r => {
    const names = Array.isArray(r?.candidates) ? r.candidates.slice(0, 3)
      .map(c => typeof c?.species === 'string' ? c.species.trim() : '').filter(Boolean) : [];
    return names.length ? 'Possible: ' + names.join(' or ') + '. Choose this photo again from your device to pick your bird.' : '';
  };
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onerror = () => reject(request.error || Error('Photo storage unavailable'));
      request.onblocked = () => { blocked = true; reject(Error('Close another Burbz tab to update photo storage')); };
      request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
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
    if (!owner) throw Error('Wait for your current game profile to finish loading.');
    if (!(blob instanceof Blob) || !blob.size || blob.size > 10*1024*1024) throw Error('This photo cannot be saved. Choose a photo smaller than 10 MB.');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(x => x.toString(16).padStart(2,'0')).join('');
    return mutate((rows, store) => {
      const existing = rows.find(row => row.owner === owner && row.hash === hash);
      if (existing) return existing;
      if (rows.length >= MAX_COUNT || rows.reduce((sum,row) => sum+row.blob.size,0)+blob.size > MAX_BYTES) throw Error('Saved photos are full. Remove a saved photo before saving another.');
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
    let processing=false, rerun=false, active=null, stopped=false, panel=null, urls=[], lastOwner='', returnFocus=null, renderSequence=0;
    const channel = typeof BroadcastChannel==='function' ? new BroadcastChannel(DB) : null;
    const owner = () => options.owner();
    const notify = message => options.message?.(message);
    const current = scope => !stopped && owner()===scope;
    function revoke() { urls.forEach(url=>URL.revokeObjectURL(url)); urls=[]; }
    function changed() { channel?.postMessage('changed'); return render(); }
    function act(fn) { return () => Promise.resolve().then(fn).catch(()=>notify('Saved photos could not be updated. Your game is still available.')); }
    async function render() {
      const sequence=++renderSequence, scope=owner();
      if (!scope) { options.count?.(0); return; }
      const rows=await list(scope);
      if (!current(scope) || sequence!==renderSequence) return;
      options.count?.(rows.length);
      if (!panel || panel.hidden) return;
      const focused=document.activeElement?.dataset.photoAction;
      revoke(); const body=panel.querySelector('[data-photo-list]'); body.replaceChildren();
      panel.querySelector('[data-photo-summary]').textContent = rows.length ? `${rows.length} saved on this device. Identification uses a connection and the shared monthly allowance. You can close this and keep playing.` : 'No saved photos waiting. You can keep playing while saved photos wait.';
      rows.forEach(item => {
        const row=document.createElement('article'); row.className='pending-photo-row';
        const img=document.createElement('img'); img.alt='Your saved bird photo'; img.src=URL.createObjectURL(item.blob); urls.push(img.src);
        const details=document.createElement('div'), text=document.createElement('p');
        text.textContent=validResult(item.result) ? `Ready: ${item.result.species}` : item.message;
        details.append(text);
        if (item.retryAt>Date.now() && !item.manual) {
          const wait=document.createElement('p'); wait.className='pending-photo-wait';
          wait.textContent=`Will try again after ${new Date(item.retryAt).toLocaleString()}. Your photo stays saved.`;details.append(wait);
        }
        const actions=document.createElement('div'); actions.className='pending-photo-actions';
        function button(label,fn,disabled=false) { const b=document.createElement('button'); b.type='button'; b.textContent=label; b.dataset.photoAction=`${item.id}:${label}`; b.disabled=disabled; b.onclick=act(fn); actions.append(b); }
        button('View photo',() => {if(current(scope)){hide();return options.preview?.(item.blob);}});
        if (validResult(item.result)) button('View result',() => claim(item), (item.claimUntil||0)>Date.now());
        else if ((item.leaseUntil||0)>Date.now() && !item.manual) button('Pause',() => pause(item.id,scope));
        else {
          button(item.manual?'Retry':'Check now',() => retry(item.id,scope), (item.leaseUntil||0)>Date.now() || (item.retryAt>Date.now() && !item.networkWait));
          if (!item.manual) button('Pause',() => pause(item.id,scope));
        }
        button('Remove',() => remove(item.id,scope), (item.claimUntil||0)>Date.now());
        details.append(actions);row.append(img,details);body.append(row);
      });
      if(focused) [...body.querySelectorAll('button')].find(b=>b.dataset.photoAction===focused && !b.disabled)?.focus();
    }
    async function claim(item) {
      if(navigator.locks) return navigator.locks.request(`burbz-photo-claim:${item.owner}`,{ifAvailable:true},lock=>lock?claimLocked(item):false);
      return claimLocked(item);
    }
    async function claimLocked(item) {
      if (!current(item.owner) || !validResult(item.result)) return false;
      const token=crypto.randomUUID();
      const latest=await mutate((rows,store)=>{
        const row=rows.find(value=>value.owner===item.owner && value.id===item.id);
        if(!row || !validResult(row.result) || rows.some(value=>value.owner===item.owner && (value.claimUntil||0)>Date.now()))return null;
        const held={...row,claimToken:token,claimUntil:Date.now()+LEASE_MS};store.put(held);return held;
      });
      if (!latest || latest.claimToken!==token) return false;
      let done=false;
      try {
        if (!current(item.owner)) return false;
        done=!!(await options.claim(latest,{isCurrent:()=>current(item.owner)}));
        // The callback commits a profile-scoped receipt atomically with its rewards.
        // Retain the photo across a profile switch; a later receipt replay removes it.
        if (done && current(item.owner)) await update(item.owner,item.id,row => row.claimToken===token?null:row);
        else if(current(item.owner)) notify('The result is saved. It could not yet be added to this game; try View result again.');
      } catch (_) { if(current(item.owner)) notify('The result is saved, but game storage could not be updated. Try View result again.'); }
      finally {
        await update(item.owner,item.id,row => row.claimToken===token?{...row,claimToken:null,claimUntil:0}:row);
        await changed();
      }
      return done;
    }
    async function process() {
      if (stopped || navigator.onLine===false) return;
      if (processing) {rerun=true;return;}
      const scope=owner(); if (!scope) return;
      processing=true;
      try {
        const rows=await list(scope);
        for (const candidate of rows) {
          if (!current(scope) || navigator.onLine===false) break;
          if (candidate.result || candidate.manual || candidate.retryAt>Date.now()) continue;
          const lease=crypto.randomUUID();
          const item=await update(scope,candidate.id,row => {
            if (row.manual || row.result || row.retryAt>Date.now() || (row.leaseUntil||0)>Date.now()) return row;
            return { ...row,status:'checking',networkWait:false,leaseUntil:Date.now()+LEASE_MS,lease,message:'Checking with Gemini. You can keep playing.' };
          });
          if (!item || item.lease!==lease) continue;
          const controller=new AbortController(); active={id:item.id,owner:scope,controller,lease};
          const timeout=setTimeout(() => controller.abort(),REQUEST_MS);
          try {
            await changed();
            // Rendering and IndexedDB both yield. Recheck persisted cancellation,
            // profile and connection immediately before handing any bytes to fetch.
            const latest=await update(scope,item.id,row=>row);
            if (!current(scope) || navigator.onLine===false || controller.signal.aborted || !latest || latest.manual || latest.lease!==lease) continue;
            const form=new FormData();form.append('image',item.blob,'photo.jpg');form.append('captureSource','camera');
            form.append('photoOwner',scope);form.append('photoRequestId',item.requestId);
            // Saved photos were taken earlier, somewhere else: they carry no place.
            form.append('photoContract','merlin-v487');
            const response=await fetch('api/identify/image',{method:'POST',body:form,signal:controller.signal});
            const result=await response.json();
            if (controller.signal.aborted) continue;
            const accepted=response.ok && validResult(result);
            const automatic=!accepted && !receipt(result?.receiptId) && ['photo-budget-exhausted','photo-rate-limit','photo-busy','month-changed'].includes(result?.reason);
            const retryValue=Number(result?.retryAt)*1000;
            const retryAt=automatic ? Math.max(Date.now()+15000,Number.isFinite(retryValue)?retryValue:0) : 0;
            const entry=await update(scope,item.id,row => {
              if (row.lease!==lease) return row;
              return { ...row,leaseUntil:0,lease:null,status:accepted?'ready':row.manual?'paused':'waiting',
                result:accepted?result:null,networkWait:false,manual:row.manual || (!accepted && !automatic),
                renewRequest:!accepted && (receipt(result?.receiptId) || ['request-interrupted','request-conflict'].includes(result?.reason)),retryAt,
                message:accepted?`Ready: ${result.species}`:row.manual?row.message:matchNote(result) || String(result?.message || 'Photo not confirmed. It remains saved; choose Retry or Remove.') };
            });
            if (accepted && entry && current(scope)) notify(`Photo identified: ${result.species}. Open Saved photos to view the result.`);
            if (accepted && entry && !entry.manual && options.autoClaim?.() && current(scope)) await claim(entry);
          } catch (_) {
            await update(scope,item.id,row => row.lease!==lease ? row : { ...row,lease:null,leaseUntil:0,status:row.manual?'paused':'waiting',
              manual:row.manual,networkWait:true,retryAt:Date.now()+15000,message:row.manual?row.message:'Saved on this device. Waiting for a connection; the same check will resume.' });
          } finally {
            clearTimeout(timeout);
            await update(scope,item.id,row=>row.lease===lease?{...row,lease:null,leaseUntil:0,status:row.manual?'paused':'waiting',message:row.manual?row.message:'Saved on this device. Waiting to check.'}:row);
            active=null;await changed();
          }
        }
      } catch (_) { notify('Saved photos could not be opened. Your game is still available.'); }
      finally { processing=false;if(rerun){rerun=false;setTimeout(process,0);} }
    }
    async function enqueue(blob) {
      const scope=owner(); if (!scope || stopped) throw Error('Wait for your current game profile to finish loading.');
      let item;
      try { item=await add(scope,blob); }
      catch(error) {
        if (error?.name==='QuotaExceededError') throw Error('Device photo storage is full. The photo was not saved or sent. Remove saved photos or free device storage, then try again.');
        if (error?.name==='SecurityError' || error?.name==='InvalidStateError') throw Error('Device photo storage is unavailable. The photo was not saved or sent.');
        throw error;
      }
      if (!current(scope)) throw Error('The photo was saved for the previous game profile. Switch back to see it.');
      notify('Photo saved on this device. You can keep playing while it waits or is checked.');
      await changed();process();return item;
    }
    async function retry(id,scope=owner()) {
      if(!current(scope))return;
      await update(scope,id,item => {
        if (item.result || (item.leaseUntil||0)>Date.now() || (item.retryAt>Date.now() && !item.networkWait) || !current(scope)) return item;
        // Unknown/network outcomes replay the SAME request. Only a known finished
        // attempt or interrupted server record is renewed after deliberate Retry.
        return { ...item,requestId:item.renewRequest?crypto.randomUUID():item.requestId,renewRequest:false,networkWait:false,status:'queued',manual:false,lease:null,leaseUntil:0,retryAt:0,message:'Saved. Waiting to check.' };
      });
      await changed();if(current(scope))process();
    }
    async function pause(id,scope=owner()) {
      if(!current(scope))return;
      if(active?.id===id && active.owner===scope) active.controller.abort();
      await update(scope,id,item => ({...item,manual:true,status:'paused',message:'Paused. Your photo stays saved; an already-sent check may finish.'}));await changed();
    }
    async function remove(id,scope=owner()) {
      if(!current(scope))return;
      if(active?.id===id && active.owner===scope) active.controller.abort();
      await update(scope,id,item => (item.claimUntil||0)>Date.now()?item:null);await changed();
    }
    async function show() {
      if(stopped)return;
      if (!panel) {
        panel=document.createElement('dialog');panel.className='pending-photo-panel';panel.hidden=true;
        panel.setAttribute('aria-label','Saved photos');
        panel.innerHTML='<header><h2>Saved photos</h2><button type="button" data-photo-close aria-label="Close saved photos">Close</button></header><p data-photo-summary></p><div data-photo-list></div><p class="pending-photo-storage-note">Photos stay in this browser on this device. Clearing browser data or device storage cleanup can remove them.</p>';
        panel.querySelector('[data-photo-close]').onclick=hide;
        panel.addEventListener('cancel',e=>{e.preventDefault();hide();});
        panel.addEventListener('keydown',e=>{
          if(e.key!=='Tab')return;
          const buttons=[...panel.querySelectorAll('button:not(:disabled)')];
          const first=buttons[0],last=buttons[buttons.length-1];
          if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
          else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
        });
        document.body.append(panel);
      }
      returnFocus=document.activeElement;
      panel.hidden=false;if(!panel.open)panel.showModal();
      try {await render();} catch(_){panel.querySelector('[data-photo-summary]').textContent='Saved photos could not be opened. Close this to keep playing.';}
      panel.querySelector('button').focus();
    }
    function hide() {if(panel){if(panel.open)panel.close();panel.hidden=true;}revoke();if(returnFocus?.isConnected)returnFocus.focus();returnFocus=null;}
    const online=async() => {
      try {
        const scope=owner();
        if(scope && navigator.onLine!==false) await mutate((rows,store)=>{for(const row of rows)if(row.owner===scope && row.networkWait && !row.manual)store.put({...row,retryAt:0});});
        await render();process();
      }catch(_){/* Storage failure is shown on the next user action. */}
    };
    const offline=() => active?.controller.abort();
    const onChange=async()=>{
      try {
        if(active){const item=(await list(active.owner)).find(row=>row.id===active.id);if(!item || item.manual || item.lease!==active?.lease)active?.controller.abort();}
        await render();process();
      }catch(_){/* A later user action reports an unavailable store. */}
    };
    if(channel)channel.onmessage=onChange;
    window.addEventListener('online',online);window.addEventListener('offline',offline);
    const timer=setInterval(() => {
      const scope=owner();
      if(scope!==lastOwner){lastOwner=scope;active?.controller.abort();hide();online();}
      else if(navigator.onLine!==false)process();
    },15000);
    lastOwner=owner();
    const initial=setTimeout(online,0);
    return {enqueue,show,hide,process,retry,pause,remove,claim,list:()=>list(owner()),
      dispose(){stopped=true;clearInterval(timer);clearTimeout(initial);active?.controller.abort();hide();panel?.remove();channel?.close();window.removeEventListener('online',online);window.removeEventListener('offline',offline);}};
  }
  global.BurbzPhotoQueue={create,validResult,storage:{add,list,update,DB,MAX_COUNT,MAX_BYTES}};
})(typeof window==='undefined'?globalThis:window);
