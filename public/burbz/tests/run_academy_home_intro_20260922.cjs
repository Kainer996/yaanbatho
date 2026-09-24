'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/oauth-station/node_modules/playwright');
const F = require('./connected_world_fixture_v386.cjs');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..', '..');
const out = path.resolve(process.env.EVIDENCE_DIR || process.argv[2] || path.join(root, 'tests/evidence/academy-home-intro-20260922'));
fs.mkdirSync(out, { recursive:true });
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const changedProductAndTestFiles = [
  'public/burbz/index.html',
  'public/burbz/scan_home.css',
  'public/burbz/scan_home.js',
  'public/burbz/scan_home_core.js',
  'public/burbz/academy_home_intro.js',
  'public/burbz/sw.js',
  'scripts/update-live-burbz.sh',
  'public/burbz/tests/run_academy_home_20260922.cjs',
  'public/burbz/tests/run_academy_home_cache_smoke_20260923.cjs',
  'public/burbz/tests/run_academy_home_intro_20260922.cjs',
  'public/burbz/tests/test_scan_home_academy_projection_20260922.cjs',
  'public/burbz/tests/test_academy_home_intro_20260922.cjs',
  'public/burbz/tests/test_academy_home_cache_pins_20260923.cjs'
];
const hashFile = file => sha256(fs.readFileSync(path.resolve(repoRoot, file)));
const collectHashes = () => Object.fromEntries(changedProductAndTestFiles.map(file => [file, hashFile(file)]));
const introVideoRel = 'assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4';
const fallbackRoots = (() => {
  const roots = [];
  try {
    const configured = fs.readFileSync('/etc/burbz-webroot', 'utf8').trim();
    if (configured) roots.push(configured);
  } catch (_) {}
  roots.push('/home/ubuntu/yaanbatho/burbz');
  return [...new Set(roots)];
})();
function readHydratedAsset(rel) {
  const clean = rel.replace(/^\.\//, '').split('?')[0];
  const local = path.join(root, clean);
  try {
    const bytes = fs.readFileSync(local);
    if (!(bytes.length < 300 && bytes.toString().startsWith('version https://git-lfs'))) {
      return { bytes, source:local, fallback:false };
    }
  } catch (_) {}
  for (const base of fallbackRoots) {
    const resolvedBase = path.resolve(base);
    const file = path.resolve(resolvedBase, clean);
    if (!file.startsWith(resolvedBase + path.sep)) continue;
    try {
      const bytes = fs.readFileSync(file);
      if (bytes.length < 300 && bytes.toString().startsWith('version https://git-lfs')) continue;
      return { bytes, source:file, fallback:true };
    } catch (_) {}
  }
  throw new Error('Hydrated asset unavailable: ' + clean);
}

const scenarioFilter = new Set(String(process.env.ACADEMY_HOME_INTRO_SCENARIOS || '').split(',').map(s => s.trim()).filter(Boolean));
const report = {
  checks: [],
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  httpFailures: [],
  missing: [],
  served: {},
  videos: [],
  artifacts: [],
  assets: {},
  scenarios: {},
  changedProductAndTestFiles,
  hashes: { start:collectHashes() },
  scenarioFilter:[...scenarioFilter],
  limits: [
    'Chromium phone/desktop emulation, not physical-phone performance.',
    'Disposable synthetic profiles and saves; no owner profile or external paid API.'
  ]
};
const pass = (name, detail = true) => { report.checks.push({ name, detail }); console.log('PASS', name); };

function profile(id) {
  return 'intro_profile_' + id + '_20260922';
}

function resourceNameFromUrl(value) {
  try {
    const url = new URL(value);
    const pathname = decodeURIComponent(url.pathname || '');
    return pathname.replace(/^\/burbz\//, '').replace(/^\/+/, '') || 'index.html';
  } catch (_) {
    return String(value || '').replace(/^\/burbz\//, '').replace(/^\/+/, '');
  }
}

function ffprobeDurationSec(file) {
  const probe = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file
  ], { encoding:'utf8' });
  if (probe.status !== 0) {
    throw new Error('ffprobe failed for ' + file + ': ' + (probe.stderr || probe.error?.message || 'unknown error'));
  }
  const duration = Number(String(probe.stdout || '').trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('ffprobe returned invalid duration for ' + file + ': ' + probe.stdout);
  return duration;
}

function createVideoContactArtifacts(savedVideo, dir, scenarioName) {
  const durationSec = ffprobeDurationSec(savedVideo);
  const fps = 5;
  const columns = 5;
  const expectedFrames = Math.ceil(durationSec * fps);
  const rows = Math.max(1, Math.ceil(expectedFrames / columns));
  const capacityFrames = rows * columns;
  const sheet = path.join(dir, 'video-contact-sheet.png');
  const filter = [
    `fps=${fps}`,
    'scale=156:-1',
    "drawtext=text='%{pts\\:hms}':x=4:y=4:fontsize=12:fontcolor=white:box=1:boxcolor=black@0.70",
    `tile=${columns}x${rows}`
  ].join(',');
  const ffmpeg = spawnSync('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'error',
    '-i', savedVideo,
    '-vf', filter,
    '-frames:v', '1',
    sheet
  ], { encoding:'utf8' });
  if (ffmpeg.status !== 0) {
    throw new Error('ffmpeg contact sheet failed for ' + savedVideo + ': ' + (ffmpeg.stderr || ffmpeg.error?.message || 'unknown error'));
  }
  const metadata = {
    scenario:scenarioName,
    rawVideo:path.join(scenarioName, 'browser-recording.webm'),
    contactSheet:path.join(scenarioName, 'video-contact-sheet.png'),
    durationSec,
    fps,
    columns,
    rows,
    expectedFrames,
    capacityFrames,
    coversFullDuration: capacityFrames >= expectedFrames,
    timestampOverlay:'drawtext %{pts:hms}',
    sha256:sha256(fs.readFileSync(sheet))
  };
  assert.equal(metadata.coversFullDuration, true, 'video contact sheet capacity covers full raw recording duration');
  const metadataFile = path.join(dir, 'video-contact-sheet-metadata.json');
  fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  report.screenshots.push(metadata.contactSheet);
  report.artifacts.push(metadata.contactSheet, path.join(scenarioName, 'video-contact-sheet-metadata.json'));
  report.motionVideoEvidence = report.motionVideoEvidence || [];
  report.motionVideoEvidence.push(metadata);
  return metadata;
}

function instrumentation() {
  return `
window.__introSaveCount=0;
window.__introSaveStacks=[];
window.__introCloudCount=0;
if(typeof durableSaveState==='function'){
  window.__introOriginalDurableSaveState=durableSaveState;
  durableSaveState=function(...args){window.__introSaveCount++;window.__introSaveStacks.push(new Error().stack);return window.__introOriginalDurableSaveState.apply(this,args);};
}
if(typeof queueCloudSave==='function'){
  window.__introOriginalQueueCloudSave=queueCloudSave;
  queueCloudSave=function(...args){window.__introCloudCount++;return window.__introOriginalQueueCloudSave.apply(this,args);};
}
`;
}

function introTraceSeed(options = {}) {
  const lightweight = !!options.lightweight;
  return `
(function(){
  const LIGHTWEIGHT_TRACE = ${JSON.stringify(lightweight)};
  const trace = [];
  const timerTrace = [];
  const inputTrace = [];
  const longTasks = [];
  let lastOverlay = false;
  let lastPhase = null;
  window.__qaIntroTrace = trace;
  window.__qaTimerTrace = timerTrace;
  window.__qaIntroInputs = inputTrace;
  window.__qaIntroLongTasks = longTasks;
  function push(list, row) {
    list.push(Object.assign({ at:performance.now(), date:Date.now() }, row));
    if (list.length > 900) list.shift();
  }
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        longTasks.push({
          name:entry.name,
          startTime:entry.startTime,
          duration:entry.duration,
          date:Date.now()
        });
        if (longTasks.length > 120) longTasks.shift();
      }
    }).observe({ type:'longtask', buffered:true });
  } catch (_) {}
  function skipPaint(intro) {
    const skip = intro && intro.querySelector('.academy-home-intro-skip');
    const hud = document.getElementById('globalMoneyHud');
    if (!skip) return null;
    const rect = skip.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    const hudRect = hud ? hud.getBoundingClientRect() : null;
    return {
      text: skip.textContent.trim(),
      rect:{ left:rect.left, top:rect.top, width:rect.width, height:rect.height },
      topTag: top ? top.tagName : null,
      topClass: top ? String(top.className || '') : null,
      topIsSkip: top === skip || skip.contains(top),
      hudDisplay: hud ? getComputedStyle(hud).display : null,
      hudRect: hudRect ? { left:hudRect.left, top:hudRect.top, width:hudRect.width, height:hudRect.height } : null,
      introZ: intro ? getComputedStyle(intro).zIndex : null,
      hudZ: hud ? getComputedStyle(hud).zIndex : null
    };
  }
  function normalizeReceiptState(value) {
    const stable = JSON.parse(JSON.stringify(value));
    if (!stable || typeof stable !== 'object') return stable;
    if (stable.merlinCare) {
      stable.merlinCare.hunger = '__volatile-care-clock';
      stable.merlinCare.lastCareAt = '__volatile-care-clock';
      stable.merlinCare.lastHungerAt = '__volatile-care-clock';
    }
    if (stable.birdCare) {
      stable.birdCare.lastHungerAt = '__volatile-care-clock';
      stable.birdCare.lastTirednessAt = '__volatile-care-clock';
    }
    return stable;
  }
  window.__qaIntroReceiptSnapshot = function() {
    const stable = normalizeReceiptState(gameState);
    const durableState = localStorage.getItem('burbz_state');
    let stableDurableState = null;
    try { stableDurableState = JSON.stringify(normalizeReceiptState(JSON.parse(durableState))); }
    catch (error) { stableDurableState = 'parse-error:' + error.message; }
    const profileId = gameState.photoProfileId;
    const receiptKey = BurbzAcademyHomeIntroCore.receiptKey(profileId);
    return {
      profileId,
      receiptKey,
      receipt:localStorage.getItem(receiptKey),
      state:JSON.stringify(gameState),
      stableState:JSON.stringify(stable),
      durableState,
      stableDurableState,
      save:window.__introSaveCount,
      cloud:window.__introCloudCount,
      seedOnce:window.__qaIntroSeedOnce,
      debug:window.__academyHomeIntroDebug?.state?.() || null,
      overlayCount:document.querySelectorAll('.academy-home-intro').length
    };
  };
  function sample(kind, detail) {
    const intro = document.querySelector('.academy-home-intro');
    const phase = intro ? intro.dataset.phase || null : null;
    const row = {
      kind,
      overlay:!!intro,
      phase,
      activeClass:document.body.classList.contains('academy-home-intro-active'),
      skip:skipPaint(intro),
      counters:{ save:window.__introSaveCount || 0, cloud:window.__introCloudCount || 0 },
      detail:detail || null
    };
    if (intro) {
      const whole = intro.querySelector('.academy-home-intro-whole');
      const interior = intro.querySelector('.academy-home-intro-interior');
      row.wholeTransform = whole ? getComputedStyle(whole).transform : null;
      row.interiorOpacity = interior ? getComputedStyle(interior).opacity : null;
      row.wholeTransition = whole ? getComputedStyle(whole).transitionDuration : null;
      row.interiorTransition = interior ? getComputedStyle(interior).transitionDuration : null;
      row.canopy = intro.querySelectorAll('.intro-canopy').length;
      row.roots = intro.querySelectorAll('.intro-root').length;
      row.treeRooms = intro.querySelectorAll('.intro-cut-rooms rect').length;
      row.cutawayRooms = intro.querySelectorAll('.intro-final-rooms rect').length;
    }
    if (!!intro !== lastOverlay) {
      const overlayRow = Object.assign({}, row, { kind:intro ? 'overlay-add' : 'overlay-remove' });
      push(trace, overlayRow);
      const inserted = trace[trace.length - 1];
      if (intro && typeof window.__qaIntroArmedInput === 'function') {
        try {
          if (window.__qaCaptureIntroReceiptBefore && !window.__qaReceiptBeforeSnapshot && typeof window.__qaIntroReceiptSnapshot === 'function') {
            window.__qaReceiptBeforeSnapshot = window.__qaIntroReceiptSnapshot();
          }
          window.__qaIntroArmedInput({
            at:inserted.at,
            date:inserted.date,
            phase:inserted.phase,
            activeClass:inserted.activeClass,
            skip:inserted.skip,
            canopy:inserted.canopy,
            roots:inserted.roots,
            treeRooms:inserted.treeRooms,
            cutawayRooms:inserted.cutawayRooms,
            counters:inserted.counters
          });
        } catch (_) {}
      }
      lastOverlay = !!intro;
    }
    if (phase !== lastPhase) {
      push(trace, Object.assign({}, row, { kind:'phase-change' }));
      lastPhase = phase;
    }
    push(trace, row);
  }
  window.__qaIntroSample = sample;
  const originalTrack = typeof trackAcademyHomeIntroMerlinTimer === 'function' ? trackAcademyHomeIntroMerlinTimer : null;
  if (originalTrack && !window.__qaIntroTimerWrapped) {
    window.__qaIntroTimerWrapped = true;
    trackAcademyHomeIntroMerlinTimer = function(label, delay, callback) {
      push(timerTrace, { kind:'register', label, delay, overlay:!!document.querySelector('.academy-home-intro') });
      return originalTrack(label, delay, function() {
        push(timerTrace, { kind:'callback-start', label, overlay:!!document.querySelector('.academy-home-intro') });
        try { return callback.apply(this, arguments); }
        finally { push(timerTrace, { kind:'callback-end', label, overlay:!!document.querySelector('.academy-home-intro') }); }
      });
    };
  }
  const observer = new MutationObserver(() => sample('mutation'));
  if (LIGHTWEIGHT_TRACE) {
    observer.observe(document.body, { childList:true });
  } else {
    observer.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:['class','data-phase','open','hidden','style'] });
  }
  function recordInput(kind, eventObject) {
    const intro = document.querySelector('.academy-home-intro');
    const skip = intro && intro.querySelector('.academy-home-intro-skip');
    const target = eventObject.target;
    const path = typeof eventObject.composedPath === 'function' ? eventObject.composedPath() : [];
    const skipTarget = !!skip && (target === skip || skip.contains(target) || path.includes(skip));
    const activeSkip = !!skip && document.activeElement === skip;
    if (!skipTarget && !activeSkip) return;
    push(inputTrace, {
      kind,
      phase:intro ? intro.dataset.phase || null : null,
      overlay:!!intro,
      skipTarget,
      activeSkip,
      key:eventObject.key || null,
      pointerType:eventObject.pointerType || null,
      eventTimeStamp:eventObject.timeStamp,
      isTrusted:eventObject.isTrusted === true,
      targetClass:target ? String(target.className || '') : null
    });
    sample('native-input', { kind, skipTarget, activeSkip, key:eventObject.key || null });
  }
  document.addEventListener('pointerdown', eventObject => recordInput('pointerdown', eventObject), { capture:true, passive:true });
  document.addEventListener('click', eventObject => recordInput('click', eventObject), { capture:true, passive:true });
  document.addEventListener('keydown', eventObject => recordInput('keydown', eventObject), true);
  setInterval(() => sample('interval'), LIGHTWEIGHT_TRACE ? 45 : 90);
  sample('trace-ready');
})();
`;
}

function completedSeed(id, extras = '', holdMs = 900, traceOptions = {}) {
  return `
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
localStorage.removeItem(BURBZ_INTRO_PENDING_KEY);
localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
localStorage.setItem(BURBZ_TUTORIAL_STATE_KEY,JSON.stringify({version:BURBZ_TUTORIAL_VERSION,status:'completed',mode:'story',careLessonVersion:2,currentStep:0,stepId:null}));
  const f=JSON.parse(JSON.stringify(DEFAULT_STATE));
  Object.assign(f.player,{name:'Intro QA',level:20,coins:200000,branches:200000,stone:1000});
f.photoProfileId=${JSON.stringify(profile(id))};
f.settings={music:false,sfx:false,vibration:false,particles:false,appearance:'normal'};
f.playerHome={version:2,intro:'done',tier:1,rooms:{library:true},owned:{bench:1},placed:[],finds:[],nextId:1};
f.tutorialFlow={errandClaimed:true,barracksGiftGranted:true,barracksCelebrated:true,openingStarted:true,discoveryReviewed:true,companionMet:true,kitchenIntroduced:true,kitchenShortageSeen:true,openingSupplyReturnClaimed:true,openingCareDone:true};
for(const q of PLAYER_QUESTS)f.quests[q.id]={progress:q.target,claimed:true};
  f.academyBuildings={outdoors:{built:true,builtAt:'starter'},tavern:{built:true,builtAt:'qa',x:50,y:80},training:{built:true,builtAt:'qa',x:75,y:64},kitchen:{built:true,builtAt:'qa',x:62,y:54}};
  f.mapPickups={day:new Date().toISOString().slice(0,10),collected:{}};
  localStorage.setItem('burbz_state',JSON.stringify(f));
  window.__qaIntroSeedState=JSON.stringify(f);
  ${instrumentation()}
${introTraceSeed(traceOptions)}
${holdMs ? `trackAcademyHomeIntroMerlinTimer('qa-start-hold',${holdMs},()=>{window.__qaStartHoldDone=true;});` : ''}
${extras}
`;
}

function completedSeedOnce(id, extras = '', holdMs = 900, traceOptions = {}) {
  const marker = '__qaAcademyHomeIntroSeedOnce:' + id;
  return `
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
localStorage.removeItem(BURBZ_INTRO_PENDING_KEY);
localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
localStorage.setItem(BURBZ_TUTORIAL_STATE_KEY,JSON.stringify({version:BURBZ_TUTORIAL_VERSION,status:'completed',mode:'story',careLessonVersion:2,currentStep:0,stepId:null}));
const __qaSeedMarker=${JSON.stringify(marker)};
const __qaExistingSeed=localStorage.getItem(__qaSeedMarker);
if(!__qaExistingSeed){
  const f=JSON.parse(JSON.stringify(DEFAULT_STATE));
  Object.assign(f.player,{name:'Intro QA',level:20,coins:200000,branches:200000,stone:1000});
  f.photoProfileId=${JSON.stringify(profile(id))};
  f.settings={music:false,sfx:false,vibration:false,particles:false,appearance:'normal'};
  f.playerHome={version:2,intro:'done',tier:1,rooms:{library:true},owned:{bench:1},placed:[],finds:[],nextId:1};
  f.tutorialFlow={errandClaimed:true,barracksGiftGranted:true,barracksCelebrated:true,openingStarted:true,discoveryReviewed:true,companionMet:true,kitchenIntroduced:true,kitchenShortageSeen:true,openingSupplyReturnClaimed:true,openingCareDone:true};
  for(const q of PLAYER_QUESTS)f.quests[q.id]={progress:q.target,claimed:true};
  f.academyBuildings={outdoors:{built:true,builtAt:'starter'},tavern:{built:true,builtAt:'qa',x:50,y:80},training:{built:true,builtAt:'qa',x:75,y:64},kitchen:{built:true,builtAt:'qa',x:62,y:54}};
  f.mapPickups={day:new Date().toISOString().slice(0,10),collected:{}};
  localStorage.setItem('burbz_state',JSON.stringify(f));
  localStorage.setItem(__qaSeedMarker,JSON.stringify({ writes:1, profileId:f.photoProfileId, state:JSON.stringify(f) }));
  window.__qaIntroSeedState=JSON.stringify(f);
  window.__qaIntroSeedOnce={ marker:__qaSeedMarker, wrote:true, value:localStorage.getItem(__qaSeedMarker) };
}else{
  window.__qaIntroSeedOnce={ marker:__qaSeedMarker, wrote:false, value:__qaExistingSeed };
}
${instrumentation()}
${introTraceSeed(traceOptions)}
${holdMs ? `trackAcademyHomeIntroMerlinTimer('qa-start-hold',${holdMs},()=>{window.__qaStartHoldDone=true;});` : ''}
${extras}
`;
}

function freshSeed(traceOptions = {}) {
  return `
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.removeItem(BURBZ_INTRO_SEEN_KEY);
localStorage.removeItem(BURBZ_INTRO_PENDING_KEY);
${instrumentation()}
${introTraceSeed(traceOptions)}
`;
}

async function scenario(name, seed, run, contextOptions = {}) {
  if (scenarioFilter.size && !scenarioFilter.has(name)) {
    report.scenarios[name] = { ok:null, skippedByFilter:true };
    return;
  }
  const dir = path.join(out, name);
  fs.mkdirSync(dir, { recursive:true });
  const fixture = F.createServer({ root, port:(contextOptions.port || 8974) + Number(process.env.ACADEMY_HOME_INTRO_PORT_OFFSET || 0), report, seed });
  let browser, context, page;
  let videoHandle = null;
  let cdpRecorder = null;
  let armedInput = null;
  const clock = [];
  const hostMark = label => clock.push({ label, hostDate:Date.now(), hostHrtimeNs:String(process.hrtime.bigint()) });
  const browserMark = async label => {
    const hostBefore = Date.now();
    const hrBefore = String(process.hrtime.bigint());
    let browser = null;
    try {
      browser = await page.evaluate(label => ({
        label,
        date:Date.now(),
        performanceNow:performance.now(),
        readyState:document.readyState,
        url:location.href
      }), label);
    } catch (error) {
      browser = { error:error.message };
    }
    clock.push({
      label,
      hostBefore,
      hostAfter:Date.now(),
      hostHrtimeBeforeNs:hrBefore,
      hostHrtimeAfterNs:String(process.hrtime.bigint()),
      browser
    });
    return browser;
  };
  const missingStart = report.missing.length;
  try {
    hostMark('listen:start');
    await fixture.listen();
    hostMark('listen:end');
    browser = await chromium.launch({ headless:true, executablePath:chromium.executablePath(), args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
    hostMark('browser:launched');
    const viewport = contextOptions.viewport || { width:390, height:844 };
    context = await browser.newContext({
      viewport,
      hasTouch: true,
      serviceWorkers: 'block',
      reducedMotion: contextOptions.reducedMotion || 'no-preference',
      colorScheme: contextOptions.colorScheme || 'dark',
      recordVideo: contextOptions.video ? { dir, size:viewport } : undefined
    });
    await F.routeMap(context, report);
    // Sparse-clone QA only: unchanged art is read from deployed assets, read-only.
    await context.route(/http:\/\/(?:127\.0\.0\.1|localhost):\d+\/burbz\/(assets|bird-art-cache|icons|fonts)\//, route => {
      const rel = resourceNameFromUrl(route.request().url());
      // Fault injection must win over the read-only static-art fallback.
      if (name === 'fresh-trailer-missing-media-recovery' && rel === introVideoRel) {
        return route.fulfill({ status:404, contentType:'text/plain', body:'Intentional missing trailer fixture' });
      }
      try {
        const asset = readHydratedAsset(rel);
        const contentType = ({'.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg','.woff2':'font/woff2'})[path.extname(rel)] || 'application/octet-stream';
        return route.fulfill({status:200,contentType,body:asset.bytes});
      } catch (_) { return route.continue(); }
    });
    const hydrateIntroVideo = contextOptions.hydrateIntroVideo || name !== 'fresh-trailer-missing-media-recovery';
    if (hydrateIntroVideo) {
      const asset = readHydratedAsset(introVideoRel);
      report.assets[introVideoRel] = {
        source:asset.source,
        fallback:asset.fallback,
        bytes:asset.bytes.length,
        sha256:sha256(asset.bytes)
      };
      await context.route('**/' + introVideoRel, route => route.fulfill({
        status:200,
        contentType:'video/mp4',
        headers:{ 'Access-Control-Allow-Origin':'*', 'Cache-Control':'no-cache' },
        body:asset.bytes
      }));
    }
    page = await context.newPage();
    await browserMark('page-created-before-navigation');
    if (contextOptions.cdpFrames) cdpRecorder = await startCdpRecorder(page, dir, name);
    if (contextOptions.armInput) armedInput = await armIntroInput(page, contextOptions.armInput);
    videoHandle = page.video?.() || null;
    page.on('pageerror', e => report.pageErrors.push({ scenario:name, message:e.message }));
    page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push({ scenario:name, message:m.text(), location:m.location?.() || null }); });
    page.on('requestfailed', request => report.requestFailures.push({
      scenario:name,
      url:request.url(),
      name:resourceNameFromUrl(request.url()),
      method:request.method(),
      resourceType:request.resourceType(),
      failure:request.failure()?.errorText || null
    }));
    page.on('response', response => {
      const status = response.status();
      if (status >= 400) {
        const request = response.request();
        report.httpFailures.push({
          scenario:name,
          url:response.url(),
          name:resourceNameFromUrl(response.url()),
          status,
          method:request.method(),
          resourceType:request.resourceType()
        });
      }
    });
    page.__earlyIntro = page.waitForSelector('.academy-home-intro', { state:'visible', timeout:15000 }).then(async handle => {
      const info = await handle.evaluate(el => ({
        phase: el.dataset.phase,
        canopy: el.querySelectorAll('.intro-canopy').length,
        roots: el.querySelectorAll('.intro-root').length,
        roomRects: el.querySelectorAll('.intro-cut-rooms rect').length
      }));
      let screenshot = null;
      if (contextOptions.earlyScreenshot) {
        const shot = path.join(dir, 'intro-first-selector-visible-auto.png');
        await page.screenshot({ path:shot, fullPage:true }).catch(() => {});
        screenshot = path.relative(out, shot);
      }
      return { ...info, screenshot };
    }).catch(error => ({ error:error.message }));
    await browserMark('before-goto');
    await page.goto(fixture.url, { waitUntil:'domcontentloaded', timeout:60000 });
    await browserMark('after-goto-domcontentloaded');
    await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan', null, { timeout:60000 });
    await browserMark('after-current-screen-scan');
    const api = code => page.evaluate(code => __testEval(code), code);
    await run({ page, api, dir, fixture, cdpRecorder, armedInput, clock });
    await browserMark('after-run');
    report.scenarios[name] = { ok:true, clock, armedInput:armedInput?.summary?.() || null };
  } catch (error) {
    if (page) await browserMark('failure-caught').catch(() => {});
    report.scenarios[name] = { ok:false, error:error.stack, clock, armedInput:armedInput?.summary?.() || null };
    try { await page?.screenshot({ path:path.join(dir, 'failure.png'), fullPage:true }); } catch (_) {}
    throw error;
  } finally {
    for (let i = missingStart; i < report.missing.length; i++) {
      if (!report.missing[i].scenario) report.missing[i].scenario = name;
    }
    await cdpRecorder?.stop();
    await context?.close();
    if (contextOptions.video && videoHandle) {
      try {
        const rawVideo = await videoHandle.path();
        const savedVideo = path.join(dir, 'browser-recording.webm');
        fs.copyFileSync(rawVideo, savedVideo);
        report.videos.push(path.relative(out, savedVideo));
        if (contextOptions.videoContactSheet) {
          createVideoContactArtifacts(savedVideo, dir, name);
        }
      } catch (error) {
        report.videos.push({ scenario:name, error:error.message });
        if (contextOptions.videoContactSheet) throw error;
      }
    }
    await browser?.close();
    fixture.server.closeAllConnections?.();
    fixture.server.close();
  }
}

