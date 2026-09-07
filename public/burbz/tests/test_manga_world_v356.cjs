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
// All supported surface types preserve cutouts, textures and the caller's shader key.
for (const [Material, shaderName] of [[T.MeshStandardMaterial,'standard'],[T.MeshPhongMaterial,'phong']]) {
 const map=new T.Texture(),m=new Material({map,alphaTest:.5,emissive:0x123456});
 let hookThis,hookRenderer;const sentinel={};
 m.onBeforeCompile=function(s,r){hookThis=this;hookRenderer=r;s.fragmentShader='// original hook\n'+s.fragmentShader;};
 m.customProgramCacheKey=()=> 'existing-variant';
 assert.equal(ink.styleMaterial(m),true);assert.equal(ink.styleMaterial(m),false);
 const s={fragmentShader:T.ShaderLib[shaderName].fragmentShader};m.onBeforeCompile(s,sentinel);
 assert.equal(hookThis,m);assert.equal(hookRenderer,sentinel);assert(s.fragmentShader.startsWith('// original hook'));
 assert.equal(s.fragmentShader.match(/float mangaBand/g).length,1);
 assert.equal(m.customProgramCacheKey(),'existing-variant|burbz-manga-v356');
 assert.equal(m.map,map);assert.equal(m.alphaTest,.5);assert.equal(m.emissive.getHex(),0x123456);
 m.dispose();map.dispose();
}
assert.equal(ink.styleMaterial(null),false);
const arrayScene=new T.Scene(),shared=new T.MeshLambertMaterial(),unlit=new T.MeshBasicMaterial();
arrayScene.add(new T.Mesh(new T.BoxGeometry(),[shared,unlit]),new T.Mesh(new T.BoxGeometry(),shared));
assert.equal(ink.styleScene(arrayScene),1);assert.deepEqual(arrayScene.userData.mangaStyle,{version:356,materials:1});

// A persistent pass must resize with adaptive DPR and release every GPU resource once.
let size=[800,600],dpr=1.5,resets=0,frames=[],active=null;
const mock={capabilities:{isWebGL2:false},extensions:{has:name=>name==='WEBGL_depth_texture'},
 info:{autoReset:false,reset(){resets++;}},getRenderTarget:()=>active,setRenderTarget:t=>{active=t;},
 getDrawingBufferSize:v=>v.set(...size),getPixelRatio:()=>dpr,render:(s,c)=>frames.push({s,c,target:active})};
const perspective=new T.PerspectiveCamera(55,1,.3,200),freshScene=new T.Scene();
freshScene.add(new T.Mesh(new T.BoxGeometry(),new T.MeshLambertMaterial()));
ink.render(T,mock,freshScene,perspective);
assert.equal(frames.length,2);assert.equal(resets,0);assert.equal(mock.info.autoReset,false);
const firstTarget=frames[0].target,quad=frames[1].s.children[0],uniforms=quad.material.uniforms;
assert.equal(quad.material.precision,'highp');
assert.match(quad.material.fragmentShader,/uniform highp sampler2D depth;/,'depth sampling must not inherit mobile lowp precision');
assert(firstTarget.depthTexture);assert.equal(uniforms.nearClip.value,.3);assert.equal(uniforms.farClip.value,200);
frames=[];size=[1200,450];dpr=1.25;perspective.near=.5;perspective.far=300;
ink.render(T,mock,freshScene,perspective);
assert.equal(frames[0].target,firstTarget);assert.equal(firstTarget.width,1200);assert.equal(firstTarget.height,450);
assert.equal(uniforms.texel.value.x,1.25/1200);assert.equal(uniforms.texel.value.y,1.25/450);
assert.equal(uniforms.nearClip.value,.5);assert.equal(uniforms.farClip.value,300);
assert.equal(freshScene.userData.mangaStyle.materials,1,'same scene is not traversed every frame');
const replacement=new T.Scene(),replacementMaterial=new T.MeshLambertMaterial();
replacement.add(new T.Mesh(new T.BoxGeometry(),replacementMaterial));
ink.render(T,mock,replacement,perspective);assert.equal(replacementMaterial.userData.burbzManga,true);

// Nested render targets and non-perspective cameras bypass the screen-space pass.
const external=new T.WebGLRenderTarget(4,4);active=external;frames=[];
ink.render(T,mock,replacement,perspective);assert.equal(frames.length,1);assert.equal(active,external);
assert.equal(frames[0].target,external);assert.equal(frames[0].s,replacement);
active=null;frames=[];const ortho=new T.OrthographicCamera();
ink.render(T,mock,replacement,ortho);assert.equal(frames.length,1);assert.equal(frames[0].c,ortho);assert.equal(active,null);
size=[0,0];frames=[];ink.render(T,mock,replacement,perspective);
assert.equal(firstTarget.width,1);assert.equal(firstTarget.height,1);

// Failure in the compositor restores renderer state too, not just scene failure.
let calls=0;mock.info.autoReset=true;mock.render=()=>{if(++calls===2)throw Error('compositor failure');};
assert.throws(()=>ink.render(T,mock,replacement,perspective),/compositor failure/);
assert.equal(active,null);assert.equal(mock.info.autoReset,true);assert.equal(resets,1);
const released={target:0,depth:0,material:0,geometry:0};
for(const [name,resource] of Object.entries({target:firstTarget,depth:firstTarget.depthTexture,material:quad.material,geometry:quad.geometry}))resource.addEventListener('dispose',()=>released[name]++);
ink.dispose(mock);ink.dispose(mock);ink.dispose(null);
assert.deepEqual(released,{target:1,depth:1,material:1,geometry:1});external.dispose();
mock.render=(s,c)=>frames.push({s,c,target:active});frames=[];
ink.render(T,mock,replacement,perspective);assert.notEqual(frames[0].target,firstTarget);ink.dispose(mock);
mock.capabilities.getMaxPrecision=()=> 'mediump';frames=[];
ink.render(T,mock,replacement,perspective);assert.equal(frames.length,1,'no highp support: keep cel shading, bypass depth ink');
assert.equal(frames[0].s,replacement);assert.equal(frames[0].target,null);ink.dispose(mock);
console.log('PASS material identity/hooks/arrays, cutouts, target reuse/resize, camera/depth fallbacks, complete disposal and both render-failure paths');
