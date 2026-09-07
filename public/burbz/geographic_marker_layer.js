/* Geographic DOM markers with one projection pass per map render.
 * MapLibre 5.24 Marker._updateOpacity reads GPU terrain depth for every marker.
 * These readable game markers deliberately stay visible over terrain. Public
 * map.project still anchors each element to the real DEM elevation, without
 * readPixels, a second map, camera changes or mutation of saved coordinates.
 * Sources: maplibre-gl-js/v5.24.0 src/ui/marker.ts and
 * src/geo/projection/mercator_transform.ts (locationToScreenPoint).
 */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BurbzGeographicMarkers=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const VERSION='geographic-markers-v1-20260907';
  const managers=new WeakMap();
  const anchors=Object.freeze({center:'-50%, -50%',top:'-50%, 0%',bottom:'-50%, -100%',left:'0%, -50%',right:'-100%, -50%',
    'top-left':'0%, 0%','top-right':'-100%, 0%','bottom-left':'0%, -100%','bottom-right':'-100%, -100%'});
  const alignment=value=>value==='map'?'map':value==='viewport'?'viewport':'auto';
  function coordinates(value){
    const lng=Array.isArray(value)?value[0]:value?.lng??value?.lon,lat=Array.isArray(value)?value[1]:value?.lat;
    if(!Number.isFinite(lng)||!Number.isFinite(lat)||lat<-90||lat>90)throw new TypeError('Marker requires finite longitude and latitude.');
    return {lng,lat};
  }
  function point(value){
    const x=Array.isArray(value)?value[0]:value?.x,y=Array.isArray(value)?value[1]:value?.y;
    if(!Number.isFinite(x)||!Number.isFinite(y))throw new TypeError('Marker offset requires finite x and y.');
    return {x,y};
  }
  function managerFor(map){
    let manager=managers.get(map);
    if(manager)return manager;
    const container=map.getContainer(),doc=container.ownerDocument||root.document;
    manager={map,container,doc,markers:new Set(),dirty:true,repaintRequested:false,disposed:false,hasLayout:false,listeners:[],observers:[]};
    // getClientRects forces layout after transforms are written. Measure only
    // at visibility/size boundaries, never from heading setters or render.
    manager.measureVisibility=()=>{manager.hasLayout=!doc?.hidden&&container.isConnected!==false&&container.getClientRects().length>0;};
    manager.measureVisibility();
    manager.visible=()=>!doc?.hidden&&container.isConnected!==false&&manager.hasLayout;
    manager.invalidate=(request=false)=>{
      if(manager.disposed)return;
      manager.dirty=true;
      if(request&&!manager.repaintRequested&&manager.visible()){
        manager.repaintRequested=true;map.triggerRepaint();
      }
    };
    manager.flush=()=>{
      manager.repaintRequested=false;
      if(manager.disposed||!manager.dirty||!manager.visible())return;
      manager.dirty=false;
      const bearing=map.getBearing?.()||0,pitch=map.getPitch?.()||0,center=map.getCenter?.();
      for(const marker of manager.markers)marker._project(map,bearing,pitch,center);
    };
    manager.dispose=()=>{
      if(manager.disposed)return;
      manager.disposed=true;
      for(const [event,handler] of manager.listeners)map.off(event,handler);
      doc?.removeEventListener('visibilitychange',visibilityChanged);
      manager.observers.forEach(observer=>observer.disconnect());
      for(const marker of [...manager.markers])marker.remove();
      managers.delete(map);
    };
    const on=(event,handler)=>{map.on(event,handler);manager.listeners.push([event,handler]);};
    const visibilityChanged=()=>{if(manager.disposed)return;manager.measureVisibility();manager.invalidate(true);};
    on('render',manager.flush);
    for(const event of ['move','terrain','sourcedata','projectiontransition'])on(event,()=>manager.invalidate());
    on('resize',visibilityChanged);
    on('remove',manager.dispose);
    doc?.addEventListener('visibilitychange',visibilityChanged);
    if(root.IntersectionObserver){const observer=new root.IntersectionObserver(visibilityChanged);observer.observe(container);manager.observers.push(observer);}
    const screen=container.closest?.('.screen');
    if(screen&&root.MutationObserver){const observer=new root.MutationObserver(visibilityChanged);observer.observe(screen,{attributes:true,attributeFilter:['class','hidden']});manager.observers.push(observer);}
    managers.set(map,manager);
    return manager;
  }
  class Marker {
    constructor(options={}){
      this._element=options.element||root.document?.createElement('div');
      if(!this._element)throw new TypeError('Marker requires a DOM element.');
      this._anchor=Object.hasOwn(anchors,options.anchor)?options.anchor:'center';
      this._offset=point(options.offset||[0,0]);
      this._rotation=Number.isFinite(options.rotation)?options.rotation:0;
      this._rotationAlignment=alignment(options.rotationAlignment);
      this._pitchAlignment=alignment(options.pitchAlignment);
      this._lngLat=null;this._manager=null;this._popup=null;this._lastTransform=null;
      const element=this._element;
      element.classList.add('maplibregl-marker','burbz-geographic-marker','maplibregl-marker-anchor-'+this._anchor);
      if(options.className)for(const name of options.className.split(/\s+/).filter(Boolean))element.classList.add(name);
      element.style.position='absolute';element.style.left='0px';element.style.top='0px';element.style.opacity='1';element.style.visibility='hidden';
      if(!element.hasAttribute('role'))element.setAttribute('role','button');
      if(!element.hasAttribute('aria-label'))element.setAttribute('aria-label','Map marker');
      this._popupClick=event=>{event.stopPropagation();this.togglePopup();};
    }
    _changed(){this._manager?.invalidate(true);return this;}
    _project(map,bearing,pitch,center){
      if(!this._lngLat)return;
      try{
        let longitude=this._lngLat.lng;
        if(Number.isFinite(center?.lng))longitude+=360*Math.round((center.lng-longitude)/360);
        const projected=map.project([longitude,this._lngLat.lat]);
        if(!Number.isFinite(projected.x)||!Number.isFinite(projected.y))throw new Error('Invalid marker projection.');
        const x=Math.round((projected.x+this._offset.x)*1000)/1000,y=Math.round((projected.y+this._offset.y)*1000)/1000;
        const rotation=this._rotation-(this._rotationAlignment==='map'?bearing:0);
        const pitchAlignment=this._pitchAlignment==='auto'?this._rotationAlignment:this._pitchAlignment;
        const transform=`translate(${anchors[this._anchor]}) translate(${x}px, ${y}px) rotateX(${pitchAlignment==='map'?pitch:0}deg) rotateZ(${rotation}deg)`;
        if(transform!==this._lastTransform){this._element.style.transform=transform;this._lastTransform=transform;}
        if(this._element.style.visibility!=='visible')this._element.style.visibility='visible';
      }catch(error){if(this._element.style.visibility!=='hidden')this._element.style.visibility='hidden';}
    }
    addTo(map){
      if(!map?.project||!map?.getCanvasContainer)throw new TypeError('Marker requires a MapLibre-compatible map.');
      if(this._manager?.map===map)return this;
      this.remove();this._manager=managerFor(map);this._manager.markers.add(this);
      map.getCanvasContainer().appendChild(this._element);return this._changed();
    }
    remove(){
      const manager=this._manager;this._manager=null;
      if(manager){manager.markers.delete(this);if(!manager.markers.size)manager.dispose();}
      this._element.style.visibility='hidden';this._element.remove();this._popup?.remove();return this;
    }
    setLngLat(value){this._lngLat=coordinates(value);this._popup?.setLngLat(this.getLngLat());return this._changed();}
    getLngLat(){return this._lngLat?{...this._lngLat,toArray(){return [this.lng,this.lat];}}:undefined;}
    getElement(){return this._element;}
    setOffset(value){this._offset=point(value);return this._changed();}
    getOffset(){return {...this._offset};}
    setRotation(value=0){if(!Number.isFinite(value))throw new TypeError('Marker rotation must be finite.');this._rotation=value;return this._changed();}
    getRotation(){return this._rotation;}
    setRotationAlignment(value){this._rotationAlignment=alignment(value);return this._changed();}
    getRotationAlignment(){return this._rotationAlignment;}
    setPitchAlignment(value){this._pitchAlignment=alignment(value);return this._changed();}
    getPitchAlignment(){return this._pitchAlignment==='auto'?this._rotationAlignment:this._pitchAlignment;}
    setPopup(popup){
      this._popup?.remove();this._element.removeEventListener('click',this._popupClick);this._popup=popup||null;
      if(this._popup){if(this._lngLat)this._popup.setLngLat(this.getLngLat());this._element.addEventListener('click',this._popupClick);}
      return this;
    }
    getPopup(){return this._popup;}
    togglePopup(){
      if(!this._popup||!this._manager||!this._lngLat)return this;
      if(this._popup.isOpen())this._popup.remove();else this._popup.setLngLat(this.getLngLat()).addTo(this._manager.map);
      return this;
    }
    addClassName(value){this._element.classList.add(value);return this;}
    removeClassName(value){this._element.classList.remove(value);return this;}
    toggleClassName(value){return this._element.classList.toggle(value);}
  }
  return Object.freeze({VERSION,Marker});
});
