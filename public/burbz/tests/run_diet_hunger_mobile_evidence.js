#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');

const BURBZ_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BURBZ_ROOT, '..', '..');
const VALIDATION_DIR = path.join(BURBZ_ROOT, 'validation');
const DEFAULT_OUTPUT = path.join(VALIDATION_DIR, 'diet-hunger-regression-browser-evidence-20260723.json');
const DEFAULT_CHROMIUM_PATHS = [
  process.env.CHROMIUM_EXECUTABLE_PATH,
  '/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',
  '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
].filter(Boolean);

function requirePlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_CORE_PATH,
    'playwright-core',
    '/root/src/gstack/node_modules/playwright-core',
  ].filter(Boolean);
  const errors = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (err) {
      errors.push(`${candidate}: ${err.message}`);
    }
  }
  throw new Error(`Unable to require playwright-core:\n${errors.join('\n')}`);
}

async function firstExisting(paths) {
  for (const candidate of paths) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (_err) {
      // Try the next path.
    }
  }
  throw new Error(`No Chromium executable found. Checked:\n${paths.join('\n')}`);
}

function rel(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, '/');
}

function withReset(urlText) {
  const url = new URL(urlText);
  url.searchParams.set('reset', '1');
  return url.toString();
}

function seededStorageScript() {
  return `
(() => {
  if (sessionStorage.getItem('burbzRegressionSeeded') === '1') return;
  sessionStorage.setItem('burbzRegressionSeeded', '1');
  const now = Date.now();
  const bird = {
    id: 'browser-goldfinch',
    species: 'European Goldfinch',
    commonName: 'European Goldfinch',
    scientificName: 'Carduelis carduelis',
    rarity: 'common',
    level: 3,
    xp: 5,
    hp: 78,
    maxHp: 100,
    atk: 22,
    def: 44,
    spd: 67,
    mag: 98,
    int: 56,
    stamina: 56,
    power: 201,
    captureDate: new Date(now).toISOString(),
    confidence: 0.99,
    artUrl: null,
    care: {
      hunger: 72,
      happiness: 80,
      lastCare: null,
      lastFed: null,
      lastTrained: null,
      lastHungerAt: now,
      hungerTransactions: [],
      hungerTransactionLog: []
    },
    training: {
      feedCount: 0,
      trainCount: 0,
      hpBonus: 0,
      atkBonus: 0,
      defBonus: 0,
      spdBonus: 0,
      intBonus: 0,
      staminaBonus: 0,
      chaBonus: 0,
      magBonus: 0
    },
    academy: {
      room: 'outdoors',
      lastGroom: null,
      lastRest: null,
      lastForage: null,
      dietKnown: true
    },
    biologyStatsVersion: 1
  };
  const state = {
    player: { name: 'Browser Evidence', level: 3, xp: 45, totalCaptures: 1, wins: 0, losses: 0, coins: 220, branches: 18 },
    flock: [bird],
    discoveredSpecies: {
      european_goldfinch: {
        species: 'European Goldfinch',
        commonName: 'European Goldfinch',
        scientificName: 'Carduelis carduelis',
        rarity: 'common',
        confidence: 0.99,
        discoveredAt: new Date(now).toISOString()
      }
    },
    inventory: {
      items: {},
      gear: {},
      equipment: {},
      giftsGiven: {},
      larder: {
        small_bird_prey_ration: 2,
        mealworm_scoop: 2,
        sunflower_seeds: 2,
        live_minnow: 1,
        hedgerow_berries: 1,
        gizzard_grit: 1
      }
    },
    dietBadges: { european_goldfinch: 1 },
    kitchenNotes: {},
    kitchenStarterLarderVersion: 1,
    lootPity: { rareMisses: 0 },
    quests: {},
    questsLastReset: null,
    settings: { sfx: false, particles: false, vibration: false },
    badges: {},
    merlinCare: {
      hunger: 78,
      happiness: 85,
      energy: 90,
      bondXp: 0,
      bondLevel: 1,
      thingsSaid: 0,
      chatterIndex: 0,
      tipIndex: 0,
      lastCareAt: now,
      lastFedAt: null,
      lastPlayedAt: null,
      lastRestedAt: null,
      lastHungerAt: now,
      hungerTransactions: [],
      hungerTransactionLog: []
    },
    pantry: { seeds: 6, suet: 4, insects: 5, worms: 4, berries: 4, fruit: 4, fish: 3, flying: 3, meat: 2, carrion: 2, acorns: 4, aquatic: 4 },
    pantryLastRefill: new Date(now).toISOString(),
    academyBuildings: {
      outdoors: { built: true, builtAt: 'starter' },
      kitchen: { built: true, builtAt: 'starter-kitchen', x: 50, y: 52 }
    },
    academyBuilderVersion: 7,
    battlePreset: { formation: 'balanced', starters: [], lastResult: null },
    league: { tier: 0, winsInTier: 0, wins: 0, losses: 0, teamIds: [], daily: { date: '', wins: 0 } },
    birdExpeditions: [],
    birdTrainingSessions: [],
    walkingQuests: { active: null, history: [] },
    merlinCluesFound: [],
    knowledgeQuiz: { answered: 0, correct: 0, coinsEarned: 0, lastVillageKey: null },
    mapExploredCells: [],
    tavernPatrons: [],
    starterTimber: { taken: {} },
    sideQuest: { active: null, history: [] }
  };
  Object.keys(localStorage).filter(key => /^burbz/i.test(key)).forEach(key => localStorage.removeItem(key));
  localStorage.setItem('burbz_epoch', 'new-dawn-evil-burbz-20260720');
  localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
  localStorage.setItem('burbzTutorialSeen:merlin-gradual-chapters-v4-20260720', '1');
  localStorage.setItem('burbzTutorialChapters:merlin-gradual-chapters-v4-20260720', JSON.stringify(['story','scan','birdex','battle','village','academy','quests','forge','inventory','leaderboards','profile']));
  localStorage.setItem('burbzTutorialState:merlin-gradual-chapters-v4-20260720', JSON.stringify({ version: 'merlin-gradual-chapters-v4-20260720', status: 'completed', mode: 'full', currentStep: 0 }));
  localStorage.setItem('burbz_state', JSON.stringify(state));
})();
`;
}

