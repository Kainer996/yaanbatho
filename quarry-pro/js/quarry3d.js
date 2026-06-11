/**
 * QuarryPro — 3D Interactive Quarry Simulator
 * Built with Three.js 0.161.0 (ES Modules)
 * Bankfield Quarry, Clitheroe
 */

import * as THREE from 'https://esm.sh/three@0.161.0';
import { OrbitControls } from 'https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import {
  createInitialGameState,
  buildStarterQuarryState,
  buildDirectFeedStarterState,
  placeEquipmentInState,
  sellEquipmentInState,
  recordBlast,
  recordQuarryFaceBlast,
  completeHaulCycle,
  completeExcavatorCrusherCycle,
  completeEdgeHaulCycle,
  completePlantFeedCycle,
  sellStockpileLoad,
  loadDumperFromScreenedStockpile,
  tipDumperToEdgeStockpile,
  productToEdgeKey,
  takeBankLoan,
  getEquipmentCost,
  getEquipmentOperatorStatus,
  getRequiredTicketForEquipment,
  assignStaffToEquipment,
  totalScreenedStockpiles,
  totalEdgeStockpiles,
  shouldHaulProductToEdge,
  getEdgeHaulPlayabilityStatus,
  getEdgeHaulEvidence,
  getDumperLoad,
  getBestSellableProductKey,
  getDirectFeedProofEvidence,
  getOperationsSnapshot,
  applyDustSuppression,
  updateWaterState,
  applyBlastWaterIngress,
  pumpPitWater,
  dispatchTractorToLagoons,
  sellCouncilWater,
} from './quarry-game-core.mjs?v=20260604-playable-glass-ui';
import {
  getStaffHireCost,
  getTicketLabel,
} from './quarry-staff-core.mjs?v=20260521-staff-operators';
import {
  BACKDROP_GROUND_Y,
  BENCH_BLAST_HALF_WIDTH_CELLS,
  BENCH_WALL_CELLS,
  GRID,
  CELL,
  HALF,
  QUARRY_FACE,
  getInitialTerrainHeight,
  getTerrainAnchoredY,
  isPointInsideBlastClearance,
  getBenchedBlastHeight,
  getNextUnlockedBenchFloor,
  getRampAdjustedHeight,
  gridToWorld,
  isQuarryFaceGrid,
  worldToGrid,
} from './quarry-terrain-core.mjs?v=20260603-product-pile-ground';
import {
  EXCAVATOR_ANIMATION,
  EXCAVATOR_POSE,
  createEdgeHaulRoute,
  createPlantFeedRoute,
  getDirectFeedProofCameraPlan,
  getDirectFeedProofGuidePlan,
  getBlastActionUiState,
  getEdgeHaulRouteUiState,
  getExcavatorCrusherTrackingDecision,
  getDumperLoaderParkingTarget,
  getLoaderProductCyclePlan,
  getLoaderProductCycleUiState,
  getCrusherTipCyclePlan,
  getPlantProcessingAnimationPlan,
  getRotatedEquipmentYaw,
  getAutonomousPlantFeedVisualPlan,
  getExcavatorCrusherFeedCyclePlan,
  getExcavatorCrusherFeedUiState,
  getPlantFeedRouteUiState,
  getRouteProgressState,
  getScreenerDischargeFlows,
  getPileCenterY,
  getScaledChildPileLocalY,
  getLoosePileRestingY,
  stepGravityParticle,
  getVehicleYawForDirection,
  getEquipmentPopupViewportLayout,
  getFullscreenPanelNavigationPlan,
  shouldShowQuarryFaceOutline,
} from './quarry-equipment-core.mjs?v=20260603-product-pile-ground';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const TONNES_PER_BLAST = 500;
const TONNES_PER_FACE_BLAST = 1800;

const COL_LIMESTONE = new THREE.Color(0xb7b2a6);
const COL_PIT_FLOOR = new THREE.Color(0x5f5b55);
const COL_SKY       = new THREE.Color(0x93b5c6);
const COL_DEEP_ROCK = new THREE.Color(0x4e5359);
const COL_TEAL_GLOW = new THREE.Color(0x35f1df);
const CACHE_MARKER  = '20260604-playable-glass-ui';

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════
let scene, camera, renderer, controls, clock, raycaster, pointer;
let terrainMesh;
let heightmap;          // Float32Array — one Y per vertex

let activeTool    = 'blast';
let blastMarkers  = [];
let placedEquip   = [];
let particles     = [];
let looseGroundPiles = [];
let aggregateStockpiles = [];
let edgeStockpiles = [];
let terrainAnchoredObjects = [];
let activeEdgeHaulRouteVisual = null;
let activeDirectFeedProofGuideVisual = null;
let activeManualEdgeHaulFrame = null;
let activeManualEdgeHaulTimeout = null;
let activeManualEdgeHaulDumper = null;
let activeEdgeHaulEvidence = null;
let selectedEquipment = null;
let fullscreenOverlayPanelState = null;
let pendingNewEquipmentId = null;
let pendingEquipmentMove = null;
let activePlantProcessingVisual = null;
let activePlantFeedOwner = null;
let dustSuppressionRig = null;
let lagoonVisuals = [];
let cinematicRouteVisuals = [];
let lastSnapshotEmit = 0;
let manualEdgeHaulRunId = 0;
let nextDumperId = 1;
const EDGE_BUTTON_IDLE_LABEL = '🚛 Tip Edge';
const STARTER_DEMO_FACE_GRID = { ix: 32, iz: 30 };
const STARTER_DEMO_EQUIPMENT = Object.freeze([
  { type: 'excavator', x: -38, z: -48, yaw: 0.15 },
  { type: 'dumper', x: -18, z: -30, yaw: 0.2 },
  { type: 'crusher', x: 2, z: -42, yaw: 0 },
  { type: 'screener', x: 34, z: -42, yaw: 0 },
  { type: 'loader', x: 48, z: -22, yaw: -0.35 },
]);
const DIRECT_FEED_DEMO_EQUIPMENT = Object.freeze([
  { type: 'excavator', x: -36, z: -48, yaw: 0.18 },
  { type: 'crusher', x: -8, z: -42, yaw: 0 },
  { type: 'screener', x: 27, z: -42, yaw: 0 },
]);

let stats = {
  tonnes:     0,
  vehicles:   0,
  blasts:     0,
  shiftStart: Date.now(),
};

let gameState = createInitialGameState();

// Shared materials (created once)
const M = {};

// ═══════════════════════════════════════════════════════════════
// INJECT HTML — replaces panel-simulation content
// ═══════════════════════════════════════════════════════════════
function injectHTML() {
  const panel = document.getElementById('panel-simulation');
  if (!panel) return;

  panel.style.padding = '0';
  panel.style.overflow = 'hidden';

  panel.innerHTML = `
  <div id="q3d-root" style="
    position:relative; width:100%; height:100%; flex:1; min-height:0;
    display:flex; flex-direction:column;
    background:#0a0a0a; overflow:hidden;
  ">
    <!-- ── Canvas wrap ── -->
    <div id="q3d-wrap" style="position:relative; flex:1; overflow:hidden; min-height:0;">
      <style>
        #q3d-wrap::before {
          content:''; position:absolute; inset:0; z-index:2; pointer-events:none;
          background:
            radial-gradient(circle at 54% 43%, rgba(255,207,144,0.035), transparent 34%),
            linear-gradient(180deg, rgba(4,8,14,0.02), rgba(5,8,13,0.10) 74%, rgba(5,7,10,0.22));
          mix-blend-mode:normal;
        }
        #q3d-wrap::after {
          content:''; position:absolute; inset:0; z-index:3; pointer-events:none;
          background:radial-gradient(circle at 50% 48%, transparent 58%, rgba(3,4,8,0.18) 100%);
        }
        .q3d-glass, .q3d-hud-card,
        .q3d-tool, #q3d-starter-btn, #q3d-loan-btn, #q3d-process-btn, #q3d-edge-btn, #q3d-reset,
        #q3d-fullscreen-btn, .q3d-nav-btn, #q3d-fullscreen-panel-close, #q3d-detonate-btn, #q3d-remove-blast-btn, #q3d-popup button {
          border:1px solid rgba(111,197,255,0.28) !important;
          border-radius:16px !important;
          background:linear-gradient(145deg, rgba(7,13,24,0.88), rgba(16,27,44,0.58)) !important;
          color:#edf7ff !important;
          box-shadow:0 14px 36px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.16) !important;
          backdrop-filter:blur(10px) saturate(1.28); -webkit-backdrop-filter:blur(10px) saturate(1.28);
          text-shadow:0 1px 7px rgba(0,0,0,0.78);
        }
        .q3d-hud-card { padding:7px 10px; font-size:0.68rem; font-weight:800; }
        .q3d-hud-card strong { color:#58d8ff; }
        .q3d-tool:hover, #q3d-starter-btn:hover, #q3d-loan-btn:hover, #q3d-process-btn:hover, #q3d-edge-btn:hover, #q3d-reset:hover,
        #q3d-fullscreen-btn:hover, .q3d-nav-btn:hover, #q3d-fullscreen-panel-close:hover, #q3d-popup button:hover {
          transform:translateY(-1px); border-color:rgba(88,216,255,0.72) !important;
          box-shadow:0 18px 44px rgba(0,0,0,0.42), 0 0 24px rgba(53,241,223,0.14), inset 0 1px 0 rgba(255,255,255,0.24) !important;
        }
        .q3d-tool[data-tool="blast"], #q3d-detonate-btn {
          border-color:rgba(255,80,80,0.72) !important;
          background:linear-gradient(145deg, rgba(190,0,0,0.92), rgba(80,10,16,0.72)) !important;
        }
        #q3d-starter-btn { border-color:rgba(88,166,255,0.72) !important; background:linear-gradient(145deg, rgba(12,32,58,0.92), rgba(13,24,40,0.70)) !important; }
        #q3d-loan-btn { border-color:rgba(63,185,80,0.72) !important; background:linear-gradient(145deg, rgba(14,48,25,0.92), rgba(12,28,17,0.72)) !important; }
        #q3d-process-btn { border-color:rgba(45,212,191,0.72) !important; background:linear-gradient(145deg, rgba(7,45,43,0.92), rgba(8,28,35,0.72)) !important; }
        #q3d-edge-btn { border-color:rgba(255,209,102,0.72) !important; color:#ffe3a5 !important; background:linear-gradient(145deg, rgba(60,38,8,0.92), rgba(28,20,10,0.72)) !important; }
        #q3d-reset { opacity:0.78; }
        #q3d-toolbar { filter:drop-shadow(0 22px 34px rgba(0,0,0,0.30)); }
        #q3d-toolbar > div:first-child { color:#ff3d3d !important; text-shadow:0 0 10px rgba(255,0,0,0.16); }
        .q3d-cnt { border-radius:10px !important; background:rgba(255,255,255,0.12) !important; padding:3px 8px !important; }
        #q3d-cinematic-panel { display:none !important; }
        .q3d-mini-grid { display:grid; grid-template-columns:1.15fr 0.85fr; gap:9px; margin-top:9px; }
        .q3d-mini-card { background:rgba(1,7,18,0.46); border:1px solid rgba(95,211,255,0.15); border-radius:12px; padding:9px; min-height:52px; }
        .q3d-chart-line { height:34px; border-radius:8px; background:linear-gradient(135deg, rgba(42,245,203,0.20), rgba(49,130,255,0.08)); position:relative; overflow:hidden; }
        .q3d-chart-line::before { content:''; position:absolute; inset:8px 4px 7px; background:linear-gradient(120deg, transparent 0 10%, #35f1df 11% 13%, transparent 14% 27%, #58a6ff 28% 30%, transparent 31% 48%, #39ff88 49% 51%, transparent 52% 70%, #35f1df 71% 73%, transparent 74%); filter:drop-shadow(0 0 5px #35f1df); }
        .q3d-gauge { width:54px; height:54px; border-radius:50%; background:conic-gradient(#34f5c5 0 176deg, rgba(255,255,255,0.12) 176deg 360deg); display:grid; place-items:center; margin:auto; box-shadow:0 0 18px rgba(52,245,197,0.20); }
        .q3d-gauge span { width:38px; height:38px; border-radius:50%; background:#07111f; display:grid; place-items:center; font-size:0.62rem; color:#eaf7ff; font-weight:900; }
        .q3d-route-strip { height:4px; border-radius:99px; margin-top:8px; background:linear-gradient(90deg, #35f1df, #58a6ff, #39ff88); box-shadow:0 0 14px rgba(53,241,223,0.62); }
        @media (max-width:760px) { .q3d-hud-card { padding:6px 8px; font-size:0.61rem; } }
      </style>

      <!-- Mobile game HUD -->
      <div id="q3d-game-hud" style="
        position:absolute; top:10px; left:50%; transform:translateX(-50%); z-index:24;
        display:flex; gap:8px; align-items:center; justify-content:center; flex-wrap:wrap;
        max-width:min(760px, calc(100% - 24px)); pointer-events:none;
      ">
        <div class="q3d-hud-card">💷 <strong id="q3d-cash">£25,000</strong></div>
        <div class="q3d-hud-card">🏦 <strong id="q3d-loan">£30,000</strong></div>
        <div class="q3d-hud-card">⭐ L<span id="q3d-level">1</span></div>
        <div class="q3d-hud-card">🪨 Shot <strong id="q3d-shot">0t</strong></div>
        <div class="q3d-hud-card">📦 Products <strong id="q3d-products">0t</strong></div>
        <div class="q3d-hud-card">💨 Dust <strong id="q3d-dust">12</strong></div>
        <div class="q3d-hud-card">💧 Water <strong id="q3d-water">Safe</strong></div>
        <div class="q3d-hud-card q3d-loop-status" id="q3d-loop-status" style="max-width:360px; color:#ffd58a;">Edge haul: process rock into product</div>
        <div class="q3d-hud-card q3d-objective" id="q3d-objective">Mark and fire a blast to create shot rock</div>
      </div>

      <div id="q3d-cinematic-panel">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div>
            <div style="font-size:0.58rem;color:#58d8ff;text-transform:uppercase;letter-spacing:1.8px;font-weight:950;">Fleet management</div>
            <div style="font-size:1rem;font-weight:950;line-height:1.1;">QuarryPro Live Quarry</div>
          </div>
          <div style="font-size:0.58rem;color:#9ffbe9;border:1px solid rgba(53,241,223,0.38);border-radius:999px;padding:4px 7px;background:rgba(53,241,223,0.10);">AI ROUTES</div>
        </div>
        <div class="q3d-mini-grid">
          <div class="q3d-mini-card">
            <div style="font-size:0.58rem;color:#91a8bb;text-transform:uppercase;margin-bottom:5px;">Data charts</div>
            <div class="q3d-chart-line"></div>
          </div>
          <div class="q3d-mini-card" style="text-align:center;">
            <div style="font-size:0.58rem;color:#91a8bb;text-transform:uppercase;margin-bottom:4px;">Gauge</div>
            <div class="q3d-gauge"><span id="q3d-glass-gauge">49%</span></div>
          </div>
          <div class="q3d-mini-card" style="grid-column:1 / -1;">
            <div style="display:flex;justify-content:space-between;gap:8px;font-size:0.62rem;color:#d8f7ff;"><span>Vehicle A · hauling</span><span id="q3d-glass-tonnes">0t</span></div>
            <div class="q3d-route-strip"></div>
          </div>
        </div>
      </div>

      <!-- Toolbar: tools -->
      <div id="q3d-toolbar" style="
        position:absolute; top:12px; left:12px; z-index:20;
        display:flex; flex-direction:column; gap:5px;
      ">
        <div style="font-size:0.6rem;color:#cc0000;text-transform:uppercase;
          letter-spacing:2px;font-weight:700;margin-bottom:3px;">
          ▶ Tools
        </div>
        ${['blast','dumper','excavator','loader','crusher','screener'].map(t => `
          <button class="q3d-tool" data-tool="${t}" style="
            display:flex; justify-content:space-between; align-items:center;
            width:122px; padding:7px 10px; border-radius:5px; cursor:pointer;
            font-size:0.7rem; font-weight:700; text-transform:uppercase;
            letter-spacing:0.8px; border:1px solid;
            background:${t === 'blast' ? '#cc0000' : '#111'};
            border-color:${t === 'blast' ? '#cc0000' : '#2a2a2a'};
            color:#fff; transition:all 0.15s;
          ">
            <span>${toolMeta(t).icon} ${t}</span>
            <span class="q3d-cnt" id="q3d-cnt-${t}" style="
              background:rgba(255,255,255,0.1); border-radius:3px;
              padding:1px 5px; font-size:0.6rem; min-width:16px; text-align:center;
            ">${t === 'blast' ? '💣' : '0'}</span>
          </button>
        `).join('')}

        <!-- Quick actions -->
        <div style="margin-top:8px; display:flex; flex-direction:column; gap:4px;">
          <button id="q3d-starter-btn" style="
            width:122px; padding:7px 6px; border-radius:4px; cursor:pointer;
            font-size:0.64rem; font-weight:800; text-transform:uppercase;
            background:#10233a; border:1px solid #58a6ff; color:#c9e6ff;
          ">▶ Starter quarry</button>
          <button id="q3d-loan-btn" style="
            width:122px; padding:6px; border-radius:4px; cursor:pointer;
            font-size:0.65rem; font-weight:600; text-transform:uppercase;
            background:#18220f; border:1px solid #3fb950; color:#b7f7bf;
          ">🏦 Loan £10k</button>
          <button id="q3d-process-btn" style="
            width:122px; padding:6px; border-radius:4px; cursor:pointer;
            font-size:0.65rem; font-weight:700; text-transform:uppercase;
            background:#14201f; border:1px solid #2dd4bf; color:#b8fff7;
          ">🏭 Process load</button>
          <button id="q3d-edge-btn" style="
            width:122px; padding:6px; border-radius:4px; cursor:pointer;
            font-size:0.65rem; font-weight:600; text-transform:uppercase;
            background:#24180b; border:1px solid #d29922; color:#ffd58a;
          ">🚛 Tip Edge</button>
          <button id="q3d-reset" style="
            width:122px; padding:6px; border-radius:4px; cursor:pointer;
            font-size:0.65rem; font-weight:600; text-transform:uppercase;
            background:#111; border:1px solid #2a2a2a; color:#666;
          ">↺ Reset Scene</button>
        </div>
      </div>

      <!-- Top-right hint -->
      <div id="q3d-direct-proof" style="
        display:none; position:absolute; right:12px; top:92px; z-index:29;
        width:min(330px, calc(100% - 156px)); max-width:calc(100% - 24px);
        background:linear-gradient(145deg, rgba(2,8,16,0.90), rgba(8,28,42,0.78));
        border:1px solid rgba(45,212,191,0.72); border-radius:10px;
        padding:10px 12px; color:#d7fffa; font-size:0.68rem; line-height:1.42;
        box-shadow:0 12px 34px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.12);
        pointer-events:none; text-shadow:0 1px 4px rgba(0,0,0,0.85);
      ">
        <div id="q3d-proof-label" style="font-size:0.72rem;font-weight:950;letter-spacing:1.2px;color:#ffffff;text-transform:uppercase;">Private proof</div>
        <div id="q3d-proof-mode" style="margin-top:2px;color:#8ff7e9;font-weight:800;">?demo=direct-feed</div>
        <div id="q3d-proof-note" style="margin-top:5px;color:#b7fff7;">Internal AHS Control Station proof</div>
        <div id="q3d-proof-metrics" style="margin-top:7px;display:grid;grid-template-columns:1fr 1fr;gap:3px 10px;color:#eefdfb;"></div>
        <div id="q3d-proof-checks" style="margin-top:7px;color:#9ff5df;"></div>
        <div id="q3d-proof-time" style="margin-top:6px;color:#87a8a4;font-size:0.58rem;font-family:monospace;"></div>
      </div>

      <!-- Top-right hint -->
        <div id="q3d-hint" style="
        position:absolute; top:12px; right:12px; z-index:20;
        background:rgba(0,0,0,0.75); border:1px solid #222; border-radius:6px;
        padding:8px 12px; font-size:0.68rem; color:#666; text-align:right;
        line-height:1.6; pointer-events:none;
      ">
        👆 Drag · orbit<br>
        🤏 Pinch / scroll · zoom<br>
        Two-finger drag · pan<br>
        Tap plant for Move / Rotate / Sell
      </div>

      <button id="q3d-fullscreen-btn" aria-label="Toggle quarry fullscreen" style="
        position:absolute; right:12px; bottom:14px; z-index:27;
        min-width:118px; padding:9px 11px; border-radius:999px; cursor:pointer;
        border:1px solid #58a6ff; background:rgba(8,20,36,0.92); color:#d7ecff;
        font-size:0.72rem; font-weight:900; text-transform:uppercase; letter-spacing:0.7px;
        box-shadow:0 6px 22px rgba(0,0,0,0.5); touch-action:manipulation;
      ">⛶ Full screen</button>

      <div id="q3d-fullscreen-nav" style="
        display:none; position:absolute; right:12px; top:82px; bottom:88px; z-index:28;
        width:min(150px, 28vw); pointer-events:none;
        background:transparent; border:0; padding:0; box-shadow:none;
      ">
        <div style="display:flex;flex-direction:column;gap:7px;align-items:stretch;justify-content:flex-start;max-height:100%;overflow:auto;padding:2px;">
          ${[
            ['simulation', '🏗️ Map'], ['roster', '👷 Roster'], ['analytics', '📉 Analytics'], ['fleet', '🚛 Fleet'],
            ['production', '📊 Production'], ['kpi', '📈 KPIs'], ['maintenance', '🔧 Maint'], ['stockpile', '⛰️ Stocks'],
            ['blasts', '💥 Blasts'], ['reports', '📄 Reports'], ['settings', '⚙️ Settings']
          ].map(([panel, label]) => `
            <button class="q3d-nav-btn" data-panel="${panel}" style="
              min-height:34px; padding:7px 9px; border-radius:999px; cursor:pointer; touch-action:manipulation;
              pointer-events:auto; border:1px solid rgba(215,236,255,0.58);
              background:linear-gradient(135deg, rgba(9,22,37,0.42), rgba(9,22,37,0.16));
              color:#f4fbff; font-size:0.66rem; font-weight:900; white-space:nowrap;
              text-align:left; text-shadow:0 2px 7px rgba(0,0,0,0.88);
              box-shadow:0 8px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22);
              backdrop-filter:blur(4px) saturate(1.2); -webkit-backdrop-filter:blur(4px) saturate(1.2);
            ">${label}</button>
          `).join('')}
        </div>
      </div>

      <div id="q3d-fullscreen-panel-overlay" style="
        display:none; position:absolute; inset:14px 176px 14px 150px; z-index:29;
        background:linear-gradient(145deg, rgba(6,12,22,0.88), rgba(16,27,44,0.66));
        border:1px solid rgba(111,197,255,0.34); border-radius:18px; overflow:hidden;
        box-shadow:0 30px 80px rgba(0,0,0,0.56), inset 0 1px 0 rgba(255,255,255,0.14);
        backdrop-filter:blur(12px) saturate(1.22); -webkit-backdrop-filter:blur(12px) saturate(1.22);
      ">
        <div style="height:42px; display:flex; align-items:center; justify-content:space-between; gap:10px;
          padding:0 12px; border-bottom:1px solid rgba(111,197,255,0.20); background:rgba(2,8,16,0.38);">
          <strong id="q3d-fullscreen-panel-title" style="color:#f4fbff;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.9px;">Menu</strong>
          <button id="q3d-fullscreen-panel-close" style="
            border:1px solid rgba(255,255,255,0.20); background:rgba(0,0,0,0.36); color:#d7ecff;
            border-radius:999px; padding:6px 10px; cursor:pointer; font-size:0.66rem; font-weight:900;
          ">↩ Back to quarry</button>
        </div>
        <div id="q3d-fullscreen-panel-body" style="height:calc(100% - 42px); overflow:auto;"></div>
      </div>

      <!-- Blast armed actions -->
      <div id="q3d-armed" style="
        display:none; position:absolute; bottom:14px; left:50%;
        transform:translateX(-50%); z-index:26;
        background:rgba(26,0,0,0.94); border:1px solid #cc0000; border-radius:8px;
        padding:8px 10px; color:#ff4444; font-size:0.76rem; font-weight:800;
        letter-spacing:0.8px; white-space:nowrap; box-shadow:0 6px 24px rgba(0,0,0,0.55);
      ">
        <div id="q3d-armed-label" style="text-align:center; margin-bottom:7px;">Blast marker armed</div>
        <div style="display:flex; gap:8px; justify-content:center; align-items:center;">
          <button id="q3d-detonate-btn" style="
            min-width:132px; padding:8px 10px; border-radius:6px; cursor:pointer;
            border:1px solid #ff3b30; background:#cc0000; color:#fff;
            font-size:0.76rem; font-weight:900; text-transform:uppercase; letter-spacing:0.8px;
          ">💥 Detonate</button>
          <button id="q3d-remove-blast-btn" style="
            min-width:112px; padding:8px 10px; border-radius:6px; cursor:pointer;
            border:1px solid #555; background:#111; color:#ddd;
            font-size:0.76rem; font-weight:800; text-transform:uppercase; letter-spacing:0.8px;
          ">✕ Remove</button>
        </div>
      </div>

      <!-- Equipment popup -->
      <div id="q3d-popup" style="
        display:none; position:fixed; z-index:30;
        background:#0d0d0d; border:1px solid #cc0000; border-radius:8px;
        padding:11px 13px; font-size:0.72rem; color:#fff;
        min-width:170px; box-sizing:border-box; overflow-y:auto; overscroll-behavior:contain;
        box-shadow:0 6px 24px rgba(0,0,0,0.9);
      ">
        <div id="q3d-popup-body"></div>
        <button id="q3d-popup-close" style="
          margin-top:9px; background:#1a1a1a; color:#888; border:1px solid #333;
          border-radius:4px; padding:4px 10px; cursor:pointer; font-size:0.68rem;
        ">✕ Close</button>
      </div>
    </div>

    <!-- ── Stats bar ── -->
    <div id="q3d-statsbar" style="
      background:#0d0d0d; border-top:1px solid #1a1a1a;
      padding:10px 20px; display:flex; align-items:center;
      gap:28px; flex-wrap:wrap; flex-shrink:0;
    ">
      <div>
        <div style="font-size:0.6rem;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">💥 Tonnes Blasted</div>
        <div id="q3d-s-tonnes" style="font-size:1.5rem;font-weight:700;color:#cc0000;font-family:monospace;">0</div>
      </div>
      <div>
        <div style="font-size:0.6rem;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">🚛 Vehicles Deployed</div>
        <div id="q3d-s-vehicles" style="font-size:1.5rem;font-weight:700;color:#fff;font-family:monospace;">0</div>
      </div>
      <div>
        <div style="font-size:0.6rem;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">💣 Blasts Fired</div>
        <div id="q3d-s-blasts" style="font-size:1.5rem;font-weight:700;color:#f5a623;font-family:monospace;">0</div>
      </div>
      <div>
        <div style="font-size:0.6rem;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">⏱ Shift Time</div>
        <div id="q3d-s-shift" style="font-size:1.5rem;font-weight:700;color:#aaa;font-family:monospace;">00:00:00</div>
      </div>
      <div style="flex:1; text-align:right;">
        <div style="font-size:0.65rem;color:#333;font-style:italic;">QuarryPro 3D · Bankfield Quarry · Clitheroe</div>
      </div>
    </div>
  </div>`;

  // Bind toolbar buttons
  panel.querySelectorAll('.q3d-tool').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });
  document.getElementById('q3d-reset')?.addEventListener('click', resetScene);
  document.getElementById('q3d-starter-btn')?.addEventListener('click', buildStarterQuarryDemo);
  document.getElementById('q3d-loan-btn')?.addEventListener('click', () => {
    gameState = takeBankLoan(gameState, 10000);
    toastGame('🏦 Bank loan approved: £10,000');
    updateGameHUD();
  });
  document.getElementById('q3d-process-btn')?.addEventListener('click', runManualPlantFeedCycle);
  document.getElementById('q3d-edge-btn')?.addEventListener('click', manualEdgeDumperRun);
  document.getElementById('q3d-sell-btn')?.addEventListener('click', sellBestWagonLoad);
  document.getElementById('q3d-fullscreen-btn')?.addEventListener('click', toggleQuarryFullscreen);
  document.querySelectorAll('.q3d-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchQuarryPanelFromFullscreen(btn.dataset.panel));
  });
  document.getElementById('q3d-fullscreen-panel-close')?.addEventListener('click', () => switchQuarryPanelFromFullscreen('simulation'));
  document.getElementById('q3d-detonate-btn')?.addEventListener('click', detonateArmedBlasts);
  document.getElementById('q3d-remove-blast-btn')?.addEventListener('click', removeArmedBlasts);
  document.getElementById('q3d-popup-close')?.addEventListener('click', () => {
    document.getElementById('q3d-popup').style.display = 'none';
  });
  document.getElementById('q3d-popup')?.addEventListener('click', handleEquipmentPopupClick);
  document.addEventListener('fullscreenchange', syncQuarryFullscreenState);
}

