'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright');

const BASE_URL = process.env.BURBZ_URL || 'http://localhost:8942/';
const OUT_DIR = process.argv[2] || process.env.DESTINATION_UI_EVIDENCE || path.join(process.cwd(), 'destination-ui-evidence');
const CHROME = process.env.CHROME_PATH || '/usr/bin/chromium';
const START = { lat: 51.50684, lon: -0.16490 };
const END = { lat: 51.50788, lon: -0.16246 };
const INTRO_SEEN_KEY = 'burbzIntroSeen:two-part-hf-20260729';
const INTRO_PENDING_KEY = 'burbzIntroPending:two-part-hf-20260729';
const EPOCH_KEY = 'burbz_epoch';
const FRESH_EPOCH = 'new-dawn-evil-burbz-20260720';
const TUTORIAL_VERSION = 'merlin-interactive-flow-v7-20260728';
const TUTORIAL_STATE_KEY = 'burbzTutorialState:' + TUTORIAL_VERSION;
const TUTORIAL_CHAPTERS_KEY = 'burbzTutorialChapters:' + TUTORIAL_VERSION;
const LIVE_ENDPOINTS = [
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];
const LIVE_ROUTE_OPTIONS = { timeoutMs: 25000, minRouteM: 25, maxEndpointSnapM: 80, queryPaddingM: 600, maxAirDistanceM: 12000 };

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}
function stable(value) {
  return JSON.stringify(value, Object.keys(JSON.stringify(value).split('').reduce((acc, _ch) => acc, {})).sort());
}
function stableString(value) {
  return JSON.stringify(value, function(_key, item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.keys(item).sort().reduce((acc, key) => {
      acc[key] = item[key];
      return acc;
    }, {});
  });
}
function hash(value) {
  return crypto.createHash('sha256').update(stableString(value)).digest('hex');
}
async function waitForApp(page) {
  await page.waitForFunction(() => !!(window.__burbzDestinationDebug && window.BurbzDestinationQuestUI && window.BurbzDestinationStateCore), null, { timeout: 45000 });
}
async function screenshot(page, name) {
  console.log('SCREENSHOT',name);
  const file = path.join(OUT_DIR, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}
async function clickMain(page) {
  if (!await page.locator('#screen-map.active').count()) {
    await page.locator('.nav-item[data-screen="map"]').click({ timeout: 20000 });
    await page.waitForSelector('#screen-map.active', { timeout: 15000 });
  }
  await page.locator('#mapQuestShowBtn').click({ timeout: 20000 });
  await page.waitForSelector('#destinationQuestSheet.open', { timeout: 15000 });
}
async function waitForPreviewSettled(page) {
  await page.waitForFunction(() => {
    const debug = window.__burbzDestinationDebug;
    const state = debug && debug.state && debug.state();
    return state && (state.phase === 'preview' || state.phase === 'error');
  }, null, { timeout: 70000 });
  return page.evaluate(() => window.__burbzDestinationDebug.state());
}
async function installOneShotStorageFailure(page, entryId) {
  await page.evaluate(entryId => {
    const original = Storage.prototype.setItem;
    let used = false;
    Storage.prototype.setItem = function(key, value) {
      if (!used && key === 'burbz_state' && (!entryId || JSON.parse(value).destinationQuests?.active?.receipts?.encounters?.[entryId])) {
        used = true;
        Storage.prototype.setItem = original;
        throw new Error('destination injected storage failure');
      }
      return original.apply(this, arguments);
    };
  }, entryId);
}
async function closeOpenDialogs(page) {
  await page.evaluate(() => {
    const npcOk = document.querySelector('#wqNpcDialog .wq-npc-ok');
    if (npcOk) npcOk.click();
    document.getElementById('wqNpcDialog')?.remove();
    document.querySelectorAll('dialog[open]').forEach(dialog => {
      try { dialog.close(); } catch (_) { dialog.removeAttribute('open'); }
    });
  });
}
async function resourceSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__burbzQuestDebug && window.__burbzQuestDebug.getState && window.__burbzQuestDebug.getState();
    return {
      xp: Number(state && state.player && state.player.xp) || 0,
      level: Number(state && state.player && state.player.level) || 1,
      coins: Number(state && state.player && state.player.coins) || 0,
      items: Object.assign({}, state && state.inventory && state.inventory.items || {}),
      discoveredSpecies: Object.assign({}, state && state.discoveredSpecies || {})
    };
  });
}
function quoteDelta(before, after, quote) {
  const loot = {};
  for (const item of quote.loot || []) {
    loot[item.id] = ((after.items && after.items[item.id]) || 0) - ((before.items && before.items[item.id]) || 0);
  }
  return {
    xp: after.xp - before.xp,
    levelBefore: before.level,
    levelAfter: after.level,
    coins: after.coins - before.coins,
    loot
  };
}
async function fillManual(page, start = START, end = END) {
  await page.locator('#destinationStartLat').fill(String(start.lat));
  await page.locator('#destinationStartLon').fill(String(start.lon));
  await page.locator('#destinationEndLat').fill(String(end.lat));
  await page.locator('#destinationEndLon').fill(String(end.lon));
}
async function previewFromInputs(page) {
  await page.locator('[data-destination-preview]').click();
  return waitForPreviewSettled(page);
}
async function exposedMapPoint(page, biasX, biasY) {
  return page.evaluate(({ biasX, biasY }) => {
    const map = document.getElementById('burbzLiveMap');
    if (!map) return null;
    const rect = map.getBoundingClientRect();
    const xs = [biasX, 0.52, 0.66, 0.78, 0.35, 0.88, 0.18].map(f => rect.left + rect.width * f);
    const ys = [biasY, 0.12, 0.16, 0.22, 0.28, 0.34].map(f => rect.top + rect.height * f);
    for (const y of ys) {
      for (const x of xs) {
        const el = document.elementFromPoint(x, y);
        if (!el) continue;
        if (el === map || el.closest && el.closest('#burbzLiveMap')) {
          return { x, y, tag: el.tagName, id: el.id || '', className: String(el.className || '') };
        }
      }
    }
    return { x: rect.left + rect.width * biasX, y: rect.top + rect.height * biasY, tag: 'fallback' };
  }, { biasX, biasY });
}