async function collectState(page, label) {
  return page.evaluate(labelInPage => {
    function parseSaved() {
      try {
        return JSON.parse(localStorage.getItem('burbz_state') || '{}');
      } catch (_err) {
        return {};
      }
    }
    function clone(value) {
      return JSON.parse(JSON.stringify(value || {}));
    }
    function text(selector) {
      const el = document.querySelector(selector);
      return el ? el.innerText : '';
    }
    function attr(selector, name) {
      const el = document.querySelector(selector);
      return el ? el.getAttribute(name) : null;
    }
    const saved = parseSaved();
    const runtimeState = (window.__burbzMapDebug && window.__burbzMapDebug.state) || saved;
    const bird = ((runtimeState.flock || []).find(row => row && row.id === 'browser-goldfinch') || (runtimeState.flock || [])[0] || {});
    const larder = runtimeState.inventory && runtimeState.inventory.larder ? clone(runtimeState.inventory.larder) : {};
    const pantry = runtimeState.pantry ? clone(runtimeState.pantry) : {};
    const merlinCare = clone(runtimeState.merlinCare || {});
    return {
      label: labelInPage,
      url: location.href,
      activeScreens: Array.from(document.querySelectorAll('.screen.active')).map(el => el.id),
      storageBytes: (localStorage.getItem('burbz_state') || '').length,
      storageSubset: {
        flockCount: (saved.flock || []).length,
        larder: clone(saved.inventory && saved.inventory.larder),
        pantry: clone(saved.pantry),
        merlinCare: {
          hunger: saved.merlinCare && saved.merlinCare.hunger,
          happiness: saved.merlinCare && saved.merlinCare.happiness,
          energy: saved.merlinCare && saved.merlinCare.energy,
          transactions: clone(saved.merlinCare && saved.merlinCare.hungerTransactions),
        },
        birdCare: saved.flock && saved.flock[0] && saved.flock[0].care ? {
          hunger: saved.flock[0].care.hunger,
          transactions: clone(saved.flock[0].care.hungerTransactions),
        } : null,
      },
      runtime: {
        bird: {
          id: bird.id || null,
          commonName: bird.commonName || bird.species || null,
          scientificName: bird.scientificName || null,
          hunger: bird.care && bird.care.hunger,
          hungerTransactions: clone(bird.care && bird.care.hungerTransactions),
          hungerLog: clone(bird.care && bird.care.hungerTransactionLog),
        },
        merlinCare: {
          hunger: merlinCare.hunger,
          happiness: merlinCare.happiness,
          energy: merlinCare.energy,
          hungerTransactions: clone(merlinCare.hungerTransactions),
          hungerLog: clone(merlinCare.hungerTransactionLog),
        },
        larder,
        pantry,
      },
      dom: {
        companionText: text('[data-hunger-surface="companion-card"]'),
        companionHungerState: attr('[data-hunger-surface="companion-card"]', 'data-hunger-state'),
        companionDietPrimary: attr('[data-diet-surface="companion-card"]', 'data-diet-primary'),
        companionDietProvenance: attr('[data-diet-surface="companion-card"]', 'data-diet-provenance'),
        merlinText: text('#merlinCareMenu'),
        merlinHungerText: text('#merlinHungerStatus'),
        merlinDietPrimary: attr('[data-diet-surface="merlin-care"]', 'data-diet-primary'),
        merlinDietProvenance: attr('[data-diet-surface="merlin-care"]', 'data-diet-provenance'),
        kitchenText: text('[data-kitchen-pantry-root]'),
        kitchenReachable: Boolean(document.querySelector('[data-kitchen-pantry-root="academy-kitchen"]')),
        resultText: text('[data-feed-result-sheet="one-tap-feed"]'),
        resultTransactionId: attr('[data-feed-result-sheet="one-tap-feed"]', 'data-feed-transaction-id'),
        visibleSmallBirdRations: attr('[data-larder-count="small_bird_prey_ration"]', 'data-count'),
        visibleMealworms: attr('[data-larder-count="mealworm_scoop"]', 'data-count'),
      },
    };
  }, label);
}

