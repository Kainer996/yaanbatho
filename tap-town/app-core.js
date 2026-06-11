export const VERSION = 'tap-town-bigmap-20260608-1';

export const MAP_BOUNDS = Object.freeze({ width: 1540, height: 1320, padding: 80 });

export const PLOTS = [
  ['p01', 260, 128], ['p02', 410, 138], ['p03', 560, 150], ['p04', 710, 180], ['p05', 860, 142], ['p06', 1020, 172], ['p07', 1190, 214], ['p08', 1360, 176],
  ['p09', 170, 278], ['p10', 325, 260], ['p11', 480, 286], ['p12', 635, 262], ['p13', 790, 305], ['p14', 950, 276], ['p15', 1115, 322], ['p16', 1290, 306],
  ['p17', 228, 436], ['p18', 382, 420], ['p19', 540, 454], ['p20', 700, 430], ['p21', 862, 470], ['p22', 1028, 440], ['p23', 1192, 488], ['p24', 1382, 464],
  ['p25', 126, 608], ['p26', 288, 592], ['p27', 450, 628], ['p28', 612, 600], ['p29', 778, 646], ['p30', 944, 614], ['p31', 1112, 668], ['p32', 1300, 640],
  ['p33', 210, 790], ['p34', 376, 770], ['p35', 542, 814], ['p36', 710, 782], ['p37', 878, 830], ['p38', 1046, 802], ['p39', 1218, 860], ['p40', 1402, 828],
  ['p41', 150, 990], ['p42', 322, 960], ['p43', 498, 1010], ['p44', 674, 980], ['p45', 850, 1034], ['p46', 1028, 1004], ['p47', 1208, 1062], ['p48', 1392, 1018],
  ['p49', 260, 1170], ['p50', 452, 1134], ['p51', 648, 1192], ['p52', 844, 1158], ['p53', 1040, 1210], ['p54', 1236, 1174], ['p55', 1416, 1224], ['p56', 86, 1160]
].map(([id, x, y]) => ({ id, x, y }));

export const BUILDINGS = {
  hall: { name: 'Town Hall', type: 'civic', cost: 0, level: 1, income: 42, xp: 7, buildMs: 0, cooldownMs: 22_000, energy: 2, sprite: 'hall.png', hook: 'Town fund + mayor quests' },
  cottage: { name: 'Cozy Cottage', type: 'home', cost: 85, level: 1, income: 26, xp: 5, buildMs: 7_000, cooldownMs: 18_000, energy: 1, sprite: 'cottage.png', hook: 'Residents and rent' },
  bakery: { name: 'Moon Bun Bakery', type: 'shop', cost: 140, level: 1, income: 48, xp: 8, buildMs: 10_000, cooldownMs: 26_000, energy: 1, sprite: 'bakery.png', hook: 'Short snack jobs' },
  farm: { name: 'Sunpatch Farm', type: 'work', cost: 165, level: 1, income: 58, xp: 9, buildMs: 12_000, cooldownMs: 32_000, energy: 1, sprite: 'farm.png', hook: 'Ingredient chain' },
  solar: { name: 'Sunstack Station', type: 'power', cost: 125, level: 1, income: 18, xp: 4, buildMs: 8_000, cooldownMs: 20_000, energy: -3, sprite: 'solar.png', hook: 'Adds energy capacity' },
  park: { name: 'Pocket Park', type: 'decor', cost: 45, level: 1, income: 8, xp: 3, buildMs: 4_000, cooldownMs: 20_000, energy: -1, sprite: 'park.png', hook: 'Happiness boost' },
  market: { name: 'Bloom Market', type: 'shop', cost: 180, level: 2, income: 72, xp: 11, buildMs: 15_000, cooldownMs: 38_000, energy: 1, sprite: 'market.png', hook: 'Harvest orders' },
  diner: { name: 'Comet Diner', type: 'fun', cost: 210, level: 2, income: 82, xp: 12, buildMs: 18_000, cooldownMs: 45_000, energy: 1, sprite: 'diner.png', hook: 'Longer evening jobs' },
  workshop: { name: 'Fix-It Garage', type: 'work', cost: 260, level: 3, income: 110, xp: 16, buildMs: 22_000, cooldownMs: 58_000, energy: 2, sprite: 'workshop.png', hook: 'Repair contracts' },
  factory: { name: 'Bright Bolt Factory', type: 'work', cost: 320, level: 3, income: 142, xp: 20, buildMs: 28_000, cooldownMs: 70_000, energy: 3, sprite: 'factory.png', hook: 'Production orders' },
  office: { name: 'Cloud Nine Office', type: 'work', cost: 300, level: 3, income: 132, xp: 19, buildMs: 25_000, cooldownMs: 66_000, energy: 2, sprite: 'office.png', hook: 'Admin missions' },
  cinema: { name: 'Starbox Cinema', type: 'fun', cost: 340, level: 4, income: 156, xp: 22, buildMs: 30_000, cooldownMs: 82_000, energy: 2, sprite: 'cinema.png', hook: 'Premium entertainment' }
};

