/* Renderer bridge; the host provides real combat targets and transaction authority. */
(function(root){'use strict';
 function attach({THREE:T,scene,pose,targets,combat,solids=()=>[],onEvents=()=>{}}){
  const C=root.BurbzFirstPersonSpellCore,group=new T.Group();scene.add(group);
  const ball=new T.SphereGeometry(.14,8,6),ring=new T.SphereGeometry(1,10,6),materials={},meshes=new Map(),fx=new Map(),ray=new T.Raycaster();
  const color=id=>id==='spell_frost_sigil'?0x9be8f6:id==='spell_tempest_scroll'?0xc6acff:0xffb247;
  const material=(id,burst)=>materials[id+burst]||=(new T.MeshBasicMaterial({color:color(id),transparent:true,opacity:burst?.55:1,depthWrite:!burst,wireframe:!!burst}));
  let armed=null,disposed=false;
  const engine=C.create({targets,valid:token=>!disposed&&combat.valid(token),obstacle(a,b){const from=new T.Vector3(a.x,a.y,a.z),delta=new T.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),length=delta.length();if(!length)return null;ray.set(from,delta.multiplyScalar(1/length));ray.far=length;const hit=ray.intersectObjects(solids(),true)[0];return hit?hit.distance/length:null;},impact({projectile,target}){if(target){const result=combat.resolve(projectile.token,target.index);if(result.ok)onEvents(result.events);}else combat.cancel();}});
  function begin(){if(disposed||engine.projectiles.length)return false;armed=combat.begin();return !!armed;}
  function release(p=pose()){if(!armed||!combat.valid(armed))return false;const token=armed;armed=null;const skill=token.skill;
   if(skill.kind!=='attack'){const result=combat.resolve(token);if(result.ok)onEvents(result.events);return result.ok;}
   return !!engine.launch(p,skill,token);
  }
  function cancel(){if(armed)combat.cancel();armed=null;}
  function sync(list,pool,burst){const ids=new Set(list.map(p=>p.id));for(const [id,mesh]of pool)if(!ids.has(id)){group.remove(mesh);pool.delete(id);}for(const p of list){let mesh=pool.get(p.id);if(!mesh){mesh=new T.Mesh(burst?ring:ball,material(p.skill.id,burst));group.add(mesh);pool.set(p.id,mesh);}mesh.position.set(p.position.x,p.position.y,p.position.z);if(burst)mesh.scale.setScalar(.2+p.age*4);}}
  return{begin,release,cancel,update(dt){engine.step(dt);sync(engine.projectiles,meshes,false);sync(engine.impacts,fx,true);if(!engine.projectiles.length&&!armed)combat.cancel();},diagnostics:()=>({projectiles:engine.projectiles.map(p=>({position:{...p.position},direction:{...p.direction},age:p.age})),impacts:engine.impacts.length}),dispose(){disposed=true;cancel();combat.cancel();engine.clear();group.removeFromParent();ball.dispose();ring.dispose();Object.values(materials).forEach(m=>m.dispose());meshes.clear();fx.clear();}};
 }
 root.BurbzFirstPersonSpells={attach};
})(globalThis);
