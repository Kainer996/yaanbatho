#!/usr/bin/env node
// Browser evidence: Merlin's feeding lesson, driven end to end in Chromium.
//
// Regression guard for the reported glitch — the tutorial reached "Feed me!"
// with the care menu closed and nothing to tap. Two causes, both fixed:
//   1. Pressing Next on Merlin's own bubble bubbled out to the
//      close-on-outside-tap handler and shut the menu mid-lesson.
//   2. renderMerlinCareMenu replaced #merlinDietGuidance with an id-less div,
//      so the diet step spotlighted nothing after the first render.
//
// This walks the real story chapter: tap Merlin -> menu opens -> his needs ->
// his diet -> Feed is on screen, spotlit and the topmost element at its own
// centre -> feeding actually advances the tutorial and drops his hunger.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_merlin_care_lesson_evidence.js
// Exits non-zero if any check fails.

// Drives the REAL Burbz tutorial in Chromium and proves the feeding lesson
// works: tap Merlin -> menu opens -> read his needs -> read his diet ->
// the Feed button is visible and spotlit -> feeding advances the tutorial.
// playwright-core is not a repo dependency; resolve it from wherever it lives.
function requirePlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE_PATH, 'playwright-core', 'playwright'].filter(Boolean);
  for (const id of candidates) {
    try { return require(id); } catch (e) {}
  }
  console.error('playwright-core not found. Install it, or set PLAYWRIGHT_CORE_PATH to its module path.');
  process.exit(3);
}
const { chromium } = requirePlaywright();

const EXE = process.env.CHROMIUM_EXECUTABLE_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const URL = process.env.BURBZ_URL || 'http://127.0.0.1:8765/index.html';
const SHOT = process.env.BURBZ_SCREENSHOT || '';