function delta(before, after) {
  return {
    larder: {
      small_bird_prey_ration: [
        before.runtime.larder.small_bird_prey_ration,
        after.runtime.larder.small_bird_prey_ration,
      ],
      mealworm_scoop: [
        before.runtime.larder.mealworm_scoop,
        after.runtime.larder.mealworm_scoop,
      ],
    },
    merlinHunger: [
      before.runtime.merlinCare.hunger,
      after.runtime.merlinCare.hunger,
    ],
    merlinTransactions: [
      (before.runtime.merlinCare.hungerTransactions || []).length,
      (after.runtime.merlinCare.hungerTransactions || []).length,
    ],
    birdHunger: [
      before.runtime.bird.hunger,
      after.runtime.bird.hunger,
    ],
    birdTransactions: [
      (before.runtime.bird.hungerTransactions || []).length,
      (after.runtime.bird.hungerTransactions || []).length,
    ],
    storageBytes: [before.storageBytes, after.storageBytes],
  };
}

async function dismissOverlays(page) {
  await page.evaluate(() => {
    const tutorial = document.getElementById('merlinTutorialOverlay');
    if (tutorial) {
      tutorial.classList.remove('show');
      tutorial.setAttribute('aria-hidden', 'true');
    }
    const intro = document.getElementById('introCutsceneOverlay');
    if (intro) intro.classList.remove('show');
    const feedSheet = document.getElementById('burbzFeedSheet');
    if (feedSheet) feedSheet.classList.remove('open');
  });
}

async function screenshot(page, fileName, selector = null) {
  const filePath = path.join(VALIDATION_DIR, fileName);
  if (selector) {
    await page.locator(selector).first().screenshot({ path: filePath });
  } else {
    await page.screenshot({ path: filePath, fullPage: false });
  }
  return rel(filePath);
}

async function companionEvidenceScreenshot(page, fileName) {
  const filePath = path.join(VALIDATION_DIR, fileName);
  await page.locator('[data-bird-id="browser-goldfinch"] .card-info').scrollIntoViewIfNeeded();
  const clip = await page.evaluate(() => {
    const info = document.querySelector('[data-bird-id="browser-goldfinch"] .card-info');
    const diet = document.querySelector('[data-diet-surface="companion-card"]');
    if (!info || !diet) return null;
    const a = info.getBoundingClientRect();
    const b = diet.getBoundingClientRect();
    const pad = 10;
    const x = Math.max(0, Math.floor(a.left));
    const y = Math.max(0, Math.floor(a.top));
    const width = Math.max(1, Math.min(window.innerWidth - x, Math.ceil(a.width)));
    const height = Math.max(1, Math.min(window.innerHeight - y, Math.ceil(b.bottom - a.top + pad)));
    return { x, y, width, height };
  });
  if (!clip) throw new Error('Companion evidence crop target missing');
  await page.screenshot({ path: filePath, clip });
  return rel(filePath);
}