async function waitIntro(page) {
  await page.locator('.academy-home-intro').waitFor({ state:'visible', timeout:10000 });
}

async function introTrace(api) {
  return api('({ intro:window.__qaIntroTrace || [], timers:window.__qaTimerTrace || [], inputs:window.__qaIntroInputs || [], longTasks:window.__qaIntroLongTasks || [], debug:window.__academyHomeIntroDebug?.state?.() || null })');
}

async function skipPaintInfo(page) {
  return page.locator('.academy-home-intro').evaluate(el => {
    const skip = el.querySelector('.academy-home-intro-skip');
    const hud = document.getElementById('globalMoneyHud');
    const rect = skip.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const top = document.elementFromPoint(x, y);
    const hudRect = hud ? hud.getBoundingClientRect() : null;
    return {
      text: skip.textContent.trim(),
      rect:{ left:rect.left, top:rect.top, width:rect.width, height:rect.height },
      topTag: top ? top.tagName : null,
      topClass: top ? String(top.className || '') : null,
      topIsSkip: top === skip || skip.contains(top),
      hudDisplay: hud ? getComputedStyle(hud).display : null,
      hudRect: hudRect ? { left:hudRect.left, top:hudRect.top, width:hudRect.width, height:hudRect.height } : null,
      introZ:Number(getComputedStyle(el).zIndex) || 0,
      hudZ:hud ? Number(getComputedStyle(hud).zIndex) || 0 : 0,
      activeClass:document.body.classList.contains('academy-home-intro-active')
    };
  });
}

