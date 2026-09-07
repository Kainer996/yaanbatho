/* Local-only, disposable browser evidence. No real account, save or microphone. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../..'),out=process.env.EVIDENCE_DIR||path.join(require('node:os').tmpdir(),'burbz-discovery-personality');
fs.mkdirSync(out,{recursive:true});
let source=fs.readFileSync(path.join(root,'public/burbz/index.html'),'utf8');
source=source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/burbz/'||url.pathname==='/burbz/index.html'){res.setHeader('Content-Type','text/html');return res.end(source);}
 if(url.pathname.includes('/api/')){res.statusCode=404;return res.end('{}');}
 const file=path.resolve(root,'public','.'+url.pathname);
 if(!file.startsWith(path.join(root,'public')+path.sep)){res.statusCode=403;return res.end();}
 fs.readFile(file,(e,b)=>{if(e){res.statusCode=404;return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(b);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const checks=[];
 try{
  for(const width of [320,390,1280]){
   console.log('Checking browser width '+width);
   const context=await browser.newContext({viewport:{width,height:width<600?844:900},serviceWorkers:'block'});
   await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const run=code=>page.evaluate(code=>window.__testEval(code),code);
   await page.goto(origin+'/burbz/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__testEval);
   await run(`
     if(merlinTutActive)endMerlinTutorial(false);
     localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
     markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));
     document.getElementById('introCutsceneOverlay')?.classList.remove('show');
     gameState.settings.sfx=false; gameState.settings.music=false; tutorialFlowState().errandClaimed=true;updateMerlinFlowPointer();
     gameState.player.level=20; gameState.player.xp=0;
     gameState.flock=[]; gameState.discoveredSpecies={};
     window.__notices=[]; showToast=text=>window.__notices.push(text);
     currentScreen='scan'; scanMode='sound'; continuousSoundScanWanted=true;
     handleBirdCandidates({species:'Goldcrest',confidence:.96},[],{source:'sound'});
     let crest=createBirdEntry('Goldcrest','Regulus regulus',.96);crest.id='fixture-goldcrest';crest.cha=40;crest.xp=23;crest.customName='Pip';
     gameState.flock.push(crest);saveState();
   `);
   assert.equal(await run('window.__notices.filter(s=>s.startsWith("Birdex updated")).length'),1);
   assert.equal(await page.locator('#scanEncounterStack .scan-encounter-card').count(),1);
   await run(`for(let i=0;i<25;i++)handleBirdCandidates({species:'GOLDCREST',confidence:.96},[],{source:'sound'});`);
   assert.equal(await run('gameState.player.xp'),8);assert.equal(await run('gameState.flock[0].xp'),23);
   assert.equal(await run('window.__notices.filter(s=>s.startsWith("Birdex updated")).length'),1);
   assert.equal(await page.locator('#soundSessionShelfGrid .sound-session-tile').count(),1);
   assert.ok(await page.locator('#scanEncounterStack .scan-encounter-card').count()<=1);
   checks.push({width,check:'real DOM: first plus 25 repeats keeps one tile/banner, 8 player XP, untouched companion XP'});
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);
   await run(`if(merlinTutActive)endMerlinTutorial(false);markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));window.__notices=[];showToast=text=>window.__notices.push(text);continuousSoundScanWanted=true;handleBirdCandidates({species:'Goldcrest',confidence:.96},[],{source:'sound'});`);
   assert.equal(await run('gameState.flock[0].cha'),90);assert.equal(await run('gameState.flock[0].xp'),23);
   assert.equal(await run('window.__notices.length'),0);assert.equal(await page.locator('#scanEncounterStack .scan-encounter-card').count(),0);
   checks.push({width,check:'reload: known species stays silent and saved Goldcrest migrates CHA 40→90 without XP change'});
   for(const theme of ['woodland','comic']){
    await run(`document.body.classList.remove('woodland-ui','comic-ui');document.body.classList.add('${theme}-ui');`);
    if(theme==='comic')await page.addStyleTag({url:origin+'/burbz/comic_ui.css'});
    await run("openBirdEquip('fixture-goldcrest');");
    await page.locator('#birdEquipOverlay.show .is-personality').waitFor();
    assert.equal((await page.locator('#birdEquipOverlay .is-personality .bes-value').textContent()).trim(),'90');
    const metrics=await page.locator('#birdEquipOverlay .is-personality').evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width,scroll:el.scrollWidth,client:el.clientWidth,text:el.textContent}});
    assert.ok(metrics.left>=0&&metrics.right<=width&&metrics.scroll<=metrics.client+1,JSON.stringify(metrics));
    assert.ok((await page.locator('#birdEquipOverlay').getAttribute('class')).includes('show'));
    await page.screenshot({animations:'disabled',path:path.join(out,`${theme}-full-card-${width}.png`)});
    await run("closeBirdEquip(); switchScreen('birdex'); currentBurbzMode='birdex';currentBirdexDiscovery='discovered';renderBirdex();");
    await run(`const grid=document.getElementById('birdGrid');grid.innerHTML=createKnownSpeciesCardHTML(createBirdFromDiscovery(getDiscoveredRecordForSpecies('Goldcrest')),0);wireBirdexCardActions(grid);`);
    await page.locator('#birdGrid .card-name').click();
    await page.waitForFunction(()=>document.querySelector('#birdGrid .bird-card').classList.contains('flipped'));
    const card=page.locator('#birdGrid .birdex-learning-back').first();
    assert.ok((await card.textContent()).includes('Personality (CHA)'));
    assert.ok((await card.textContent()).includes('90'));
    await page.locator('#birdGrid .bird-card').scrollIntoViewIfNeeded();
    await page.screenshot({animations:'disabled',path:path.join(out,`${theme}-reverse-card-${width}.png`)});
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    assert.equal(overflow,false);
    checks.push({width,theme,check:'Personality 90 visible on full and reverse cards without horizontal overflow',metrics});
   }
   if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
   await context.close();
  }
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));
  console.log(JSON.stringify({passed:checks.length,evidence:out},null,2));
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
