/* Presentation only: retain the provider's geometry, widths, zoom stops and labels. */
(function(root,factory){ const api=factory(); if(typeof module==='object'&&module.exports)module.exports=api; if(root)root.BurbzFieldMapUI=api; })(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SHAPES={
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5 5-3Z"/>',
    trail:'<path d="M5 3v18M5 5h11l3 4-3 4H5M2 21h6"/>',
    locate:'<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
    camera:'<path d="M3 7h4l2-3h6l2 3h4v13H3Z"/><circle cx="12" cy="13" r="4"/>',
    list:'<path d="M8 6h12M8 12h12M8 18h12M3 6h1m-1 6h1m-1 6h1"/>',
    timber:'<path d="m5 8 9-4c5 0 8 8 5 11l-9 5M5 8c-5 2 0 14 5 12M5 8c5-2 10 9 5 12M14 4l2 5m-1 5 4-2"/><ellipse cx="7" cy="14" rx="2" ry="4" transform="rotate(-25 7 14)"/>',
    notes:'<path d="M6 4h13v16H6c-4 0-4-5 0-5h11M6 4c-4 0-4 5 0 5h2V4M11 8h5m-5 4h5"/>',
    coin:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><path d="m12 7 3 5-3 5-3-5 3-5Z"/>',
    chest:'<path d="M3 10c0-8 18-8 18 0v10H3V10Zm0 0h18M8 10V5m8 5V5M10 10v4h4v-4"/>',
    stone:'<path d="m3 17 3-9 8-5 6 5 2 9-6 4H7l-4-4Zm3-9 6 7 8-7M3 17l9-2 4 6M14 3l-2 12"/>'
  };
  function icon(name){return '<svg class="field-map-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(SHAPES[name]||SHAPES.compass)+'</svg>';}
  function pickupIcon(type){return type?.glyph||icon('compass');}
  function controls(doc){
    [['mapLocateBtn','locate'],['mapZoomInBtn','plus'],['mapZoomOutBtn','minus'],['mapQuestPhotoBtn','camera'],['mapQuestFocusBoard','list']].forEach(([id,name])=>{const e=doc.getElementById(id);if(e)e.innerHTML=icon(name);});

  }
  function apply(map){
    if(!map)return;
    const paint=(id,key,value)=>{try{map.setPaintProperty(id,key,value);}catch(e){}};
    const visibility=(id,value)=>{try{map.setLayoutProperty(id,'visibility',value);}catch(e){}};
    (map.getStyle()?.layers||[]).forEach(layer=>{
      const id=layer.id||'',src=layer['source-layer']||'',type=layer.type;
      if(type==='background')paint(id,'background-color','#71816a');
      if(type==='fill' && /landcover|landuse|park|wood|forest|grass/i.test(id)){
        paint(id,'fill-color',['match',['get','class'],['wood','forest'],'#365c49',['grass','grassland','park','recreation_ground'],'#8b9e73',['farmland','farm','orchard'],'#a4ad7c',['sand','beach'],'#c9bb89',['residential','suburb'],'#a19a80',['industrial','commercial'],'#979580','#788e6d']);
        paint(id,'fill-opacity',.9);
      }
      if(/water|river|stream/i.test(id)){
        if(type==='fill'){paint(id,'fill-color','#527f86');paint(id,'fill-opacity',1);}
        if(type==='line')paint(id,'line-color','#83b4b8');
      }
      if(type==='line' && /road|highway|transport|street|path|track/i.test(id)){
        const casing=/case|casing|outline/i.test(id);
        paint(id,'line-color',casing?'#65694f':['match',['get','class'],['motorway','trunk','primary'],'#c8b78d',['secondary','tertiary'],'#e0d1aa',['path','track','footway','bridleway','pedestrian'],'#fff1bd','#ecdfbd']);
        paint(id,'line-opacity',/tunnel/i.test(id)?.45:1);
        if(!casing && /path|track/i.test(id))paint(id,'line-dasharray',[2.4,1.6]);
      }
      if(/building/i.test(id)){
        if(type==='fill-extrusion')visibility(id,'none');
        if(type==='fill'){
          visibility(id,'visible');paint(id,'fill-color','#b5a88b');paint(id,'fill-outline-color','#776e59');
          paint(id,'fill-opacity',['interpolate',['linear'],['zoom'],13,0,14.5,.62,17,.88]);
        }
      }
      if(type==='symbol'){
        const road=/transportation_name|housenumber|aerodrome_label/i.test(src)||/shield|highway|road[-_]|junction|oneway|ref|ferry|aeroway|transit|railway/i.test(id);
        if(road)visibility(id,'none');
        else if(/label|place|poi/i.test(id)||src==='poi')visibility(id,/place|settlement|country|city|town/i.test(id)?'visible':'none');
        if(map.getLayoutProperty(id,'visibility')!=='none' && layer.layout?.['text-field']){
          paint(id,'text-color','#243a2d');paint(id,'text-halo-color','#f5eed4');paint(id,'text-halo-width',1.6);paint(id,'text-halo-blur',.35);
        }
      }
    });
  }
  return Object.freeze({apply,icon,pickupIcon,controls});
});