async function preparePage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => window.BurbzDietHungerCore && window.__burbzKitchenDebug && window.__burbzMapDebug && typeof window.switchScreen === 'function',
    null,
    { timeout: 60000 },
  );
  await page.addStyleTag({
    content: [
      '* { scroll-behavior: auto !important; transition-duration: 0.001s !important; animation-duration: 0.001s !important; }',
      '.pet-speech { display: none !important; }',
    ].join('\n'),
  }).catch(() => {});
  await dismissOverlays(page);
}

async function seedRegressionState(page) {
  return page.evaluate(() => {
    const state = window.__burbzMapDebug.state;
    window.switchScreen('birdex');
    const screen = document.querySelector('#screen-birdex');
    if (screen) screen.scrollTop = 330;
    return {
      flockCount: state.flock.length,
      merlinHunger: state.merlinCare.hunger,
      larder: { ...state.inventory.larder },
    };
  });
}

async function showKitchen(page) {
  await page.evaluate(() => {
    window.openAcademyRoom('kitchen');
    const screen = document.querySelector('#screen-academy-room');
    if (screen) screen.scrollTop = 0;
  });
  await page.waitForSelector('[data-kitchen-pantry-root="academy-kitchen"]', { timeout: 30000 });
  await dismissOverlays(page);
}

// One food, one tap, one meal — there is no tray to assemble first.
async function serveKitchenMeal(page, ingredientId) {
  await page.evaluate((ingredient) => {
    const runtimeState = window.__burbzMapDebug.state;
    runtimeState.merlinCare.lastFedAt = 0;
    window.kitchenSelectSpecies('merlin');
    window.renderAcademyRoomInterior();
    window.burbzFeedFood('merlin', 'larder', ingredient);
  }, ingredientId);
  await dismissOverlays(page);
}

async function openMerlin(page) {
  await page.evaluate(() => {
    const menu = document.getElementById('merlinCareMenu');
    if (menu) menu.hidden = true;
    const sprite = document.getElementById('petSprite');
    if (sprite) sprite.click();
  });
  await page.waitForSelector('#merlinCareMenu:not([hidden])', { timeout: 30000 });
  await dismissOverlays(page);
}

async function proveActivityIdempotency(page) {
  const first = await page.evaluate(() => {
    const now = Date.now();
    const state = window.__burbzMapDebug.state;
    const bird = state.flock.find(row => row && row.id === 'browser-goldfinch');
    bird.care.hunger = 20;
    bird.care.hungerTransactions = [];
    bird.care.hungerTransactionLog = [];
    const quest = window.BurbzAcademyCore.createBirdExpedition(bird, 'find_seed', now - 120000);
    quest.id = 'browser-expedition-idempotency';
    quest.startMs = now - 120000;
    quest.endMs = now - 1;
    quest.status = 'active';
    state.birdExpeditions = [quest];
    localStorage.setItem('burbz_state', JSON.stringify(state));
    const before = {
      hunger: bird.care.hunger,
      transactions: [...bird.care.hungerTransactions],
      expeditionCount: state.birdExpeditions.length,
    };
    window.claimBirdExpedition(quest.id);
    const afterClaim = {
      hunger: bird.care.hunger,
      transactions: [...bird.care.hungerTransactions],
      expeditionCount: state.birdExpeditions.length,
    };
    const repeat = window.BurbzDietHungerCore.applyHungerDeltaToCare(bird.care, { activityType: 'expedition', activityId: quest.id, delta: 12, now: now + 1 });
    bird.care = repeat.care;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    const afterRepeat = {
      hunger: bird.care.hunger,
      transactions: [...bird.care.hungerTransactions],
      expeditionCount: state.birdExpeditions.length,
      duplicate: Boolean(repeat.duplicate),
    };
    window.switchScreen('birdex');
    return { before, afterClaim, afterRepeat };
  });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => window.BurbzDietHungerCore && window.__burbzMapDebug && window.__burbzMapDebug.state,
    null,
    { timeout: 60000 },
  );
  const afterReload = await page.evaluate(() => {
    const state = window.__burbzMapDebug.state;
    const bird = state.flock.find(row => row && row.id === 'browser-goldfinch');
    const beforeRepeat = {
      hunger: bird.care.hunger,
      transactions: [...bird.care.hungerTransactions],
      expeditionCount: state.birdExpeditions.length,
    };
    const repeat = window.BurbzDietHungerCore.applyHungerDeltaToCare(bird.care, { activityType: 'expedition', activityId: 'browser-expedition-idempotency', delta: 12, now: Date.now() });
    bird.care = repeat.care;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    const afterRepeat = {
      hunger: bird.care.hunger,
      transactions: [...bird.care.hungerTransactions],
      expeditionCount: state.birdExpeditions.length,
      duplicate: Boolean(repeat.duplicate),
    };
    window.switchScreen('birdex');
    return { beforeRepeat, afterRepeat };
  });
  return { first, afterReload };
}

