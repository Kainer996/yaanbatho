'use strict';
// Actual card templates/styles, disposable save. The sole HTML instrumentation
// exposes the existing closure to the harness; it never reaches production.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'/tmp/burbz-desk-cards-v420');
fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'results.json')),'Preserve prior evidence');
const live=process.env.BURBZ_URL,old=process.env.EXPECT_OLD==='1',pwa=process.env.TEST_PWA==='1';
const names=['Blue Tit','Great Tit','Long-tailed Tit','Goldcrest','Treecreeper','Great Spotted Woodpecker'];
const slugs=['blue_tit','great_tit','long_tailed_tit','goldcrest','treecreeper','great_spotted_woodpecker'];
const report={mode:live?'public':'local candidate',checks:[],errors:[],sourceSHA:{},limits:['Chromium desktop and phone viewport emulation; no physical-phone claim.','Disposable test save; HTML adds only a closure test hook and deterministic save seed.']};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pass=(name,data)=>{report.checks.push({name,data});console.log('PASS',name);};
const seed=F.SEED+`\nwindow.__testCardReady=true;`;
const instrument=html=>html.replace('\ninit();',F.HOOK+'\n'+seed+'\ninit();');
const proxyCache=new Map();let server,browser,context,page;
async function serverStart(){
 server=http.createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end('{"enabled":false}');}
  const name=decodeURIComponent(pathname).replace(/^\/burbz\//,'')||'index.html',file=path.resolve(root,name);
  if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
  let bytes;try{bytes=fs.readFileSync(file);if(bytes.length<300&&bytes.toString().startsWith('version https://git-lfs'))bytes=null;}catch(_){}
  if(!bytes){
   for(const base of (process.env.BURBZ_ASSET_ROOTS||'/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/gemini-offline-v410/work/runtime-assets:/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/companion-release-v363/public/burbz:/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/world-sky-v401/public/burbz:/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/v362-update-http-cache/burbz').split(':')){const cached=path.resolve(base,name);if(!cached.startsWith(base+'/'))continue;try{const b=fs.readFileSync(cached);if(!(b.length<300&&b.toString().startsWith('version https://git-lfs'))){bytes=b;break;}}catch{}}
  }
  if(!bytes){
   if(!/^(assets|bird-art-cache|icons|lib|vendor)\//.test(name)){res.writeHead(404);return res.end();}
   if(!proxyCache.has(name))proxyCache.set(name,fetch('https://yaanbatho.com/burbz/'+name).then(async r=>{if(!r.ok)throw Error('public asset '+r.status+' '+name);return Buffer.from(await r.arrayBuffer());}));
   bytes=await proxyCache.get(name);
  }
  if(name==='index.html'){report.sourceSHA.index=sha(bytes);bytes=Buffer.from(instrument(bytes.toString()));}
  if(name==='sw.js')report.sourceSHA.worker=sha(bytes);
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(bytes);
 }catch(e){res.writeHead(502);res.end(String(e));}});
 await new Promise(r=>server.listen(8983,'127.0.0.1',r));return 'http://localhost:8983/burbz/';
}
const run=code=>page.evaluate(code=>__testEval(code),code);


(async()=>{try{
 const url=await serverStart();browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await F.routeMap(context,report);page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval);await run('if(merlinTutActive)endMerlinTutorial(false);');
 // Feed the real public-control API explicit source attribution, as a provider does.
 await page.evaluate(()=>{const host=document.createElement('div');host.id='credits-proof';host.style.cssText='position:fixed;inset:70px 0 70px;z-index:4000';document.body.append(host);window.proofMap=new maplibregl.Map({container:host,style:{version:8,sources:{provider:{type:'geojson',data:{type:'FeatureCollection',features:[]},attribution:'© OpenMapTiles · © OpenStreetMap contributors · OpenFreeMap'}},layers:[{id:'ground',type:'background',paint:{'background-color':'#52694e'}},{id:'source',type:'circle',source:'provider'}]},attributionControl:false});BurbzFieldMapUI.mapCredits(proofMap);});
 const control=page.locator('#credits-proof .maplibregl-ctrl-attrib'),button=control.locator('summary,button');await page.waitForFunction(()=>proofMap.loaded());await page.waitForFunction(()=>document.querySelector('#credits-proof .maplibregl-ctrl-attrib').classList.contains('maplibregl-compact-show'));assert.match(await control.innerText(),/OpenMapTiles/);assert(await control.locator('a[href="audio-credits.html#maps"]').isVisible());pass('Real MapLibre control initially shows provider attribution plus full Settings credits');
 await page.waitForTimeout(5200);assert(!(await control.getAttribute('class')).includes('compact-show'));await button.focus();await page.keyboard.press('Enter');assert((await control.getAttribute('class')).includes('compact-show'));const b=await button.boundingBox();assert(b.width>=44&&b.height>=44);await page.screenshot({path:path.join(out,'credits-phone.png')});pass('Credits collapse after their initial display and reopen from a 44px keyboard/touch control');
 await page.evaluate(()=>{proofMap.remove();document.getElementById('credits-proof').remove();});await run("$('settingsBtn').click()");const link=page.locator('#settingsModal a[href="audio-credits.html"]');assert.match(await link.innerText(),/Credits.*Licences/);const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState();assert.match(await popup.locator('#maps').innerText(),/OpenFreeMap[\s\S]*OpenMapTiles[\s\S]*OpenStreetMap[\s\S]*Mapterhorn/);assert(await popup.locator('a[href="data/geographic-terrain-credits.html"]').isVisible());await popup.close();pass('Settings opens the actual combined credits page with map, elevation, source licences and existing audio credits');
 assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(e){report.failure=e.stack;console.error(e);try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server?.closeAllConnections();server?.close();}
})();