function isQuarryFullscreenActive() {
  const root = document.getElementById('q3d-root');
  return Boolean(root?.dataset.fullscreen === 'true' || document.fullscreenElement === root);
}

async function toggleQuarryFullscreen() {
  const root = document.getElementById('q3d-root');
  if (!root) return;

  const isActive = isQuarryFullscreenActive();
  if (isActive) {
    restoreFullscreenOverlayPanel();
    root.dataset.fullscreen = 'false';
    applyQuarryFullscreenStyles(false);
    if (document.fullscreenElement === root && document.exitFullscreen) {
      try { await document.exitFullscreen(); } catch (_) {}
    }
    syncQuarryFullscreenState();
    return;
  }

  root.dataset.fullscreen = 'true';
  applyQuarryFullscreenStyles(true);
  if (root.requestFullscreen) {
    try { await root.requestFullscreen({ navigationUI: 'hide' }); } catch (_) {}
  }
  syncQuarryFullscreenState();
}

function syncQuarryFullscreenState() {
  const root = document.getElementById('q3d-root');
  if (!root) return;
  const active = root.dataset.fullscreen === 'true' || document.fullscreenElement === root;
  root.dataset.fullscreen = active ? 'true' : 'false';
  applyQuarryFullscreenStyles(active);
}

function applyQuarryFullscreenStyles(active) {
  const root = document.getElementById('q3d-root');
  const stats = document.getElementById('q3d-statsbar');
  const button = document.getElementById('q3d-fullscreen-btn');
  const nav = document.getElementById('q3d-fullscreen-nav');
  if (!root) return;

  if (active) {
    root.style.position = 'fixed';
    root.style.inset = '0';
    root.style.width = '100vw';
    root.style.height = '100dvh';
    root.style.zIndex = '100000';
    root.style.background = '#0a0a0a';
    if (stats) stats.style.display = 'none';
    if (button) button.textContent = '↙ Exit full';
    if (nav) nav.style.display = 'block';
  } else {
    root.style.position = 'relative';
    root.style.inset = '';
    root.style.width = '100%';
    root.style.height = '100%';
    root.style.zIndex = '';
    if (stats) stats.style.display = 'flex';
    if (button) button.textContent = '⛶ Full screen';
    if (nav) nav.style.display = 'none';
  }

  setTimeout(onResize, 60);
}

async function switchQuarryPanelFromFullscreen(panelName) {
  const plan = getFullscreenPanelNavigationPlan({
    panelName,
    fullscreenActive: isQuarryFullscreenActive(),
  });

  if (plan.action === 'close-overlay-panel') {
    restoreFullscreenOverlayPanel();
    setFullscreenNavActive('simulation');
    setTimeout(onResize, 60);
    return;
  }

  if (plan.action === 'show-overlay-panel') {
    showFullscreenOverlayPanel(plan.panelName);
    return;
  }

  restoreFullscreenOverlayPanel();
  const root = document.getElementById('q3d-root');
  if (root) {
    root.dataset.fullscreen = 'false';
    applyQuarryFullscreenStyles(false);
  }
  if (document.fullscreenElement === root && document.exitFullscreen) {
    try { await document.exitFullscreen(); } catch (_) {}
  }
  const navButton = document.querySelector(`.nav-btn[data-panel="${plan.panelName}"]`);
  if (navButton) {
    navButton.click();
  } else if (window.app?.showPanel) {
    window.app.showPanel(plan.panelName);
  }
}

function getFullscreenPanelLabel(panelName) {
  const labels = {
    roster: '👷 Roster',
    analytics: '📉 Analytics',
    fleet: '🚛 Fleet',
    production: '📊 Production',
    kpi: '📈 KPIs',
    maintenance: '🔧 Maintenance',
    stockpile: '⛰️ Stockpiles',
    blasts: '💥 Blasts',
    reports: '📄 Reports',
    settings: '⚙️ Settings',
  };
  return labels[panelName] || panelName;
}

function setFullscreenNavActive(panelName) {
  document.querySelectorAll('.q3d-nav-btn').forEach(btn => {
    const active = btn.dataset.panel === panelName;
    btn.style.borderColor = active ? 'rgba(255,209,102,0.95)' : 'rgba(215,236,255,0.58)';
    btn.style.background = active
      ? 'linear-gradient(135deg, rgba(210,0,0,0.74), rgba(80,10,10,0.34))'
      : 'linear-gradient(135deg, rgba(9,22,37,0.42), rgba(9,22,37,0.16))';
  });
}

function restoreFullscreenOverlayPanel() {
  const overlay = document.getElementById('q3d-fullscreen-panel-overlay');
  const body = document.getElementById('q3d-fullscreen-panel-body');
  if (fullscreenOverlayPanelState?.panel) {
    const { panel, parent, nextSibling, previousDisplay, previousFlexDirection, previousHeight, previousOverflow } = fullscreenOverlayPanelState;
    panel.style.display = previousDisplay || 'none';
    panel.style.flexDirection = previousFlexDirection || '';
    panel.style.height = previousHeight || '';
    panel.style.overflow = previousOverflow || '';
    if (parent) parent.insertBefore(panel, nextSibling || null);
  }
  fullscreenOverlayPanelState = null;
  if (body) body.innerHTML = '';
  if (overlay) overlay.style.display = 'none';
}

function showFullscreenOverlayPanel(panelName) {
  const overlay = document.getElementById('q3d-fullscreen-panel-overlay');
  const body = document.getElementById('q3d-fullscreen-panel-body');
  const title = document.getElementById('q3d-fullscreen-panel-title');
  const panel = document.getElementById(`panel-${panelName}`);
  if (!overlay || !body || !panel) return;

  restoreFullscreenOverlayPanel();
  fullscreenOverlayPanelState = {
    panel,
    parent: panel.parentNode,
    nextSibling: panel.nextSibling,
    previousDisplay: panel.style.display,
    previousFlexDirection: panel.style.flexDirection,
    previousHeight: panel.style.height,
    previousOverflow: panel.style.overflow,
  };

  body.appendChild(panel);
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.height = '100%';
  panel.style.overflow = 'auto';
  overlay.style.display = 'block';
  if (title) title.textContent = getFullscreenPanelLabel(panelName);
  setFullscreenNavActive(panelName);
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.panel === panelName));

  if (panelName === 'roster' && window.staffManager?.loadRoster) window.staffManager.loadRoster();
  if (panelName === 'kpi' && window.kpiManager?.refresh) window.kpiManager.refresh();
}

function toolMeta(t) {
  return {
    blast:     { icon: '💥', label: 'Blast' },
    dumper:    { icon: '🚛', label: 'Dumper' },
    excavator: { icon: '⚙️', label: 'Excavator' },
    loader:    { icon: '⛟', label: 'Loader' },
    crusher:   { icon: '🏭', label: 'Crusher' },
    screener:  { icon: '🔩', label: 'Screener' },
  }[t] || { icon: '❓', label: t };
}

function setTool(tool) {
  activeTool = tool;
  document.querySelectorAll('.q3d-tool').forEach(btn => {
    const active = btn.dataset.tool === tool;
    btn.style.background    = active ? '#cc0000' : '#111';
    btn.style.borderColor   = active ? '#cc0000' : '#2a2a2a';
  });
}

// ═══════════════════════════════════════════════════════════════
// INIT THREE.JS
// ═══════════════════════════════════════════════════════════════
function initThree() {
  const wrap = document.getElementById('q3d-wrap');
  if (!wrap) return;

  const W = Math.max(wrap.clientWidth  || 800, 400);
  const H = Math.max(wrap.clientHeight || 500, 380);

  // Scene
  scene = new THREE.Scene();
  scene.background = COL_SKY;
  // Keep the game readable: a light distance haze only, not the heavy misty overlay.
  scene.fog = new THREE.FogExp2(COL_SKY, 0.00105);

  // Camera — south-west aerial card-shot angle
  camera = new THREE.PerspectiveCamera(45, W / H, 0.5, 1200);
  camera.position.set(-185, 205, 245);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';
  wrap.insertBefore(renderer.domElement, wrap.firstChild);

  // Lights
  const ambient = new THREE.AmbientLight(0x77828c, 1.42);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffd59a, 4.65);
  sun.position.set(-150, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near   = 1;
  sun.shadow.camera.far    = 900;
  sun.shadow.camera.left   = -280;
  sun.shadow.camera.right  =  280;
  sun.shadow.camera.top    =  280;
  sun.shadow.camera.bottom = -280;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0xc7d8df, 0x3b342e, 0.85);
  scene.add(hemi);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.minDistance   = 15;
  controls.maxDistance   = 500;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.update();

  // Helpers
  raycaster = new THREE.Raycaster();
  pointer   = new THREE.Vector2();
  clock     = new THREE.Clock();

  // Materials
  M.yellow    = new THREE.MeshLambertMaterial({ color: 0xf5a623 });
  M.yellowE   = new THREE.MeshLambertMaterial({ color: 0xe8951a });
  M.black     = new THREE.MeshLambertMaterial({ color: 0x111111 });
  M.darkGrey  = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  M.midGrey   = new THREE.MeshLambertMaterial({ color: 0x444444 });
  M.red       = new THREE.MeshLambertMaterial({ color: 0xcc0000 });
  M.hub       = new THREE.MeshLambertMaterial({ color: 0x777777 });
  M.glass     = new THREE.MeshLambertMaterial({ color: 0x334455, transparent: true, opacity: 0.75 });
  M.rubber    = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  M.grass     = new THREE.MeshLambertMaterial({ color: 0x39462f });
  M.brown     = new THREE.MeshLambertMaterial({ color: 0x5a3010 });
  M.green     = new THREE.MeshLambertMaterial({ color: 0x2d5520 });
  M.concrete  = new THREE.MeshLambertMaterial({ color: 0x888880 });
  M.orange    = new THREE.MeshLambertMaterial({ color: 0xff4400 });
  M.looseRock = new THREE.MeshLambertMaterial({ color: 0x8f8474 });
  M.water     = new THREE.MeshLambertMaterial({ color: 0x238fc3, transparent: true, opacity: 0.78, emissive: 0x082638 });
  M.road      = new THREE.MeshLambertMaterial({ color: 0x665b50 });
  M.bermStone = new THREE.MeshLambertMaterial({ color: 0x6c6255 });
  M.quarryWall = makeCinematicRockMaterial();
  M.routeGlow = new THREE.MeshBasicMaterial({ color: 0x35f1df, transparent: true, opacity: 0.56, depthWrite: false });
  M.routeGlowSoft = new THREE.MeshBasicMaterial({ color: 0x58a6ff, transparent: true, opacity: 0.22, depthWrite: false });

  // Build world
  buildTerrain();
  buildEnvironment();

  // Events
  renderer.domElement.addEventListener('click', onCanvasClick);
  new ResizeObserver(() => onResize()).observe(wrap);

  // Watch for panel visibility change
  const panel = document.getElementById('panel-simulation');
  if (panel) {
    new MutationObserver(() => {
      if (panel.style.display !== 'none' && panel.offsetParent !== null) {
        setTimeout(onResize, 60);
      }
    }).observe(panel, { attributes: true, attributeFilter: ['style'] });
  }
}

// ═══════════════════════════════════════════════════════════════
// TERRAIN
// ═══════════════════════════════════════════════════════════════
function buildTerrain() {
  const V = (GRID + 1) * (GRID + 1);
  heightmap = new Float32Array(V);

  const positions = new Float32Array(V * 3);
  const colors    = new Float32Array(V * 3);
  const normals   = new Float32Array(V * 3);

  const r0 = COL_LIMESTONE.r, g0 = COL_LIMESTONE.g, b0 = COL_LIMESTONE.b;

  for (let iz = 0; iz <= GRID; iz++) {
    for (let ix = 0; ix <= GRID; ix++) {
      const i = iz * (GRID + 1) + ix;
      const y = getInitialTerrainHeight(ix, iz);
      positions[i * 3]     = (ix - GRID / 2) * CELL;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = (iz - GRID / 2) * CELL;
      heightmap[i] = y;
      const ridge = seededUnit(ix + iz * 97, 61) * 0.09;
      const benchShade = Math.max(0, Math.min(0.28, Math.abs(y) * 0.012));
      const exposed = benchShade + ridge;
      colors[i * 3]     = Math.max(0.18, r0 - exposed - 0.02);
      colors[i * 3 + 1] = Math.max(0.18, g0 - exposed - 0.015);
      colors[i * 3 + 2] = Math.max(0.18, b0 - exposed + 0.01);
      normals[i * 3 + 1] = 1;
    }
  }

  const idx = [];
  for (let iz = 0; iz < GRID; iz++) {
    for (let ix = 0; ix < GRID; ix++) {
      const a = iz * (GRID + 1) + ix;
      const b = iz * (GRID + 1) + (ix + 1);
      const c = (iz + 1) * (GRID + 1) + ix;
      const d = (iz + 1) * (GRID + 1) + (ix + 1);
      idx.push(a, c, b,  b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
  geo.setAttribute('normal',   new THREE.BufferAttribute(normals,   3));
  geo.setIndex(idx);

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.receiveShadow = true;
  terrainMesh.name = 'terrain';
  scene.add(terrainMesh);

  // Surrounding grass plane sits far below the playable heightfield.
  // If it is close under the pad, blast craters reveal it as flat green circles
  // and hide the actual downward quarry cut.
  const gp = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2),
    M.grass
  );
  gp.position.y = BACKDROP_GROUND_Y;
  gp.receiveShadow = true;
  scene.add(gp);
}

function getTerrainHeight(wx, wz) {
  const { ix, iz } = worldToGrid(wx, wz);
  return heightmap[iz * (GRID + 1) + ix] || 0;
}

function deformTerrain(gx, gz) {
  const pos = terrainMesh.geometry.attributes.position;
  const col = terrainMesh.geometry.attributes.color;
  const lr = COL_LIMESTONE.r, lg = COL_LIMESTONE.g, lb = COL_LIMESTONE.b;
  const pr = COL_PIT_FLOOR.r, pg = COL_PIT_FLOOR.g, pb = COL_PIT_FLOOR.b;
  const faceHit = isQuarryFaceGrid(gx, gz);
  const halfWidthCells = faceHit ? BENCH_BLAST_HALF_WIDTH_CELLS + 1 : BENCH_BLAST_HALF_WIDTH_CELLS;
  const wallCells = BENCH_WALL_CELLS;
  const centreIndex = gz * (GRID + 1) + gx;
  const unlockedQuarryLevel = Math.max(1, Math.floor(gameState.level || 1));
  const targetFloor = getNextUnlockedBenchFloor(heightmap[centreIndex] ?? 0, unlockedQuarryLevel);
  let faceCells = 0;

  for (let iz = 0; iz <= GRID; iz++) {
    for (let ix = 0; ix <= GRID; ix++) {
      const i  = iz * (GRID + 1) + ix;
      const currentHeight = pos.getY(i);
      let ny = getBenchedBlastHeight({
        currentHeight,
        gridDx: ix - gx,
        gridDz: iz - gz,
        halfWidthCells,
        wallCells,
        targetFloor,
      });

      // Keep a single usable haul ramp on the shot face so dumpers can travel
      // between benches instead of dropping into disconnected holes.
      ny = getRampAdjustedHeight({ ix, iz, currentHeight: ny, targetFloor });

      if (ny !== currentHeight) {
        pos.setY(i, ny);
        heightmap[i] = ny;
        if (isQuarryFaceGrid(ix, iz)) faceCells += 1;

        const blend = Math.min(1, Math.max(0, -ny / 36) + (faceHit ? 0.2 : 0));
        col.setXYZ(i,
          lr + (pr - lr) * blend,
          lg + (pg - lg) * blend,
          lb + (pb - lb) * blend
        );
      }
    }
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  terrainMesh.geometry.computeVertexNormals();
  return { faceHit, faceCells, targetFloor };
}

function updateWaterFromTerrain(targetFloor = null, { blastTonnes = 0 } = {}) {
  const currentPitDepth = Number.isFinite(Number(targetFloor))
    ? Number(targetFloor)
    : getCurrentPitDepth();

  if (blastTonnes > 0) {
    gameState = applyBlastWaterIngress(gameState, { nextPitDepth: currentPitDepth, blastTonnes });
  }

  const capacity = gameState.water?.lagoonCapacity || 100;
  const naturalLagoonLevel = Math.min(capacity, 42 + Math.max(0, Math.abs(currentPitDepth)) * 1.15);
  gameState = updateWaterState(gameState, {
    currentPitDepth,
    lagoonLevel: Math.max(gameState.water?.lagoonLevel ?? 0, naturalLagoonLevel),
    siltRisk: Math.min(100, 18 + Math.max(0, Math.abs(currentPitDepth)) * 1.8 + (gameState.blasts || 0) * 2),
  });

  if ((gameState.water?.pitWaterTonnes || 0) > 0) {
    const beforeLagoon = gameState.water.lagoonLevel || 0;
    gameState = pumpPitWater(gameState, { tonnes: Math.min(24, gameState.water.pitWaterTonnes), destination: 'lagoon' });
    if (gameState.water.tractorTask !== 'lagoon-run') {
      gameState = dispatchTractorToLagoons(gameState, { driverName: 'Reese Cakes', tractorId: 'reese-cakes-tractor' });
      toastGame('🚜 Reese Cakes is heading to the lagoons');
    }
    if ((gameState.water.lagoonLevel || 0) > beforeLagoon) {
      toastGame('💧 Pump placed in pit water — feeding the lagoons');
    }
  }

  if ((gameState.water?.lagoonLevel || 0) >= 88) {
    gameState = sellCouncilWater(gameState, { tonnes: 8, pricePerTonne: 1.25, council: 'local council' });
    toastGame('🚰 Clean lagoon water sold to the local council');
  }

  updateLagoonVisuals();
}

function getCurrentPitDepth() {
  if (!heightmap?.length) return 0;
  let min = 0;
  for (let i = 0; i < heightmap.length; i += 1) min = Math.min(min, heightmap[i]);
  return Math.round(min * 10) / 10;
}

function updateLagoonVisuals() {
  const percent = Math.max(0, Math.min(1, (gameState.water?.lagoonLevel || 0) / Math.max(1, gameState.water?.lagoonCapacity || 100)));
  lagoonVisuals.forEach(({ water }, index) => {
    water.position.y = 0.18 + percent * 0.42 + index * 0.05;
    water.material.opacity = 0.48 + percent * 0.28;
  });
}

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT
// ═══════════════════════════════════════════════════════════════
function registerTerrainAnchoredObject(object, { baseOffset = 0, destructible = false, category = 'environment' } = {}) {
  if (!object) return object;
  object.userData.terrainAnchored = true;
  object.userData.terrainBaseOffset = baseOffset;
  object.userData.destructibleByBlast = destructible;
  object.userData.environmentCategory = category;
  object.position.y = getTerrainAnchoredY({
    terrainHeight: getTerrainHeight(object.position.x, object.position.z),
    baseOffset,
  });
  terrainAnchoredObjects.push(object);
  return object;
}

function updateTerrainAnchoredObjectHeights() {
  terrainAnchoredObjects = terrainAnchoredObjects.filter(object => object?.parent);
  terrainAnchoredObjects.forEach(object => {
    object.position.y = getTerrainAnchoredY({
      terrainHeight: getTerrainHeight(object.position.x, object.position.z),
      baseOffset: object.userData.terrainBaseOffset || 0,
    });
  });
}

function destroyBlastAffectedEnvironment(blastX, blastZ, { faceHit = false } = {}) {
  let destroyed = 0;
  terrainAnchoredObjects = terrainAnchoredObjects.filter(object => {
    if (!object?.parent) return false;
    if (!object.userData.destructibleByBlast) return true;
    const insideBlast = isPointInsideBlastClearance({
      pointX: object.position.x,
      pointZ: object.position.z,
      blastX,
      blastZ,
      halfWidthCells: faceHit ? BENCH_BLAST_HALF_WIDTH_CELLS + 1 : BENCH_BLAST_HALF_WIDTH_CELLS,
      wallCells: BENCH_WALL_CELLS,
      extraCells: 2,
      cellSize: CELL,
    });
    if (!insideBlast) return true;
    scene.remove(object);
    disposeObject3D(object);
    destroyed += 1;
    return false;
  });
  window.__qproLastBlastEnvironmentCleanup = { destroyed, blastX, blastZ };
  return destroyed;
}

function buildEnvironment() {
  // Tree ring around the quarry
  const skylineTreeCount = 44;
  for (let i = 0; i < skylineTreeCount; i++) {
    const a = (i / skylineTreeCount) * Math.PI * 2;
    const r = 255 + Math.random() * 90;
    const tree = makeTree();
    tree.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    tree.rotation.y = Math.random() * Math.PI * 2;
    registerTerrainAnchoredObject(tree, { destructible: true, category: 'tree' });
    scene.add(tree);
  }

  addPerimeterTreeLine();
  addScrubAndHedgerows();
  addCinematicQuarryBackdrops();
  addHaulRoadDetails();
  addCinematicRouteGlow();
  addLagoonVisuals();

  // No long rectangular perimeter boxes. They looked like floating surface slabs
  // after terrain deformation on mobile, so the tree/scrub line now carries the
  // boundary visually without adding blast-proof plates over the quarry surface.

  // Site hut (top-right corner)
  addSiteHut(170, 160);
  addDustSuppressionRig();
  // Product bay: screener discharge forms one local loader-accessible chunk before edge haulage.
  addAggregateProductStockpiles();
  // Quarry-edge outbound stockpiles receive tipped dumper loads.
  addEdgeOutboundStockpiles();
  // Hidden for normal play: the quarry should feel open, not boxed in by debug rails.
  if (shouldShowQuarryFaceOutline()) addQuarryFaceOutline();
  // Blue route visuals still appear only while a haul cycle is running.
}

function makeTree() {
  const g = new THREE.Group();
  const s = 0.7 + Math.random() * 0.7;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4 * s, 0.6 * s, 5 * s, 5),
    M.brown
  );
  trunk.position.y = 2.5 * s;
  trunk.castShadow = true;
  g.add(trunk);
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(3.5 * s, 10 * s, 6),
    M.green
  );
  foliage.position.y = 9 * s;
  foliage.castShadow = true;
  g.add(foliage);
  return g;
}

function addPerimeterTreeLine() {
  const countPerSide = 13;
  const half = 235;
  const outside = 262;

  for (let i = 0; i < countPerSide; i++) {
    const t = countPerSide === 1 ? 0.5 : i / (countPerSide - 1);
    const pos = -half + t * half * 2;
    const wobble = ((i % 3) - 1) * 5;
    const placements = [
      [pos, -outside - wobble],
      [pos, outside + wobble],
      [-outside - wobble, pos],
      [outside + wobble, pos],
    ];

    placements.forEach(([x, z], sideIndex) => {
      if ((i + sideIndex) % 5 === 0) return; // small breaks so it feels natural.
      const tree = makeTree();
      const offset = ((i * 17 + sideIndex * 11) % 9) - 4;
      tree.position.set(x + (sideIndex < 2 ? offset : 0), 0, z + (sideIndex >= 2 ? offset : 0));
      tree.rotation.y = ((i * 37 + sideIndex * 53) % 360) * Math.PI / 180;
      registerTerrainAnchoredObject(tree, { destructible: true, category: 'tree' });
      scene.add(tree);
    });
  }
}

function seededUnit(index, salt = 0) {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function addScrubAndHedgerows() {
  const scrubMat = new THREE.MeshLambertMaterial({ color: 0x5f6f38 });
  const hedgeMat = new THREE.MeshLambertMaterial({ color: 0x315025 });
  for (let i = 0; i < 74; i++) {
    const side = i % 4;
    const t = seededUnit(i, 1);
    const offset = (seededUnit(i, 2) - 0.5) * 18;
    const x = side < 2 ? -210 + t * 420 : (side === 2 ? -198 - offset : 198 + offset);
    const z = side < 2 ? (side === 0 ? -198 - offset : 198 + offset) : -210 + t * 420;
    const scrub = new THREE.Mesh(
      new THREE.ConeGeometry(1.7 + seededUnit(i, 3) * 1.4, 2.2 + seededUnit(i, 4) * 2.4, 6),
      scrubMat
    );
    scrub.position.set(x, 1.1, z);
    scrub.rotation.y = seededUnit(i, 5) * Math.PI * 2;
    scrub.castShadow = true;
    registerTerrainAnchoredObject(scrub, { baseOffset: 1.1, destructible: true, category: 'scrub' });
    scene.add(scrub);
  }
  // Avoid long rectangular hedge strips: they read as floating green boards on mobile.
  // Use individual scrub clumps instead so the perimeter still feels planted.
  [
    [-152, 82, 8], [-92, 80, 7], [92, 78, 9],
    [150, -126, 9], [-145, -112, 7],
  ].forEach(([x, z, count], index) => {
    for (let n = 0; n < count; n++) {
      const offsetX = (seededUnit(index * 20 + n, 12) - 0.5) * 46;
      const offsetZ = (seededUnit(index * 20 + n, 13) - 0.5) * 10;
      const scrub = new THREE.Mesh(
        new THREE.ConeGeometry(1.3 + seededUnit(index * 20 + n, 14) * 1.5, 2.1 + seededUnit(index * 20 + n, 15) * 2.2, 6),
        scrubMat
      );
      scrub.position.set(x + offsetX, 1.05, z + offsetZ);
      scrub.rotation.y = seededUnit(index * 20 + n, 16) * Math.PI * 2;
      scrub.castShadow = true;
      registerTerrainAnchoredObject(scrub, { baseOffset: 1.05, destructible: true, category: 'scrub' });
      scene.add(scrub);
    }
  });
}

function makeCinematicRockMaterial() {
  return new THREE.MeshLambertMaterial({
    color: 0x6d6960,
    emissive: 0x080908,
    emissiveIntensity: 0.05,
  });
}

function addCinematicQuarryBackdrops() {
  const wallSpecs = [
    { x: -14, z: 222, sx: 410, sy: 74, yaw: 0, name: 'north-benched-rock-wall' },
    { x: -224, z: 8, sx: 380, sy: 60, yaw: Math.PI / 2, name: 'west-benched-rock-wall' },
    { x: 218, z: 22, sx: 340, sy: 52, yaw: -Math.PI / 2, name: 'east-benched-rock-wall' },
  ];

  wallSpecs.forEach((spec, wallIndex) => {
    const group = new THREE.Group();
    group.name = spec.name;
    for (let bench = 0; bench < 5; bench++) {
      const width = spec.sx - bench * 34;
      const height = Math.max(7, spec.sy / 5 - bench * 0.7);
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, 9),
        M.quarryWall || makeCinematicRockMaterial()
      );
      slab.position.set(0, bench * 9.2 + height / 2 - 7, -bench * 8);
      slab.castShadow = true;
      slab.receiveShadow = true;
      group.add(slab);

      const road = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.82, 0.55, 7.5),
        M.road
      );
      road.position.set(0, bench * 9.2 - 2.2, -bench * 8 + 8.4);
      road.receiveShadow = true;
      group.add(road);
    }
    group.position.set(spec.x, -10 + wallIndex * 1.5, spec.z);
    group.rotation.y = spec.yaw;
    scene.add(group);
  });

  for (let i = 0; i < 54; i++) {
    const angle = seededUnit(i, 41) * Math.PI * 2;
    const radius = 130 + seededUnit(i, 42) * 105;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (Math.abs(x) < 78 && Math.abs(z) < 86) continue;
    const chip = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.0 + seededUnit(i, 43) * 2.2, 0),
      M.bermStone
    );
    chip.scale.set(1.2 + seededUnit(i, 44), 0.42 + seededUnit(i, 45) * 0.45, 1.1 + seededUnit(i, 46) * 1.2);
    chip.position.set(x, getTerrainHeight(x, z) + 0.45, z);
    chip.rotation.set(seededUnit(i, 47) * 0.4, seededUnit(i, 48) * Math.PI, seededUnit(i, 49) * 0.35);
    chip.castShadow = true;
    chip.receiveShadow = true;
    registerTerrainAnchoredObject(chip, { baseOffset: 0.45, destructible: true, category: 'cinematic-rock-chip' });
    scene.add(chip);
  }

  window.__qproCinematicStyle = {
    reference: 'website-card-aerial-quarry-dashboard',
    slateBenches: true,
    dustyHaulRoads: true,
    tealRouteGlow: true,
    glassDashboard: true,
  };
}

