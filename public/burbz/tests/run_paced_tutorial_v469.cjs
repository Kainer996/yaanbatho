'use strict';
// Browser evidence for the paced apprenticeship (v469): after Alderwing each
// lesson teaches one thing, then Merlin rests. Also proves Merlin's play
// flight never runs behind his care menu or under a lesson.
// Run: node tests/run_paced_tutorial_v469.cjs  (EVIDENCE_DIR to keep shots)
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright', '/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright']) {
    try { return require(id); } catch (e) {}
  }
  throw Error('Playwright is not installed');
}
const { chromium } = loadPlaywright();
const F = require('./connected_world_fixture_v386.cjs');
const root = path.resolve(__dirname, '..'), out = process.env.EVIDENCE_DIR || '/tmp/burbz-paced-tutorial-v469';
const report = { served:{}, missing:[], errors:[], checks:[], bubbles:[] };
const fixture = F.createServer({ root, port:8967, report, seed:false });
fs.mkdirSync(out, { recursive:true });
let browser, page;
const run = code => page.evaluate(code => __testEval(code), code);
const pass = text => { report.checks.push(text); console.log('PASS', text); };
const shot = name => page.screenshot({ path:path.join(out, name + '.png') });
const step = () => run('merlinTutActive ? merlinTutCurrentStep()?.id : null');
const at = id => page.waitForFunction(id => __testEval('merlinTutActive && merlinTutCurrentStep()?.id') === id, id, { timeout:20000 });
const quiet = ms => page.waitForTimeout(ms);
async function noteBubble() { const id = await step(); if (id && report.bubbles.at(-1) !== id) report.bubbles.push(id); }
async function expireRest() { await run('localStorage.setItem(BURBZ_TUTORIAL_REST_KEY,String(Date.now()-1))'); }

