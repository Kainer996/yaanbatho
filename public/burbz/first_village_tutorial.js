/* First Hall guidance consumes real renderer input; it never creates ownership or rewards. */
(function(root){'use strict';
const phases=['overview-gesture','overview-camera','overview-walk','orientation','connected'];
function active(s){return !!s&&s.version===1&&s.enrolled===true&&s.hallState==='built'&&phases.includes(s.phase);}
function next(s,event,seed,proof={}){
 if(!active(s)||s.seed!==seed)return null;
 if(event==='pause'||event==='resume')return {...s,paused:event==='pause'};
 if(s.paused)return null;
 if(event==='hold'&&s.phase==='overview-gesture')return {...s,phase:'overview-camera'};
 if(['drag','pinch'].includes(event)&&s.phase==='overview-camera'){
  if(s.gestures?.[event])return null;
  const gestures={...s.gestures,[event]:true};return {...s,gestures,phase:gestures.drag&&gestures.pinch?'overview-walk':s.phase};
 }
 if(event==='enter'&&s.phase==='overview-walk')return {...s,phase:'orientation'};
 if(event==='landscape'&&s.phase==='orientation'&&proof.landscape===true)return {...s,phase:'connected'};
 if(event==='finish'&&s.phase==='connected'&&proof.landscape===true)return {...s,phase:'complete',paused:false};
 return null;
}
function controller(api,seed){
 const owner=api.owner();let error='';
 return {current:()=>api.owner()===owner,read:()=>api.owner()===owner?api.read():null,error:()=>error,
 event(event,proof){if(api.owner()!==owner)return false;const n=next(api.read(),event,seed,proof);if(!n)return false;try{api.write(n);error='';return true;}catch(e){error='Could not save. Please try again.';return false;}}};
}
function gestures(emit){
 let ids=new Set(),proof={},cancelled=false,marker=false;
 function reset(){ids.clear();proof={};cancelled=false;marker=false;}
 return {begin(p){if(!ids.size){reset();marker=!!p.marker;}ids.add(p.id);},engage(via){if(ids.size===1&&marker&&via==='hold')proof.hold=true;},applied(type,amount){if(!Number.isFinite(amount))return;if(type==='drag'&&ids.size===1&&Math.abs(amount)>=.12)proof.drag=true;if(type==='pinch'&&ids.size===2){proof.zoom=(proof.zoom||0)+Math.abs(amount);if(proof.zoom>=.4)proof.pinch=true;}},end(id,ok){if(!ids.has(id))return;ids.delete(id);if(!ok)cancelled=true;if(!ids.size){if(!cancelled)for(const e of ['hold','drag','pinch'])if(proof[e])emit(e);reset();}},reset};
}
function roomMatches(s,room){return active(s)&&room?.inside&&room.seed===s.seed&&room.buildingId==='village_hall';}
function locked(s,room){return !!roomMatches(s,room)&&(s.phase==='orientation'||!room.landscape);}
function keyboard(emit){let hold=null,pending=new Map();return{down(key,marker,now){if((key===' '||key==='Enter')&&marker&&hold===null)hold={key,now};},applied(key,delta){if(!Number.isFinite(delta))return;const event=key.startsWith('Arrow')?'drag':['+','=','-','_'].includes(key)?'pinch':null;if(event&&Math.abs(delta)>=(event==='drag'?.08:.4))pending.set(key,event);},up(key,now){if(hold?.key===key){if(now-hold.now>=320)emit('hold');hold=null;}if(pending.has(key)){emit(pending.get(key));pending.delete(key);}},reset(){hold=null;pending.clear();}};}
let overview=null;
function guide(host){const el=document.createElement('aside');el.className='first-village-guide';el.setAttribute('aria-label','Merlin’s village lesson');el.innerHTML='<img src="assets/merlin-tutorial.png" alt="Merlin"><div><strong>Merlin</strong><p aria-live="polite"></p><small role="status"></small><button type="button" data-fv="pause">Pause lesson</button><button type="button" data-fv="next" hidden>Continue</button></div>';host.append(el);return el;}
function paint(el,c,room){const s=c.read();el.hidden=!active(s);if(el.hidden)return;
 const inside=roomMatches(s,room),portrait=inside&&!room.landscape;
 const text=s.paused?'Your lesson is paused. Resume when you are ready.':portrait?'Remember, like before, turn your phone sideways.':!inside&&['orientation','connected'].includes(s.phase)?'Tap Walk in the top-right corner to return to your Village Hall.':s.phase==='overview-gesture'?'You’ve liberated your first village! Press and hold here.':s.phase==='overview-camera'?'Drag your thumb to look around the village. Pinch to zoom in or out. Keyboard: arrow keys to look, +/− to zoom.':s.phase==='overview-walk'?'Now tap Walk in the top-right corner.':s.phase==='orientation'?'Ready to explore? Continue in landscape.':'All the villages and towns you liberate are connected to the world of Alderwing. Here, you can find quests and jobs helping the people of Alderwing.';
 el.querySelector('p').textContent=text;
 el.querySelector('small').textContent=c.error()||(s.phase==='overview-camera'?[(s.gestures?.drag?'✓ ':'')+'Look',(s.gestures?.pinch?'✓ ':'')+'Zoom'].join(' · '):'');
 el.querySelector('[data-fv="pause"]').textContent=s.paused?'Resume lesson':'Pause lesson';
 const b=el.querySelector('[data-fv="next"]');b.hidden=!inside||portrait||s.paused||!['orientation','connected'].includes(s.phase);b.textContent=s.phase==='orientation'?'Continue in landscape':'Let’s explore';
}
function attachOverview(api,host,seed){
 if(overview?.host===host&&overview.seed===seed&&overview.c.current()){overview.render();return;}
 overview?.dispose();overview=null;
 if(!active(api.read())||api.read().seed!==seed)return;
 const c=controller(api,seed),el=guide(host),marker=document.createElement('button'),abort=new AbortController();marker.className='first-village-marker';marker.textContent='Hold here';marker.type='button';marker.setAttribute('aria-label','Hold here: press and hold Space or Enter, then release');host.append(marker);
 function render(){paint(el,c);marker.hidden=c.read()?.phase!=='overview-gesture'||!!c.read()?.paused;}
 const g=gestures(e=>{c.event(e);render();}),k=keyboard(e=>{c.event(e);render();});
 marker.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();k.down(e.key,!marker.hidden&&!c.read()?.paused,performance.now());}},{signal:abort.signal});
 host.addEventListener('keyup',e=>{k.up(e.key,performance.now());},{signal:abort.signal});
 marker.addEventListener('blur',()=>k.reset(),{signal:abort.signal});
 el.addEventListener('click',e=>{if(e.target.closest('[data-fv="pause"]')){g.reset();k.reset();c.event(c.read()?.paused?'resume':'pause');render();}},{signal:abort.signal});
 for(const event of ['blur','pagehide'])root.addEventListener(event,()=>{g.reset();k.reset();},{signal:abort.signal});
 overview={host,seed,c,g,k,render,begin(e){const r=marker.getBoundingClientRect();g.begin({id:e.pointerId,marker:!marker.hidden&&e.clientX>=r.left-12&&e.clientX<=r.right+12&&e.clientY>=r.top-12&&e.clientY<=r.bottom+12});},dispose(){abort.abort();g.reset();k.reset();el.remove();marker.remove();}};render();
}
function overviewKey(key,delta){if(overview?.c.current()&&!overview.c.read()?.paused&&overview.host.getClientRects().length)overview.k.applied(key,delta);}
function overviewInput(type,value,extra){if(!overview||!overview.c.current()||!overview.host.getClientRects().length||overview.c.read()?.paused)return;const g=overview.g;if(type==='begin')overview.begin(value);else if(type==='engage')g.engage(value);else if(type==='applied')g.applied(value,extra);else if(type==='end')g.end(value.pointerId,value.type==='pointerup');else g.reset();}
function attachRoom(api,s){
 const c=controller(api,s.options.seed),el=guide(s.root);
 const room=()=>({inside:!!s.room,seed:Number(s.room?.target.seed),buildingId:s.room?.target.buildingId,landscape:s.root.clientWidth>s.root.clientHeight});
 let last='';
 function update(){const r=room(),state=c.read();if(!roomMatches(state,r)){el.hidden=true;return;}if(state.phase==='overview-walk')c.event('enter');const key=[c.read()?.phase,c.read()?.paused,r.landscape,c.error()].join(':');if(last===key)return;last=key;if(c.read()?.phase==='orientation'&&r.landscape&&!c.read()?.paused)c.event('landscape',r);paint(el,c,r);}
 el.addEventListener('click',e=>{const b=e.target.closest('[data-fv]');if(!b)return;if(b.dataset.fv==='pause')c.event(c.read()?.paused?'resume':'pause');else{const r=room();if(roomMatches(c.read(),r))c.event(c.read()?.phase==='orientation'?'landscape':'finish',r);}last='';update();},{signal:s.abort.signal});
 update();return{update,locked:()=>!c.current()||locked(c.read(),room()),dispose:()=>el.remove()};
}
const api={active,next,controller,gestures,keyboard,overviewKey,roomMatches,locked,attachOverview,overviewInput,attachRoom};root.BurbzFirstVillageTutorial=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