function createGlowTube(points, { radius = 1.1, material = M.routeGlow } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, getTerrainHeight(p.x, p.z) + 1.25, p.z)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), material.clone());
  mesh.renderOrder = 8;
  return mesh;
}

function addCinematicRouteGlow() {
  cinematicRouteVisuals.forEach(obj => disposeObject3D(obj));
  cinematicRouteVisuals = [];
  const routeSets = [
    [{ x: -52, z: -48 }, { x: -10, z: -38 }, { x: 38, z: -42 }, { x: 92, z: -72 }, { x: 156, z: -144 }],
    [{ x: -30, z: -28 }, { x: -70, z: 8 }, { x: -114, z: 62 }, { x: -154, z: 132 }],
  ];
  routeSets.forEach((points, index) => {
    const soft = createGlowTube(points, { radius: index === 0 ? 2.6 : 2.05, material: M.routeGlowSoft });
    const core = createGlowTube(points, { radius: index === 0 ? 0.72 : 0.55, material: M.routeGlow });
    scene.add(soft, core);
    cinematicRouteVisuals.push(soft, core);
  });
  window.__qproCinematicRoutes = routeSets.map(points => points.length);
}

function addHaulRoadDetails() {
  // Keep the haul road readable through stones, cones and vehicle movement only.
  // The previous large flat road slabs looked like hovering black rectangles on
  // phone screenshots, so normal gameplay no longer draws any rectangular road
  // or hardstanding plates over the terrain.
  window.__qproGroundPlateCleanup = {
    roadSlabsVisible: false,
    hardstandingPadsVisible: false,
    productBayPadsVisible: false,
    hedgeStripsVisible: false,
    perimeterBoxBermsVisible: false,
    rectangularSurfaceRocksVisible: false,
    reason: 'removed-flat-hovering-rectangles',
  };

  for (let i = 0; i < 34; i++) {
    const x = -74 + i * 8.5;
    const z = -70 + Math.sin(i * 0.7) * 11;
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + seededUnit(i, 10) * 0.28, 0), M.bermStone);
    stone.scale.set(1.0, 0.72 + seededUnit(i, 11) * 0.22, 1.25 + seededUnit(i, 12) * 0.35);
    stone.position.set(x, getTerrainHeight(x, z) + 0.48, z);
    stone.rotation.y = seededUnit(i, 9) * Math.PI;
    stone.castShadow = true;
    registerTerrainAnchoredObject(stone, { baseOffset: 0.48, destructible: true, category: 'surfaceRock' });
    scene.add(stone);
  }

  [
    [62, -80, 0xffcc00], [96, -112, 0xff6b00], [130, -145, 0xff6b00], [-28, -54, 0xffcc00],
  ].forEach(([x, z, color]) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.2, 8), new THREE.MeshLambertMaterial({ color }));
    cone.position.set(x, getTerrainHeight(x, z) + 1.6, z);
    cone.castShadow = true;
    registerTerrainAnchoredObject(cone, { baseOffset: 1.6, destructible: true, category: 'cone' });
    scene.add(cone);
  });
}

function addStockpileHardstanding() {
  // Intentionally empty: hardstanding used to be drawn as flat rectangles on the
  // terrain. Those pads do not deform with blasts, so Yaan quite rightly spotted
  // them floating above cut ground. Stockpile cones now provide the visual cue.
}

function addLagoonVisuals() {
  lagoonVisuals = [
    { x: -156, z: 138, sx: 54, sz: 34, name: 'settlement-lagoon' },
    { x: -112, z: 164, sx: 32, sz: 22, name: 'clean-water-lagoon' },
  ].map((spec, index) => {
    const group = new THREE.Group();
    group.name = spec.name;
    const basin = new THREE.Mesh(
      new THREE.CylinderGeometry(spec.sx / 2, spec.sx / 2, 1.2, 28),
      new THREE.MeshLambertMaterial({ color: 0x4b4437 })
    );
    basin.scale.z = spec.sz / spec.sx;
    basin.position.y = -0.4;
    basin.receiveShadow = true;
    group.add(basin);
    const water = new THREE.Mesh(new THREE.CircleGeometry(spec.sx * 0.43, 28), M.water);
    water.scale.z = spec.sz / spec.sx;
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.24 + index * 0.05;
    water.name = `${spec.name}-water`;
    group.add(water);
    group.position.set(spec.x, 0, spec.z);
    scene.add(group);
    return { ...spec, group, water };
  });
  window.__qproLagoonVisuals = lagoonVisuals.map(({ name, x, z, sx, sz }) => ({ name, x, z, sx, sz }));
}

function addDustSuppressionRig() {
  dustSuppressionRig = makeDustSuppressionRig();
  dustSuppressionRig.position.set(76, getTerrainHeight(76, -94), -94);
  dustSuppressionRig.userData.route = [
    { x: 76, z: -94, label: 'Plant road' },
    { x: 112, z: -132, label: 'Main haul road' },
    { x: 154, z: -158, label: 'Edge stockpile road' },
    { x: 86, z: -74, label: 'Crusher approach' },
  ];
  dustSuppressionRig.userData.routeIndex = 0;
  dustSuppressionRig.userData.progress = 0;
  dustSuppressionRig.userData.suppressionTimer = 0;
  scene.add(dustSuppressionRig);
  window.__qproDustSuppressionRig = getDustSuppressionHookState();
}

function makeDriverTag(text = 'Reese Cakes') {
  const group = new THREE.Group();

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(18, 24, 30, 0.78)';
  roundRect(ctx, 26, 28, 460, 86, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 230, 128, 0.95)';
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.fillStyle = '#ffe680';
  ctx.font = '800 46px system-ui, -apple-system, Segoe UI, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 72);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.position.set(-1.5, 10.2, 0);
  sprite.scale.set(13.5, 4.2, 1);
  sprite.renderOrder = 20;
  group.add(sprite);

  const arrowMat = new THREE.MeshLambertMaterial({ color: 0xffdd55, emissive: 0x443000 });
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.7, 3), arrowMat);
  arrow.position.set(-1.5, 7.5, 0);
  arrow.rotation.z = Math.PI;
  arrow.castShadow = true;
  group.add(arrow);

  group.userData.label = text;
  return group;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeDustSuppressionRig() {
  const group = new THREE.Group();
  const tractorGreen = new THREE.MeshLambertMaterial({ color: 0x1f7a35 });
  const bowserRed = new THREE.MeshLambertMaterial({ color: 0xbb1d1d });
  const sprayMat = new THREE.MeshBasicMaterial({ color: 0x8bd3ff, transparent: true, opacity: 0.38 });

  const tractor = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 4), tractorGreen);
  body.position.y = 2.2;
  body.castShadow = true;
  tractor.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.1, 3.4), tractorGreen);
  cab.position.set(-1.8, 4.1, 0);
  cab.castShadow = true;
  tractor.add(cab);
  const bonnet = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.8, 3.2), tractorGreen);
  bonnet.position.set(2.4, 3.0, 0);
  tractor.add(bonnet);
  [[-2.6, 1.2, -2.4, 1.35], [-2.6, 1.2, 2.4, 1.35], [2.6, 1.0, -2.2, 1.0], [2.6, 1.0, 2.2, 1.0]].forEach(([x, y, z, r]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.8, 14), M.rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.userData.rolls = true;
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    tractor.add(wheel);
  });
  group.add(tractor);
  group.add(makeDriverTag('Reese Cakes'));

  const drawbar = new THREE.Mesh(new THREE.BoxGeometry(5, 0.28, 0.28), M.darkGrey);
  drawbar.position.set(-6.2, 1.2, 0);
  group.add(drawbar);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 5.6, 18), bowserRed);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(-10.2, 2.3, 0);
  tank.castShadow = true;
  group.add(tank);
  [[-11.8, -2.1], [-11.8, 2.1], [-8.7, -2.1], [-8.7, 2.1]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.65, 12), M.rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.userData.rolls = true;
    wheel.position.set(x, 0.85, z);
    wheel.castShadow = true;
    group.add(wheel);
  });

  const spray = new THREE.Mesh(new THREE.ConeGeometry(3.4, 9, 14, 1, true), sprayMat);
  spray.rotation.z = Math.PI / 2;
  spray.position.set(-15, 1.5, 0);
  spray.visible = false;
  spray.name = 'bowser-spray-fan';
  group.add(spray);
  group.userData.spray = spray;
  group.userData.rigType = 'dust-suppression-bowser';
  group.userData.driverTag = 'Reese Cakes';
  return group;
}

function getDustSuppressionHookState() {
  const route = dustSuppressionRig?.userData.route || [];
  const current = route[dustSuppressionRig?.userData.routeIndex || 0] || null;
  return {
    active: Boolean(dustSuppressionRig),
    route,
    currentStage: current?.label || 'Not deployed',
    dustIndex: gameState.dust?.index ?? 0,
    suppressionLevel: gameState.dust?.suppressionLevel ?? 0,
    spraying: Boolean(dustSuppressionRig?.userData.spray?.visible),
    driverTag: dustSuppressionRig?.userData.driverTag || 'Reese Cakes',
  };
}

function updateDustSuppressionRig(dt) {
  if (!dustSuppressionRig?.userData.route?.length) return;
  const route = dustSuppressionRig.userData.route;
  const from = route[dustSuppressionRig.userData.routeIndex % route.length];
  const to = route[(dustSuppressionRig.userData.routeIndex + 1) % route.length];
  const speed = 15;
  const distance = Math.max(1, Math.hypot(to.x - from.x, to.z - from.z));
  dustSuppressionRig.userData.progress += (speed * dt) / distance;
  if (dustSuppressionRig.userData.progress >= 1) {
    dustSuppressionRig.userData.progress = 0;
    dustSuppressionRig.userData.routeIndex = (dustSuppressionRig.userData.routeIndex + 1) % route.length;
  }
  const p = dustSuppressionRig.userData.progress;
  const x = from.x + (to.x - from.x) * p;
  const z = from.z + (to.z - from.z) * p;
  const previous = dustSuppressionRig.position.clone();
  dustSuppressionRig.position.set(x, getTerrainHeight(x, z), z);
  const dir = dustSuppressionRig.position.clone().sub(previous).setY(0);
  if (dir.lengthSq() > 0.0001) {
    dustSuppressionRig.rotation.y = getVehicleYawForDirection(dir.normalize(), { x: 1, z: 0 });
    dustSuppressionRig.traverse(c => {
      if (c.isMesh && c.userData.rolls) c.rotation.z += speed * dt * 0.22;
    });
    if (Math.random() < 0.42) {
      spawnActiveDust(dustSuppressionRig.position.x - dir.x * 4, dustSuppressionRig.position.y + 0.25, dustSuppressionRig.position.z - dir.z * 4);
    }
  }

  const shouldSpray = (gameState.dust?.index || 0) > 18 || Math.sin(Date.now() / 2200) > -0.2;
  if (dustSuppressionRig.userData.spray) dustSuppressionRig.userData.spray.visible = shouldSpray;
  if (shouldSpray && Math.random() < 0.16) {
    spawnSuppressionMist(dustSuppressionRig.position.x - 7, dustSuppressionRig.position.y + 1.2, dustSuppressionRig.position.z);
  }
  dustSuppressionRig.userData.suppressionTimer += dt;
  if (shouldSpray && dustSuppressionRig.userData.suppressionTimer > 5) {
    dustSuppressionRig.userData.suppressionTimer = 0;
    gameState = applyDustSuppression(gameState, { passes: 1, waterTonnes: 4 });
    updateGameHUD();
  }
  window.__qproDustSuppressionRig = getDustSuppressionHookState();
}

function spawnSuppressionMist(x, y, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x9fd7f2, transparent: true, opacity: 0.28 });
  const mist = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random() * 0.9, 5, 5), mat);
  mist.position.set(x + (Math.random() - 0.5) * 4, y, z + (Math.random() - 0.5) * 4);
  mist.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.8);
  mist.userData.life = 0.9;
  mist.userData.decay = 0.9 + Math.random() * 0.45;
  mist.userData.dust = true;
  scene.add(mist);
  particles.push(mist);
}

function addSiteHut(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x6688aa });
  const body = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 7), mat);
  body.position.y = 2.5;
  body.castShadow = true;
  g.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(13, 1, 8), new THREE.MeshLambertMaterial({ color: 0x445566 }));
  roof.position.y = 5.5;
  g.add(roof);
  g.position.set(x, 0, z);
  scene.add(g);
}

function addStockpile(x, z, col, rx, ry) {
  const mat = new THREE.MeshLambertMaterial({ color: col });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(rx, ry, 8), mat);
  cone.position.set(x, getPileCenterY({ terrainHeight: getTerrainHeight(x, z), pileHeight: ry, clearance: 0 }), z);
  cone.castShadow = true;
  cone.receiveShadow = true;
  scene.add(cone);
  return cone;
}

function addAggregateProductStockpiles() {
  // The screener now creates one local loader product chunk beside the plant.
  // The final/top edge stockpiles are filled only when a dumper hauls and tips there.
  aggregateStockpiles = [
    { key: 'crushedStone', label: 'Crusher Type 1', x: 48, z: -42, color: 0xa99c84, baseRadius: 7 },
    { key: 'stockpile10mm', label: 'Screened product', x: 48, z: -42, color: 0xd7cda2, baseRadius: 7 },
    { key: 'stockpile20mm', label: 'Screened product', x: 48, z: -42, color: 0xb9aa7a, baseRadius: 7 },
    { key: 'stockpile40mm', label: 'Screened product', x: 48, z: -42, color: 0x92866d, baseRadius: 7 },
    { key: 'dust', label: 'Screened product', x: 48, z: -42, color: 0x776b58, baseRadius: 7 },
  ].map((spec, index) => {
    const pile = addStockpile(spec.x, spec.z, spec.color, spec.baseRadius, 1.2);
    pile.userData.productKey = spec.key;
    pile.userData.baseRadius = spec.baseRadius;
    pile.userData.baseHeight = 1.2;

    // No flat bay pad: the product pile itself is enough visual context, and
    // dark rectangular plates looked like hover-artifacts in the 3D scene.
    const bay = null;

    pile.visible = false;

    return { ...spec, pile, bay, sharedChunk: index === 0 };
  });
  updateAggregateStockpileVisuals();
}

function updateAggregateStockpileVisuals() {
  const totalProductTonnes = aggregateStockpiles.reduce((sum, { key }) => sum + (gameState.material[key] || 0), 0);
  window.__qproProductPileDebug = [];
  aggregateStockpiles.forEach(({ pile, bay, baseRadius, sharedChunk, key }) => {
    if (!sharedChunk) {
      pile.visible = false;
      if (bay) bay.visible = false;
      return;
    }
    const height = Math.max(1.0, Math.min(18, 1.0 + Math.sqrt(totalProductTonnes) * 0.8));
    const radius = Math.max(baseRadius, Math.min(16, baseRadius + Math.sqrt(totalProductTonnes) * 0.34));
    pile.geometry.dispose();
    pile.geometry = new THREE.ConeGeometry(radius, height, 10);
    pile.position.y = getPileCenterY({ terrainHeight: getTerrainHeight(pile.position.x, pile.position.z), pileHeight: height, clearance: 0 });
    pile.visible = totalProductTonnes > 0.1;
    window.__qproProductPileDebug.push({
      key,
      visible: pile.visible,
      groundY: Math.round(getTerrainHeight(pile.position.x, pile.position.z) * 100) / 100,
      pileY: Math.round(pile.position.y * 100) / 100,
      height: Math.round(height * 100) / 100,
      bottomY: Math.round((pile.position.y - height / 2) * 100) / 100,
    });
    if (bay) bay.visible = true;
  });
}

function addEdgeOutboundStockpiles() {
  edgeStockpiles = [
    { key: 'edgeType1', label: 'Edge Type 1', x: 198, z: -188, color: 0xb4a78b, baseRadius: 9 },
    { key: 'edge10mm', label: 'Edge 10mm', x: 168, z: -188, color: 0xe5d8a8, baseRadius: 9 },
    { key: 'edge20mm', label: 'Edge 20mm', x: 138, z: -188, color: 0xc5b27e, baseRadius: 9 },
    { key: 'edge40mm', label: 'Edge 40mm', x: 108, z: -188, color: 0x9c8b6e, baseRadius: 9 },
    { key: 'edgeDust', label: 'Edge Dust', x: 78, z: -188, color: 0x796d58, baseRadius: 8 },
  ].map(spec => {
    const pile = addStockpile(spec.x, spec.z, spec.color, spec.baseRadius, 1.2);
    pile.userData.edgeKey = spec.key;
    pile.userData.baseRadius = spec.baseRadius;

    // No flat outbound bay pad; tipped tonnes grow the visible cone stockpile.
    const bay = null;

    return { ...spec, pile, bay };
  });
  updateEdgeStockpileVisuals();
}

function updateEdgeStockpileVisuals() {
  edgeStockpiles.forEach(({ key, pile, baseRadius }) => {
    const tonnes = gameState.material[key] || 0;
    const height = Math.max(1.2, Math.min(32, 1.2 + Math.sqrt(tonnes) * 1.05));
    const radius = Math.max(baseRadius, Math.min(24, baseRadius + Math.sqrt(tonnes) * 0.5));
    pile.geometry.dispose();
    pile.geometry = new THREE.ConeGeometry(radius, height, 10);
    pile.position.y = getPileCenterY({ terrainHeight: getTerrainHeight(pile.position.x, pile.position.z), pileHeight: height, clearance: 0 });
    pile.visible = tonnes > 0.1;
  });
}

function createEdgeHaulRouteVisual(route) {
  clearEdgeHaulRouteVisual();

  const group = new THREE.Group();
  group.name = 'active-edge-haul-route';
  group.userData.routeSegments = [];
  group.userData.waypointMarkers = [];

  route.segments.forEach((segment, index) => {
    const rail = createRouteSegmentMesh(segment);
    rail.userData.segmentIndex = index;
    group.userData.routeSegments.push(rail);
    group.add(rail);
  });

  route.waypoints.forEach((point, index) => {
    const marker = createRouteWaypointMarker(point, index, route);
    group.userData.waypointMarkers.push(marker);
    group.add(marker);
  });

  scene.add(group);
  activeEdgeHaulRouteVisual = group;
  window.__qproDumperRoute = {
    active: true,
    routeType: route.routeType,
    waypointCount: route.waypoints.length,
    waypoints: route.waypoints.map((point, index) => ({
      index,
      x: point.x,
      z: point.z,
      stage: route.stageLabels?.[index]?.stage || point.stage || 'route',
      label: route.stageLabels?.[index]?.label || point.label || 'Route point',
    })),
    totalDistance: Math.round(route.totalDistance * 10) / 10,
  };
  updateEdgeHaulRouteVisual(route, 0);
  return group;
}

function createRouteSegmentMesh(segment) {
  const from = new THREE.Vector3(segment.from.x, getTerrainHeight(segment.from.x, segment.from.z) + 1.1, segment.from.z);
  const to = new THREE.Vector3(segment.to.x, getTerrainHeight(segment.to.x, segment.to.z) + 1.1, segment.to.z);
  const direction = to.clone().sub(from);
  const length = Math.max(0.01, direction.length());
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, length, 8),
    new THREE.MeshBasicMaterial({ color: 0x36a3ff, transparent: true, opacity: 0.34 })
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.renderOrder = 7;
  return mesh;
}

function createRouteWaypointMarker(point, index, route) {
  const group = new THREE.Group();
  group.position.set(point.x, getTerrainHeight(point.x, point.z) + 2.1, point.z);
  group.userData.waypointIndex = index;

  const color = index === route.tipAtWaypointIndex ? 0xffb000 : (index === route.loadAtWaypointIndex ? 0x3fb950 : 0x58a6ff);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.8, 0.32, 8, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.78 })
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 4.6, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.62 })
  );
  mast.position.y = 2.3;
  group.add(mast);

  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 12, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 })
  );
  beacon.position.y = 4.8;
  group.add(beacon);
  group.userData.beacon = beacon;
  group.userData.ring = ring;
  return group;
}

function updateEdgeHaulRouteVisual(route, progress) {
  if (!activeEdgeHaulRouteVisual) return;
  const progressState = getRouteProgressState(route, progress);
  if (window.__qproDumperRoute) {
    window.__qproDumperRoute.progress = progressState.progress;
    window.__qproDumperRoute.stage = progressState.stage;
    window.__qproDumperRoute.stageLabel = progressState.stageLabel;
    window.__qproDumperRoute.activeSegmentIndex = progressState.activeSegmentIndex;
  }
  const pulse = 1 + Math.sin(Date.now() / 170) * 0.08;

  activeEdgeHaulRouteVisual.userData.routeSegments.forEach((segmentMesh, index) => {
    segmentMesh.material.opacity = index < progressState.activeSegmentIndex
      ? 0.16
      : (index === progressState.activeSegmentIndex ? 0.62 : 0.28);
    segmentMesh.material.color.setHex(index <= progressState.activeSegmentIndex ? 0x58a6ff : 0x1f6feb);
  });

  activeEdgeHaulRouteVisual.userData.waypointMarkers.forEach(marker => {
    const reached = progressState.reachedWaypointIndexes.includes(marker.userData.waypointIndex);
    const active = marker.userData.waypointIndex === route.loadAtWaypointIndex && !progressState.loadReached;
    marker.scale.setScalar(active ? pulse : 1);
    marker.userData.ring.material.opacity = reached ? 0.32 : 0.86;
    marker.userData.beacon.material.opacity = reached ? 0.36 : 0.96;
  });
}

function clearEdgeHaulRouteVisual() {
  if (!activeEdgeHaulRouteVisual) return;
  disposeObject3D(activeEdgeHaulRouteVisual);
  scene.remove(activeEdgeHaulRouteVisual);
  activeEdgeHaulRouteVisual = null;
  window.__qproDumperRoute = { active: false, reason: 'cleared' };
}

function createDirectFeedProofGuideVisual(plan) {
  clearDirectFeedProofGuideVisual();
  if (!plan?.active || !Array.isArray(plan.pathPoints) || plan.pathPoints.length < 2) return null;

  const group = new THREE.Group();
  group.name = 'direct-feed-proof-guide';
  group.userData.planMode = plan.mode;
  group.userData.phase = plan.phase;
  group.userData.callout = plan.callout;
  group.userData.badge = plan.badge;
  group.userData.pathPointCount = plan.pathPoints.length;

  for (let i = 1; i < plan.pathPoints.length; i++) {
    const segment = createProofGuideSegment(plan.pathPoints[i - 1], plan.pathPoints[i], plan.showMaterialStream);
    segment.userData.segmentIndex = i - 1;
    group.add(segment);
  }

  plan.pathPoints.forEach((point, index) => {
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(index === plan.pathPoints.length - 1 ? 1.3 : 0.95, 14, 10),
      new THREE.MeshBasicMaterial({
        color: index === plan.pathPoints.length - 1 ? 0x2dd4bf : 0xfacc15,
        transparent: true,
        opacity: index === 1 ? 0.9 : 0.78,
      })
    );
    marker.position.set(point.x, point.y, point.z);
    marker.renderOrder = 12;
    marker.userData.guideMarker = index === 0 ? 'excavator' : (index === plan.pathPoints.length - 1 ? 'hopper' : 'bucket-arc');
    group.add(marker);
  });

  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(12, 1.2, 0.22),
    new THREE.MeshBasicMaterial({ color: 0x062a36, transparent: true, opacity: 0.62 })
  );
  const mid = plan.pathPoints[Math.floor(plan.pathPoints.length / 2)];
  badge.position.set(mid.x, mid.y + 2.2, mid.z);
  badge.name = 'direct-feed-proof-guide-badge';
  badge.userData.callout = `${plan.callout} · ${plan.badge}`;
  group.add(badge);

  scene.add(group);
  activeDirectFeedProofGuideVisual = group;
  window.__qproDirectFeedProofGuide = {
    active: true,
    phase: plan.phase,
    callout: plan.callout,
    badge: plan.badge,
    pathPointCount: plan.pathPoints.length,
    childCount: group.children.length,
  };
  return group;
}

function createProofGuideSegment(fromPoint, toPoint, activeStream) {
  const from = new THREE.Vector3(fromPoint.x, fromPoint.y, fromPoint.z);
  const to = new THREE.Vector3(toPoint.x, toPoint.y, toPoint.z);
  const direction = to.clone().sub(from);
  const length = Math.max(0.01, direction.length());
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(activeStream ? 0.42 : 0.28, activeStream ? 0.42 : 0.28, length, 10),
    new THREE.MeshBasicMaterial({
      color: activeStream ? 0xf59e0b : 0x2dd4bf,
      transparent: true,
      opacity: activeStream ? 0.74 : 0.48,
    })
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.renderOrder = 11;
  return mesh;
}

function clearDirectFeedProofGuideVisual() {
  if (!activeDirectFeedProofGuideVisual) {
    window.__qproDirectFeedProofGuide = { active: false, reason: 'no-guide' };
    return;
  }
  disposeObject3D(activeDirectFeedProofGuideVisual);
  scene.remove(activeDirectFeedProofGuideVisual);
  activeDirectFeedProofGuideVisual = null;
  window.__qproDirectFeedProofGuide = { active: false, reason: 'cleared' };
}

function disposeObject3D(object, { disposeSharedMaterials = false } = {}) {
  object.traverse(obj => {
    if (obj.geometry) obj.geometry.dispose();
    disposeMaterial(obj.material, { disposeSharedMaterials });
  });
}

function disposeMaterial(material, { disposeSharedMaterials = false } = {}) {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach(mat => {
    if (!mat) return;
    if (!disposeSharedMaterials && Object.values(M).includes(mat)) return;
    mat.dispose();
  });
}

function getProductColor(productKey) {
  return {
    crushedStone: 0xa99c84,
    stockpile10mm: 0xd7cda2,
    stockpile20mm: 0xb9aa7a,
    stockpile40mm: 0x92866d,
    dust: 0x776b58,
    edgeType1: 0xb4a78b,
    edge10mm: 0xe5d8a8,
    edge20mm: 0xc5b27e,
    edge40mm: 0x9c8b6e,
    edgeDust: 0x796d58,
  }[productKey] || 0xb8a888;
}

