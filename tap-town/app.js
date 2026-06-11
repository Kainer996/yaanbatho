import {
  VERSION, BUILDINGS, RESIDENTS, PLOTS, QUESTS, MAP_BOUNDS,
  createInitialState, migrateState, getLevel, getLevelProgress, getPlot,
  energySummary, happinessSummary, currentQuest, questProgress,
  buyBuilding, collectBuilding, claimQuest, moveBuilding, startResidentJob,
  finishResidentJobs, canCollect, remainingBuildMs, remainingCollectMs, formatTime,
  clampCamera, centerCamera, residentPosition
} from './app-core.js?v=20260608-bigmap-1';

const BASE = '/tap-town/';
const SAVE_KEY = 'tap-town-expanded-save-v1';
const OLD_SAVE_KEY = 'tap-town-rebuilt-save-v2';
const app = document.getElementById('app');
let now = Date.now();
let state = loadState();
let toastTimer = 0;
let dragging = null;
let toast = 'Build, collect, move, and send residents across the bigger town.';
let isFullscreen = false;

function asset(path) { return `${BASE}${path}`; }
function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY) || localStorage.getItem(OLD_SAVE_KEY);
    return migrateState(raw ? JSON.parse(raw) : null, Date.now());
  } catch { return createInitialState(Date.now()); }
}
function save() { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, version: VERSION })); }
function showToast(message) { toast = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast = ''; render(); }, 2800); render(); }
function viewport() { const r = app.querySelector('.map-wrap')?.getBoundingClientRect(); return { width: r?.width || innerWidth || 390, height: r?.height || innerHeight || 720 }; }
function setState(next, message) { state = finishResidentJobs(next, now); state.happiness = happinessSummary(state); state.camera = clampCamera(state.camera, viewport()); save(); if (message) showToast(message); else render(); }

function render() {
  syncFullscreenClass();
  now = Date.now();
  state = finishResidentJobs(state, now);
  state.camera = clampCamera(state.camera, viewport());
  const level = getLevel(state.xp);
  const energy = energySummary(state);
  const quest = currentQuest(state);
  const q = questProgress(state, quest);
  const selected = state.placed.find(b => b.id === state.selectedId);
  const filters = ['all', 'home', 'shop', 'work', 'power', 'decor', 'fun'];
  app.innerHTML = `
    <main class="game ${state.activeTool === 'move' ? 'is-moving' : ''} ${isFullscreen ? 'is-fullscreen' : ''}" data-version="${VERSION}" data-fullscreen="${isFullscreen ? 'on' : 'off'}">
      <header class="hud">
        <div class="brand">
          <div class="brand-badge">T</div>
          <div><strong>Tap Town</strong><span>bigger living map</span></div>
        </div>
        <div class="stat-row">
          ${stat('Coins', state.coins, '🪙')}
          ${stat('XP', `${getLevelProgress(state.xp)}/120`, '⭐')}
          ${stat('Lvl', level, '🏙️')}
          ${stat('Energy', `${energy.used}/${energy.max}`, '⚡', energy.used > energy.max ? 'bad' : '')}
          ${stat('Happy', `${state.happiness || 72}%`, '😊')}
        </div>
      </header>

      <aside class="quest-card ${q.ready ? 'ready' : ''}">
        <div>
          <small>Current quest</small>
          <strong>${quest.title}</strong>
          <span>${quest.body}</span>
        </div>
        <button class="claim-btn" data-action="claim" ${q.ready ? '' : 'disabled'}>${q.value}/${q.goal}</button>
      </aside>

      <section class="map-wrap" aria-label="Town map">
        <div class="map-stage" style="width:${MAP_BOUNDS.width}px;height:${MAP_BOUNDS.height}px;transform:translate(${state.camera.x}px, ${state.camera.y}px) scale(${state.camera.scale})">
          <div class="map-art"></div>
          <div class="map-label north">North meadow</div>
          <div class="map-label east">Market ridge</div>
          <div class="map-label south">Sunpatch fields</div>
          ${PLOTS.map(plotButton).join('')}
          ${state.placed.map(buildingNode).join('')}
          ${RESIDENTS.map(residentNode).join('')}
        </div>
        <div class="map-tools">
          <button data-action="zoom-in" aria-label="Zoom in">+</button>
          <button data-action="zoom-out" aria-label="Zoom out">−</button>
          <button data-action="center" aria-label="Center town">⌖</button>
          <button data-action="fullscreen" class="fullscreen-btn" aria-label="${isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}">${isFullscreen ? '↙' : '⛶'}</button>
        </div>
        <div class="toast ${toast ? 'show' : ''}">${toast || ''}</div>
      </section>

      <aside class="side-panel">
        ${selected ? buildingPanel(selected) : controlPanel(filters)}
      </aside>

      <nav class="tool-bar" aria-label="Game tools">
        ${toolButton('build', 'BUILD', '🏗️')}
        ${toolButton('move', 'MOVE', '↔️')}
        ${toolButton('tasks', 'TASKS', '📋')}
        ${toolButton('people', 'PEOPLE', '🙂')}
        <button data-action="reset" class="danger">RESET</button>
      </nav>
    </main>`;
}

