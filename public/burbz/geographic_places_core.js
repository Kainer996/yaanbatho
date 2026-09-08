/* Fictional Alderwing stops on mapped walking ways; never settlement ownership. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.BurbzGeographicPlacesCore=api;})(globalThis,function(){'use strict';
 const TYPES=['cabin','cabin','hut','chapel','storehouse'];
 const NAMES={cabin:'Wayside cabin',hut:'Trail shelter',chapel:'Woodland sanctuary',storehouse:'Ranger lodge'};
 const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;
 function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
 function distance(a,b){if(!valid(a)||!valid(b))return Infinity;const r=Math.PI/180,dlat=(b.lat-a.lat)*r,dlon=(b.lon-a.lon)*r;return 12742000*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dlon/2)**2)));}
 function query(p,network){return network.buildOverpassQuery(p.lat,p.lon,1800).replace('out body geom;','out body geom; nwr[waterway=waterfall](around:1800,'+p.lat.toFixed(6)+','+p.lon.toFixed(6)+');out body center;');}
 function parse(json,position,network){
  if(!valid(position)||!Array.isArray(json?.elements)||json.remark||json.elements.length>25000)throw Error('Nearby paths could not be loaded completely.');
  const nodes=new Map(),excluded=new Set(),candidates=new Map(),falls=[];
  for(const e of json.elements){if(e.type==='node')nodes.set(String(e.id),e);if(e.type==='relation'&&e.tags?.['restriction:foot'])for(const m of e.members||[])if(m.type==='way')excluded.add(String(m.ref));}
  for(const way of json.elements){
   if(way.tags?.waterway==='waterfall'){const p=way.type==='node'?way:way.center;if(valid(p)&&distance(p,position)<=1800)falls.push({id:'fall:'+way.type+':'+way.id,lat:p.lat,lon:p.lon,type:'waterfall',name:'Waterfall',seed:hash(way.id)});}
   if(way.type!=='way'||excluded.has(String(way.id)))continue;
   const t=way.tags||{},access=network.classifyWay(t);
   if(!access.eligible||!access.path||access.steps||access.permissive||t.bridge&&t.bridge!=='no'||t.tunnel&&t.tunnel!=='no')continue;
   // Require complete node evidence, including barriers, before placing a stop.
   if(!Array.isArray(way.nodes)||way.nodes.length<3||way.nodes.some(id=>!valid(nodes.get(String(id)))||network.nodeBlocked(nodes.get(String(id)).tags)))continue;
   const inside=way.nodes.slice(1,-1).map(id=>nodes.get(String(id))).filter(valid);
   if(!inside.length)continue;
   inside.sort((a,b)=>hash(a.id)-hash(b.id));
   for(const n of inside.filter((n,i)=>i===0||hash(n.id)%19===0)){
    if(distance(n,position)>1500)continue;
    const seed=hash(n.id),type=TYPES[seed%TYPES.length],id='wayside:node:'+n.id;
    candidates.set(id,{id,lat:n.lat,lon:n.lon,seed,type,name:NAMES[type],way:String(way.id)});
   }
  }
  const spaced=[];
  for(const p of [...candidates.values()].sort((a,b)=>a.seed-b.seed))if(spaced.every(q=>distance(p,q)>140))spaced.push(p);
  return {places:spaced.sort((a,b)=>distance(a,position)-distance(b,position)).slice(0,12),falls:[...new Map(falls.map(p=>[p.id,p])).values()].slice(0,8)};
 }
 function arrival(place,fix,now=Date.now()){
  if(!valid(fix)||!Number.isFinite(fix.at)||now-fix.at>120000||fix.at>now+10000)return{ready:false,reason:'Waiting for a fresh GPS fix',distance:null};
  if(!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>50)return{ready:false,reason:'Waiting for GPS accuracy within 50 m',distance:null};
  const d=distance(place,fix);return{ready:d<=45,distance:Math.round(d),reason:d<=45?'You have arrived':'Walk within 45 m to enter'};
 }
 return {hash,distance,query,parse,arrival,valid};
});