function checksForRun(run) {
  const combinedMerlin = `${run.merlin.dom.merlinText}\n${run.merlin.dom.merlinDietPrimary}`.toLowerCase();
  const compatibleDelta = run.deltas.initialToCompatible;
  const incompatibleDelta = run.deltas.compatibleToIncompatible;
  const reloadDelta = run.deltas.incompatibleToReload;
  const activity = run.activityIdempotency;
  return {
    companionHungerVisible: /hunger/i.test(run.companion.dom.companionText) && run.companion.dom.companionHungerState === 'hungry',
    companionDietVisible: run.companion.dom.companionDietPrimary === 'Seeds' && /BirdFuncDat/.test(run.companion.dom.companionDietProvenance || ''),
    merlinFalconGuidance: combinedMerlin.includes('falco columbarius') && combinedMerlin.includes('small-bird prey rations'),
    merlinNoMealwormPrimary: !combinedMerlin.includes('mealworm primary') && !combinedMerlin.includes('primary: mealworm'),
    kitchenReachable: run.kitchenInitial.dom.kitchenReachable,
    compatibleConsumesAndRecovers:
      compatibleDelta.larder.small_bird_prey_ration[0] === 2 &&
      compatibleDelta.larder.small_bird_prey_ration[1] === 1 &&
      compatibleDelta.larder.mealworm_scoop[1] === 2 &&
      compatibleDelta.merlinHunger[1] < compatibleDelta.merlinHunger[0] &&
      compatibleDelta.merlinTransactions[1] === compatibleDelta.merlinTransactions[0] + 1,
    incompatibleRefusesNoConsumption:
      incompatibleDelta.larder.small_bird_prey_ration[0] === incompatibleDelta.larder.small_bird_prey_ration[1] &&
      incompatibleDelta.larder.mealworm_scoop[0] === incompatibleDelta.larder.mealworm_scoop[1] &&
      incompatibleDelta.merlinHunger[0] === incompatibleDelta.merlinHunger[1] &&
      incompatibleDelta.merlinTransactions[0] === incompatibleDelta.merlinTransactions[1] &&
      /No stock spent/i.test(run.incompatible.dom.resultText),
    reloadPersistsFeedState:
      reloadDelta.larder.small_bird_prey_ration[0] === reloadDelta.larder.small_bird_prey_ration[1] &&
      reloadDelta.larder.mealworm_scoop[0] === reloadDelta.larder.mealworm_scoop[1] &&
      reloadDelta.merlinHunger[0] === reloadDelta.merlinHunger[1] &&
      reloadDelta.merlinTransactions[0] === reloadDelta.merlinTransactions[1],
    activityIdempotentAfterReload:
      !activity ||
      (
        activity.first.before.hunger === 20 &&
        activity.first.afterClaim.hunger > activity.first.before.hunger &&
        activity.first.afterRepeat.hunger === activity.first.afterClaim.hunger &&
        activity.first.afterRepeat.duplicate === true &&
        activity.afterReload.beforeRepeat.hunger === activity.first.afterRepeat.hunger &&
        activity.afterReload.afterRepeat.hunger === activity.afterReload.beforeRepeat.hunger &&
        activity.afterReload.afterRepeat.duplicate === true
      ),
  };
}

