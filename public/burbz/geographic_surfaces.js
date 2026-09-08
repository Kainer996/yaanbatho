/* Painted grass and water on the provider's own polygons and river geometry. */
(function(root){'use strict';
const PREFIX='burbz-surface-',controllers=new WeakMap();
function image(kind,phase=0){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
 let seed=kind==='grass'?137:291;const random=()=>{seed=Math.imul(seed,1664525)+1013904223|0;return(seed>>>0)/4294967296;};
 c.lineCap='round';
 if(kind==='grass'){
  for(let i=0;i<26;i++){const x=random()*128,y=random()*128,s=2+random()*3;
   c.strokeStyle=i%3?'#3651398c':'#d4c98070';c.lineWidth=i%3?1.2:1;
   c.beginPath();c.moveTo(x-s,y-s*.5);c.lineTo(x,y+s*.5);c.lineTo(x+s*.6,y-s);c.stroke();
   if(i%6===0){c.fillStyle=i%12?'#d9bc5fa0':'#c89e8180';c.fillRect(x+2,y-2,1.5,1.5);}
  }
 }else{
  // Short highlights, broad underwater bands and broken ripples. Wrapping
  // each stroke makes the repeating tile seamless as its phase advances.
  for(let i=0;i<19;i++){const x=random()*128,y=random()*128,w=6+random()*17,shift=phase*(i%2?1:-1);
   c.strokeStyle=i%3?'#b1d9c47a':'#173f5340';c.lineWidth=i%3?1.25:4;
   for(const dx of [-128,0,128])for(const dy of [-128,0,128]){const px=((x+shift)%128+128)%128+dx,py=y+dy;
    c.beginPath();c.moveTo(px-w/2,py);c.bezierCurveTo(px-w/4,py-1.7,px+w/4,py+1.7,px+w/2,py);c.stroke();}
  }
 }
 return{width:128,height:128,data:c.getImageData(0,0,128,128).data};
}
function attach(map,options={}){
 if(controllers.has(map))return controllers.get(map);
 const container=map.getContainer(),listeners=[],abort=new AbortController(),pointers=new Set(),ids=[],images=[];
 const motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');let timer=null,disposed=false,installed=false,phase=0,hasWater=false,observer=null;
 const state={installed:false,grassLayers:0,waterLayers:0,animationFrames:0,visible:false,waterVisible:false,errors:[]};
 function on(name,fn){map.on(name,fn);listeners.push([name,fn]);}
 function visible(){return !disposed&&!document.hidden&&container.isConnected!==false&&container.getClientRects().length>0&&(!options.isVisible||options.isVisible());}
 function interacting(){return pointers.size>0||map.isMoving();}
 function stop(){if(timer)clearTimeout(timer);timer=null;}
 function schedule(){stop();state.visible=visible();if(!installed||!state.visible||!hasWater||motion?.matches||interacting())return;
  const delay=(options.getQuality?.()?.frameP90||0)>30?1000:400;timer=setTimeout(animate,delay);
 }
 function animate(){timer=null;if(!visible()||interacting()||motion?.matches)return;
  try{phase=(phase+1)%32;map.updateImage(PREFIX+'ripples',image('water',phase));
   // Native dashes follow the mapped river, including its bends and branches.
   if(map.getLayer(PREFIX+'river-flow'))map.setPaintProperty(PREFIX+'river-flow','line-dasharray',[[0,4,1,3],[1,4,1,2],[2,4,1,1],[3,4,1,0]][phase%4]);
   state.animationFrames++;map.triggerRepaint();
  }catch(error){state.errors.push(String(error.message||error));state.errors=state.errors.slice(-4);}
  schedule();
 }
 function inspect(){if(!installed||!visible()){hasWater=false;state.waterVisible=false;schedule();return;}
  try{const layers=[PREFIX+'water',PREFIX+'river'].filter(id=>map.getLayer(id));hasWater=layers.length>0&&map.queryRenderedFeatures({layers}).length>0;}catch(_){hasWater=false;}
  state.waterVisible=hasWater;schedule();
 }
 function add(layer,before){if(map.getLayer(layer.id))return;map.addLayer(layer,before);ids.push(layer.id);}
 function install(){if(disposed||installed||!map.isStyleLoaded())return;
  try{const layers=map.getStyle().layers||[],cover=layers.find(l=>l['source-layer']==='landcover'),water=layers.find(l=>l['source-layer']==='water'),river=layers.find(l=>l['source-layer']==='waterway');
   // Administrative outlines can precede landcover. Insert after the native
   // ground/water fills so they cannot paint over these details, before roads.
   const before=layers.find(l=>l['source-layer']==='transportation'&&l.type==='line')?.id||layers.find(l=>l.type==='symbol')?.id;
   for(const [id,kind]of [[PREFIX+'meadow','grass'],[PREFIX+'ripples','water']])if(!map.hasImage(id)){map.addImage(id,image(kind));images.push(id);}
   // Light ground hatching also details the plain base map. Native forests,
   // water and built land still paint over it; 3D tufts use mapped grass only.
   if(!map.getSource(PREFIX+'ground'))map.addSource(PREFIX+'ground',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-180,-85],[180,-85],[180,85],[-180,85],[-180,-85]]]}}});
   add({id:PREFIX+'ground',type:'fill',source:PREFIX+'ground',minzoom:13,paint:{'fill-pattern':PREFIX+'meadow','fill-opacity':['interpolate',['linear'],['zoom'],13,.20,16,.48]}},layers.find(l=>l.type==='fill'&&['landcover','landuse','water'].includes(l['source-layer']))?.id||before);
   if(cover){add({id:PREFIX+'grass',type:'fill',source:cover.source,'source-layer':'landcover',minzoom:12,filter:['==',['get','class'],'grass'],paint:{'fill-pattern':PREFIX+'meadow','fill-opacity':['interpolate',['linear'],['zoom'],12,.22,15,.62]}},before);state.grassLayers=1;}
   if(water){
    const filter=['!=',['get','brunnel'],'tunnel'];
    add({id:PREFIX+'water',type:'fill',source:water.source,'source-layer':'water',filter,paint:{'fill-color':['match',['get','class'],'ocean','#386475','river','#4b8588','#397988'],'fill-opacity':.9}},before);
    add({id:PREFIX+'water-ripples',type:'fill',source:water.source,'source-layer':'water',filter,minzoom:12,paint:{'fill-pattern':PREFIX+'ripples','fill-opacity':.64}},before);
    add({id:PREFIX+'shore',type:'line',source:water.source,'source-layer':'water',filter,minzoom:12,paint:{'line-color':'#cbd8b0','line-width':['interpolate',['linear'],['zoom'],12,.5,17,1.7],'line-opacity':.65}},before);
    state.waterLayers+=3;
   }
   if(river){const line={type:'line',source:river.source,'source-layer':'waterway',minzoom:12,filter:['all',['!=',['get','brunnel'],'tunnel'],['match',['get','class'],['river','stream','canal'],true,false]],layout:{'line-cap':'round','line-join':'round'}};
    add({...line,id:PREFIX+'river',paint:{'line-color':'#56969b','line-width':['interpolate',['linear'],['zoom'],12,.8,15,2.8,18,7.5],'line-opacity':.85}},before);
    add({...line,id:PREFIX+'river-flow',paint:{'line-color':'#cee5d3','line-width':['interpolate',['linear'],['zoom'],12,.3,15,.65,18,1.3],'line-dasharray':[1,4,1,2],'line-opacity':.68}},before);state.waterLayers+=2;
   }
   installed=state.installed=true;map.triggerRepaint();
  }catch(error){state.errors.push(String(error.message||error));state.errors=state.errors.slice(-4);}
 }
 on('idle',()=>{if(!installed)install();else if(!timer)inspect();});
 on('style.load',()=>{installed=state.installed=false;state.grassLayers=state.waterLayers=0;ids.length=images.length=0;install();});
 on('moveend',inspect);on('movestart',stop);on('resize',inspect);
 const canvas=map.getCanvasContainer?.();
 canvas?.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);stop();},{passive:true,signal:abort.signal});
 const end=e=>{pointers.delete(e.pointerId);if(!pointers.size)inspect();};
 for(const event of ['pointerup','pointercancel'])document.addEventListener(event,end,{capture:true,signal:abort.signal});
 canvas?.addEventListener('pointerleave',end,{passive:true,signal:abort.signal});
 document.addEventListener('visibilitychange',()=>{pointers.clear();inspect();},{signal:abort.signal});motion?.addEventListener('change',inspect,{signal:abort.signal});
 if(root.IntersectionObserver){observer=new IntersectionObserver(inspect);observer.observe(container);}
 function dispose(){if(disposed)return;disposed=true;stop();abort.abort();observer?.disconnect();listeners.forEach(([name,fn])=>map.off(name,fn));
  for(const id of [...new Set(ids)].reverse())if(map.getLayer(id))map.removeLayer(id);
  for(const id of [...new Set(images)])if(map.hasImage(id))map.removeImage(id);controllers.delete(map);
  if(map.getSource(PREFIX+'ground'))map.removeSource(PREFIX+'ground');
 }
 const api={state,refresh:inspect,dispose};controllers.set(map,api);on('remove',dispose);install();return api;
}
root.BurbzGeographicSurfaces={attach,image};
})(globalThis);
