/* Persistent enemy outposts. Coordinates and receipts survive scene streaming.
 * The app supplies trusted/monotonic time and commits rewards with combat HP. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./geographic_world_core.js'):root.BurbzGeographicWorldCore);if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzEnemyOutpostsCore=api;})(globalThis,function(G){
'use strict';
const CELL=600,DEFENDERS=3,HP=50,XP=120,REVEAL=180,COINS_PER_HOUR=5,CAP=60,MAX_SAVED=2048,MAX_VISIBLE=2,MAX_ACTIVE=3;
const clone=x=>structuredClone(x),hash=s=>{let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
const empty=()=>({version:1,clock:0,camps:{}}),finite=Number.isFinite;
function candidate(row,col,site=0){const lat0=row*CELL/111320,n=Math.max(1,Math.floor(G.EARTH_CIRCUMFERENCE*Math.cos(lat0*Math.PI/180)/CELL));col=(col%n+n)%n;const id='outpost-v1:'+row+':'+col,seed=hash(id),lat=(row+.35+(seed%301)/1000)*CELL/111320,lon=-180+(col+.35+((seed>>>10)%301)/1000)/n*360;const base={id,lat,lon,seed,site:Number.isInteger(site)&&site>=0&&site<25?site:0};if(base.site){const i=base.site<13?base.site-1:base.site,dx=(i%5-2)*8,dz=(Math.floor(i/5)-2)*8;Object.assign(base,G.unproject({lat,lon},{x:dx,y:0,z:dz}));delete base.altitude;}return base;}
function nearby(p){if(!G.validCoordinate(p))return[];const row=Math.floor(p.lat*111320/CELL),list=[];for(let r=row-1;r<=row+1;r++){const n=Math.max(1,Math.floor(G.EARTH_CIRCUMFERENCE*Math.cos(r*CELL/111320*Math.PI/180)/CELL)),col=Math.floor((p.lon+180)/360*n);for(let c=col-1;c<=col+1;c++){const v=candidate(r,c);if(G.validCoordinate(v))list.push(v);}}return list.sort((a,b)=>G.distance(a,p)-G.distance(b,p));}
function sites(p){const m=/^outpost-v1:(-?\d+):(\d+)$/.exec(p.id);return m?Array.from({length:25},(_,i)=>candidate(+m[1],+m[2],i)):[];}
// All defenders share a real approach. This is a bounded layout probe, not
// pathfinding or saved victory state; failure leaves the entire roster pending.
function* guardLayoutSteps({point,ground,valid,walkClear,clear}){
 const preferred=[[-3,-2],[0,3],[3,-2]],alternates=[];
 for(const z of [-3,0,3])for(const x of [-3,0,3])alternates.push([x,z]);
 for(const z of [-4.5,-1.5,1.5,4.5])for(const x of [-4.5,-1.5,1.5,4.5])alternates.push([x,z]);
 const body=([x,z])=>{x+=point.x;z+=point.z;const h=ground(x,z);return finite(h)?{x,y:h+.85,z}:null;};
 const stands=new Map(),stand=offset=>{const key=offset.join(',');if(stands.has(key))return stands.get(key);const p=body(offset);let ok=!!p;
  if(ok)for(const [dx,dz]of [[0,0],[-.35,0],[.35,0],[0,-.35],[0,.35]]){const h=ground(p.x+dx,p.z+dz);if(!finite(h)||Math.abs(h-(p.y-.85))>.45||!valid(p.x+dx,p.z+dz,h+.85)){ok=false;break;}}
  const result=ok?p:null;stands.set(key,result);return result;};
 for(const gate of [[0,9],[9,0],[0,-9],[-9,0],[7,7],[7,-7],[-7,-7],[-7,7]]){
  const approach=stand(gate);yield;if(!approach)continue;const positions=[];
  for(const first of preferred){let placed=null;for(const offset of [first,...alternates]){const p=stand(offset);yield;if(!p||positions.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<1.5))continue;
    if(walkClear(approach,p)&&clear({...approach,y:approach.y+.7},p)){placed=p;break;}}
   if(!placed)break;positions.push(placed);}
  if(positions.length===DEFENDERS)return{positions,approach};
 }
 return null;
}
function guardLayout(options){const steps=guardLayoutSteps(options);let next;do{next=steps.next();}while(!next.done);return next.value;}
function normalize(raw){const s=empty();s.clock=Math.max(0,Number(raw?.clock)||0);for(const [id,c]of Object.entries(raw?.camps||{}).slice(0,MAX_SAVED)){const m=/^outpost-v1:(-?\d+):(\d+)$/.exec(id);if(!m||!c)continue;const p=candidate(+m[1],+m[2],c.site);if(p.id!==id||!G.validCoordinate(p))continue;const hp=Array.from({length:DEFENDERS},(_,i)=>Math.max(0,Math.min(HP,finite(c.hp?.[i])?c.hp[i]:HP))),liberated=hp.every(n=>n===0)&&c.liberated===true;s.camps[id]={...p,hp,liberated,liberatedAt:liberated?Math.max(0,Number(c.liberatedAt)||0):0,credit:liberated?Math.max(0,Math.min(CAP,Number(c.credit)||0)):0,at:Math.max(0,Number(c.at)||s.clock)};}return s;}
function discover(s,p,now){if(s.camps[p.id])return false;if(Object.keys(s.camps).length>=MAX_SAVED)return false;const m=/^outpost-v1:(-?\d+):(\d+)$/.exec(p.id);if(!m)return false;const exact=candidate(+m[1],+m[2],p.site);if(G.distance(exact,p)>.1)return false;s.camps[p.id]={...exact,hp:Array(DEFENDERS).fill(HP),liberated:false,liberatedAt:0,credit:0,at:Math.max(s.clock,now||0)};return true;}
function accrue(s,now){now=Math.max(s.clock,finite(now)?now:0);for(const c of Object.values(s.camps)){if(c.liberated)c.credit=Math.min(CAP,c.credit+Math.max(0,now-c.at)/3600000*COINS_PER_HOUR);c.at=Math.max(c.at,now);}s.clock=now;}
function damage(s,rows,now){accrue(s,now);const liberated=[];for(const row of rows||[]){const c=s.camps[row.campId];if(!c||c.liberated||!Number.isInteger(row.member)||row.member<0||row.member>=DEFENDERS||row.id!==c.id+':guard:'+row.member||!finite(row.hp))continue;c.hp[row.member]=Math.min(c.hp[row.member],Math.max(0,row.hp));}
 for(const c of Object.values(s.camps))if(!c.liberated&&c.hp.every(h=>h===0)){c.liberated=true;c.liberatedAt=s.clock;c.at=s.clock;c.credit=0;liberated.push(c.id);}return{xp:liberated.length*XP,liberated};}
function collect(s,id,now){accrue(s,now);const c=s.camps[id];if(!c?.liberated)return 0;const coins=Math.floor(c.credit+1e-9);c.credit=Math.max(0,c.credit-coins);return coins;}
function preview(s,id,now){const c=s.camps[id];return c?.liberated?Math.min(CAP,c.credit+Math.max(0,now-c.at)/3600000*COINS_PER_HOUR):0;}
function rows(actors){return actors.filter(a=>a.campId).map(a=>({id:a.id,campId:a.campId,member:a.member,hp:a.fighter.hp}));}
function receipts(s){return Object.values(s?.camps||{}).filter(c=>c.liberated).map(c=>({...c,radius:REVEAL}));}
return{CELL,DEFENDERS,HP,XP,REVEAL,COINS_PER_HOUR,CAP,MAX_SAVED,MAX_VISIBLE,MAX_ACTIVE,empty,normalize,candidate,sites,nearby,guardLayout,guardLayoutSteps,discover,accrue,damage,collect,preview,rows,receipts,clone};
});
