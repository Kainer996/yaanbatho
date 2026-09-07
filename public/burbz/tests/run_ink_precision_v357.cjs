// The desktop GPU may ignore lowp. Emulate mobile sampler quantization only
// when the compiled depth sampler lacks highp; never alter the highp path.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-ink-v357';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const results=[];
 try{
  for(const mode of ['lowp-control','fixed']){
   const page=await browser.newPage({viewport:{width:390,height:600}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.setContent('<body style="margin:0"></body>');await page.addScriptTag({path:path.join(root,'lib/three.min.js')});
   await page.evaluate(()=>{
    const proto=WebGL2RenderingContext.prototype,original=proto.shaderSource;
    proto.shaderSource=function(shader,source){
     if(/uniform\s+(?:lowp\s+)?sampler2D\s+depth\s*;/.test(source))source=source.replace(/texture2D\(depth, uv\)\.x/g,'(floor(texture2D(depth, uv).x * 2048.0) / 2048.0)');
     return original.call(this,shader,source);
    };
   });
   let code=fs.readFileSync(path.join(root,'manga_render_core.js'),'utf8');
   if(mode==='lowp-control')code=code.replace('uniform highp sampler2D depth;','uniform sampler2D depth;');
   await page.addScriptTag({content:code});
   const samples=await page.evaluate(()=>{
    const T=THREE,r=new T.WebGLRenderer({preserveDrawingBuffer:true});r.setSize(390,600);document.body.append(r.domElement);
    const s=new T.Scene();s.background=new T.Color(.6,.6,.6);
    const surface=new T.MeshBasicMaterial({color:new T.Color(.6,.6,.6)}),plane=new T.Mesh(new T.PlaneGeometry(2000,2000),surface);plane.rotation.x=-Math.PI/2;s.add(plane);
    const box=new T.Mesh(new T.BoxGeometry(6,6,6),surface);box.position.y=3;
    const camera=new T.PerspectiveCamera(55,390/600,.1,140);camera.position.set(0,6,18);camera.lookAt(0,0,0);
    function pixels(){const gl=r.getContext(),w=r.domElement.width,h=r.domElement.height,data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);return{gl:gl.getError(),w,h,data};}
    const rows=[];
    for(const dpr of [1,1.25,1.5,1.75,2,2.5,3]){
     r.setPixelRatio(dpr);BurbzManga.render(T,r,s,camera);let p=pixels(),darkRows=0;
     for(let y=10;y<p.h*.55;y++){let mean=0;for(let x=20;x<p.w-20;x++)mean+=p.data[(y*p.w+x)*4];if(mean/(p.w-40)<180)darkRows++;}
     s.add(box);BurbzManga.render(T,r,s,camera);p=pixels();let edgePixels=0;
     // Same-colour geometry: only a real depth outline makes this box visible.
     for(let y=p.h*.25|0;y<p.h*.8;y++)for(let x=p.w*.2|0;x<p.w*.8;x++)if(p.data[(y*p.w+x)*4]<160)edgePixels++;
     s.remove(box);rows.push({dpr,darkRows,edgePixels,gl:p.gl});
    }
    BurbzManga.render(T,r,s,camera);window.testRenderer=r;return rows;
   });
   for(const sample of samples){assert.equal(sample.gl,0);if(mode==='fixed')assert.equal(sample.darkRows,0,'smooth ground must not acquire ink stripes at DPR '+sample.dpr);else assert(sample.darkRows>20,'control must reproduce stripes');assert(sample.edgePixels>100,'real silhouettes must retain ink');}
   assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,mode+'-plane.png')});
   results.push({mode,samples,errors});await page.close();
  }
 }finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
 console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});
