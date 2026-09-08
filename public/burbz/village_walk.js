/* On-demand fullscreen first-person adapter. One borrowed canvas, one RAF owner. */
(function(root){
  'use strict';
  const REV='village-discoveries-v367-20260908';
  let session=null,dependencies=null;
  function script(file,global){
    if(root[global])return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const s=document.createElement('script');s.src=file+'?v='+REV;
      const timer=setTimeout(()=>finish(Error('The walking controls could not load.')),15000);
      function finish(error){clearTimeout(timer);s.onload=s.onerror=null;if(error){s.remove();reject(error);}else resolve();}
      s.onload=()=>finish(root[global]?null:Error('The walking controls are unavailable.'));
      s.onerror=()=>finish(Error('The walking controls could not load.'));document.head.appendChild(s);
    });
  }
  function load(){
    if(!dependencies)dependencies=Promise.all([
      script('village_walk_core.js','BurbzVillageWalkCore'),script('village_walk_scene.js','BurbzVillageWalkScene'),
      script('village_discovery_content.js','BurbzVillageDiscoveryContent').then(()=>script('village_discovery_core.js','BurbzVillageDiscoveryCore')).then(()=>script('village_discoveries.js','BurbzVillageDiscoveries')),
      new Promise((resolve,reject)=>{
        if(document.getElementById('villageWalkStyle')?.sheet){resolve();return;}
        document.getElementById('villageWalkStyle')?.remove();
        const link=document.createElement('link');link.id='villageWalkStyle';link.rel='stylesheet';link.href='village_walk.css?v='+REV;
        const timer=setTimeout(()=>{link.remove();reject(Error('The walking display could not load.'));},15000);
        link.onload=()=>{clearTimeout(timer);resolve();};link.onerror=()=>{clearTimeout(timer);link.remove();reject(Error('The walking display could not load.'));};document.head.appendChild(link);
      })
    ]).catch(error=>{dependencies=null;throw error;});return dependencies;
  }
  function isOpen(){return !!session;}
  function close(reason='exit'){
    const s=session;if(!s)return false;
    if(['back','escape'].includes(reason)&&s.discoveries?.closePanel())return true;
    session=null;s.closed=true;
    cancelAnimationFrame(s.raf);s.abort.abort();s.resizeObserver?.disconnect();s.reset?.();
    if(document.pointerLockElement&&s.root.contains(document.pointerLockElement))document.exitPointerLock?.();
    if(document.fullscreenElement===s.root)Promise.resolve(document.exitFullscreen?.()).catch(()=>{});
    if(document.webkitFullscreenElement===s.root)document.webkitExitFullscreen?.();
    if(s.canvas&&s.parent){s.parent.insertBefore(s.canvas,s.next?.parentNode===s.parent?s.next:null);s.canvas.style.cssText=s.canvasStyle;}
    s.discoveries?.dispose();s.unbatch?.();
    if(s.snapshot){
      const {camera,renderer}=s.source,save=s.snapshot;
      camera.position.copy(save.position);camera.quaternion.copy(save.quaternion);Object.assign(camera,save.lens);camera.updateProjectionMatrix();
      renderer.setPixelRatio(save.dpr);renderer.setSize(save.width,save.height,false);
      // Release the fullscreen colour/depth target; the existing scene retains
      // its shared resources and lazily recreates its smaller stage target.
      root.BurbzManga?.dispose(renderer);
    }
    for(const [el,value] of s.inert)el.inert=value;
    document.body.style.overflow=s.overflow;s.root.remove();
    s.options.resume?.(reason,s.failed);
    if(s.opener?.isConnected)s.opener.focus({preventScroll:true});
    return true;
  }
  function open(options){
    if(session)return;
    const el=document.createElement('section');el.id='villageWalk';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Walk around your village');
    // A network/CSS failure must still leave a visible, usable exit.
    el.style.cssText='position:fixed;inset:0;z-index:2147483000;background:#18251e;color:#fff3d1';
    el.innerHTML='<div class="vw-look" tabindex="0" role="application" aria-label="Village walking view. WASD moves, arrow keys look, or drag to look."></div><div class="vw-top"><button class="vw-exit" type="button">← Village</button><div class="vw-title"><small>ON FOOT</small><strong></strong></div><button class="vw-fullscreen" type="button" aria-label="Fill the screen" title="Fill the screen">⛶</button></div><span class="vw-reticle" aria-hidden="true"></span><button type="button" class="vw-stick" aria-label="Walk: drag the thumbstick"><span class="vw-knob"></span></button><span class="vw-touch-hint">Drag to look</span><div class="vw-hint" role="status">Opening the village paths…</div><div class="vw-error" hidden><p></p><button type="button">Return to village</button></div>';
    el.querySelector('strong').textContent=options.name||'Your village';
    const s=session={root:el,options,abort:new AbortController(),raf:0,closed:false,failed:false,inert:[],opener:options.opener||document.activeElement,overflow:document.body.style.overflow,intervals:[],samples:[],frames:0,fastStreak:0};
    document.body.appendChild(el);document.body.style.overflow='hidden';
    for(const node of document.body.children)if(node!==el&&node.tagName!=='SCRIPT'&&node.tagName!=='STYLE'){s.inert.push([node,node.inert]);node.inert=true;}
    const on=(node,event,fn,opts={})=>node.addEventListener(event,fn,{...opts,signal:s.abort.signal});
    const exit=el.querySelector('.vw-exit'),look=el.querySelector('.vw-look'),stick=el.querySelector('.vw-stick'),knob=el.querySelector('.vw-knob'),hint=el.querySelector('.vw-hint'),full=el.querySelector('.vw-fullscreen');
    function fullscreen(){
      try{const request=el.requestFullscreen||el.webkitRequestFullscreen;if(!request)return;Promise.resolve(request.call(el)).then(()=>{if(s.closed&&(document.fullscreenElement===el))document.exitFullscreen?.();}).catch(()=>{});}catch(_){}
    }
    on(exit,'click',()=>close());on(el.querySelector('.vw-error button'),'click',()=>close());on(full,'click',fullscreen);
    function fullChange(){
      const active=document.fullscreenElement===el||document.webkitFullscreenElement===el;
      full.hidden=!!active||!(el.requestFullscreen||el.webkitRequestFullscreen);
      if(s.wasFullscreen&&!active&&!s.closed)close('fullscreen-exit');s.wasFullscreen=active;
    }
    on(document,'fullscreenchange',fullChange);on(document,'webkitfullscreenchange',fullChange);
    full.hidden=!(el.requestFullscreen||el.webkitRequestFullscreen);fullscreen();exit.focus({preventScroll:true});
    const keys=new Set(),pointers=new Map(),input={side:0,forward:0};
    s.reset=()=>{keys.clear();pointers.forEach((p,id)=>{try{p.node.releasePointerCapture(id);}catch(_){}});pointers.clear();input.side=input.forward=0;knob.style.transform='';};
    function fail(error){
      if(s.closed)return;s.failed=true;cancelAnimationFrame(s.raf);s.raf=0;s.reset();
      const box=el.querySelector('.vw-error');box.hidden=false;box.querySelector('p').textContent='Walking is unavailable here. '+(error.message||'Please return to the village and try again.');
      box.style.cssText='position:absolute;inset:60px 0 0;padding:30px;background:#18251e;text-align:center';box.querySelector('button').focus();
      hint.textContent='Your village progress is kept.';
      console.warn('Burbz village walk:',error);
    }
    s.fail=fail;
    on(document,'keydown',e=>{
      if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();close('escape');return;}
      if(e.code==='Tab'){
        const buttons=[...(s.uiBusy?el.querySelector('.vd-panel'):el).querySelectorAll('button,[tabindex="0"]')].filter(b=>b.getClientRects().length&&!b.closest('[hidden]'));
        const i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();return;
      }
      if(!e.repeat&&s.discoveries?.key(e.code)){e.preventDefault();e.stopImmediatePropagation();return;}
      if(s.uiBusy)return;
      if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();keys.add(e.code);}
    },{capture:true});
    on(document,'keyup',e=>{keys.delete(e.code);},{capture:true});
    // Body-level gesture isolation prevents the dock/page/village swipe stack
    // and the borrowed canvas's orbit/tap handlers from receiving walking input.
    for(const event of ['touchstart','touchmove','touchend','touchcancel','wheel','dblclick','contextmenu'])on(el,event,e=>{
      e.stopPropagation();
      // Exit/fullscreen buttons must keep the browser's synthetic touch click.
      if(e.cancelable&&!e.target.closest('.vd-panel,button:not(.vw-stick)'))e.preventDefault();
    },{passive:false});
    function pointerDown(e){
      if(e.button!==0)return;e.preventDefault();e.stopPropagation();if(s.failed||s.uiBusy)return;
      if(e.pointerType==='touch')el.classList.add('vw-touch');
      const node=e.currentTarget,type=node===stick?'move':'look';
      if([...pointers.values()].some(p=>p.type===type))return;
      node.focus({preventScroll:true});node.setPointerCapture(e.pointerId);
      const r=stick.getBoundingClientRect();pointers.set(e.pointerId,{type,node,x:e.clientX,y:e.clientY,cx:r.left+r.width/2,cy:r.top+r.height/2});
      if(type==='move')pointerMove(e);
    }
    function pointerMove(e){
      const p=pointers.get(e.pointerId);if(!p)return;e.preventDefault();e.stopPropagation();
      if(p.type==='move'){
        let dx=e.clientX-p.cx,dy=e.clientY-p.cy;const distance=Math.hypot(dx,dy),limit=34,k=distance>limit?limit/distance:1;dx*=k;dy*=k;
        input.side=Math.abs(dx)<3?0:dx/limit;input.forward=Math.abs(dy)<3?0:-dy/limit;knob.style.transform='translate('+dx+'px,'+dy+'px)';
      }else if(s.player)root.BurbzVillageWalkCore.look(s.player,e.clientX-p.x,e.clientY-p.y,e.pointerType==='touch'?.004:.003);
      p.x=e.clientX;p.y=e.clientY;
    }
    function release(e){const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);if(p.type==='move'){input.side=input.forward=0;knob.style.transform='';}try{p.node.releasePointerCapture(e.pointerId);}catch(_){};e.stopPropagation();}
    for(const node of [look,stick]){on(node,'pointerdown',pointerDown);on(node,'pointermove',pointerMove);for(const ev of ['pointerup','pointercancel','lostpointercapture'])on(node,ev,release);}
    const touch=matchMedia('(pointer: coarse)').matches||navigator.maxTouchPoints>0;if(touch)el.classList.add('vw-touch');
    function pause(){cancelAnimationFrame(s.raf);s.raf=0;s.last=0;s.intervals=[];s.reset();}
    function resume(){if(!s.closed&&!s.failed&&s.player&&!document.hidden&&!s.raf)s.raf=requestAnimationFrame(frame);}
    on(window,'blur',pause);on(window,'focus',resume);on(document,'visibilitychange',()=>document.hidden?pause():resume());on(window,'pagehide',()=>close('pagehide'));
    function resize(){
      if(!s.source||s.closed)return;s.reset();
      const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;
      s.maxDpr=Math.min(devicePixelRatio||1,1.5,Math.sqrt(1100000/(w*h)));
      s.maxDpr=Math.max(.65,s.maxDpr);
      const renderer=s.source.renderer;renderer.setPixelRatio(Math.min(s.dpr||s.maxDpr,s.maxDpr));s.dpr=renderer.getPixelRatio();renderer.setSize(w,h,false);
      s.source.camera.aspect=w/h;s.source.camera.updateProjectionMatrix();s.last=0;s.intervals=[];
    }
    on(window,'resize',resize);if(window.visualViewport)on(window.visualViewport,'resize',resize);
    function frame(ts){
      s.raf=0;if(s.closed||s.failed||document.hidden)return;
      try{
        const core=root.BurbzVillageWalkCore,dt=s.last?(ts-s.last)/1000:0;
        if(s.last&&dt>0){s.intervals.push(dt*1000);s.samples.push(dt*1000);if(s.samples.length>600)s.samples.shift();}
        s.last=ts;s.frames++;
        core.move(s.player,{side:input.side+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),forward:input.forward+(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)},dt,s.world);
        const turn=Math.min(.05,dt)*1.45;s.player.yaw+=((keys.has('ArrowLeft')?1:0)-(keys.has('ArrowRight')?1:0))*turn;
        s.player.pitch=Math.max(-1.10,Math.min(1.10,s.player.pitch+((keys.has('ArrowUp')?1:0)-(keys.has('ArrowDown')?1:0))*turn));
        const {camera,renderer,scene}=s.source;
        s.options.animate?.(ts/1000);s.discoveries?.update(ts/1000);
        camera.position.set(s.player.x,s.player.y+core.EYE,s.player.z);camera.rotation.set(s.player.pitch,s.player.yaw,0,'YXZ');camera.updateMatrixWorld();
        if(root.BurbzManga)root.BurbzManga.render(root.THREE,renderer,scene,camera);else renderer.render(scene,camera);
        if(s.intervals.length>=60||(s.intervals.length>=12&&s.intervals.reduce((a,b)=>a+b,0)>1600)){
          const q=core.quality(s.dpr,s.maxDpr,s.intervals,s.fastStreak);s.fastStreak=q.fastStreak;s.intervals=[];
          if(Math.abs(q.dpr-s.dpr)>.01){s.dpr=q.dpr;renderer.setPixelRatio(s.dpr);renderer.setSize(el.clientWidth,el.clientHeight,false);}
        }
        s.raf=requestAnimationFrame(frame);
      }catch(error){fail(error);}
    }
    load().then(()=>{
      if(s.closed)return;const source=options.source();
      if(!root.THREE||!source?.scene||!source.renderer||source.renderer.getContext().isContextLost())throw Error('This browser cannot render the 3D village.');
      s.source=source;const {renderer,camera,scene}=source,canvas=renderer.domElement,size=renderer.getSize(new root.THREE.Vector2());
      s.snapshot={position:camera.position.clone(),quaternion:camera.quaternion.clone(),lens:{fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect},dpr:renderer.getPixelRatio(),width:size.x,height:size.y};
      s.world=root.BurbzVillageWalkScene.create(root.THREE,scene,source.buildings,source.movers,scene.userData.walkTerrain);
      s.unbatch=root.BurbzVillageWalkScene.batch(root.THREE,scene,source.movers);
      const spawn=s.world.spawn();s.player={...spawn,yaw:Math.atan2(spawn.x,spawn.z),pitch:-.04};
      s.discoveries=root.BurbzVillageDiscoveries.attach(s);
      s.canvas=canvas;s.parent=canvas.parentNode;s.next=canvas.nextSibling;s.canvasStyle=canvas.style.cssText;el.prepend(canvas);
      options.suspend?.();Object.assign(camera,{fov:68,near:.08,far:110});
      on(canvas,'webglcontextlost',e=>{e.preventDefault();fail(Error('The graphics connection was interrupted.'));});
      resize();s.resizeObserver=new ResizeObserver(resize);s.resizeObserver.observe(el);
      hint.textContent=touch?'Left thumb: walk · Right thumb: look':'WASD walk · Drag to look · Arrow keys look · Esc leave';
      look.focus({preventScroll:true});resume();
    }).catch(fail);
  }
  function diagnostics(){
    const s=session;if(!s)return {open:false};
    const sorted=s.samples.slice().sort((a,b)=>a-b),mean=sorted.reduce((a,b)=>a+b,0)/(sorted.length||1);
    return {open:true,discoveries:s.discoveries?.diagnostics(),ready:!!s.player,failed:s.failed,frames:s.frames,running:!!s.raf,player:s.player?{...s.player}:null,dpr:s.dpr,sampleCount:sorted.length,meanMs:mean,p95Ms:sorted[Math.floor(sorted.length*.95)]||0,fps:mean?1000/mean:0,draws:s.source?.renderer.info.render.calls,triangles:s.source?.renderer.info.render.triangles,segments:s.world?.segments.length,buildings:s.source?.buildings.map(b=>({id:b.userData.buildingId,level:b.userData.modelLevel,construction:!!b.userData.construction,x:b.position.x,z:b.position.z})),memory:s.source?{...s.source.renderer.info.memory}:null};
  }
  root.BurbzVillageWalk={open,close,isOpen};
  if(/^(localhost|127\.0\.0\.1)$/.test(location.hostname))root.__burbzVillageWalkDebug={state:diagnostics,world:()=>session?.world,place:(p)=>{if(session?.world.allowed(p.x,p.z)){Object.assign(session.player,p,{y:session.world.height(p.x,p.z)});return true;}return false;},resetSamples:()=>{if(session){session.samples=[];session.intervals=[];}}};
})(typeof globalThis!=='undefined'?globalThis:this);