function stat(label, value, icon, extra = '') { return `<div class="stat ${extra}"><span>${icon} ${label}</span><strong>${value}</strong></div>`; }
function toolButton(tool, label, icon) { return `<button data-tool="${tool}" class="${state.activeTool === tool ? 'active' : ''}"><span>${icon}</span>${label}</button>`; }
function plotButton(p) {
  const occupied = state.placed.some(b => b.plotId === p.id);
  const canUse = !occupied && (state.activeTool === 'build' || (state.activeTool === 'move' && state.selectedId));
  return `<button class="plot ${canUse ? 'can-use' : ''}" data-plot="${p.id}" style="left:${p.x}px;top:${p.y}px" aria-label="Plot ${p.id}"><span>${canUse ? '+' : ''}</span></button>`;
}
function buildingNode(b) {
  const def = BUILDINGS[b.type];
  const p = getPlot(b.plotId);
  const ready = canCollect(b, now);
  const buildMs = remainingBuildMs(b, now);
  const timer = buildMs > 0 ? formatTime(buildMs) : formatTime(remainingCollectMs(b, now));
  return `<button class="building ${ready ? 'ready' : ''} ${state.selectedId === b.id ? 'selected' : ''}" data-building="${b.id}" style="left:${p.x}px;top:${p.y}px" aria-label="${def.name}, ${timer}">
    <img src="${asset(`assets/sprites/buildings/${def.sprite}`)}" alt="" loading="eager" />
    <span class="income">${ready ? 'Collect' : timer}</span>
  </button>`;
}
function residentNode(rDef, i) {
  const r = state.residents.find(x => x.id === rDef.id) || {};
  const pos = residentPosition(state, rDef, i, now);
  const label = pos.busy ? `${rDef.name} working ${formatTime(r.jobUntil - now)}` : `${rDef.name}, ${rDef.role}, ${pos.resting ? 'having a little pause' : 'walking through town'}`;
  return `<button class="resident ${pos.busy ? 'busy' : ''} ${pos.resting ? 'resting' : 'walking'} ${pos.direction === 'left' ? 'faces-left' : ''}" data-resident="${rDef.id}" style="left:${pos.x}px;top:${pos.y}px" aria-label="${label}">
    <img src="${asset(`assets/sprites/characters/${rDef.sprite}`)}" alt="" />
  </button>`;
}
function controlPanel(filters) {
  if (state.activeTool === 'tasks') return tasksPanel();
  if (state.activeTool === 'people') return peoplePanel();
  const items = Object.entries(BUILDINGS).filter(([_, d]) => state.activeFilter === 'all' || d.type === state.activeFilter);
  return `<div class="panel-head"><strong>Build menu</strong><span>${PLOTS.length} plots across the expanded map.</span></div>
    <div class="filter-row">${filters.map(f => `<button data-filter="${f}" class="${state.activeFilter === f ? 'active' : ''}">${f}</button>`).join('')}</div>
    <div class="shop-grid">${items.map(([type, d]) => shopCard(type, d)).join('')}</div>
    <div class="tip-box"><strong>Bigger map:</strong> drag to pan across the new meadows, market ridge, and southern fields. Residents now walk routes and pause instead of orbiting.</div>`;
}
function shopCard(type, d) {
  const level = getLevel(state.xp);
  const energy = energySummary(state);
  const locked = level < d.level;
  const unaffordable = state.coins < d.cost;
  const noPower = d.energy > 0 && energy.used + d.energy > energy.max;
  const selected = state.selectedBuilding === type;
  const note = locked ? `Level ${d.level}` : noPower ? 'Need power' : unaffordable ? 'Need coins' : 'Ready';
  return `<button class="shop-card ${selected ? 'selected' : ''}" data-select-building="${type}" ${locked ? 'aria-disabled="true"' : ''}>
    <img src="${asset(`assets/sprites/buildings/${d.sprite}`)}" alt="" />
    <strong>${d.name}</strong><span>${d.hook}</span><b>${d.cost} 🪙</b><em>${note}</em>
  </button>`;
}
function buildingPanel(b) {
  const def = BUILDINGS[b.type];
  const ready = canCollect(b, now);
  const buildMs = remainingBuildMs(b, now);
  const timer = buildMs > 0 ? `Building: ${formatTime(buildMs)}` : ready ? 'Income ready now' : `Income in ${formatTime(remainingCollectMs(b, now))}`;
  const jobs = RESIDENTS.filter(r => r.likes.includes(b.type));
  return `<div class="building-sheet">
    <button class="close" data-action="close">×</button>
    <img src="${asset(`assets/sprites/buildings/${def.sprite}`)}" alt="" />
    <small>${def.type.toUpperCase()}</small><h2>${def.name}</h2>
    <p>${def.hook}</p><strong class="timer-line">${timer}</strong>
    <div class="sheet-actions">
      <button data-action="collect" data-id="${b.id}" ${ready ? '' : 'disabled'}>Collect ${def.income} 🪙</button>
      <button data-action="move-selected" data-id="${b.id}">Move</button>
    </div>
    <div class="job-row">${jobs.map(r => `<button data-start-job="${r.id}" data-id="${b.id}">${r.name} job</button>`).join('')}</div>
  </div>`;
}
function tasksPanel() {
  return `<div class="panel-head"><strong>Quest list</strong><span>Short goals make the loop satisfying.</span></div>
    <div class="task-list">${QUESTS.map(quest => {
      const p = questProgress(state, quest);
      const done = state.questClaims.includes(quest.id);
      return `<div class="task ${p.ready ? 'ready' : ''} ${done ? 'done' : ''}"><strong>${quest.title}</strong><span>${quest.body}</span><progress max="${p.goal}" value="${p.value}"></progress><button data-claim-id="${quest.id}" ${p.ready && !done ? '' : 'disabled'}>${done ? 'Done' : `${p.value}/${p.goal}`}</button></div>`;
    }).join('')}</div>`;
}
function peoplePanel() {
  return `<div class="panel-head"><strong>Residents</strong><span>Walking errands, jobs, and little pauses.</span></div><div class="people-list">
    ${RESIDENTS.map(r => { const s = state.residents.find(x => x.id === r.id) || {}; const busy = s.jobUntil > now; return `<div class="person"><img src="${asset(`assets/sprites/characters/${r.sprite}`)}" alt=""/><div><strong>${r.name}</strong><span>${r.role} · mood ${s.mood || 70}%</span><small>${busy ? `Working ${formatTime(s.jobUntil - now)}` : `Likes ${r.likes.map(x => BUILDINGS[x].name).join(', ')}`}</small></div></div>`; }).join('')}
  </div>`;
}