function setDumperProductLoadVisual(eq, productKey, tonnes) {
  clearDumperProductLoadVisual(eq);
  const tipperGroup = eq.userData.tipperGroup;
  if (!tipperGroup || !productKey || tonnes <= 0) return;

  const loadHeight = Math.max(0.25, Math.min(1.35, 0.25 + tonnes / 25));
  const load = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, loadHeight, 3.2),
    new THREE.MeshLambertMaterial({ color: getProductColor(productKey) })
  );
  load.position.set(3.35, 1.3 + loadHeight / 2, 0);
  load.castShadow = true;
  tipperGroup.add(load);
  eq.userData.productLoadMesh = load;
}

function clearDumperProductLoadVisual(eq) {
  const load = eq.userData.productLoadMesh;
  if (!load) return;
  load.parent?.remove(load);
  load.geometry.dispose();
  load.material.dispose();
  eq.userData.productLoadMesh = null;
}

function setDumperTipVisual(eq, progress) {
  const tipperGroup = eq.userData.tipperGroup;
  if (!tipperGroup) return;
  const eased = Math.sin(Math.max(0, Math.min(1, progress)) * Math.PI);
  tipperGroup.rotation.z = eased * 0.62;
}

function getPlantDischargeOutletEquipment() {
  return placedEquip.find(e => e.userData.equipType === 'screener')
    || placedEquip.find(e => e.userData.equipType === 'crusher')
    || null;
}

function spawnScreenerDischargeBurst(flowsOrTonnes, materialBefore = null, materialAfter = null) {
  const plantOutlet = getPlantDischargeOutletEquipment();
  if (!plantOutlet) return;
  const flows = Array.isArray(flowsOrTonnes)
    ? flowsOrTonnes
    : getScreenerDischargeFlows({
      screenerPosition: plantOutlet.position,
      stockpiles: aggregateStockpiles,
      materialBefore: materialBefore || {},
      materialAfter: materialAfter || {},
    });
  if (!flows.length) return;

  flows.forEach(flow => {
    const count = Math.max(6, Math.min(24, Math.round(flow.tonnes / 1.6)));
    const from = new THREE.Vector3(flow.from.x, flow.from.y, flow.from.z);
    const to = new THREE.Vector3(flow.to.x, flow.to.y, flow.to.z);

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshLambertMaterial({ color: getProductColor(flow.productKey), transparent: true, opacity: 0.88 });
      const chip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.35, 0.55), mat);
      chip.position.set(
        from.x + (Math.random() - 0.5) * 1.8,
        from.y + Math.random() * 1.2,
        from.z + (Math.random() - 0.5) * 1.8
      );
      const vel = to.clone().sub(chip.position).multiplyScalar(0.72 + Math.random() * 0.28);
      vel.y = 6 + Math.random() * 4;
      chip.userData.vel = vel;
      chip.userData.life = 1.45;
      chip.userData.decay = 0.9 + Math.random() * 0.3;
      chip.userData.grav = true;
      chip.userData.spin = new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5);
      chip.userData.productKey = flow.productKey;
      scene.add(chip);
      particles.push(chip);
    }

    spawnDischargeRibbon(from, to, flow.productKey, flow.tonnes);
  });
}

function spawnDischargeRibbon(from, to, productKey, tonnes) {
  const direction = to.clone().sub(from);
  const length = Math.max(0.01, direction.length());
  const ribbon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, length, 6),
    new THREE.MeshBasicMaterial({ color: getProductColor(productKey), transparent: true, opacity: Math.min(0.5, 0.18 + tonnes / 80) })
  );
  ribbon.position.copy(from).add(to).multiplyScalar(0.5);
  ribbon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  ribbon.renderOrder = 6;
  ribbon.userData.life = 1.15;
  ribbon.userData.decay = 0.95;
  ribbon.userData.dischargeRibbon = true;
  scene.add(ribbon);
  particles.push(ribbon);
}

function spawnEdgeTipParticles(eq, productKey, tonnes) {
  if (tonnes <= 0) return;
  const edgeKey = productToEdgeKey(productKey);
  const target = getEdgeStockpileTarget(edgeKey) || eq.position;
  const count = Math.max(8, Math.min(28, Math.round(tonnes)));

  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: getProductColor(edgeKey || productKey), transparent: true, opacity: 0.9 });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.45, 0.65), mat);
    chip.position.set(eq.position.x + 4, eq.position.y + 5, eq.position.z + (Math.random() - 0.5) * 4);
    const vel = target.clone().sub(chip.position).multiplyScalar(0.65 + Math.random() * 0.25);
    vel.y = 5 + Math.random() * 3;
    chip.userData.vel = vel;
    chip.userData.life = 1.2;
    chip.userData.decay = 0.9 + Math.random() * 0.4;
    chip.userData.grav = true;
    chip.userData.spin = new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    scene.add(chip);
    particles.push(chip);
  }
}

function spawnLoaderProductTransfer(plan, productKey, tonnes) {
  if (!plan?.active || !plan.showMaterialStream || tonnes <= 0) return;
  const from = new THREE.Vector3(plan.streamFrom.x, plan.streamFrom.y, plan.streamFrom.z);
  const to = new THREE.Vector3(plan.streamTo.x, plan.streamTo.y, plan.streamTo.z);
  const count = Math.max(8, Math.min(26, Math.round(tonnes * 0.9)));
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: getProductColor(productKey), transparent: true, opacity: 0.9 });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.5), mat);
    chip.position.set(
      from.x + (Math.random() - 0.5) * 1.4,
      from.y + Math.random() * 0.8,
      from.z + (Math.random() - 0.5) * 1.4
    );
    const vel = to.clone().sub(chip.position).multiplyScalar(0.9 + Math.random() * 0.25);
    vel.y = 4 + Math.random() * 2;
    chip.userData.vel = vel;
    chip.userData.life = 0.95;
    chip.userData.decay = 0.9 + Math.random() * 0.2;
    chip.userData.grav = true;
    chip.userData.spin = new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    scene.add(chip);
    particles.push(chip);
  }
  spawnDischargeRibbon(from, to, productKey, tonnes);
}

function spawnCrusherTipTransfer(plan, tonnes) {
  if (!plan?.active || !plan.showMaterialStream || tonnes <= 0) return;
  const from = new THREE.Vector3(plan.streamFrom.x, plan.streamFrom.y, plan.streamFrom.z);
  const to = new THREE.Vector3(plan.streamTo.x, plan.streamTo.y, plan.streamTo.z);
  const count = Math.max(10, Math.min(30, Math.round(tonnes * 0.7)));
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: getProductColor('shot-rock'), transparent: true, opacity: 0.92 });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.42, 0.6), mat);
    chip.position.set(
      from.x + (Math.random() - 0.5) * 1.8,
      from.y + Math.random() * 0.7,
      from.z + (Math.random() - 0.5) * 1.8
    );
    const vel = to.clone().sub(chip.position).multiplyScalar(0.95 + Math.random() * 0.25);
    vel.y = 2.8 + Math.random() * 1.6;
    chip.userData.vel = vel;
    chip.userData.life = 1.05;
    chip.userData.decay = 0.92 + Math.random() * 0.22;
    chip.userData.grav = true;
    chip.userData.spin = new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    scene.add(chip);
    particles.push(chip);
  }
  spawnDischargeRibbon(from, to, 'shot-rock', tonnes);
}

function spawnExcavatorCrusherLoadBurst(from, to, tonnes) {
  if (!from || !to || tonnes <= 0) return;
  const count = Math.max(8, Math.min(24, Math.round(tonnes * 0.7)));
  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x8a806f, transparent: true, opacity: 0.9 });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), mat);
    chip.position.set(
      from.x + (Math.random() - 0.5) * 4,
      from.y + 2.2 + Math.random() * 2,
      from.z + (Math.random() - 0.5) * 4
    );
    const vel = to.clone().sub(chip.position).multiplyScalar(0.8 + Math.random() * 0.25);
    vel.y = 8 + Math.random() * 3;
    chip.userData.vel = vel;
    chip.userData.life = 1.25;
    chip.userData.decay = 0.92 + Math.random() * 0.28;
    chip.userData.grav = true;
    chip.userData.spin = new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5);
    scene.add(chip);
    particles.push(chip);
  }
}

function removeLoadedLooseGroundVisuals(loadedTonnes) {
  if (loadedTonnes <= 0 || looseGroundPiles.length === 0) return;
  const removeCount = Math.max(1, Math.ceil((loadedTonnes / 45) * 2));
  for (let i = 0; i < removeCount && looseGroundPiles.length; i++) {
    const pile = looseGroundPiles.shift();
    scene.remove(pile);
    pile.geometry.dispose();
    pile.material.dispose();
  }
}

function addQuarryFaceOutline() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xcc0000, emissive: 0x220000 });
  const a = gridToWorld(QUARRY_FACE.minX, QUARRY_FACE.minZ);
  const b = gridToWorld(QUARRY_FACE.maxX, QUARRY_FACE.maxZ);
  const cx = (a.x + b.x) / 2;
  const cz = (a.z + b.z) / 2;
  const w = Math.abs(b.x - a.x);
  const d = Math.abs(b.z - a.z);
  [[cx, a.z, w, 1, 1.2], [cx, b.z, w, 1, 1.2], [a.x, cz, 1.2, 1, d], [b.x, cz, 1.2, 1, d]].forEach(([x, z, sx, sy, sz]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    rail.position.set(x, getTerrainHeight(x, z) + 0.6, z);
    scene.add(rail);
  });
}

function addHaulRoad() {
  const mat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
  // Diagonal road across terrain surface
  for (let i = 0; i < 10; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(12, 0.6, 20), mat);
    seg.position.set(-60 + i * 14, 0.3, -60 + i * 14);
    seg.rotation.y = Math.PI / 4;
    seg.receiveShadow = true;
    scene.add(seg);
  }
}

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT BUILDERS
// ═══════════════════════════════════════════════════════════════

// ── Dumper ──────────────────────────────────────────────────────
function makeDumper() {
  const g = new THREE.Group();

  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 4.5), M.yellow);
  chassis.position.set(0, 1.25, 0);
  chassis.castShadow = true;
  g.add(chassis);

  // Cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(4, 3.2, 4.2), M.yellow);
  cab.position.set(-3.5, 3.35, 0);
  cab.castShadow = true;
  g.add(cab);

  // Cab windows
  const winF = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 3), M.glass);
  winF.position.set(-5.55, 3.6, 0);
  g.add(winF);
  const winT = new THREE.Mesh(new THREE.BoxGeometry(3, 1.5, 0.1), M.glass);
  winT.position.set(-3.5, 3.6, 2.15);
  g.add(winT);

  // Tipper bed: grouped around a front hinge so product loads can visibly tip at the edge.
  const tipperGroup = new THREE.Group();
  tipperGroup.position.set(-0.3, 2.5, 0);
  g.add(tipperGroup);

  const bed = new THREE.Mesh(new THREE.BoxGeometry(6.5, 1, 4.2), M.yellowE);
  bed.position.set(3.1, 0.5, 0);
  bed.castShadow = true;
  tipperGroup.add(bed);

  // Tipper sides
  const sideWall = new THREE.Mesh(new THREE.BoxGeometry(6.5, 2.2, 0.25), M.yellowE);
  sideWall.position.set(3.1, 1.6, 2.1);
  tipperGroup.add(sideWall);
  const sideWall2 = sideWall.clone();
  sideWall2.position.z = -2.1;
  tipperGroup.add(sideWall2);
  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 4.7), M.yellowE);
  rearWall.position.set(6.5, 1.6, 0);
  tipperGroup.add(rearWall);

  g.userData.tipperGroup = tipperGroup;

  // Exhaust stack
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 6), M.darkGrey);
  exhaust.position.set(-4.5, 4.5, -1.5);
  g.add(exhaust);

  // 6 Wheels
  const wGeo = new THREE.CylinderGeometry(1.3, 1.3, 1.1, 10);
  const wheelPos = [
    [-3.5, 1.3, 2.9], [-3.5, 1.3, -2.9],
    [ 0.5, 1.3, 2.9], [ 0.5, 1.3, -2.9],
    [ 3.5, 1.3, 2.9], [ 3.5, 1.3, -2.9],
  ];
  wheelPos.forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wGeo, M.rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.userData.rolls = true;
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    g.add(wheel);
    // Tread ring
    const tread = new THREE.Mesh(new THREE.CylinderGeometry(1.31, 1.31, 0.5, 10), M.black);
    tread.rotation.x = Math.PI / 2;
    tread.userData.rolls = true;
    tread.position.set(wx, wy, wz);
    g.add(tread);
    // Hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 6), M.hub);
    hub.rotation.x = Math.PI / 2;
    hub.userData.rolls = true;
    hub.position.set(wx, wy, wz);
    g.add(hub);
  });

  // Headlights
  const hlMat = new THREE.MeshLambertMaterial({ color: 0xffffcc, emissive: 0x888840 });
  [-1, 1].forEach(z => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.8), hlMat);
    hl.position.set(-5.6, 2.8, z);
    g.add(hl);
  });

  return g;
}

// ── Excavator ───────────────────────────────────────────────────
function makeExcavator() {
  const g = new THREE.Group();

  // Undercarriage
  const uc = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 5.5), M.black);
  uc.position.y = 0.8;
  uc.castShadow = true;
  g.add(uc);

  // Track frames
  [-3, 3].forEach(z => {
    const tf = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.3, 1.6), M.black);
    tf.position.set(0, 0.65, z);
    tf.castShadow = true;
    g.add(tf);
    // Track rollers
    for (let rx = -3.5; rx <= 3.5; rx += 1.2) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 1.7, 7), M.rubber);
      r.rotation.x = Math.PI / 2;
      r.position.set(rx, 0.65, z);
      g.add(r);
    }
    // Drive sprocket
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.7, 8), M.darkGrey);
    sp.rotation.x = Math.PI / 2;
    sp.position.set(4.3, 0.8, z);
    g.add(sp);
  });

  // Cabin group (rotates)
  const cabin = new THREE.Group();
  cabin.position.y = 1.6;
  g.add(cabin);

  const cabBody = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 5), M.yellow);
  cabBody.position.set(0, 1.6, 0);
  cabBody.castShadow = true;
  cabin.add(cabBody);

  // Cabin windows
  const wF = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 3.2), M.glass);
  wF.position.set(2.56, 1.9, 0);
  cabin.add(wF);
  const wTop = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 3.2), M.glass);
  wTop.position.set(1.5, 3.3, 0);
  cabin.add(wTop);

  // Counterweight
  const cw = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 5), M.black);
  cw.position.set(-3.3, 1.2, 0);
  cabin.add(cw);

  // Engine cover
  const ec = new THREE.Mesh(new THREE.BoxGeometry(4.5, 1.5, 5.1), M.darkGrey);
  ec.position.set(-1, 0.75, 0);
  cabin.add(ec);

  // Boom pivot
  const boomPivot = new THREE.Group();
  boomPivot.position.set(2.6, 2, 0);
  cabin.add(boomPivot);

  // Boom arm
  const boom = new THREE.Mesh(new THREE.BoxGeometry(1.3, 8, 1.2), M.yellow);
  boom.position.set(0, 4, 0);
  boom.castShadow = true;
  boomPivot.add(boom);

  // Arm pivot (at tip of boom)
  const armPivot = new THREE.Group();
  armPivot.position.set(0, 8, 0);
  boomPivot.add(armPivot);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), M.yellow);
  arm.position.set(0, 3, 0);
  arm.castShadow = true;
  armPivot.add(arm);

  // Bucket pivot
  const bucketPivot = new THREE.Group();
  bucketPivot.position.set(0, 6, 0);
  armPivot.add(bucketPivot);

  const bucket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 1.8), M.darkGrey);
  bucket.position.y = 0.9;
  bucket.castShadow = true;
  bucketPivot.add(bucket);
  // Bucket teeth
  for (let tx = -0.8; tx <= 0.8; tx += 0.4) {
    const tooth = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 0.6, 4), M.black);
    tooth.position.set(tx, 1.9, 0);
    bucketPivot.add(tooth);
  }

  boomPivot.rotation.z = EXCAVATOR_POSE.digging.boomRotationZ;
  armPivot.rotation.z  = EXCAVATOR_POSE.digging.armRotationZ;
  bucketPivot.rotation.z = EXCAVATOR_POSE.digging.bucketRotationZ;

  // Store refs for animation
  g.userData.boomPivot   = boomPivot;
  g.userData.armPivot    = armPivot;
  g.userData.bucketPivot = bucketPivot;
  g.userData.cabin       = cabin;
  g.userData.phase       = Math.random() * Math.PI * 2;

  return g;
}

// ── Front Loader / Shovel ───────────────────────────────────────
function makeLoader() {
  const g = new THREE.Group();

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(8, 2.2, 4.5), M.yellow);
  chassis.position.set(0, 1.4, 0);
  chassis.castShadow = true;
  g.add(chassis);

  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 3.8), M.yellow);
  cab.position.set(-1.8, 3.8, 0);
  cab.castShadow = true;
  g.add(cab);

  const windscreen = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.7, 2.8), M.glass);
  windscreen.position.set(-3.45, 4, 0);
  g.add(windscreen);

  const engine = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.1, 4.2), M.yellowE);
  engine.position.set(2.4, 3, 0);
  engine.castShadow = true;
  g.add(engine);

  const bucketPivot = new THREE.Group();
  bucketPivot.position.set(4.3, 2.3, 0);
  g.add(bucketPivot);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.45, 0.35), M.darkGrey);
  armL.position.set(2.4, 0.6, 1.65);
  bucketPivot.add(armL);
  const armR = armL.clone();
  armR.position.z = -1.65;
  bucketPivot.add(armR);

  const bucket = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 5.4), M.darkGrey);
  bucket.position.set(5.1, 0.05, 0);
  bucket.rotation.z = -0.25;
  bucket.castShadow = true;
  bucketPivot.add(bucket);

  const wheelGeo = new THREE.CylinderGeometry(1.15, 1.15, 0.9, 12);
  [[-2.7, 1.1, 2.65], [-2.7, 1.1, -2.65], [2.7, 1.1, 2.65], [2.7, 1.1, -2.65]].forEach(([wx, wy, wz]) => {
    const wheel = new THREE.Mesh(wheelGeo, M.rubber);
    wheel.rotation.x = Math.PI / 2;
    wheel.userData.rolls = true;
    wheel.position.set(wx, wy, wz);
    wheel.castShadow = true;
    g.add(wheel);
  });

  g.userData.bucket = bucketPivot;
  g.userData.phase = Math.random() * Math.PI * 2;
  return g;
}

// ── Crusher ─────────────────────────────────────────────────────
function makeCrusher() {
  const g = new THREE.Group();
  const steelMat = new THREE.MeshLambertMaterial({ color: 0x5f6664 });
  const darkSteelMat = new THREE.MeshLambertMaterial({ color: 0x333936 });
  const beltMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
  const yellowPanelMat = new THREE.MeshLambertMaterial({ color: 0xf2a51a });
  const guardMat = new THREE.MeshLambertMaterial({ color: 0xc8c0a8 });
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x837767 });

  const addMesh = (mesh, { cast = true, receive = true } = {}) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    g.add(mesh);
    return mesh;
  };

  const addBox = (size, position, material, rotation = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    return addMesh(mesh);
  };

  const addCylinder = (radius, depth, position, material, rotation = {}) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 14), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    return addMesh(mesh);
  };

  // Tracked mobile base, like the reference crusher rather than a static block.
  addBox({ x: 23, y: 1.2, z: 7.5 }, { x: -1.5, y: 2.0, z: 0 }, darkSteelMat);
  [-3.2, 3.2].forEach(z => {
    addBox({ x: 21, y: 2.2, z: 1.7 }, { x: -2.2, y: 1.25, z }, beltMat);
    for (let i = 0; i < 7; i++) {
      addCylinder(0.52, 1.9, { x: -11 + i * 3.1, y: 1.25, z }, steelMat, { x: Math.PI / 2 });
    }
  });

  // Left-hand intake hopper: low enough for the excavator stick to reach cleanly.
  addBox({ x: 6.5, y: 3.8, z: 8.2 }, { x: -13.5, y: 5.5, z: 0 }, darkSteelMat);
  addBox({ x: 0.55, y: 5.4, z: 9.0 }, { x: -17.0, y: 7.0, z: 0 }, steelMat, { z: -0.18 });
  addBox({ x: 0.55, y: 5.4, z: 9.0 }, { x: -10.0, y: 7.0, z: 0 }, steelMat, { z: 0.18 });
  addBox({ x: 7.4, y: 5.0, z: 0.55 }, { x: -13.5, y: 7.0, z: -4.7 }, steelMat, { x: 0.14 });
  addBox({ x: 7.4, y: 5.0, z: 0.55 }, { x: -13.5, y: 7.0, z: 4.7 }, steelMat, { x: -0.14 });
  const hopperMaterial = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.55, 5.6), new THREE.MeshLambertMaterial({ color: 0x8a806f, transparent: true, opacity: 0.92 }));
  hopperMaterial.position.set(-13.5, 9.0, 0);
  hopperMaterial.visible = false;
  g.add(hopperMaterial);
  g.userData.feedPoint = new THREE.Vector3(-13.5, 8.9, 0);
  g.userData.hopperMaterial = hopperMaterial;

  // Crusher chamber and engine housing with the recognisable yellow panels.
  addBox({ x: 8.5, y: 7.0, z: 7.8 }, { x: -5.2, y: 6.4, z: 0 }, steelMat);
  addBox({ x: 8.2, y: 6.0, z: 7.2 }, { x: 2.6, y: 6.2, z: 0 }, darkSteelMat);
  addBox({ x: 4.0, y: 4.6, z: 0.35 }, { x: -5.2, y: 7.0, z: 4.05 }, yellowPanelMat);
  addBox({ x: 3.6, y: 5.2, z: 0.35 }, { x: 1.6, y: 7.0, z: 4.05 }, yellowPanelMat);

  // Vent grille on the yellow service door.
  for (let i = 0; i < 6; i++) {
    addBox({ x: 2.6, y: 0.12, z: 0.08 }, { x: 1.6, y: 5.4 + i * 0.45, z: 4.28 }, darkSteelMat, {}, { cast: false });
  }

  // Flywheel / side drive that can spin while the crusher is active.
  const flywheel = addCylinder(2.0, 0.75, { x: -5.1, y: 6.8, z: 4.55 }, darkSteelMat, { x: Math.PI / 2 });
  g.userData.flywheel = flywheel;

  // Main output conveyor. High and open underneath so a loader/screener can work
  // below the discharge belt later.
  const beltAngle = 0.32;
  const beltLength = 31;
  const conveyor = new THREE.Group();
  conveyor.position.set(8.8, 7.9, 0);
  conveyor.rotation.z = beltAngle;
  g.add(conveyor);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(beltLength, 0.55, 3.1), beltMat);
  belt.position.x = beltLength / 2;
  belt.castShadow = true;
  belt.receiveShadow = true;
  conveyor.add(belt);
  g.userData.conveyorBelt = belt;
  g.userData.beltRocks = [];
  [6, 13, 20, 27].forEach((x, index) => {
    const rock = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.48, 1.05), rockMat);
    rock.position.set(x, 0.48, index % 2 ? 0.8 : -0.65);
    rock.visible = false;
    rock.castShadow = true;
    conveyor.add(rock);
    g.userData.beltRocks.push(rock);
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(beltLength, 0.35, 3.8), steelMat);
  deck.position.set(beltLength / 2, -0.42, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  conveyor.add(deck);
  [-2.1, 2.1].forEach(z => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(beltLength, 0.38, 0.28), guardMat);
    rail.position.set(beltLength / 2, 0.45, z);
    rail.castShadow = true;
    conveyor.add(rail);
  });

  g.userData.beltRollers = [];
  [2.4, 9.2, 16.0, 23.0, 30.0].forEach(x => {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 3.65, 14), steelMat);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(x, -0.05, 0);
    roller.castShadow = true;
    conveyor.add(roller);
    g.userData.beltRollers.push(roller);
  });

  // Conveyor support legs, leaving the middle clear for the future screener/loader path.
  [[13, 4.0], [24, 7.4]].forEach(([x, h]) => {
    [-1.55, 1.55].forEach(z => {
      addBox({ x: 0.35, y: h, z: 0.35 }, { x: 8.8 + x * Math.cos(beltAngle), y: 2 + h / 2, z }, steelMat, { z: -0.08 });
    });
  });

  // Cheap 6F5 discharge pile directly under the crusher belt.
  const dischargePile = new THREE.Mesh(new THREE.ConeGeometry(6.8, 3.2, 10), rockMat);
  dischargePile.position.set(37, 1.6, 0);
  dischargePile.userData.localPileHeight = 3.2;
  dischargePile.castShadow = true;
  dischargePile.receiveShadow = true;
  g.add(dischargePile);
  g.userData.dischargePoint = new THREE.Vector3(37, 10.2, 0);
  g.userData.dischargePile = dischargePile;

  // Status light, tucked into the side rather than being the whole model's focus.
  const glowMat = new THREE.MeshLambertMaterial({ color: 0x00ff44, emissive: 0x004411 });
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), glowMat);
  glow.position.set(5.8, 8.8, 4.25);
  g.add(glow);
  g.userData.statusLight = glow;
  g.userData.glowMat = glowMat;

  return g;
}

