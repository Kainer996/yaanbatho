/**
 * QuarryPro — vehicle physics core (pure functions, no Three.js).
 *
 * Mobile plant no longer glides straight at its target: every vehicle has a
 * speed state, accelerates and brakes with finite rates, steers with a
 * limited yaw rate (so it arcs through turns like a real machine), slows on
 * grades, and tilts to match the bench it is driving over.
 */

export const VEHICLE_DYNAMICS = Object.freeze({
  dumper:    { maxSpeed: 16, accel: 5.5, brake: 10, turnRate: 2.2, wheelRadius: 1.3,  wheelbase: 7.0, track: 5.8 },
  excavator: { maxSpeed: 5.5, accel: 3.0, brake: 7, turnRate: 1.7, wheelRadius: 0.9,  wheelbase: 8.0, track: 6.0 },
  loader:    { maxSpeed: 10, accel: 5.5, brake: 11, turnRate: 2.6, wheelRadius: 1.15, wheelbase: 5.5, track: 4.6 },
  default:   { maxSpeed: 10, accel: 4.5, brake: 9,  turnRate: 2.1, wheelRadius: 1.2,  wheelbase: 6.0, track: 5.0 },
});

export const MAX_BODY_PITCH = 0.42;
export const MAX_BODY_ROLL = 0.30;
const TWO_PI = Math.PI * 2;

export function getVehicleDynamics(type) {
  return VEHICLE_DYNAMICS[type] || VEHICLE_DYNAMICS.default;
}

export function createVehicleMotionState({ heading = 0 } = {}) {
  return {
    heading,        // travel direction in the xz plane, radians
    speed: 0,       // m/s along heading
    pitch: 0,       // smoothed body pitch (nose up positive)
    roll: 0,        // smoothed body roll
    bobPhase: Math.random() * TWO_PI,
    yOffset: 0,     // suspension bob
  };
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TWO_PI;
  while (a < -Math.PI) a += TWO_PI;
  return a;
}

/** Frame-rate independent exponential smoothing. */
export function dampValue(current, target, lambda, dt) {
  return target + (current - target) * Math.exp(-lambda * dt);
}

export function dampAngle(current, target, lambda, dt) {
  return target + wrapAngle(current - target) * Math.exp(-lambda * dt);
}

/**
 * Grade is rise/run along the direction of travel (uphill positive).
 * Loaded haul trucks crawl up steep ramps and hold back downhill.
 */
export function getGradeSpeedMultiplier(grade, { loaded = false } = {}) {
  const g = Number(grade) || 0;
  if (g > 0) {
    const penalty = g * (loaded ? 3.4 : 2.4);
    return Math.max(0.28, 1 - penalty);
  }
  // Downhill: a touch quicker, but braking caps it well before runaway.
  return Math.min(1.15, 1 - g * 0.5);
}

/**
 * One integration step of vehicle drive toward a target point.
 * Returns the new kinematic state plus an `arrived` flag.
 */
