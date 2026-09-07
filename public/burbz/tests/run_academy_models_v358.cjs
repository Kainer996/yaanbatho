const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = process.env.EVIDENCE_DIR || '/tmp/burbz-academy-v358-evidence';
fs.mkdirSync(out, { recursive:true });
const baseline = execFileSync('git', ['show','4cf36f727f5f6e6a65b88d58a0437bf4baf2fe31:public/burbz/academy_3d_core.js'], {cwd:root, encoding:'utf8',maxBuffer:4e6});
const baselineHtml = execFileSync('git', ['show','4cf36f727f5f6e6a65b88d58a0437bf4baf2fe31:public/burbz/index.html'], {cwd:root, encoding:'utf8',maxBuffer:4e6});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const results=[];
  try {
    for(const version of ['before','crafted']) {
      const page=await browser.newPage({viewport:{width:900,height:740},deviceScaleFactor:1,hasTouch:true,reducedMotion:'reduce',serviceWorkers:'block'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      await page.route('**/*',r=>r.abort());
      await page.setContent('<style>body{margin:0;background:#c5d0ce}#stage{width:900px;height:740px}</style><div id="stage"></div>');
      await page.addScriptTag({content:fs.readFileSync(path.join(root,'lib/three.min.js'),'utf8')});
      await page.addScriptTag({content:fs.readFileSync(path.join(root,'manga_render_core.js'),'utf8')});
      await page.addScriptTag({content:version==='before'?baseline:fs.readFileSync(path.join(root,'academy_3d_core.js'),'utf8')});
      await page.evaluate(()=>{
        window.roomTaps=[];window.academyHour=13;
        window.academy=BurbzAcademy3D.createAcademy3D({three:THREE,container:()=>document.getElementById('stage'),builtRooms:()=>Object.keys(BurbzAcademy3D.ANCHORS),hourOfDay:()=>academyHour,reducedMotion:()=>true,onRoomTap:id=>roomTaps.push(id)});
        academy.start();academy.pause();
      });
      const whole=await page.evaluate(()=>{
        const s=academy._state;
        let triangles=0,meshes=0;
        s.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
        return{meshes,triangles,draws:s.renderer.info.render.calls,gl:s.renderer.getContext().getError()};
      });
      assert.equal(whole.gl,0);results.push({version,kind:'overview',...whole});
      await page.screenshot({path:path.join(out,version+'-overview.png')});
      const ids=await page.evaluate(()=>academy._state.houses.map(h=>h.userData.roomId));
      assert.equal(ids.length,13);
      for(const id of ids) {
        const stats=await page.evaluate(id=>{
          const s=academy._state,house=s.houses.find(h=>h.userData.roomId===id);
          window.previewBackup={house,position:house.position.clone(),quaternion:house.quaternion.clone(),scale:house.scale.clone(),houses:s.houses,camera:s.camera.clone()};
          const scene=new THREE.Scene();scene.background=new THREE.Color(0xbdcecc);
          scene.add(new THREE.HemisphereLight(0xe4f4ff,0x546073,2.1));
          const sun=new THREE.DirectionalLight(0xffe9ca,2.3);sun.position.set(-3,7,5);scene.add(sun);
          const rim=new THREE.DirectionalLight(0xb9d9ed,.8);rim.position.set(3,4,-4);scene.add(rim);
          house.removeFromParent();house.position.set(0,0,0);house.rotation.set(0,0,0);house.scale.setScalar(1);scene.add(house);
          const bounds=new THREE.Box3().setFromObject(house),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
          const camera=new THREE.PerspectiveCamera(34,900/740,.1,60);
          camera.position.copy(center).add(new THREE.Vector3(4,2.6,6).normalize().multiplyScalar(Math.max(size.x,size.y,size.z)*2.15));camera.lookAt(center);
          BurbzManga.render(THREE,s.renderer,scene,camera);
          s.camera.copy(camera);s.houses=[house];
          const ray=new THREE.Raycaster();let tap=null;
          for(const y of [0,.15,-.15,.3,-.3])for(const x of [0,.15,-.15,.3,-.3]){
            ray.setFromCamera(new THREE.Vector2(x,y),camera);
            if(!tap&&ray.intersectObject(house,true).length)tap={x:(x*.5+.5)*900,y:(-y*.5+.5)*740};
          }
          let vertices=0,finite=true,shells=0;
          house.traverse(o=>{if(o.isMesh){if(o.name===id+'-shell')shells++;const a=o.geometry.attributes.position.array;vertices+=a.length/3;for(const v of a)if(!Number.isFinite(v))finite=false;}});
          return{id,finite,vertices,shells,tap,size:size.toArray(),architecture:house.userData.architecture,gl:s.renderer.getContext().getError(),draws:s.renderer.info.render.calls};
        },id);
        assert.equal(stats.gl,0);assert(stats.finite,id+' finite geometry');assert.equal(stats.shells,1);
        assert(stats.size.every(n=>n>0&&n<10));
        if(version==='crafted'){assert.equal(stats.architecture.version,358);assert(stats.architecture.parts.bevels>=(id==='nursery'?4:10));assert(stats.vertices<120000);}
        results.push({version,...stats});
        await page.screenshot({path:path.join(out,version+'-'+id+'.png')});
        assert(stats.tap,id+' raycast target');await page.touchscreen.tap(stats.tap.x,stats.tap.y);
        assert.equal(await page.evaluate(()=>roomTaps.at(-1)),id,'actual canvas tap reaches '+id);
        await page.evaluate(()=>{
          const b=previewBackup,s=academy._state;
          b.house.position.copy(b.position);b.house.quaternion.copy(b.quaternion);b.house.scale.copy(b.scale);
          s.scene.add(b.house);s.houses=b.houses;s.camera.copy(b.camera);window.previewBackup=null;
        });
      }
      // Magnified real production birds at the extremes and middle of a stroke.
      const birdSource=version==='before'?baselineHtml:fs.readFileSync(path.join(root,'index.html'),'utf8');
      const fn=name=>{const start=birdSource.indexOf('function '+name+'(');return birdSource.slice(start,birdSource.indexOf('\n}',start)+2);};
      await page.addScriptTag({content:'const villageFlocks=[];'+fn('villageMakeOverheadFlock')+'\n'+fn('villageAnimateFlockActors')});
      await page.evaluate(()=>{
        const s=academy._state,scene=new THREE.Scene();scene.background=new THREE.Color(0xc8d9dc);
        scene.add(new THREE.HemisphereLight(0xeaf6ff,0x435477,2));const sun=new THREE.DirectionalLight(0xffe5b8,2);sun.position.set(1,3,4);scene.add(sun);
        [0,Math.PI/2,Math.PI*1.5].forEach((phase,i)=>{
          const flock=villageMakeOverheadFlock(()=>.5,{timber:0x49382b},2);
          flock.userData.members[0].userData.phase=0;
          villageAnimateFlockActors([flock],phase/5.4);
          const bird=flock.userData.members[0];bird.removeFromParent();bird.position.set((i-1)*.78,0,0);bird.rotation.y=-Math.PI/2;bird.scale.setScalar(1);scene.add(bird);
        });
        const camera=new THREE.PerspectiveCamera(30,900/740,.01,20);camera.position.set(0,1.45,3.3);camera.lookAt(0,0,0);
        BurbzManga.render(THREE,s.renderer,scene,camera);
      });
      await page.screenshot({path:path.join(out,version+'-wing-stroke.png')});
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>{const el=document.getElementById('stage');el.style.width='390px';el.style.height='650px';academy.resize();academyHour=22;academy.start();});
      await page.locator('#stage').screenshot({path:path.join(out,version+'-night-phone.png')});
      const night=await page.evaluate(()=>{academy.setTreeLights(true);const s=academy._state;return{active:s.treeLightActive,gl:s.renderer.getContext().getError(),pixelRatio:s.renderer.getPixelRatio(),rooms:s.houses.length};});
      assert(night.active);assert.equal(night.gl,0);assert.equal(night.rooms,13);assert(night.pixelRatio<=1.5);
      results.push({version,kind:'night-phone',...night});
      await page.locator('#stage').screenshot({path:path.join(out,version+'-night-lights-phone.png')});
      assert.deepEqual(errors,[]);await page.evaluate(()=>academy.stop());await page.close();
    }
  } finally {fs.writeFileSync(path.join(out,'models-results.json'),JSON.stringify(results,null,2));await browser.close();}
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