function assertSkipPaint(info) {
  assert.equal(info.text, 'Skip');
  assert(info.rect.width >= 44 && info.rect.height >= 44, 'Skip target is at least 44px ' + JSON.stringify(info));
  assert.equal(info.topIsSkip, true, 'Skip is the painted hit-test top element at its center ' + JSON.stringify(info));
  assert((Number(info.introZ) || 0) > (Number(info.hudZ) || 0), 'intro overlay stacks above money HUD');
  assert.notEqual(info.hudDisplay, 'flex', 'money HUD is not visibly painted during intro');
  assert.equal(info.activeClass, true, 'intro active body class is set while overlay is shown');
}

async function armIntroInput(page, mode) {
  assert(['pointer', 'keyboard'].includes(mode), 'supported intro input arming mode');
  const events = [];
  let settled = false;
  let resolveDone;
  let rejectDone;
  const done = new Promise((resolve, reject) => {
    resolveDone = resolve;
    rejectDone = reject;
  });
  const timer = setTimeout(() => {
    if (!settled) {
      settled = true;
      rejectDone(new Error('Timed out waiting for armed ' + mode + ' intro input submission'));
    }
  }, 12000);
  await page.exposeBinding('__qaIntroArmedInput', async (_source, info) => {
    if (settled) return { ignored:true };
    settled = true;
    clearTimeout(timer);
    const receivedHostDate = Date.now();
    const receivedHrtimeNs = String(process.hrtime.bigint());
    const row = {
      mode,
      overlayInfo:info,
      receivedHostDate,
      receivedHrtimeNs,
      countersBeforeInput:null,
      submitHostBefore:null,
      submitHostAfter:null,
      submitHrtimeBeforeNs:null,
      submitHrtimeAfterNs:null,
      error:null
    };
    row.countersBeforeInput = info?.counters || null;
    events.push(row);
    setImmediate(async () => {
      try {
        row.submitHostBefore = Date.now();
        row.submitHrtimeBeforeNs = String(process.hrtime.bigint());
        if (mode === 'pointer') {
          const rect = info?.skip?.rect;
          assert(rect && rect.width >= 44 && rect.height >= 44, 'armed pointer has a visible Skip rect');
          await page.mouse.click(rect.left + rect.width / 2, rect.top + rect.height / 2);
        } else {
          await page.keyboard.press('Enter');
        }
        row.submitHostAfter = Date.now();
        row.submitHrtimeAfterNs = String(process.hrtime.bigint());
        resolveDone(row);
      } catch (error) {
        row.error = error.stack || error.message;
        rejectDone(error);
      }
    });
    return { ok:true, scheduled:true };
  });
  return {
    mode,
    done,
    summary() {
      return events.map(row => ({
        mode:row.mode,
        receivedHostDate:row.receivedHostDate,
        submitHostBefore:row.submitHostBefore,
        submitHostAfter:row.submitHostAfter,
        countersBeforeInput:row.countersBeforeInput,
        overlayInfo:row.overlayInfo,
        error:row.error
      }));
    }
  };
}