export const RESIDENTS = [
  { id: 'milo', name: 'Milo', role: 'Neighbour', sprite: 'homeowner.png', likes: ['hall', 'cottage'] },
  { id: 'poppy', name: 'Poppy', role: 'Baker', sprite: 'baker.png', likes: ['bakery', 'market'] },
  { id: 'rowan', name: 'Rowan', role: 'Farmer', sprite: 'farmer.png', likes: ['farm', 'market'] },
  { id: 'juno', name: 'Juno', role: 'Maker', sprite: 'factory_worker.png', likes: ['factory', 'workshop'] },
  { id: 'arlo', name: 'Arlo', role: 'Office pal', sprite: 'office_worker.png', likes: ['office', 'hall'] },
  { id: 'kit', name: 'Kit', role: 'Mechanic', sprite: 'mechanic.png', likes: ['workshop', 'solar'] },
  { id: 'lena', name: 'Lena', role: 'Florist', sprite: 'florist.png', likes: ['park', 'market'] },
  { id: 'nico', name: 'Nico', role: 'Usher', sprite: 'usher.png', likes: ['cinema', 'diner'] }
];

export const QUESTS = [
  { id: 'collect-hall', title: 'Collect the town fund', body: 'Collect from Town Hall.', rewardCoins: 75, rewardXp: 15, target: s => countCollections(s, 'hall'), goal: 1 },
  { id: 'build-park', title: 'Make it cosy', body: 'Build a Pocket Park for happiness.', rewardCoins: 95, rewardXp: 18, target: s => countBuildings(s, 'park'), goal: 1 },
  { id: 'three-collects', title: 'Start the loop', body: 'Collect income three times.', rewardCoins: 125, rewardXp: 24, target: s => totalCollections(s), goal: 3 },
  { id: 'build-market', title: 'Open the market', body: 'Reach level 2 and build Bloom Market.', rewardCoins: 160, rewardXp: 32, target: s => countBuildings(s, 'market'), goal: 1 },
  { id: 'busy-town', title: 'A proper little town', body: 'Have ten buildings placed.', rewardCoins: 260, rewardXp: 55, target: s => s.placed.length, goal: 10 }
];

export function createInitialState(now = Date.now()) {
  return {
    version: VERSION,
    coins: 420,
    xp: 0,
    happiness: 72,
    activeTool: 'build',
    selectedBuilding: 'cottage',
    selectedId: null,
    activeFilter: 'all',
    camera: { x: -210, y: -205, scale: 0.82 },
    placed: [
      place('hall', 'p28', now - 90_000, now - 60_000),
      place('cottage', 'p20', now - 90_000, now - 45_000),
      place('cottage', 'p13', now - 90_000, now - 42_000),
      place('bakery', 'p21', now - 90_000, now - 68_000),
      place('solar', 'p14', now - 90_000, now - 40_000),
      place('farm', 'p33', now - 90_000, now - 55_000)
    ],
    residents: RESIDENTS.map((r, i) => ({ id: r.id, mood: 70 + i * 3, jobUntil: 0, assignedTo: null })),
    questClaims: [],
    stats: { builds: { hall: 1, cottage: 2, bakery: 1, solar: 1, farm: 1 }, collects: {}, totalCollects: 0, moves: 0 }
  };
}

