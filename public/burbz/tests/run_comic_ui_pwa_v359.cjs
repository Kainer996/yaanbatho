const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
let version='v358';
const roots={v358:process.env.OLD_BURBZ_ROOT,v359:path.resolve(__dirname,'..')};
if(!roots.v358)throw Error('Set OLD_BURBZ_ROOT to a complete v358 deployment with real artwork.');
const out=process.env.EVIDENCE_DIR || '/tmp/burbz-comic-ui-v359';
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/burbz\//,'')||'index.html';
  const root=roots[version],file=path.resolve(root,rel);
  if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
  try{let data=fs.readFileSync(file);if(data.length<200&&data.toString().startsWith('version https://git-lfs.github.com/spec/'))data=fs.readFileSync(path.join(roots.v358,rel));
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.css':'text/css','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');
    res.setHeader('Cache-Control','no-cache');res.end(data);
  }catch{res.writeHead(404);res.end();}
});
(async()=>{
  await new Promise(resolve=>server.listen(8766,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.route('**/*',r=>r.request().url().startsWith('http://localhost:8766/')?r.continue():r.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://localhost:8766/burbz/',{waitUntil:'domcontentloaded'});
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>navigator.serviceWorker.controller&&localStorage.getItem('burbz_state'));
    await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('burbz_state'));s.player.coins=123457;s.player.branches=4321;s.mangaReleaseProof='preserve-v358-save';localStorage.setItem('burbz_state',JSON.stringify(s));});
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('burbz_state')).player.coins===123457);
    const before=await page.evaluate(()=>({save:JSON.parse(localStorage.getItem('burbz_state')),caches:[]}));
    assert(await page.evaluate(()=>!!window.BurbzManga));
    version='v359';
    await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()).catch(()=>{}));
    await page.waitForFunction(()=>!!window.BurbzManga && document.querySelector('link[href^="comic_ui"]')?.href.includes('v359'),{},{timeout:60000});
    const after=await page.evaluate(async()=>({save:JSON.parse(localStorage.getItem('burbz_state')),caches:await caches.keys(),uiCached:!!await caches.match('comic_ui.css?v=comic-ui-v359-20260907')}));
    assert.equal(after.save.player.coins,before.save.player.coins);assert.equal(after.save.player.branches,before.save.player.branches);assert.equal(after.save.mangaReleaseProof,'preserve-v358-save');assert(after.uiCached);
    const assets=['comic_ui.css?v=comic-ui-v359-20260907','assets/comic-ui/ink-paper-v359.webp','assets/comic-ui/battlefield-v359.webp','assets/comic-ui/fonts/inter-latin.woff2','assets/comic-ui/fonts/rajdhani-bold.woff2','assets/comic-ui/fonts/russo-one.woff2'];
    for(const asset of assets)assert(await page.evaluate(async url=>!!await caches.match(url),asset),'cached '+asset);
    assert(after.caches.some(k=>k.endsWith('comic-ui-v359-20260907')));
    await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.BurbzManga && document.querySelector('link[href^="comic_ui"]').href.includes('v359'));
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('burbz_state')).player.coins),123457);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.evaluate(()=>getComputedStyle(document.body).getPropertyValue('--comic-yellow').trim()),'#ffda38');
    const imageLoaded=await page.evaluate(()=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img.naturalWidth===900);img.onerror=()=>resolve(false);img.src='assets/comic-ui/battlefield-v359.webp';}));
    assert(imageLoaded,'battlefield loads offline');
    assert.deepEqual(errors,[]);await page.screenshot({path:path.join(out,'pwa-updated-offline.png')});
    console.log(JSON.stringify({oldInstalled:true,autoUpdatedTo359:true,uiCached:true,coinsPreserved:true,branchesPreserved:true,saveMarkerPreserved:true,offlineReload:true,pageErrors:errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