async function dismissIntroByMeasuredSkip(page, timeout = 6000) {
  const paint = await skipPaintInfo(page);
  assertSkipPaint(paint);
  await Promise.all([
    page.locator('.academy-home-intro').waitFor({ state:'detached', timeout }),
    page.mouse.click(paint.rect.left + paint.rect.width / 2, paint.rect.top + paint.rect.height / 2)
  ]);
  return paint;
}

async function startCdpRecorder(page, dir, scenarioName) {
  const session = await page.context().newCDPSession(page);
  const frames = [];
  await session.send('Page.startScreencast', { format:'png', quality:85, everyNthFrame:1 });
  session.on('Page.screencastFrame', frame => {
    frames.push({
      data:frame.data,
      hostDate:Date.now(),
      metadata:frame.metadata || {}
    });
    if (frames.length > 360) frames.shift();
    session.send('Page.screencastFrameAck', { sessionId:frame.sessionId }).catch(() => {});
  });
  return {
    frames,
    saveClosest(date, filename) {
      assert(frames.length > 0, 'CDP screencast recorded browser frames');
      const best = frames.reduce((match, frame) => {
        const delta = Math.abs(frame.hostDate - date);
        return !match || delta < match.delta ? { frame, delta } : match;
      }, null);
      assert(best && best.delta <= 650, 'CDP frame is closely correlated with passive in-browser phase timestamp');
      const file = path.join(dir, filename);
      fs.writeFileSync(file, Buffer.from(best.frame.data, 'base64'));
      const rel = path.join(scenarioName, filename);
      report.screenshots.push(rel);
      return {
        file:rel,
        deltaMs:best.delta,
        hostDate:best.frame.hostDate,
        metadata:best.frame.metadata
      };
    },
    saveIndex(filename) {
      const file = path.join(dir, filename);
      const rows = frames.map((frame, index) => {
        const bytes = Buffer.from(frame.data, 'base64');
        return {
          index,
          hostDate:frame.hostDate,
          metadata:frame.metadata,
          sha256:sha256(bytes),
          bytes:bytes.length
        };
      });
      fs.writeFileSync(file, JSON.stringify(rows, null, 2));
      const rel = path.join(scenarioName, filename);
      report.artifacts.push(rel);
      return rel;
    },
    async stop() {
      try { await session.send('Page.stopScreencast'); } catch (_) {}
    }
  };
}

async function writeScenarioTrace(name, dir, api) {
  const trace = await introTrace(api);
  const rel = path.join(name, 'trace.json');
  fs.writeFileSync(path.join(dir, 'trace.json'), JSON.stringify(trace, null, 2));
  report.artifacts.push(rel);
  return trace;
}

async function savePhaseScreenshot(page, dir, scenarioName, filename) {
  const before = await page.evaluate(() => ({
    date:Date.now(),
    performanceNow:performance.now(),
    phase:document.querySelector('.academy-home-intro')?.dataset.phase || null,
    overlay:!!document.querySelector('.academy-home-intro'),
    readyState:document.readyState
  }));
  const file = path.join(dir, filename);
  await page.screenshot({ path:file, fullPage:false });
  const after = await page.evaluate(() => ({
    date:Date.now(),
    performanceNow:performance.now(),
    phase:document.querySelector('.academy-home-intro')?.dataset.phase || null,
    overlay:!!document.querySelector('.academy-home-intro'),
    readyState:document.readyState
  }));
  const rel = path.join(scenarioName, filename);
  report.screenshots.push(rel);
  report.artifacts.push(rel);
  return { file:rel, before, after, sha256:sha256(fs.readFileSync(file)) };
}

function assertInitialNativeSkip(trace, kind, label, armedResult) {
  const overlayAdd = trace.intro.find(row => row.kind === 'overlay-add');
  const overlayRemove = trace.intro.find(row => row.kind === 'overlay-remove');
  const commandInput = trace.inputs.find(row => row.kind === kind && (row.skipTarget || row.activeSkip));
  const activationInput = trace.inputs.find(row => row.kind === 'click' && (row.skipTarget || row.activeSkip)) || commandInput;
  assert(overlayAdd, label + ' trace records overlay insertion');
  assert(overlayRemove, label + ' trace records overlay removal');
  assert(commandInput, label + ' trace records native command input on Skip');
  assert(activationInput, label + ' trace records native activation/click for Skip');
  assert.equal(commandInput.isTrusted, true, label + ' command input is trusted native input');
  assert.equal(activationInput.isTrusted, true, label + ' activation input is trusted native input');
  assert.equal(commandInput.phase, 'tree', label + ' command input lands during initial tree phase');
  assert.equal(activationInput.phase, 'tree', label + ' activation input lands during initial tree phase');
  const eventElapsedMs = Number(commandInput.eventTimeStamp) - overlayAdd.at;
  const handlerEntryElapsedMs = activationInput.at - overlayAdd.at;
  const activationAfterCommandMs = activationInput.at - commandInput.at;
  const detachAfterActivationMs = overlayRemove.at - activationInput.at;
  assert(eventElapsedMs >= 0, label + ' trusted event timestamp happens after overlay insertion');
  assert(eventElapsedMs <= 900, label + ' native input is submitted during first-frame tree phase, not delayed success');
  assert(handlerEntryElapsedMs >= 0, label + ' handler entry happens after overlay insertion');
  assert(handlerEntryElapsedMs <= 900, label + ' handler entry is bounded from overlay insertion');
  assert(activationAfterCommandMs >= 0, label + ' activation follows the native command');
  assert(activationAfterCommandMs <= 600, label + ' handler activation is bounded from native command submission');
  assert(detachAfterActivationMs >= 0, label + ' overlay removal follows handler activation');
  assert(detachAfterActivationMs <= 750, label + ' overlay detaches promptly after handler activation');
  if (armedResult) {
    assert(armedResult.submitHostBefore >= armedResult.receivedHostDate, label + ' native command submit clock follows overlay binding receipt');
    assert(armedResult.submitHostAfter >= armedResult.submitHostBefore, label + ' native command return clock follows submit clock');
    assert(armedResult.submitHostBefore - armedResult.receivedHostDate <= 900, label + ' native command submission is bounded from overlay insertion callback');
  }
  const longTasksNearInput = (trace.longTasks || []).filter(row =>
    Number(row.startTime) >= overlayAdd.at - 250 &&
    Number(row.startTime) <= activationInput.at + 250
  );
  return {
    overlayAdd:overlayAdd.at,
    commandInput:commandInput.at,
    activationInput:activationInput.at,
    overlayRemove:overlayRemove.at,
    eventElapsedMs,
    handlerEntryElapsedMs,
    activationAfterCommandMs,
    detachAfterActivationMs,
    phase:commandInput.phase,
    commandTrusted:commandInput.isTrusted,
    activationTrusted:activationInput.isTrusted,
    commandEventTimeStamp:commandInput.eventTimeStamp,
    activationEventTimeStamp:activationInput.eventTimeStamp,
    commandSubmitHostBefore:armedResult?.submitHostBefore || null,
    commandSubmitHostAfter:armedResult?.submitHostAfter || null,
    commandReturnLagMs:armedResult ? armedResult.submitHostAfter - armedResult.submitHostBefore : null,
    commandReceivedHostDate:armedResult?.receivedHostDate || null,
    longTasksNearInput
  };
}

