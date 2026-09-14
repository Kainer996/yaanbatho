'use strict';
// Actual card templates/styles, disposable save. The sole HTML instrumentation
// exposes the existing closure to the harness; it never reaches production.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'/tmp/burbz-manga-v411-proof');
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
   if(!/^(assets|bird-art-cache|icons|lib|vendor)\//.test(name)){res.writeHead(404);return res.end();}
   if(!proxyCache.has(name))proxyCache.set(name,fetch('https://yaanbatho.com/burbz/'+name).then(async r=>{if(!r.ok)throw Error('public asset '+r.status+' '+name);return Buffer.from(await r.arrayBuffer());}));
   bytes=await proxyCache.get(name);
  }
  if(name==='index.html'){report.sourceSHA.index=sha(bytes);bytes=Buffer.from(instrument(bytes.toString()));}
  if(name==='sw.js')report.sourceSHA.worker=sha(bytes);
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(bytes);
 }catch(e){res.writeHead(502);res.end(String(e));}});
 await new Promise(r=>server.listen(8981,'127.0.0.1',r));return 'http://localhost:8981/burbz/';
}
const run=code=>page.evaluate(code=>__testEval(code),code);
async function cards(){
 await run(`if(merlinTutActive)endMerlinTutorial(false);gameState.flock=${JSON.stringify(names)}.map((name,i)=>{const b=createBirdEntry(name,'',.99);b.id='art-proof-'+i;b.customName='';return b;});currentBurbzMode='companions';currentFilter='all';currentBirdFamilyFilter='all';switchScreen('birdex');saveState();renderBirdex();`);
 await page.locator('#birdGrid .bird-card').first().waitFor();
 const actual=await run(`${JSON.stringify(names)}.map(name=>({name,attrs:birdCardImgAttrs({species:name}),sprite:birdOnlyImgHTML({species:name},'proof'),habitat:birdHabitatArtKey({species:name})}))`);
 for(let i=0;i<names.length;i++){
  const expected=i===5?'/burbz/bird-art-cache/great_spotted_woodpecker_burbz_manga_20260624.png':i===4?'/burbz/bird-art-cache/treecreeper_burbz_manga_20260624_v2.png':old?'/burbz/bird-art-cache/cutouts/'+slugs[i]+'_burbz_manga_warrior_20260802_cutout.png':'/burbz/assets/bird-cards-v411/'+slugs[i]+'-manga-20260914.webp';
  assert.equal(actual[i].attrs.src,expected);assert.equal(!!actual[i].attrs.isCutout,old&&i<4);assert(actual[i].sprite.includes('/cutouts/'));
  const card=page.locator('.bird-card[data-bird-id="art-proof-'+i+'"]');await card.scrollIntoViewIfNeeded();
  await card.locator('.card-art > img:not(.card-art-wash)').evaluate(img=>img.decode());
  await card.screenshot({path:path.join(out,slugs[i]+'-card.png')});
 }
 pass('Six actual companion cards load expected paintings; both reference paintings and compact sprites stay unchanged',actual);
 return actual;
}
(async()=>{try{
 const url=live||await serverStart();browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:pwa?'allow':'block'});
 if(live){await context.route(url+'**',async route=>{const u=new URL(route.request().url());if(!['/burbz/','/burbz/index.html'].includes(u.pathname))return route.fallback();const response=await route.fetch();const bytes=await response.body();report.sourceSHA.index=sha(bytes);return route.fulfill({response,body:instrument(bytes.toString())});});}
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.__testCardReady&&window.__testEval,{timeout:90000});
 await cards();await page.screenshot({path:path.join(out,'desktop.png')});
 const aliases=await run(`['Eurasian Blue Tit','Great Titmouse','Long Tailed Tit','Gold Crest'].map(name=>birdCardImgAttrs({species:name,artUrl:'/old-save.png'}).src)`);
 assert.deepEqual(aliases,(await run(`${JSON.stringify(names.slice(0,4))}.map(name=>birdCardImgAttrs({species:name}).src)`)));pass('Saved alternate names use the same four card paintings',aliases);
 for(const size of [{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(size);await page.locator('#birdGrid').scrollIntoViewIfNeeded();
  for(let i=0;i<names.length;i++){const card=page.locator('.bird-card[data-bird-id="art-proof-'+i+'"]');await card.scrollIntoViewIfNeeded();
   if(!old){const box=await card.evaluate(c=>{const a=c.querySelector('.card-art').getBoundingClientRect(),b=c.querySelector('.card-location-btn').getBoundingClientRect(),s=c.querySelector('.card-location-btn svg').getBoundingClientRect(),info=c.querySelector('.card-info').getBoundingClientRect();return{below:b.top>=a.bottom,inside:b.left>=info.left&&b.right<=info.right,target:[b.width,b.height],icon:s.width};});assert(box.below&&box.inside,JSON.stringify(box));assert(box.target.every(n=>n>=44));assert.equal(box.icon,16);}
   await card.screenshot({path:path.join(out,slugs[i]+'-'+size.width+'.png')});}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);assert(!overflow);pass('Cards fit '+size.width+'×'+size.height+' without page overflow');
 }
 if(!old){
  await page.setViewportSize({width:390,height:844});const card=page.locator('.bird-card[data-bird-id="art-proof-0"]');
  await card.locator('.card-location-btn').click();await page.waitForFunction(()=>__testEval('currentScreen')==='academy');assert(await page.locator('[data-bird-id="art-proof-0"]').count()>0);assert(!await page.locator('#birdEquipOverlay.show').count());
  pass('Discreet location controls stay below all six pictures with 44px targets; native click still finds the bird without opening equipment');
  await run(`closeBirdInfo();switchScreen('birdex');renderBirdex();`);await card.locator('.card-front [data-action="flip-card"]').click();await page.locator('#birdEquipOverlay.show').waitFor();
  assert((await page.locator('#birdEquipOverlay .bird-equip-hero img:not(.card-art-wash)').first().getAttribute('src')).includes('/assets/bird-cards-v411/blue_tit-'));await run('closeBirdEquip()');await card.locator('.card-art').click();await page.locator('#birdEquipOverlay.show').waitFor();await run('closeBirdEquip()');
  pass('Native Full card and picture clicks retain the full-card equipment interaction');
 }
 await page.setViewportSize({width:390,height:844});await run(`openBirdInfo('art-proof-1')`);await page.waitForTimeout(300);
 const info=await page.locator('.bird-info-art img:not(.card-art-wash)').first().getAttribute('src');assert.equal(info,(await run(`birdCardImgAttrs(gameState.flock[1]).src`)));await page.screenshot({path:path.join(out,'information-phone.png')});pass('Bird information uses the same full scene',info);
 if(pwa){
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:90000});
  const urls=await run(`${JSON.stringify(names.slice(0,4))}.map(name=>birdCardImgAttrs({species:name}).src)`);
  await page.evaluate(async urls=>{await Promise.all(urls.map(u=>fetch(u)));},urls);
  await page.waitForFunction(async urls=>(await Promise.all(urls.map(async u=>!!await caches.match(u)))).every(Boolean),urls,{timeout:90000});
  const saved=await run('gameState.flock.map(b=>b.id)');await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval);
  assert.deepEqual(await run('gameState.flock.map(b=>b.id)'),saved);await run(`if(merlinTutActive)endMerlinTutorial(false);currentBurbzMode='companions';switchScreen('birdex');renderBirdex();`);
  for(let i=0;i<4;i++){const card=page.locator('.bird-card[data-bird-id="art-proof-'+i+'"]');await card.scrollIntoViewIfNeeded();await card.locator('.card-art > img:not(.card-art-wash)').evaluate(img=>img.decode());}
  await page.screenshot({path:path.join(out,'offline-phone.png')});pass('Actual service worker reload preserves save and renders all four paintings offline');
 }
 assert.deepEqual(report.errors,[]);pass('No uncaught browser errors');report.complete=true;
 }catch(e){report.failure=e.stack;console.error(e);try{await page.screenshot({path:path.join(out,'failure.png')});}catch(_){}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server?.closeAllConnections();server?.close();}
})();