export function migrateState(raw, now = Date.now()) {
  const base = createInitialState(now);
  if (!raw || typeof raw !== 'object') return base;
  const merged = { ...base, ...raw };
  merged.placed = Array.isArray(raw.placed) ? raw.placed.filter(b => BUILDINGS[b.type] && PLOTS.some(p => p.id === b.plotId)).map(b => ({ ...b })) : base.placed;
  merged.residents = base.residents.map(r => ({ ...r, ...(raw.residents || []).find(x => x.id === r.id) }));
  merged.stats = { ...base.stats, ...(raw.stats || {}), builds: { ...base.stats.builds, ...(raw.stats?.builds || {}) }, collects: { ...(raw.stats?.collects || {}) } };
  merged.questClaims = Array.isArray(raw.questClaims || raw.questsClaimed) ? [...(raw.questClaims || raw.questsClaimed)] : [];
  merged.activeFilter ||= 'all';
  merged.activeTool ||= 'build';
  merged.selectedBuilding = BUILDINGS[merged.selectedBuilding] ? merged.selectedBuilding : 'cottage';
  merged.camera = clampCamera(merged.camera || base.camera, { width: 390, height: 720 });
  return merged;
}

export function place(type, plotId, createdAt = Date.now(), lastCollected = Date.now()) {
  const def = BUILDINGS[type];
  return { id: `${type}-${createdAt}-${Math.floor(Math.random() * 9999)}`, type, plotId, createdAt, builtAt: createdAt + def.buildMs, lastCollected };
}

