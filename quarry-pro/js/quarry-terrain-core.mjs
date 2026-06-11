export const GRID = 80;
export const CELL = 5;
export const HALF = (GRID * CELL) / 2;
export const QUARRY_SURFACE_Y = 0;
export const BACKDROP_GROUND_Y = -80;

// Bench geometry: Bankfield-style quarry floors are cut in repeated level drops,
// not smooth craters. A blast drops a rectangular shot-grid to the next floor.
export const BENCH_HEIGHT = 12;
export const BENCH_BLAST_HALF_WIDTH_CELLS = 4;
export const BENCH_WALL_CELLS = 2;
export const HAUL_RAMP_WIDTH_CELLS = 3;

export const QUARRY_FACE = {
  minX: 18,
  maxX: 46,
  minZ: 16,
  maxZ: 44,
};

export const HAUL_RAMP = {
  startX: QUARRY_FACE.minX,
  startZ: QUARRY_FACE.minZ + 1,
  endX: QUARRY_FACE.maxX,
  endZ: QUARRY_FACE.maxZ - 1,
};

export const HAUL_ROAD_STAGE_LABELS = Object.freeze({
  start: 'Current dumper position',
  lowerApproach: 'Bench road approach',
  rampToe: 'Ramp toe',
  rampMid: 'Haul ramp middle',
  rampCrest: 'Ramp crest',
  topRoad: 'Top haul road',
  edgeRoad: 'Quarry-edge stockpile road',
  target: 'Destination',
});

export function getInitialTerrainHeight(_ix, _iz) {
  // Quarry Pro's buildable play surface must remain a flat pad.
  // The resource starts at surface level and blasting removes material downward,
  // so the player creates a pit/quarry instead of shaving down a raised hill.
  return QUARRY_SURFACE_Y;
}

export function isQuarryFaceGrid(ix, iz) {
  return ix >= QUARRY_FACE.minX && ix <= QUARRY_FACE.maxX && iz >= QUARRY_FACE.minZ && iz <= QUARRY_FACE.maxZ;
}

export function gridToWorld(ix, iz) {
  return {
    x: (ix - GRID / 2) * CELL,
    z: (iz - GRID / 2) * CELL,
  };
}

export function worldToGrid(wx, wz) {
  return {
    ix: Math.max(0, Math.min(GRID, Math.round((wx + HALF) / CELL))),
    iz: Math.max(0, Math.min(GRID, Math.round((wz + HALF) / CELL))),
  };
}

export function getBlastDeformedHeight({ currentHeight, distanceCells, blastRadiusCells, blastDepth }) {
  if (distanceCells > blastRadiusCells) return currentHeight;
  const falloff = Math.pow(1 - distanceCells / blastRadiusCells, 1.5);
  const cutDepth = blastDepth * falloff;
  return currentHeight - cutDepth;
}

export function getTerrainAnchoredY({ terrainHeight = QUARRY_SURFACE_Y, baseOffset = 0 } = {}) {
  const ground = Number.isFinite(Number(terrainHeight)) ? Number(terrainHeight) : QUARRY_SURFACE_Y;
  const offset = Number.isFinite(Number(baseOffset)) ? Number(baseOffset) : 0;
  return ground + offset;
}

export function isPointInsideBlastClearance({
  pointX,
  pointZ,
  blastX,
  blastZ,
  halfWidthCells = BENCH_BLAST_HALF_WIDTH_CELLS,
  wallCells = BENCH_WALL_CELLS,
  extraCells = 1,
  cellSize = CELL,
} = {}) {
  const px = Number(pointX);
  const pz = Number(pointZ);
  const bx = Number(blastX);
  const bz = Number(blastZ);
  const cell = Math.max(0.001, Number(cellSize) || CELL);
  if (![px, pz, bx, bz].every(Number.isFinite)) return false;
  const dxCells = Math.abs(px - bx) / cell;
  const dzCells = Math.abs(pz - bz) / cell;
  const clearanceCells = Math.max(0, Number(halfWidthCells) || 0)
    + Math.max(0, Number(wallCells) || 0)
    + Math.max(0, Number(extraCells) || 0);
  return Math.max(dxCells, dzCells) <= clearanceCells;
}

export function getNextBenchFloor(currentHeight, benchHeight = BENCH_HEIGHT) {
  const level = Math.floor(currentHeight / benchHeight);
  return (level - 1) * benchHeight;
}

export function getNextUnlockedBenchFloor(currentHeight, unlockedQuarryLevel = 1, benchHeight = BENCH_HEIGHT) {
  const unlockedLevel = Math.max(1, Math.floor(Number(unlockedQuarryLevel) || 1));
  const deepestUnlockedFloor = QUARRY_SURFACE_Y - unlockedLevel * benchHeight;
  const nextFloor = Math.max(getNextBenchFloor(currentHeight, benchHeight), deepestUnlockedFloor);
  return Math.min(currentHeight, nextFloor);
}

