const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs'), path = require('path'), assert = require('assert');
const out = process.env.EVIDENCE_DIR || '/tmp/burbz-manga-v356-evidence';
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROME_PATH, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const results = [];
  try {
    for (const style of ['before', 'manga']) {
      const context = await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
      await context.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:8765/') ? r.continue() : r.abort());
      let html = source.replace('\ninit();', '\nwindow.__testEval=code=>eval(code);\ninit();');
      if(style==='before') html=html.replace(/<script src="manga_render_core[^<]+<\/script>/,'');
      await context.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:html}));
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('console',m=>{if(m.type()==='error'&&/Shader|VALIDATE|GL_INVALID|Framebuffer/.test(m.text())) errors.push(m.text());});
      const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
      await page.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded'});
      assert.deepEqual(errors,[], 'game must boot without script errors: '+JSON.stringify(errors));
      await page.waitForTimeout(1700);
      if(await page.locator('#introSkipBtn').isVisible()) await page.locator('#introSkipBtn').tap();
      await page.waitForTimeout(500);
      await run(()=>{
        markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));if(merlinTutActive)endMerlinTutorial(false);
        Object.assign(gameState.player,{level:12,coins:1000000,branches:100000,stone:100000});
        burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);
        const empire=ensureEmpireState();empire.villages={};empire.townCharters=[];empire.cityCharters=[];
        for(const seed of [101,102,103]){
          const rec={seed,name:'Alder '+seed,lat:51.5+(seed-101)*.002,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};
          empire.villages[String(seed)]=rec;const eco=ensureVillageEconomy(rec);
          eco.buildings={cabin:3,well:2,cottages:1,hut:1,minehut:1,lumberhut:1,tavern:1};eco.population=24;eco.ruins=[];eco.constructions=[];
        }
        saveState();openEmpireVillage(101);
      });
      for(const kind of ['village','town']){
        if(kind==='town')await run(()=>{ensureEmpireState().townCharters=[{seeds:[101,102,103],mergedAt:new Date().toISOString()}];openEmpireTown(empireSettlementsInfo().towns[0].id);});
        const canvas=page.locator('#'+kind+'Stage canvas');await canvas.waitFor();await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(1200);
        const row=await run(kind=>{
          const s=window[kind==='town'?'__burbzTownDebug':'__burbzVillageDebug'].state();
          let materials=0;s.scene.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m?.userData.burbzManga)materials++;});
          return{kind,materials,draws:s.renderer.info.render.calls,triangles:s.renderer.info.render.triangles,textures:s.renderer.info.memory.textures,programs:s.renderer.info.programs.length,gl:s.renderer.getContext().getError(),width:s.renderer.domElement.width};
        },kind);
        assert.equal(row.gl,0);assert.equal(row.materials>0,style==='manga');
        results.push({style,...row});await canvas.screenshot({path:path.join(out,style+'-'+kind+'-day.png')});
        if(style==='manga'){
          // A real touch must still reach the original building, through the rendered canvas.
          const point=await run(kind=>{
            const target=(kind==='village'?villageBuildings:townEconBuildings).find(o=>o.userData.buildingId&&!o.userData.construction);
            if(!target)return null;
            const center=new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3());
            Object.assign(kind==='village'?villageCam:townCam,{tx:center.x,tz:center.z,dist:9,polar:.65,azimuth:.5,lastInputAt:Date.now()});
            (kind==='village'?villageAnimateFrame:townAnimateFrame)(1);
            const p=center.project(kind==='village'?villageCamera:townCamera),rect=$(kind+'Stage').getBoundingClientRect();
            return{id:target.userData.buildingId,x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(-p.y*.5+.5)*rect.height};
          },kind);
          assert(point,'built scene has a tappable building');await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(200);
          assert.equal(await run(()=>buildingInteriorOpenView?.buildingId),point.id);
          await run(()=>closeBuildingInterior());
          results.push({style,kind,buildingTap:point.id});
          await run(kind=>{burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(22);if(kind==='town'){townBuiltKey=null;renderTownScreen();}else{villageBuiltSeed=null;renderVillage();}},kind);
          await page.waitForTimeout(900);await canvas.screenshot({path:path.join(out,style+'-'+kind+'-night.png')});
          await page.setViewportSize({width:844,height:390});await page.waitForTimeout(600);
          await run(kind=>{(kind==='town'?townAnimateFrame:villageAnimateFrame)(1);},kind);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
          await page.setViewportSize({width:390,height:844});
          await run(()=>{burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);});
        }
      }
      // Exercise the standalone Academy adapter with every built room, also in reduced motion.
      await page.evaluate(()=>{
        document.body.innerHTML='<div id="academy-proof" style="width:390px;height:600px"></div>';
        const academy=BurbzAcademy3D.createAcademy3D({three:THREE,container:()=>document.getElementById('academy-proof'),builtRooms:()=>Object.keys(BurbzAcademy3D.ANCHORS),hourOfDay:()=>13,reducedMotion:()=>true});
        window.__mangaAcademy=academy;academy.start();
      });
      await page.waitForTimeout(1800);
      const academy=await page.evaluate(()=>{const s=window.__mangaAcademy._state;return{kind:'academy',manga:s.scene.userData.mangaStyle,gl:s.renderer.getContext().getError(),draws:s.renderer.info.render.calls};});
      assert.equal(academy.gl,0);assert.equal(!!academy.manga,style==='manga');results.push({style,...academy});
      await page.locator('#academy-proof').screenshot({path:path.join(out,style+'-academy-day.png')});
      await page.evaluate(()=>window.__mangaAcademy.stop());
      assert.deepEqual(errors,[]);await context.close();
    }
  } finally {fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));await browser.close();}
  console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