// ── Screener ────────────────────────────────────────────────────
function makeScreener() {
  const g = new THREE.Group();
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x444846 });
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2f5f72 });
  const panelMat = new THREE.MeshLambertMaterial({ color: 0xe7e2d0 });
  const beltMat = new THREE.MeshLambertMaterial({ color: 0x121212 });
  const meshMat = new THREE.MeshLambertMaterial({ color: 0x5f6762 });

  const addBox = (size, position, material, rotation = {}) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  const addCyl = (radius, depth, position, material, rotation = {}) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 12), material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0);
    mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };

  // Long tracked base: real mobile screeners sit on crawler tracks, not tall legs.
  addBox({ x: 18, y: 1.0, z: 6.2 }, { x: -1.5, y: 2.1, z: 0 }, frameMat);
  [-2.7, 2.7].forEach(z => {
    addBox({ x: 16.8, y: 1.8, z: 1.25 }, { x: -2.0, y: 1.05, z }, beltMat);
    for (let i = 0; i < 6; i++) {
      addCyl(0.42, 1.35, { x: -9.2 + i * 2.9, y: 1.05, z }, frameMat, { x: Math.PI / 2 });
    }
  });

  // Feed hopper at the intake end: wide open box with sloped-looking sides.
  addBox({ x: 6.0, y: 2.2, z: 6.8 }, { x: -10.2, y: 5.4, z: 0 }, frameMat);
  addBox({ x: 0.45, y: 3.8, z: 7.8 }, { x: -13.4, y: 6.0, z: 0 }, bodyMat, { z: -0.22 });
  addBox({ x: 0.45, y: 3.8, z: 7.8 }, { x: -7.0, y: 6.0, z: 0 }, bodyMat, { z: 0.22 });
  addBox({ x: 6.9, y: 3.5, z: 0.45 }, { x: -10.2, y: 6.0, z: -4.1 }, bodyMat, { x: 0.14 });
  addBox({ x: 6.9, y: 3.5, z: 0.45 }, { x: -10.2, y: 6.0, z: 4.1 }, bodyMat, { x: -0.14 });

  // Sloped vibrating screen box, with side panels and ribbed mesh surface.
  const deckAngle = 0.16;
  const deck = addBox({ x: 14.5, y: 1.1, z: 6.6 }, { x: -0.8, y: 6.0, z: 0 }, frameMat, { z: deckAngle });
  const screen = addBox({ x: 13.4, y: 0.28, z: 6.0 }, { x: -0.5, y: 6.75, z: 0 }, meshMat, { z: deckAngle });
  for (let x = -6.0; x <= 6.0; x += 1.5) {
    addBox({ x: 0.08, y: 0.18, z: 6.2 }, { x, y: 6.96 + x * Math.sin(deckAngle) * 0.04, z: 0 }, panelMat, { z: deckAngle });
  }
  addBox({ x: 14.8, y: 2.4, z: 0.28 }, { x: -0.6, y: 6.4, z: 3.45 }, bodyMat, { z: deckAngle });
  addBox({ x: 14.8, y: 2.4, z: 0.28 }, { x: -0.6, y: 6.4, z: -3.45 }, bodyMat, { z: deckAngle });
  g.userData.screenDeck = screen;
  g.userData.screenDeckBaseY = screen.position.y;
  g.userData.screenDeckBaseZ = screen.position.z;

  // Conveyors: one main forward belt, two folding side discharge belts, one fines belt.
  const conveyor = (name, x, y, z, length, width, rz, ry = 0) => {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(x, y, z);
    group.rotation.set(0, ry, rz);
    g.add(group);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(length, 0.32, width), beltMat);
    belt.position.x = length / 2;
    belt.castShadow = true;
    group.add(belt);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, width + 0.55), frameMat);
    spine.position.set(length / 2, -0.28, 0);
    spine.castShadow = true;
    group.add(spine);
    [-width / 2 - 0.25, width / 2 + 0.25].forEach(railZ => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.18, 0.16), panelMat);
      rail.position.set(length / 2, 0.26, railZ);
      group.add(rail);
    });
    return group;
  };
  conveyor('main-product-conveyor', 6.2, 5.3, 0, 19, 2.0, 0.26);
  conveyor('left-side-conveyor', 1.5, 4.8, 3.9, 15, 1.55, 0.18, -0.55);
  conveyor('right-side-conveyor', 1.5, 4.25, -3.9, 14, 1.55, 0.12, 0.55);
  conveyor('fines-conveyor', -3.2, 3.05, 0, 12, 1.45, -0.06);

  // Exposed frame struts, motor pack and access details.
  [[-7, -3.4], [-7, 3.4], [5.8, -3.4], [5.8, 3.4]].forEach(([x, z]) => {
    addBox({ x: 0.38, y: 5.0, z: 0.38 }, { x, y: 3.7, z }, frameMat, { z: x < 0 ? -0.08 : 0.08 });
  });
  const motor = addBox({ x: 3.8, y: 2.0, z: 2.7 }, { x: -6.2, y: 3.2, z: -4.2 }, frameMat);
  addBox({ x: 2.6, y: 1.2, z: 0.22 }, { x: -6.2, y: 3.35, z: -5.65 }, panelMat);
  for (let i = 0; i < 4; i++) {
    addBox({ x: 1.9, y: 0.08, z: 0.08 }, { x: -6.2, y: 2.95 + i * 0.25, z: -5.82 }, frameMat);
  }
  addBox({ x: 7.2, y: 0.22, z: 0.22 }, { x: -0.5, y: 8.25, z: 3.9 }, panelMat);
  addBox({ x: 7.2, y: 0.22, z: 0.22 }, { x: -0.5, y: 8.25, z: -3.9 }, panelMat);
  g.userData.motor = motor;

  return g;
}

// ═══════════════════════════════════════════════════════════════
// BLAST MARKERS
// ═══════════════════════════════════════════════════════════════
let blastMat;

function placeBlastMarker(wx, wy, wz) {
  if (!blastMat) {
    blastMat = new THREE.MeshLambertMaterial({ color: 0xff2200, emissive: 0x550000 });
  }
  const gridX = Math.max(0, Math.min(GRID, Math.round((wx + HALF) / CELL)));
  const gridZ = Math.max(0, Math.min(GRID, Math.round((wz + HALF) / CELL)));
  const snapped = gridToWorld(gridX, gridZ);
  const snappedY = getTerrainHeight(snapped.x, snapped.z);
  const m = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 10), blastMat.clone());
  m.position.set(snapped.x, snappedY + 2, snapped.z);
  m.castShadow = true;
  m.userData.type  = 'blastMarker';
  m.userData.gridX = gridX;
  m.userData.gridZ = gridZ;

  // Visible little drilling grid: this is the shot pattern, not a random crater.
  const chargeMarkers = [];
  const chargeMat = new THREE.MeshLambertMaterial({ color: 0xffcc00, emissive: 0x332200 });
  [-1, 0, 1].forEach(dx => {
    [-1, 0, 1].forEach(dz => {
      const wp = gridToWorld(gridX + dx * 2, gridZ + dz * 2);
      const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.35, 8), chargeMat);
      plug.position.set(wp.x, getTerrainHeight(wp.x, wp.z) + 0.25, wp.z);
      plug.castShadow = true;
      scene.add(plug);
      chargeMarkers.push(plug);
    });
  });
  m.userData.chargeMarkers = chargeMarkers;

  // Stake
  const stake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 4, 6),
    new THREE.MeshLambertMaterial({ color: 0xffff00 })
  );
  stake.position.set(snapped.x, snappedY + 2, snapped.z);
  scene.add(stake);
  m.userData.stake = stake;

  scene.add(m);
  blastMarkers.push(m);

  updateBlastActionUI();
  updateCounts();
}

function updateBlastActionUI() {
  const ui = getBlastActionUiState(blastMarkers.length);
  const armed = document.getElementById('q3d-armed');
  if (!armed) return;

  armed.style.display = ui.visible ? 'block' : 'none';
  const label = document.getElementById('q3d-armed-label');
  if (label) label.textContent = ui.label;
  const detonate = document.getElementById('q3d-detonate-btn');
  if (detonate) {
    detonate.textContent = ui.detonateLabel || '💥 Detonate blast';
    detonate.disabled = !ui.canDetonate;
  }
  const remove = document.getElementById('q3d-remove-blast-btn');
  if (remove) {
    remove.textContent = ui.removeLabel || '✕ Remove blast';
    remove.disabled = !ui.canRemove;
  }
}

function cleanupBlastMarker(marker) {
  marker.userData.chargeMarkers?.forEach(plug => {
    scene.remove(plug);
    disposeObject3D(plug);
  });
  if (marker.userData.stake) {
    scene.remove(marker.userData.stake);
    disposeObject3D(marker.userData.stake);
  }
  scene.remove(marker);
  disposeObject3D(marker);
}

function detonateArmedBlasts() {
  if (!blastMarkers.length) return;
  [...blastMarkers].forEach(marker => {
    if (blastMarkers.includes(marker)) detonateBlast(marker);
  });
}

function removeArmedBlasts() {
  if (!blastMarkers.length) return;
  [...blastMarkers].forEach(cleanupBlastMarker);
  blastMarkers = [];
  updateBlastActionUI();
  updateCounts();
}

function detonateBlast(marker) {
  const gx = marker.userData.gridX;
  const gz = marker.userData.gridZ;

  // Terrain deformation
  const deformation = deformTerrain(gx, gz);
  destroyBlastAffectedEnvironment(marker.position.x, marker.position.z, { faceHit: deformation.faceHit });
  updateTerrainAnchoredObjectHeights();

  // Blast particles
  spawnBlastParticles(marker.position.x, marker.position.y, marker.position.z);

  // Remove marker + drilling grid + stake
  cleanupBlastMarker(marker);
  blastMarkers = blastMarkers.filter(m => m !== marker);

  // Stats + quarry economy: blast creates loose shot rock waiting for loading.
  const blastTonnes = deformation.faceHit ? TONNES_PER_FACE_BLAST : TONNES_PER_BLAST;
  gameState = deformation.faceHit
    ? recordQuarryFaceBlast(gameState, { tonnes: blastTonnes })
    : recordBlast(gameState, blastTonnes);
  const producedTonnes = gameState.events.at(-1)?.tonnes || 0;
  updateWaterFromTerrain(deformation.targetFloor, { blastTonnes });
  if (producedTonnes > 0) {
    spawnLooseGroundPiles(
      marker.position.x,
      getTerrainHeight(marker.position.x, marker.position.z),
      marker.position.z,
      producedTonnes
    );
  }
  stats.tonnes = gameState.material.blastedRock;
  stats.blasts = gameState.blasts;
  updateEquipmentHeights();
  updateStatsUI();
  updateGameHUD();
  updateBlastActionUI();
  updateCounts();
}

function animateBlastMarkers() {
  const t = Date.now() / 1000;
  blastMarkers.forEach(m => {
    const p = 0.75 + Math.sin(t * 5) * 0.3;
    m.scale.setScalar(p);
    const em = Math.sin(t * 8) > 0 ? 0x990000 : 0x220000;
    m.material.emissive.setHex(em);
  });
}

function spawnLooseGroundPiles(x, y, z, tonnes) {
  const count = Math.max(10, Math.min(36, Math.round(tonnes / 60)));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * (8 + Math.min(18, tonnes / 150));
    const px = x + Math.cos(angle) * dist;
    const pz = z + Math.sin(angle) * dist;
    const py = getTerrainHeight(px, pz);
    const size = 2 + Math.random() * 4;
    const pileHeight = size * (0.7 + Math.random() * 0.6);
    const pile = new THREE.Mesh(new THREE.ConeGeometry(size, pileHeight, 7), M.looseRock);
    pile.position.set(px, getLoosePileRestingY({ terrainHeight: py, pileHeight }), pz);
    pile.rotation.y = Math.random() * Math.PI * 2;
    pile.castShadow = true;
    pile.receiveShadow = true;
    pile.userData.type = 'looseGroundPile';
    scene.add(pile);
    looseGroundPiles.push(pile);
  }
}

// ═══════════════════════════════════════════════════════════════
// PARTICLES
// ═══════════════════════════════════════════════════════════════
function spawnBlastParticles(x, y, z) {
  // Fire balls
  for (let i = 0; i < 45; i++) {
    const s   = 0.6 + Math.random() * 2;
    const mat = new THREE.MeshLambertMaterial({
      color:   Math.random() > 0.5 ? 0xff4400 : 0xcc2200,
      emissive: 0x220800,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 5), mat);
    m.position.set(x, y, z);

    const θ = Math.random() * Math.PI * 2;
    const φ = Math.random() * Math.PI * 0.55;
    const sp = 12 + Math.random() * 22;
    m.userData.vel   = new THREE.Vector3(Math.cos(θ) * Math.cos(φ) * sp, Math.sin(φ) * sp + 4, Math.sin(θ) * Math.cos(φ) * sp);
    m.userData.life  = 1.0;
    m.userData.decay = 0.5 + Math.random() * 0.6;
    m.userData.grav  = true;
    scene.add(m);
    particles.push(m);
  }

  // Rock chunks
  for (let i = 0; i < 20; i++) {
    const s  = 0.8 + Math.random() * 2.5;
    const m  = new THREE.Mesh(
      new THREE.BoxGeometry(s, s * 0.7, s * 0.9),
      new THREE.MeshLambertMaterial({ color: 0x909080 })
    );
    m.position.set(x + (Math.random() - 0.5) * 12, y, z + (Math.random() - 0.5) * 12);
    const θ = Math.random() * Math.PI * 2;
    const sp = 6 + Math.random() * 14;
    m.userData.vel   = new THREE.Vector3(Math.cos(θ) * sp, 8 + Math.random() * 18, Math.sin(θ) * sp);
    m.userData.life  = 3.0;
    m.userData.decay = 0.25 + Math.random() * 0.2;
    m.userData.grav  = true;
    m.userData.blastRockChunk = true;
    m.userData.restHeight = s * 0.38;
    m.userData.spin  = new THREE.Vector3((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5);
    scene.add(m);
    particles.push(m);
  }

  // Dust plume
  for (let i = 0; i < 30; i++) {
    spawnDust(x + (Math.random() - 0.5) * 20, y + Math.random() * 5, z + (Math.random() - 0.5) * 20);
  }
}

function spawnDust(x, y, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xc0b098, transparent: true, opacity: 0.55 });
  const m   = new THREE.Mesh(new THREE.SphereGeometry(1.5 + Math.random() * 1.5, 5, 5), mat);
  m.position.set(x, y, z);
  m.userData.vel   = new THREE.Vector3((Math.random() - 0.5) * 1.5, 2 + Math.random() * 3, (Math.random() - 0.5) * 1.5);
  m.userData.life  = 1.0;
  m.userData.decay = 0.3 + Math.random() * 0.4;
  m.userData.dust  = true;
  scene.add(m);
  particles.push(m);
}