(async () => { try {
  await fixture.listen();
  browser = await chromium.launch({ headless:true, args:['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, serviceWorkers:'block' });
  await F.routeMap(context, report);
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(fixture.url, { waitUntil:'domcontentloaded' });
  await page.locator('#introSkipBtn').click();
  await at('lesson-0');
  // The shelter tour itself is proven elsewhere (run_hands_on_tutorial_v429);
  // start where the player is back at the Home terminal.
  await run(`gameState.tutorialFlow.alderwingIntroPhase='done';gameState.playerHome=gameState.playerHome||{};gameState.playerHome.arrival='done';saveState();merlinTutShowStep(merlinTutSequence.findIndex(i=>MERLIN_TUTORIAL_STEPS[i].id==='alderwing-desk-v395'))`);
  await at('alderwing-desk-v395'); await noteBubble();

  // ---- Lesson 1: the Birdhouse flows as one task --------------------------
  await page.locator('#merlinTutorialNext').click();
  await at('lesson-12'); await noteBubble();
  await page.locator('#screen-scan .desk-panel-academy .desk-panel-heading').click();
  await at('lesson-21'); await noteBubble();
  await shot('01-build-birdhouse');
  await page.locator('.academy-building-card[data-building="tavern"] button').first().click({ force:true });
  await page.locator('#academyTreehouse').click({ position:{ x:180, y:300 }, force:true });
  await page.waitForFunction(() => __testEval("isAcademyBuildingBuilt('tavern') && !merlinTutActive"));
  assert.deepEqual(report.bubbles, ['alderwing-desk-v395', 'lesson-12', 'lesson-21']);
  pass('Birdhouse lesson is three bubbles and flows from Home to the tree without a gap');

  // ---- Rest: nothing new starts, even on the lesson's own screen ----------
  assert.equal(await run('merlinLessonResting()'), true);
  await quiet(2500);
  assert.equal(await step(), null, 'No hand-off to the next lesson');
  assert.equal(await run('currentScreen'), 'academy', 'Merlin never drags the player to another screen');
  await page.locator('#headerHomeBtn').click();
  await quiet(1800);
  assert.equal(await run('currentScreen'), 'scan');
  assert.equal(await step(), null, 'Arriving Home during the rest starts no lesson');
  await shot('02-home-resting');
  const goal = await page.locator('#scanHomeActions [data-home-action="next-quest"]').innerText();
  assert.match(goal, /Discover a real bird/);
  pass('After the Birdhouse Merlin rests: no auto lesson on the Academy or Home, and Home shows the next goal');

  // ---- The Home goal ends the rest at once --------------------------------
  await page.locator('#scanHomeActions [data-home-action="next-quest"]').click();
  await at('lesson-31'); await noteBubble();
  assert.equal(await run('merlinLessonResting()'), false);
  await shot('03-discover-on-request');
  pass('Tapping the Home goal starts the discovery lesson straight away');
  await page.locator('#merlinTutorialTaskSkip').click();
  await page.waitForFunction(() => __testEval('!merlinTutActive'));
  await quiet(2500);
  assert.equal(await step(), null, 'Deferring discovery does not chain Meet Merlin');
  assert.equal(await run('currentScreen'), 'scan');
  assert.equal(await run('merlinLessonResting()'), true);
  pass('Discovery lesson is one bubble; afterwards Merlin rests again');

  // ---- After the rest, Meet Merlin is one tap, with no Play step ----------
  await expireRest();
  await page.locator('[data-screen="map"]').first().click({ force:true });
  await quiet(700);
  await page.locator('#headerHomeBtn').click();
  await at('lesson-3'); await noteBubble();
  await page.waitForFunction(() => !document.getElementById('merlinTutorialSpotlight').classList.contains('none'));
  const spot = await page.locator('#merlinTutorialSpotlight').boundingBox(), merlin = await page.locator('#petSprite').boundingBox();
  assert(spot.x <= merlin.x + 4 && spot.y <= merlin.y + 4 && spot.x + spot.width >= merlin.x + merlin.width - 4, 'The spotlight lights Merlin: ' + JSON.stringify({ spot, merlin }));
  await shot('04-meet-merlin');
  await page.locator('#petSprite').click({ force:true });
  await page.waitForFunction(() => __testEval('!merlinTutActive'));
  await quiet(2500);
  assert.equal(await step(), null, 'No Play lesson and no Kitchen lesson right after');
  assert.equal(await page.locator('#merlinCareMenu').isVisible(), true);
  assert.equal(await run("MERLIN_TUTORIAL_STEPS.some(s=>s.action&&s.action.event==='merlin-played')"), false);
  pass('Meet Merlin is one tap; there is no Play lesson and nothing follows it at once');

  // ---- Play: the flight closes the menu and no lesson talks over it -------
  await expireRest();
  await page.locator('#merlinPlayBtn').click({ force:true });
  await page.waitForFunction(() => document.querySelector('.merlin-flight-layer'));
  await quiet(600);
  assert.equal(await page.locator('#merlinCareMenu').isHidden(), true, 'Care menu closes on takeoff');
  await run("maybeStartMerlinChapterForScreen('scan')");
  await quiet(1200);
  assert.equal(await step(), null, 'No lesson starts during the play flight');
  await shot('05-play-flight');
  pass('Play closes the care menu, so Merlin never flies behind it, and no lesson starts mid-flight');
  await page.locator('.merlin-flight-care').click();
  await quiet(300);
  assert.equal(await page.locator('.merlin-flight-layer').count(), 0, 'Care lands Merlin first');
  assert.equal(await page.locator('#merlinCareMenu').isVisible(), true);
  await shot('06-care-after-flight');
  pass('Opening care during play lands Merlin before the menu opens');
  await page.locator('#merlinCareClose').click();

  // ---- Play waits while a lesson is on screen ------------------------------
  await expireRest();
  await page.locator('[data-screen="map"]').first().click({ force:true });
  await quiet(700);
  await page.locator('#headerHomeBtn').click();
  await at('opening-kitchen-need'); await noteBubble();
  assert.equal(await run("careForMerlin('play')"), false);
  assert.equal(await page.locator('.merlin-flight-layer').count(), 0);
  pass('Play is refused while a lesson is on screen');

  // ---- The Kitchen arc still flows as one lesson -------------------------
  await page.locator('#merlinTutorialNext').click();
  await at('opening-kitchen-attempt'); await noteBubble();
  await shot('07-kitchen-attempt');
  await run("(function(){const b=document.querySelector('.academy-building-card[data-building=\"kitchen\"] button');b&&b.click();})()");
  await page.waitForFunction(() => __testEval("merlinTutActive && merlinTutCurrentStep()?.id==='lesson-15'"), null, { timeout:15000 });
  await noteBubble();
  assert.equal(await run('merlinLessonResting()'), false);
  pass('Kitchen shortage hands straight on to sending Merlin: the arc stays one lesson');
  await shot('08-send-merlin');

  report.postAlderwingBubbles = await run(`(()=>{const start=MERLIN_TUTORIAL_STEPS.findIndex(s=>s.id==='alderwing-desk-v395');return MERLIN_TUTORIAL_STEPS.slice(start).filter(s=>['story','academy','scan','companion','kitchen_need','quests','errand','care','explore'].includes(s.chapterId)).map(s=>s.id);})()`);
  assert.equal(report.postAlderwingBubbles.length, 12);
  pass('The whole post-Alderwing opening is 12 bubbles across five lessons');
  assert.deepEqual(report.errors, []);
  report.complete = true;
} catch (e) {
  report.failure = e.stack; console.error(e); process.exitCode = 1;
  try { report.state = await run('({screen:currentScreen,mode:merlinTutMode,step:merlinTutCurrentStep()?.id,waiting:merlinTutAwaitingAction,opening:openingProgress(),flow:tutorialFlowState()})'); console.log(JSON.stringify(report.state)); await shot('failure'); } catch {}
} finally {
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2));
  await browser?.close(); fixture.server.close();
} })();
