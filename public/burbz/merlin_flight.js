/* Merlin's play flight. No game, care, inventory or save state lives here.
   The player taps anywhere; Merlin swoops, grabs the pebble in his talons and
   drops it on a little pile under his perch. After four pebbles he lands.

   v3 draws one painted side view (ElevenLabs sheet, 8-pose wing beat plus
   reach, grab, lift and landing-flare poses) and moves with steering physics:
   velocity turns smoothly toward a goal, so every path is a natural arc.
   The last metres of a grab or a landing follow a Hermite curve, so the
   talons meet the pebble exactly. All coordinates are CSS pixels. */
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
  const point = (x, y) => ({ x, y });
  const length = v => Math.hypot(v.x, v.y);
  const approach = (value, target, rate, dt) => mix(value, target, 1 - Math.exp(-rate * dt));

  const PEBBLE_GOAL = 4;
  const DISPLAY_LENGTH = 96;   // beak-to-tail on screen, the size of the perched Merlin
  const CRUISE_SPEED = 215, CHASE_SPEED = 330, CARRY_SPEED = 250;
  const ACCEL = 520;
  const FALL = 1100;           // px/s² for a dropped pebble

  function flightBounds(width, height, top = 72, bottom = 96) {
    const margin = Math.min(56, width * .14);
    return { left: margin, right: Math.max(margin, width - margin), top: Math.min(top, height * .3), bottom: Math.max(Math.min(top, height * .3) + 1, height - bottom), width, height };
  }

  // Cubic Hermite: position and velocity at both ends, over T seconds.
  function hermite(seg, t) {
    const s = clamp(t / seg.T, 0, 1), s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
    const T = seg.T;
    return {
      position: point(h00 * seg.p0.x + h10 * T * seg.v0.x + h01 * seg.p1.x + h11 * T * seg.v1.x,
        h00 * seg.p0.y + h10 * T * seg.v0.y + h01 * seg.p1.y + h11 * T * seg.v1.y),
      velocity: point((d00 * seg.p0.x + d10 * T * seg.v0.x + d01 * seg.p1.x + d11 * T * seg.v1.x) / T,
        (d00 * seg.p0.y + d10 * T * seg.v0.y + d01 * seg.p1.y + d11 * T * seg.v1.y) / T)
    };
  }

  function frameFor(atlas, clip, frame = 0) {
    const ids = atlas.clips[clip] || atlas.clips.flap;
    return atlas.frames[ids[clamp(Math.floor(frame), 0, ids.length - 1)]];
  }

  function drawScale(atlas, displayLength = DISPLAY_LENGTH) {
    return displayLength / (atlas.bodyLength || 216);
  }

  // Where the talons (or a held pebble) sit for a pose, relative to the body
  // pivot, after scale, facing and pitch. Drawing uses the same transform.
  function gripOffset(atlas, view, scale) {
    const f = frameFor(atlas, view.clip, view.frame);
    const [cw, ch] = atlas.cell;
    const lx = (f.grip[0] - atlas.pivot[0]) * cw * scale * (view.facing == null ? 1 : view.facing);
    const ly = (f.grip[1] - atlas.pivot[1]) * ch * scale;
    const a = view.pitch || 0, c = Math.cos(a), s = Math.sin(a);
    return point(lx * c - ly * s, lx * s + ly * c);
  }

  function drawSprite(context, image, view, atlas, scale) {
    const f = frameFor(atlas, view.clip, view.frame);
    const [sx, sy, cw, ch] = f.source;
    const w = cw * scale, h = ch * scale;
    context.save();
    context.globalAlpha = view.opacity == null ? 1 : view.opacity;
    context.translate(view.position.x, view.position.y + (view.bob || 0));
    context.rotate(view.pitch || 0);
    // Passing through zero width reads as the bird turning on the spot.
    const facing = view.turn == null ? (view.facing || 1) : view.turn;
    context.scale(Math.sign(facing || 1) * Math.max(.06, Math.abs(facing)), 1);
    context.drawImage(image, sx, sy, cw, ch, -atlas.pivot[0] * w, -atlas.pivot[1] * h, w, h);
    context.restore();
    return f;
  }

  class FlightModel {
    constructor(options = {}) {
      this.rng = options.rng || Math.random;
      this.atlas = options.atlas;
      if (!this.atlas || !this.atlas.clips) throw new Error('Merlin flight needs the v3 atlas.');
      this.scale = drawScale(this.atlas, options.displayLength);
      this.bounds = options.bounds || flightBounds(390, 844);
      this.home = options.home || point(this.bounds.width - 48, 124);
      this.pile = options.pile || point(clamp(this.home.x - 34, 30, this.bounds.width - 30), this.home.y + 64);
      this.goal = options.goal || PEBBLE_GOAL;
      this.idleLimit = (options.idleMs || 25000) / 1000;
      this.reduced = !!options.reducedMotion;
      this.position = { ...this.home };
      const outward = this.home.x > this.bounds.width / 2 ? -1 : 1;
      this.velocity = point(outward * 150, 60);
      this.facing = -1; this.turn = -1; this.pitch = 0;
      this.phase = .1; this.hz = 3.4; this.gliding = false; this.nextGlideAt = 2.2; this.glideEnds = 0;
      this.state = 'takeoff'; this.stateTime = 0; this.elapsed = 0; this.idle = 0;
      this.segment = null; this.token = null; this.queued = null; this.carrying = null;
      this.grip = null; this.falling = []; this.pileStones = [];
      this.pickups = 0; this.delivered = 0; this.orbit = this.rng() < .5 ? 1 : -1;
      this.pose = { clip: 'flap', frame: 0 };
      this.opacity = 1; this.done = false; this.finishReason = 'complete';
      if (this.reduced) { this.state = 'hover'; this.position = point(this.home.x - 40, this.home.y + 40); }
    }

    // A tap anywhere. The pebble drops a little way and rests where the
    // player touched. One more may wait while Merlin is busy.
    drop(x, y) {
      if (this.done || this.state === 'landing' || this.pickups + (this.token ? 1 : 0) + (this.queued ? 1 : 0) >= this.goal) return false;
      const b = this.bounds;
      const rest = point(clamp(x, 12, b.width - 12), clamp(y, 12, b.height - 12));
      const pebble = { x: rest.x, y: rest.y - 34, restY: rest.y, vy: 0, age: 0 };
      this.idle = 0;
      if (this.token || this.carrying || this.state === 'reach' || this.state === 'grab' || this.state === 'lift') {
        this.queued = pebble;
        return true;
      }
      this.token = pebble;
      if (this.reduced) { this.state = 'grab'; this.stateTime = 0; this.position = this.contactPoint(); return true; }
      this.setState('chase');
      return true;
    }

    setState(state) { this.state = state; this.stateTime = 0; this.segment = null; }

    // Where the body must be for the reach pose's talons to close on the pebble.
    contactPoint(facing = this.approachFacing()) {
      const offset = gripOffset(this.atlas, { clip: 'grab', frame: 0, facing, pitch: 0 }, this.scale);
      return point(this.token.x - offset.x, this.token.restY - offset.y);
    }

    approachFacing() {
      const dx = this.token.x - this.position.x;
      return Math.abs(dx) < 24 ? (this.facing || 1) : Math.sign(dx);
    }

    releasePoint() {
      const offset = gripOffset(this.atlas, { clip: 'flap', frame: 2, facing: this.facing, pitch: 0 }, this.scale);
      return point(this.pile.x - offset.x, this.pile.y - 70 - offset.y);
    }

    land(reason = 'complete') {
      if (this.done || this.state === 'landing') return;
      this.finishReason = reason;
      this.token = null; this.queued = null;
      if (this.carrying) { this.falling.push({ ...this.carrying, vy: 0 }); this.carrying = null; }
      if (this.reduced) { this.done = true; return; }
      this.setState('landing');
      this.landingPhase = 'seek';
    }

    // Seek with a speed limit and bounded acceleration. The result is always
    // a smooth curve; no path ever reverses on the spot.
    steer(target, speed, dt, arrive = 0) {
      const to = point(target.x - this.position.x, target.y - this.position.y);
      const dist = length(to) || 1;
      const wanted = arrive && dist < arrive ? speed * dist / arrive : speed;
      const desired = point(to.x / dist * wanted, to.y / dist * wanted);
      const change = point(desired.x - this.velocity.x, desired.y - this.velocity.y);
      const limit = ACCEL * dt, size = length(change);
      if (size > limit) { change.x *= limit / size; change.y *= limit / size; }
      this.velocity.x += change.x; this.velocity.y += change.y;
      this.position.x += this.velocity.x * dt; this.position.y += this.velocity.y * dt;
      return dist;
    }

    cruiseTarget() {
      // A lazy loop around the middle of the screen, with a gentle rise and
      // fall. The target runs ahead of Merlin, so he banks round it.
      const b = this.bounds;
      const cx = (b.left + b.right) / 2, cy = mix(b.top, b.bottom, .42);
      const rx = (b.right - b.left) * .42, ry = (b.bottom - b.top) * .26;
      const angle = Math.atan2((this.position.y - cy) / ry, (this.position.x - cx) / rx) + this.orbit * .75;
      return point(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry + Math.sin(this.elapsed * .9) * 18);
    }

    follow(dt) {
      this.segment.t += dt;
      const sample = hermite(this.segment, this.segment.t);
      this.position = sample.position; this.velocity = sample.velocity;
      return this.segment.t >= this.segment.T;
    }

    beginSegment(target, endVelocity, speed, min = .4, max = 1.3) {
      const gap = Math.hypot(target.x - this.position.x, target.y - this.position.y);
      const T = clamp(gap / speed * 1.25, min, max);
      this.segment = { p0: { ...this.position }, v0: { ...this.velocity }, p1: target, v1: endVelocity, T, t: 0 };
    }

    step(delta) {
      if (this.done) return this.snapshot();
      const dt = clamp(delta || 0, 0, .05);
      this.elapsed += dt; this.stateTime += dt; this.idle += dt;
      this.updatePebbles(dt);
      if (this.idle >= this.idleLimit && this.state !== 'landing' && !this.carrying && !this.token) this.land('idle');
      if (this.reduced) return this.stepReduced(dt);

      const b = this.bounds;
      switch (this.state) {
        case 'takeoff': {
          // Drop off the bough and beat hard out over the screen.
          this.steer(point(mix(b.left, b.right, .45), mix(b.top, b.bottom, .3)), CRUISE_SPEED + 30, dt);
          if (this.stateTime > .9) this.setState('cruise');
          break;
        }
        case 'cruise': this.steer(this.cruiseTarget(), CRUISE_SPEED, dt); break;
        case 'chase': {
          let facing = this.approachFacing();
          const contact = this.contactPoint(facing);
          // Line up a little behind and above, then commit to the swoop only
          // once flying towards the pebble.
          const setup = point(contact.x - facing * 70, contact.y - 46);
          const toward = (contact.x - this.position.x) * this.velocity.x + (contact.y - this.position.y) * this.velocity.y;
          const dist = this.steer(Math.hypot(setup.x - this.position.x, setup.y - this.position.y) > 60 ? setup : contact, CHASE_SPEED, dt);
          const lined = dist < 190 && toward > 0 && Math.sign(this.velocity.x || facing) === facing;
          if ((lined || this.stateTime > 3.5) && this.token.age > .12) {
            if (!lined) facing = Math.sign(this.velocity.x) || facing;
            this.setState('reach');
            this.reachFacing = facing;
            this.beginSegment(this.contactPoint(facing), point(facing * 90, 12), 240, .42, .9);
          }
          break;
        }
        case 'reach': {
          // The committed swoop. Its Hermite end is the exact contact point.
          this.segment.p1 = this.contactPoint(this.reachFacing);
          if (this.follow(dt)) {
            this.carrying = { x: this.token.x, y: this.token.restY };
            this.token = null; this.pickups++;
            this.setState('grab');
          }
          break;
        }
        case 'grab': {
          // Talons close; momentum carries him on slowly.
          this.velocity = point(this.reachFacing * 70, -10);
          this.position.x += this.velocity.x * dt; this.position.y += this.velocity.y * dt;
          if (this.stateTime > .16) { this.setState('lift'); this.velocity = point(this.reachFacing * 120, -150); }
          break;
        }
        case 'lift': {
          this.position.x += this.velocity.x * dt; this.position.y += this.velocity.y * dt;
          this.velocity.x = approach(this.velocity.x, this.reachFacing * 200, 3, dt);
          if (this.stateTime > .26) this.setState('carry');
          break;
        }
        case 'carry': {
          const release = this.releasePoint();
          const dist = this.steer(release, CARRY_SPEED, dt, 90);
          if (dist < 26 || (this.stateTime > 5)) {
            this.falling.push({ ...this.carrying, vy: this.velocity.y * .3 });
            this.carrying = null; this.delivered++;
            if (this.pickups >= this.goal) this.land('complete');
            else if (this.queued) { this.token = this.queued; this.queued = null; this.setState('chase'); }
            else this.setState('cruise');
          }
          break;
        }
        case 'landing': {
          const perch = this.home;
          if (this.landingPhase === 'seek') {
            // Come round to arrive from the left and below, like settling
            // onto a bough, then commit to the flare.
            const side = perch.x > this.bounds.width / 2 ? -1 : 1;
            const setup = point(perch.x + side * 120, perch.y + 50);
            const dist = this.steer(setup, CRUISE_SPEED, dt, 60);
            if (dist < 70 || this.stateTime > 4) {
              this.landingPhase = 'flare';
              this.beginSegment(point(perch.x, perch.y), point(0, 0), 170, .7, 1.1);
            }
          } else if (this.follow(dt)) {
            this.opacity = Math.max(0, this.opacity - dt / .14);
            this.velocity = point(0, 0);
            if (this.opacity <= 0) this.done = true;
          }
          break;
        }
      }
      if (this.state === 'cruise' || this.state === 'takeoff' || this.state === 'carry') {
        this.position.x = clamp(this.position.x, -20, b.width + 20);
        this.position.y = clamp(this.position.y, 24, b.height - 40);
      }
      this.animate(dt);
      return this.snapshot();
    }

    stepReduced(dt) {
      // Reduced motion: no travel across the screen. A still pose appears by
      // the pebble, then the pebble joins the pile.
      if (this.state === 'grab' && this.stateTime > .5) {
        this.pickups++; this.delivered++;
        this.pileStones.push({ ...this.pile, index: this.pileStones.length });
        this.token = null;
        if (this.pickups >= this.goal) this.done = true;
        else if (this.queued) { this.token = this.queued; this.queued = null; this.stateTime = 0; this.position = this.contactPoint(); }
        else { this.state = 'hover'; this.position = point(this.home.x - 40, this.home.y + 40); }
      }
      this.pose = this.state === 'grab' ? { clip: 'grab', frame: 0 } : { clip: 'flap', frame: 2 };
      this.facing = this.turn = -1; this.pitch = 0;
      return this.snapshot();
    }

    updatePebbles(dt) {
      if (this.token) {
        this.token.age += dt;
        this.token.vy += FALL * dt; this.token.y = Math.min(this.token.restY, this.token.y + this.token.vy * dt);
      }
      if (this.queued) { this.queued.age = (this.queued.age || 0) + dt; this.queued.vy += FALL * dt; this.queued.y = Math.min(this.queued.restY, this.queued.y + this.queued.vy * dt); }
      for (const stone of this.falling) {
        stone.vy += FALL * dt; stone.y += stone.vy * dt;
        const top = this.pile.y - Math.min(this.pileStones.length, 3) * 3.2;
        if (stone.y >= top) { stone.landed = true; this.pileStones.push({ x: this.pile.x + [0, 7, -6, 2][this.pileStones.length % 4], y: top, index: this.pileStones.length }); }
      }
      this.falling = this.falling.filter(stone => !stone.landed);
    }

    animate(dt) {
      const v = this.velocity, speed = length(v);
      // Facing follows horizontal travel, with a dead band so a pass straight
      // up or down never flickers. The turn eases through zero width.
      if (this.state === 'reach' || this.state === 'grab' || this.state === 'lift') this.facing = this.reachFacing;
      else if (this.state === 'landing' && this.landingPhase === 'flare' && this.segment && this.segment.t > this.segment.T * .55) this.facing = -1;
      else if (Math.abs(v.x) > 45) this.facing = Math.sign(v.x);
      this.turn = clamp(this.turn + Math.sign(this.facing - this.turn) * dt / .11, -1, 1);
      if (Math.abs(this.turn - this.facing) < .02) this.turn = this.facing;

      const special = this.state === 'reach' || this.state === 'grab' || this.state === 'lift' || (this.state === 'landing' && this.landingPhase === 'flare');
      const climb = clamp(-v.y / 220, -1, 1);
      const pitchTarget = special ? 0 : clamp(Math.atan2(v.y, Math.max(Math.abs(v.x), 70)) * .75, -.42, .45);
      this.pitch = approach(this.pitch, pitchTarget * this.facing, special ? 14 : 7, dt);

      // Wing-beat speed rises with the climb and the load, falls in a dive.
      let hz = 2.5 + Math.max(0, climb) * 1.3 + (this.carrying ? .5 : 0) + (this.state === 'takeoff' ? 1 : 0) + (this.state === 'chase' ? .5 : 0);
      if (speed < 90) hz += .8;
      this.hz = approach(this.hz, hz, 5, dt);
      // Glides hold the level-wing frame of the beat itself, so a glide
      // starts and ends without any change of drawing.
      const canGlide = this.state === 'cruise' && climb < .15;
      if (this.gliding && (!canGlide || this.elapsed > this.glideEnds)) { this.gliding = false; this.nextGlideAt = this.elapsed + 2 + this.rng() * 2.2; }
      if (!this.gliding) {
        const before = this.phase;
        this.phase = (this.phase + dt * this.hz) % 1;
        const level = 2.5 / 8;
        const crossed = before < level && this.phase >= level;
        if (canGlide && crossed && (this.elapsed > this.nextGlideAt || v.y > 90)) {
          this.gliding = true; this.phase = level; this.glideEnds = this.elapsed + .7 + this.rng() * .7;
        }
      }
      if (this.state === 'reach') {
        this.pose = { clip: this.segment.T - this.segment.t < .32 ? 'reach' : 'flap', frame: this.segment.T - this.segment.t < .32 ? 0 : Math.floor(this.phase * 8) };
      } else if (this.state === 'grab') this.pose = { clip: 'grab', frame: 0 };
      else if (this.state === 'lift') this.pose = { clip: 'lift', frame: 0 };
      else if (this.state === 'landing' && this.landingPhase === 'flare' && this.segment.T - this.segment.t < .45) this.pose = { clip: 'flare', frame: 0 };
      else this.pose = { clip: 'flap', frame: this.gliding ? 2 : Math.floor(this.phase * 8) % 8 };

      // A held pebble follows the painted talons, easing between poses.
      if (this.carrying) {
        const offset = gripOffset(this.atlas, { ...this.pose, facing: this.turn, pitch: this.pitch }, this.scale);
        const target = point(this.position.x + offset.x, this.position.y + offset.y + this.bob());
        if (this.state === 'grab') this.grip = null;
        const from = this.grip || target;
        this.grip = point(approach(from.x, target.x, 18, dt), approach(from.y, target.y, 18, dt));
        this.carrying.x = this.grip.x; this.carrying.y = this.grip.y;
      } else this.grip = null;
    }

    bob() {
      // The body lifts a touch on each downstroke.
      return this.gliding || this.pose.clip !== 'flap' ? 0 : Math.sin(this.phase * TAU) * 1.6;
    }

    snapshot() {
      return {
        position: { ...this.position }, velocity: { ...this.velocity }, state: this.state,
        clip: this.pose.clip, frame: this.pose.frame, facing: this.facing, turn: this.turn, pitch: this.pitch,
        bob: this.bob(), opacity: this.opacity, gliding: this.gliding,
        token: this.token && { ...this.token }, queued: this.queued && { ...this.queued },
        carrying: this.carrying && { ...this.carrying },
        // The painted grab and lift poses already hold a pebble.
        paintedPebble: this.pose.clip === 'grab' || this.pose.clip === 'lift',
        falling: this.falling.map(stone => ({ ...stone })), pile: this.pileStones.map(stone => ({ ...stone })),
        pickups: this.pickups, delivered: this.delivered, goal: this.goal,
        elapsed: this.elapsed, done: this.done, reducedMotion: this.reduced
      };
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

  function create(options = {}) {
    const env = options.environment || (typeof window !== 'undefined' ? window : null);
    if (!env || !env.document) throw new Error('Merlin flight requires a browser.');
    const doc = env.document;
    let active = false, loading = null, generation = 0, raf = 0, lastTime = null, lastInputAt = null;
    let layer, canvas, ctx, pad, status, finishButton, model, atlasImage, bounds;
    let originX = 0, originY = 0;
    let tookOff = false, disposed = false, cleanups = [], previousFocus = null, shownPickups = 0;
    const atlas = options.atlas;
    const media = env.matchMedia ? env.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    const listen = (target, type, callback, settings) => {
      target.addEventListener(type, callback, settings);
      cleanups.push(() => target.removeEventListener(type, callback, settings));
    };
    const call = (name, data) => { if (typeof options[name] === 'function') options[name](data); };
    const hostRect = () => options.getHostRect ? options.getHostRect() : options.host && options.host.getBoundingClientRect ? options.host.getBoundingClientRect() : { left: env.innerWidth - 96, top: 80, width: 88, height: 88 };
    const allowed = () => !doc.hidden && (!options.shouldContinue || options.shouldContinue());
    const idleMs = options.durationMs || 25000;
    const goal = options.pebbleGoal || PEBBLE_GOAL;

    function teardown(reason) {
      if (!active && !layer) return;
      const wasActive = active;
      active = false; generation++; loading = null;
      if (raf) env.cancelAnimationFrame(raf);
      raf = 0; lastTime = null; lastInputAt = null;
      cleanups.splice(0).forEach(remove => remove());
      const focusWasInside = layer && layer.contains(doc.activeElement);
      if (layer) layer.remove();
      layer = canvas = ctx = pad = status = finishButton = null;
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
      if (pad) pad.classList.add('is-finishing');
      if (finishButton) finishButton.disabled = true;
      setStatus('Merlin is flying home');
    }

    // The flight body pivot sits on the perched Merlin's body, so he leaves
    // and returns at the exact size and spot he sits on every screen.
    function measuredHome() {
      const rect = hostRect();
      return point(clamp(rect.left + rect.width * .5 - originX, 24, bounds.width - 24), clamp(rect.top + rect.height * .52 - originY, 24, bounds.height - 24));
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

    function setStatus(text) { if (status && status.textContent !== text) status.textContent = text; }

    function prepare() {
      const viewport = env.visualViewport;
      const width = viewport ? viewport.width : env.innerWidth, height = viewport ? viewport.height : env.innerHeight;
      originX = viewport && viewport.offsetLeft || 0; originY = viewport && viewport.offsetTop || 0;
      bounds = flightBounds(width, height, options.topInset || 72, options.bottomInset || 96);
      layer = doc.createElement('div'); layer.className = 'merlin-flight-layer'; layer.dataset.merlinFlight = 'active';
      layer.style.width = width + 'px'; layer.style.height = height + 'px'; layer.style.left = originX + 'px'; layer.style.top = originY + 'px';
      // The whole screen is the play sky. Every tap drops a pebble; nothing
      // underneath can be pressed by mistake while Merlin plays.
      pad = doc.createElement('section'); pad.className = 'merlin-flight-sky'; pad.setAttribute('aria-label', "Merlin's play sky");
      pad.tabIndex = 0; pad.setAttribute('aria-description', 'Tap anywhere to drop a pebble. Merlin fetches four, then flies home. Enter drops a pebble in the middle. Escape finishes.');
      canvas = doc.createElement('canvas'); canvas.className = 'merlin-flight-canvas'; canvas.setAttribute('aria-hidden', 'true');
      const dpr = Math.min(env.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
      ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Merlin flight needs a canvas context.');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
      const toolbar = doc.createElement('div'); toolbar.className = 'merlin-flight-toolbar';
      status = doc.createElement('span'); status.className = 'merlin-flight-status'; status.setAttribute('aria-live', 'polite');
      status.textContent = 'Tap anywhere to drop a pebble';
      finishButton = doc.createElement('button'); finishButton.type = 'button'; finishButton.className = 'merlin-flight-finish'; finishButton.textContent = 'Finish';
      const actions = doc.createElement('div'); actions.className = 'merlin-flight-actions';
      toolbar.appendChild(status); toolbar.appendChild(actions);
      if (typeof options.onCare === 'function') {
        const careButton = doc.createElement('button'); careButton.type = 'button'; careButton.className = 'merlin-flight-finish merlin-flight-care'; careButton.textContent = 'Care';
        careButton.setAttribute('aria-label', "Open Merlin's care menu");
        listen(careButton, 'click', event => { event.stopPropagation(); call('onCare'); });
        actions.appendChild(careButton);
      }
      actions.appendChild(finishButton);
      layer.appendChild(pad); layer.appendChild(canvas); layer.appendChild(toolbar); doc.body.appendChild(layer);
      previousFocus = doc.activeElement;
      model = new FlightModel({ bounds, home: measuredHome(), atlas, rng: options.rng, reducedMotion: media.matches, idleMs, goal, displayLength: options.displayLength });
      if (media.matches) layer.classList.add('is-reduced-motion');

      let down = null;
      const swallow = event => { event.stopPropagation(); if (event.cancelable && event.preventDefault) event.preventDefault(); };
      listen(pad, 'pointerdown', event => {
        swallow(event);
        if (event.button != null && event.button !== 0) return;
        down = { x: event.clientX, y: event.clientY, id: event.pointerId };
      });
      listen(pad, 'pointerup', event => {
        swallow(event);
        if (!down || event.pointerId !== down.id || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 16) { down = null; return; }
        down = null;
        drop(event.clientX - originX, event.clientY - originY);
      });
      listen(pad, 'pointercancel', () => { down = null; });
      ['pointermove', 'click', 'contextmenu'].forEach(type => listen(pad, type, swallow));
      ['touchstart', 'touchmove', 'touchend'].forEach(type => listen(pad, type, event => event.stopPropagation(), { passive: true }));
      listen(toolbar, 'pointerdown', event => event.stopPropagation());
      listen(toolbar, 'click', event => event.stopPropagation());
      listen(finishButton, 'click', event => { event.stopPropagation(); stop('finished'); });
      listen(pad, 'keydown', event => {
        if (event.target === pad && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault(); event.stopPropagation();
          drop(width / 2, height * .55);
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

    function ring(x, y) {
      ctx.beginPath(); ctx.ellipse(x, y + 4, 11, 3.5, 0, 0, TAU);
      ctx.strokeStyle = 'rgba(246,223,158,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    }

    function render(view) {
      if (!ctx || !atlasImage) return;
      ctx.clearRect(0, 0, bounds.width, bounds.height);
      for (const stone of view.pile) pebble(stone.x, stone.y, 1, stone.index * 1.3);
      for (const stone of view.falling) pebble(stone.x, stone.y, 1, stone.y * .04);
      for (const token of [view.token, view.queued]) if (token) { ring(token.x, token.restY); pebble(token.x, token.y, 1, token.age * 2); }
      drawSprite(ctx, atlasImage, view, atlas, model.scale);
      if (view.carrying && !view.paintedPebble) pebble(view.carrying.x, view.carrying.y, view.opacity, view.pitch - .2);
    }

    function frame(now) {
      raf = 0;
      if (!active) return;
      if (!allowed()) return teardown('unavailable');
      const delta = lastTime == null ? 0 : (now - lastTime) / 1000;
      lastTime = now;
      if (lastInputAt == null) lastInputAt = now;
      // Real time, so a slow phone still ends an idle game on schedule.
      if (now - lastInputAt >= idleMs && model.state !== 'landing') model.land('idle');
      const view = model.step(delta);
      if (view.pickups !== shownPickups) {
        shownPickups = view.pickups;
        call('onPebble', { pickups: view.pickups, goal: view.goal });
      }
      if (view.state === 'landing') setStatus(view.pickups >= view.goal ? 'Four pebbles! Merlin flies home' : 'Merlin is flying home');
      else if (view.pickups) setStatus('Pebble ' + view.pickups + ' of ' + view.goal + ' · tap anywhere');
      render(view);
      if (view.done) return teardown(model.finishReason);
      raf = env.requestAnimationFrame(frame);
    }

    function drop(x, y) {
      if (!active || !model || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      const accepted = model.drop(x, y);
      if (accepted) {
        lastInputAt = null;
        if (!model.pickups) setStatus('Watch his talons · here he comes');
      }
      return accepted;
    }

    function start() {
      if (active) return loading || Promise.resolve(true);
      if (disposed || !allowed()) return Promise.resolve(false);
      if (!atlas || !atlas.clips) { call('onError', new Error('Merlin flight atlas is missing.')); return Promise.resolve(false); }
      active = true; model = null; shownPickups = 0;
      const ticket = ++generation;
      bindLifecycle();
      loading = (options.loadAtlas ? options.loadAtlas() : loadAtlas(atlas.url || options.atlasUrl, env))
        .then(image => {
          if (!active || generation !== ticket || !allowed()) { if (generation === ticket) teardown('unavailable'); return false; }
          atlasImage = image;
          if (image.naturalWidth < atlas.width || image.naturalHeight < atlas.height) throw new Error('Merlin flight artwork has the wrong dimensions.');
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

  return { create, FlightModel, flightBounds, hermite, gripOffset, drawSprite, drawScale, frameFor, PEBBLE_GOAL, DISPLAY_LENGTH };
});
