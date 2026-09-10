/* Map-side stops and independent furnished room visits. No economy grants. */
(function(root){'use strict';const controllers=new WeakMap();
 function attach(map,options){if(controllers.has(map))return controllers.get(map);
  const core=root.BurbzGeographicPlacesCore,abort=new AbortController(),markers=new Map(),pointers=new Set(),container=map.getContainer();
  const state={inside:false,loading:false,places:[],falls:[],grass:0,error:null};let selected=null,disposed=false,lastQuery=null,retryAt=0,entryError='',generation=0,grass=[],grassDirty=true,grassKey='',pending=false,ownsWalk=false,roomSource=null,roomHost=null,cameraReturn=null;
  const visible=()=>!disposed&&!state.inside&&!document.hidden&&options.isVisible()&&container.getClientRects().length>0;
  const scene=root.BurbzGeographicDetailsScene.create(map,{visible,interacting:()=>pointers.size>0||map.isMoving()});
  const card=document.createElement('section');card.className='geographic-place-card';card.hidden=true;card.setAttribute('role','dialog');card.setAttribute('aria-label','Wayside place');
  card.innerHTML='<button class="gp-close" type="button" aria-label="Close place">×</button><small>ALDERWING · WAYSIDE</small><h3></h3><p class="gp-description"></p><p class="gp-distance" role="status"></p><button class="gp-enter" type="button">Enter building</button>';
  document.body.append(card);const button=card.querySelector('.gp-enter'),status=card.querySelector('.gp-distance');
  function close(){if(card.hidden)return false;selected=null;card.hidden=true;pending=false;generation++;return true;}
  card.querySelector('.gp-close').addEventListener('click',close,{signal:abort.signal});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!state.inside&&close()){e.preventDefault();e.stopImmediatePropagation();}if(e.key==='Tab'&&!card.hidden&&!state.inside){const first=card.querySelector('.gp-close'),last=button.disabled?first:button;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}},{capture:true,signal:abort.signal});
  function paint(){if(!selected||card.hidden)return;const gate=core.arrival(selected,options.getPosition());
   card.querySelector('h3').textContent=selected.name;
   card.querySelector('.gp-description').textContent=selected.type==='waterfall'?'A cascade at this mapped waterfall.':'A fictional Alderwing stop beside a mapped walking path. Explore its furnished room when you arrive.';
   status.textContent=entryError||(gate.distance==null?'':gate.distance+' m away · ')+gate.reason+(options.data()?.visited?.[selected.id]?' · Visited':'');
   button.hidden=selected.type==='waterfall';button.disabled=pending||!gate.ready;button.textContent=pending?'Opening…':'Open door · Enter';
  }
  function select(place){if(state.inside)return;entryError='';selected=place;card.hidden=false;paint();card.querySelector('.gp-close').focus({preventScroll:true});}
  function commit(next){if(!options.save(next))throw Error('Could not save this visit. Please try again.');}
  function disposeRoom(){if(roomSource){roomSource.renderer.dispose();roomSource.renderer.forceContextLoss();roomSource=null;}roomHost?.remove();roomHost=null;}
  async function enter(){if(pending||!selected||!core.arrival(selected,options.getPosition()).ready||root.BurbzVillageWalk?.isOpen())return;
   const place=selected,token=++generation;entryError='';pending=true;paint();
   try{await options.loadWalk();if(disposed||token!==generation||selected!==place||!options.isVisible()||root.BurbzVillageWalk.isOpen())return;
    if(!core.arrival(place,options.getPosition()).ready)throw Error('Your position changed. Move close to the door to enter.');
    const target={scope:'geographic',buildingId:place.type,seed:place.seed,homeId:place.id};
    cameraReturn={center:map.getCenter(),zoom:map.getZoom(),pitch:map.getPitch(),bearing:map.getBearing()};
    ownsWalk=true;root.BurbzVillageWalk.open({name:place.name,room:target,opener:button,
     source:()=>{
      if(disposed||token!==generation||!core.arrival(place,options.getPosition()).ready||!options.isVisible())throw Error('A fresh nearby GPS fix is needed to open this door.');
      const T=root.THREE;roomHost=document.createElement('div');roomHost.hidden=true;document.body.append(roomHost);
      const renderer=new T.WebGLRenderer({antialias:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(1.25,devicePixelRatio||1));renderer.setSize(390,600);roomHost.append(renderer.domElement);
      return roomSource={scene:new T.Scene(),renderer,camera:new T.PerspectiveCamera(68,390/600,.08,110),buildings:[],movers:[]};
     },
     interiors:{describe:t=>t.homeId===place.id&&core.arrival(place,options.getPosition()).ready?{name:place.name}:null},
     suspend:()=>{
      const data=options.data()||{},visited={...data.visited,[place.id]:Date.now()};
      const entries=Object.entries(visited).sort((a,b)=>b[1]-a[1]).slice(0,240);commit({...data,visited:Object.fromEntries(entries)});
      state.inside=true;card.hidden=true;options.refreshMap();
     },
     resume:(reason)=>{ownsWalk=false;disposeRoom();state.inside=false;pending=false;
      if(!disposed&&options.isVisible()&&!['navigation','pagehide'].includes(reason)){map.jumpTo(cameraReturn);selected=place;card.hidden=false;paint();}options.refreshMap();scene.refresh();}
    });
   }catch(error){disposeRoom();entryError=state.error=error.message;status.textContent=error.message;}
   finally{pending=false;if(!root.BurbzVillageWalk?.isOpen())paint();}
  }
  button.addEventListener('click',enter,{signal:abort.signal});
  function draw(){
   const all=[...state.places,...state.falls],active=new Set(all.map(p=>p.id));
   for(const [id,m]of markers)if(!active.has(id)){m.remove();markers.delete(id);}
   for(const place of all)if(!markers.has(place.id)){
    const el=document.createElement('button');el.type='button';el.className='geographic-place-marker';el.setAttribute('aria-label',place.name);el.textContent=place.type==='waterfall'?'≈':'⌂';el.title=place.name;
    el.addEventListener('click',e=>{e.stopPropagation();select(place);},{signal:abort.signal});
    markers.set(place.id,options.marker({element:el,anchor:'bottom'}).setLngLat([place.lon,place.lat]).addTo(map));
   }
   syncQuestObjects();options.refreshMap();
  }
  let questObjectKey='';
  function syncQuestObjects(){
   const next=options.getQuestObjects?.()||[];state.questObjects=next;
   questObjectKey=JSON.stringify(next);scene.set([...next,...state.places,...state.falls,...grass]);
  }
  function refreshQuestObjects(){if(JSON.stringify(options.getQuestObjects?.()||[])!==questObjectKey)syncQuestObjects();}
  function meadow(){if(!grassDirty||!visible()||pointers.size||map.isMoving()||!map.isStyleLoaded())return;
   const layer=map.getStyle().layers.find(l=>l['source-layer']==='landcover');if(!layer)return;
   try{const features=map.querySourceFeatures(layer.source,{sourceLayer:'landcover',filter:['==','class','grass']}).slice(0,512).map(f=>({sourceLayer:'landcover',properties:{class:'wood'},geometry:f.geometry}));
    const c=map.getCenter(),b=map.getBounds(),view={center:[c.lng,c.lat],bounds:[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()],zoom:map.getZoom()};
    const key=JSON.stringify([features,view]);if(key===grassKey){grassDirty=false;return;}grassKey=key;
    grass=root.BurbzGeographicForestCore.placeTrees(features,view,{dense:true,maxTrees:96,maxCandidates:2000}).trees.map(t=>({id:'grass:'+t.id,type:'grass',lat:t.latitude,lon:t.longitude,seed:core.hash(t.id)}));
    state.grass=grass.length;grassDirty=false;draw();
   }catch(error){state.error=error.message;}
  }
  async function update(){paint();refreshQuestObjects();if(!visible())return;const p=options.getPosition();if(!core.valid(p)||state.loading||Date.now()<retryAt)return;
   if(lastQuery&&core.distance(p,lastQuery)<600&&Date.now()-lastQuery.at<300000)return;
   lastQuery={...p,at:Date.now()};state.loading=true;
   try{const data=await options.fetch(core.query(p,root.BurbzWalkingRouteCore));if(disposed)return;
    const parsed=core.parse(data,p,root.BurbzWalkingRouteCore);if(core.distance(p,options.getPosition())>600){lastQuery=null;return;}
    state.places=parsed.places;state.falls=parsed.falls;state.error=null;
    const old=options.data()||{},catalogue=[...parsed.places,...parsed.falls,...(old.catalogue||[])];
    const records=new Map();for(const p of catalogue)if(!records.has(p.id))records.set(p.id,p);
    const unique=[...records.values()].slice(0,240);commit({...old,catalogue:unique});draw();
   }catch(error){state.error=error.message;lastQuery=null;retryAt=Date.now()+15000;}finally{state.loading=false;}
  }
  function movement(){grassDirty=true;meadow();}
  map.getCanvasContainer?.().addEventListener('pointerdown',e=>pointers.add(e.pointerId),{passive:true,signal:abort.signal});
  const endPointer=e=>{pointers.delete(e.pointerId);if(!pointers.size){meadow();scene.refresh();}};
  for(const event of ['pointerup','pointercancel'])document.addEventListener(event,endPointer,{capture:true,signal:abort.signal});
  function source(e){const layers=map.getStyle()?.layers||[];if(layers.some(l=>l.source===e.sourceId&&l['source-layer']==='landcover'))grassDirty=true;}
  function visibility(){if(document.hidden)pointers.clear();if(!options.isVisible())close();else{update();meadow();}}
  map.on('moveend',movement);map.on('sourcedata',source);map.on('idle',meadow);document.addEventListener('visibilitychange',visibility,{signal:abort.signal});
  const observer=new MutationObserver(visibility);observer.observe(document.getElementById('screen-map')||container,{attributes:true,attributeFilter:['class','style']});
  const data=options.data(),p=options.getPosition(),cached=(data?.catalogue||[]).filter(r=>core.valid(r)&&core.distance(r,p)<1800&&['cabin','hut','chapel','storehouse','waterfall'].includes(r.type));
  state.places=cached.filter(r=>r.type!=='waterfall').slice(0,12);state.falls=cached.filter(r=>r.type==='waterfall').slice(0,8);draw();
  function dispose(){if(disposed)return;disposed=true;generation++;if(ownsWalk)root.BurbzVillageWalk.close('navigation');disposeRoom();abort.abort();observer.disconnect();map.off('moveend',movement);map.off('sourcedata',source);map.off('idle',meadow);map.off('remove',dispose);for(const m of markers.values())m.remove();markers.clear();scene.dispose();card.remove();controllers.delete(map);}
  const api={state,scene:scene.state,update,refreshQuestObjects,close,dispose,get inside(){return state.inside;}};controllers.set(map,api);map.on('remove',dispose);update();return api;
 }
 root.BurbzGeographicPlaces={attach};
})(globalThis);
