/* Geographic settlement silhouettes use only the saved construction ledger.
 * The detailed village/town keeps its established rooms, jobs and receipts. */
(function(root){'use strict';
  function rng(seed){let n=Number(seed)>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function create(T,record){
    const group=new T.Group(),solids=[],buildings=[],targets=[];
    const rows=(record.buildings||[]).slice(0,144),r=rng(record.seed),b=root.BurbzSettlementModels.batch(T);
    // A sign is a navigation marker, never an invented owned home or trade.
    b.box(.13,2.1,.13,0,1.05,3.5,0x604931);b.box(2,.65,.12,0,1.8,3.5,0x4d6b54);
    b.box(1.7,.08,.14,0,1.95,3.5,0xd6be83);b.box(1.2,.07,.14,0,1.65,3.5,0xd6be83);
    group.add(b.finish());
    let radius=8;
    rows.forEach((row,i)=>{
      const model=root.BurbzSettlementModels.building(T,row.buildingId,row.level,r);
      const side=i%2?1:-1,lane=Math.floor(i/2),x=side*(7+Math.floor(lane/10)*11),z=(lane%10)*9-38;
      model.position.set(x,0,z);model.rotation.y=side<0?Math.PI/2:-Math.PI/2;
      Object.assign(model.userData,{buildingId:row.buildingId,wardSeed:row.wardSeed,homeId:row.homeId||null});
      const box=new T.Box3().setFromObject(model),w=box.max.x-box.min.x,d=box.max.z-box.min.z;
      solids.push({x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,w,d,minY:0,maxY:Math.max(2,box.max.y)});
      group.add(model);buildings.push(model);radius=Math.max(radius,Math.hypot(x,z)+Math.hypot(w,d)/2+2);
    });
    // These are actual roster records, capped as a visual budget without adding
    // residents to the save or claiming that everyone is on the street.
    for(const [i,resident] of (record.residents||[]).slice(0,8).entries()){
      const model=root.BurbzSettlementModels.resident(T,resident);model.position.set(i%2?2.3:-2.3,0,-5-Math.floor(i/2)*3);group.add(model);
    }
    targets.push({kind:'settlement',id:record.id,x:0,y:0,z:5,label:'Enter '+record.name,range:5});
    const allowed=(x,z)=>!solids.some(s=>Math.abs(x-s.x)<s.w/2+.28&&Math.abs(z-s.z)<s.d/2+.28);
    return{group,buildings,targets,solids,radius,blendRadius:radius+12,entrance:{x:0,y:0,z:5,yaw:0,pitch:0},world:{allowed,height:()=>0},dispose(){root.BurbzPlayerHomeScene.disposeScene(group);}};
  }
  root.BurbzGeographicSettlementScene={create};
})(globalThis);
