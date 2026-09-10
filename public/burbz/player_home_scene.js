/* The same timber, furniture, ink treatment and local sky as Alderwing villages. */
(function(root){'use strict';
const C=root.BurbzPlayerHomeCore;
function disposeScene(scene){const gs=new Set(),ms=new Set(),ts=new Set();scene.traverse(o=>{o.shadow?.dispose();if(o.geometry)gs.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){ms.add(m);if(m.map)ts.add(m.map);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>t.dispose());scene.clear();}
function ornament(T,type,accent=0x6f8c76){const b=root.BurbzSettlementModels.batch(T),wood=0x795335,trim=0x49372c,gold=0xc8a365;
 if(type==='bench'){b.box(1.8,.14,.65,0,.65,0,wood);b.box(1.8,.52,.1,0,1.02,-.3,wood);for(const x of [-.65,.65])for(const z of [-.23,.23])b.box(.12,.64,.12,x,.32,z,trim);}
 else if(type==='lantern'){b.cylinder(.07,.1,2.3,0,1.15,0,wood);b.box(.65,.09,.12,.18,2.25,0,gold);b.box(.34,.48,.34,.45,1.93,0,trim);b.add(new T.BoxGeometry(.27,.36,.27),0xffd37a,[.45,1.93,0],[0,0,0],[1,1,1],true);}
 else if(type==='birdbath'){b.cylinder(.19,.35,.95,0,.475,0,0xa5a18a);b.cylinder(.52,.3,.2,0,1.03,0,0xc1bba2);b.cylinder(.43,.43,.02,0,1.14,0,0x75a6a1);}
 else if(type==='planter'){b.cylinder(.27,.19,.42,0,.21,0,0xb57957);for(let i=0;i<6;i++){const a=i*2.4,x=Math.sin(a)*.19,z=Math.cos(a)*.19;b.cylinder(.015,.015,.48,x,.55,z,0x668450);b.sphere(.1,x,.8+(i%2)*.08,z,[0xe8c265,0xc9818b,0xd8d7be][i%3],[1,.5,1]);}}
 else if(type==='rug'){b.box(1.7,.022,2,0,.015,0,accent);for(const x of [-.76,.76])b.box(.06,.025,1.85,x,.02,0,0xe8d5aa);}
 else if(type==='armchair'){b.box(.9,.48,.85,0,.32,0,wood);b.box(.72,.18,.7,0,.64,.05,accent);b.box(.92,.86,.16,0,.85,-.35,accent);for(const x of [-.48,.48])b.box(.12,.38,.85,x,.73,0,wood);}
 else if(type==='shelf'){for(const y of [.12,.7,1.3,1.9])b.box(1.6,.09,.6,0,y,0,wood);for(const x of [-.76,.76])b.box(.09,1.9,.6,x,.97,0,trim);for(let k=0;k<3;k++)for(let i=0;i<7;i++)b.box(.12,.35+(i%2)*.09,.32,-.6+i*.19,.34+k*.59,0,[accent,0xab7252,0xc7b581][i%3]);}
 else {b.cylinder(.65,.65,.1,0,.78,0,wood);b.cylinder(.1,.2,.74,0,.37,0,trim);b.cylinder(.14,.12,.17,.2,.92,0,0xd8c69e);}
 return b.finish();}
function create(T,home,area,aspect,grade){const s=C.normalize(home);let scene,room=null,house=null,screen=null,screenSize=null;const targets=[],decor=[];let roof=null,frontLeaves=null,skyLight=null,sunLight=null;
 if(area==='room'){
 const p={name:'Your woodland home',scope:'player-home',width:9,depth:10,height:3.6,accent:0x709486,props:[{type:'bed',x:-3,z:1.4,rot:0,w:1.7,d:2.4,solid:true},{type:'fireplace',x:-3.5,z:-1,rot:Math.PI/2,w:1,d:1.8,solid:true}],spawn:{x:0,y:0,z:3.8,yaw:0,pitch:0},exit:{x:0,z:4.3},action:null};
 room=root.BurbzBuildingRoomsScene.create(T,p);scene=room.scene;
 // The shared room shell's ceiling is opened only in the decorating view.
 scene.children[0]?.traverse(o=>{if(o.isMesh&&!roof)roof=o;});
 const desk=root.BurbzSettlementModels.batch(T),w=0x765139,trim=0x493329,gold=0xbf9855;
 desk.box(2.7,.15,1.25,0,.92,-3.45,w);for(const x of [-1.12,1.12])for(const z of [-3.9,-3])desk.box(.14,.9,.14,x,.45,z,trim);
 desk.box(.7,.05,.32,0,1.02,-3.02,trim);for(let row=0;row<3;row++)for(let i=0;i<8;i++)desk.box(.058,.03,.06,-.29+i*.082,1.055,-3.1+row*.085,gold);
 const height=aspect<1?1.6:Math.min(1.4,2.3/aspect),width=height*aspect;screenSize={width,height,x:0,y:1.12+height/2,z:-3.42};
 desk.box(width+.22,height+.24,.17,0,screenSize.y,-3.53,trim);desk.box(width+.1,height+.12,.19,0,screenSize.y,-3.52,gold);desk.cylinder(.07,.12,.38,0,1.13,-3.55,trim);
 for(const x of [-width/2-.08,width/2+.08])for(const y of [screenSize.y-height/2-.08,screenSize.y+height/2+.08])desk.sphere(.055,x,y,-3.4,gold);
 desk.cylinder(.13,.2,.1,1,.99,-3.3,gold);desk.cylinder(.035,.035,.5,1,1.26,-3.3,0xe4d2ac);desk.sphere(.08,1,1.57,-3.3,0xffcf76,[.5,1,.5]);
 scene.add(desk.finish());const chair=ornament(T,'armchair',0x466b5c);chair.position.set(0,0,-1.85);chair.rotation.y=Math.PI;chair.userData.homeTarget='desk';scene.add(chair);targets.push(chair);
 // The real app is projected beneath the WebGL canvas. This depth-tested
 // aperture exposes it only where the actual monitor is visible, including
 // furniture occlusion, side views and the exact full-viewport seated view.
 screen=new T.Mesh(new T.PlaneGeometry(width,height),new T.ShaderMaterial({
   vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'void main(){gl_FragColor=vec4(0.0);}',
   blending:T.NoBlending,depthTest:true,depthWrite:true
 }));screen.position.set(0,screenSize.y,screenSize.z);screen.renderOrder=5;screen.userData.homeTarget='desk';scene.add(screen);targets.push(screen);

 }else{
 scene=new T.Scene();scene.background=new T.Color(0xa7c3ba);scene.fog=new T.Fog(0xa7c3ba,36,65);const b=root.BurbzSettlementModels.batch(T),front=root.BurbzSettlementModels.batch(T);
 b.cylinder(16,17,1,0,-.55,0,0x698160,[0,0,0],64);b.cylinder(6.3,6.3,.04,0,-.015,1.8,0x7c8764,[0,0,0],48);
 for(let z=2;z<14;z+=.65)for(let x=-.65;x<=.65;x+=.65)b.box(.59,.04,.56,x+(Math.floor(z)%2)*.08,.025,z,0xab9e7c,[0,Math.sin(z)*.04,0]);
 for(const [i,t] of C.TREES.entries()){b.cylinder(t.r*.65,t.r,3.8,t.x,1.9,t.z,0x5b4332);for(let k=0;k<3;k++)(t.z>4?front:b).sphere(1.9,t.x+Math.sin(i+k)*.6,3.6+k*.7,t.z+Math.cos(i+k)*.6,[0x547956,0x678651,0x76915d][(i+k)%3],[1,1.05,.95]);}
 for(let i=0;i<90;i++){const a=i*2.4,r=4+(i%12)*.7,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<2.9&&Math.abs(z)<2.5||Math.abs(x)<1&&z>0)continue;b.sphere(.2,x,.1,z,0x82915e,[1,.5,1]);}
 // Moss, roots and small flowers break up the clearing without claiming resources.
 for(let i=0;i<180;i++){const a=i*2.4,r=3.8+(i%17)*.51,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<2.9&&Math.abs(z)<2.5||Math.abs(x)<1.1&&z>0)continue;const h=.1+(i%3)*.06;b.add(new T.ConeGeometry(.09,h,3),[0x587849,0x688252,0x7e8f59][i%3],[x,h/2,z]);if(i%7===0)b.sphere(.07,x,h,z,[0xe4c773,0xc78ba0,0xe5daca][i%3]);}
 scene.add(b.finish());frontLeaves=front.finish();scene.add(frontLeaves);house=root.BurbzSettlementModels.building(T,'cabin',s.tier+1,()=>.47,{roofs:[0x557e72]});house.userData.homeTarget='house';scene.add(house);targets.push(house);
 const hemi=new T.HemisphereLight(0xffe7b5,0x526b70,grade.hemi),key=new T.DirectionalLight(grade.keyColor,grade.keyIntensity);key.position.set(-12,19,10);skyLight=hemi;sunLight=key;key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-18,right:18,top:18,bottom:-18,near:1,far:60});key.shadow.bias=-.001;key.shadow.normalBias=.025;scene.add(hemi,key);scene.background.set(grade.sun>.3?0xabc9be:0x172c3a);scene.fog.color.copy(scene.background);
 // Merlin uses the existing game portrait, perched by the door.
 const tex=new T.TextureLoader().load('bird-art-cache/cutouts/merlin_burbz_manga_20260624_v2_cutout.png');tex.colorSpace=T.SRGBColorSpace;const bird=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true}));bird.scale.set(1.8,1.8,1);bird.position.set(2.2,2.1,1.4);scene.add(bird);
 }
 for(const p of s.placed.filter(p=>p.area===area)){const mesh=ornament(T,C.ITEMS[p.item].type);mesh.position.set(p.x,0,p.z);mesh.rotation.y=p.turn*Math.PI/2;mesh.userData.placementId=p.id;scene.add(mesh);decor.push(mesh);targets.push(mesh);}
 const finds=[];for(const f of C.FINDS.filter(f=>f.area===area)){const b=root.BurbzSettlementModels.batch(T);if(f.id==='tiny-door'){b.cylinder(.58,.72,1.35,f.x,.675,f.z,0x71543b);b.box(.44,.68,.08,f.x,.35,f.z+.6,0x345f50);for(const x of [-.26,.26])b.box(.065,.76,.09,f.x+x,.38,f.z+.62,0xc3ab74);b.sphere(.045,f.x+.13,.36,f.z+.68,0xd9ba65);}
 else if(f.id==='moon-pool'){b.cylinder(.65,.5,.3,f.x,.15,f.z,0xb1af99);b.cylinder(.53,.53,.015,f.x,.31,f.z,0x79a6a4);for(const x of [-.18,.18])b.sphere(.07,f.x+x,.335,f.z,0xd9e3c6,[1,.1,1]);}
 else if(f.id==='lost-pot'){b.cylinder(.3,.2,.42,f.x,.21,f.z,0xc68b69);b.box(.23,.018,.27,f.x,.44,f.z,0xe3ce9e);}
 else if(f.id==='merlin-acorn'){b.sphere(.16,f.x,.18,f.z,0xa68152,[.8,1,.8]);b.sphere(.18,f.x,.32,f.z,0x685139,[1,.4,1]);for(let i=0;i<5;i++)b.add(new T.ConeGeometry(.04,.14,3),0xdac478,[f.x+Math.sin(i*1.25)*.12,.44,f.z+Math.cos(i*1.25)*.12]);}
 else if(area==='yard'){b.add(new T.DodecahedronGeometry(.52),0xb4ae91,[f.x,.3,f.z],[0,.4,0],[1,.6,1]);for(let i=0;i<3;i++)b.box(.23-i*.03,.02,.035,f.x,.62,f.z+(i-1)*.09,0x8b784f);}
 else if(f.id==='floor-star'){b.add(new T.CylinderGeometry(.12,.12,.02,7),0xe5bf65,[f.x,.02,f.z]);}
 else{b.box(.24,.025,.3,f.x,.08,f.z,0xd6bb83);for(let i=0;i<3;i++)b.box(.14,.008,.015,f.x,.099,f.z+(i-1)*.06,0x7b623a);}const m=b.finish();m.userData.findId=f.id;scene.add(m);finds.push(m);targets.push(m);}
 root.BurbzManga?.styleScene(scene);
 return{scene,house,screen,screenSize,targets,decor,finds,world:C.world(s,area),light(g){if(skyLight){skyLight.intensity=g.hemi;sunLight.intensity=g.keyIntensity;sunLight.color.set(g.keyColor);scene.background.set(g.sun>.3?0xabc9be:0x172c3a);scene.fog.color.copy(scene.background);}},overhead(value){frontLeaves?.traverse(o=>{if(o.material){o.material.transparent=true;o.material.opacity=value?.13:1;o.material.depthWrite=!value;}});},dispose:()=>disposeScene(scene)};
}
root.BurbzPlayerHomeScene={create,ornament,disposeScene};
})(globalThis);
