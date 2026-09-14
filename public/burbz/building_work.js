/* Nearby construction interaction; borrows the walking frame and saved ledger. */
(function(root){'use strict';
function attach(s){
 const api=s.options.work,core=root.BurbzBuildingWorkCore,T=root.THREE;
 if(!api)return{update(){},reset(){},dispose(){},key(){return false;}};
 const button=document.createElement('button');button.type='button';button.className='vw-building-work';button.setAttribute('data-walk-action','building-work');button.hidden=true;s.root.append(button);
 const point=new T.Vector3(),rows=new Map();let nearest=null,streak=null,taps=0,last=-Infinity,closed=false,job=null;
 function reset(){streak=null;taps=0;if(job){job.iterator.return?.();job.change?.cancel();job=null;}}
 function current(row){return api.describe(row.target);}
 function proximity(row){
  row.object.getWorldPosition(point);const x=Math.max(point.x+row.bounds.minX,Math.min(point.x+row.bounds.maxX,s.player.x)),z=Math.max(point.z+row.bounds.minZ,Math.min(point.z+row.bounds.maxZ,s.player.z)),y=Math.hypot(x-s.player.x,z-s.player.z)<=3?s.world.height(x,z):null;
  return{x,y,z,radius:0,loaded:Number.isFinite(y),interior:!!s.room};
 }

 function permitted(row){
  const site=proximity(row);if(closed||s.closed||s.failed||s.uiBusy||s.room||s.root.querySelector('.fp-tracker.fp-expanded')||!core.near(s.player,site))return false;
  const dx=site.x-s.player.x,dz=site.z-s.player.z,d=Math.hypot(dx,dz),reach=Math.max(0,d-.5);
  for(let i=1;d>0&&i<=4;i++)if(s.world.allowed&&!s.world.allowed(s.player.x+dx/d*reach*i/4,s.player.z+dz/d*reach*i/4))return false;
  return true;
 }

 function refresh(){
  const present=new Set();
  for(const object of s.continuity?.buildings?.()||s.source.buildings||[]){
   const data=object.userData;if(!data.construction||!data.buildingId||!Number.isFinite(Number(data.wardSeed??s.options.seed)))continue;
   present.add(object);if(rows.has(object))continue;
   const target={seed:Number(data.wardSeed??s.options.seed),id:data.buildingId,startMs:Number(data.construction.startMs),orderKey:data.construction.orderKey,toLevel:Number(data.construction.toLevel)};
   object.getWorldPosition(point);const box=new T.Box3().setFromObject(object);
   rows.set(object,{object,target,bounds:{minX:box.min.x-point.x,maxX:box.max.x-point.x,minZ:box.min.z-point.z,maxZ:box.max.z-point.z}});
  }
  for(const [object]of rows)if(!present.has(object))rows.delete(object);
 }
 function paint(){
  const project=nearest&&permitted(nearest)&&current(nearest);if(!project||project.automatic||(Date.now()<project.endMs&&project.assistedAt!=null)){button.hidden=true;return;}
  const id=core.identity(project);if(streak!==id&&!job)reset();
  button.hidden=false;button.replaceChildren();const action=document.createElement('span'),label=document.createElement('small');action.textContent=job?'Preparing building…':Date.now()>=project.endMs?'Open building':taps?'Help the builder · '+taps+'/3':'Help the builder · 3 taps';label.textContent=project.label;button.append(action,label);
  button.title=Date.now()>=project.endMs?'Open this completed building here':'Shorten this project by 25% once';button.disabled=!!job;
 }
 function advance(){
  if(!job)return;const active=job;
  try{
    if(active.frame.valid?.()===false||(active.automatic?(closed||s.closed||s.failed||s.room||s.uiBusy):!permitted(active.row))||current(active.row)?.toLevel!==active.level){reset();paint();return;}
    const start=performance.now();let step;
    do{step=active.iterator.next();}while(!step.done&&performance.now()-start<2);
    if(!step.done)return;active.change=step.value;
    const position=active.frame.local();if(!active.change.clear(position.x,position.z))throw Error('Step clear of the finished building, then try again.');
    if(!active.automatic&&!permitted(active.row))throw Error('Return to the building to open it.');
    const result=active.plan.commit();if(!result?.ok)throw Error(result?.error||'The building could not be opened.');
    active.frame.install(active.change);job=null;reset();nearest=null;refresh();
    s.root.querySelector('.vw-hint').textContent='Building opened · ready to use';paint();
  }catch(error){active.row.retryAt=performance.now()+5000;reset();if(!active.automatic)s.root.querySelector('.vw-hint').textContent=error.message;paint();}
 }
 function begin(row,level,frame,plan,automatic=false){
  const iterator=root.BurbzVillageWalkScene.replacementSteps(T,{...frame,...plan});
  // Enter the generator's cleanup scope before input can cancel the job.
  // Its first yield only attaches the invisible candidate group.
  iterator.next();job={row,level,frame,plan,automatic,iterator};
 }
 function use(){
  if(job)return;
  const row=nearest;if(!row||!permitted(row)){reset();paint();return;}
  const project=current(row),id=core.identity(project);
  if(project&&Date.now()>=project.endMs){
    try{const frame=s.continuity?.buildingFrame?.(row.object),plan=frame&&api.prepare?.(row.target,frame);if(!plan)throw Error('The building is not ready to open. Try again.');
      reset();begin(row,project.toLevel,frame,plan);paint();
    }catch(error){s.root.querySelector('.vw-hint').textContent=error.message;}return;
  }
  if(!id||!core.assist(project,Date.now())){reset();paint();return;}
  if(streak!==id){streak=id;taps=0;}taps++;
  if(taps===3){try{const result=api.assist(row.target);if(!result?.ok)throw Error(result?.error||'The project changed. Try again.');s.root.querySelector('.vw-hint').textContent='Builders helped · 25% less construction time';}catch(error){s.root.querySelector('.vw-hint').textContent=error.message;}reset();}
  paint();
 }
 button.addEventListener('click',use,{signal:s.abort.signal});
 return{reset,key(code){if(code!=='KeyF'||button.hidden)return false;use();return true;},update(time){advance();if(time-last<.25)return;last=time;refresh();let distance=Infinity,next=null;
   for(const row of rows.values()){const project=current(row);
   if(project?.automatic){if(!job&&!s.room&&!s.uiBusy&&!(row.retryAt>performance.now())){try{const frame=s.continuity?.buildingFrame?.(row.object),plan=frame&&api.prepare?.(row.target,frame);if(plan)begin(row,project.toLevel,frame,plan,true);}catch{row.retryAt=performance.now()+5000;}}continue;}
   if(!permitted(row)||!project||(project.assistedAt!=null&&Date.now()<project.endMs))continue;row.object.getWorldPosition(point);const d=Math.hypot(point.x-s.player.x,point.z-s.player.z);if(d<distance){distance=d;next=row;}}
   if(next!==nearest&&!job?.automatic)reset();nearest=next;paint();
  },diagnostics:()=>({sites:rows.size,target:nearest?.target||null,taps,preparing:!!job,visible:!button.hidden}),dispose(){closed=true;reset();rows.clear();button.remove();}};
}
root.BurbzBuildingWork={attach};
})(globalThis);