(async () => {
  mkdirp(OUT_DIR);
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const report = {
    startedAt,
    baseUrl: BASE_URL,
    selectedCoordinates: { start: START, end: END },
    screenshots: {},
    console: [],
    network: [],
    assertions: {}
  };
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
      geolocation: { latitude: START.lat, longitude: START.lon, accuracy: 8 },
      permissions: ['geolocation']
    });
    if(process.env.DESTINATION_MAP_FIXTURE){
      await require('./connected_world_fixture_v386.cjs').routeMap(context,report);
      await context.route(/overpass|tiles\.mapterhorn\.com/,route=>route.continue());
      report.limits='Synthetic base-map tiles for bounded software rendering; native map taps and emulated browser GPS at fixed public Hyde Park coordinates, real configured Overpass/elevation providers. No user location.';
    }
    const page = await context.newPage();
    page.setDefaultTimeout(25000);page.setDefaultNavigationTimeout(60000);
    page.on('pageerror',e=>{(report.pageErrors||=[]).push(e.message);console.log('PAGEERROR',e.message)});
    page.on('console', msg => {
      if (['error', 'warning'].includes(msg.type())) report.console.push({ type: msg.type(), text: msg.text().slice(0, 500) });
    });
    page.on('request', req => {
      if (/overpass|mapterhorn|terrarium/i.test(req.url())) {
        report.network.push({ event: 'request', method: req.method(), url: req.url(), postHash: req.postData() ? hash(req.postData()) : null });
      }
    });
    page.on('response', res => {
      if (/overpass|mapterhorn|terrarium/i.test(res.url())) {
        report.network.push({ event: 'response', status: res.status(), url: res.url() });
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForApp(page);
    await page.evaluate(([seenKey, pendingKey, epochKey, epoch, tutStateKey, tutChaptersKey, tutVersion]) => {
      const state = window.__burbzQuestDebug && window.__burbzQuestDebug.getState && window.__burbzQuestDebug.getState();
      localStorage.clear();
      if (state) {
        state.discoveredSpecies = {};
        state.tavernPatrons = [];
        state.player = state.player || {};
        state.player.xp = 0;
        state.player.level = 1;
        state.player.coins = 100;
        state.inventory = state.inventory || {};
        state.inventory.items = {};
        state.destinationQuests = undefined;
        localStorage.setItem('burbz_state', JSON.stringify(state));
      }
      localStorage.setItem(epochKey, epoch);
      localStorage.setItem(seenKey, '1');
      localStorage.removeItem(pendingKey);
      localStorage.setItem(tutStateKey, JSON.stringify({ version: tutVersion, status: 'completed', mode: 'story', careLessonVersion: 2, currentStep: 0, stepId: null, updatedAt: new Date().toISOString() }));
      localStorage.setItem(tutChaptersKey, JSON.stringify(['story', 'explore']));
      if (navigator.serviceWorker) return navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(reg => reg.unregister())));
    }, [INTRO_SEEN_KEY, INTRO_PENDING_KEY, EPOCH_KEY, FRESH_EPOCH, TUTORIAL_STATE_KEY, TUTORIAL_CHAPTERS_KEY, TUTORIAL_VERSION]);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForApp(page);
    await page.locator('.nav-item[data-screen="map"]').click();
    await page.waitForFunction(() => window.__burbzDestinationDebug.controller() && document.querySelector('#burbzLiveMap canvas'));
    await page.waitForTimeout(1200);
    await clickMain(page);
    await page.locator('[data-destination-gps]').click();
    const gps=await page.evaluate(()=>__burbzDestinationDebug.state());
    assert.equal(gps.start.lat,START.lat);assert.equal(gps.start.lon,START.lon);assert.notEqual(gps.startSource,'manual');report.assertions.actualBrowserGPS=gps.start;
    report.screenshots.open = await screenshot(page, 'destination-main-open.png');

    await page.waitForSelector('#burbzLiveMap canvas', { timeout: 30000 });
    await page.locator('[data-destination-pick="start"]').click();
    const startTap = await exposedMapPoint(page, 0.42, 0.16);
    assert.ok(startTap, 'map has a hit-testable point');
    await page.mouse.move(startTap.x, startTap.y);
    await page.mouse.down();
    await page.mouse.move(startTap.x + 30, startTap.y + 4);
    await page.mouse.up();
    await page.mouse.click(startTap.x, startTap.y);
    await page.waitForFunction(() => {
      const state = window.__burbzDestinationDebug.state();
      return state && state.start && state.startSource === 'map-tap' && !state.pending;
    }, null, { timeout: 15000 });
    await page.locator('[data-destination-pick="end"]').click();
    const endTap = await exposedMapPoint(page, 0.58, 0.18);
    await page.mouse.click(endTap.x, endTap.y);
    await page.waitForFunction(() => {
      const state = window.__burbzDestinationDebug.state();
      return state && state.end && state.endSource === 'map-tap' && !state.pending;
    }, null, { timeout: 15000 });
    report.assertions.mapTapState = await page.evaluate(({ startTap, endTap }) => {
      const state = window.__burbzDestinationDebug.state();
      return { startSource: state.startSource, endSource: state.endSource, startTap, endTap, mapPick: window.__burbzDestinationDebug.controller().mapPickState() };
    }, { startTap, endTap });
    report.screenshots.mapTaps = await screenshot(page, 'destination-map-taps.png');

    // Ordinary configured provider list and routing bounds: no endpoint override.
    await page.evaluate(() => window.__burbzDestinationDebug.routeOptions({maxAirDistanceM:12000}));
    await fillManual(page);
    const preview = await previewFromInputs(page);
    if (preview.phase !== 'preview') throw new Error('Live provider preview failed: ' + JSON.stringify(preview.error));
    report.assertions.livePreview = await page.evaluate(() => {
      const state = window.__burbzDestinationDebug.state();
      const route = state.preview && state.preview.route;
      const quote = state.preview && state.preview.quote;
      const provider = state.preview && (state.preview.provider || route.provider);
      return {
        phase: state.phase,
        start: state.start,
        end: state.end,
        routeLengthM: route.lengthM,
        pointCount: route.points.length,
        firstPoint: route.points[0],
        lastPoint: route.points[route.points.length - 1],
        fingerprint: route.routeFingerprint,
        provider: provider && { endpoint: provider.endpoint, status: provider.status, bodyHash: provider.bodyHash, query: provider.query },
        quote: { xp: quote.xp, coins: quote.coins, loot: quote.loot, elevation: quote.elevation, difficulty: quote.difficulty },
        entries: state.preview.record.entries.map(entry => ({ id: entry.id, kind: entry.kind, name: entry.label || entry.name || entry.commonName, distanceM: entry.route.distanceM }))
      };
    });
    assert.equal(report.assertions.livePreview.phase, 'preview');
    assert.ok(report.assertions.livePreview.pointCount > 1, 'preview uses route geometry');
    assert.ok(report.assertions.livePreview.provider.bodyHash, 'provider hash is exposed');
    assert.ok(report.assertions.livePreview.entries.some(entry => entry.kind === 'building'));
    assert.ok(report.assertions.livePreview.entries.some(entry => entry.kind === 'character'));
    assert.ok(report.assertions.livePreview.entries.some(entry => entry.kind === 'bird'));
    report.screenshots.preview = await screenshot(page, 'destination-live-preview.png');

    await page.evaluate(() => window.__burbzDestinationDebug.routeOptions({ maxAirDistanceM: 20 }));
    await fillManual(page);
    const failed = await previewFromInputs(page);
    report.assertions.failureRecovery = {
      failedPhase: failed.phase,
      error: failed.error,
      beginDisabledAfterFailure: await page.locator('[data-destination-begin]').isDisabled()
    };
    assert.equal(failed.phase, 'error');
    assert.equal(report.assertions.failureRecovery.beginDisabledAfterFailure, true);
    report.screenshots.failure = await screenshot(page, 'destination-failure-recovery.png');

    // Ordinary configured provider list and routing bounds: no endpoint override.
    await page.evaluate(() => window.__burbzDestinationDebug.routeOptions({maxAirDistanceM:12000}));
    await fillManual(page);
    const recovered = await previewFromInputs(page);
    if (recovered.phase !== 'preview') throw new Error('Recovery preview failed: ' + JSON.stringify(recovered.error));
    const begin = await page.evaluate(() => window.__burbzDestinationDebug.begin());
    report.assertions.begin = {
      result: begin,
      activeBeforeReload: await page.evaluate(() => window.__burbzDestinationDebug.active())
    };
    assert.equal(begin.status, 'committed');
    const activeBefore = report.assertions.begin.activeBeforeReload;
    fs.writeFileSync(path.join(OUT_DIR,'banked-plan.json'),JSON.stringify(activeBefore,null,2));
    assert.ok(activeBefore && activeBefore.entries && activeBefore.entries.length >= 3, 'active plan has complete entries');
    report.assertions.begin.activeHash = hash(activeBefore);
    report.screenshots.active = await screenshot(page, 'destination-active-saved.png');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForApp(page);
    const activeAfterReload = await page.evaluate(() => window.__burbzDestinationDebug.active());
    report.assertions.reload = {
      activeHash: hash(activeAfterReload),
      sameAsBefore: hash(activeAfterReload) === report.assertions.begin.activeHash,
      entryOrder: (activeAfterReload.entries || []).map(entry => entry.id)
    };
    assert.equal(report.assertions.reload.sameAsBefore, true, 'reload preserves exact active destination plan');
    report.screenshots.reload = await screenshot(page, 'destination-reload-active.png');

    const swReady = await page.evaluate(() => navigator.serviceWorker ? Promise.race([
      navigator.serviceWorker.ready.then(() => true),
      new Promise(resolve => setTimeout(() => resolve(false), 30000))
    ]) : false);
    report.assertions.serviceWorkerReady = swReady;
    if (swReady) {
      await context.setOffline(true);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await waitForApp(page);
      const activeOffline = await page.evaluate(() => window.__burbzDestinationDebug.active());
      report.assertions.offlineReload = {
        activeHash: hash(activeOffline),
        sameAsBefore: hash(activeOffline) === report.assertions.begin.activeHash
      };
      assert.equal(report.assertions.offlineReload.sameAsBefore, true, 'offline reload preserves banked destination plan');
      report.screenshots.offlineReload = await screenshot(page, 'destination-offline-reload.png');
      await context.setOffline(false);
    }

    await page.evaluate(() => window.__burbzDestinationDebug.open());
    let finishDialog = null;
    page.once('dialog', async dialog => {
      finishDialog = dialog.message();
      await dialog.dismiss();
    });
    await page.locator('[data-destination-finish]').click({ timeout: 15000 });
    await page.waitForTimeout(250);
    report.assertions.finishCancel = {
      dialog: finishDialog,
      phaseAfterCancel: await page.evaluate(() => window.__burbzDestinationDebug.active() && window.__burbzDestinationDebug.active().phase)
    };
    assert.equal(report.assertions.finishCancel.phaseAfterCancel, 'active');

    await installOneShotStorageFailure(page);
    const failedFinish = await page.evaluate(() => window.__burbzDestinationDebug.finish({ gpsTicks: 0, usedSuggestedTrack: false }));
    report.assertions.finishStorageFailure = {
      result: failedFinish,
      phaseAfterFailure: await page.evaluate(() => window.__burbzDestinationDebug.active() && window.__burbzDestinationDebug.active().phase)
    };
    assert.equal(failedFinish.status, 'failed');
    assert.equal(report.assertions.finishStorageFailure.phaseAfterFailure, 'active');
    const finishRetry = await page.evaluate(() => window.__burbzDestinationDebug.finish({ gpsTicks: 0, usedSuggestedTrack: false }));
    report.assertions.honorFinish = {
      result: finishRetry,
      active: await page.evaluate(() => window.__burbzDestinationDebug.active()),
      timelineIds: await page.evaluate(() => window.__burbzDestinationDebug.timeline().map(entry => entry.id))
    };
    assert.equal(finishRetry.status, 'committed');
    assert.equal(report.assertions.honorFinish.active.phase, 'review');
    report.screenshots.review = await screenshot(page, 'destination-review-ready.png');

    const academyBeforeGuest=await page.evaluate(()=>JSON.stringify(__burbzQuestDebug.getState().academy));
    const timelineEntries = report.assertions.honorFinish.active.entries;
    const building = timelineEntries.find(entry => entry.kind === 'building');
    const character = timelineEntries.find(entry => entry.kind === 'character');
    const birds = timelineEntries.filter(entry => entry.kind === 'bird');
    assert.ok(building, 'banked building exists');
    assert.ok(character, 'banked character exists');
    assert.equal(birds.length >= 3, true, 'three common bird meetings exist');

    await installOneShotStorageFailure(page, building.id);
    const failedBuilding = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'open-building-fail' }), building.id);
    report.assertions.buildingFailure = {
      result: failedBuilding,
      receiptAfterFailure: await page.evaluate(entryId => {
        const active = window.__burbzDestinationDebug.active();
        return active && active.receipts && active.receipts.encounters && active.receipts.encounters[entryId] || null;
      }, building.id)
    };
    assert.equal(failedBuilding.status, 'failed');
    assert.equal(report.assertions.buildingFailure.receiptAfterFailure, null);
    const openedBuilding = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'open-building' }), building.id);
    assert.equal(openedBuilding.status, 'committed');
    report.assertions.buildingVisit = {
      result: openedBuilding,
      currentScreen: await page.evaluate(() => document.querySelector('.screen.active') && document.querySelector('.screen.active').id),
      receipt: await page.evaluate(entryId => {
        const active = window.__burbzDestinationDebug.active();
        return active.receipts.encounters[entryId];
      }, building.id)
    };
    assert.equal(await page.locator('#villageWalk.vr-inside').count(),1);
    assert.equal(await page.locator('#prerequisiteGuide.show').count(),0);
    await page.waitForFunction(()=>BurbzVillageWalk.diagnostics().frames>3);
    report.screenshots.building = await screenshot(page, 'destination-building-native.png');
    await page.locator('.vw-look').focus();await page.keyboard.down('KeyW');
    try {await page.locator('.vr-service').waitFor({state:'visible',timeout:12000});} finally {await page.keyboard.up('KeyW');}
    await page.locator('.vr-service').click();
    assert.equal(await page.locator('#screen-birdex.active,#screen-academy-room.active').count(),1);
    assert.equal(await page.locator('#prerequisiteGuide.show').count(),0);
    report.screenshots.buildingAction=await screenshot(page,'destination-building-service.png');
    assert.equal(await page.evaluate(()=>JSON.stringify(__burbzQuestDebug.getState().academy)),academyBeforeGuest,'Guest visit grants no Academy ownership');

    const spokenCharacter = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'speak-character' }), character.id);
    assert.equal(spokenCharacter.status, 'committed');
    report.assertions.characterVisit = {
      result: spokenCharacter,
      receipt: await page.evaluate(entryId => window.__burbzDestinationDebug.active().receipts.encounters[entryId], character.id)
    };
    report.screenshots.character = await screenshot(page, 'destination-character-dialogue.png');

    const firstBird = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'meet-bird-1' }), birds[0].id);
    const secondBird = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'meet-bird-2' }), birds[1].id);
    assert.equal(firstBird.status, 'committed');
    assert.equal(secondBird.status, 'committed');
    await installOneShotStorageFailure(page);
    const failedThirdBird = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'meet-bird-3-fail' }), birds[2].id);
    const speciesKey = await page.evaluate(species => window.BurbzDestinationStateCore.speciesKey(species), birds[2].species || birds[2].commonName);
    report.assertions.thirdBirdFailure = {
      result: failedThirdBird,
      speciesKey,
      discoveredAfterFailure: await page.evaluate(key => !!(window.__burbzQuestDebug.getState().discoveredSpecies || {})[key], speciesKey)
    };
    assert.equal(failedThirdBird.status, 'failed');
    assert.equal(report.assertions.thirdBirdFailure.discoveredAfterFailure, false);
    const thirdBird = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'meet-bird-3' }), birds[2].id);
    report.assertions.birdMeetings = {
      first: firstBird,
      second: secondBird,
      third: thirdBird,
      meeting: thirdBird.value && thirdBird.value.meeting,
      discoveredAfterRetry: await page.evaluate(key => !!(window.__burbzQuestDebug.getState().discoveredSpecies || {})[key], speciesKey)
    };
    assert.equal(thirdBird.status, 'committed');
    assert.equal(report.assertions.birdMeetings.discoveredAfterRetry, true);
    assert.equal(report.assertions.birdMeetings.meeting.eligibleForUnlock, true);
    report.screenshots.birdUnlock = await screenshot(page, 'destination-bird-unlock.png');

    const duplicateBird = await page.evaluate(entryId => window.__burbzDestinationDebug.openEntry(entryId, { choiceId: 'meet-bird-3-again' }), birds[2].id);
    report.assertions.duplicateReview = {
      result: duplicateBird,
      meetingCount: await page.evaluate(key => window.__burbzQuestDebug.getState().destinationQuests.meetings[key].encounterIds.length, speciesKey)
    };
    assert.equal(duplicateBird.status, 'duplicate');
    assert.equal(report.assertions.duplicateReview.meetingCount, 3);

    const beforeComplete = await resourceSnapshot(page);
    const bankedQuote = await page.evaluate(() => JSON.parse(JSON.stringify(window.__burbzDestinationDebug.active().quote)));
    await installOneShotStorageFailure(page);
    const failedComplete = await page.evaluate(() => window.__burbzDestinationDebug.complete({ confirmed: true }));
    const afterFailedComplete = await resourceSnapshot(page);
    report.assertions.completionFailure = {
      result: failedComplete,
      phaseAfterFailure: await page.evaluate(() => window.__burbzDestinationDebug.active() && window.__burbzDestinationDebug.active().phase),
      resourcesUnchanged: hash(beforeComplete) === hash(afterFailedComplete)
    };
    assert.equal(failedComplete.status, 'failed');
    assert.equal(report.assertions.completionFailure.phaseAfterFailure, 'review');
    assert.equal(report.assertions.completionFailure.resourcesUnchanged, true);
    const completed = await page.evaluate(() => window.__burbzDestinationDebug.complete({ confirmed: true }));
    const afterComplete = await resourceSnapshot(page);
    report.assertions.completion = {
      result: completed,
      previewQuote: report.assertions.livePreview.quote,
      bankedQuote,
      paidDelta: quoteDelta(beforeComplete, afterComplete, bankedQuote),
      archiveCount: await page.evaluate(() => window.__burbzDestinationDebug.archive().length),
      activeAfterComplete: await page.evaluate(() => window.__burbzDestinationDebug.active())
    };
    assert.equal(completed.status, 'committed');
    assert.equal(report.assertions.completion.activeAfterComplete, null);
    assert.equal(report.assertions.completion.paidDelta.xp, bankedQuote.xp);
    assert.equal(report.assertions.completion.paidDelta.coins, bankedQuote.coins);
    for (const item of bankedQuote.loot || []) {
      assert.equal(report.assertions.completion.paidDelta.loot[item.id], item.qty);
    }
    await page.evaluate(() => window.__burbzDestinationDebug.open());
    await closeOpenDialogs(page);
    await page.locator('[data-destination-archive]').first().click({ timeout: 15000 });
    report.assertions.archiveReopen = {
      archiveIds: await page.evaluate(() => window.__burbzDestinationDebug.archive().map(record => record.id)),
      visibleRows: await page.locator('[data-destination-archive-entry]').count()
    };
    assert.equal(report.assertions.archiveReopen.visibleRows >= timelineEntries.length, true);
    report.screenshots.archive = await screenshot(page, 'destination-archive-reopen.png');

    await page.evaluate(() => {
      const activeHash = JSON.stringify(window.__burbzDestinationDebug.active());
      const controller = window.__burbzDestinationDebug.controller();
      controller.openPlanner();
      window.__dqResolveStaleProvider = null;
      controller.setRouteOptions({
        endpoints: ['https://fixture.invalid/overpass'],
        timeoutMs: 20000,
        fetchFn: (_url, _init) => new Promise(resolve => {
          window.__dqResolveStaleProvider = () => resolve({
            ok: true,
            status: 200,
            headers: { get: () => null },
            text: async () => JSON.stringify({ remark: 'fixture partial after cancel', elements: [] })
          });
        })
      });
      controller.setManualPoints({ lat: 47.37645, lon: 8.54145 }, { lat: 47.37725, lon: 8.54275 });
      window.__dqBeforeStaleActiveHash = activeHash;
      window.__dqStalePromise = controller.preview();
    });
    await page.waitForFunction(() => typeof window.__dqResolveStaleProvider === 'function', null, { timeout: 5000 });
    await page.evaluate(() => {
      const controller = window.__burbzDestinationDebug.controller();
      controller.cancel('browser-stale-cancel');
      window.__dqResolveStaleProvider();
    });
    await page.evaluate(() => window.__dqStalePromise);
    report.assertions.staleCancel = await page.evaluate(() => {
      const state = window.__burbzDestinationDebug.state();
      return {
        phase: state.phase,
        preview: state.preview,
        activeUnchanged: JSON.stringify(window.__burbzDestinationDebug.active()) === window.__dqBeforeStaleActiveHash,
        mapPick: window.__burbzDestinationDebug.controller().mapPickState()
      };
    });
    assert.equal(report.assertions.staleCancel.preview, null);
    assert.equal(report.assertions.staleCancel.activeUnchanged, true);

    await context.close();

    const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const denied = await deniedContext.newPage();
    await denied.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForApp(denied);
    await denied.evaluate(([seenKey, pendingKey, epochKey, epoch, tutStateKey, tutChaptersKey, tutVersion]) => {
      const state = window.__burbzQuestDebug && window.__burbzQuestDebug.getState && window.__burbzQuestDebug.getState();
      localStorage.clear();
      if (state) localStorage.setItem('burbz_state', JSON.stringify(state));
      localStorage.setItem(epochKey, epoch);
      localStorage.setItem(seenKey, '1');
      localStorage.removeItem(pendingKey);
      localStorage.setItem(tutStateKey, JSON.stringify({ version: tutVersion, status: 'completed', mode: 'story', careLessonVersion: 2, currentStep: 0, stepId: null, updatedAt: new Date().toISOString() }));
      localStorage.setItem(tutChaptersKey, JSON.stringify(['story', 'explore']));
    }, [INTRO_SEEN_KEY, INTRO_PENDING_KEY, EPOCH_KEY, FRESH_EPOCH, TUTORIAL_STATE_KEY, TUTORIAL_CHAPTERS_KEY, TUTORIAL_VERSION]);
    await denied.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForApp(denied);
    await clickMain(denied);
    await denied.locator('[data-destination-gps]').click();
    report.assertions.deniedGps = await denied.evaluate(() => {
      const state = window.__burbzDestinationDebug.state();
      return { start: state.start, error: state.error };
    });
    assert.equal(report.assertions.deniedGps.start, null);
    assert.equal(report.assertions.deniedGps.error.code, 'gps-unavailable');
    report.screenshots.deniedGps = await screenshot(denied, 'destination-denied-gps.png');
    await deniedContext.close();

    report.finishedAt = new Date().toISOString();
    report.ok = true;
    fs.writeFileSync(path.join(OUT_DIR, 'destination-ui-v431-browser-proof.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch(err => {
  mkdirp(OUT_DIR);
  const failed = { ok: false, error: err && (err.stack || err.message) || String(err), finishedAt: new Date().toISOString() };
  fs.writeFileSync(path.join(OUT_DIR, 'destination-ui-v431-browser-proof.failed.json'), JSON.stringify(failed, null, 2));
  console.error(err && (err.stack || err.message) || err);
  process.exit(1);
});
