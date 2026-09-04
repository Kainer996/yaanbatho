const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const out = path.join(process.env.EVIDENCE_DIR || require('os').tmpdir(), 'burbz-tutorial-coins-evidence');
fs.mkdirSync(out, { recursive: true });
const checks = [];
function check(name, ok, detail) { checks.push({ name, ok, detail }); if (!ok) throw new Error(name + ': ' + JSON.stringify(detail)); }
(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  let parsed = 0;
  for (const [, attrs, code] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/src=|application\//.test(attrs) && code.trim()) { new vm.Script(code); parsed++; }
  }
  check('inline JavaScript parses', parsed > 0, parsed);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  try {
    for (const size of [{ width:320, height:568 }, { width:390, height:844 }, { width:1280, height:800 }]) {
      const context = await browser.newContext({ viewport:size, serviceWorkers:'block' });
      await context.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:8765/') ? route.continue() : route.abort());
      await context.addInitScript(() => {
        localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
        localStorage.setItem('burbzTutorialChapters:merlin-interactive-flow-v7-20260728', JSON.stringify(['story']));
      });
      await context.route('http://127.0.0.1:8765/burbz/', route => route.fulfill({ contentType:'text/html', body:source.replace('init();', 'window.__testEval = code => eval(code); init();') }));
      const page = await context.newPage();
      const run = (fn, arg = null) => page.evaluate(([fn, arg]) => window.__testEval('(' + fn + ')(' + JSON.stringify(arg) + ')'), [fn.toString(), arg]);
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:8765/burbz/', { waitUntil:'domcontentloaded' });
      await page.waitForFunction(() => !!window.__burbzHudDebug && !!JSON.parse(localStorage.getItem('burbz_state') || 'null'));
      await run(() => { markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c => c.id)); if (merlinTutActive) endMerlinTutorial(false); });
      await page.waitForTimeout(1000);
      const initialCoins = await run(() => gameState.player.coins);
      const label = `${size.width}x${size.height}`;
      async function hidden(phase) {
        const info = await run(() => ({
          active:merlinTutActive,
          display:['hudCoinsChip','globalMoneyHud'].map(id => getComputedStyle(document.getElementById(id)).display),
          overflow:document.documentElement.scrollWidth > innerWidth,
          headerOverflow:document.querySelector('.header').scrollWidth > document.querySelector('.header').clientWidth,
          coins:gameState.player.coins
        }));
        check(label + ' ' + phase, info.active && info.display.every(d => d === 'none') && !info.overflow && !info.headerOverflow, info);
      }
      await run(() => startMerlinTutorial({ chapterId:'story', resume:false }));
      const steps = await run(() => merlinTutSequence.length);
      for (let i = 0; i < steps; i++) {
        await run(i => merlinTutShowStep(i), i);
        await page.waitForTimeout(80);
        await hidden('story step ' + i);
      }
      await run(() => { merlinTutShowStep(0); addCoins(7); updateHeader(); });
      await hidden('balance updates during tutorial');
      check(label + ' coin accounting preserved', await run(() => gameState.player.coins) === initialCoins + 7);
      await page.screenshot({ path:path.join(out, `tutorial-${label}.png`) });
      await run(() => endMerlinTutorial(false));
      check(label + ' header restored after skip', await page.locator('#hudCoinsChip').isVisible());
      await run(() => { switchScreen('scan'); $('settingsModal').classList.add('show'); syncGlobalMoneyHud(); });
      check(label + ' normal overlay keeps money badge', await page.locator('#globalMoneyHud').isVisible());
      await run(() => { startMerlinTutorial({ full:true, resume:false }); });
      await hidden('full replay over settings');
      await run(() => endMerlinTutorial(false));
      await page.waitForTimeout(80);
      check(label + ' badge restored above remaining settings', await page.locator('#globalMoneyHud').isVisible());
      await run(() => { $('settingsModal').classList.remove('show'); startMerlinTutorial({ chapterId:'story', resume:false }); merlinTutShowStep(1); saveMerlinTutorialState('in_progress', 1); });
      await page.reload({waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => !!window.__burbzHudDebug);
      await run(() => startMerlinTutorial({ chapterId:'story', resume:true }));
      check(label + ' interrupted story resumes', await run(() => merlinTutStep === 1));
      await hidden('resumed story');
      await run(() => endMerlinTutorial(true));
      await page.waitForTimeout(100);
      check(label + ' header restored after completion', await page.locator('#hudCoinsChip').isVisible());
      await page.screenshot({ path:path.join(out, `restored-${label}.png`) });
      check(label + ' no JavaScript errors', errors.length === 0, errors);
      await context.close();
    }
  } finally { await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(checks, null, 2)); }
  console.log(`${checks.length} browser and syntax checks passed. Evidence: ${out}`);
})().catch(e => { console.error(e); process.exitCode = 1; });
