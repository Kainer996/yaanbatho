/* Merlin's short, local play flight. No game, care, inventory or save state.
   Atlas poses, paths and the DOM lifecycle live together so the preview uses
   the exact same renderer as the game. All coordinates below are CSS pixels. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzMerlinFlight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = t => t * t * (3 - 2 * t);
  const point = (x, y, z = 0) => ({ x, y, z });
  const DEFAULT_ATLAS = { columns: 8, rows: 8, cell: 256, pivot: [.5, .625] };
  const depthScale = z => mix(.77, 1.05, (z + 1) / 2);
  const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
  const yawRow = yaw => clamp(Math.round(Math.acos(Math.cos(yaw)) / (Math.PI / 4)), 0, 4);
  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, (b.z - a.z) * 80);
  const normal = v => {
    const n = Math.hypot(v.x, v.y, v.z * 80) || 1;
    return point(v.x / n, v.y / n, v.z / n);
  };
  const inside = (p, b) => point(clamp(p.x, b.left, b.right), clamp(p.y, b.top, b.bottom), clamp(p.z || 0, -1, 1));

  function flightBounds(width, height, size = 136, top = 108, bottom = 112) {
    const radius = Math.min(size * .65, width * .24, height * .24);
    const left = radius + 6, right = Math.max(left, width - radius - 6);
    const y0 = Math.min(top + radius * .35, height * .36);
    const y1 = Math.max(y0, height - bottom - radius * .35);
    return { left, right, top: y0, bottom: y1, width, height, radius };
  }

  function bezier(points, t) {
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return point(...['x', 'y', 'z'].map(k => points.reduce((s, p, i) => s + (p[k] || 0) * w[i], 0)));
  }

  function tangent(points, t) {
    const u = 1 - t;
    return point(...['x', 'y', 'z'].map(k =>
      3 * u * u * (points[1][k] - points[0][k]) + 6 * u * t * (points[2][k] - points[1][k]) + 3 * t * t * (points[3][k] - points[2][k])));
  }

  // Arc-length sampling keeps the centre of a tight bank from suddenly
  // stopping while the wings continue at full power. Convex controls bound
  // the entire path, including curves near a short landscape viewport edge.
  function makeCurve(from, to, velocity, bounds, speed, endVelocity) {
    const gap = distance(from, to);
    const aim = normal(point(to.x - from.x, to.y - from.y, to.z - from.z));
    const initial = Math.hypot(velocity.x, velocity.y, velocity.z * 80) > 1 ? normal(velocity) : aim;
    const final = endVelocity ? normal(endVelocity) : aim;
    const reach = clamp(gap * .34, 18, 130);
    const points = [from,
      inside(point(from.x + initial.x * reach, from.y + initial.y * reach, from.z + initial.z * reach), bounds),
      inside(point(to.x - final.x * reach, to.y - final.y * reach, to.z - final.z * reach), bounds), to];
    const table = [0];
    let prev = from, total = 0;
    for (let i = 1; i <= 40; i++) {
      const p = bezier(points, i / 40);
      total += distance(prev, p); table.push(total); prev = p;
    }
    return { points, table, length: total, duration: clamp(total / speed, .65, 4.2) };
  }

  function curveSample(curve, fraction) {
    const target = clamp(fraction, 0, 1) * curve.length;
    let i = 1;
    while (i < curve.table.length - 1 && curve.table[i] < target) i++;
    const before = curve.table[i - 1], span = curve.table[i] - before;
    const t = (i - 1 + (span ? (target - before) / span : 0)) / (curve.table.length - 1);
    return { position: bezier(curve.points, t), tangent: tangent(curve.points, t) };
  }

  function viewForVelocity(velocity, state = 'cruise') {
    if (state === 'reach') return 6;
    if (state === 'carry') return 7;
    // z is camera depth, independent of screen-space height. Rear views are
    // therefore actual turns away, not a flipped front-facing cutout.
    const horizontal = Math.abs(velocity.x);
    const depth = velocity.z * 170;
    if (velocity.y < -Math.max(36, horizontal * .8)) return 5;
    if (velocity.y > Math.max(50, horizontal * 1.15)) return 6;
    if (Math.abs(depth) > horizontal * 1.6) return depth > 0 ? 0 : 4;
    if (Math.abs(depth) > horizontal * .3) return depth > 0 ? 1 : 3;
    return 2;
  }

  function wingPose(elapsed, speed, state, reduced, phase, gliding) {
    if (reduced) return { frame: 2, powered: false };
    // Cadence is an artistic rendering choice, not a measured biological Hz.
    // Merlin has purposeful fast beats, with occasional short swept glides;
    // a talon approach brakes briefly without hovering or a vertical stoop.
    const powered = gliding == null ? state !== 'cruise' || elapsed % 4.6 < 4.16 : !gliding;
    const hz = state === 'reach' ? 3.6 : clamp(3.6 + speed / 220, 3.8, 4.8);
    return { frame: powered ? Math.floor((phase == null ? elapsed * hz % 1 : phase) * 8) : 5, powered };
  }

  function openRectangles(area, obstacles) {
    let spaces = [area];
    for (const obstacle of obstacles) {
      spaces = spaces.flatMap(rect => {
        const left = Math.max(rect.left, obstacle.left), right = Math.min(rect.right, obstacle.right);
        const top = Math.max(rect.top, obstacle.top), bottom = Math.min(rect.bottom, obstacle.bottom);
        if (left >= right || top >= bottom) return [rect];
        return [
          { left: rect.left, right: rect.right, top: rect.top, bottom: top },
          { left: rect.left, right: rect.right, top: bottom, bottom: rect.bottom },
          { left: rect.left, right: left, top, bottom },
          { left: right, right: rect.right, top, bottom }
        ].filter(space => space.right - space.left > 1 && space.bottom - space.top > 1);
      });
    }
    return spaces;
  }

  function spriteGeometry(view = {}, size = 136, atlas = {}) {
    const config = { ...DEFAULT_ATLAS, ...atlas };
    const row = clamp(Math.floor(view.row || 0), 0, config.rows - 1);
    const frame = clamp(Math.floor(view.frame || 0), 0, config.columns - 1);
    const pivot = config.pivot;
    const rowTalons = config.talons && config.talons[row];
    const anchor = rowTalons && (Array.isArray(rowTalons[0]) ? rowTalons[frame] : rowTalons) || [.5, .82];
    const drawSize = size * (view.scale == null ? 1 : view.scale);
    const localX = (anchor[0] - pivot[0]) * drawSize, localY = (anchor[1] - pivot[1]) * drawSize;
    const facingX = view.mirror ? -localX : localX;
    const angle = view.bank || 0, cos = Math.cos(angle), sin = Math.sin(angle);
    const position = view.position || point(0, 0);
    const talon = { x: position.x + facingX * cos - localY * sin, y: position.y + facingX * sin + localY * cos };
    return {
      row, frame, drawSize,
      source: [frame * config.cell, row * config.cell, config.cell, config.cell],
      destination: [-drawSize * pivot[0], -drawSize * pivot[1], drawSize, drawSize],
      localTalon: { x: localX, y: localY },
      talon,
      // A held pebble follows Merlin's closing/reorienting grip continuously
      // across discrete painted poses. Atlas inspection still uses raw talons.
      grip: view.gripOffset ? { x: position.x + view.gripOffset.x, y: position.y + view.gripOffset.y } : talon
    };
  }

  // The atlas inspector and game can share the exact crop, body pivot and
  // mirror/bank transform. No state or animation loop is created by this helper.
  function drawSprite(context, image, view, options = {}) {
    const geometry = spriteGeometry(view, options.size || 136, options.atlas);
    const position = view.position || point(0, 0);
    context.save(); context.translate(position.x, position.y); context.rotate(view.bank || 0);
    context.scale(view.mirror ? -1 : 1, 1);
    const deltaX = geometry.grip.x - geometry.talon.x, deltaY = geometry.grip.y - geometry.talon.y;
    if (view.carrying && !view.reducedMotion && Math.hypot(deltaX, deltaY) > .5) {
      // A continuous small mesh closes the grip while preserving the torso.
      // Shared vertices prevent the alpha seams caused by independent strips;
      // the outer mesh stays fixed so lower wings do not shear as a whole.
      const angle = view.bank || 0, cosine = Math.cos(angle), sine = Math.sin(angle);
      const dx = (deltaX * cosine + deltaY * sine) * (view.mirror ? -1 : 1);
      const dy = -deltaX * sine + deltaY * cosine;
      const [sx, sy, cell] = geometry.source;
      const [left, top, drawSize] = geometry.destination;
      const sourcePivot = -top / drawSize * cell;
      context.drawImage(image, sx, sy, cell, sourcePivot, left, top, drawSize, -top);
      const xs = [left, geometry.localTalon.x, left + drawSize];
      const ys = [0, geometry.localTalon.y, top + drawSize];
      const vertices = ys.map((y, row) => xs.map((x, column) => ({
        source: { x, y }, target: { x: x + (row === 1 && column === 1 ? dx : 0), y: y + (row === 1 && column === 1 ? dy : 0) }
      })));
      function triangle(vertices) {
        const source = vertices.map(vertex => vertex.source), target = vertices.map(vertex => vertex.target);
        const area = (target[1].x - target[0].x) * (target[2].y - target[0].y) - (target[1].y - target[0].y) * (target[2].x - target[0].x);
        // Expand clip edges by half a CSS pixel. Adjacent triangles overlap
        // only at their shared seam, covering subpixel clip antialiasing.
        const expanded = target.map((vertex, i) => {
          const prev = target[(i + 2) % 3], next = target[(i + 1) % 3];
          const edgeA = { x: vertex.x - prev.x, y: vertex.y - prev.y }, edgeB = { x: next.x - vertex.x, y: next.y - vertex.y };
          const lengthA = Math.hypot(edgeA.x, edgeA.y), lengthB = Math.hypot(edgeB.x, edgeB.y), sign = area > 0 ? 1 : -1;
          const nA = { x: sign * edgeA.y / lengthA, y: -sign * edgeA.x / lengthA }, nB = { x: sign * edgeB.y / lengthB, y: -sign * edgeB.x / lengthB };
          const nx = nA.x + nB.x, ny = nA.y + nB.y, amount = .5 / Math.max(.001, nx * nA.x + ny * nA.y);
          return { x: vertex.x + nx * amount, y: vertex.y + ny * amount };
        });
        const ux = source[1].x - source[0].x, uy = source[1].y - source[0].y, vx = source[2].x - source[0].x, vy = source[2].y - source[0].y;
        const dux = target[1].x - target[0].x, duy = target[1].y - target[0].y, dvx = target[2].x - target[0].x, dvy = target[2].y - target[0].y;
        const determinant = ux * vy - uy * vx;
        const a = (dux * vy - dvx * uy) / determinant, b = (duy * vy - dvy * uy) / determinant;
        const c = (dvx * ux - dux * vx) / determinant, d = (dvy * ux - duy * vx) / determinant;
        const e = target[0].x - a * source[0].x - c * source[0].y, f = target[0].y - b * source[0].x - d * source[0].y;
        context.save(); context.beginPath(); context.moveTo(expanded[0].x, expanded[0].y);
        context.lineTo(expanded[1].x, expanded[1].y); context.lineTo(expanded[2].x, expanded[2].y); context.closePath(); context.clip();
        context.transform(a, b, c, d, e, f);
        context.drawImage(image, ...geometry.source, ...geometry.destination); context.restore();
      }
      for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
        const a = vertices[row][column], b = vertices[row][column + 1], c = vertices[row + 1][column], d = vertices[row + 1][column + 1];
        triangle([a, b, d]); triangle([a, d, c]);
      }
    } else context.drawImage(image, ...geometry.source, ...geometry.destination);
    context.restore();
    return geometry;
  }

  class FlightModel {
    constructor(options = {}) {
      this.rng = options.rng || Math.random;
      this.size = options.size || 136;
      this.atlas = { ...DEFAULT_ATLAS, ...(options.atlas || {}) };
      this.bounds = options.bounds || flightBounds(390, 844, this.size);
      this.home = options.home || point(this.bounds.right, this.bounds.top, .65);
      this.position = { ...this.home };
      this.velocity = point(-40, 10, -.5);
      this.duration = (options.durationMs || 25000) / 1000;
      this.reduced = !!options.reducedMotion;
      this.elapsed = 0; this.segmentTime = 0; this.routeIndex = 0;
      this.state = this.reduced ? 'cruise' : 'takeoff';
      this.token = null; this.carrying = null; this.pickups = 0;
      this.contactTarget = null;
      this.arrivalYaw = null; this.yaw = -Math.PI / 4; this.turning = false;
      this.gripOffset = null;
      this.deposited = null; this.done = false; this.finishReason = 'complete';
      this.bank = 0; this.scale = .68; this.facingRight = false;
      this.row = 1; this.rowAge = 0; this.turnStep = 0;
      this.wingPhase = .125; this.glideRemaining = 0; this.nextGlideAt = 4.1;
      this.returnPoint = this.safeContactPoint(options.returnPoint || point(this.bounds.left + 24, this.bounds.bottom - 20, .65), 7);
      if (this.reduced) {
        this.position = inside(point(this.home.x, this.home.y + 34, .55), this.bounds);
        this.scale = 1;
      } else this.route('takeoff');
    }

    route(state = 'cruise') {
      this.state = state;
      this.contactTarget = null;
      this.arrivalYaw = null;
      const b = this.bounds;
      // A circuit alternates foreground, profile, far-side and return views.
      // Small offsets vary the routes; corners have room for the swept bank.
      const route = [[.22, .27, -.4], [.52, .18, -1], [.84, .44, -.35], [.72, .72, .65], [.24, .64, 1], [.16, .42, .3]];
      const target = route[this.routeIndex++ % route.length];
      const x = clamp(target[0] + (this.rng() - .5) * .12, .08, .92);
      const y = clamp(target[1] + (this.rng() - .5) * .13, .08, .9);
      const destination = point(mix(b.left, b.right, x), mix(b.top, b.bottom, y), target[2]);
      const next = route[this.routeIndex % route.length];
      const end = point(mix(b.left, b.right, next[0]) - destination.x, mix(b.top, b.bottom, next[1]) - destination.y, next[2] - destination.z);
      this.setCurve(destination, state === 'takeoff' ? 145 : 150 + this.rng() * 34, end);
    }

    setCurve(destination, speed, end) {
      this.curve = makeCurve(this.position, inside(destination, this.bounds), this.velocity, this.bounds, speed, end);
      this.segmentTime = 0;
    }

    safeContactPoint(target, row) {
      let horizontal = 0, below = 0;
      for (let frame = 0; frame < this.atlas.columns; frame++) {
        const offset = spriteGeometry({ row, frame, scale: 1.05 }, this.size, this.atlas).talon;
        horizontal = Math.max(horizontal, Math.abs(offset.x)); below = Math.max(below, offset.y);
      }
      return inside(target, { ...this.bounds, left: this.bounds.left + horizontal, right: this.bounds.right - horizontal, top: this.bounds.top + below });
    }

    drop(x, y) {
      if (this.done || this.state === 'landing') return false;
      const b = this.bounds;
      // The floor is an air-play boundary, never the phone dock or map HUD.
      const safe = this.safeContactPoint(inside(point(x, y, .6), { ...b, top: b.top + this.size * .3 }), 6);
      this.token = { x: safe.x, y: safe.y, originY: safe.y, floorY: Math.min(safe.y + 48, b.bottom), age: 0, id: (this.tokenId || 0) + 1 };
      this.tokenId = this.token.id;
      if (!this.carrying) {
        if (this.reduced) {
          // Static pose + short opacity feedback honours reduced motion.
          this.state = 'reach'; this.segmentTime = 0; this.reducedPickupAt = this.elapsed + .22;
        } else this.chase();
      }
      return true;
    }

    chase() {
      if (!this.token) return this.route();
      this.state = 'chase';
      // Talons finish above the small falling pebble. The final tangent is
      // shallow, with forward motion carried through the pickup.
      const arrivalMirror = this.token.x > this.position.x;
      const sign = arrivalMirror ? 1 : -1;
      this.arrivalYaw = sign * 1.1;
      this.contactTarget = point(this.token.x, this.token.floorY, .65);
      const offset = spriteGeometry({ row: 6, frame: 2, scale: depthScale(.65), mirror: arrivalMirror }, this.size, this.atlas).talon;
      const destination = point(this.token.x - offset.x, this.token.floorY - offset.y, .65);
      this.setCurve(destination, 205, point(sign * 95, 26, .2));
      // Leave enough curved approach for an opposing heading to turn before
      // the last third of the path reaches forward with asymmetric talons.
      this.curve.duration = Math.max(this.curve.duration, Math.abs(angleDelta(this.yaw, this.arrivalYaw)) / (3.4 * .59) + .18);
    }

    pickup() {
      if (!this.token) return;
      this.carrying = { ...this.token, age: 0 };
      this.gripOffset = { x: this.token.x - this.position.x, y: this.token.y - this.position.y };
      if (this.reduced) this.gripOffset = spriteGeometry({ row: 7, frame: 2, scale: this.scale, mirror: this.facingRight }, this.size, this.atlas).talon;
      this.token = null; this.pickups++;
      this.state = 'carry'; this.segmentTime = 0;
      this.contactTarget = { ...this.returnPoint };
      if (!this.reduced) {
        const arrivalMirror = this.returnPoint.x > this.position.x;
        this.arrivalYaw = (arrivalMirror ? 1 : -1) * .85;
        const offset = spriteGeometry({ row: 7, frame: 2, scale: depthScale(.7), mirror: arrivalMirror }, this.size, this.atlas).talon;
        this.setCurve(point(this.returnPoint.x - offset.x, this.returnPoint.y - offset.y, .7), 145, point(arrivalMirror ? 70 : -70, 18, .5));
        this.curve.duration = Math.max(this.curve.duration, Math.abs(angleDelta(this.yaw, this.arrivalYaw)) / (3.4 * .59) + .18);
      }
    }

    land(reason = 'complete') {
      if (this.done || this.state === 'landing') return;
      this.finishReason = reason;
      this.token = null; this.carrying = null;
      this.contactTarget = null;
      this.arrivalYaw = null; this.gripOffset = null;
      this.state = 'landing';
      if (this.reduced) { this.done = true; return; }
      // The perch may be closer to the viewport edge than the flight area.
      // A shrinking landing sprite reaches its measured resting position.
      const expanded = { ...this.bounds, left: Math.min(this.bounds.left, this.home.x), right: Math.max(this.bounds.right, this.home.x), top: Math.min(this.bounds.top, this.home.y), bottom: Math.max(this.bounds.bottom, this.home.y) };
      this.curve = makeCurve(this.position, this.home, this.velocity, expanded, 155, point(45, 34, .6));
      this.curve.duration = clamp(this.curve.duration, .6, 3.2);
      this.segmentTime = 0;
    }

    step(delta) {
      if (this.done) return this.snapshot();
      const dt = clamp(delta || 0, 0, .05);
      this.elapsed += dt; this.rowAge += dt;
      // Integrate phase, rather than multiplying wall time by a changing
      // cadence: acceleration must never jump backwards halfway through a beat.
      if (this.glideRemaining > 0 && this.state === 'cruise') {
        this.glideRemaining = Math.max(0, this.glideRemaining - dt); this.wingPhase = .625;
      } else {
        this.glideRemaining = 0;
        const hz = this.state === 'reach' ? 3.6 : clamp(3.6 + Math.hypot(this.velocity.x, this.velocity.y) / 220, 3.8, 4.8);
        this.wingPhase = (this.wingPhase + dt * hz) % 1;
        if (this.state === 'cruise' && this.elapsed >= this.nextGlideAt && this.wingPhase >= .625 && this.wingPhase < .75) {
          this.glideRemaining = .34; this.nextGlideAt = this.elapsed + 4.6; this.wingPhase = .625;
        }
      }
      if (this.token) {
        this.token.age += dt;
        this.token.y = this.reduced ? this.token.floorY : Math.min(this.token.floorY, this.token.originY + 130 * this.token.age * this.token.age);
      }
      if (this.deposited) {
        this.deposited.age += dt;
        if (this.deposited.age > .65) this.deposited = null;
      }
      if (this.elapsed >= this.duration && this.state !== 'landing') this.land();
      if (this.reduced) {
        if (this.state === 'reach' && this.elapsed >= this.reducedPickupAt) this.pickup();
        if (this.state === 'carry' && (this.segmentTime += dt) > .7) {
          this.deposited = { ...this.returnPoint, age: 0 };
          this.carrying = null; this.state = 'cruise';
          if (this.token) { this.state = 'reach'; this.reducedPickupAt = this.elapsed + .22; }
        }
        this.row = this.state === 'carry' ? 7 : this.state === 'reach' ? 6 : 1;
        return this.snapshot();
      }
      this.segmentTime += dt;
      const progress = clamp(this.segmentTime / this.curve.duration, 0, 1);
      const sample = curveSample(this.curve, this.state === 'landing' ? ease(progress) : progress);
      const nextVelocity = normal(sample.tangent);
      const speed = this.curve.length / this.curve.duration;
      const vx = nextVelocity.x * speed, vy = nextVelocity.y * speed;
      const headingDelta = Math.atan2(this.velocity.x * vy - this.velocity.y * vx, this.velocity.x * vx + this.velocity.y * vy);
      this.bank = mix(this.bank, clamp(headingDelta / Math.max(dt, .016) * .095, -.3, .3), 1 - Math.exp(-dt * 7));
      this.velocity = point(vx, vy, nextVelocity.z * speed);
      this.position = sample.position;
      // Yaw is continuous. A reversal travels through a front or rear view;
      // it can never mirror a profile, rising pose or reaching talons in place.
      const targetYaw = this.arrivalYaw == null ? Math.atan2(vx, this.velocity.z * 170) : this.arrivalYaw;
      this.yaw += clamp(angleDelta(this.yaw, targetYaw), -3.4 * dt, 3.4 * dt);
      this.turning = Math.abs(angleDelta(this.yaw, targetYaw)) > .12;
      const previousMirror = this.facingRight;
      if (Math.sin(this.yaw) > .1) this.facingRight = true;
      else if (Math.sin(this.yaw) < -.1) this.facingRight = false;
      if (this.state === 'chase' && progress > .64 && !this.turning) this.state = 'reach';
      let desiredRow = yawRow(this.yaw);
      if (!this.turning && this.state === 'reach') desiredRow = 6;
      else if (!this.turning && this.state === 'carry') desiredRow = 7;
      else if (!this.turning && Math.abs(Math.sin(this.yaw)) > .58) {
        const pitched = viewForVelocity(this.velocity);
        if (pitched === 5 || pitched === 6) desiredRow = pitched;
      }
      if (previousMirror !== this.facingRight) {
        this.row = yawRow(this.yaw) < 2 ? 0 : 4; this.rowAge = 0;
      } else if (desiredRow !== this.row && this.rowAge > .09) {
        this.row = desiredRow; this.rowAge = 0;
      }
      const atDepth = depthScale(this.position.z);
      const desiredScale = this.state === 'takeoff' ? mix(.68, atDepth, ease(progress)) : this.state === 'landing' ? mix(atDepth, .64, ease(progress)) : atDepth;
      this.scale = mix(this.scale, desiredScale, 1 - Math.exp(-dt * 10));
      const wing = wingPose(this.elapsed, speed, this.state, false, this.wingPhase, this.glideRemaining > 0);
      if (this.carrying && this.gripOffset) {
        const painted = spriteGeometry({ row: this.row, frame: wing.frame, scale: this.scale, bank: this.bank, mirror: this.facingRight }, this.size, this.atlas).talon;
        const dx = painted.x - this.gripOffset.x, dy = painted.y - this.gripOffset.y;
        const length = Math.hypot(dx, dy);
        const amount = length ? Math.min(1, this.size * .72 * dt / length) : 1;
        this.gripOffset.x += dx * amount; this.gripOffset.y += dy * amount;
      }
      if (this.contactTarget && (this.state === 'reach' || this.state === 'carry')) {
        // The final approach uses the actual displayed frame, scale and bank.
        // Its talons touch the pebble before it becomes attached, even with
        // asymmetric per-frame anchors. Ease the small endpoint correction in
        // over the approach instead of snapping the sprite on the pickup frame.
        const strength = ease(clamp((progress - .64) / .36, 0, 1));
        this.bank *= 1 - strength;
        const offset = this.carrying && this.gripOffset || spriteGeometry({ row: this.row, frame: wing.frame, scale: this.scale, bank: this.bank, mirror: this.facingRight }, this.size, this.atlas).talon;
        const endpoint = this.curve.points[3];
        this.position.x += (this.contactTarget.x - offset.x - endpoint.x) * strength;
        this.position.y += (this.contactTarget.y - offset.y - endpoint.y) * strength;
        this.position = inside(this.position, this.bounds);
      }
      if (progress >= 1) {
        if (this.state === 'landing') this.done = true;
        else if (this.state === 'chase' || this.state === 'reach') this.pickup();
        else if (this.state === 'carry') {
          this.deposited = { ...this.returnPoint, age: 0 }; this.carrying = null;
          if (this.token) this.chase(); else this.route();
        } else this.route();
      }
      return this.snapshot();
    }

    snapshot() {
      const pose = wingPose(this.elapsed, Math.hypot(this.velocity.x, this.velocity.y), this.state, this.reduced, this.wingPhase, this.glideRemaining > 0);
      return { position: { ...this.position }, velocity: { ...this.velocity }, state: this.state, row: this.row, frame: pose.frame, powered: pose.powered, bank: this.bank, scale: this.scale, mirror: this.facingRight, yaw: this.yaw, turning: this.turning, gripOffset: this.gripOffset && { ...this.gripOffset }, token: this.token && { ...this.token }, carrying: !!this.carrying, deposited: this.deposited && { ...this.deposited }, pickups: this.pickups, elapsed: this.elapsed, done: this.done, reducedMotion: this.reduced };
    }
  }

  const images = new Map();
  function loadAtlas(url, env) {
    if (images.has(url)) return images.get(url);
    const promise = new Promise((resolve, reject) => {
      const image = new env.Image();
      const timeout = env.setTimeout(() => {
        image.onload = image.onerror = null;
        reject(new Error('Merlin flight artwork took too long to load.'));
      }, 10000);
      image.onload = () => {
        env.clearTimeout(timeout);
        if (!image.naturalWidth || !image.naturalHeight) reject(new Error('Merlin flight artwork is empty.'));
        else resolve(image);
      };
      image.onerror = () => { env.clearTimeout(timeout); reject(new Error('Merlin flight artwork could not load.')); };
      image.src = url;
    }).catch(error => { images.delete(url); throw error; });
    images.set(url, promise);
    return promise;
  }

  function isInteractiveTarget(target, boundary, env) {
    for (let el = target; el && el !== boundary; el = el.parentElement) {
      if (el.matches && el.matches('button,a,input,select,textarea,summary,label,[role="button"],[role="link"],[role="slider"],[role="dialog"],[contenteditable="true"],[tabindex],[onclick],[data-action],[data-screen],[data-game-route],canvas,.maplibregl-map,.mapboxgl-map,.leaflet-container,[data-merlin-flight-ignore]')) return true;
      if (typeof el.onclick === 'function' || typeof el.onpointerdown === 'function' || typeof el.ontouchstart === 'function') return true;
      if (env && env.getComputedStyle && el !== env.document.body) {
        const style = env.getComputedStyle(el);
        if ((/auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 2) || (/auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 2)) return true;
      }
    }
    return false;
  }

  function create(options = {}) {
    const env = options.environment || (typeof window !== 'undefined' ? window : null);
    if (!env || !env.document) throw new Error('Merlin flight requires a browser.');
    const doc = env.document;
    let active = false, loading = null, generation = 0, raf = 0, lastTime = null, startedAt = null;
    let layer, canvas, ctx, pad, status, finishButton, touchField, model, atlasImage, bounds, padBox;
    let lastHolesAt = -Infinity, holesSignature = '', originX = 0, originY = 0;
    let tookOff = false, disposed = false, cleanups = [], previousFocus = null, pickupCount = 0;
    const config = { ...DEFAULT_ATLAS, ...(options.atlas || {}) };
    const size = options.size || 136;
    const media = env.matchMedia ? env.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const listen = (target, type, callback, settings) => {
      target.addEventListener(type, callback, settings);
      cleanups.push(() => target.removeEventListener(type, callback, settings));
    };
    const call = (name, data) => { if (typeof options[name] === 'function') options[name](data); };
    const hostRect = () => options.getHostRect ? options.getHostRect() : options.host && options.host.getBoundingClientRect ? options.host.getBoundingClientRect() : { left: env.innerWidth - 96, top: 80, width: 88, height: 88 };
    const allowed = () => !doc.hidden && (!options.shouldContinue || options.shouldContinue());

    function teardown(reason) {
      if (!active && !layer) return;
      const wasActive = active;
      active = false; generation++; loading = null;
      if (raf) env.cancelAnimationFrame(raf);
      raf = 0; lastTime = null; startedAt = null;
      cleanups.splice(0).forEach(remove => remove());
      const focusWasInside = layer && layer.contains(doc.activeElement);
      if (layer) layer.remove();
      layer = canvas = ctx = pad = status = finishButton = touchField = null;
      if (tookOff) { tookOff = false; call('onRestore', { reason }); }
      if (focusWasInside && previousFocus && previousFocus.isConnected && previousFocus.focus) previousFocus.focus({ preventScroll: true });
      previousFocus = null;
      if (wasActive) call('onFinish', { reason, pickups: model ? model.pickups : 0 });
    }

    function stop(reason = 'finished', settings = {}) {
      if (!active) return;
      if (settings.immediate || !model || !layer || !allowed() || model.reduced) return teardown(reason);
      model.home = measuredHome();
      model.land(reason);
      if (pad) { pad.classList.add('is-finishing'); pad.setAttribute('aria-disabled', 'true'); }
      if (finishButton) finishButton.disabled = true;
      if (status) status.textContent = 'Merlin is returning to his perch';
    }

    function measuredHome() {
      const rect = hostRect();
      return point(clamp(rect.left + rect.width / 2 - originX, 24, bounds.width - 24), clamp(rect.top + rect.height / 2 - originY, 24, bounds.height - 24), .65);
    }

    function bindLifecycle() {
      // Bind before the image request: changing screens during a slow load
      // cannot revive a play session on a different screen when it completes.
      listen(doc, 'visibilitychange', () => { if (doc.hidden) teardown('hidden'); });
      listen(env, 'pagehide', () => teardown('pagehide'));
      listen(env, 'resize', () => teardown('resize'));
      listen(env, 'orientationchange', () => teardown('orientation'));
      const viewport = env.visualViewport;
      if (viewport) { listen(viewport, 'resize', () => teardown('viewport')); listen(viewport, 'scroll', () => teardown('viewport')); }
      if (media.addEventListener) listen(media, 'change', () => teardown('motion-preference'));
      else if (media.addListener) { const change = () => teardown('motion-preference'); media.addListener(change); cleanups.push(() => media.removeListener(change)); }
      if (env.MutationObserver) {
        const screen = doc.body.getAttribute('data-active-screen');
        const observer = new env.MutationObserver(() => {
          if (doc.body.getAttribute('data-active-screen') !== screen || !allowed()) teardown('navigation');
        });
        observer.observe(doc.body, { attributes: true, attributeFilter: ['data-active-screen'] });
        cleanups.push(() => observer.disconnect());
      }
    }

    function refreshTouchHoles() {
      if (!touchField || !doc.querySelectorAll) return;
      const obstacles = [];
      // Actual native controls remain native controls. Subtract their boxes
      // from the hit surface instead of replaying synthetic clicks at them.
      const selector = 'button,a,input,select,textarea,summary,[onclick],[role="button"],[role="link"],[role="dialog"],[data-action],[data-game-route],[data-merlin-flight-ignore],.map-area-birds-panel,.map-bird-overlay';
      doc.querySelectorAll(selector).forEach(element => {
        if (layer.contains(element) || !element.getClientRects().length) return;
        const style = env.getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || style.pointerEvents === 'none') return;
        const rect = element.getBoundingClientRect();
        const box = { left: rect.left - padBox.left - originX - 4, right: rect.right - padBox.left - originX + 4, top: rect.top - padBox.top - originY - 4, bottom: rect.bottom - padBox.top - originY + 4 };
        if (box.right > 0 && box.bottom > 0 && box.left < padBox.width && box.top < padBox.height) obstacles.push(box);
      });
      const spaces = openRectangles({ left: 0, top: 0, right: padBox.width, bottom: padBox.height - 62 }, obstacles);
      const signature = JSON.stringify(spaces.map(rect => [rect.left, rect.top, rect.right, rect.bottom].map(Math.round)));
      if (signature === holesSignature) return;
      holesSignature = signature;
      touchField.replaceChildren();
      spaces.forEach(rect => {
        const tile = doc.createElement('span'); tile.className = 'merlin-flight-hit';
        Object.assign(tile.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.right - rect.left + 'px', height: rect.bottom - rect.top + 'px' });
        touchField.appendChild(tile);
      });
    }

    function prepare() {
      const viewport = env.visualViewport;
      const width = viewport ? viewport.width : env.innerWidth, height = viewport ? viewport.height : env.innerHeight;
      originX = viewport && viewport.offsetLeft || 0; originY = viewport && viewport.offsetTop || 0;
      bounds = flightBounds(width, height, size, options.topInset || 108, options.bottomInset || 112);
      layer = doc.createElement('div'); layer.className = 'merlin-flight-layer'; layer.dataset.merlinFlight = 'active';
      layer.style.width = width + 'px'; layer.style.height = height + 'px'; layer.style.left = originX + 'px'; layer.style.top = originY + 'px';
      canvas = doc.createElement('canvas'); canvas.className = 'merlin-flight-canvas'; canvas.setAttribute('aria-hidden', 'true');
      const dpr = Math.min(env.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Merlin flight needs a canvas context.');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      pad = doc.createElement('section'); pad.className = 'merlin-flight-sky'; pad.setAttribute('aria-label', "Merlin's play sky");
      pad.tabIndex = 0; pad.setAttribute('aria-description', 'Tap an open spot to drop a pebble. Keyboard: Enter drops a pebble in the centre. Escape finishes.');
      const padTop = height < 480 ? Math.max(72, height * .23) : Math.max(150, Math.min(height * .27, height - 235));
      const padHeight = Math.max(70, Math.min(340, height - padTop - 112));
      const padWidth = Math.min(width - 24, 620);
      padBox = { left: (width - padWidth) / 2, top: padTop, width: padWidth, height: padHeight };
      Object.assign(pad.style, { left: (width - padWidth) / 2 + 'px', top: padTop + 'px', width: padWidth + 'px', height: padHeight + 'px' });
      touchField = doc.createElement('div'); touchField.className = 'merlin-flight-touchfield'; pad.appendChild(touchField);
      const skyLabel = doc.createElement('span'); skyLabel.className = 'merlin-flight-sky-label'; skyLabel.textContent = 'PLAY SKY'; pad.appendChild(skyLabel);
      const toolbar = doc.createElement('div'); toolbar.className = 'merlin-flight-toolbar';
      status = doc.createElement('span'); status.className = 'merlin-flight-status'; status.setAttribute('aria-live', 'polite'); status.textContent = 'Tap open space · Merlin will fetch';
      finishButton = doc.createElement('button'); finishButton.type = 'button'; finishButton.className = 'merlin-flight-finish'; finishButton.textContent = 'Finish';
      const actions = doc.createElement('div'); actions.className = 'merlin-flight-actions';
      toolbar.appendChild(status); toolbar.appendChild(actions);
      if (typeof options.onCare === 'function') {
        const careButton = doc.createElement('button'); careButton.type = 'button'; careButton.className = 'merlin-flight-finish merlin-flight-care'; careButton.textContent = 'Care';
        careButton.setAttribute('aria-label', "Open Merlin's care menu");
        listen(careButton, 'click', event => { event.stopPropagation(); call('onCare'); });
        actions.appendChild(careButton);
      }
      actions.appendChild(finishButton); pad.appendChild(toolbar);
      layer.appendChild(pad); layer.appendChild(canvas); doc.body.appendChild(layer);
      previousFocus = doc.activeElement;
      const returnPoint = inside(point((width - padWidth) / 2 + 58, padTop + padHeight - 72, .7), bounds);
      model = new FlightModel({ bounds, home: measuredHome(), returnPoint, size, atlas: config, durationMs: options.durationMs || 25000, rng: options.rng, reducedMotion: media.matches });
      if (media.matches) layer.classList.add('is-reduced-motion');
      holesSignature = ''; lastHolesAt = -Infinity; refreshTouchHoles();

      let down = null;
      listen(pad, 'pointerdown', event => {
        if (isInteractiveTarget(event.target, pad, env)) return;
        if (event.button != null && event.button !== 0) return;
        down = { x: event.clientX, y: event.clientY, id: event.pointerId };
        event.stopPropagation();
      });
      listen(pad, 'pointerup', event => {
        if (isInteractiveTarget(event.target, pad, env)) return;
        event.stopPropagation();
        if (!down || event.pointerId !== down.id || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 12) { down = null; return; }
        down = null;
        drop(event.clientX - originX, event.clientY - originY);
      });
      listen(pad, 'pointercancel', () => { down = null; });
      // Capture is confined to this explicit play surface; no document-level
      // pointer/touch listener steals a menu, scroll or map gesture.
      ['touchstart', 'touchmove', 'touchend', 'click'].forEach(type => listen(pad, type, event => {
        if (!isInteractiveTarget(event.target, pad, env)) event.stopPropagation();
      }, { passive: true }));
      listen(pad, 'pointermove', event => { if (!isInteractiveTarget(event.target, pad, env)) event.stopPropagation(); });
      listen(finishButton, 'click', event => { event.stopPropagation(); stop('finished'); });
      listen(pad, 'keydown', event => {
        if (event.target === pad && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); event.stopPropagation();
          drop(padBox.left + padBox.width / 2, padBox.top + Math.max(12, (padBox.height - 62) / 2));
        }
      });
      listen(doc, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); stop('escape'); } });
      tookOff = true; call('onTakeoff', { reducedMotion: media.matches });
      render(model.snapshot());
    }

    function pebble(x, y, opacity = 1, angle = 0) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = opacity;
      ctx.beginPath(); ctx.ellipse(0, 0, 5.5, 3.8, -.3, 0, TAU);
      ctx.fillStyle = '#c7ba9e'; ctx.fill(); ctx.lineWidth = 1.1; ctx.strokeStyle = '#4b493f'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-1.4, -1.3, 2.4, .85, -.3, 0, TAU); ctx.fillStyle = '#f9ebc4'; ctx.fill();
      ctx.restore();
    }

    function render(view) {
      if (!ctx || !atlasImage) return;
      ctx.clearRect(0, 0, bounds.width, bounds.height);
      if (view.token) {
        // One understated landing ring makes the tiny token legible on maps.
        ctx.beginPath(); ctx.ellipse(view.token.x, view.token.floorY + 4, 11, 3.5, 0, 0, TAU);
        ctx.strokeStyle = 'rgba(246,223,158,.6)'; ctx.lineWidth = 1; ctx.stroke();
        pebble(view.token.x, view.token.y, 1, view.token.age * 2);
      }
      if (view.deposited) pebble(view.deposited.x, view.deposited.y, 1 - view.deposited.age / .65);
      const behind = view.row === 3 || view.row === 4;
      const geometry = spriteGeometry(view, size, config);
      if (view.carrying && behind) pebble(geometry.grip.x, geometry.grip.y, 1, view.bank - .15);
      drawSprite(ctx, atlasImage, view, { size, atlas: config });
      if (view.carrying && !behind) pebble(geometry.grip.x, geometry.grip.y, 1, view.bank - .15);
    }

    function frame(now) {
      raf = 0;
      if (!active) return;
      if (!allowed()) return teardown('unavailable');
      const delta = lastTime == null ? 0 : (now - lastTime) / 1000;
      if (startedAt == null) startedAt = now;
      lastTime = now;
      if (now - startedAt >= (options.durationMs || 25000)) model.land();
      if (now - lastHolesAt > 300) { lastHolesAt = now; refreshTouchHoles(); }
      const view = model.step(delta);
      if (view.pickups !== pickupCount) {
        pickupCount = view.pickups;
        if (status) status.textContent = 'Got it! · Tap another open spot';
      }
      render(view);
      if (view.done) return teardown(model.finishReason);
      raf = env.requestAnimationFrame(frame);
    }

    function drop(x, y) {
      if (!active || !model || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      const accepted = model.drop(x, y);
      if (accepted && status) status.textContent = model.carrying ? 'One more pebble · Merlin will return for it' : 'Watch his talons · here he comes';
      return accepted;
    }

    function start() {
      if (active) return loading || Promise.resolve(true);
      if (disposed || !allowed()) return Promise.resolve(false);
      active = true; model = null; pickupCount = 0;
      const ticket = ++generation;
      bindLifecycle();
      loading = (options.loadAtlas ? options.loadAtlas() : loadAtlas(options.atlasUrl || '/burbz/assets/merlin-flight/merlin-flight-v1.webp', env))
        .then(image => {
          if (!active || generation !== ticket || !allowed()) { if (generation === ticket) teardown('unavailable'); return false; }
          atlasImage = image;
          if (image.naturalWidth < config.columns * config.cell || image.naturalHeight < config.rows * config.cell) throw new Error('Merlin flight artwork has the wrong dimensions.');
          prepare();
          if (!active || generation !== ticket) return false;
          raf = env.requestAnimationFrame(frame);
          loading = null;
          return true;
        }).catch(error => {
          if (generation === ticket) { teardown('artwork-unavailable'); call('onError', error); }
          return false;
        });
      return loading;
    }

    return {
      start, stop, drop,
      dispose() { disposed = true; teardown('disposed'); },
      get active() { return active; },
      get diagnostics() { return { active, loading: !!loading, rafCount: raf ? 1 : 0, generation, state: model ? model.snapshot() : null, atlasWidth: atlasImage && atlasImage.naturalWidth || 0 }; }
    };
  }

  return { create, FlightModel, flightBounds, bezier, tangent, makeCurve, curveSample, viewForVelocity, wingPose, isInteractiveTarget, openRectangles, spriteGeometry, drawSprite };
});