export function stepVehicleDrive({
  x, z, heading, speed,
  targetX, targetZ,
  dt,
  dynamics = VEHICLE_DYNAMICS.default,
  arrivalDistance = 4,
  grade = 0,
  loaded = false,
  speedScale = 1,
}) {
  const dx = targetX - x;
  const dz = targetZ - z;
  const dist = Math.hypot(dx, dz);
  if (dist <= arrivalDistance) {
    return { x, z, heading, speed: Math.max(0, speed - dynamics.brake * dt), arrived: true, moving: speed > 0.3 };
  }

  const desiredHeading = Math.atan2(dz, dx);
  const headingError = wrapAngle(desiredHeading - heading);

  // Steering: yaw rate shrinks as speed rises (bigger turning circle at pace).
  const effectiveTurnRate = dynamics.turnRate / (1 + Math.max(0, speed) * 0.035);
  const maxTurn = effectiveTurnRate * dt;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, headingError));
  const newHeading = wrapAngle(heading + turn);

  // Target speed: cruise, but slow for sharp turns, grades and braking zones.
  const alignment = Math.max(0.3, Math.cos(headingError));
  const gradeMult = getGradeSpeedMultiplier(grade, { loaded });
  let targetSpeed = dynamics.maxSpeed * Math.max(0.2, Math.min(1, speedScale)) * alignment * gradeMult;
  // Never trundle when the destination is still far off.
  if (dist > arrivalDistance * 3) {
    targetSpeed = Math.max(targetSpeed, Math.min(3.2, dynamics.maxSpeed));
  }

  // Brake early enough to stop inside the arrival circle: v² / (2·brake).
  const stoppingDistance = (speed * speed) / (2 * dynamics.brake);
  if (dist - arrivalDistance < stoppingDistance + speed * dt * 2) {
    targetSpeed = Math.min(targetSpeed, Math.max(1.6, dist * 0.55));
  }

  let newSpeed;
  if (speed < targetSpeed) {
    newSpeed = Math.min(targetSpeed, speed + dynamics.accel * dt);
  } else {
    newSpeed = Math.max(targetSpeed, speed - dynamics.brake * dt);
  }

  const travel = newSpeed * dt;
  return {
    x: x + Math.cos(newHeading) * travel,
    z: z + Math.sin(newHeading) * travel,
    heading: newHeading,
    speed: newSpeed,
    arrived: false,
    moving: newSpeed > 0.3,
  };
}

/**
 * Body attitude from four ground samples around the contact patch.
 * Front/back are along the heading, left/right across it.
 */
export function getBodyAttitudeFromSamples({ hFront, hBack, hLeft, hRight, wheelbase = 6, track = 5 }) {
  const pitch = Math.atan2((Number(hFront) || 0) - (Number(hBack) || 0), Math.max(0.1, wheelbase));
  const roll = Math.atan2((Number(hLeft) || 0) - (Number(hRight) || 0), Math.max(0.1, track));
  return {
    pitch: Math.max(-MAX_BODY_PITCH, Math.min(MAX_BODY_PITCH, pitch)),
    roll: Math.max(-MAX_BODY_ROLL, Math.min(MAX_BODY_ROLL, roll)),
  };
}

/** Grade along the heading from front/back ground samples. */
export function getGradeFromSamples({ hFront, hBack, wheelbase = 6 }) {
  return ((Number(hFront) || 0) - (Number(hBack) || 0)) / Math.max(0.1, wheelbase);
}

/**
 * Suspension bob: subtle, speed-dependent vertical motion so machines feel
 * sprung instead of welded to the heightfield.
 */
export function stepSuspensionBob({ bobPhase, speed, dt, amplitude = 0.085 }) {
  const phase = (bobPhase + dt * (3.2 + speed * 0.85)) % TWO_PI;
  const intensity = Math.min(1, speed / 8);
  return {
    bobPhase: phase,
    yOffset: Math.sin(phase) * amplitude * intensity,
    extraPitch: Math.sin(phase * 0.7) * 0.012 * intensity,
  };
}

/**
 * Wheel spin in radians for this frame from actual ground speed, so wheels
 * stop when the machine stops and spin faster when it is moving faster.
 */
export function getWheelSpinDelta({ speed, dt, wheelRadius = 1.2 }) {
  return (speed * dt) / Math.max(0.2, wheelRadius);
}

/**
 * Decide whether a drive between two points needs to use the haul ramp:
 * any straight line that crosses a bench wall (a big elevation change) does.
 */
export function shouldRouteViaRamp({ startY, targetY, threshold = 4 }) {
  return Math.abs((Number(targetY) || 0) - (Number(startY) || 0)) > threshold;
}

/** Road dust emission interval shortens with speed; none when stationary. */
export function getDustEmitInterval(speed) {
  if (speed < 1.2) return Infinity;
  return Math.max(0.05, 0.34 - speed * 0.018);
}