export function getLevel(xp = 0) { return Math.max(1, Math.floor(xp / 120) + 1); }
export function getLevelProgress(xp = 0) { return xp % 120; }
export function getPlot(id) { return PLOTS.find(p => p.id === id); }
export function getMapBounds() { return { ...MAP_BOUNDS }; }
export function isBuilt(building, now = Date.now()) { return now >= building.builtAt; }
export function remainingBuildMs(building, now = Date.now()) { return Math.max(0, building.builtAt - now); }
export function remainingCollectMs(building, now = Date.now()) { const def = BUILDINGS[building.type]; return Math.max(0, building.lastCollected + def.cooldownMs - now); }
export function canCollect(building, now = Date.now()) { return isBuilt(building, now) && remainingCollectMs(building, now) <= 0; }
export function energySummary(state) { return state.placed.reduce((acc, b) => { const e = BUILDINGS[b.type].energy; e >= 0 ? acc.used += e : acc.max += Math.abs(e); return acc; }, { used: 0, max: 6 }); }
export function happinessSummary(state) { const parks = countBuildings(state, 'park'); const busy = state.residents.filter(r => r.jobUntil > Date.now()).length; return Math.max(35, Math.min(100, Math.round(68 + parks * 5 + Math.min(12, state.placed.length) - busy))); }
export function countBuildings(state, type) { return state.placed.filter(b => b.type === type).length; }
export function countCollections(state, type) { return state.stats.collects[type] || 0; }
export function totalCollections(state) { return state.stats.totalCollects || Object.values(state.stats.collects || {}).reduce((a,b)=>a+b,0); }
export function currentQuest(state) { return QUESTS.find(q => !state.questClaims.includes(q.id)) || QUESTS[QUESTS.length - 1]; }
export function questProgress(state, quest = currentQuest(state)) { const value = Math.min(quest.goal, quest.target(state)); return { value, goal: quest.goal, ready: value >= quest.goal && !state.questClaims.includes(quest.id) }; }
export function formatTime(ms) { if (ms <= 0) return 'Ready'; const sec = Math.ceil(ms / 1000); return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`; }

export function clampCamera(camera = {}, viewport = { width: 390, height: 720 }) {
  const scale = Math.max(0.42, Math.min(1.55, Number(camera.scale) || 0.82));
  const visibleWidth = Math.max(240, Number(viewport.width) || 390);
  const visibleHeight = Math.max(240, Number(viewport.height) || 720);
  const minX = Math.min(0, visibleWidth - MAP_BOUNDS.width * scale - MAP_BOUNDS.padding);
  const minY = Math.min(0, visibleHeight - MAP_BOUNDS.height * scale - MAP_BOUNDS.padding);
  const maxX = MAP_BOUNDS.padding;
  const maxY = MAP_BOUNDS.padding;
  return {
    x: clamp(Number(camera.x) || 0, minX, maxX),
    y: clamp(Number(camera.y) || 0, minY, maxY),
    scale
  };
}

export function centerCamera(viewport = { width: 390, height: 720 }, scale = 0.82) {
  const safeScale = Math.max(0.42, Math.min(1.55, scale));
  return clampCamera({
    x: Math.round((viewport.width - MAP_BOUNDS.width * safeScale) / 2),
    y: Math.round((viewport.height - MAP_BOUNDS.height * safeScale) / 2),
    scale: safeScale
  }, viewport);
}

export function buyBuilding(state, type, plotId, now = Date.now()) {
  const def = BUILDINGS[type];
  if (!def) throw new Error('Unknown building');
  if (!PLOTS.some(p => p.id === plotId)) throw new Error('Choose a real plot');
  if (state.placed.some(b => b.plotId === plotId)) throw new Error('That plot is occupied');
  if (getLevel(state.xp) < def.level) throw new Error(`${def.name} unlocks at level ${def.level}`);
  const energy = energySummary(state);
  if (def.energy > 0 && energy.used + def.energy > energy.max) throw new Error('Build more power first');
  if (state.coins < def.cost) throw new Error('Not enough coins yet');
  const next = clone(state);
  next.coins -= def.cost;
  next.placed.push(place(type, plotId, now, now));
  next.stats.builds[type] = (next.stats.builds[type] || 0) + 1;
  next.xp += Math.max(2, Math.floor(def.cost / 35));
  return next;
}

export function collectBuilding(state, id, now = Date.now()) {
  const building = state.placed.find(b => b.id === id);
  if (!building) throw new Error('Building not found');
  if (!canCollect(building, now)) throw new Error('Income is not ready yet');
  const def = BUILDINGS[building.type];
  const next = clone(state);
  const target = next.placed.find(b => b.id === id);
  target.lastCollected = now;
  const happinessBonus = Math.round(def.income * ((next.happiness || 70) - 70) / 300);
  next.coins += def.income + happinessBonus;
  next.xp += def.xp;
  next.stats.collects[building.type] = (next.stats.collects[building.type] || 0) + 1;
  next.stats.totalCollects = (next.stats.totalCollects || 0) + 1;
  return next;
}

export function claimQuest(state, questId = currentQuest(state).id) {
  const quest = QUESTS.find(q => q.id === questId);
  if (!quest) throw new Error('Quest not found');
  const progress = questProgress(state, quest);
  if (!progress.ready) throw new Error('Quest is not ready');
  const next = clone(state);
  next.questClaims.push(quest.id);
  next.coins += quest.rewardCoins;
  next.xp += quest.rewardXp;
  return next;
}

export function moveBuilding(state, buildingId, plotId) {
  if (state.placed.some(b => b.plotId === plotId)) throw new Error('That plot is occupied');
  const next = clone(state);
  const b = next.placed.find(x => x.id === buildingId);
  if (!b) throw new Error('Building not found');
  b.plotId = plotId;
  next.stats.moves = (next.stats.moves || 0) + 1;
  return next;
}

export function startResidentJob(state, residentId, buildingId, now = Date.now()) {
  const resident = RESIDENTS.find(r => r.id === residentId);
  const building = state.placed.find(b => b.id === buildingId);
  if (!resident || !building) throw new Error('Missing resident or building');
  if (!resident.likes.includes(building.type)) throw new Error(`${resident.name} prefers a different job`);
  const next = clone(state);
  const r = next.residents.find(x => x.id === residentId);
  r.assignedTo = buildingId;
  r.jobUntil = now + 45_000;
  r.mood = Math.min(100, (r.mood || 70) + 4);
  return next;
}

export function finishResidentJobs(state, now = Date.now()) {
  const next = clone(state);
  for (const r of next.residents) {
    if (r.jobUntil && r.jobUntil <= now) {
      r.jobUntil = 0;
      r.assignedTo = null;
      r.mood = Math.min(100, (r.mood || 70) + 2);
      next.coins += 34;
      next.xp += 7;
      next.stats.totalCollects = (next.stats.totalCollects || 0) + 1;
    }
  }
  return next;
}

export function residentRoutePlan(state, residentDef, index = 0, now = Date.now()) {
  const residentState = state.residents.find(r => r.id === residentDef.id) || {};
  const assigned = state.placed.find(b => b.id === residentState.assignedTo);
  const favouriteBuildings = state.placed.filter(b => residentDef.likes.includes(b.type));
  const home = assigned || favouriteBuildings[0] || state.placed[index % Math.max(1, state.placed.length)];
  const homePlot = getPlot(home?.plotId) || PLOTS[index % PLOTS.length];
  const seed = stableSeed(residentDef.id) + index * 37;
  const routePlots = favouriteBuildings.length
    ? favouriteBuildings.map(b => getPlot(b.plotId)).filter(Boolean)
    : PLOTS.filter((_, plotIndex) => (plotIndex + seed) % 7 === 0);
  const fallback = PLOTS[(seed + Math.floor(now / 9000)) % PLOTS.length];
  const targetBase = routePlots[(Math.floor(now / 18_000) + seed) % Math.max(1, routePlots.length)] || fallback;
  const wander = PLOTS[(seed * 3 + Math.floor(now / 27_000)) % PLOTS.length];
  const targetPlot = residentState.jobUntil > now ? homePlot : blendPlot(targetBase, wander, 0.22);
  const walkMs = residentState.jobUntil > now ? 9_500 : 14_000 + (seed % 5) * 1_300;
  const pauseMs = residentState.jobUntil > now ? 4_000 : 2_400 + (seed % 4) * 800;
  const cycleMs = walkMs + pauseMs;
  const localMs = (now + seed * 977) % cycleMs;
  const resting = localMs > walkMs;
  const t = resting ? 1 : smoothstep(localMs / walkMs);
  const previousTarget = PLOTS[(PLOTS.indexOf(wander) + seed + index + 9) % PLOTS.length] || homePlot;
  const start = blendPlot(homePlot, previousTarget, residentState.jobUntil > now ? 0.16 : 0.34);
  const bob = resting ? 0 : Math.sin(t * Math.PI * 5 + seed) * 2.8;
  return {
    start,
    target: targetPlot,
    t,
    resting,
    busy: !!(residentState.jobUntil && residentState.jobUntil > now),
    x: lerp(start.x, targetPlot.x, t) + Math.sin(seed + now / 4200) * (resting ? 2 : 6),
    y: lerp(start.y, targetPlot.y, t) + 30 + bob,
    direction: targetPlot.x >= start.x ? 'right' : 'left'
  };
}

export function residentPosition(state, residentDef, index = 0, now = Date.now()) {
  const plan = residentRoutePlan(state, residentDef, index, now);
  return {
    x: Math.round(clamp(plan.x, 24, MAP_BOUNDS.width - 24)),
    y: Math.round(clamp(plan.y, 38, MAP_BOUNDS.height - 24)),
    busy: plan.busy,
    resting: plan.resting,
    direction: plan.direction
  };
}

function clone(state) { return JSON.parse(JSON.stringify(state)); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); }
function stableSeed(text) { return [...text].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 9973, 17); }
function blendPlot(a, b, mix = 0.5) { return { id: `${a.id || 'a'}-${b.id || 'b'}`, x: lerp(a.x, b.x, mix), y: lerp(a.y, b.y, mix) }; }