export function getBenchedBlastHeight({
  currentHeight,
  gridDx,
  gridDz,
  halfWidthCells = BENCH_BLAST_HALF_WIDTH_CELLS,
  wallCells = BENCH_WALL_CELLS,
  targetFloor,
}) {
  const chebyshevDistance = Math.max(Math.abs(gridDx), Math.abs(gridDz));
  if (chebyshevDistance <= halfWidthCells) return Math.min(currentHeight, targetFloor);
  if (chebyshevDistance > halfWidthCells + wallCells) return currentHeight;

  const wallT = (chebyshevDistance - halfWidthCells) / wallCells;
  const wallHeight = targetFloor + (QUARRY_SURFACE_Y - targetFloor) * wallT;
  return Math.min(currentHeight, wallHeight);
}

export function getRampAdjustedHeight({
  ix,
  iz,
  currentHeight,
  targetFloor,
  ramp = HAUL_RAMP,
  widthCells = HAUL_RAMP_WIDTH_CELLS,
}) {
  if (targetFloor >= QUARRY_SURFACE_Y) return currentHeight;

  const ax = ramp.startX;
  const az = ramp.startZ;
  const bx = ramp.endX;
  const bz = ramp.endZ;
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 0) return currentHeight;

  const px = ix - ax;
  const pz = iz - az;
  const t = Math.max(0, Math.min(1, (px * vx + pz * vz) / lenSq));
  const closestX = ax + vx * t;
  const closestZ = az + vz * t;
  const dist = Math.hypot(ix - closestX, iz - closestZ);
  if (dist > widthCells) return currentHeight;

  const rampProgress = t > 0.96 ? 1 : t;
  const rampHeight = QUARRY_SURFACE_Y + (targetFloor - QUARRY_SURFACE_Y) * rampProgress;
  return Math.min(currentHeight, rampHeight);
}

export function getHaulRampWorldWaypoints() {
  const start = gridToWorld(HAUL_RAMP.startX, HAUL_RAMP.startZ);
  const mid = gridToWorld(
    (HAUL_RAMP.startX + HAUL_RAMP.endX) / 2,
    (HAUL_RAMP.startZ + HAUL_RAMP.endZ) / 2
  );
  const end = gridToWorld(HAUL_RAMP.endX, HAUL_RAMP.endZ);
  return [
    { ...start, stage: 'rampCrest', label: HAUL_ROAD_STAGE_LABELS.rampCrest },
    { ...mid, stage: 'rampMid', label: HAUL_ROAD_STAGE_LABELS.rampMid },
    { ...end, stage: 'rampToe', label: HAUL_ROAD_STAGE_LABELS.rampToe },
  ];
}

export function createHaulRoadRouteWaypoints({
  start,
  target,
  includeRamp = true,
  destinationStage = 'target',
} = {}) {
  const from = normaliseWorldPoint(start, 'start');
  const to = normaliseWorldPoint(target, 'target');
  const waypoints = [{ ...from, stage: 'start', label: HAUL_ROAD_STAGE_LABELS.start }];

  if (includeRamp) {
    const ramp = getHaulRampWorldWaypoints();
    const lowerFirst = distance2(from, ramp.at(-1)) < distance2(from, ramp[0]);
    const orderedRamp = lowerFirst ? [...ramp].reverse() : ramp;
    const firstRamp = orderedRamp[0];
    const lastRamp = orderedRamp.at(-1);
    const approach = lowerFirst
      ? { x: firstRamp.x - 18, z: firstRamp.z - 14, stage: 'lowerApproach', label: HAUL_ROAD_STAGE_LABELS.lowerApproach }
      : { x: firstRamp.x + 22, z: firstRamp.z + 10, stage: 'topRoad', label: HAUL_ROAD_STAGE_LABELS.topRoad };
    const exitRoad = lowerFirst
      ? { x: lastRamp.x + 28, z: lastRamp.z + 12, stage: 'topRoad', label: HAUL_ROAD_STAGE_LABELS.topRoad }
      : { x: lastRamp.x - 18, z: lastRamp.z - 14, stage: 'lowerApproach', label: HAUL_ROAD_STAGE_LABELS.lowerApproach };
    [approach, ...orderedRamp, exitRoad].forEach(point => pushDistinctWaypoint(waypoints, point));
  }

  const edgeRoadNeeded = destinationStage.includes('edge') || to.z < -120 || Math.abs(to.x) > 120;
  if (edgeRoadNeeded) {
    pushDistinctWaypoint(waypoints, {
      x: Math.max(68, Math.min(198, to.x)),
      z: -154,
      stage: 'edgeRoad',
      label: HAUL_ROAD_STAGE_LABELS.edgeRoad,
    });
  }

  pushDistinctWaypoint(waypoints, {
    ...to,
    stage: destinationStage,
    label: HAUL_ROAD_STAGE_LABELS[destinationStage] || HAUL_ROAD_STAGE_LABELS.target,
  });
  return waypoints.map(point => ({
    x: roundCoord(point.x),
    z: roundCoord(point.z),
    stage: point.stage,
    label: point.label,
  }));
}

function pushDistinctWaypoint(waypoints, point) {
  const previous = waypoints.at(-1);
  if (previous && distance2(previous, point) < 16) return;
  waypoints.push(point);
}

function distance2(a, b) {
  return Math.hypot((a?.x || 0) - (b?.x || 0), (a?.z || 0) - (b?.z || 0));
}

function normaliseWorldPoint(point, label) {
  const x = Number(point?.x);
  const z = Number(point?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) throw new Error(`Invalid ${label} for haul road route`);
  return { x, z };
}

function roundCoord(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