async function assertArmedSkipOutcome({ page, api, dir, armedInput, scenarioName, kind, label }) {
  assert(armedInput, label + ' has a pre-navigation armed input lane');
  const armedResult = await armedInput.done;
  await page.locator('.academy-home-intro').waitFor({ state:'detached', timeout:3000 }).catch(() => {});
  assert.equal(await page.locator('.academy-home-intro').count(), 0, label + ' overlay is detached after armed native input');
  assert.equal(await api('__academyHomeIntroDebug.state().skipped'), 1);
  const stateAfterSkip = await api('JSON.stringify(gameState)');
  await page.locator('#academyHomeTree [data-home-action="build-rooms"]').click();
  await page.locator('#academyBuildPicker[open]').waitFor();
  await page.locator('#academyBuildPicker [data-build-picker-close]').click();
  await page.locator('#academyBuildPicker[open]').waitFor({ state:'detached' });
  assert.equal(await api('JSON.stringify(gameState)'), stateAfterSkip, label + ' leaves gameState unchanged while browsing Build rooms after native Skip');
  const saveStacks = await api('window.__introSaveStacks');
  fs.writeFileSync(path.join(dir, 'save-stacks.json'), JSON.stringify(saveStacks, null, 2));
  const visibilitySaves = saveStacks.slice(armedResult.countersBeforeInput.save);
  assert(visibilitySaves.every(stack => stack.includes('at trailPocketVisibilityChanged ')), label + ' has no interaction-originated gameplay save; only independently traced visibility lifecycle saves are allowed');
  assert.deepEqual(await api('({save:window.__introSaveCount,cloud:window.__introCloudCount})'), {
    save:armedResult.countersBeforeInput.save + visibilitySaves.length,
    cloud:armedResult.countersBeforeInput.cloud + visibilitySaves.length
  }, label + ' has no unaccounted save/cloud churn');
  const trace = await writeScenarioTrace(scenarioName, dir, api);
  const inputTiming = assertInitialNativeSkip(trace, kind, label, armedResult);
  const overlayHostLagMs = armedResult.overlayInfo?.date ? armedResult.receivedHostDate - armedResult.overlayInfo.date : null;
  assert(overlayHostLagMs === null || (overlayHostLagMs >= 0 && overlayHostLagMs <= 900), label + ' overlay host binding lag is bounded');
  return { armedResult, inputTiming, overlayHostLagMs, traceSummary:{ intro:trace.intro.length, inputs:trace.inputs.length, longTasks:trace.longTasks?.length || 0 } };
}

function classifyResourceFailure(row) {
  const name = row.name || resourceNameFromUrl(row.url || '');
  if (name === 'api/auth/config') return { ...row, allowed:true, reason:'synthetic fixture has no auth config endpoint' };
  if (/^bird-art-cache\/cutouts\/merlin_burbz_manga(_warrior)?_/.test(name)) {
    return { ...row, allowed:true, reason:'read-only synthetic fixture leaves Merlin cutout as LFS pointer' };
  }
  if (name === introVideoRel && row.scenario === 'fresh-trailer-missing-media-recovery') {
    return { ...row, allowed:true, reason:'intentional missing-media trailer recovery fixture' };
  }
  return { ...row, allowed:false, reason:'unexpected missing or failed resource' };
}

function classifyRequestFailure(row) {
  let url = null;
  try { url = new URL(row.url); } catch (_) {}
  if (url && !['localhost', '127.0.0.1'].includes(url.hostname) && /blockedbyclient|ERR_BLOCKED_BY_CLIENT/i.test(row.failure || '')) {
    return { ...row, allowed:true, reason:'intentional external request deny by fixture' };
  }
  if (/ERR_ABORTED/i.test(row.failure || '')) {
    const name = row.name || resourceNameFromUrl(row.url || '');
    if (['assets/audio/ui-wood.mp3', 'icons/icon-192.png'].includes(name)) {
      return { ...row, allowed:true, reason:'exact optional local asset request was aborted by native skip/reload teardown, not missing media' };
    }
    if (name === introVideoRel && (/^skip-|^pointer-|^keyboard-/.test(row.scenario || '') || row.scenario === 'motion-frames' || row.scenario === 'reduced-motion' || row.scenario === 'navigation-disposal')) {
      return { ...row, allowed:true, reason:'intro dismissal or reload aborted hydrated trailer request; trailer lane verifies full media separately' };
    }
  }
  return classifyResourceFailure(row);
}

function classifyConsoleFailure(row) {
  const message = row.message || '';
  const locationUrl = row.location?.url || '';
  const locationName = locationUrl ? resourceNameFromUrl(locationUrl) : '';
  if (/ERR_BLOCKED_BY_CLIENT/.test(message)) {
    if (locationUrl && !/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(locationUrl)) {
      return { ...row, allowed:true, reason:'intentional external request deny by fixture', resource:{ url:locationUrl, name:locationName } };
    }
    return { ...row, allowed:false, reason:'blocked console error lacks external URL attribution' };
  }
  if (/status of 404|Failed to load resource/.test(message)) {
    if (!locationUrl) return { ...row, allowed:false, reason:'resource console error lacks URL attribution' };
    const exactRows = [
      ...report.missing,
      ...report.httpFailures,
      ...report.requestFailures
    ].filter(item => item.scenario === row.scenario && (item.url === locationUrl || (item.name || resourceNameFromUrl(item.url || '')) === locationName));
    if (!exactRows.length) return { ...row, allowed:false, reason:'resource console error has no exact failed-request match', resource:{ url:locationUrl, name:locationName } };
    const classified = exactRows.map(item => item.failure ? classifyRequestFailure(item) : classifyResourceFailure(item));
    const allowed = classified.find(item => item.allowed);
    if (allowed) return { ...row, allowed:true, reason:'exact resource failure classified: ' + allowed.name, resource:allowed };
    return { ...row, allowed:false, reason:'exact resource failure is not allowed', resource:classified[0] };
  }
  return { ...row, allowed:false, reason:'unexpected console error' };
}

