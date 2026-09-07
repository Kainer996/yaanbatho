const assert=require('node:assert/strict');
const T=require('../lib/three.min.js');
const ink=require('../manga_render_core.js');
const scene=new T.Scene(),material=new T.MeshLambertMaterial({color:0x9b7744});
const original={map:material.map,color:material.color.getHex(),emissive:material.emissive.getHex()};
let originalHook=0;material.onBeforeCompile=()=>originalHook++;
scene.add(new T.Mesh(new T.BoxGeometry(),material));
assert.equal(ink.styleScene(scene),1);assert.equal(ink.styleScene(scene),0);
const shader={fragmentShader:T.ShaderLib.lambert.fragmentShader};material.onBeforeCompile(shader,{});
assert.equal(originalHook,1);assert(shader.fragmentShader.includes('float mangaBand'));
assert.equal(shader.fragmentShader.match(/float mangaBand/g).length,1);
assert.deepEqual({map:material.map,color:material.color.getHex(),emissive:material.emissive.getHex()},original);
for(const m of [new T.SpriteMaterial(),new T.MeshBasicMaterial(),new T.MeshLambertMaterial({transparent:true,opacity:0.3})])assert.equal(ink.styleMaterial(m),false);
let rendered=[],target=null,disposed=0;
const renderer={capabilities:{isWebGL2:true},extensions:{has:()=>true},info:{autoReset:true,reset(){}},
 getRenderTarget:()=>target,setRenderTarget:t=>{target=t;if(t&&!t.userDataTracked){t.userDataTracked=true;t.addEventListener('dispose',()=>disposed++);}},
 getDrawingBufferSize:v=>v.set(780,1200),getPixelRatio:()=>2,render:(s,c)=>rendered.push({s,c,target})};
const camera=new T.PerspectiveCamera(55,1,.1,140);
ink.render(T,renderer,scene,camera);assert.equal(rendered.length,2);assert(rendered[0].target);assert.equal(rendered[1].target,null);
assert.equal(rendered[0].target.width,780);assert.equal(renderer.info.autoReset,true);
assert.equal(rendered[1].s.children[0].material.uniforms.texel.value.x,2/780);
ink.dispose(renderer);assert.equal(disposed,1);ink.dispose(renderer);assert.equal(disposed,1);
renderer.capabilities.isWebGL2=false;renderer.extensions.has=()=>false;rendered=[];
ink.render(T,renderer,scene,camera);assert.equal(rendered.length,1);assert.equal(rendered[0].s,scene);ink.dispose(renderer);
renderer.capabilities.isWebGL2=true;renderer.render=()=>{throw Error('render failure');};
assert.throws(()=>ink.render(T,renderer,scene,camera),/render failure/);assert.equal(target,null);assert.equal(renderer.info.autoReset,true);ink.dispose(renderer);
console.log('PASS material identity, shared shader hook, transparencies, buffer sizing, disposal, depth fallback and failure cleanup');