async function runViewport(browser, url, viewport, includeActivity) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript({ content: seededStorageScript() });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const responseErrors = [];
  page.on('console', msg => {
    if (['warning', 'error'].includes(msg.type())) {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    }
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('requestfailed', req => requestFailures.push({ url: req.url(), failure: req.failure() && req.failure().errorText }));
  page.on('response', response => {
    if (response.status() >= 400) responseErrors.push({ url: response.url(), status: response.status() });
  });

  const label = `${viewport.width}x${viewport.height}`;
  await preparePage(page, url);
  const seed = await seedRegressionState(page);
  await dismissOverlays(page);
  const companion = await collectState(page, 'companion-seeded');
  const companionShot = await companionEvidenceScreenshot(page, `diet-hunger-regression-${label}-companion.png`);

  await openMerlin(page);
  const merlin = await collectState(page, 'merlin-care');
  const merlinShot = await screenshot(page, `diet-hunger-regression-${label}-merlin-care.png`, '#merlinCareMenu');
  await page.evaluate(() => {
    const menu = document.getElementById('merlinCareMenu');
    if (menu) menu.hidden = true;
  });

  await showKitchen(page);
  const kitchenInitial = await collectState(page, 'kitchen-initial');
  const kitchenShot = await screenshot(page, `diet-hunger-regression-${label}-kitchen-initial.png`);

  await serveKitchenMeal(page, 'small_bird_prey_ration');
  const compatible = await collectState(page, 'compatible-small-bird-ration');
  const compatibleShot = await screenshot(page, `diet-hunger-regression-${label}-compatible.png`, '[data-feed-result-sheet="one-tap-feed"]');

  await serveKitchenMeal(page, 'mealworm_scoop');
  const incompatible = await collectState(page, 'incompatible-mealworm');
  const incompatibleShot = await screenshot(page, `diet-hunger-regression-${label}-incompatible.png`, '[data-feed-result-sheet="one-tap-feed"]');

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(
    () => window.BurbzDietHungerCore && window.__burbzKitchenDebug && window.__burbzMapDebug && window.__burbzMapDebug.state,
    null,
    { timeout: 60000 },
  );
  await showKitchen(page);
  const reload = await collectState(page, 'reload-after-feeding');
  const reloadShot = await screenshot(page, `diet-hunger-regression-${label}-reload.png`);

  const activityIdempotency = includeActivity ? await proveActivityIdempotency(page) : null;
  const activityShot = includeActivity ? await screenshot(page, `diet-hunger-regression-${label}-activity-idempotency.png`) : null;
  const afterActivity = includeActivity ? await collectState(page, 'after-activity-idempotency') : null;

  const run = {
    viewport,
    url,
    seed,
    screenshots: {
      companion: companionShot,
      merlin: merlinShot,
      kitchenInitial: kitchenShot,
      compatible: compatibleShot,
      incompatible: incompatibleShot,
      reload: reloadShot,
      activityIdempotency: activityShot,
    },
    companion,
    merlin,
    kitchenInitial,
    compatible,
    incompatible,
    reload,
    activityIdempotency,
    afterActivity,
    deltas: {
      initialToCompatible: delta(kitchenInitial, compatible),
      compatibleToIncompatible: delta(compatible, incompatible),
      incompatibleToReload: delta(incompatible, reload),
      beforeActivityToAfterActivity: afterActivity ? delta(reload, afterActivity) : null,
    },
    console: {
      warningsAndErrors: consoleMessages,
      pageErrors,
      requestFailures,
      responseErrors,
    },
  };
  run.checks = checksForRun(run);
  run.allChecksPass = Object.values(run.checks).every(Boolean);
  await context.close();
  return run;
}

async function main() {
  const url = process.argv[2] || process.env.BURBZ_URL || 'http://localhost:4173/burbz/';
  const output = process.argv[3] ? path.resolve(process.argv[3]) : DEFAULT_OUTPUT;
  await fs.mkdir(VALIDATION_DIR, { recursive: true });
  const chromiumPath = await firstExisting(DEFAULT_CHROMIUM_PATHS);
  const playwright = requirePlaywright();
  const browser = await playwright.chromium.launch({
    executablePath: chromiumPath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-crash-reporter', '--disable-crashpad'],
  });
  try {
    const viewports = [
      { width: 320, height: 568 },
      { width: 360, height: 730 },
    ];
    const runs = [];
    for (let index = 0; index < viewports.length; index += 1) {
      runs.push(await runViewport(browser, url, viewports[index], index === 0));
    }
    const evidence = {
      generatedAt: new Date().toISOString(),
      command: `node public/burbz/tests/run_diet_hunger_mobile_evidence.js ${url}`,
      appUrl: url,
      chromiumPath,
      harness: rel(__filename),
      runs,
      allChecksPass: runs.every(run => run.allChecksPass),
    };
    await fs.writeFile(output, JSON.stringify(evidence, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({
      output: rel(output),
      allChecksPass: evidence.allChecksPass,
      viewports: runs.map(run => ({
        viewport: `${run.viewport.width}x${run.viewport.height}`,
        checks: run.checks,
        screenshots: run.screenshots,
        consoleErrorCount: run.console.pageErrors.length + run.console.requestFailures.length + run.console.responseErrors.length,
      })),
    }, null, 2));
    if (!evidence.allChecksPass) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
