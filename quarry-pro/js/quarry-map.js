/**
 * QuarryPro - Live Operations Map
 * 2D overhead quarry simulation with deployable vehicles
 */

class QuarryMap {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.vehicles = [];           // deployed vehicles
    this.pendingDeploy = null;    // vehicle waiting to be placed
    this.cursor = 'default';
    this.mousePos = { x: 0, y: 0 };
    this.lastTime = null;
    this.scale = 1;
    this.tooltip = null;
    this.satelliteReady = false;
    this.satellite = new Image();
    this.satellite.onload = () => { this.satelliteReady = true; };
    this.satellite.src = 'images/bankfield_satellite.jpg';

    // Canvas logical size
    this.W = 900;
    this.H = 560;

    this.defineLayout();
    this.setupCanvas();
    this.setupEvents();
    this.seedDemoFleet();
    this.loop(0);
  }

  // ─── MAP LAYOUT ───────────────────────────────────────────────────────────
  defineLayout() {
    // Haul road waypoints (vehicles follow these)
    this.HAUL_ROAD = [
      { x: 155, y: 295 },  // 0: face loading zone
      { x: 200, y: 315 },  // 1: exit face level 1
      { x: 240, y: 340 },  // 2: access ramp down
      { x: 295, y: 368 },  // 3: quarry floor
      { x: 370, y: 400 },  // 4: floor haul
      { x: 430, y: 430 },  // 5: approaching crusher
      { x: 458, y: 455 },  // 6: crusher tip point
    ];

    this.RETURN_ROAD = [
      { x: 458, y: 455 }, // 0: from crusher
      { x: 500, y: 430 }, // 1: exit crusher
      { x: 560, y: 395 }, // 2: up ramp
      { x: 620, y: 350 }, // 3: upper road
      { x: 660, y: 290 }, // 4: towards compound
      { x: 685, y: 220 }, // 5: compound gate
      { x: 685, y: 165 }, // 6: compound park
    ];

    this.COMPOUND_TO_FACE = [
      { x: 685, y: 165 },
      { x: 685, y: 220 },
      { x: 660, y: 290 },
      { x: 580, y: 320 },
      { x: 440, y: 310 },
      { x: 300, y: 295 },
      { x: 200, y: 295 },
      { x: 155, y: 295 },
    ];

    // Key zones
    this.ZONES = {
      face:      { x: 90,  y: 210, w: 160, h: 130, label: 'Active Face' },
      crusher:   { x: 420, y: 435, w: 80,  h: 55,  label: 'Primary Crusher' },
      stockpile: { x: 560, y: 420, w: 120, h: 70,  label: 'Stockpile' },
      compound:  { x: 635, y: 100, w: 115, h: 95,  label: 'Compound' },
      weighbridge:{ x: 750, y: 310, w: 70, h: 35,  label: 'Weighbridge' },
    };

    this.SNAP_ZONES = [
      { zone: 'face',      x: 140, y: 260 },
      { zone: 'stockpile', x: 615, y: 450 },
      { zone: 'compound',  x: 685, y: 155 },
      { zone: 'crusher',   x: 458, y: 455 },
    ];
  }

  // ─── CANVAS SETUP ─────────────────────────────────────────────────────────
  setupCanvas() {
    const resize = () => {
      const container = this.canvas.parentElement;
      const cw = container.clientWidth || 900;
      const ch = container.clientHeight || 560;
      this.scale = Math.max(0.1, Math.min(cw / this.W, ch / this.H));
      this.canvas.width  = this.W * this.scale;
      this.canvas.height = this.H * this.scale;
      this.canvas.style.width  = this.canvas.width  + 'px';
      this.canvas.style.height = this.canvas.height + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
  }

  setupEvents() {
    this.canvas.addEventListener('mousemove', e => {
      const r = this.canvas.getBoundingClientRect();
      this.mousePos = {
        x: (e.clientX - r.left) / this.scale,
        y: (e.clientY - r.top)  / this.scale,
      };
    });

    this.canvas.addEventListener('click', e => {
      const r = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) / this.scale;
      const my = (e.clientY - r.top)  / this.scale;
      if (this.pendingDeploy) {
        this.placeVehicle(mx, my);
      }
    });

    this.canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.pendingDeploy = null;
      this.canvas.style.cursor = 'default';
    });
  }

  // ─── MAIN LOOP ────────────────────────────────────────────────────────────
  loop(ts) {
    const dt = this.lastTime ? Math.min((ts - this.lastTime) / 1000, 0.05) : 0;
    this.lastTime = ts;
    this.update(dt);
    this.draw();
    requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    for (const v of this.vehicles) this.updateVehicle(v, dt);
    this.canvas.style.cursor = this.pendingDeploy ? 'crosshair' : 'default';
  }

  // ─── TERRAIN DRAWING ──────────────────────────────────────────────────────
  draw() {
    const ctx = this.ctx;
    const s = this.scale;
    ctx.save();
    ctx.scale(s, s);

    this.drawBackground(ctx);
    this.drawQuarryFace(ctx);
    this.drawRoads(ctx);
    this.drawBuildings(ctx);
    this.drawVehicles(ctx);
    this.drawLabels(ctx);
    this.drawDeployOverlay(ctx);

    ctx.restore();
  }

  drawBackground(ctx) {
    // Bankfield-inspired satellite base image with dark product overlay.
    if (this.satelliteReady) {
      const iw = this.satellite.width;
      const ih = this.satellite.height;
      const cover = Math.max(this.W / iw, this.H / ih);
      const dw = iw * cover;
      const dh = ih * cover;
      ctx.globalAlpha = 0.88;
      ctx.drawImage(this.satellite, (this.W - dw) / 2, (this.H - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(6, 10, 12, 0.44)';
      ctx.fillRect(0, 0, this.W, this.H);
    } else {
      const base = ctx.createLinearGradient(0, 0, this.W, this.H);
      base.addColorStop(0, '#23311f');
      base.addColorStop(0.45, '#121914');
      base.addColorStop(1, '#2a251a');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, this.W, this.H);
    }

    // Subtle telemetry grid
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.W; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke(); }
    for (let y = 0; y < this.H; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke(); }
    ctx.restore();

    // Quarry excavation pit - large grey-brown area
    const grad = ctx.createRadialGradient(280, 340, 20, 280, 340, 330);
    grad.addColorStop(0, 'rgba(82,78,70,0.86)');
    grad.addColorStop(0.52, 'rgba(55,53,49,0.86)');
    grad.addColorStop(1, 'rgba(26,29,26,0.80)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(292, 355, 315, 220, -0.05, 0, Math.PI * 2);
    ctx.fill();

    // Green perimeter / restoration areas
    ctx.fillStyle = 'rgba(36, 64, 39, 0.34)';
    ctx.beginPath();
    ctx.ellipse(710, 140, 170, 95, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(25, 46, 30, 0.32)';
    ctx.fillRect(0, 0, this.W, 86);
  }

  drawQuarryFace(ctx) {
    // Multi-level limestone benches (top-down view shows them as nested arcs/rects)
    const benchColors = ['#5a5a5a', '#525252', '#4a4a4a', '#424242', '#3c3c3c'];
    const levels = [
      { x: 50,  y: 160, w: 200, h: 200, r: 20 },  // outermost bench
      { x: 70,  y: 185, w: 165, h: 165, r: 16 },
      { x: 88,  y: 208, w: 132, h: 132, r: 13 },
      { x: 104, y: 228, w: 102, h: 102, r: 10 },
      { x: 118, y: 245, w: 75,  h: 75,  r: 8 },   // innermost / active face
    ];

    levels.forEach((b, i) => {
      // Bench platform
      ctx.fillStyle = benchColors[i];
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, b.r);
      ctx.fill();

      // Bench edge highlight (lighter top edge = limestone face)
      ctx.fillStyle = i === levels.length - 1 ? '#b8b0a0' : '#6a6a6a';
      ctx.fillRect(b.x, b.y, b.w, 5);

      // Rock texture dots on active face
      if (i === levels.length - 1) {
        ctx.fillStyle = 'rgba(200,190,170,0.3)';
        for (let d = 0; d < 12; d++) {
          const dx = b.x + 8 + (d * 17 % b.w);
          const dy = b.y + 8 + (d * 11 % b.h);
          ctx.beginPath();
          ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    // Standing water at bottom of pit (blue pool)
    ctx.fillStyle = 'rgba(30, 80, 120, 0.6)';
    ctx.beginPath();
    ctx.ellipse(155, 285, 35, 22, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 140, 200, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawRoads(ctx) {
    // Main haul road - thick dirt road
    ctx.strokeStyle = '#6b5a3a';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.drawPath(ctx, this.HAUL_ROAD);

    // Road centre line
    ctx.strokeStyle = '#7d6b48';
    ctx.lineWidth = 16;
    this.drawPath(ctx, this.HAUL_ROAD);

    // Return road
    ctx.strokeStyle = '#6b5a3a';
    ctx.lineWidth = 18;
    this.drawPath(ctx, this.RETURN_ROAD);
    ctx.strokeStyle = '#7d6b48';
    ctx.lineWidth = 16;
    this.drawPath(ctx, this.RETURN_ROAD);

    // Compound-to-face upper road
    ctx.strokeStyle = '#5a4d30';
    ctx.lineWidth = 14;
    this.drawPath(ctx, this.COMPOUND_TO_FACE.slice(2));
    ctx.strokeStyle = '#6b5a3a';
    ctx.lineWidth = 12;
    this.drawPath(ctx, this.COMPOUND_TO_FACE.slice(2));

    // Dust edge overlay on haul road
    ctx.strokeStyle = 'rgba(180,160,100,0.08)';
    ctx.lineWidth = 24;
    this.drawPath(ctx, this.HAUL_ROAD);

    // Road direction arrows (subtle)
    ctx.strokeStyle = 'rgba(180,160,100,0.15)';
    ctx.lineWidth = 1.5;
    this.drawArrowsAlongPath(ctx, this.HAUL_ROAD, 80);
  }

  drawPath(ctx, pts) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const mx = (prev.x + curr.x) / 2;
      const my = (prev.y + curr.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }

  drawArrowsAlongPath(ctx, pts, spacing) {
    let dist = spacing;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      let d = 0;
      while (d < len) {
        if (dist <= 0) {
          const x = a.x + (dx / len) * d;
          const y = a.y + (dy / len) * d;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-5, -3); ctx.lineTo(0, 0); ctx.lineTo(-5, 3);
          ctx.stroke();
          ctx.restore();
          dist = spacing;
        }
        d += 5;
        dist -= 5;
      }
    }
  }

  drawBuildings(ctx) {
    // ─── PRIMARY CRUSHER ───
    const cz = this.ZONES.crusher;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(cz.x + 4, cz.y + 4, cz.w, cz.h);
    // Base
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(cz.x, cz.y, cz.w, cz.h);
    // Red accent roof / machinery
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(cz.x, cz.y, cz.w, 8);
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(cz.x + 10, cz.y + 12, 18, 14);
    ctx.fillRect(cz.x + 40, cz.y + 12, 18, 14);
    // Conveyor belt out
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cz.x + cz.w, cz.y + cz.h / 2);
    ctx.lineTo(cz.x + cz.w + 55, cz.y + cz.h / 2 - 25);
    ctx.stroke();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 4;
    ctx.stroke();
    // Crusher pulsing circle (animated in updateVehicle)
    this.drawCrusherPulse(ctx, cz.x + cz.w / 2, cz.y + cz.h / 2);

    // ─── STOCKPILE ───
    const sz = this.ZONES.stockpile;
    // 3 mounds
    const mounds = [
      { x: sz.x + 20, y: sz.y + 35, rx: 35, ry: 22 },
      { x: sz.x + 65, y: sz.y + 28, rx: 42, ry: 26 },
      { x: sz.x + 105,y: sz.y + 38, rx: 28, ry: 18 },
    ];
    mounds.forEach(m => {
      const mg = ctx.createRadialGradient(m.x, m.y - 5, 2, m.x, m.y, m.rx);
      mg.addColorStop(0, '#909090');
      mg.addColorStop(0.5, '#6a6a6a');
      mg.addColorStop(1, '#484848');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      // Shadow line
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // ─── COMPOUND / WORKSHOP ───
    const comp = this.ZONES.compound;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(comp.x + 3, comp.y + 3, comp.w, comp.h);
    ctx.fillStyle = '#252f1e';
    ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
    // Fence
    ctx.strokeStyle = '#3a4a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);
    // Workshop building
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(comp.x + 8, comp.y + 8, 55, 40);
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(comp.x + 8, comp.y + 8, 55, 5);
    // Parking bays
    ctx.strokeStyle = '#3a4f2e';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.strokeRect(comp.x + 68, comp.y + 10 + i * 18, 36, 16);
    }

    // ─── WEIGHBRIDGE ───
    const wb = this.ZONES.weighbridge;
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(wb.x, wb.y, wb.w, wb.h);
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(wb.x, wb.y, wb.w, 4);
    ctx.fillStyle = '#666';
    ctx.fillRect(wb.x + 5, wb.y + 8, wb.w - 10, 10);

    // ─── EXIT GATE ───
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(810, 320); ctx.lineTo(840, 320);
    ctx.stroke();
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(838, 312, 6, 16);
  }

  drawCrusherPulse(ctx, cx, cy) {
    const t = Date.now() / 400;
    const r = 8 + Math.sin(t) * 3;
    const a = 0.5 + Math.sin(t) * 0.25;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(204, 0, 0, ${a})`;
    ctx.fill();
  }

  drawVehicles(ctx) {
    for (const v of this.vehicles) {
      this.drawVehicle(ctx, v);
    }
  }

  drawVehicle(ctx, v) {
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.rotate(v.angle);

    const size = v.size || 12;
    const col  = v.color || '#fff';

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;

    // Body shape by type
    ctx.fillStyle = col;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;

    switch (v.type) {
      case 'adt':
      case 'dumper':
        // Articulated dumper - chunky rectangle with cab
        ctx.beginPath();
        ctx.roundRect(-size, -size * 0.6, size * 2, size * 1.2, 2);
        ctx.fill(); ctx.stroke();
        // Cab
        ctx.fillStyle = '#d4a017';
        ctx.fillRect(-size, -size * 0.6, size * 0.7, size * 1.2);
        // Wheels (4 dots)
        ctx.fillStyle = '#222';
        [[-size * 0.7, -size * 0.7], [-size * 0.7, size * 0.7],
         [size * 0.5, -size * 0.7],  [size * 0.5, size * 0.7]].forEach(([wx, wy]) => {
          ctx.beginPath(); ctx.arc(wx, wy, 3, 0, Math.PI * 2); ctx.fill();
        });
        break;

      case 'excavator':
      case '360-excavator':
        // Excavator body
        ctx.beginPath();
        ctx.roundRect(-size * 0.8, -size * 0.7, size * 1.6, size * 1.4, 3);
        ctx.fill(); ctx.stroke();
        // Rotating upper (house)
        ctx.fillStyle = '#d4a017';
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.7, size * 0.55, this.getArmAngle(v), 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Boom arm
        ctx.strokeStyle = '#d4a017';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const armA = this.getArmAngle(v);
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(armA) * size * 1.4, Math.sin(armA) * size * 1.4);
        ctx.stroke();
        // Bucket
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(Math.cos(armA) * size * 1.4, Math.sin(armA) * size * 1.4, 4, 0, Math.PI * 2);
        ctx.fill();
        break;

      case 'loading-shovel':
      case 'loader':
        ctx.beginPath();
        ctx.roundRect(-size, -size * 0.65, size * 2, size * 1.3, 3);
        ctx.fill(); ctx.stroke();
        // Bucket at front
        ctx.fillStyle = '#888';
        ctx.fillRect(size - 2, -size * 0.5, size * 0.7, size);
        break;

      case 'dozer':
      case 'bulldozer':
        ctx.beginPath();
        ctx.roundRect(-size * 0.9, -size * 0.7, size * 1.8, size * 1.4, 2);
        ctx.fill(); ctx.stroke();
        // Blade
        ctx.fillStyle = '#888';
        ctx.fillRect(-size - 8, -size * 0.65, 10, size * 1.3);
        break;

      case 'supervisor':
      case 'pickup':
        ctx.beginPath();
        ctx.roundRect(-size * 0.7, -size * 0.5, size * 1.4, size, 4);
        ctx.fill(); ctx.stroke();
        break;

      default:
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // Status indicator dot
    ctx.fillStyle = this.statusDotColor(v.state);
    ctx.beginPath();
    ctx.arc(-size + 4, -size * 0.6 - 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();

    // Label above vehicle
    ctx.save();
    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.fillText(v.label, v.x, v.y - 16);
    ctx.restore();

    // Progress bar for loading/tipping
    if (v.state === 'loading' || v.state === 'tipping') {
      const prog = Math.min(v.stateTimer / v.stateDuration, 1);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(v.x - 18, v.y - 28, 36, 5);
      ctx.fillStyle = v.state === 'loading' ? '#ffd700' : '#cc0000';
      ctx.fillRect(v.x - 18, v.y - 28, 36 * prog, 5);
      ctx.restore();
    }
  }

  getArmAngle(v) {
    const t = Date.now() / 800;
    return Math.sin(t + v.id * 1.5) * 0.8;
  }

  statusDotColor(state) {
    switch (state) {
      case 'driving':  return '#3fb950';
      case 'loading':  return '#ffd700';
      case 'tipping':  return '#ff9100';
      case 'idle':     return '#8b949e';
      case 'working':  return '#58a6ff';
      default:         return '#fff';
    }
  }

  drawLabels(ctx) {
    const labels = [
      { x: 155, y: 155, text: 'ACTIVE FACE', sub: 'Bench 3' },
      { x: 458, y: 425, text: 'PRIMARY CRUSHER', sub: null },
      { x: 615, y: 408, text: 'STOCKPILE', sub: null },
      { x: 692, y: 95,  text: 'COMPOUND', sub: null },
      { x: 785, y: 305, text: 'WEIGHBRIDGE', sub: null },
    ];

    labels.forEach(l => {
      ctx.save();
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(204, 0, 0, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(l.text, l.x, l.y);
      if (l.sub) {
        ctx.font = '8px monospace';
        ctx.fillStyle = 'rgba(180,180,180,0.6)';
        ctx.fillText(l.sub, l.x, l.y + 11);
      }
      ctx.restore();
    });

    // Scale bar
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(30, this.H - 30, 80, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px monospace';
    ctx.fillText('100m', 30, this.H - 35);
    ctx.restore();

    // North arrow
    ctx.save();
    ctx.translate(this.W - 35, 35);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -15);
    ctx.beginPath();
    ctx.moveTo(0, -12); ctx.lineTo(5, 5); ctx.lineTo(0, 1); ctx.lineTo(-5, 5); ctx.closePath();
    ctx.fillStyle = '#cc0000';
    ctx.fill();
    ctx.restore();
  }

  drawDeployOverlay(ctx) {
    if (!this.pendingDeploy) return;

    // Dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, this.W, this.H);

    // Instruction banner
    ctx.fillStyle = 'rgba(204,0,0,0.9)';
    ctx.fillRect(0, 0, this.W, 32);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`📍 Click on the map to deploy: ${this.pendingDeploy.name}   (Right-click to cancel)`, this.W / 2, 20);

    // Cursor preview vehicle at mouse
    const { x, y } = this.mousePos;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeStyle = '#cc0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Suggested snap zone highlights
    this.SNAP_ZONES.forEach(sz => {
      const z = this.ZONES[sz.zone];
      if (!z) return;
      ctx.strokeStyle = 'rgba(204,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(z.x, z.y, z.w, z.h);
      ctx.setLineDash([]);
    });
  }

  // ─── VEHICLE SIMULATION ───────────────────────────────────────────────────
  updateVehicle(v, dt) {
    v.stateTimer += dt;

    switch (v.state) {
      case 'idle':
        // Static machines (excavators at face, crushers)
        if (v.type === 'excavator' || v.type === '360-excavator') {
          v.state = 'working';
        }
        break;

      case 'working':
        // Excavators/loaders just animate in place (arm swings via getArmAngle)
        break;

      case 'route-to-face':
        this.driveAlongPath(v, this.COMPOUND_TO_FACE, dt, () => {
          v.state = 'loading';
          v.stateTimer = 0;
          v.stateDuration = 8 + Math.random() * 6;
        });
        break;

      case 'loading':
        // Wait at face while "loading"
        if (v.stateTimer >= v.stateDuration) {
          v.state = 'route-to-crusher';
          v.stateTimer = 0;
          v.pathIndex = 0;
        }
        break;

      case 'route-to-crusher':
        this.driveAlongPath(v, this.HAUL_ROAD, dt, () => {
          v.state = 'tipping';
          v.stateTimer = 0;
          v.stateDuration = 4 + Math.random() * 3;
        });
        break;

      case 'tipping':
        if (v.stateTimer >= v.stateDuration) {
          v.state = 'route-return';
          v.stateTimer = 0;
          v.pathIndex = 0;
        }
        break;

      case 'route-return':
        this.driveAlongPath(v, this.RETURN_ROAD, dt, () => {
          // Short rest at compound, then head back
          v.state = 'route-to-face';
          v.pathIndex = 0;
          v.stateTimer = 0;
        });
        break;
    }
  }

  driveAlongPath(v, path, dt, onComplete) {
    if (v.pathIndex >= path.length - 1) {
      v.pathIndex = path.length - 1;
      v.x = path[v.pathIndex].x;
      v.y = path[v.pathIndex].y;
      onComplete();
      return;
    }

    const target = path[v.pathIndex + 1];
    const dx = target.x - v.x;
    const dy = target.y - v.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = v.speed * dt;

    if (dist <= speed) {
      v.x = target.x;
      v.y = target.y;
      v.pathIndex++;
    } else {
      v.x += (dx / dist) * speed;
      v.y += (dy / dist) * speed;
      v.angle = Math.atan2(dy, dx);
    }

    v.state = v.state; // stay in current drive state
  }

  // ─── DEPLOY FLOW ──────────────────────────────────────────────────────────
  beginDeploy(vehicleData) {
    this.pendingDeploy = vehicleData;
    // Show the map panel
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    const mapPanel = document.getElementById('panel-map');
    if (mapPanel) mapPanel.style.display = 'block';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const mapBtn = document.querySelector('[data-panel="map"]');
    if (mapBtn) mapBtn.classList.add('active');
  }

  placeVehicle(mx, my) {
    if (!this.pendingDeploy) return;
    const vd = this.pendingDeploy;
    this.pendingDeploy = null;

    const isDumper = ['adt', 'dumper'].includes(vd.type);
    const isExcavator = ['excavator', '360-excavator'].includes(vd.type);

    const v = {
      id: vd.id || Date.now(),
      name: vd.name,
      label: vd.name.split(' ').map(w => w[0]).join('').substring(0, 4),
      type: vd.type,
      x: mx,
      y: my,
      angle: 0,
      speed: isDumper ? 55 : 30,
      size: isDumper ? 13 : 11,
      color: this.vehicleColor(vd.type),
      state: isDumper ? 'route-to-face' : (isExcavator ? 'working' : 'idle'),
      pathIndex: 0,
      stateTimer: 0,
      stateDuration: 10,
    };

    // Snap dumpers to compound start
    if (isDumper) {
      v.x = this.COMPOUND_TO_FACE[0].x;
      v.y = this.COMPOUND_TO_FACE[0].y;
    }

    this.vehicles.push(v);
    this.renderDeployedList();
    this.showToast(`${v.name} deployed to site`);
  }

  vehicleColor(type) {
    const map = {
      'adt':           '#f0a500',
      'dumper':        '#f0a500',
      'excavator':     '#cc8800',
      '360-excavator': '#cc8800',
      'loading-shovel':'#e08800',
      'loader':        '#e08800',
      'dozer':         '#d0a020',
      'bulldozer':     '#d0a020',
      'supervisor':    '#5599ff',
      'pickup':        '#5599ff',
    };
    return map[type] || '#aaa';
  }

  seedDemoFleet() {
    const demo = [
      { id: 'demo-d01', name: 'Dumper 01', label: 'D01', type: 'adt', x: this.COMPOUND_TO_FACE[0].x, y: this.COMPOUND_TO_FACE[0].y, angle: 0, speed: 58, size: 13, color: '#ffb347', state: 'route-to-face', pathIndex: 0, stateTimer: 0, stateDuration: 10 },
      { id: 'demo-d02', name: 'Dumper 02', label: 'D02', type: 'adt', x: this.HAUL_ROAD[2].x, y: this.HAUL_ROAD[2].y, angle: 0.35, speed: 52, size: 13, color: '#ff9f1c', state: 'route-to-crusher', pathIndex: 2, stateTimer: 0, stateDuration: 10 },
      { id: 'demo-d03', name: 'Dumper 03', label: 'D03', type: 'dumper', x: this.RETURN_ROAD[3].x, y: this.RETURN_ROAD[3].y, angle: -0.5, speed: 48, size: 12, color: '#f4c16b', state: 'route-return', pathIndex: 3, stateTimer: 0, stateDuration: 10 },
      { id: 'demo-ex01', name: 'PC800 Face Shovel', label: 'EX1', type: 'excavator', x: 138, y: 263, angle: 0.2, speed: 0, size: 12, color: '#ffd166', state: 'working', pathIndex: 0, stateTimer: 0, stateDuration: 10 },
      { id: 'demo-wb01', name: 'Water Bowser', label: 'WB1', type: 'pickup', x: 612, y: 335, angle: -0.7, speed: 26, size: 10, color: '#37c8ab', state: 'working', pathIndex: 0, stateTimer: 0, stateDuration: 10 },
    ];
    this.vehicles.push(...demo);
    this.renderDeployedList();
  }

  renderDeployedList() {
    const list = document.getElementById('deployedVehicleList');
    if (!list) return;
    if (!this.vehicles.length) {
      list.innerHTML = '<p class="info-text" style="font-size:12px;">No vehicles deployed yet. Use the Fleet panel to deploy.</p>';
      return;
    }
    const stateLabel = (v) => (v.state || 'idle').replace(/^route-/, '').replace(/-/g, ' ');
    list.innerHTML = this.vehicles.map(v => `
      <div class="deployed-asset-row">
        <span class="asset-dot" style="background:${this.statusDotColor(v.state)}"></span>
        <div><strong>${v.label}</strong><small>${v.name} · ${stateLabel(v)}</small></div>
      </div>
    `).join('');
  }

  removeVehicle(vehicleId) {
    this.vehicles = this.vehicles.filter(v => v.id !== vehicleId);
    this.renderDeployedList();
  }

  showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = `position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:#1a2a1a;border:1px solid #3fb950;color:#3fb950;
      padding:8px 18px;border-radius:6px;font-size:13px;z-index:9999;
      font-family:monospace;box-shadow:0 4px 12px rgba(0,0,0,0.5);`;
    t.textContent = '✓ ' + msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }
}

// ─── GLOBAL INSTANCE ─────────────────────────────────────────────────────────
let quarryMap;

document.addEventListener('DOMContentLoaded', () => {
  // Wait a tick for the map canvas to exist
  setTimeout(() => {
    quarryMap = new QuarryMap('quarryMapCanvas');
  }, 300);
});
