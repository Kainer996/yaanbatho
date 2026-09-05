/* Saved residents and deterministic street routines. Never changes the economy. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzSettlementLife=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const peeps=typeof module==='object'&&module.exports?require('./peep_needs_core.js'):globalThis.BurbzPeepNeeds;
  const NAMES=['Pip','Rowan','Bramble','Wren','Fern','Hazel','Moss','Alder','Clover','Reed','Tansy','Ash','Sorrel','Thistle','Juniper','Flint','Willow','Lark','Cedar','Nettle','Briar','Oak'];
  function hash(value){let n=2166136261;for(const c of String(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
  const count=n=>Math.max(0,Math.min(1000,Math.floor(Number(n)||0)));
  function workforce(population,buildings,definitions){
    const out={available:count(population),required:0,working:0,staffed:{},assigned:{}};
    let free=out.available;
    definitions.filter(b=>b.workers&&count(buildings[b.id])>0).sort((a,b)=>(a.workPriority||99)-(b.workPriority||99)).forEach(b=>{
      out.required+=b.workers;const got=Math.min(b.workers,free);
      if(got){out.assigned[b.id]=got;out.staffed[b.id]=true;out.working+=got;free-=got;}
    });return out;
  }
  function reconcile(raw,options){
    const {seed,population,homes,jobs}=options,pop=count(population);
    const source=raw&&typeof raw==='object'?raw:{};
    let serial=Math.max(0,Math.floor(Number(source.nextId)||0)),seen=new Set();
    const prefix=String(seed)+':resident:';
    const residents=(Array.isArray(source.residents)?source.residents:[]).filter(p=>{
      if(!p||typeof p.id!=='string'||!p.id.startsWith(prefix)||seen.has(p.id))return false;
      const n=Number(p.id.slice(prefix.length));if(!Number.isSafeInteger(n)||n<0)return false;
      serial=Math.max(serial,n+1);seen.add(p.id);return true;
    }).slice(0,pop).map(p=>({id:p.id,name:typeof p.name==='string'?p.name.slice(0,36):NAMES[hash(p.id)%NAMES.length],kind:'humanoid',homeId:p.homeId||null,jobId:p.jobId||null,...(peeps?.sanitize(p.lifeMemory)?{lifeMemory:peeps.sanitize(p.lifeMemory)}:{})}));
    while(residents.length<pop){const id=prefix+serial++;residents.push({id,name:NAMES[hash(id)%NAMES.length],kind:'humanoid',homeId:null,jobId:null});}
    // Keep existing households and crews where capacity still permits them.
    // Reassign only displaced/new residents, using the current paid buildings.
    for(const [field,slots] of [['homeId',homes],['jobId',jobs]]){
      const available=new Map(slots.map(s=>[s.id,count(s.capacity)]));
      for(const p of residents){if(available.get(p[field])>0)available.set(p[field],available.get(p[field])-1);else p[field]=null;}
      for(const p of residents){if(p[field])continue;const id=[...available.keys()].find(k=>available.get(k)>0);if(id!==undefined){p[field]=id;available.set(id,available.get(id)-1);}}
    }
    // v348's species labels described the wrong inhabitants. Reclassify the
    // same people without changing their identity, home, job or serial counter.
    return {version:2,nextId:serial,residents};
  }
  function homeSlots(buildings,definitions){
    return definitions.filter(b=>b.need==='shelter').flatMap(b=>{
      const level=count(buildings[b.id]);
      return b.id==='cottages'?Array.from({length:level},(_,i)=>({id:b.id+':'+i,capacity:b.perLevel})):level?[{id:b.id+':0',capacity:level*b.perLevel}]:[];
    });
  }
  function visibleResidents(residents,limit){
    // Round-robin households/wards, with working residents first within each.
    const buckets=new Map();for(const p of residents){const key=p.id.split(':resident:')[0];if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(p);}
    buckets.forEach(b=>b.sort((a,b)=>Number(!!b.jobId)-Number(!!a.jobId)||a.id.localeCompare(b.id)));
    const out=[];for(let i=0;out.length<limit;i++){let added=false;for(const b of buckets.values()){if(b[i]&&out.length<limit){out.push(b[i]);added=true;}}if(!added)break;}return out;
  }
  const distance=(a,b)=>Math.hypot(b.x-a.x,b.z-a.z);
  function routeLength(path){return path.slice(1).reduce((n,p,i)=>n+distance(path[i],p),0);}
  function samplePath(path,progress){
    if(!path.length)return {x:0,z:0,yaw:0};let remaining=Math.max(0,Math.min(1,progress))*routeLength(path);
    for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],d=distance(a,b);if(remaining<=d||i===path.length-1){const k=d?Math.min(1,remaining/d):0;return {x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k,yaw:Math.atan2(b.x-a.x,b.z-a.z)};}remaining-=d;}
    return {...path[0],yaw:0};
  }
  function routine(resident,paths,now,hour){
    const home=paths.home||[{x:0,z:0}],work=paths.work||home,leisure=paths.leisure||home;
    const atHome=home[0],atWork=work[work.length-1],green=leisure[leisure.length-1];
    if(hour<6||hour>=22)return {...atHome,yaw:0,activity:resident.homeId?'Sleeping at home':'Resting by the green',inside:!!resident.homeId,moving:false};
    const toWork=resident.jobId&&paths.work?work:leisure;
    const outward=Math.max(1,routeLength(toWork)/0.85),back=[...toWork].reverse();
    const toGreen=leisure,greenTime=Math.max(1,routeLength(toGreen)/0.85);
    const phases=[
      {duration:25,activity:resident.homeId?'At home':'Waiting for a home',at:atHome,inside:!!resident.homeId},
      {duration:outward,activity:resident.jobId?'Walking to work':'Walking to the green',path:toWork},
      {duration:resident.jobId?90:35,activity:resident.jobId?'Working':'Taking a break',at:resident.jobId?atWork:green,inside:!!resident.jobId&&hash(resident.id)%3!==0},
      {duration:outward,activity:'Heading home',path:back},
      {duration:20,activity:resident.homeId?'At home':'Waiting for a home',at:atHome,inside:!!resident.homeId},
      {duration:greenTime,activity:'Walking to the green',path:toGreen},
      {duration:25,activity:'Taking a break',at:green},
      {duration:greenTime,activity:'Heading home',path:[...toGreen].reverse()}
    ];
    const total=phases.reduce((n,p)=>n+p.duration,0);let t=((now/1000+hash(resident.id)%997)%total+total)%total;
    for(const phase of phases){if(t<phase.duration){return {...(phase.path?samplePath(phase.path,t/phase.duration):{...phase.at,yaw:0}),activity:phase.activity,inside:!!phase.inside,moving:!!phase.path,stride:(now/1000)*6+hash(resident.id)%20};}t-=phase.duration;}
  }
  // Navigation is compiled only when buildings change. A modest grid steers
  // around expanded building footprints; blocked paths return null honestly.
  // Each scene supplies a fresh immutable obstacle array. Compile one reverse
  // flood from the green, then share it across every household and workplace.
  // Weak keys release the grid when that scene is discarded.
  const streetMaps=new WeakMap();
  function streetRoute(start,end,obstacles,options={}){
    const step=options.step||0.8,margin=options.margin===undefined?0.25:options.margin;
    let map=streetMaps.get(obstacles);
    if(!map || map.step!==step || map.margin!==margin || map.end.x!==end.x || map.end.z!==end.z || start.x<(map.minX+1)*step || start.x>(map.maxX-1)*step || start.z<(map.minZ+1)*step || start.z>(map.maxZ-1)*step){
      const minX=Math.floor((Math.min(start.x,end.x,...obstacles.map(o=>o.minX))-4)/step),maxX=Math.ceil((Math.max(start.x,end.x,...obstacles.map(o=>o.maxX))+4)/step);
      const minZ=Math.floor((Math.min(start.z,end.z,...obstacles.map(o=>o.minZ))-4)/step),maxZ=Math.ceil((Math.max(start.z,end.z,...obstacles.map(o=>o.maxZ))+4)/step);
      const w=maxX-minX+1,h=maxZ-minZ+1;if(w*h>50000)return null;
      const key=(x,z)=>z*w+x,blocked=new Uint8Array(w*h),prev=new Int32Array(w*h).fill(-1);
      // Rasterise just the occupied rectangles, not every obstacle at every
      // grid cell. Even a full nine-ward city compiles only once per build.
      for(const o of obstacles){
        const x0=Math.max(0,Math.floor((o.minX-margin)/step)-minX+1),x1=Math.min(w-1,Math.ceil((o.maxX+margin)/step)-minX-1);
        const z0=Math.max(0,Math.floor((o.minZ-margin)/step)-minZ+1),z1=Math.min(h-1,Math.ceil((o.maxZ+margin)/step)-minZ-1);
        for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){
          const wx=(x+minX)*step,wz=(z+minZ)*step;
          const inside=!o.polygon || o.polygon.every((a,i)=>{const b=o.polygon[(i+1)%o.polygon.length];return (b.x-a.x)*(wz-a.z)-(b.z-a.z)*(wx-a.x)>=-margin*Math.hypot(b.x-a.x,b.z-a.z);});
          if(inside)blocked[key(x,z)]=1;
        }
      }
      const to=key(Math.round(end.x/step)-minX,Math.round(end.z/step)-minZ);
      blocked[to]=0;prev[to]=to;const queue=[to];
      for(let head=0;head<queue.length;head++){
        const k=queue[head],x=k%w,z=Math.floor(k/w);
        for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=x+dx,nz=z+dz,n=key(nx,nz);
          if(nx<0||nz<0||nx>=w||nz>=h||blocked[n]||prev[n]!==-1)continue;
          prev[n]=k;queue.push(n);
        }
      }
      map={minX,maxX,minZ,maxZ,w,h,step,margin,end:{...end},to,prev};streetMaps.set(obstacles,map);
    }
    const {minX,minZ,w,to,prev}=map,from=(Math.round(start.z/step)-minZ)*w+Math.round(start.x/step)-minX;
    if(prev[from]===undefined||prev[from]===-1)return null;
    const points=[start];
    for(let k=prev[from];k!==to;k=prev[k])points.push({x:(k%w+minX)*step,z:(Math.floor(k/w)+minZ)*step});
    points.push(end);const simple=[start];
    for(let i=1;i<points.length-1;i++){const p=points[i],a=points[i-1],b=points[i+1];if(Math.abs((p.x-a.x)*(b.z-p.z)-(p.z-a.z)*(b.x-p.x))>0.0001)simple.push(p);}
    simple.push(end);return simple;
  }
  function dogFoot(phase,moving=true){
    const p=((phase%1)+1)%1;
    if(!moving)return {x:0,y:0};
    // 60% planted stance: the foot travels backwards under the moving body.
    if(p<0.6)return {x:0.095-(p/0.6)*0.19,y:0};
    const k=(p-0.6)/0.4;return {x:-0.095+k*0.19,y:Math.sin(Math.PI*k)*0.085};
  }
  function legAngles(x,y,upper,lower,bend=1){
    const d=Math.min(upper+lower-0.00001,Math.max(Math.abs(upper-lower)+0.00001,Math.hypot(x,y)));
    const hip=Math.atan2(x,-y)-bend*Math.acos((upper*upper+d*d-lower*lower)/(2*upper*d));
    const knee=bend*(Math.PI-Math.acos((upper*upper+lower*lower-d*d)/(2*upper*lower)));
    return {hip,knee};
  }
  return {hash,workforce,reconcile,homeSlots,visibleResidents,routeLength,samplePath,routine,streetRoute,dogFoot,legAngles};
});
