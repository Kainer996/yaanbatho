/* Explicit map selection owns its camera; it never submits a GPS fix. */
(function(root){'use strict';let current=null;
  function close(reason='cancel'){if(!current)return false;if(['cancel','back'].includes(reason))current.cancel();else current.dispose();return true;}
  async function open(options){
    if(current)return false;
    const element=document.createElement('section');element.id='geographicHomePicker';element.className='gwp-picker';element.setAttribute('role','dialog');element.setAttribute('aria-modal','true');element.setAttribute('aria-label','Choose where your home stands');
    element.innerHTML='<div class="gwp-map"></div><div class="gwp-crosshair" aria-hidden="true">⌖</div><div class="gwp-card"><strong>Choose your home’s place</strong><p>Move the map beneath the crosshair. Your rooms and garden move with your house.</p><div><button type="button" data-picker="locate" disabled>Use my location</button></div><p class="gwp-coordinates" role="status">Opening the world map…</p><div><button type="button" data-picker="cancel">Cancel</button><button type="button" data-picker="place" disabled>Place my home here</button></div></div>';
    const css=document.createElement('style');css.textContent='.gwp-picker{position:fixed;inset:0;z-index:2147483200;background:#213b31;color:#f7ecd0}.gwp-map{position:absolute;inset:0}.gwp-crosshair{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font:64px Georgia;color:#fff4cb;text-shadow:0 2px 3px #112d22;pointer-events:none}.gwp-card{position:absolute;left:max(12px,env(safe-area-inset-left));right:max(12px,env(safe-area-inset-right));top:max(12px,env(safe-area-inset-top));max-width:470px;margin:auto;background:#203d30f5;padding:14px;border:1px solid #d0b775;border-radius:14px;box-shadow:0 6px 24px #0007;font:15px/1.35 system-ui}.gwp-card p{margin:8px 0}.gwp-card strong{font-size:19px}.gwp-card>div{display:flex;gap:10px}.gwp-card button{min-height:44px;flex:1;background:#dfc585;color:#21372a;border:0;border-radius:8px;font:700 14px system-ui}.gwp-card button:disabled{opacity:.6}.gwp-card button:first-child{background:#486452;color:#fff6d8}@media(max-height:480px) and (min-aspect-ratio:4/3){.gwp-picker{--gwp-panel:min(270px,46vw)}.gwp-map{left:var(--gwp-panel)}.gwp-crosshair{left:calc(50% + min(135px,23vw))}.gwp-card{right:auto;width:calc(var(--gwp-panel) - 24px);max-height:calc(100% - 24px);box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;padding:10px;font-size:13px;line-height:1.25}.gwp-card strong{font-size:17px}.gwp-card p{margin:6px 0}.gwp-card>div:last-child{position:sticky;bottom:-10px;padding:6px 0;background:#203d30}.gwp-card button{font-size:13px}}';element.appendChild(css);
    const abort=new AbortController(),inert=[],previous=document.activeElement,overflow=document.body.style.overflow;
    document.body.appendChild(element);document.body.style.overflow='hidden';
    for(const node of document.body.children)if(node!==element&&!['SCRIPT','STYLE'].includes(node.tagName)){inert.push([node,node.inert]);node.inert=true;}
    let map,busy=false,done=false,locating=false,locationRequest=0,notice='';
    const finish=()=>{if(done)return;done=true;current=null;abort.abort();try{map?.remove();}catch(error){}inert.forEach(([node,value])=>node.inert=value);element.remove();document.body.style.overflow=overflow;if(previous?.isConnected&&!previous.closest('[inert]'))previous.focus({preventScroll:true});};
    const cancel=()=>{if(busy)return;finish();options.cancel?.();};current={cancel,dispose:finish};
    const status=element.querySelector('.gwp-coordinates'),place=element.querySelector('[data-picker=place]'),locate=element.querySelector('[data-picker=locate]');
    element.querySelector('[data-picker=cancel]').addEventListener('click',cancel,{signal:abort.signal});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cancel();}else if(event.key==='Tab'){const buttons=[...element.querySelectorAll('button,[href],input,select,textarea,[tabindex]')].filter(node=>!node.disabled&&node.tabIndex>=0&&node.getClientRects().length);if(!buttons.length)return;event.preventDefault();event.stopImmediatePropagation();const i=buttons.indexOf(document.activeElement);buttons[(i+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus({preventScroll:true});}},{capture:true,signal:abort.signal});
    root.addEventListener('pagehide',()=>close('pagehide'),{signal:abort.signal});
    function center(){const c=map?.getCenter();return c&&Number.isFinite(c.lat)&&Number.isFinite(c.lng)&&Math.abs(c.lat)<=85.0511287798066?{lat:c.lat,lon:((c.lng+180)%360+360)%360-180}:null;}
    function setNotice(message){notice=message;status.textContent=message;}
    function update(){if(done||busy)return;const c=center();place.disabled=!c;status.textContent=notice||(c?'Crosshair: '+c.lat.toFixed(5)+', '+c.lon.toFixed(5):'Choose a place on the map.');}
    // Native gesture starts clear messages; queued camera/inertia/tile events do not.
    for(const event of ['pointerdown','touchstart','wheel','keydown'])element.querySelector('.gwp-map').addEventListener(event,()=>{if(done||busy)return;notice='';update();},{passive:true,signal:abort.signal});
    locate.addEventListener('click',()=>{
      if(done||busy||locating||!map)return;
      notice='';
      const geolocation=root.navigator?.geolocation;
      if(typeof geolocation?.getCurrentPosition!=='function'){setNotice('Location is unavailable in this browser. Move the map to choose a place, or try again on a device with location.');return;}
      locating=true;locate.disabled=true;locate.textContent='Finding your location…';setNotice('Allow location to center this map. Your home moves only when you press Place my home here.');
      const request=++locationRequest;
      const received=()=>{if(done||busy||request!==locationRequest)return false;locationRequest++;locating=false;locate.disabled=false;locate.textContent='Use my location';return true;};
      const unavailable=error=>{if(!received())return;setNotice(error?.code===1?'Location permission was denied. Allow it in your browser and try again, or move the map to choose a place.':error?.code===3?'Location timed out. Try again, or move the map to choose a place.':'Your location is unavailable. Try again, or move the map to choose a place.');};
      try{geolocation.getCurrentPosition(position=>{
        if(!received())return;
        const coords=position?.coords,lat=coords?.latitude,lon=coords?.longitude,accuracy=coords?.accuracy,at=position?.timestamp,age=Date.now()-at;
        if(!Number.isFinite(lat)||Math.abs(lat)>85.0511287798066||!Number.isFinite(lon)||Math.abs(lon)>180||!Number.isFinite(accuracy)||accuracy<0||accuracy>500||!Number.isFinite(at)||age< -1000||age>30000){setNotice('A fresh, accurate location is needed (within 500 metres). Try again, or move the map to choose a place.');return;}
        map.jumpTo({center:[lon,lat],zoom:15});update();setNotice('Location found: '+lat.toFixed(5)+', '+lon.toFixed(5)+'. Move the map to adjust, then press Place my home here.');
      },unavailable,{enableHighAccuracy:true,timeout:12000,maximumAge:0});}catch(error){unavailable(error);}
    },{signal:abort.signal});
    place.addEventListener('click',async()=>{if(busy||done)return;map?.stop();const point=center();if(!point)return;notice='';busy=true;locationRequest++;locating=false;locate.disabled=true;locate.textContent='Use my location';place.disabled=true;status.textContent='Saving your home’s location…';try{const result=await options.commit(point);if(done)return;if(result?.ok===false||result===false)throw Error(result?.error||'Your home could not be saved. Please try again.');finish();await options.placed?.(point);}catch(error){if(done)return;busy=false;place.disabled=false;locate.disabled=false;setNotice(error.message||'Your home could not be saved. Please try again.');}},{signal:abort.signal});
    try{
      await options.loadMapLibre();if(done)return false;
      const anchor=options.anchor||options.location;
      map=new root.maplibregl.Map({container:element.querySelector('.gwp-map'),style:options.style,center:anchor?[anchor.lon,anchor.lat]:[0,0],zoom:anchor?15:2,maxZoom:19,pitch:0,attributionControl:{compact:true},pixelRatio:Math.min(1.5,root.devicePixelRatio||1),canvasContextAttributes:{antialias:false}});
      locate.disabled=false;
      map.on('load',update);map.on('move',update);map.on('error',()=>{if(!busy&&!done&&!notice)setNotice('Map data is unavailable here. You can use cached areas or try again when connected.');});
      element.querySelector('[data-picker=cancel]').focus({preventScroll:true});return true;
    }catch(error){status.textContent=error.message||'The map could not open. Cancel and try again.';return false;}
  }
  root.BurbzGeographicHomePicker={open,close,isOpen:()=>!!current};
})(globalThis);