(async () => {
  try {
    await scenario('motion-frames', completedSeed('motion'), async ({ page, api, dir, cdpRecorder }) => {
      await waitIntro(page);
      const before = await api('JSON.stringify(gameState)');
      const countsBefore = await api('({save:window.__introSaveCount,cloud:window.__introCloudCount})');
      const early = await page.__earlyIntro;
      assert.equal(early.error, undefined);
      if (early.screenshot) report.screenshots.push(early.screenshot);

      await page.locator('.academy-home-intro').waitFor({ state:'detached', timeout:25000 });
      const finalHomePath = path.join(dir, 'intro-final-home.png');
      await page.screenshot({ path:finalHomePath, fullPage:true });
      report.screenshots.push(path.join('motion-frames', 'intro-final-home.png'));
      assert.equal(await page.locator('#academyHomeTree').isVisible(), true);
      assert.equal(await api('JSON.stringify(gameState)'), before);
      assert.deepEqual(await api('({save:window.__introSaveCount,cloud:window.__introCloudCount})'), countsBefore);
      const receipt = await api('localStorage.getItem(BurbzAcademyHomeIntroCore.receiptKey(gameState.photoProfileId))');
      assert.equal(receipt, '1');
      const trace = await writeScenarioTrace('motion-frames', dir, api);
      const overlayAdd = trace.intro.find(row => row.kind === 'overlay-add');
      const zoomPhase = trace.intro.find(row => row.kind === 'phase-change' && row.phase === 'zoom');
      const interiorPhase = trace.intro.find(row => row.kind === 'phase-change' && row.phase === 'interior');
      const overlayRemove = trace.intro.find(row => row.kind === 'overlay-remove');
      assert(overlayAdd && zoomPhase && interiorPhase && overlayRemove, 'trace records overlay add, zoom, interior and remove');
      assert.equal(overlayAdd.phase, 'tree', 'passive in-browser trace records whole-tree first overlay phase');
      const treeSample = trace.intro.find(row => row.overlay && row.phase === 'tree' && row.skip?.topIsSkip);
      const zoom = trace.intro.find(row => row.overlay && row.phase === 'zoom');
      const interior = trace.intro.find(row => row.overlay && row.phase === 'interior' && row.cutawayRooms >= 1);
      assert(treeSample && treeSample.canopy >= 4 && treeSample.roots >= 1 && treeSample.treeRooms >= 1, 'trace records recognizable whole-tree art before zoom');
      const firstPaint = Object.assign({}, treeSample.skip, { activeClass:treeSample.activeClass });
      assertSkipPaint(firstPaint);
      assert(zoom, 'trace records intermediate zoom phase before cutaway');
      assert(interior, 'trace records actual matching cutaway before Home handoff');
      const initial = { phase:overlayAdd.phase, skip:!!treeSample.skip, canopy:treeSample.canopy, roots:treeSample.roots, roomRects:treeSample.treeRooms };
      const zoomMs = zoomPhase.at - overlayAdd.at;
      const interiorMs = interiorPhase.at - overlayAdd.at;
      const completeMs = overlayRemove.at - overlayAdd.at;
      assert(zoomMs > 0 && interiorMs > zoomMs && completeMs > interiorMs, 'phase ordering stays tree -> zoom -> cutaway -> Home');
      assert(completeMs <= 9000, 'production-default intro completes promptly under headless recording load');
      let frameManifest = null;
      const frameIndex = cdpRecorder ? cdpRecorder.saveIndex('cdp-frame-index.json') : null;
      frameManifest = {
        scenario:'motion-frames',
        clockSource:'passive WebM/contact sheet is recorded from before navigation; in-browser trace Date.now/performance.now records exact tree->zoom->interior->remove phase timings; CDP frame index is raw supporting evidence only',
        traceDates:{
          overlayAdd:overlayAdd.date,
          zoom:zoomPhase.date,
          interior:interiorPhase.date,
          overlayRemove:overlayRemove.date
        },
        phaseTrace:{
          tree:{ at:overlayAdd.at, date:overlayAdd.date, canopy:treeSample.canopy, roots:treeSample.roots, roomRects:treeSample.treeRooms },
          zoom:{ at:zoomPhase.at, date:zoomPhase.date },
          cutaway:{ at:interiorPhase.at, date:interiorPhase.date, cutawayRooms:interior.cutawayRooms },
          home:{ at:overlayRemove.at, date:overlayRemove.date, finalScreenshot:{ file:'motion-frames/intro-final-home.png', sha256:sha256(fs.readFileSync(finalHomePath)) } }
        },
        frameIndex,
        rawVideo:'motion-frames/browser-recording.webm',
        videoContactSheet:'motion-frames/video-contact-sheet.png'
      };
      const manifestPath = path.join(dir, 'motion-frame-manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(frameManifest, null, 2));
      report.artifacts.push(path.join('motion-frames', 'motion-frame-manifest.json'));
      const timingHookPresent = await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, '__academyHomeIntroTiming'));
      assert.equal(timingHookPresent, false, 'production page does not expose test timing override');
      const introSource = fs.readFileSync(path.join(root, 'academy_home_intro.js'), 'utf8');
      assert.match(introSource, /tree:1800,\s*interior:3800,\s*complete:4600,\s*reduced:320/, 'source retains production default intro timings');
      assert.equal(introSource.includes('__academyHomeIntroTiming'), false, 'source has no test timing hook');
      pass('VAL-INTRO-001/008 production-default motion shows whole tree, zooms to matching cutaway, lands on interactive Home without gameplay save/cloud side effects', { initial, zoom, interior, firstPaint, timings:{ zoomMs, interiorMs, completeMs, measuredUnderRecorderLoad:true }, frameManifest, sourceHash:sha256(Buffer.from(introSource)), video:'motion-frames/browser-recording.webm', videoContactSheet:'motion-frames/video-contact-sheet.png' });

      await api("switchScreen('map');switchScreen('scan');renderScanHome();");
      await page.waitForTimeout(700);
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan');
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      pass('VAL-INTRO-004 ordinary return and reload do not repeat after profile receipt');
    }, { port:8974, video:true, videoContactSheet:true, cdpFrames:true });

    await scenario('idle-control', completedSeed('idle', `
localStorage.setItem(BurbzAcademyHomeIntroCore.receiptKey(f.photoProfileId),'1');
`, 0), async ({ page, api, dir }) => {
      await page.waitForTimeout(1200);
      const before = await api('JSON.stringify(gameState)');
      const countsBefore = await api('({save:window.__introSaveCount,cloud:window.__introCloudCount})');
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      await api("switchScreen('map');switchScreen('scan');renderScanHome();");
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      assert.equal(await api('JSON.stringify(gameState)'), before);
      assert.deepEqual(await api('({save:window.__introSaveCount,cloud:window.__introCloudCount})'), countsBefore);
      pass('VAL-INTRO-008 matched idle receipt control preserves serialized game state and save/cloud counts across Home return');
    }, { port:8979 });

    await scenario('pointer-skip', completedSeed('pointer', '', 900, { lightweight:true }), async ({ page, api, dir, armedInput }) => {
      const proof = await assertArmedSkipOutcome({ page, api, dir, armedInput, scenarioName:'pointer-skip', kind:'pointerdown', label:'pointer Skip' });
      const paint = Object.assign({}, proof.armedResult.overlayInfo.skip, { activeClass:proof.armedResult.overlayInfo.activeClass });
      assertSkipPaint(paint);
      pass('VAL-INTRO-002 native pointer Skip is pre-armed before navigation, top-painted on first frame, records tree-phase input, dismisses promptly and leaves Home controls interactive', { paint, ...proof });
    }, { port:8975, armInput:'pointer' });

    await scenario('pointer-skip-repeat', completedSeed('pointerRepeat', '', 900, { lightweight:true }), async ({ page, api, dir, armedInput }) => {
      const proof = await assertArmedSkipOutcome({ page, api, dir, armedInput, scenarioName:'pointer-skip-repeat', kind:'pointerdown', label:'pointer repeat Skip' });
      const paint = Object.assign({}, proof.armedResult.overlayInfo.skip, { activeClass:proof.armedResult.overlayInfo.activeClass });
      assertSkipPaint(paint);
      pass('VAL-INTRO-002 repeat native pointer Skip proves the initial-input oracle is reproducible under timing-sensitive startup', { paint, ...proof });
    }, { port:9008, armInput:'pointer' });

    await scenario('keyboard-skip', completedSeed('keyboard', '', 900, { lightweight:true }), async ({ page, api, dir, armedInput }) => {
      const proof = await assertArmedSkipOutcome({ page, api, dir, armedInput, scenarioName:'keyboard-skip', kind:'keydown', label:'keyboard Skip' });
      const trace = await introTrace(api);
      assert.equal(trace.inputs.find(row => row.kind === 'keydown')?.key, 'Enter');
      pass('VAL-INTRO-002 keyboard Skip is pre-armed before navigation, focused immediately and native Enter records tree-phase input before usable Home', proof);
    }, { port:8976, armInput:'keyboard' });

    await scenario('skip-state-receipt', completedSeedOnce('stateReceipt', 'window.__qaCaptureIntroReceiptBefore=true;', 900, { lightweight:true }), async ({ page, api, dir, armedInput }) => {
      assert(armedInput, 'skip-state-receipt uses pre-armed native pointer input');
      const armedResult = await armedInput.done;
      await page.locator('.academy-home-intro').waitFor({ state:'detached', timeout:3000 });
      const before = await api('window.__qaReceiptBeforeSnapshot');
      assert(before && !before.error, 'page-side overlay-add snapshot captured state before native Skip');
      assert.equal(before.receipt, null, 'receipt is absent before native Skip');
      assert.equal(before.seedOnce?.wrote, true, 'seed-once fixture writes synthetic save only on first boot');
      const after = await api('window.__qaIntroReceiptSnapshot()');
      assert.equal(after.profileId, before.profileId, 'Skip receipt remains scoped to the same profile');
      assert.equal(after.receiptKey, before.receiptKey, 'receipt key is stable for the skipped profile');
      assert.equal(after.receipt, '1', 'native Skip writes durable view receipt');
      assert.equal(after.state, before.state, 'native Skip leaves live gameplay state unchanged');
      assert.equal(after.durableState, before.durableState, 'native Skip does not rewrite durable gameplay save');
      assert.equal(after.stableDurableState, before.stableDurableState, 'native Skip leaves boot-normalized durable gameplay save unchanged');
      fs.writeFileSync(path.join(dir, 'skip-save-diagnostics.json'), JSON.stringify({ before, after, stacks:await api('window.__introSaveStacks') }, null, 2));
      assert.equal(after.save, before.save, 'native Skip does not call durable gameplay save');
      assert.equal(after.cloud, before.cloud, 'native Skip does not queue cloud save');
      assert.equal(after.debug.skipped, 1, 'debug outcome records skipped dismissal');
      const trace = await writeScenarioTrace('skip-state-receipt', dir, api);
      const timing = assertInitialNativeSkip(trace, 'pointerdown', 'state receipt native Skip', armedResult);
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan');
      await page.waitForTimeout(900);
      const reloaded = await api('window.__qaIntroReceiptSnapshot()');
      assert.equal(reloaded.seedOnce?.wrote, false, 'reload did not rewrite the synthetic save fixture');
      assert.equal(reloaded.seedOnce?.value, before.seedOnce?.value, 'seed-once marker is unchanged after reload');
      assert.equal(reloaded.profileId, before.profileId, 'reload keeps the same synthetic profile');
      assert.equal(reloaded.receiptKey, before.receiptKey, 'reload checks the same profile-scoped receipt key');
      assert.equal(reloaded.receipt, '1', 'durable view receipt persists across reload');
      assert.equal(reloaded.stableState, before.stableState, 'reload preserves boot-normalized gameplay state after Skip');
      assert.equal(reloaded.stableDurableState, before.stableDurableState, 'reload preserves boot-normalized durable gameplay save after Skip');
      assert.equal(reloaded.overlayCount, 0, 'receipt prevents ordinary reload replay');
      await page.waitForTimeout(700);
      const reloadSettled = await api('window.__qaIntroReceiptSnapshot()');
      assert.equal(reloadSettled.receipt, '1', 'settled reload keeps durable view receipt');
      assert.equal(reloadSettled.stableState, before.stableState, 'settled reload preserves boot-normalized gameplay state');
      assert.equal(reloadSettled.stableDurableState, before.stableDurableState, 'settled reload preserves boot-normalized durable save');
      assert.equal(reloadSettled.save, reloaded.save, 'settled reload observes no gameplay save churn beyond reload baseline');
      assert.equal(reloadSettled.cloud, reloaded.cloud, 'settled reload observes no cloud churn beyond reload baseline');
      assert.equal(reloadSettled.overlayCount, 0, 'settled receipt state keeps intro dismissed');
      const proof = { before, after, reloaded, reloadSettled, reloadBaseline:{ save:reloaded.save, cloud:reloaded.cloud }, armedResult, timing, traceSummary:{ intro:trace.intro.length, inputs:trace.inputs.length, longTasks:trace.longTasks?.length || 0 } };
      fs.writeFileSync(path.join(dir, 'state-receipt-proof.json'), JSON.stringify(proof, null, 2));
      report.artifacts.push(path.join('skip-state-receipt', 'state-receipt-proof.json'));
      pass('VAL-INTRO-004/008 separate native Skip state and durable receipt proof preserves gameplay across dismissal and reload', proof);
    }, { port:9009, armInput:'pointer' });

    const matrix = [
      { id:'320-normal-light', viewport:{ width:320, height:568 }, appearance:'normal', colorScheme:'light', reducedMotion:'no-preference' },
      { id:'390-comic-dark', viewport:{ width:390, height:844 }, appearance:'comic', colorScheme:'dark', reducedMotion:'no-preference' },
      { id:'844-normal-light', viewport:{ width:844, height:390 }, appearance:'normal', colorScheme:'light', reducedMotion:'no-preference' },
      { id:'1280-comic-dark', viewport:{ width:1280, height:800 }, appearance:'comic', colorScheme:'dark', reducedMotion:'no-preference' }
    ];
    for (const item of matrix) {
      await scenario('skip-matrix-' + item.id, completedSeed('matrix' + item.id, `
const __qaSaved=JSON.parse(localStorage.getItem('burbz_state'));
__qaSaved.settings.appearance=${JSON.stringify(item.appearance)};
localStorage.setItem('burbz_state',JSON.stringify(__qaSaved));
`, 900), async ({ page, api, dir }) => {
        const early = await page.__earlyIntro;
        assert.equal(early.error, undefined);
        if (early.screenshot) report.screenshots.push(early.screenshot);
        await page.locator('.academy-home-intro').waitFor({ state:'detached', timeout:8000 });
        const trace = await writeScenarioTrace('skip-matrix-' + item.id, dir, api);
        const sample = trace.intro.find(row => row.overlay && row.skip?.topIsSkip && row.skip?.rect?.width >= 44 && row.skip?.rect?.height >= 44);
        assert(sample, 'passive trace records visible, hit-testable Skip for matrix ' + item.id);
        const paint = Object.assign({}, sample.skip, { activeClass:sample.activeClass });
        assertSkipPaint(paint);
        pass('VAL-INTRO-002 Skip paint/hit-test matrix ' + item.id, paint);
      }, { port:9010 + matrix.indexOf(item), viewport:item.viewport, colorScheme:item.colorScheme, reducedMotion:item.reducedMotion, earlyScreenshot:true });
    }

    await scenario('reduced-motion', completedSeed('reduced', '', 0, { lightweight:true }), async ({ page, api, dir }) => {
      const before = await api('JSON.stringify(gameState)');
      await page.waitForFunction(() => {
        const state = window.__testEval('__academyHomeIntroDebug.state()');
        return Number(state.completed || 0) >= 1 && !document.querySelector('.academy-home-intro');
      }, null, { timeout:5000 });
      const trace = await writeScenarioTrace('reduced-motion', dir, api);
      const reducedSample = trace.intro.find(row => row.phase === 'reduced');
      const overlayRemove = trace.intro.find(row => row.kind === 'overlay-remove');
      const debug = trace.debug || await api('__academyHomeIntroDebug.state()');
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
      assert(reducedSample, 'reduced-motion trace records static reduced phase');
      assert(overlayRemove, 'reduced-motion trace records overlay removal');
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      assert(Number(debug?.completed || 0) >= 1, 'reduced-motion completion is recorded');
      const reduced = {
        phase:reducedSample.phase,
        wholeTransition:reducedSample?.wholeTransition || null,
        interiorTransition:reducedSample?.interiorTransition || null,
        completed:debug?.completed || 0,
        overlayRemoveAt:overlayRemove.at
      };
      assert.equal(reduced.wholeTransition, '0s');
      assert.equal(reduced.interiorTransition, '0s');
      assert.equal(await page.locator('#academyHomeTree').isVisible(), true);
      await page.locator('#academyHomeTree [data-home-action="build-rooms"]').click();
      await page.locator('#academyBuildPicker[open]').waitFor();
      await page.locator('#academyBuildPicker [data-build-picker-close]').click();
      await page.locator('#academyBuildPicker[open]').waitFor({ state:'detached' });
      assert.equal(await api('JSON.stringify(gameState)'), before);
      pass('VAL-INTRO-003 reduced motion uses static direct transition, detaches overlay, and native Build rooms open/close leaves gameplay unchanged', reduced);
    }, { port:8977, reducedMotion:'reduce' });

    await scenario('profile-isolation', completedSeed('profileA', '', 900, { lightweight:true }), async ({ page, api }) => {
      await waitIntro(page);
      await dismissIntroByMeasuredSkip(page);
      await api(`gameState.photoProfileId=${JSON.stringify(profile('profileB'))};localStorage.setItem('burbz_state',JSON.stringify(gameState));BurbzAcademyHomeIntro.profileReplaced(gameState.photoProfileId);renderScanHome();`);
      await waitIntro(page);
      await dismissIntroByMeasuredSkip(page);
      assert.equal(await api(`localStorage.getItem(BurbzAcademyHomeIntroCore.receiptKey(${JSON.stringify(profile('profileA'))}))`), '1');
      assert.equal(await api(`localStorage.getItem(BurbzAcademyHomeIntroCore.receiptKey(${JSON.stringify(profile('profileB'))}))`), '1');
      page.once('dialog', d => d.accept());
      await page.locator('#settingsBtn').click();
      await page.locator('#resetDataBtn').click();
      await page.waitForFunction(() => __testEval('gameState.photoProfileId') && __testEval('gameState.photoProfileId') !== 'intro_profile_profileB_20260922');
      await waitIntro(page);
      await dismissIntroByMeasuredSkip(page);
      pass('VAL-INTRO-004 profile A/B receipts and native Reset Data stay isolated per photoProfileId');
    }, { port:8978 });

    for (const delay of [480, 600, 800, 1200]) {
      await scenario('timer-' + delay, completedSeed('timer' + delay, `
localStorage.setItem(BurbzAcademyHomeIntroCore.receiptKey(f.photoProfileId),'1');
`, 0), async ({ page, api, dir }) => {
        const nextProfile = profile('timer' + delay + 'fresh');
        await api(`trackAcademyHomeIntroMerlinTimer('qa-${delay}',${delay},()=>{window.__qaIntroTimerFired=${delay};});gameState.photoProfileId=${JSON.stringify(nextProfile)};BurbzAcademyHomeIntro.profileReplaced(gameState.photoProfileId);renderScanHome();`);
        const pendingSample = await page.evaluate(label => ({
          overlay:document.querySelectorAll('.academy-home-intro').length,
          pending:window.__academyHomeIntroDebug.pendingTimers(),
          label
        }), `qa-${delay}`);
        assert.equal(pendingSample.overlay, 0, 'intro waits while tracked Merlin timer is pending');
        assert(pendingSample.pending.some(row => row.label === `qa-${delay}`));
        await page.waitForFunction(({ profileId }) => {
          const state = window.__academyHomeIntroDebug?.state?.();
          const hit = state?.events?.find(event =>
            event.name === 'eligibility' &&
            event.detail?.profile === profileId &&
            event.detail?.result === 'merlin-timer' &&
            Number(event.detail?.pending) > 0
          );
          if (!hit) return false;
          window.__qaMerlinBlockedSample = {
            hit,
            trace:window.__qaTimerTrace
          };
          return true;
        }, { profileId:nextProfile }, { timeout:delay + 5000 });
        const blocked = await page.evaluate(() => window.__qaMerlinBlockedSample);
        await page.waitForFunction(delay => window.__testEval('typeof __qaIntroTimerFired !== "undefined" && __qaIntroTimerFired') === delay, delay, { timeout:delay + 5000 });
        await waitIntro(page);
        const trace = await writeScenarioTrace('timer-' + delay, dir, api);
        const label = `qa-${delay}`;
        const registered = trace.timers.find(row => row.kind === 'register' && row.label === label);
        const callbackEnd = trace.timers.find(row => row.kind === 'callback-end' && row.label === label);
        const firstOverlay = trace.intro.find(row => row.kind === 'overlay-add');
        assert(registered && callbackEnd && firstOverlay, 'timer trace records registration, callback and overlay insertion');
        assert(firstOverlay.at >= callbackEnd.at, 'overlay is inserted only after tracked timer callback ends');
        assert.equal(trace.intro.some(row => row.kind === 'overlay-add' && row.at < callbackEnd.at), false, 'no overlay insertion while timer is pending');
        await page.keyboard.press('Escape');
        await page.locator('.academy-home-intro').waitFor({ state:'detached' });
        pass('VAL-INTRO-005 safe-idle defers across tracked Merlin timer ' + delay + 'ms', { blocked, order:{ registered:registered.at, callbackEnd:callbackEnd.at, firstOverlay:firstOverlay.at } });
      }, { port:8980 + delay / 10 });
    }

    await scenario('modal-deferral', completedSeed('modal', `
localStorage.setItem(BurbzAcademyHomeIntroCore.receiptKey(f.photoProfileId),'1');
`, 0), async ({ page, api }) => {
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      await page.locator('#captureBtn').click();
      await page.locator('#scanHomeSession[open]:not([hidden])').waitFor();
      await api(`gameState.photoProfileId=${JSON.stringify(profile('modalFresh'))};BurbzAcademyHomeIntro.profileReplaced(gameState.photoProfileId);`);
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      await page.keyboard.press('Escape');
      await page.locator('#scanHomeSession[open]:not([hidden])').waitFor({ state:'detached' });
      if (await page.locator('#merlinTutorialOverlay.show').count()) {
        await page.keyboard.press('Escape');
        await page.locator('#merlinTutorialOverlay.show').waitFor({ state:'detached' });
      }
      await api("BurbzAcademyHomeIntro.schedule('modal-safe-idle');");
      await waitIntro(page);
      await dismissIntroByMeasuredSkip(page);
      pass('VAL-INTRO-005 scanner/session and Merlin prompt ownership defer intro until safe idle Home returns');
    }, { port:8993 });

    await scenario('navigation-disposal', completedSeed('nav', '', 900, { lightweight:true }), async ({ page, api }) => {
      await waitIntro(page);
      await page.reload({ waitUntil:'domcontentloaded' });
      await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan');
      assert.equal(await api('localStorage.getItem(BurbzAcademyHomeIntroCore.receiptKey(gameState.photoProfileId))'), null);
      await waitIntro(page);
      await page.keyboard.press('Escape');
      await page.locator('.academy-home-intro').waitFor({ state:'detached' });
      assert.equal(await api('__academyHomeIntroDebug.state().skipped'), 1);
      pass('VAL-INTRO-006 page navigation disposes without stale receipt; later valid Home entry can run and Escape cleans up');
    }, { port:8994 });

    await scenario('storage-failure', completedSeed('storage', `
localStorage.setItem(BurbzAcademyHomeIntroCore.receiptKey(f.photoProfileId),'1');
`), async ({ page, api }) => {
      await page.waitForTimeout(900);
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      await page.evaluate(() => {
        window.__introStorageOriginalGet = Storage.prototype.getItem;
        window.__introStorageOriginalSet = Storage.prototype.setItem;
        Storage.prototype.getItem = function(key) {
          if (String(key).startsWith('burbzAcademyHomeIntro:')) throw new Error('intro receipt read failure');
          return window.__introStorageOriginalGet.call(this, key);
        };
        Storage.prototype.setItem = function(key, value) {
          if (String(key).startsWith('burbzAcademyHomeIntro:')) throw new Error('intro receipt write failure');
          return window.__introStorageOriginalSet.call(this, key, value);
        };
      });
      await api(`gameState.photoProfileId=${JSON.stringify(profile('storageB'))};localStorage.setItem('burbz_state',JSON.stringify(gameState));BurbzAcademyHomeIntro.profileReplaced(gameState.photoProfileId);renderScanHome();`);
      const before = await api('({state:JSON.stringify(gameState),save:window.__introSaveCount,cloud:window.__introCloudCount})');
      await waitIntro(page);
      const paint = await skipPaintInfo(page);
      assertSkipPaint(paint);
      await Promise.all([
        page.locator('.academy-home-intro').waitFor({ state:'detached', timeout:6000 }),
        page.mouse.click(paint.rect.left + paint.rect.width / 2, paint.rect.top + paint.rect.height / 2)
      ]);
      assert.equal(await api('__academyHomeIntroDebug.state().skipped'), 1);
      await api('BurbzAcademyHomeIntro.schedule("storage-retry");renderScanHome();');
      await page.waitForTimeout(800);
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      assert.deepEqual(await api('({state:JSON.stringify(gameState),save:window.__introSaveCount,cloud:window.__introCloudCount})'), before);
      const failures = await api('__academyHomeIntroDebug.state().receiptFailures');
      assert(failures.some(row => row.op === 'read'));
      assert(failures.some(row => row.op === 'write'));
      pass('VAL-INTRO-007 receipt storage read/write failures remain dismissible, session no-repeat and no gameplay save/cloud churn');
    }, { port:8995 });

    await scenario('fresh-trailer-playback-deferral', freshSeed(), async ({ page, api, dir }) => {
      await page.locator('#introCutsceneOverlay.show').waitFor({ timeout:10000 });
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      const videoProbe = await page.locator('#introCutsceneVideo').evaluate(async video => {
        const waitFor = (event, timeout = 7000) => new Promise(resolve => {
          const done = value => { cleanup(); resolve(value); };
          const timer = setTimeout(() => done({ timeout:event }), timeout);
          const onEvent = () => done({ event });
          const cleanup = () => { clearTimeout(timer); video.removeEventListener(event, onEvent); };
          video.addEventListener(event, onEvent, { once:true });
        });
        if (video.readyState < 2) await Promise.race([waitFor('loadeddata'), waitFor('canplay'), waitFor('error')]);
        const frame = await new Promise(resolve => {
          if (typeof video.requestVideoFrameCallback !== 'function') return resolve(null);
          const timer = setTimeout(() => resolve({ timeout:true }), 2500);
          video.requestVideoFrameCallback((now, metadata) => {
            clearTimeout(timer);
            resolve({ now, mediaTime:metadata.mediaTime, presentedFrames:metadata.presentedFrames, width:metadata.width, height:metadata.height });
          });
        });
        const start = video.currentTime;
        await new Promise(resolve => setTimeout(resolve, 900));
        return {
          src:video.currentSrc,
          readyState:video.readyState,
          networkState:video.networkState,
          paused:video.paused,
          start,
          currentTime:video.currentTime,
          videoWidth:video.videoWidth,
          videoHeight:video.videoHeight,
          error:video.error ? { code:video.error.code, message:video.error.message } : null,
          frame
        };
      });
      assert.equal(videoProbe.error, null);
      assert(videoProbe.readyState >= 2, 'intro video reaches playback-ready state');
      assert(videoProbe.videoWidth > 0 && videoProbe.videoHeight > 0, 'intro video exposes decoded dimensions');
      assert(videoProbe.currentTime > videoProbe.start || (videoProbe.frame && !videoProbe.frame.timeout), 'intro video advances or produces a video frame');
      assert(report.assets[introVideoRel] && report.assets[introVideoRel].bytes > 1000000, 'hydrated intro MP4 fallback bytes are logged');
      assert.equal(report.assets[introVideoRel].bytes, 17742035, 'hydrated intro MP4 fallback byte count is the reviewed asset');
      assert.equal(report.assets[introVideoRel].sha256, 'dee369e10d162e837e2681f4ff98e0f1c3abb20857c01c03ca0c12b4db0eb983', 'hydrated intro MP4 fallback hash matches reviewed asset');
      await page.screenshot({ path:path.join(dir, 'trailer-playing.png'), fullPage:true });
      report.screenshots.push(path.join('fresh-trailer-playback-deferral', 'trailer-playing.png'));
      await page.locator('#introSkipBtn').click();
      await page.locator('#merlinTutorialOverlay.show').waitFor({ timeout:10000 });
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      await page.locator('#merlinTutorialReadingPause').click();
      await page.locator('#merlinTutorialOverlay.show').waitFor({ state:'detached', timeout:10000 });
      await page.waitForTimeout(700);
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      assert.equal(await api('merlinNavigationPaused'), true);
      const trace = await writeScenarioTrace('fresh-trailer-playback-deferral', dir, api);
      pass('VAL-INTRO-005 successful trailer playback and native Merlin tutorial/pause own interaction before Academy Home intro', { videoProbe, traceEvents:trace.intro.length, asset:report.assets[introVideoRel] });
    }, { port:8996, hydrateIntroVideo:true, video:true });

    await scenario('fresh-trailer-missing-media-recovery', freshSeed(), async ({ page, api, dir }) => {
      await page.locator('#introCutsceneOverlay.show').waitFor({ timeout:10000 });
      await page.locator('#introCutsceneStatus:not([hidden])').waitFor({ timeout:10000 });
      const recovery = await page.locator('#introCutsceneOverlay').evaluate(overlay => ({
        status:overlay.querySelector('#introCutsceneStatus')?.textContent || '',
        retryHidden:overlay.querySelector('#introRetryBtn')?.hidden,
        skipVisible:!!overlay.querySelector('#introSkipBtn')?.getClientRects().length,
        introOverlays:document.querySelectorAll('.academy-home-intro').length
      }));
      assert.match(recovery.status, /could not load|Tap Play/);
      assert.equal(recovery.retryHidden, false);
      assert.equal(recovery.skipVisible, true);
      assert.equal(recovery.introOverlays, 0);
      await page.screenshot({ path:path.join(dir, 'missing-media-recovery.png'), fullPage:true });
      report.screenshots.push(path.join('fresh-trailer-missing-media-recovery', 'missing-media-recovery.png'));
      await page.locator('#introSkipBtn').click();
      await page.locator('#merlinTutorialOverlay.show').waitFor({ timeout:10000 });
      assert.equal(await page.locator('.academy-home-intro').count(), 0);
      await writeScenarioTrace('fresh-trailer-missing-media-recovery', dir, api);
      pass('fresh trailer missing-media recovery is separate from successful playback and does not allow Academy Home intro overlap', recovery);
    }, { port:8997 });

    assert.deepEqual(report.pageErrors, []);
    report.resourceFailures = {
      missing:report.missing.map(classifyResourceFailure),
      http:report.httpFailures.map(classifyResourceFailure),
      request:report.requestFailures.map(classifyRequestFailure),
      console:report.consoleErrors.map(classifyConsoleFailure)
    };
    assert.deepEqual(report.resourceFailures.missing.filter(row => !row.allowed), []);
    assert.deepEqual(report.resourceFailures.http.filter(row => !row.allowed), []);
    assert.deepEqual(report.resourceFailures.request.filter(row => !row.allowed), []);
    assert.deepEqual(report.resourceFailures.console.filter(row => !row.allowed), []);
    if ((report.scenarioFilter.length === 0 || report.scenarioFilter.includes('motion-frames')) && report.motionVideoEvidence?.length) {
      const motionEvidence = report.motionVideoEvidence.find(row => row.scenario === 'motion-frames');
      assert(motionEvidence && motionEvidence.coversFullDuration, 'motion video contact artifact covers the full raw WebM duration');
    }
    report.complete = true;
  } catch (error) {
    report.failure = error.stack;
    console.error(error);
    process.exitCode = 1;
  } finally {
    report.hashes.end = collectHashes();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  }
})();