function spawnActiveDust(x, y, z) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xb8a888, transparent: true, opacity: 0.4 });
  const m   = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random(), 4, 4), mat);
  m.position.set(x + (Math.random() - 0.5) * 3, y, z + (Math.random() - 0.5) * 3);
  m.userData.vel   = new THREE.Vector3((Math.random() - 0.5) * 0.5, 1 + Math.random() * 1.5, (Math.random() - 0.5) * 0.5);
  m.userData.life  = 1.0;
  m.userData.decay = 0.8 + Math.random() * 0.6;
  m.userData.dust  = true;
  scene.add(m);
  particles.push(m);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= p.userData.decay * dt;

    if (p.userData.grav && p.userData.vel) {
      const ground = getTerrainHeight(p.position.x, p.position.z);
      const stepped = stepGravityParticle({
        position: p.position,
        velocity: p.userData.vel,
        life: p.userData.life,
        decay: p.userData.decay,
        dt,
        groundY: ground,
        restHeight: p.userData.restHeight ?? 0.2,
        bounce: p.userData.blastRockChunk ? 0.05 : 0.2,
        friction: p.userData.blastRockChunk ? 0.35 : 0.6,
      });
      p.userData.life = stepped.life;
      p.position.set(stepped.position.x, stepped.position.y, stepped.position.z);
      p.userData.vel.set(stepped.velocity.x, stepped.velocity.y, stepped.velocity.z);
      if (stepped.grounded) {
        p.userData.grounded = true;
        if (p.userData.blastRockChunk) {
          p.userData.vel.set(0, 0, 0);
          p.userData.grav = false;
          p.userData.life = Math.min(p.userData.life, 0.45);
        } else if (p.userData.productKey) {
          p.userData.life = Math.min(p.userData.life, 0.75);
        }
      }
    } else if (p.userData.vel) {
      p.position.addScaledVector(p.userData.vel, dt);
    }

    if (p.userData.spin) {
      p.rotation.x += p.userData.spin.x * dt;
      p.rotation.y += p.userData.spin.y * dt;
      p.rotation.z += p.userData.spin.z * dt;
    }

    if (p.userData.dust) {
      p.material.opacity = Math.max(0, p.userData.life * 0.5);
      const s = 1 + (1 - p.userData.life) * 1.5;
      p.scale.setScalar(s);
    }
    if (p.userData.dischargeRibbon && p.material) {
      p.material.opacity = Math.max(0, Math.min(0.5, p.userData.life * 0.45));
    }

    if (p.userData.life <= 0) {
      scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
      particles.splice(i, 1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// EQUIPMENT PLACEMENT
// ═══════════════════════════════════════════════════════════════
function makeEquipmentId(type) {
  const entropy = Math.random().toString(36).slice(2, 8);
  return `q3d-${type}-${Date.now()}-${entropy}`;
}

function placeEquipment(type, wx, wy, wz, { chargeState = true, yaw = null } = {}) {
  let mesh;
  const scales = { dumper: 1, excavator: 1.12, loader: 1, crusher: 0.72, screener: 1.18 };

  if (chargeState) {
    try {
      const equipmentId = makeEquipmentId(type);
      gameState = placeEquipmentInState(gameState, type, { equipmentId });
      pendingNewEquipmentId = equipmentId;
    } catch (err) {
      toastGame(`💷 Need £${getEquipmentCost(type).toLocaleString()} for ${type}`);
      updateGameHUD();
      return null;
    }
  }

  switch (type) {
    case 'dumper':    mesh = makeDumper();    break;
    case 'excavator': mesh = makeExcavator(); break;
    case 'loader':    mesh = makeLoader();    break;
    case 'crusher':   mesh = makeCrusher();   break;
    case 'screener':  mesh = makeScreener();  break;
    default: return;
  }

  mesh.scale.setScalar(scales[type] || 1);
  mesh.position.set(wx, wy, wz);
  mesh.rotation.y = Number.isFinite(yaw) ? yaw : Math.random() * Math.PI * 2;

  mesh.userData.equipType  = type;
  mesh.userData.equipmentId = pendingNewEquipmentId || makeEquipmentId(type);
  pendingNewEquipmentId = null;
  mesh.userData.spawnTime  = Date.now();
  mesh.userData.status     = 'Active';
  mesh.userData.dustTimer  = Math.random() * 4;
  mesh.userData.aiState    = type === 'dumper' ? 'seek_rubble' : 'working';
  mesh.userData.speed      = 10 + Math.random() * 5;

  if (type === 'dumper') {
    mesh.userData.dumperId = `dumper-${nextDumperId++}`;
    mesh.userData.dumpTimer = 0;
    mesh.userData.target    = null;
  }

  scene.add(mesh);
  if (type === 'crusher') {
    mesh.updateMatrixWorld(true);
    alignCrusherDischargePileToTerrain(mesh);
  }
  placedEquip.push(mesh);

  stats.vehicles++;
  updateStatsUI();
  updateGameHUD();
  updateCounts();
  return mesh;
}

function updateCounts() {
  const counts = {};
  placedEquip.forEach(e => {
    counts[e.userData.equipType] = (counts[e.userData.equipType] || 0) + 1;
  });
  ['dumper', 'excavator', 'loader', 'crusher', 'screener'].forEach(t => {
    const el = document.getElementById(`q3d-cnt-${t}`);
    if (el) el.textContent = counts[t] || 0;
  });
  const blastEl = document.getElementById('q3d-cnt-blast');
  if (blastEl) blastEl.textContent = '💣';
}

function alignCrusherDischargePileToTerrain(eq) {
  const pile = eq?.userData?.dischargePile;
  if (!pile) return;
  const worldPos = new THREE.Vector3();
  pile.getWorldPosition(worldPos);
  pile.position.y = getScaledChildPileLocalY({
    equipmentY: eq.position.y,
    terrainHeight: getTerrainHeight(worldPos.x, worldPos.z),
    pileHeight: pile.userData.localPileHeight || 3.2,
    parentScaleY: eq.scale?.y || 1,
    clearance: 0,
  });
  const alignedWorldPos = new THREE.Vector3();
  pile.getWorldPosition(alignedWorldPos);
  window.__qproCrusherDischargePileDebug = {
    x: Math.round(alignedWorldPos.x * 100) / 100,
    z: Math.round(alignedWorldPos.z * 100) / 100,
    groundY: Math.round(getTerrainHeight(alignedWorldPos.x, alignedWorldPos.z) * 100) / 100,
    pileWorldY: Math.round(alignedWorldPos.y * 100) / 100,
    worldHeight: Math.round((pile.userData.localPileHeight || 3.2) * (eq.scale?.y || 1) * 100) / 100,
    bottomY: Math.round((alignedWorldPos.y - ((pile.userData.localPileHeight || 3.2) * (eq.scale?.y || 1)) / 2) * 100) / 100,
  };
}

function updateEquipmentHeights() {
  placedEquip.forEach(eq => {
    eq.position.y = getTerrainHeight(eq.position.x, eq.position.z);
    if (eq.userData.equipType === 'crusher') {
      eq.updateMatrixWorld(true);
      alignCrusherDischargePileToTerrain(eq);
    }
  });
  blastMarkers.forEach(m => {
    m.position.y = getTerrainHeight(m.position.x, m.position.z) + 2;
    if (m.userData.stake) m.userData.stake.position.y = m.position.y;
    m.userData.chargeMarkers?.forEach(plug => {
      plug.position.y = getTerrainHeight(plug.position.x, plug.position.z) + 0.25;
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// AI
// ═══════════════════════════════════════════════════════════════
function updateAI(dt) {
  const plantProcessingPlan = getCurrentPlantProcessingVisualPlan();
  placedEquip.forEach(eq => {
    const type = eq.userData.equipType;
    if (type === 'dumper')    updateDumperAI(eq, dt);
    if (type === 'excavator') updateExcavatorAI(eq, dt);
    if (type === 'loader')    updateLoaderAI(eq, dt);
    if (type === 'crusher')   updateCrusherAI(eq, dt, plantProcessingPlan);
    if (type === 'screener')  updateScreenerAI(eq, dt, plantProcessingPlan);
  });
}

function updateDumperAI(eq, dt) {
  const state = eq.userData.aiState;

  if (state === 'seek_rubble') {
    if ((gameState.material.looseGround || 0) <= 0 && totalScreenedStockpiles(gameState) > 0) {
      eq.userData.aiState = 'seek_product';
      return;
    }
    const rubbleTarget = getNearestLooseGroundTarget(eq.position);
    const excavators = placedEquip.filter(e => e.userData.equipType === 'excavator');
    if (!rubbleTarget || !excavators.length || (gameState.material.looseGround || 0) <= 0) return;
    eq.userData.target = rubbleTarget;
    eq.userData.aiState = 'to_rubble';
    return;
  }

  if (state === 'to_rubble') {
    if (moveDumperToward(eq, eq.userData.target, dt, 9)) {
      eq.userData.aiState = 'load';
      eq.userData.dumpTimer = 0;
    }
    return;
  }

  if (state === 'load') {
    eq.userData.dumpTimer += dt;
    if (eq.userData.dumpTimer > 2.0) {
      const crushers = placedEquip.filter(e => e.userData.equipType === 'crusher');
      if (!crushers.length) return;
      eq.userData.loaded = true;
      eq.userData.target = getNearestEquipmentPosition(eq.position, crushers);
      eq.userData.aiState = 'haul';
    }
    return;
  }

  if (state === 'haul') {
    if (moveDumperToward(eq, eq.userData.target, dt, 10)) {
      eq.userData.aiState = 'dump';
      eq.userData.dumpTimer = 0;
      eq.userData.aiCrusherTipStreamSpawned = false;
      eq.userData.aiPlantProcessingStarted = false;
    }
    return;
  }

  if (state === 'dump') {
    if (activePlantFeedOwner && activePlantFeedOwner !== eq.uuid) return;
    activePlantFeedOwner = eq.uuid;
    eq.userData.dumpTimer += dt;
    const crusherHopperTarget = getCrusherFeedHopperWorldTarget() || getCrusherFeedWorldTarget() || eq.userData.target;
    const visualPlan = getAutonomousPlantFeedVisualPlan({
      elapsedSeconds: eq.userData.dumpTimer,
      tipSeconds: 2.0,
      processingSeconds: 0.45,
      loadedTonnes: 45,
      dumperPosition: eq.position,
      crusherFeedPosition: crusherHopperTarget,
      hasCrusher: placedEquip.some(e => e.userData.equipType === 'crusher'),
      hasScreener: placedEquip.some(e => e.userData.equipType === 'screener'),
    });

    if (visualPlan.tipPlan?.active) {
      eq.rotation.y = getVehicleYawForDirection(visualPlan.tipPlan.faceDirection);
      setDumperTipVisual(eq, visualPlan.tipPlan.tipVisualProgress);
      if (visualPlan.tipPlan.showMaterialStream && !eq.userData.aiCrusherTipStreamSpawned) {
        eq.userData.aiCrusherTipStreamSpawned = true;
        spawnCrusherTipTransfer(visualPlan.tipPlan, visualPlan.tipPlan.loadedTonnes);
      }
    }

    if (visualPlan.phase === 'processing') {
      const durationMs = 450;
      if (!eq.userData.aiPlantProcessingStarted) {
        activePlantProcessingVisual = {
          startedAt: performance.now() - visualPlan.processingProgress * durationMs,
          durationMs,
          feedTonnes: 45,
        };
        eq.userData.aiPlantProcessingStarted = true;
      }
    }

    if (visualPlan.coreMutationReady) {
      const looseBefore = gameState.material.looseGround || 0;
      const materialBefore = { ...gameState.material };
      gameState = completeHaulCycle(gameState, { payloadTonnes: 45 });
      const moved = Math.max(0, looseBefore - (gameState.material.looseGround || 0));
      const dischargeFlows = getScreenerDischargeFlows({
        screenerPosition: getPlantDischargeOutletEquipment()?.position,
        stockpiles: aggregateStockpiles,
        materialBefore,
        materialAfter: gameState.material,
      });
      removeLoadedLooseGroundVisuals(moved);
      updateAggregateStockpileVisuals();
      spawnScreenerDischargeBurst(dischargeFlows);
      stats.tonnes = gameState.tonnesToday;
      toastLatestProductionEvent();
      updateStatsUI();
      updateGameHUD();
      eq.userData.loaded = false;
      eq.userData.aiCrusherTipStreamSpawned = false;
      eq.userData.aiPlantProcessingStarted = false;
      if (activePlantFeedOwner === eq.uuid) activePlantFeedOwner = null;
      setDumperTipVisual(eq, 1);
      window.setTimeout(() => {
        if (placedEquip.includes(eq) && eq.userData.aiState !== 'dump') setDumperTipVisual(eq, 0);
      }, 450);
      if (shouldHaulProductToEdge(gameState)) {
        eq.userData.aiState = 'seek_product';
        return;
      }
      eq.userData.aiState = 'return';
      eq.userData.returnTarget = getNearestLooseGroundTarget(eq.position) || new THREE.Vector3(
        (Math.random() - 0.5) * 120,
        0,
        (Math.random() - 0.5) * 120
      );
    }
    return;
  }


  if (state === 'seek_product') {
    const productKey = getBestSellableProductKey(gameState);
    const productPile = productKey ? getProductStockpileTarget(productKey) : null;
    const loadingMachines = placedEquip.filter(e => e.userData.equipType === 'loader' || e.userData.equipType === 'excavator');
    if (!productPile || !loadingMachines.length) {
      eq.userData.aiState = 'seek_rubble';
      return;
    }
    const loaderMachine = getNearestLoadingMachineForProduct(eq, productPile);
    eq.userData.productKey = productKey;
    eq.userData.productPileTarget = productPile.clone();
    eq.userData.loaderMachineId = loaderMachine?.uuid || null;
    eq.userData.target = getLoaderSideDumperTarget(productPile, loaderMachine);
    eq.userData.aiState = 'to_product';
    return;
  }

  if (state === 'to_product') {
    if (moveDumperToward(eq, eq.userData.target, dt, 9)) {
      eq.userData.aiState = 'load_product';
      eq.userData.dumpTimer = 0;
      eq.userData.loaderProductStreamSpawned = false;
    }
    return;
  }

  if (state === 'load_product') {
    eq.userData.dumpTimer += dt;
    const productPile = getProductStockpileTarget(eq.userData.productKey);
    const loaderMachine = getNearestLoadingMachineForProduct(eq, productPile);
    const plannedTonnes = Math.min(gameState.material[eq.userData.productKey] || 0, 25);
    const cyclePlan = buildLoaderProductCyclePlan(loaderMachine, eq, eq.userData.productKey, eq.userData.dumpTimer / 1.8, plannedTonnes);
    applyLoaderProductCycleVisual(loaderMachine, cyclePlan);
    if (cyclePlan.showMaterialStream && !eq.userData.loaderProductStreamSpawned) {
      eq.userData.loaderProductStreamSpawned = true;
      spawnLoaderProductTransfer(cyclePlan, eq.userData.productKey, plannedTonnes);
    }
    if (eq.userData.dumpTimer > 1.8) {
      gameState = loadDumperFromScreenedStockpile(gameState, {
        productKey: eq.userData.productKey,
        payloadTonnes: 25,
        dumperId: eq.userData.dumperId,
      });
      updateAggregateStockpileVisuals();
      updateGameHUD();
      const load = getDumperLoad(gameState, eq.userData.dumperId);
      if (load.tonnes <= 0) {
        eq.userData.aiState = 'seek_rubble';
        return;
      }
      eq.userData.loadedProduct = load.productKey;
      eq.userData.loaderProductStreamSpawned = false;
      setDumperProductLoadVisual(eq, load.productKey, load.tonnes);
      const edgeKey = productToEdgeKey(load.productKey);
      eq.userData.target = getEdgeStockpileTarget(edgeKey) || new THREE.Vector3(145, 0, -188);
      eq.userData.aiState = 'to_edge';
    }
    return;
  }

  if (state === 'to_edge') {
    if (moveDumperToward(eq, eq.userData.target, dt, 11)) {
      eq.userData.aiState = 'tip_edge';
      eq.userData.dumpTimer = 0;
    }
    return;
  }

  if (state === 'tip_edge') {
    eq.userData.dumpTimer += dt;
    setDumperTipVisual(eq, eq.userData.dumpTimer / 2.0);
    if (eq.userData.dumpTimer > 2.0) {
      const load = getDumperLoad(gameState, eq.userData.dumperId);
      gameState = tipDumperToEdgeStockpile(gameState, { dumperId: eq.userData.dumperId });
      spawnEdgeTipParticles(eq, load.productKey, load.tonnes);
      updateEdgeStockpileVisuals();
      updateStatsUI();
      updateGameHUD();
      toastLatestEdgeTipEvent();
      clearDumperProductLoadVisual(eq);
      setDumperTipVisual(eq, 0);
      eq.userData.loadedProduct = null;
      eq.userData.aiState = shouldHaulProductToEdge(gameState) ? 'seek_product' : 'seek_rubble';
    }
    return;
  }

  if (state === 'return') {
    if (moveDumperToward(eq, eq.userData.returnTarget, dt, 8)) {
      eq.userData.aiState = 'seek_rubble';
    }
  }
}

function getNearestLooseGroundTarget(position) {
  const visiblePiles = looseGroundPiles.filter(p => p.visible !== false);
  if (visiblePiles.length) return getNearestEquipmentPosition(position, visiblePiles);
  if ((gameState.material.looseGround || 0) <= 0) return null;
  const excavators = placedEquip.filter(e => e.userData.equipType === 'excavator');
  if (excavators.length) return getNearestEquipmentPosition(position, excavators);
  return new THREE.Vector3(0, 0, 0);
}

function getProductStockpileTarget(productKey) {
  const found = aggregateStockpiles.find(p => p.key === productKey);
  return found ? new THREE.Vector3(found.x, 0, found.z) : null;
}

function getEdgeStockpileTarget(edgeKey) {
  const found = edgeStockpiles.find(p => p.key === edgeKey);
  return found ? new THREE.Vector3(found.x, 0, found.z) : null;
}

function getNearestEquipmentPosition(position, equipment) {
  let best = equipment[0], bd = Infinity;
  equipment.forEach(item => {
    const d = position.distanceTo(item.position);
    if (d < bd) { bd = d; best = item; }
  });
  return best.position.clone();
}

function getNearestEquipment(position, equipment) {
  if (!equipment.length) return null;
  let best = equipment[0], bd = Infinity;
  equipment.forEach(item => {
    const d = position.distanceTo(item.position);
    if (d < bd) { bd = d; best = item; }
  });
  return best;
}

function getNearestLoadingMachineForProduct(dumper, productPile) {
  const loaders = placedEquip.filter(e => e.userData.equipType === 'loader');
  if (loaders.length) return getNearestEquipment(productPile || dumper?.position || new THREE.Vector3(), loaders);
  const machines = placedEquip.filter(e => e.userData.equipType === 'excavator');
  if (!machines.length) return null;
  const target = productPile || dumper?.position || new THREE.Vector3();
  return getNearestEquipment(target, machines);
}

function getLoaderSideDumperTarget(productPile, loaderMachine) {
  const parking = getDumperLoaderParkingTarget({
    productPilePosition: productPile,
    loaderPosition: loaderMachine?.position,
    standOff: 13,
  });
  if (!parking.active) return productPile;
  return new THREE.Vector3(parking.x, 0, parking.z);
}

function applyLoaderProductCycleVisual(machine, plan) {
  if (!machine || !plan?.active) return;
  machine.userData.productCycleActiveUntil = Date.now() + 250;
  if (plan.faceDirection && (Math.abs(plan.faceDirection.x) > 0.01 || Math.abs(plan.faceDirection.z) > 0.01)) {
    const forwardAxis = machine.userData.equipType === 'loader' ? { x: 1, z: 0 } : { x: 1, z: 0 };
    machine.rotation.y = getVehicleYawForDirection(plan.faceDirection, forwardAxis);
  }

  if (machine.userData.equipType === 'loader' && machine.userData.bucket) {
    machine.userData.bucket.rotation.z = -0.2 + plan.bucketLift * 0.42 + plan.bucketCurl * 0.28;
  }

  if (machine.userData.equipType === 'excavator') {
    const boom = machine.userData.boomPivot;
    const arm = machine.userData.armPivot;
    const bucket = machine.userData.bucketPivot;
    if (boom) boom.rotation.z = EXCAVATOR_POSE.digging.boomRotationZ + plan.bucketLift * 0.18;
    if (arm) arm.rotation.z = EXCAVATOR_POSE.digging.armRotationZ - plan.bucketLift * 0.16;
    if (bucket) bucket.rotation.z = EXCAVATOR_POSE.digging.bucketRotationZ + plan.bucketCurl * 0.62;
  }
}

function buildLoaderProductCyclePlan(machine, dumper, productKey, progress, loadedTonnes) {
  const productPile = getProductStockpileTarget(productKey);
  return getLoaderProductCyclePlan({
    loaderPosition: machine?.position,
    productPilePosition: productPile,
    dumperPosition: dumper?.position,
    progress,
    loadedTonnes,
  });
}

function playProductLoaderScoop(machine, dumper, productKey, tonnes, progress = 0.62) {
  const plan = buildLoaderProductCyclePlan(machine, dumper, productKey, progress, tonnes);
  if (!plan.active) return plan;
  applyLoaderProductCycleVisual(machine, plan);
  if (plan.showMaterialStream) spawnLoaderProductTransfer(plan, productKey, tonnes);
  return plan;
}

function getCrusherFeedWorldPoint(crusher) {
  if (!crusher) return null;
  return crusher.userData.feedPoint
    ? crusher.localToWorld(crusher.userData.feedPoint.clone())
    : crusher.position.clone();
}

function horizontalDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function moveDumperToward(eq, target, dt, arrivalDistance) {
  return moveEquipmentToward(eq, target, dt, arrivalDistance, { speed: eq.userData.speed, forwardAxis: { x: -1, z: 0 } });
}

function moveEquipmentToward(eq, target, dt, arrivalDistance, { speed = 10, forwardAxis = { x: 1, z: 0 } } = {}) {
  if (!target) return false;
  const dir = target.clone().sub(eq.position).setY(0);
  const d = dir.length();
  if (d < arrivalDistance) return true;
  dir.normalize();
  eq.position.addScaledVector(dir, speed * dt);
  eq.position.y = getTerrainHeight(eq.position.x, eq.position.z);
  eq.rotation.y = getVehicleYawForDirection(dir, forwardAxis);
  eq.traverse(c => {
    if (c.isMesh && c.userData.rolls) {
      c.rotation.z += speed * dt * 0.22;
    }
  });
  eq.userData.roadDustTimer = (eq.userData.roadDustTimer || 0) + dt;
  if (eq.userData.roadDustTimer > 0.12 && Math.random() < 0.72) {
    eq.userData.roadDustTimer = 0;
    const dustY = getTerrainHeight(eq.position.x, eq.position.z) + 0.35;
    spawnActiveDust(eq.position.x - dir.x * 3, dustY, eq.position.z - dir.z * 3);
  }
  return false;
}

function updateExcavatorAI(eq, dt) {
  eq.userData.workTimer = (eq.userData.workTimer || 0) + dt;

  const rubbleTarget = getNearestLooseGroundTarget(eq.position);
  const crusher = getNearestEquipment(eq.position, placedEquip.filter(e => e.userData.equipType === 'crusher'));
  const crusherFeed = getCrusherFeedWorldPoint(crusher);
  const hasLooseGround = (gameState.material.looseGround || 0) > 0;
  const trackingDecision = getExcavatorCrusherTrackingDecision({
    excavatorPosition: eq.position,
    rubblePosition: rubbleTarget,
    crusherFeedPosition: crusherFeed,
    looseGroundTonnes: gameState.material.looseGround || 0,
    standOff: 18,
    arrivalDistance: 4,
  });
  const directFeeding = trackingDecision.directFeedAvailable && (!activePlantFeedOwner || activePlantFeedOwner === eq.uuid);

  if (!directFeeding && eq.userData.manualExcavatorCrusherFeed) {
    eq.userData.manualExcavatorCrusherFeed = false;
    if (activePlantFeedOwner === eq.uuid) activePlantFeedOwner = null;
    setProcessButtonState();
    toastGame('🏭 Move the excavator closer to both shot rock and the crusher hopper');
  }

  if (trackingDecision.active && trackingDecision.shouldMove) {
    const target = new THREE.Vector3(trackingDecision.target.x, 0, trackingDecision.target.z);
    moveEquipmentToward(eq, target, dt, 4, { speed: Math.max(7, eq.userData.speed * 0.72), forwardAxis: { x: 1, z: 0 } });
  } else if (trackingDecision.active && trackingDecision.faceDirection) {
    eq.rotation.y = getVehicleYawForDirection(trackingDecision.faceDirection, { x: 1, z: 0 });
  }

  let feedCyclePlan = null;
  if (!directFeeding) {
    if (activePlantFeedOwner === eq.uuid) activePlantFeedOwner = null;
    eq.userData.excavatorCrusherFeedCycle = null;
    eq.userData.excavatorCrusherFeedStreamSpawned = false;
    eq.userData.excavatorCrusherProcessingStarted = false;
  } else if (!eq.userData.excavatorCrusherFeedCycle && eq.userData.workTimer > 2.4) {
    activePlantFeedOwner = eq.uuid;
    eq.userData.workTimer = 0;
    eq.userData.excavatorCrusherFeedCycle = {
      startedAt: performance.now(),
      feedTonnes: Math.min(25, gameState.material.looseGround || 0),
    };
    eq.userData.excavatorCrusherFeedStreamSpawned = false;
    eq.userData.excavatorCrusherProcessingStarted = false;
  }

  if (eq.userData.excavatorCrusherFeedCycle) {
    const cycle = eq.userData.excavatorCrusherFeedCycle;
    feedCyclePlan = getExcavatorCrusherFeedCyclePlan({
      elapsedSeconds: (performance.now() - cycle.startedAt) / 1000,
      feedTonnes: Math.min(cycle.feedTonnes, gameState.material.looseGround || 0),
      excavatorPosition: eq.position,
      rubblePosition: rubbleTarget,
      crusherFeedPosition: crusherFeed,
      hasScreener: placedEquip.some(e => e.userData.equipType === 'screener'),
    });
  }

  const t = Date.now() / 1000 + (eq.userData.phase || 0) + (directFeeding ? eq.userData.workTimer * 0.7 : 0);
  const boom  = eq.userData.boomPivot;
  const arm   = eq.userData.armPivot;
  const bucket = eq.userData.bucketPivot;
  const cabin = eq.userData.cabin;

  if (boom) {
    const cycleLift = feedCyclePlan?.active ? feedCyclePlan.bucketLift * 0.32 : 0;
    const feedLift = directFeeding ? 0.16 : 0;
    boom.rotation.z = EXCAVATOR_POSE.digging.boomRotationZ + feedLift + cycleLift
      + Math.sin(t * EXCAVATOR_ANIMATION.cycleSpeed + EXCAVATOR_ANIMATION.boomPhase) * EXCAVATOR_ANIMATION.boomAmplitude * (feedCyclePlan?.active ? 0.35 : 1);
  }
  if (arm) {
    const cycleReach = feedCyclePlan?.active ? -0.16 + feedCyclePlan.bucketLift * 0.18 : 0;
    const feedReach = directFeeding ? -0.12 : 0;
    arm.rotation.z = EXCAVATOR_POSE.digging.armRotationZ + feedReach + cycleReach
      + Math.sin(t * EXCAVATOR_ANIMATION.cycleSpeed + EXCAVATOR_ANIMATION.armPhase) * EXCAVATOR_ANIMATION.armAmplitude * (feedCyclePlan?.active ? 0.35 : 1);
  }
  if (bucket) {
    const cycleCurl = feedCyclePlan?.active ? (0.55 - feedCyclePlan.bucketCurl) * 0.72 : 0;
    bucket.rotation.z = EXCAVATOR_POSE.digging.bucketRotationZ + cycleCurl
      + Math.sin(t * EXCAVATOR_ANIMATION.cycleSpeed + EXCAVATOR_ANIMATION.bucketPhase) * EXCAVATOR_ANIMATION.bucketAmplitude * (feedCyclePlan?.active ? 0.25 : 1);
  }
  if (cabin) {
    if (feedCyclePlan?.faceDirection) {
      cabin.rotation.y = Math.atan2(feedCyclePlan.faceDirection.x, feedCyclePlan.faceDirection.z) - eq.rotation.y;
    } else if (directFeeding && crusherFeed) {
      const toCrusher = crusherFeed.clone().sub(eq.position);
      cabin.rotation.y = Math.atan2(toCrusher.x, toCrusher.z) - eq.rotation.y;
    } else {
      cabin.rotation.y = Math.sin(t * 0.3) * 0.7;
    }
  }

  if (feedCyclePlan?.faceDirection) {
    eq.rotation.y = getVehicleYawForDirection(feedCyclePlan.faceDirection, { x: 1, z: 0 });
  }

  if (feedCyclePlan?.active && eq.userData.manualExcavatorCrusherFeed) {
    const uiState = getExcavatorCrusherFeedUiState(feedCyclePlan);
    setProcessButtonState(uiState.label, uiState.busy);
  }

  if (feedCyclePlan?.showMaterialStream && !eq.userData.excavatorCrusherFeedStreamSpawned) {
    eq.userData.excavatorCrusherFeedStreamSpawned = true;
    const from = new THREE.Vector3(feedCyclePlan.streamFrom.x, feedCyclePlan.streamFrom.y, feedCyclePlan.streamFrom.z);
    const to = new THREE.Vector3(feedCyclePlan.streamTo.x, feedCyclePlan.streamTo.y, feedCyclePlan.streamTo.z);
    spawnExcavatorCrusherLoadBurst(from, to, feedCyclePlan.feedTonnes);
    spawnDischargeRibbon(from, to, 'shot-rock', feedCyclePlan.feedTonnes);
  }

  if (feedCyclePlan?.phase === 'processing') {
    const durationMs = 450;
    if (!eq.userData.excavatorCrusherProcessingStarted) {
      activePlantProcessingVisual = {
        startedAt: performance.now() - feedCyclePlan.processingProgress * durationMs,
        durationMs,
        feedTonnes: feedCyclePlan.feedTonnes,
      };
      eq.userData.excavatorCrusherProcessingStarted = true;
    }
  }

  if (feedCyclePlan?.coreMutationReady) {
    const looseBefore = gameState.material.looseGround || 0;
    const materialBefore = { ...gameState.material };
    gameState = completeExcavatorCrusherCycle(gameState, { payloadTonnes: eq.userData.excavatorCrusherFeedCycle?.feedTonnes || 25 });
    const moved = Math.max(0, looseBefore - (gameState.material.looseGround || 0));
    const dischargeFlows = getScreenerDischargeFlows({
      screenerPosition: getPlantDischargeOutletEquipment()?.position,
      stockpiles: aggregateStockpiles,
      materialBefore,
      materialAfter: gameState.material,
    });
    eq.userData.excavatorCrusherFeedCycle = null;
    const wasManualExcavatorFeed = Boolean(eq.userData.manualExcavatorCrusherFeed);
    eq.userData.manualExcavatorCrusherFeed = false;
    eq.userData.excavatorCrusherFeedStreamSpawned = false;
    eq.userData.excavatorCrusherProcessingStarted = false;
    if (activePlantFeedOwner === eq.uuid) activePlantFeedOwner = null;
    if (wasManualExcavatorFeed) setProcessButtonState();
    if (moved > 0) {
      removeLoadedLooseGroundVisuals(moved);
      updateAggregateStockpileVisuals();
      spawnScreenerDischargeBurst(dischargeFlows);
      stats.tonnes = gameState.tonnesToday;
      updateStatsUI();
      updateGameHUD();
      toastLatestProductionEvent();
    }
  }

  eq.userData.dustTimer = (eq.userData.dustTimer || 0) + dt;
  if (eq.userData.dustTimer > 3.5 + Math.random() * 2.5) {
    eq.userData.dustTimer = 0;
    spawnActiveDust(eq.position.x + 3, eq.position.y + 4, eq.position.z);
  }
}

function updateLoaderAI(eq, dt) {
  const t = Date.now() / 1000 + (eq.userData.phase || 0);
  const productCycleActive = (eq.userData.productCycleActiveUntil || 0) > Date.now();
  if (eq.userData.bucket && !productCycleActive) {
    eq.userData.bucket.rotation.z = Math.sin(t * 2.2) * 0.18;
  }
  eq.userData.dustTimer = (eq.userData.dustTimer || 0) + dt;
  if (eq.userData.dustTimer > 4 + Math.random() * 2) {
    eq.userData.dustTimer = 0;
    spawnActiveDust(eq.position.x + 3, eq.position.y + 3, eq.position.z);
  }
}

function updateCrusherAI(eq, dt, processingPlan = { active: false, reason: 'idle' }) {
  const flywheelSpeed = processingPlan.active ? processingPlan.crusherFlywheelSpeed : 3;
  const rollerSpeed = processingPlan.active ? processingPlan.crusherRollerSpeed : 4.5;
  // Spin flywheel and conveyor rollers; speed ramps up while a dumper feed is actually processing.
  if (eq.userData.flywheel) eq.userData.flywheel.rotation.z += flywheelSpeed * dt;
  if (eq.userData.beltRollers) {
    eq.userData.beltRollers.forEach(roller => { roller.rotation.z += rollerSpeed * dt; });
  }
  applyCrusherProcessingVisual(eq, processingPlan, dt);

  // Status light blink
  if (eq.userData.glowMat) {
    const on = Math.sin(Date.now() / 600) > 0;
    eq.userData.glowMat.color.setHex(on ? 0x00ff44 : 0x005522);
    eq.userData.glowMat.emissive.setHex(on ? 0x004411 : 0x001100);
  }

  eq.userData.dustTimer = (eq.userData.dustTimer || 0) + dt;
  if (eq.userData.dustTimer > 2 + Math.random() * 3) {
    eq.userData.dustTimer = 0;
    const dustPoint = eq.userData.dischargePoint
      ? eq.localToWorld(eq.userData.dischargePoint.clone())
      : new THREE.Vector3(eq.position.x, eq.position.y + 20 * (eq.scale.y || 1), eq.position.z + 8);
    spawnActiveDust(dustPoint.x, dustPoint.y, dustPoint.z);
  }
}

function updateScreenerAI(eq, dt, processingPlan = { active: false, reason: 'idle' }) {
  applyScreenerProcessingVisual(eq, processingPlan);
  eq.userData.dustTimer = (eq.userData.dustTimer || 0) + dt;
  if (eq.userData.dustTimer > 3 + Math.random() * 4) {
    eq.userData.dustTimer = 0;
    spawnActiveDust(eq.position.x + 8, eq.position.y + 7 * (eq.scale.y || 1), eq.position.z);
  }
}

function getCurrentPlantProcessingVisualPlan() {
  if (!activePlantProcessingVisual) return { active: false, reason: 'idle' };
  const elapsed = performance.now() - activePlantProcessingVisual.startedAt;
  const duration = Math.max(1, activePlantProcessingVisual.durationMs || 350);
  const progress = Math.max(0, Math.min(1, elapsed / duration));
  const plan = getPlantProcessingAnimationPlan({
    progress,
    feedTonnes: activePlantProcessingVisual.feedTonnes,
    hasCrusher: placedEquip.some(e => e.userData.equipType === 'crusher'),
    hasScreener: placedEquip.some(e => e.userData.equipType === 'screener'),
  });
  if (progress >= 1) activePlantProcessingVisual = null;
  return plan;
}

function applyCrusherProcessingVisual(eq, plan, dt) {
  const active = Boolean(plan?.active);
  if (eq.userData.hopperMaterial) {
    eq.userData.hopperMaterial.visible = active && plan.materialVisible;
    const fill = active ? Math.max(0.05, plan.hopperFillScale) : 0.05;
    eq.userData.hopperMaterial.scale.set(1, fill, 1);
    eq.userData.hopperMaterial.position.y = 8.72 + fill * 0.38;
  }
  if (eq.userData.beltRocks) {
    const speed = active ? plan.beltSpeed : 0;
    eq.userData.beltRockPhase = ((eq.userData.beltRockPhase || 0) + speed * dt * 9) % 28;
    eq.userData.beltRocks.forEach((rock, index) => {
      rock.visible = active && plan.dischargePulse > 0.02;
      const x = 4 + ((index * 7 + eq.userData.beltRockPhase) % 28);
      rock.position.x = x;
      rock.position.y = 0.5 + Math.sin((x + index) * 0.9) * 0.06;
    });
  }
  if (eq.userData.statusLight) {
    eq.userData.statusLight.scale.setScalar(active ? 1.2 + (plan.intensity || 0) * 0.55 : 1);
  }
}

function applyScreenerProcessingVisual(eq, plan) {
  const deck = eq.userData.screenDeck;
  if (!deck) return;
  const baseY = eq.userData.screenDeckBaseY ?? 5.2;
  const baseZ = eq.userData.screenDeckBaseZ ?? 0;
  if (plan?.active) {
    deck.position.y = baseY + plan.screenerShakeY;
    deck.position.z = baseZ + plan.screenerShakeZ;
    if (eq.userData.motor) eq.userData.motor.rotation.y += 0.08 + (plan.intensity || 0) * 0.18;
    return;
  }
  deck.position.y = baseY;
  deck.position.z = baseZ;
}

// ═══════════════════════════════════════════════════════════════
// RAYCASTING / CLICK
// ═══════════════════════════════════════════════════════════════
function onCanvasClick(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x  =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
  pointer.y  = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // 1. Check blast markers
  if (blastMarkers.length) {
    const hits = raycaster.intersectObjects(blastMarkers, false);
    if (hits.length) {
      detonateBlast(hits[0].object);
      return;
    }
  }

  // 2. Check placed equipment (for info popup)
  if (placedEquip.length) {
    const meshes = [];
    placedEquip.forEach(eq => eq.traverse(c => { if (c.isMesh) meshes.push(c); }));
    const hits = raycaster.intersectObjects(meshes, false);
    if (hits.length) {
      let t = hits[0].object;
      while (t.parent && !t.userData.equipType) t = t.parent;
      if (t.userData.equipType) {
        showPopup(t, e.clientX, e.clientY);
        return;
      }
    }
  }

  // 3. Click terrain
  const hits = raycaster.intersectObject(terrainMesh, false);
  if (hits.length) {
    const pt = hits[0].point;
    if (pendingEquipmentMove) {
      moveSelectedEquipmentToTerrain(pendingEquipmentMove, pt);
      return;
    }
    if (activeTool === 'blast') {
      placeBlastMarker(pt.x, pt.y, pt.z);
    } else {
      placeEquipment(activeTool, pt.x, pt.y, pt.z);
    }
  }
}

function parseWorkerTickets(worker) {
  if (Array.isArray(worker?.tickets)) return worker.tickets;
  if (typeof worker?.tickets === 'string' && worker.tickets.trim()) {
    try {
      const parsed = JSON.parse(worker.tickets);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return worker.tickets.split(',').map(ticket => ticket.trim()).filter(Boolean);
  }
  return [];
}

function normaliseRosterWorker(worker) {
  return {
    ...worker,
    hireCost: Number(worker?.hireCost ?? worker?.hire_cost ?? 0),
    speed: Number(worker?.speed ?? 0.7),
    reliability: Number(worker?.reliability ?? 0.75),
    stressLevel: Number(worker?.stressLevel ?? worker?.stress_level ?? 0.55),
    tickets: parseWorkerTickets(worker),
  };
}

function getRosterWorkersForEquipment(type) {
  const requiredTicket = getRequiredTicketForEquipment(type);
  const assignedNames = new Set(Object.values(gameState.staffAssignments || {})
    .map(assignment => assignment?.workerName)
    .filter(Boolean));
  return (window.rosterManager?.workers || [])
    .map(normaliseRosterWorker)
    .filter(worker => requiredTicket && parseWorkerTickets(worker).includes(requiredTicket))
    .map(worker => ({ ...worker, alreadyAssigned: assignedNames.has(worker.name) }));
}

function renderOperatorAssignmentPanel(eq) {
  const type = eq.userData.equipType;
  const equipmentId = eq.userData.equipmentId;
  const status = getEquipmentOperatorStatus(gameState, { equipmentId, equipmentType: type });
  if (!status.needsOperator) return '';

  const assignment = gameState.staffAssignments?.[equipmentId];
  if (status.assigned && assignment) {
    const stats = assignment.stats || {};
    return `
      <div style="margin-top:10px;padding:8px;border-radius:7px;border:1px solid #2ea04366;background:#08180d;color:#c9ffd6;font-size:0.68rem;line-height:1.55;">
        <strong>👷 Operator:</strong> ${assignment.workerName}<br>
        Speed: ${Math.round((stats.speed || 0) * 100)} · Reliability: ${Math.round((stats.reliability || 0) * 100)} · Stress: ${Math.round((stats.stressLevel || 0) * 100)}<br>
        Sick risk: ${stats.expectedSickDaysPerMonth ?? 0} days/month
      </div>`;
  }

  const workers = getRosterWorkersForEquipment(type);
  const requiredLabel = getTicketLabel(status.requiredTicket);
  const workerButtons = workers.length
    ? workers.map(worker => `
        <button data-equip-action="hire-worker" data-worker-id="${worker.id}" ${worker.alreadyAssigned ? 'disabled' : ''} style="padding:7px 8px;border-radius:5px;border:1px solid ${worker.alreadyAssigned ? '#555' : '#2ea043'};background:${worker.alreadyAssigned ? '#222' : '#0d2815'};color:${worker.alreadyAssigned ? '#777' : '#c9ffd6'};font-size:0.66rem;font-weight:900;cursor:${worker.alreadyAssigned ? 'not-allowed' : 'pointer'};text-align:left;">
          ${worker.name} · £${getStaffHireCost(worker).toLocaleString('en-GB')}<br>
          <span style="font-weight:700;color:#aaa;">SPD ${Math.round((worker.speed || 0) * 100)} · REL ${Math.round((worker.reliability || 0) * 100)}${worker.alreadyAssigned ? ' · assigned' : ''}</span>
        </button>`).join('')
    : `<div style="color:#ffb86b;font-size:0.66rem;">No ${requiredLabel} ticket holders in the roster yet.</div>`;

  return `
    <div style="margin-top:10px;padding:8px;border-radius:7px;border:1px solid #d2992266;background:#24180b;color:#ffd58a;font-size:0.68rem;line-height:1.45;">
      <strong>👷 Needs operator</strong><br>
      Hire a ${requiredLabel} ticket holder before this machine is properly staffed.
      <div style="display:grid;gap:5px;margin-top:7px;">${workerButtons}</div>
    </div>`;
}

function assignSelectedEquipmentOperator(workerId) {
  if (!selectedEquipment || !placedEquip.includes(selectedEquipment)) return;
  const worker = (window.rosterManager?.workers || [])
    .map(normaliseRosterWorker)
    .find(candidate => String(candidate.id) === String(workerId));
  if (!worker) {
    toastGame('👷 Roster worker not found');
    return;
  }
  try {
    gameState = assignStaffToEquipment(gameState, {
      equipmentId: selectedEquipment.userData.equipmentId,
      equipmentType: selectedEquipment.userData.equipType,
      worker,
    });
    selectedEquipment.userData.operatorName = worker.name;
    selectedEquipment.userData.operatorStats = gameState.staffAssignments[selectedEquipment.userData.equipmentId]?.stats;
    updateGameHUD();
    toastGame(`👷 Hired ${worker.name} for ${selectedEquipment.userData.equipType}`);
  } catch (err) {
    toastGame(err?.message || 'Could not assign operator');
  }
}

function showPopup(eq, cx, cy) {
  const popup   = document.getElementById('q3d-popup');
  const body    = document.getElementById('q3d-popup-body');
  const type    = eq.userData.equipType;
  const meta    = toolMeta(type);
  const age     = Math.floor((Date.now() - eq.userData.spawnTime) / 1000);
  const stateMap = {
    seek_rubble:  '🔍 Looking for blast rubble',
    to_rubble:    '🪨 Driving to blast rubble',
    load:         '⚙️ Being loaded by excavator',
    haul:         '🚛 Hauling rubble to crusher',
    dump:         '📦 Feeding crusher',
    seek_product: '🔍 Looking for screened product',
    to_product:   '📦 Driving to product bay',
    load_product: '⛟ Loading screened aggregate',
    to_edge:      '🚛 Hauling to edge stockpile',
    tip_edge:     '⛰ Tipping at quarry edge',
    return:       '↩ Returning to rubble pile',
    manual_plant_feed: '🏭 Manual dumper feed to crusher',
    manual_excavator_feed: '⛏ Manual excavator feed to crusher',
    working:      '⚙️ Operating',
  };
  const stateLabel = stateMap[eq.userData.aiState] || eq.userData.aiState || '—';
  const operatorPanel = renderOperatorAssignmentPanel(eq);

  body.innerHTML = `
    <div style="color:#cc0000;font-weight:700;font-size:0.9rem;margin-bottom:8px;
      border-bottom:1px solid #2a2a2a;padding-bottom:6px;">
      ${meta.icon} ${type.charAt(0).toUpperCase() + type.slice(1)}
    </div>
    <div style="color:#aaa;line-height:1.8;">
      Status: <span style="color:#3fb950">${stateLabel}</span><br>
      Active: <span style="color:#ddd">${age}s</span><br>
      X: <span style="color:#ddd">${Math.round(eq.position.x)}</span> &nbsp;
      Z: <span style="color:#ddd">${Math.round(eq.position.z)}</span>
    </div>
    ${operatorPanel}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px;">
      <button data-equip-action="move" style="padding:7px 8px;border-radius:5px;border:1px solid #58a6ff;background:#10233a;color:#c9e6ff;font-size:0.68rem;font-weight:900;cursor:pointer;">↕ Move</button>
      <button data-equip-action="rotate-left" style="padding:7px 8px;border-radius:5px;border:1px solid #555;background:#161616;color:#ddd;font-size:0.68rem;font-weight:900;cursor:pointer;">↺ Rotate</button>
      <button data-equip-action="rotate-right" style="padding:7px 8px;border-radius:5px;border:1px solid #555;background:#161616;color:#ddd;font-size:0.68rem;font-weight:900;cursor:pointer;">↻ Rotate</button>
      <button data-equip-action="sell" style="padding:7px 8px;border-radius:5px;border:1px solid #d29922;background:#24180b;color:#ffd58a;font-size:0.68rem;font-weight:900;cursor:pointer;">💷 Sell</button>
    </div>
    <div style="margin-top:7px;color:#777;font-size:0.64rem;line-height:1.4;">Move: tap a new patch of ground. Sell refunds 50% of purchase price.</div>
  `;

  selectedEquipment = eq;

  popup.style.display = 'block';
  const layout = getEquipmentPopupViewportLayout({
    clickX: cx,
    clickY: cy,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    preferredWidth: getRequiredTicketForEquipment(type) ? 520 : 320,
    margin: 12,
  });
  popup.style.position = layout.position;
  popup.style.width = `${layout.width}px`;
  popup.style.maxHeight = `${layout.maxHeight}px`;
  popup.style.overflowY = layout.overflowY;
  popup.style.left = `${layout.left}px`;
  popup.style.top = `${layout.top}px`;
}

function handleEquipmentPopupClick(event) {
  const button = event.target?.closest?.('[data-equip-action]');
  if (!button || !selectedEquipment || !placedEquip.includes(selectedEquipment)) return;
  event.preventDefault();
  event.stopPropagation();

  const action = button.dataset.equipAction;
  if (action === 'hire-worker') {
    assignSelectedEquipmentOperator(button.dataset.workerId);
    showPopup(selectedEquipment, Math.min(window.innerWidth - 230, event.clientX + 4), event.clientY);
    return;
  }
  if (action === 'move') {
    pendingEquipmentMove = selectedEquipment;
    toastGame(`↕ Tap ground to move ${selectedEquipment.userData.equipType}`);
    document.getElementById('q3d-popup').style.display = 'none';
    return;
  }
  if (action === 'rotate-left' || action === 'rotate-right') {
    rotateSelectedEquipment(selectedEquipment, action === 'rotate-right' ? 1 : -1);
    showPopup(selectedEquipment, Math.min(window.innerWidth - 230, event.clientX + 4), event.clientY);
    return;
  }
  if (action === 'sell') {
    sellPlacedEquipment(selectedEquipment);
  }
}

function rotateSelectedEquipment(eq, direction) {
  if (!eq || !placedEquip.includes(eq)) return;
  eq.rotation.y = getRotatedEquipmentYaw(eq.rotation.y, direction);
  eq.userData.aiState = eq.userData.aiState || 'working';
  toastGame(`↻ Rotated ${eq.userData.equipType}`);
}

function moveSelectedEquipmentToTerrain(eq, point) {
  if (!eq || !placedEquip.includes(eq)) {
    pendingEquipmentMove = null;
    return;
  }
  const y = getTerrainHeight(point.x, point.z);
  eq.position.set(point.x, y, point.z);
  eq.userData.aiState = eq.userData.aiState || 'working';
  pendingEquipmentMove = null;
  selectedEquipment = eq;
  document.getElementById('q3d-popup').style.display = 'none';
  updateEquipmentHeights();
  updateDirectFeedProofOverlay();
  toastGame(`↕ Moved ${eq.userData.equipType}`);
}

function sellPlacedEquipment(eq) {
  if (!eq || !placedEquip.includes(eq)) return;
  const type = eq.userData.equipType;
  try {
    gameState = sellEquipmentInState(gameState, type, { equipmentId: eq.userData.equipmentId });
  } catch (err) {
    toastGame(err?.message || `Cannot sell ${type}`);
    updateGameHUD();
    return;
  }

  placedEquip = placedEquip.filter(item => item !== eq);
  scene.remove(eq);
  disposeObject3D(eq);
  stats.vehicles = Math.max(0, stats.vehicles - 1);
  if (selectedEquipment === eq) selectedEquipment = null;
  if (pendingEquipmentMove === eq) pendingEquipmentMove = null;
  document.getElementById('q3d-popup').style.display = 'none';
  updateStatsUI();
  updateGameHUD();
  updateCounts();
  toastGame(`💷 Sold ${type} for £${gameState.events.at(-1)?.resaleValue?.toLocaleString?.() || 'cash'}`);
}

// ═══════════════════════════════════════════════════════════════
// STATS UI
// ═══════════════════════════════════════════════════════════════
function updateStatsUI() {
  const s = id => document.getElementById(id);
  if (s('q3d-s-tonnes'))   s('q3d-s-tonnes').textContent   = gameState.tonnesToday.toLocaleString() + 't';
  if (s('q3d-s-vehicles')) s('q3d-s-vehicles').textContent = stats.vehicles;
  if (s('q3d-s-blasts'))   s('q3d-s-blasts').textContent   = stats.blasts;
}

function updateGameHUD() {
  const s = id => document.getElementById(id);
  const snapshot = publishOperationsSnapshot();
  const products = snapshot.material.screenerLocalProduct;
  const edgeProducts = snapshot.material.edgeStockpiles;
  if (s('q3d-cash')) s('q3d-cash').textContent = `£${Math.round(snapshot.cash).toLocaleString()}`;
  if (s('q3d-loan')) s('q3d-loan').textContent = `£${Math.round(snapshot.debt).toLocaleString()}`;
  if (s('q3d-level')) s('q3d-level').textContent = snapshot.level;
  if (s('q3d-shot')) s('q3d-shot').textContent = `${Math.round(snapshot.material.blastedRock).toLocaleString()}t`;
  if (s('q3d-products')) s('q3d-products').textContent = `${Math.round(products).toLocaleString()}t / edge ${Math.round(edgeProducts).toLocaleString()}t`;
  if (s('q3d-dust')) {
    s('q3d-dust').textContent = `${Math.round(snapshot.dust.index)}`;
    s('q3d-dust').parentElement.title = `Suppression ${Math.round(snapshot.dust.suppressionLevel)}% · ${snapshot.dust.lastActivity}`;
    s('q3d-dust').parentElement.style.borderColor = snapshot.dust.index >= 70 ? 'rgba(248,81,73,0.85)' : 'rgba(255,255,255,0.18)';
  }
  if (s('q3d-water')) {
    const pitWater = Math.round(snapshot.water.pitWaterTonnes || 0);
    const council = Math.round(snapshot.water.councilWaterSoldTonnes || 0);
    s('q3d-water').textContent = pitWater > 0 ? `Pump ${pitWater}t` : (snapshot.water.risk === 'breached' ? 'Pump' : (snapshot.water.risk === 'near' ? 'Near' : 'Safe'));
    s('q3d-water').parentElement.title = `${snapshot.water.warning} · lagoon ${snapshot.water.lagoonPercent}% · deeper hole ${Math.round(snapshot.water.deeperHoleWaterTonnes || 0)}t · council sold ${council}t`;
    s('q3d-water').parentElement.style.borderColor = snapshot.water.risk === 'safe' ? 'rgba(255,255,255,0.18)' : 'rgba(47,145,184,0.9)';
  }
  const edgeStatus = getEdgeHaulPlayabilityStatus(gameState);
  const edgeEvidence = activeEdgeHaulEvidence || updateEdgeHaulEvidenceHook({ phase: edgeStatus.stage });
  if (s('q3d-loop-status')) {
    const loaded = edgeEvidence.loadedTonnes > 0 ? ` · loaded ${Math.round(edgeEvidence.loadedTonnes)}t` : '';
    const best = edgeEvidence.productLabel ? ` · ${edgeEvidence.productLabel}` : '';
    const value = edgeEvidence.estimatedCashValue > 0 ? ` · next £${Math.round(edgeEvidence.estimatedCashValue).toLocaleString()}` : '';
    s('q3d-loop-status').textContent = `Edge haul: ${edgeEvidence.headline}${best}${loaded}${value}`;
    s('q3d-loop-status').dataset.stage = edgeEvidence.phase;
    s('q3d-loop-status').dataset.ready = edgeEvidence.ready ? 'true' : 'false';
    s('q3d-loop-status').title = edgeEvidence.nextAction;
    s('q3d-loop-status').style.borderColor = edgeEvidence.ready ? 'rgba(210,153,34,0.9)' : 'rgba(255,255,255,0.18)';
    s('q3d-loop-status').style.color = edgeEvidence.ready ? '#ffd58a' : '#c9d1d9';
  }
  if (s('q3d-objective')) s('q3d-objective').textContent = `${snapshot.objective} · ${snapshot.recommendedNextAction}`;
  updateCinematicDashboard(snapshot);
  updateDirectFeedProofOverlay();
}

function updateCinematicDashboard(snapshot) {
  const s = id => document.getElementById(id);
  const gauge = Math.max(12, Math.min(99, Math.round((snapshot.dust.suppressionLevel || 0) * 0.55 + (snapshot.water.lagoonPercent || 0) * 0.45)));
  if (s('q3d-glass-gauge')) s('q3d-glass-gauge').textContent = `${gauge}%`;
  if (s('q3d-glass-tonnes')) {
    const total = Math.round((snapshot.material.screenerLocalProduct || 0) + (snapshot.material.edgeStockpiles || 0));
    s('q3d-glass-tonnes').textContent = `${total.toLocaleString()}t`;
  }
}

function publishOperationsSnapshot({ force = true } = {}) {
  const now = performance.now ? performance.now() : Date.now();
  const activeEquipment = placedEquip.map(eq => ({
    id: eq.userData.equipmentId || eq.uuid,
    type: eq.userData.equipType,
    state: eq.userData.aiState || eq.userData.status || 'available',
    x: Math.round(eq.position.x * 10) / 10,
    z: Math.round(eq.position.z * 10) / 10,
  }));
  const snapshot = getOperationsSnapshot(gameState, {
    generatedAt: new Date().toISOString(),
    activeEquipment,
  });
  window.__qproOperationsSnapshot = snapshot;
  if (force || now - lastSnapshotEmit > 900) {
    lastSnapshotEmit = now;
    window.dispatchEvent(new CustomEvent('qpro:simulation-snapshot', { detail: snapshot }));
  }
  return snapshot;
}

function updateEdgeHaulEvidenceHook(options = {}) {
  const evidence = getEdgeHaulEvidence(gameState, options);
  window.__qproEdgeHaulEvidence = evidence;
  if (options.holdHud) activeEdgeHaulEvidence = evidence;
  return evidence;
}

function isDirectFeedProofUrl() {
  const params = new URLSearchParams(window.location.search || '');
  const demoMode = params.get('demo');
  return demoMode === 'direct-feed' || demoMode === 'excavator-feed';
}

function updateDirectFeedProofOverlay() {
  const root = document.getElementById('q3d-direct-proof');
  if (!root) return;
  if (!isDirectFeedProofUrl()) {
    root.style.display = 'none';
    clearDirectFeedProofGuideVisual();
    return;
  }

  const params = new URLSearchParams(window.location.search || '');
  const mode = params.get('demo') || 'direct-feed';
  const evidence = getDirectFeedProofEvidence(gameState, {
    mode,
    url: `${window.location.pathname}${window.location.search}`,
  });
  root.style.display = 'block';
  root.dataset.ready = evidence.ready ? 'true' : 'false';

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  setText('q3d-proof-label', evidence.label);
  setText('q3d-proof-mode', `${evidence.urlMode} · ${evidence.ready ? 'READY' : 'WARMING'}`);
  setText('q3d-proof-note', evidence.note);
  setText('q3d-proof-time', `capture state ${evidence.timestamp}`);

  const metrics = document.getElementById('q3d-proof-metrics');
  if (metrics) {
    metrics.replaceChildren();
    metrics.style.gridTemplateColumns = root.dataset.compact === 'true' ? 'auto auto auto auto' : '1fr 1fr';
    metrics.style.gap = root.dataset.compact === 'true' ? '3px 8px' : '3px 10px';
    [
      ['Excavator', evidence.equipment.excavator],
      ['Dumper', evidence.equipment.dumper],
      ['Loader', evidence.equipment.loader],
      ['Plant', `${evidence.equipment.crusher}/${evidence.equipment.screener}`],
      ['Shot', `${Math.round(evidence.tonnes.looseGround).toLocaleString()}t`],
      ['Screened', `${Math.round(evidence.tonnes.screenedProduct).toLocaleString()}t`],
      ['Edge', `${Math.round(evidence.tonnes.edgeStockpile).toLocaleString()}t`],
      ['Feed cycles', evidence.cycles.directFeed],
    ].forEach(([label, value]) => {
      const labelEl = document.createElement('span');
      labelEl.style.color = '#7dcac1';
      labelEl.textContent = label;
      const valueEl = document.createElement('strong');
      valueEl.style.textAlign = 'right';
      valueEl.style.color = '#fff';
      valueEl.textContent = String(value);
      metrics.append(labelEl, valueEl);
    });
  }

  const checks = document.getElementById('q3d-proof-checks');
  if (checks) {
    checks.textContent = evidence.checks
      .map(check => `${check.ready ? '✓' : '○'} ${check.label}`)
      .join(' · ');
  }

  refreshDirectFeedProofGuideVisual();
}

function refreshDirectFeedProofGuideVisual() {
  if (!isDirectFeedProofUrl()) {
    clearDirectFeedProofGuideVisual();
    return;
  }
  const excavator = placedEquip.find(eq => eq.userData.equipType === 'excavator');
  const crusherFeed = getCrusherFeedHopperWorldTarget() || getCrusherFeedWorldTarget();
  const proofEvidence = getDirectFeedProofEvidence(gameState, { mode: new URLSearchParams(window.location.search || '').get('demo') || 'direct-feed' });
  const guidePlan = getDirectFeedProofGuidePlan({
    excavatorPosition: excavator?.position,
    rubblePosition: getNearestLooseGroundTarget(excavator?.position || new THREE.Vector3(-30, 0, -45)),
    crusherFeedPosition: crusherFeed,
    feedTonnes: Math.min(25, gameState.material.looseGround || 0),
    elapsedSeconds: 1.8,
    cyclesCompleted: proofEvidence.cycles.directFeed,
  });
  createDirectFeedProofGuideVisual(guidePlan);
}

function applyDirectFeedProofFraming() {
  const excavator = placedEquip.find(eq => eq.userData.equipType === 'excavator');
  const crusherFeed = getCrusherFeedHopperWorldTarget() || getCrusherFeedWorldTarget();
  const screener = placedEquip.find(eq => eq.userData.equipType === 'screener');
  const wrap = document.getElementById('q3d-wrap');
  const plan = getDirectFeedProofCameraPlan({
    excavatorPosition: excavator?.position,
    crusherFeedPosition: crusherFeed,
    screenerPosition: screener?.position,
    viewportWidth: wrap?.clientWidth || window.innerWidth,
    viewportHeight: wrap?.clientHeight || window.innerHeight,
  });
  if (!plan.active) return plan;

  camera.position.set(plan.cameraPosition.x, plan.cameraPosition.y, plan.cameraPosition.z);
  controls.target.set(plan.target.x, plan.target.y, plan.target.z);
  camera.lookAt(controls.target);
  controls.update();

  const proof = document.getElementById('q3d-direct-proof');
  if (proof) {
    proof.dataset.compact = plan.overlay.compact ? 'true' : 'false';
    if (plan.overlay.compact) {
      proof.style.right = '10px';
      proof.style.left = '10px';
      proof.style.top = 'auto';
      proof.style.bottom = '58px';
      proof.style.width = 'auto';
      proof.style.maxWidth = 'none';
      proof.style.fontSize = '0.54rem';
      proof.style.padding = '5px 8px';
      proof.style.lineHeight = '1.24';
      proof.style.background = 'linear-gradient(145deg, rgba(2,8,16,0.56), rgba(8,28,42,0.42))';
      proof.style.borderColor = 'rgba(45,212,191,0.42)';
      proof.style.boxShadow = '0 8px 22px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.08)';
    } else {
      proof.style.left = 'auto';
      proof.style.right = '12px';
      proof.style.top = '118px';
      proof.style.bottom = 'auto';
      proof.style.width = 'min(330px, calc(100% - 156px))';
      proof.style.maxWidth = 'calc(100% - 24px)';
      proof.style.fontSize = '0.68rem';
      proof.style.padding = '10px 12px';
      proof.style.lineHeight = '1.42';
      proof.style.background = 'linear-gradient(145deg, rgba(2,8,16,0.90), rgba(8,28,42,0.78))';
      proof.style.borderColor = 'rgba(45,212,191,0.72)';
      proof.style.boxShadow = '0 12px 34px rgba(0,0,0,0.58), inset 0 1px 0 rgba(255,255,255,0.12)';
    }
  }

  refreshDirectFeedProofGuideVisual();

  const hint = document.getElementById('q3d-hint');
  if (hint && plan.overlay.hideHint) hint.style.display = 'none';
  return plan;
}

function setEdgeHaulButtonState(uiState = null) {
  const button = document.getElementById('q3d-edge-btn');
  if (!button) return;

  if (!uiState) {
    button.textContent = EDGE_BUTTON_IDLE_LABEL;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.title = 'Load screened product into a dumper and tip it at the quarry-edge stockpiles';
    button.style.opacity = '1';
    return;
  }

  button.textContent = uiState.label;
  button.disabled = Boolean(uiState.busy);
  if (uiState.busy) button.setAttribute('aria-busy', 'true');
  else button.removeAttribute('aria-busy');
  button.title = uiState.busy
    ? 'Manual edge haul is running — watch the dumper and route markers'
    : 'Load screened product into a dumper and tip it at the quarry-edge stockpiles';
  button.style.opacity = uiState.busy ? '0.78' : '1';
}

function manualEdgeDumperRun() {
  const runningDumper = activeManualEdgeHaulDumper || placedEquip.find(eq => eq.userData.manualEdgeHaulActive);
  if (runningDumper) {
    toastGame('🚛 Edge haul already moving — watch the dumper run to the quarry edge');
    return;
  }

  const loadedDumper = placedEquip.find(eq => {
    if (eq.userData.equipType !== 'dumper') return false;
    const load = getDumperLoad(gameState, eq.userData.dumperId || 'manual-edge');
    return load.tonnes > 0;
  });
  const dumper = loadedDumper || placedEquip.find(eq => eq.userData.equipType === 'dumper');
  if (!dumper) {
    toastGame('🚛 Place a dumper before starting edge haulage');
    updateGameHUD();
    return;
  }

  const dumperId = dumper.userData.dumperId || 'manual-edge';
  const currentLoad = getDumperLoad(gameState, dumperId);
  const alreadyLoaded = currentLoad.tonnes > 0;
  const productKey = currentLoad.productKey || getBestSellableProductKey(gameState);
  if (!productKey) {
    toastGame('🚛 No crusher product ready for edge haulage yet');
    return;
  }

  const loadingMachine = placedEquip.find(eq => eq.userData.equipType === 'loader' || eq.userData.equipType === 'excavator');
  if (!alreadyLoaded && !loadingMachine) {
    toastGame('⛟ Place a loader or excavator to load crusher product');
    updateGameHUD();
    return;
  }

  const productTarget = getProductStockpileTarget(productKey);
  const edgeKey = productToEdgeKey(productKey);
  const edgeTarget = getEdgeStockpileTarget(edgeKey) || new THREE.Vector3(145, 0, -188);
  let route;
  try {
    route = createEdgeHaulRoute({
      start: dumper.position,
      productTarget,
      edgeTarget,
      alreadyLoaded,
      useHaulRoad: true,
      speed: 44,
    });
  } catch (err) {
    toastGame(`🚛 ${err.message}`);
    return;
  }

  const visualLoadTonnes = alreadyLoaded
    ? currentLoad.tonnes
    : Math.min(gameState.material[productKey] || 0, 25);
  if (visualLoadTonnes <= 0) {
    toastGame('🚛 No screened product ready for edge haulage yet');
    return;
  }

  const runId = ++manualEdgeHaulRunId;
  clearPendingManualEdgeHaulTimers();
  activeManualEdgeHaulDumper = dumper;
  dumper.userData.manualEdgeHaulRunId = runId;
  dumper.userData.manualEdgeHaulActive = true;
  dumper.userData.aiState = 'manual_edge_haul';
  dumper.userData.target = edgeTarget;
  dumper.userData.loadedProduct = alreadyLoaded ? productKey : null;
  dumper.userData.dumpTimer = 0;
  createEdgeHaulRouteVisual(route);
  updateEdgeHaulEvidenceHook({
    phase: alreadyLoaded ? 'hauling-to-edge' : 'loading-at-product',
    dumperId,
    payloadTonnes: 25,
    holdHud: true,
  });
  setEdgeHaulButtonState(getEdgeHaulRouteUiState(route, 0));
  toastGame(alreadyLoaded ? '🚛 Dumper heading to quarry-edge tip' : '🚛 Dumper driving to product bay for edge haul');

  animateManualEdgeHaul(dumper, route, {
    productKey,
    payloadTonnes: 25,
    dumperId,
    runId,
    route,
    alreadyLoaded,
    visualLoadTonnes,
  });
}

function animateManualEdgeHaul(dumper, route, options) {
  const startedAt = performance.now();
  const totalMs = route.durationSeconds * 1000;
  const loadCycleMs = options.alreadyLoaded ? 0 : 1300;
  let accumulatedPauseMs = 0;
  let loadCycleStartedAt = null;
  let loaderProductStreamSpawned = false;
  let loadVisualShown = options.alreadyLoaded;
  if (loadVisualShown) {
    setDumperProductLoadVisual(dumper, options.productKey, options.visualLoadTonnes);
  }

  const completeVisibleProductLoad = () => {
    try {
      gameState = loadDumperFromScreenedStockpile(gameState, {
        productKey: options.productKey,
        payloadTonnes: options.payloadTonnes,
        dumperId: options.dumperId,
      });
    } catch (err) {
      abortManualEdgeHaul(dumper, `🚛 ${err.message}`);
      return false;
    }

    const realLoad = getDumperLoad(gameState, options.dumperId);
    if (!realLoad.productKey || realLoad.tonnes <= 0) {
      abortManualEdgeHaul(dumper, '🚛 Product was taken before this dumper could load');
      return false;
    }

    options.productKey = realLoad.productKey;
    options.visualLoadTonnes = realLoad.tonnes;
    setDumperProductLoadVisual(dumper, realLoad.productKey, realLoad.tonnes);
    updateEdgeHaulEvidenceHook({
      phase: 'hauling-to-edge',
      dumperId: options.dumperId,
      payloadTonnes: options.payloadTonnes,
      holdHud: true,
    });
    dumper.userData.loadedProduct = realLoad.productKey;
    loadVisualShown = true;
    updateAggregateStockpileVisuals();
    updateGameHUD();
    toastGame(`⛟ Loaded ${realLoad.tonnes}t ${formatProductLabel(realLoad.productKey)} for edge haul`);
    return true;
  };

  const tick = now => {
    if (!isManualEdgeHaulRunCurrent(dumper, options.runId)) return;
    const effectiveElapsed = now - startedAt - accumulatedPauseMs;
    const t = Math.min(1, effectiveElapsed / totalMs);
    const travelled = route.totalDistance * t;
    updateEdgeHaulRouteVisual(route, t);
    const sample = sampleRouteAtDistance(route, travelled);
    const previous = dumper.position.clone();
    dumper.position.set(sample.x, getTerrainHeight(sample.x, sample.z), sample.z);
    const dir = dumper.position.clone().sub(previous).setY(0);
    if (dir.lengthSq() > 0.0001) {
      dumper.rotation.y = getVehicleYawForDirection(dir.normalize());
      dumper.traverse(c => {
        if (c.isMesh && c.userData.rolls) c.rotation.z += (route.averageSpeed || 18) * 0.016 * 0.22;
      });
      if (Math.random() < 0.55) spawnActiveDust(dumper.position.x - dir.x * 3, dumper.position.y + 0.35, dumper.position.z - dir.z * 3);
    }

    if (!loadVisualShown && sample.waypointIndex >= route.loadAtWaypointIndex) {
      const loadWaypoint = route.waypoints[route.loadAtWaypointIndex];
      if (loadWaypoint) {
        const previousLoadingPos = dumper.position.clone();
        dumper.position.set(loadWaypoint.x, getTerrainHeight(loadWaypoint.x, loadWaypoint.z), loadWaypoint.z);
        const loadingDir = dumper.position.clone().sub(previousLoadingPos).setY(0);
        if (loadingDir.lengthSq() > 0.0001) dumper.rotation.y = getVehicleYawForDirection(loadingDir.normalize());
      }
      if (loadCycleStartedAt === null) {
        loadCycleStartedAt = now;
        loaderProductStreamSpawned = false;
        updateEdgeHaulEvidenceHook({
          phase: 'loading-at-product',
          dumperId: options.dumperId,
          payloadTonnes: options.payloadTonnes,
          holdHud: true,
        });
      }

      const productPile = getProductStockpileTarget(options.productKey);
      const loaderMachine = getNearestLoadingMachineForProduct(dumper, productPile);
      const cycleProgress = Math.min(1, (now - loadCycleStartedAt) / loadCycleMs);
      const cyclePlan = buildLoaderProductCyclePlan(loaderMachine, dumper, options.productKey, cycleProgress, options.visualLoadTonnes);
      applyLoaderProductCycleVisual(loaderMachine, cyclePlan);
      if (cyclePlan.showMaterialStream && !loaderProductStreamSpawned) {
        loaderProductStreamSpawned = true;
        spawnLoaderProductTransfer(cyclePlan, options.productKey, options.visualLoadTonnes);
      }
      window.__qproLoaderProductCycle = {
        active: true,
        phase: cyclePlan.stage || 'loading-product',
        progress: cyclePlan.progress ?? cycleProgress,
        productKey: options.productKey,
        payloadTonnes: options.visualLoadTonnes,
        streamVisible: Boolean(cyclePlan.showMaterialStream),
      };
      setEdgeHaulButtonState(getLoaderProductCycleUiState(cycleProgress));
      updateGameHUD();

      if (cycleProgress < 1) {
        activeManualEdgeHaulFrame = requestAnimationFrame(tick);
        return;
      }

      accumulatedPauseMs += now - loadCycleStartedAt;
      loadCycleStartedAt = null;
      window.__qproLoaderProductCycle.active = false;
      if (!completeVisibleProductLoad()) return;
    }

    setEdgeHaulButtonState(getEdgeHaulRouteUiState(route, t));

    if (t < 1) {
      activeManualEdgeHaulFrame = requestAnimationFrame(tick);
      return;
    }

    activeManualEdgeHaulFrame = null;
    finishManualEdgeHaul(dumper, options);
  };

  activeManualEdgeHaulFrame = requestAnimationFrame(tick);
}

function sampleRouteAtDistance(route, distance) {
  if (!route.segments.length) {
    const final = route.waypoints.at(-1);
    return { ...final, waypointIndex: route.tipAtWaypointIndex };
  }

  let remaining = distance;
  for (let i = 0; i < route.segments.length; i++) {
    const segment = route.segments[i];
    if (remaining <= segment.distance) {
      const f = segment.distance === 0 ? 1 : Math.max(0, Math.min(1, remaining / segment.distance));
      return {
        x: segment.from.x + (segment.to.x - segment.from.x) * f,
        z: segment.from.z + (segment.to.z - segment.from.z) * f,
        waypointIndex: f >= 0.98 ? i + 1 : i,
      };
    }
    remaining -= segment.distance;
  }

  const final = route.waypoints.at(-1);
  return { ...final, waypointIndex: route.tipAtWaypointIndex };
}

function finishManualEdgeHaul(dumper, options) {
  if (!isManualEdgeHaulRunCurrent(dumper, options.runId)) return;
  const load = getDumperLoad(gameState, options.dumperId);
  if (!load.productKey || load.tonnes <= 0) {
    abortManualEdgeHaul(dumper, '🚛 Dumper arrived empty — no edge tip made');
    return;
  }

  setDumperTipVisual(dumper, 0.55);
  updateEdgeHaulEvidenceHook({
    phase: 'tipping-at-edge',
    dumperId: options.dumperId,
    payloadTonnes: options.payloadTonnes,
    holdHud: true,
  });
  if (options.route) setEdgeHaulButtonState(getEdgeHaulRouteUiState(options.route, 1, { tipping: true }));
  activeManualEdgeHaulTimeout = window.setTimeout(() => {
    activeManualEdgeHaulTimeout = null;
    if (!isManualEdgeHaulRunCurrent(dumper, options.runId)) return;
    const eventStart = gameState.events.length;
    try {
      gameState = tipDumperToEdgeStockpile(gameState, { dumperId: options.dumperId });
    } catch (err) {
      abortManualEdgeHaul(dumper, `🚛 ${err.message}`);
      return;
    }

    const newEvents = gameState.events.slice(eventStart);
    const tipEvent = [...newEvents].reverse()
      .find(event => event.type === 'edge_stockpile_tipped' && event.dumperId === options.dumperId);
    if (!tipEvent) {
      abortManualEdgeHaul(dumper, '🚛 No edge haul moved this run');
      return;
    }

    spawnEdgeTipParticles(dumper, tipEvent.productKey, tipEvent.tonnes);
    clearEdgeHaulRouteVisual();
    clearDumperProductLoadVisual(dumper);
    setDumperTipVisual(dumper, 0);
    updateAggregateStockpileVisuals();
    updateEdgeStockpileVisuals();
    updateEdgeHaulEvidenceHook({
      phase: 'tipped-at-edge',
      dumperId: options.dumperId,
      lastTipTonnes: tipEvent.tonnes,
      payloadTonnes: options.payloadTonnes,
      holdHud: true,
    });
    stats.tonnes = gameState.tonnesToday;
    dumper.userData.manualEdgeHaulActive = false;
    dumper.userData.manualEdgeHaulRunId = null;
    if (activeManualEdgeHaulDumper === dumper) activeManualEdgeHaulDumper = null;
    dumper.userData.loadedProduct = null;
    dumper.userData.target = null;
    dumper.userData.aiState = shouldHaulProductToEdge(gameState) ? 'seek_product' : 'seek_rubble';
    dumper.userData.dumpTimer = 0;
    setEdgeHaulButtonState();
    updateStatsUI();
    updateGameHUD();
    toastLatestEdgeTipEvent();
    window.setTimeout(() => {
      if (activeEdgeHaulEvidence?.phase === 'tipped-at-edge') {
        activeEdgeHaulEvidence = null;
        updateGameHUD();
      }
    }, 1800);
  }, 650);
}

function abortManualEdgeHaul(dumper, message) {
  manualEdgeHaulRunId += 1;
  clearPendingManualEdgeHaulTimers();
  toastGame(message);
  clearEdgeHaulRouteVisual();
  clearDumperProductLoadVisual(dumper);
  activeEdgeHaulEvidence = null;
  setDumperTipVisual(dumper, 0);
  dumper.userData.manualEdgeHaulActive = false;
  dumper.userData.manualEdgeHaulRunId = null;
  if (activeManualEdgeHaulDumper === dumper) activeManualEdgeHaulDumper = null;
  dumper.userData.loadedProduct = null;
  dumper.userData.target = null;
  dumper.userData.dumpTimer = 0;
  dumper.userData.aiState = shouldHaulProductToEdge(gameState) ? 'seek_product' : 'seek_rubble';
  setEdgeHaulButtonState();
  updateGameHUD();
}

function isManualEdgeHaulRunCurrent(dumper, runId) {
  return Boolean(
    dumper
    && dumper.userData.manualEdgeHaulActive
    && dumper.userData.manualEdgeHaulRunId === runId
    && placedEquip.includes(dumper)
  );
}

function clearPendingManualEdgeHaulTimers() {
  if (activeManualEdgeHaulDumper && activePlantFeedOwner === activeManualEdgeHaulDumper.uuid) {
    activePlantFeedOwner = null;
  }
  if (activeManualEdgeHaulFrame !== null) {
    cancelAnimationFrame(activeManualEdgeHaulFrame);
    activeManualEdgeHaulFrame = null;
  }
  if (activeManualEdgeHaulTimeout !== null) {
    window.clearTimeout(activeManualEdgeHaulTimeout);
    activeManualEdgeHaulTimeout = null;
  }
}

function formatProductLabel(productKey) {
  return String(productKey || '').replace('stockpile', '').replace('dust', 'dust');
}

function sellBestWagonLoad() {
  const products = ['stockpile10mm', 'stockpile20mm', 'stockpile40mm', 'dust'];
  const best = products.find(key => (gameState.material[key] || 0) > 0);
  if (!best) {
    toastGame('🚚 No screened product ready for wagons yet');
    return;
  }
  const before = gameState.cash;
  gameState = sellStockpileLoad(gameState, best, 25);
  updateAggregateStockpileVisuals();
  updateEdgeStockpileVisuals();
  const earned = Math.round(gameState.cash - before);
  toastGame(`🚚 Wagon sold ${best.replace('stockpile', '')}: +£${earned.toLocaleString()}`);
  updateStatsUI();
  updateGameHUD();
}

function toastLatestEdgeTipEvent() {
  const event = gameState.events.at(-1);
  if (!event || event.type !== 'edge_stockpile_tipped') return;
  toastGame(`🚛 Tipped ${event.tonnes}t into ${event.edgeKey.replace('edge', 'edge ')} stockpile`);
}

function runManualPlantFeedCycle() {
  const dumper = placedEquip.find(eq => eq.userData.equipType === 'dumper' && !eq.userData.manualEdgeHaulActive)
    || placedEquip.find(eq => eq.userData.equipType === 'dumper');
  const crusherTarget = getCrusherFeedWorldTarget();
  const rubbleTarget = getNearestLooseGroundTarget(dumper?.position || new THREE.Vector3(-30, 0, -45));

  if ((gameState.material.looseGround || 0) <= 0 || !crusherTarget || !rubbleTarget) {
    toastGame('🏭 Need blasted rock and a placed crusher before processing');
    updateGameHUD();
    return;
  }

  if (!dumper || (gameState.equipment.dumper || 0) <= 0) {
    runManualExcavatorCrusherFeedCycle();
    return;
  }

  if (dumper.userData.manualPlantFeedActive || activeManualEdgeHaulDumper || (activePlantFeedOwner && activePlantFeedOwner !== dumper.uuid)) {
    toastGame('🏭 A dumper route is already running');
    return;
  }

  let route;
  try {
    route = createPlantFeedRoute({
      start: dumper.position,
      rubbleTarget,
      crusherTarget,
      useHaulRoad: true,
      speed: 36,
      minDuration: 1.8,
      maxDuration: 4.5,
    });
  } catch (err) {
    toastGame(`🏭 ${err.message}`);
    return;
  }

  const runId = ++manualEdgeHaulRunId;
  clearPendingManualEdgeHaulTimers();
  activeManualEdgeHaulDumper = dumper;
  activePlantFeedOwner = dumper.uuid;
  dumper.userData.manualPlantFeedActive = true;
  dumper.userData.manualEdgeHaulRunId = runId;
  dumper.userData.aiState = 'manual_plant_feed';
  dumper.userData.target = crusherTarget;
  createEdgeHaulRouteVisual(route);
  const initialUi = getPlantFeedRouteUiState(route, 0);
  setProcessButtonState(initialUi.label, initialUi.busy);
  toastGame('🏭 Dumper heading to shot rock, then crusher feed');
  animateManualPlantFeed(dumper, route, { runId });
}

function runManualExcavatorCrusherFeedCycle() {
  const excavator = getNearestEquipment(
    getNearestLooseGroundTarget(new THREE.Vector3(-30, 0, -45)) || new THREE.Vector3(-30, 0, -45),
    placedEquip.filter(eq => eq.userData.equipType === 'excavator')
  );
  const crusher = getNearestEquipment(excavator?.position || new THREE.Vector3(), placedEquip.filter(eq => eq.userData.equipType === 'crusher'));
  const crusherFeed = getCrusherFeedWorldPoint(crusher);
  const rubbleTarget = getNearestLooseGroundTarget(excavator?.position || new THREE.Vector3(-30, 0, -45));

  if (activePlantFeedOwner && activePlantFeedOwner !== excavator?.uuid) {
    toastGame('🏭 Plant feed is already in progress');
    return false;
  }
  if (!excavator || !crusherFeed || !rubbleTarget || (gameState.material.looseGround || 0) <= 0) {
    toastGame('🏭 Need shot rock, an excavator, and a crusher before direct feed');
    updateGameHUD();
    return false;
  }

  const closeEnoughToMuck = horizontalDistance(excavator.position, rubbleTarget) < 42;
  const closeEnoughToCrusher = horizontalDistance(excavator.position, crusherFeed) < 38;
  const crusherCloseToMuck = horizontalDistance(rubbleTarget, crusherFeed) < 58;
  if (!closeEnoughToMuck || !closeEnoughToCrusher || !crusherCloseToMuck) {
    toastGame('🏭 Move the excavator and crusher closer to the shot-rock pile for direct feed');
    updateGameHUD();
    return false;
  }

  activePlantFeedOwner = excavator.uuid;
  excavator.userData.manualExcavatorCrusherFeed = true;
  excavator.userData.workTimer = 0;
  excavator.userData.excavatorCrusherFeedCycle = {
    startedAt: performance.now(),
    feedTonnes: Math.min(25, gameState.material.looseGround || 0),
  };
  excavator.userData.excavatorCrusherFeedStreamSpawned = false;
  excavator.userData.excavatorCrusherProcessingStarted = false;
  excavator.userData.aiState = 'manual_excavator_feed';
  const initialPlan = getExcavatorCrusherFeedCyclePlan({
    elapsedSeconds: 0,
    feedTonnes: excavator.userData.excavatorCrusherFeedCycle.feedTonnes,
    excavatorPosition: excavator.position,
    rubblePosition: rubbleTarget,
    crusherFeedPosition: crusherFeed,
    hasScreener: placedEquip.some(eq => eq.userData.equipType === 'screener'),
  });
  const uiState = getExcavatorCrusherFeedUiState(initialPlan);
  setProcessButtonState(uiState.label, uiState.busy);
  toastGame('⛏ Excavator scooping shot rock into the crusher hopper');
  return true;
}

function runInstantPlantFeedCycle(labelHint = 'plant feed', ownerId = null) {
  const claimOwner = ownerId || 'manual-instant-plant-feed';
  if (activePlantFeedOwner && activePlantFeedOwner !== claimOwner) {
    toastGame('🏭 Plant feed is already in progress');
    updateGameHUD();
    return false;
  }
  const claimedHere = !activePlantFeedOwner;
  if (claimedHere) activePlantFeedOwner = claimOwner;
  const looseBefore = gameState.material.looseGround || 0;
  const productsBefore = totalScreenedStockpiles(gameState);
  const materialBefore = { ...gameState.material };
  gameState = completePlantFeedCycle(gameState, { payloadTonnes: 45, directPayloadTonnes: 25 });
  const moved = Math.max(0, looseBefore - (gameState.material.looseGround || 0));
  if (moved <= 0 && totalScreenedStockpiles(gameState) === productsBefore) {
    if (claimedHere && activePlantFeedOwner === claimOwner) activePlantFeedOwner = null;
    toastGame('🏭 Need blasted rock plus excavator/crusher plant before processing');
    updateGameHUD();
    return false;
  }

  const dischargeFlows = getScreenerDischargeFlows({
    screenerPosition: placedEquip.find(e => e.userData.equipType === 'screener')?.position,
    stockpiles: aggregateStockpiles,
    materialBefore,
    materialAfter: gameState.material,
  });
  removeLoadedLooseGroundVisuals(moved);
  updateAggregateStockpileVisuals();
  spawnScreenerDischargeBurst(dischargeFlows);
  stats.tonnes = gameState.tonnesToday;
  updateStatsUI();
  updateGameHUD();
  const event = gameState.events.at(-1);
  const label = event?.type === 'excavator_crusher_cycle_complete' ? 'excavator fed crusher' : labelHint;
  toastGame(`🏭 Processed ${Math.round(moved)}t — ${label}`);
  if (claimedHere && activePlantFeedOwner === claimOwner) activePlantFeedOwner = null;
  return true;
}

function animateManualPlantFeed(dumper, route, options) {
  const startedAt = performance.now();
  const totalMs = route.durationSeconds * 1000;
  let loadVisualShown = false;

  const tick = now => {
    if (!isManualPlantFeedRunCurrent(dumper, options.runId)) return;
    const t = Math.min(1, (now - startedAt) / totalMs);
    const progressState = getRouteProgressState(route, t);
    const uiState = getPlantFeedRouteUiState(route, t);
    updateEdgeHaulRouteVisual(route, t);
    setProcessButtonState(uiState.label, uiState.busy);

    const sample = sampleRouteAtDistance(route, route.totalDistance * t);
    const previous = dumper.position.clone();
    dumper.position.set(sample.x, getTerrainHeight(sample.x, sample.z), sample.z);
    const dir = dumper.position.clone().sub(previous).setY(0);
    if (dir.lengthSq() > 0.0001) {
      dumper.rotation.y = getVehicleYawForDirection(dir.normalize());
      dumper.traverse(c => {
        if (c.isMesh && c.userData.rolls) c.rotation.z += (route.averageSpeed || 18) * 0.016 * 0.22;
      });
      if (Math.random() < 0.55) spawnActiveDust(dumper.position.x - dir.x * 3, dumper.position.y + 0.35, dumper.position.z - dir.z * 3);
    }

    if (!loadVisualShown && progressState.loadReached) {
      setDumperProductLoadVisual(dumper, 'shot-rock', 45);
      loadVisualShown = true;
    }

    if (t < 1) {
      activeManualEdgeHaulFrame = requestAnimationFrame(tick);
      return;
    }

    activeManualEdgeHaulFrame = null;
    const processingUi = getPlantFeedRouteUiState(route, 1, { processing: true });
    const crusherHopperTarget = getCrusherFeedHopperWorldTarget() || getCrusherFeedWorldTarget();
    const tipPlan = getCrusherTipCyclePlan({
      dumperPosition: dumper.position,
      crusherFeedPosition: crusherHopperTarget,
      progress: 0.56,
      loadedTonnes: 45,
    });
    if (tipPlan.active) {
      dumper.rotation.y = getVehicleYawForDirection(tipPlan.faceDirection);
      setDumperTipVisual(dumper, tipPlan.tipVisualProgress);
      spawnCrusherTipTransfer(tipPlan, tipPlan.loadedTonnes);
    }
    setProcessButtonState(processingUi.label, processingUi.busy);
    activePlantProcessingVisual = {
      startedAt: performance.now(),
      durationMs: 350,
      feedTonnes: tipPlan.active ? tipPlan.loadedTonnes : 45,
    };
    activeManualEdgeHaulTimeout = window.setTimeout(() => {
      if (!isManualPlantFeedRunCurrent(dumper, options.runId)) return;
      activeManualEdgeHaulTimeout = null;
      const ok = runInstantPlantFeedCycle('dumper hauled to plant', dumper.uuid);
      clearEdgeHaulRouteVisual();
      clearDumperProductLoadVisual(dumper);
      dumper.userData.manualPlantFeedActive = false;
      dumper.userData.manualEdgeHaulRunId = null;
      if (activeManualEdgeHaulDumper === dumper) activeManualEdgeHaulDumper = null;
      if (activePlantFeedOwner === dumper.uuid) activePlantFeedOwner = null;
      dumper.userData.aiState = shouldHaulProductToEdge(gameState) ? 'seek_product' : 'seek_rubble';
      dumper.userData.target = null;
      setProcessButtonState();
      if (ok) setDumperTipVisual(dumper, 1);
      window.setTimeout(() => {
        if (placedEquip.includes(dumper) && dumper.userData.manualEdgeHaulRunId !== options.runId) setDumperTipVisual(dumper, 0);
      }, 500);
    }, 350);
  };

  activeManualEdgeHaulFrame = requestAnimationFrame(tick);
}

function isManualPlantFeedRunCurrent(dumper, runId) {
  return Boolean(
    dumper
    && dumper.userData.manualPlantFeedActive
    && dumper.userData.manualEdgeHaulRunId === runId
    && placedEquip.includes(dumper)
  );
}

function setProcessButtonState(label = '🏭 Process load', busy = false) {
  const button = document.getElementById('q3d-process-btn');
  if (!button) return;
  button.textContent = label;
  button.disabled = busy;
  button.setAttribute('aria-busy', busy ? 'true' : 'false');
  button.style.opacity = busy ? '0.75' : '1';
}

function getCrusherFeedWorldTarget() {
  const crusher = placedEquip.find(eq => eq.userData.equipType === 'crusher');
  if (!crusher) return null;
  const localFeed = crusher.userData.feedPoint || new THREE.Vector3(-13.5, 8.9, 0);
  const world = localFeed.clone();
  crusher.localToWorld(world);
  return new THREE.Vector3(world.x, getTerrainHeight(world.x, world.z), world.z);
}

function getCrusherFeedHopperWorldTarget() {
  const crusher = placedEquip.find(eq => eq.userData.equipType === 'crusher');
  if (!crusher) return null;
  const localFeed = crusher.userData.feedPoint || new THREE.Vector3(-13.5, 8.9, 0);
  const world = localFeed.clone();
  crusher.localToWorld(world);
  return new THREE.Vector3(world.x, world.y, world.z);
}

function toastLatestProductionEvent() {
  const event = gameState.events.at(-1);
  if (!event || !['haul_cycle_complete', 'excavator_crusher_cycle_complete'].includes(event.type)) return;
  if (gameState.haulCycles % 3 !== 0) return;
  toastGame(`🏭 ${event.sellableTonnes}t processed through the plant`);
}

function toastGame(message) {
  if (window.toast) window.toast(message, 'info', 2400);
  else console.log('[QuarryPro]', message);
}

function updateClock() {
  const el = document.getElementById('q3d-s-shift');
  if (!el) return;
  const e = Math.floor((Date.now() - stats.shiftStart) / 1000);
  const h = String(Math.floor(e / 3600)).padStart(2, '0');
  const m = String(Math.floor((e % 3600) / 60)).padStart(2, '0');
  const s = String(e % 60).padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
}

// ═══════════════════════════════════════════════════════════════
// RESIZE
// ═══════════════════════════════════════════════════════════════
function onResize() {
  const wrap = document.getElementById('q3d-wrap');
  if (!wrap || !renderer) return;
  const W = wrap.clientWidth  || 800;
  const H = Math.max(wrap.clientHeight || 400, 300);
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
  if (isDirectFeedProofUrl() && placedEquip.some(eq => eq.userData.equipType === 'excavator')) {
    applyDirectFeedProofFraming();
    updateDirectFeedProofOverlay();
  }
}

// ═══════════════════════════════════════════════════════════════
// STARTER DEMO
// ═══════════════════════════════════════════════════════════════
function buildStarterQuarryDemo() {
  resetScene({ silent: true });

  const { x, z } = gridToWorld(STARTER_DEMO_FACE_GRID.ix, STARTER_DEMO_FACE_GRID.iz);
  deformTerrain(STARTER_DEMO_FACE_GRID.ix, STARTER_DEMO_FACE_GRID.iz);

  gameState = buildStarterQuarryState(createInitialGameState());
  updateWaterFromTerrain(getCurrentPitDepth());
  STARTER_DEMO_EQUIPMENT.forEach(item => {
    const y = getTerrainHeight(item.x, item.z);
    placeEquipment(item.type, item.x, y, item.z, { chargeState: false, yaw: item.yaw });
  });

  spawnLooseGroundPiles(x, getTerrainHeight(x, z), z, gameState.material.looseGround || 0);
  updateEquipmentHeights();
  updateAggregateStockpileVisuals();
  updateEdgeStockpileVisuals();
  stats.tonnes = gameState.material.blastedRock;
  stats.blasts = gameState.blasts;
  stats.vehicles = placedEquip.length;
  updateStatsUI();
  updateGameHUD();
  updateCounts();
  setTool('blast');
  toastGame('▶ Starter quarry ready — screened product is waiting. Tap Tip Edge to haul it out.');
}

function buildDirectFeedProofDemo() {
  resetScene({ silent: true });

  const { x, z } = gridToWorld(STARTER_DEMO_FACE_GRID.ix, STARTER_DEMO_FACE_GRID.iz);
  deformTerrain(STARTER_DEMO_FACE_GRID.ix, STARTER_DEMO_FACE_GRID.iz);

  gameState = buildDirectFeedStarterState(createInitialGameState());
  updateWaterFromTerrain(getCurrentPitDepth());
  DIRECT_FEED_DEMO_EQUIPMENT.forEach(item => {
    const y = getTerrainHeight(item.x, item.z);
    placeEquipment(item.type, item.x, y, item.z, { chargeState: false, yaw: item.yaw });
  });

  spawnLooseGroundPiles(x, getTerrainHeight(x, z), z, gameState.material.looseGround || 0);
  updateEquipmentHeights();
  updateAggregateStockpileVisuals();
  updateEdgeStockpileVisuals();
  stats.tonnes = gameState.material.blastedRock;
  stats.blasts = gameState.blasts;
  stats.vehicles = placedEquip.length;
  updateStatsUI();
  updateGameHUD();
  updateCounts();
  setTool('blast');
  setProcessButtonState();
  applyDirectFeedProofFraming();
  updateDirectFeedProofOverlay();
  toastGame('⛏ Direct-feed proof ready — no dumper placed. Tap Process load to watch the excavator feed the crusher.');
}

function bootRequestedDemoMode() {
  const params = new URLSearchParams(window.location.search || '');
  const demoMode = params.get('demo');
  const smokeMode = params.get('smoke');
  if (demoMode === 'direct-feed' || demoMode === 'excavator-feed') {
    window.setTimeout(buildDirectFeedProofDemo, 120);
  } else if (smokeMode) {
    window.setTimeout(buildStarterQuarryDemo, 120);
  }
}

// ═══════════════════════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════════════════════
function resetScene(options = {}) {
  manualEdgeHaulRunId += 1;
  clearPendingManualEdgeHaulTimers();
  activeManualEdgeHaulDumper = null;
  activePlantProcessingVisual = null;
  activePlantFeedOwner = null;
  clearEdgeHaulRouteVisual();

  // Remove all placed equipment
  placedEquip.forEach(eq => {
    scene.remove(eq);
    disposeObject3D(eq);
  });
  placedEquip.length = 0;
  // Remove blast markers
  blastMarkers.forEach(cleanupBlastMarker);
  blastMarkers.length = 0;
  // Remove particles
  particles.forEach(p => {
    scene.remove(p);
    disposeObject3D(p);
  });
  particles.length = 0;
  // Remove loose ground piles
  looseGroundPiles.forEach(p => {
    scene.remove(p);
    disposeObject3D(p);
  });
  looseGroundPiles.length = 0;

  // Reset terrain
  const pos = terrainMesh.geometry.attributes.position;
  const col = terrainMesh.geometry.attributes.color;
  const V   = (GRID + 1) * (GRID + 1);
  for (let i = 0; i < V; i++) {
    const ix = i % (GRID + 1);
    const iz = Math.floor(i / (GRID + 1));
    const y = getInitialTerrainHeight(ix, iz);
    pos.setY(i, y);
    heightmap[i] = y;
    col.setXYZ(i, COL_LIMESTONE.r, COL_LIMESTONE.g, COL_LIMESTONE.b);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  terrainMesh.geometry.computeVertexNormals();
  updateTerrainAnchoredObjectHeights();

  // Reset stats
  gameState = createInitialGameState();
  stats.tonnes = 0;
  stats.vehicles = 0;
  stats.blasts = 0;
  stats.shiftStart = Date.now();
  nextDumperId = 1;

  updateStatsUI();
  updateLagoonVisuals();
  updateAggregateStockpileVisuals();
  updateEdgeStockpileVisuals();
  updateGameHUD();
  setEdgeHaulButtonState();
  setProcessButtonState();
  updateBlastActionUI();
  updateCounts();
  const hint = document.getElementById('q3d-hint');
  if (hint && !isDirectFeedProofUrl()) hint.style.display = 'block';
  document.getElementById('q3d-popup').style.display = 'none';

  // Reset camera
  camera.position.set(-150, 160, 210);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}

// ═══════════════════════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════════════════════
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  controls.update();
  updateParticles(dt);
  updateAI(dt);
  updateDustSuppressionRig(dt);
  animateBlastMarkers();
  updateClock();
  publishOperationsSnapshot({ force: false });
  renderer.render(scene, camera);
}

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════
function init() {
  injectHTML();
  initThree();
  updateGameHUD();
  animate();
  bootRequestedDemoMode();
  console.log('[QuarryPro 3D] ✓ Ready — Bankfield Quarry Simulator');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
