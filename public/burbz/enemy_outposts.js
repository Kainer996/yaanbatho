/* Camps borrow the walking scene, collision and combat clock. No renderer or RAF. */
(function(root){'use strict';
function attach(s,{adapter,safeAt,ground,allowed,clear,walkClear,notice}){
 const O=root.BurbzEnemyOutpostsCore,G=root.BurbzGeographicWorldCore,T=root.THREE,api=adapter.outposts;
 if(!api||!s.options?.continuousWorld)return null;
 const scene=s.source.scene,host=s.root,visible=new Map(),rejected=new Set(),group=new T.Group();group.name='Enemy outposts';scene.add(group);
 const box=new T.BoxGeometry(1,1,1),pole=new T.CylinderGeometry(.09,.13,3.4,6),cloth=new T.PlaneGeometry(1.15,.8);
 const materials={wood:new T.MeshLambertMaterial({color:0x665044}),crate:new T.MeshLambertMaterial({color:0x998267}),hostile:new T.MeshLambertMaterial({color:0x812c39,side:T.DoubleSide}),friendly:new T.MeshLambertMaterial({color:0x86bd89,side:T.DoubleSide})};
 const status=document.createElement('div');status.className='eo-status';status.hidden=true;status.innerHTML='<strong></strong><span></span><button type="button">Collect outpost income</button>';host.append(status);
 const probes=[];let lastReason=null,layoutUnknown=false;
 let elapsed=0,lastScan=-10,lastUI=-1,current=null,disposed=false,scanTask=null,scanCount=0,maxScanMs=0;
 const navigation=()=>s.continuity?.navigation(),data=()=>api.read(),local=c=>{const nav=navigation();return nav&&G.project(nav.origin,c);};
 const props=[{x:-5,z:-3,w:3,d:1,h:1.2},{x:5,z:3,w:3,d:1,h:1.2},{x:-3,z:5,w:1,d:2,h:1.1}];
 function build(c,p,layout){const g=new T.Group();g.name=c.id;g.position.set(p.x,ground(p.x,p.z),p.z);const covers=[];
  for(const b of props){const y=ground(p.x+b.x,p.z+b.z);const m=new T.Mesh(box,materials.crate);m.position.set(b.x,y-g.position.y+b.h/2,b.z);m.scale.set(b.w,b.h,b.d);g.add(m);covers.push({...b,y});}
  const stem=new T.Mesh(pole,materials.wood);stem.position.set(0,1.7,0);g.add(stem);const flag=new T.Mesh(cloth,materials.hostile);flag.position.set(.56,2.6,0);g.add(flag);
  // Three open roost rails leave every side approachable; crates supply real cover.
  const rails=new T.InstancedMesh(box,materials.wood,6),matrix=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),scale=new T.Vector3();
  for(let i=0;i<3;i++){const x=(i-1)*3,z=-5,y=ground(p.x+x,p.z+z)-g.position.y;matrix.compose(v.set(x,y+.65,z),q,scale.set(.25,1.3,.25));rails.setMatrixAt(i*2,matrix);matrix.compose(v.set(x,y+1.3,z),q,scale.set(2,.2,.25));rails.setMatrixAt(i*2+1,matrix);}g.add(rails);group.add(g);const value={id:c.id,record:c,point:p,group:g,flag,covers,rails,layout};visible.set(c.id,value);return value;
 }
 function remove(v){v.group.removeFromParent();v.rails.dispose?.();visible.delete(v.id);}
 function coverAt(p,x,y,z,covers=props){for(const b of covers){const dx=x-p.x-b.x,dz=z-p.z-b.z;if(Math.abs(dx)>=b.w/2+.28||Math.abs(dz)>=b.d/2+.28)continue;if(y===null)return true;const h=b.y??ground(p.x+b.x,p.z+b.z);if(y>h-.2&&y<h+b.h+.25)return true;}return false;}
 function blocked(x,y,z){for(const v of visible.values())if(coverAt(v.point,x,y,z,v.covers))return true;return false;}
 function* layoutAt(p){
  layoutUnknown=false;const height=(x,z)=>{const h=ground(x,z);if(!Number.isFinite(h))layoutUnknown=true;return h;};
  const dark=(x,z)=>{const ok=safeAt(x,z)===false;if(!ok)layoutUnknown=true;return ok;};
  const valid=(x,z,y)=>dark(x,z)&&s.world.allowed(x,z)&&allowed(x,z,y)&&!coverAt(p,x,null,z);
  const route=(a,b,walking)=>{const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.2));for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+(b.y-a.y)*t;if(!dark(x,z)||!Number.isFinite(height(x,z))||coverAt(p,x,walking?null:y,z))return false;}return walking?walkClear(a,b):clear(a,b);};
  return yield* O.guardLayoutSteps({point:p,ground:height,valid,walkClear:(a,b)=>route(a,b,true),clear:(a,b)=>route(a,b,false)});
 }
 function* suitable(c,p){lastReason=null;if(!p||safeAt(p.x,p.z)!==false)return null;if(api.dark(c)!==true){lastReason='already-revealed';return false;}const h=ground(p.x,p.z);if(!Number.isFinite(h))return false;
  const checks=[[0,0],[-6,-6],[-6,6],[6,-6],[6,6],[-3,-5],[0,-5],[3,-5]];for(const [x,z]of props.map(b=>[b.x,b.z]))for(const [dx,dz]of [[0,0],[-.7,-.7],[-.7,.7],[.7,-.7],[.7,.7]])checks.push([x+dx,z+dz]);
  for(const [x,z]of checks)if(safeAt(p.x+x,p.z+z)!==false||!Number.isFinite(ground(p.x+x,p.z+z)))return null;
  for(const [x,z]of checks){const y=ground(p.x+x,p.z+z);if(Math.abs(y-h)>1.3||!s.world.allowed(p.x+x,p.z+z)){lastReason={x,z,slope:Math.abs(y-h),allowed:s.world.allowed(p.x+x,p.z+z)};return false;}}const layout=yield* layoutAt(p);if(!layout)lastReason='no-clear-guard-approach';return layout||(layoutUnknown?null:false);}
 function* scan(){const nav=navigation();if(!nav||s.room||disposed)return;scanCount++;
  for(const v of visible.values()){const p=G.project(nav.origin,v.record);if(Math.hypot(p.x-s.player.x,p.z-s.player.z)>210){remove(v);continue;}v.point=p;v.group.position.x=p.x;v.group.position.z=p.z;const c=data().camps[v.id]||v.record;v.flag.material=c.liberated?materials.friendly:materials.hostile;v.layout=c.liberated?null:(yield* layoutAt(p));yield;}
  const saved=data().camps,candidates=O.nearby(nav.pose);for(let c of candidates){if(visible.has(c.id)||visible.size>=O.MAX_VISIBLE||rejected.has(c.id))continue;let p=G.project(nav.origin,saved[c.id]||c);if(Math.hypot(p.x-s.player.x,p.z-s.player.z)>150)continue;
   // Saved friendly flags must reload inside their own light. New camps still
   // require confirmed darkness; unknown ground is always retried after loading.
   if(!Number.isFinite(ground(p.x,p.z))||!saved[c.id]&&safeAt(p.x,p.z)!==false)continue;
   let fit=!!saved[c.id];if(!fit){for(const option of O.sites(c)){const q=G.project(nav.origin,option);fit=yield* suitable(option,q);yield;if(fit===null)break;if(fit){c=option;p=q;break;}}}if(fit===null)continue;if(fit===false){probes.push({id:c.id,reason:lastReason});if(probes.length>12)probes.shift();rejected.add(c.id);if(rejected.size>128)rejected.delete(rejected.values().next().value);continue;}
   if(fit)build(saved[c.id]||c,p,saved[c.id]?(saved[c.id].liberated?null:(yield* layoutAt(p))):fit);
  }
  for(const v of visible.values()){const d=Math.hypot(v.point.x-s.player.x,v.point.z-s.player.z);if(d<=65&&!data().camps[v.id]){try{if(api.discover(v.record))notice('Hostile camp discovered · defeat its three shadow guards.');}catch(e){notice(e.message);}}}

 }
 function encounter(pose){const candidates=[...visible.values()].filter(v=>data().camps[v.id]&&!data().camps[v.id].liberated&&Math.hypot(v.point.x-pose.x,v.point.z-pose.z)<75).sort((a,b)=>Math.hypot(a.point.x-pose.x,a.point.z-pose.z)-Math.hypot(b.point.x-pose.x,b.point.z-pose.z));const v=candidates[0];if(!v)return null;const c=data().camps[v.id];return{campId:c.id,guards:v.layout?c.hp.map((hp,i)=>({id:c.id+':guard:'+i,campId:c.id,member:i,hp,maxHp:O.HP,position:{...v.layout.positions[i]}})).filter(g=>g.hp>0):[]};}
 const collect=status.querySelector('button');collect.addEventListener('click',()=>{if(!current||s.player.mode==='fly'||Math.hypot(current.point.x-s.player.x,current.point.z-s.player.z)>12)return;try{const n=api.collect(current.id);notice(n?'Collected '+n+' coins.':'Income is still building · 5 coins per hour.');}catch(e){notice(e.message);}lastUI=-1;},{signal:s.abort.signal});
 function update(dt){elapsed+=Math.min(.05,Math.max(0,dt));if(!scanTask&&elapsed-lastScan>=1){lastScan=elapsed;scanTask=scan();}if(scanTask){const start=performance.now();do{if(scanTask.next().done){scanTask=null;break;}}while(performance.now()-start<2);maxScanMs=Math.max(maxScanMs,performance.now()-start);}if(elapsed-lastUI<.25)return;lastUI=elapsed;current=[...visible.values()].filter(v=>data().camps[v.id]).sort((a,b)=>Math.hypot(a.point.x-s.player.x,a.point.z-s.player.z)-Math.hypot(b.point.x-s.player.x,b.point.z-s.player.z))[0];const distance=current?Math.hypot(current.point.x-s.player.x,current.point.z-s.player.z):Infinity;status.hidden=!current||distance>65||!!s.uiBusy||!!s.room||!!s.flight;if(status.hidden)return;const c=data().camps[current.id];current.flag.material=c.liberated?materials.friendly:materials.hostile;status.querySelector('strong').textContent=c.liberated?'Friendly outpost':'Hostile camp';status.querySelector('span').textContent=c.liberated?Math.floor(O.preview(data(),c.id,api.now()))+' / '+O.CAP+' coins · 5 per hour':c.hp.filter(h=>h>0).length+' shadow guards remain · '+(current.layout?Math.round(distance)+' m':'waiting for clear ground');collect.hidden=!c.liberated;collect.disabled=distance>12||s.player.mode==='fly';collect.textContent=collect.disabled?'Approach on foot to collect':'Collect coins';}
 function mapPoints(){return Object.values(data().camps).map(c=>({...c,...local(c),radius:O.REVEAL}));}
 function dispose(){if(disposed)return;disposed=true;scanTask?.return();scanTask=null;for(const v of visible.values())remove(v);group.removeFromParent();box.dispose();pole.dispose();cloth.dispose();Object.values(materials).forEach(m=>m.dispose());status.remove();}
 return{update,encounter,blocked,mapPoints,dispose,isFriendly:(x,z)=>[...visible.values()].some(v=>data().camps[v.id]?.liberated&&Math.hypot(x-v.point.x,z-v.point.z)<18),diagnostics:()=>({visible:[...visible.values()].map(v=>({id:v.id,point:v.point,uuid:v.group.uuid,approach:v.layout?.approach||null,guardsReady:!!v.layout})),saved:Object.keys(data().camps).length,probes:probes.slice(),scanCount,maxScanMs})};
}
root.BurbzEnemyOutposts={attach};
})(globalThis);