app.addEventListener('click', event => {
  const el = event.target.closest('button');
  if (!el) return;
  try {
    if (el.dataset.tool) { state.activeTool = el.dataset.tool; state.selectedId = null; save(); render(); return; }
    if (el.dataset.filter) { state.activeFilter = el.dataset.filter; save(); render(); return; }
    if (el.dataset.selectBuilding) { state.selectedBuilding = el.dataset.selectBuilding; state.activeTool = 'build'; save(); showToast(`${BUILDINGS[state.selectedBuilding].name}: choose a glowing plot.`); return; }
    if (el.dataset.plot) return handlePlot(el.dataset.plot);
    if (el.dataset.building) {
      const b = state.placed.find(item => item.id === el.dataset.building);
      if (b && canCollect(b, now)) return setState(collectBuilding(state, b.id, now), `${BUILDINGS[b.type].name} paid out.`);
      state.selectedId = el.dataset.building; save(); render(); return;
    }
    if (el.dataset.action === 'claim') return setState(claimQuest(state), 'Quest claimed. Lovely little dopamine ding.');
    if (el.dataset.claimId) return setState(claimQuest(state, el.dataset.claimId), 'Quest reward claimed.');
    if (el.dataset.action === 'collect') return setState(collectBuilding(state, el.dataset.id, now), 'Coins collected.');
    if (el.dataset.action === 'move-selected') { state.activeTool = 'move'; state.selectedId = el.dataset.id; save(); showToast('Choose an empty plot to move it.'); return; }
    if (el.dataset.action === 'close') { state.selectedId = null; save(); render(); return; }
    if (el.dataset.startJob) return setState(startResidentJob(state, el.dataset.startJob, el.dataset.id, now), 'Resident job started.');
    if (el.dataset.action === 'zoom-in') { state.camera = clampCamera({ ...state.camera, scale: state.camera.scale + 0.08 }, viewport()); save(); render(); return; }
    if (el.dataset.action === 'zoom-out') { state.camera = clampCamera({ ...state.camera, scale: state.camera.scale - 0.08 }, viewport()); save(); render(); return; }
    if (el.dataset.action === 'center') { state.camera = centerCamera(viewport(), matchMedia('(orientation: landscape)').matches ? 0.66 : 0.74); save(); render(); return; }
    if (el.dataset.action === 'fullscreen') return toggleFullscreen();
    if (el.dataset.action === 'reset' && confirm('Reset Tap Town save?')) { state = createInitialState(Date.now()); state.camera = centerCamera(viewport(), state.camera.scale); save(); showToast('Town reset. Fresh bigger canvas.'); return; }
  } catch (err) { showToast(err.message); }
});

function nativeFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}
function syncFullscreenClass() {
  const nativeActive = !!nativeFullscreenElement();
  isFullscreen = nativeActive || document.body.classList.contains('tap-town-fill-screen');
  document.body.classList.toggle('tap-town-fullscreen', isFullscreen);
  document.querySelector('.game')?.setAttribute('data-fullscreen', isFullscreen ? 'on' : 'off');
}
async function toggleFullscreen() {
  const game = app.querySelector('.game') || app;
  try {
    if (isFullscreen) {
      document.body.classList.remove('tap-town-fill-screen');
      if (nativeFullscreenElement() && document.exitFullscreen) await document.exitFullscreen();
      else if (nativeFullscreenElement() && document.webkitExitFullscreen) document.webkitExitFullscreen();
      syncFullscreenClass();
      showToast('Fullscreen off.');
      return;
    }
    document.body.classList.add('tap-town-fill-screen');
    if (game.requestFullscreen) await game.requestFullscreen({ navigationUI: 'hide' });
    else if (game.webkitRequestFullscreen) game.webkitRequestFullscreen();
    syncFullscreenClass();
    state.camera = clampCamera(state.camera, viewport());
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    showToast(nativeFullscreenElement() ? 'Fullscreen on.' : 'Fill-screen mode on.');
  } catch (err) {
    document.body.classList.add('tap-town-fill-screen');
    syncFullscreenClass();
    state.camera = clampCamera(state.camera, viewport());
    showToast('Fill-screen mode on.');
  }
}

document.addEventListener('fullscreenchange', () => { syncFullscreenClass(); state.camera = clampCamera(state.camera, viewport()); render(); });
document.addEventListener('webkitfullscreenchange', () => { syncFullscreenClass(); state.camera = clampCamera(state.camera, viewport()); render(); });
window.addEventListener('resize', () => { state.camera = clampCamera(state.camera, viewport()); save(); });

function handlePlot(plotId) {
  try {
    if (state.activeTool === 'move' && state.selectedId) return setState(moveBuilding(state, state.selectedId, plotId), 'Building moved.');
    if (state.activeTool === 'build') return setState(buyBuilding(state, state.selectedBuilding, plotId, now), `${BUILDINGS[state.selectedBuilding].name} started.`);
    showToast('Choose BUILD or MOVE first.');
  } catch (err) { showToast(err.message); }
}

app.addEventListener('pointerdown', event => {
  if (!event.target.closest('.map-wrap') || event.target.closest('button')) return;
  dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, ox: state.camera.x, oy: state.camera.y };
  app.setPointerCapture?.(event.pointerId);
});
app.addEventListener('pointermove', event => {
  if (!dragging || dragging.id !== event.pointerId) return;
  state.camera = clampCamera({ ...state.camera, x: dragging.ox + event.clientX - dragging.x, y: dragging.oy + event.clientY - dragging.y }, viewport());
  const stage = app.querySelector('.map-stage');
  if (stage) stage.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px) scale(${state.camera.scale})`;
});
app.addEventListener('pointerup', () => { if (dragging) { dragging = null; save(); } });
app.addEventListener('pointercancel', () => { dragging = null; });

setInterval(render, 350);
window.__tapTown = {
  get state() { return state; }, VERSION, BUILDINGS, MAP_BOUNDS, PLOTS,
  energySummary, questProgress: () => questProgress(state), residentPosition: (id, at = Date.now()) => residentPosition(state, RESIDENTS.find(r => r.id === id) || RESIDENTS[0], RESIDENTS.findIndex(r => r.id === id), at),
  toggleFullscreen, centerCamera: () => { state.camera = centerCamera(viewport(), state.camera.scale); save(); render(); },
  get isFullscreen() { return isFullscreen; }, reset: () => { state = createInitialState(Date.now()); save(); render(); }
};
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/tap-town/sw.js?v=20260608-bigmap-1').catch(() => {});
render();