const log = (...a) => console.log(...a);
let failures = 0;
function check(name, cond, extra) {
  if (cond) log(`  PASS  ${name}`);
  else { failures++; log(`  FAIL  ${name}${extra ? ' :: ' + extra : ''}`); }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2,
    permissions: [],
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failures++; log('  PAGE ERROR:', e.message); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // The fresh-start epoch wipes any pre-seeded flags, so skip the intro video
  // the way a player does.
  await page.waitForSelector('#introCutsceneOverlay.show', { timeout: 20000 });
  await page.click('#introSkipBtn');

  const step = async () => page.evaluate(() => ({
    active: window.merlinTutActive === undefined ? null : null,
    title: document.getElementById('merlinTutorialTitle')?.textContent,
    counter: document.getElementById('merlinTutorialCounter')?.textContent,
    doText: document.getElementById('merlinTutorialDoText')?.textContent,
    interactive: document.getElementById('merlinTutorialOverlay')?.classList.contains('interactive'),
    nextHidden: document.getElementById('merlinTutorialNext')?.style.display === 'none',
    menuHidden: document.getElementById('merlinCareMenu')?.hidden,
    spot: (() => {
      const s = document.getElementById('merlinTutorialSpotlight');
      if (!s || s.classList.contains('none')) return null;
      return { w: parseFloat(s.style.width), h: parseFloat(s.style.height), top: parseFloat(s.style.top), left: parseFloat(s.style.left) };
    })(),
  }));

  await page.waitForSelector('#merlinTutorialOverlay.show', { timeout: 20000 });
  await page.waitForTimeout(900);

  log('\n--- Walking the story chapter to the "tap Merlin" step ---');
  let s = await step();
  log(`  step ${s.counter} "${s.title}"`);
  let guard = 0;
  while (!s.interactive && guard++ < 12) {
    await page.click('#merlinTutorialNext');
    await page.waitForTimeout(420);
    s = await step();
    log(`  step ${s.counter} "${s.title}"${s.interactive ? '  [ACTION: ' + s.doText + ']' : ''}`);
  }
  check('reaches an interactive step', s.interactive, JSON.stringify(s));
  check('the action step hides Next', s.nextHidden);
  check('care menu still closed before the tap', s.menuHidden !== false);

  log('\n--- The player taps Merlin on his branch ---');
  // Merlin sways on his branch forever, so Playwright never calls him "stable".
  // Hit-test by hand instead: whatever is on top at his centre is what a finger
  // would hit — that proves the shields are not covering him.
  const topAtSprite = await page.evaluate(() => {
    const b = document.getElementById('petSprite');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { id: el?.id, cls: el?.className?.toString?.().slice(0, 40), isSprite: el === b || b.contains(el) };
  });
  check('Merlin is the topmost element at his centre (tappable through the dim)', topAtSprite.isSprite, JSON.stringify(topAtSprite));
  await page.click('#petSprite', { force: true });
  await page.waitForTimeout(1200);
  s = await step();
  log(`  step ${s.counter} "${s.title}"`);
  check('tapping Merlin opened his care menu', s.menuHidden === false);
  check('tutorial advanced past the tap step', /Food, cheer|Food/.test(s.title || ''), s.title);
  check('needs step spotlights something', !!s.spot && s.spot.w > 10, JSON.stringify(s.spot));

  log('\n--- Next through the needs + diet beats (the old bug closed the menu here) ---');
  await page.click('#merlinTutorialNext');
  await page.waitForTimeout(500);
  s = await step();
  log(`  step ${s.counter} "${s.title}"  menuHidden=${s.menuHidden}  spot=${JSON.stringify(s.spot)}`);
  check('menu SURVIVES pressing Next (regression)', s.menuHidden === false);
  check('diet step spotlights the diet panel', !!s.spot && s.spot.w > 10, JSON.stringify(s.spot));
  const dietId = await page.evaluate(() => !!document.getElementById('merlinDietGuidance'));
  check('#merlinDietGuidance survives re-render (regression)', dietId);

  log('\n--- The "Feed me!" step ---');
  await page.click('#merlinTutorialNext');
  await page.waitForTimeout(600);
  s = await step();
  log(`  step ${s.counter} "${s.title}"  do="${s.doText}"  menuHidden=${s.menuHidden}`);
  check('reached Feed me!', /Feed me/.test(s.title || ''), s.title);
  check('care menu is OPEN on the feed step (the reported glitch)', s.menuHidden === false);
  check('feed step is interactive', s.interactive);
  const feedBox = await page.evaluate(() => {
    const b = document.getElementById('merlinFeedBtn');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { w: r.width, h: r.height, top: r.top, visible: r.width > 0 && r.height > 0 };
  });
  check('Feed button is on screen', feedBox && feedBox.visible, JSON.stringify(feedBox));
  check('spotlight is on the Feed button', !!s.spot && Math.abs(s.spot.top - (feedBox.top - 8)) < 30,
        `spot=${JSON.stringify(s.spot)} feed=${JSON.stringify(feedBox)}`);
  // The lifted menu must be above the dim, and the Feed button must be the
  // top-most element at its own centre (i.e. actually tappable).
  const topAtFeed = await page.evaluate(() => {
    const b = document.getElementById('merlinFeedBtn');
    const r = b.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { tag: el?.tagName, id: el?.id, isFeed: el === b || b.contains(el) };
  });
  check('Feed button is the topmost element at its centre (tappable)', topAtFeed.isFeed, JSON.stringify(topAtFeed));

  log('\n--- The player feeds him ---');
  await page.click('#merlinFeedBtn');
  await page.waitForTimeout(1400);
  s = await step();
  log(`  step ${s.counter} "${s.title}"`);
  check('feeding advanced the tutorial', /how you feed me/i.test(s.title || ''), s.title);
  const closing = await page.evaluate(() => document.getElementById('merlinTutorialText')?.textContent || '');
  check('closing line teaches accurate diets', /diet must be accurate/i.test(closing), closing);
  check('closing line teases the Kitchen', /kitchen/i.test(closing), closing);
  const hunger = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('burbz_state') || '{}');
    return st.merlinCare ? st.merlinCare.hunger : null;
  });
  check('the feed really happened (hunger dropped below start of 20)', hunger !== null && hunger < 20, 'hunger=' + hunger);

  log('\n--- Shields must not survive the end of the tutorial ---');
  await page.click('#merlinTutorialSkip');
  await page.waitForTimeout(400);
  const leftovers = await page.evaluate(() => ({
    shields: [...document.querySelectorAll('.merlin-tutorial-shield')].filter(s => getComputedStyle(s).display !== 'none').length,
    lifts: document.querySelectorAll('.tutorial-lift').length,
    overlayShown: document.getElementById('merlinTutorialOverlay')?.classList.contains('show'),
  }));
  check('no shields left blocking the app', leftovers.shields === 0, JSON.stringify(leftovers));
  check('no lifted elements left', leftovers.lifts === 0, JSON.stringify(leftovers));

  if (SHOT) await page.screenshot({ path: SHOT });
  await browser.close();
  log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
