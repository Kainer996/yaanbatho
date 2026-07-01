import {
  createHaulRoadRouteWaypoints,
} from './quarry-terrain-core.mjs?v=20260601-ground-cleanup';

export function getEquipmentPopupViewportLayout({
  clickX = 0,
  clickY = 0,
  viewportWidth = 1280,
  viewportHeight = 720,
  preferredWidth = 520,
  margin = 12,
} = {}) {
  const safeWidth = Math.max(1, Number(viewportWidth) || 1280);
  const safeHeight = Math.max(1, Number(viewportHeight) || 720);
  const safeMargin = Math.max(0, Number(margin) || 0);
  const maxAvailableWidth = Math.max(180, safeWidth - (safeMargin * 2));
  const desiredWidth = Math.max(220, Number(preferredWidth) || 520);
  const width = Math.min(Math.max(220, desiredWidth - (safeMargin * 2)), maxAvailableWidth);
  const maxHeight = Math.max(180, safeHeight - (safeMargin * 2));
  const rawLeft = (Number(clickX) || 0) + 8;
  const rawTop = (Number(clickY) || 0) + 8;

  return {
    position: 'fixed',
    width,
    maxHeight,
    left: Math.round(Math.min(Math.max(safeMargin, rawLeft), safeWidth - width - safeMargin)),
    top: Math.round(Math.min(Math.max(safeMargin, rawTop), safeHeight - maxHeight - safeMargin)),
    overflowY: 'auto',
  };
}

export function getFullscreenPanelNavigationPlan({ panelName, fullscreenActive = false } = {}) {
  const targetPanel = panelName || 'simulation';
  if (!fullscreenActive) {
    return { action: 'switch-app-panel', panelName: targetPanel, keepFullscreen: false };
  }
  if (targetPanel === 'simulation') {
    return { action: 'close-overlay-panel', panelName: targetPanel, keepFullscreen: true };
  }
  return { action: 'show-overlay-panel', panelName: targetPanel, keepFullscreen: true };
}

export const EXCAVATOR_POSE = Object.freeze({
  digging: Object.freeze({
    // Modern hydraulic excavators dig by reaching the boom/stick out in front
    // of the house, then curling the bucket back toward the machine. Negative
    // Z rotation extends these vertical segment meshes forward on the +X side.
    boomRotationZ: -0.42,
    armRotationZ: -1.55,
    bucketRotationZ: -0.25,
    boomLength: 8,
    armLength: 6,
    bucketLength: 2.2,
  }),
});

export const EXCAVATOR_ANIMATION = Object.freeze({
  boomAmplitude: 0.22,
  armAmplitude: 0.22,
  bucketAmplitude: 0.28,
  boomPhase: 0,
  armPhase: 1.2,
  bucketPhase: 2.0,
  cycleSpeed: 0.55,
});

export const VEHICLE_FORWARD_AXES = Object.freeze({
  // Quarry dumpers in quarry3d.js are modelled with the cab/headlights facing
  // local -X. Align that axis to the travel vector so they drive nose-first
  // instead of sliding sideways like crabs.
  dumper: Object.freeze({ x: -1, z: 0 }),
});

export const SCREENER_DISCHARGE_PRODUCT_KEYS = Object.freeze([
  'crushedStone',
  'stockpile10mm',
  'stockpile20mm',
  'stockpile40mm',
  'dust',
]);

export const SCREENER_DISCHARGE_OFFSETS = Object.freeze({
  crushedStone: Object.freeze({ x: 7.2, y: 4.2, z: 0 }),
  stockpile10mm: Object.freeze({ x: 8.5, y: 6.2, z: 3.8 }),
  stockpile20mm: Object.freeze({ x: 9.2, y: 5.4, z: 1.2 }),
  stockpile40mm: Object.freeze({ x: 9.8, y: 4.6, z: -1.4 }),
  dust: Object.freeze({ x: 7.2, y: 3.1, z: -3.7 }),
});

export const SCREENER_LOCAL_PRODUCT_CHUNK_OFFSET = Object.freeze({ x: 14, y: 1.35, z: 0 });

export const DIRECT_FEED_PROOF_CAMERA_DEFAULTS = Object.freeze({
  wideOffset: Object.freeze({ x: -74, y: 58, z: 78 }),
  tightOffset: Object.freeze({ x: -62, y: 52, z: 66 }),
  targetLift: 6,
});

export function shouldShowQuarryFaceOutline() {
  return false;
}

function proofCameraOffset(candidate, fallback) {
  return {
    x: Number.isFinite(Number(candidate?.x)) ? Number(candidate.x) : fallback.x,
    y: Number.isFinite(Number(candidate?.y)) ? Number(candidate.y) : fallback.y,
    z: Number.isFinite(Number(candidate?.z)) ? Number(candidate.z) : fallback.z,
  };
}

export function getDirectFeedProofCameraPlan({
  excavatorPosition,
  crusherFeedPosition,
  screenerPosition,
  viewportWidth = 1280,
  viewportHeight = 720,
  offsets = DIRECT_FEED_PROOF_CAMERA_DEFAULTS,
} = {}) {
  if (!isFinitePoint2(excavatorPosition) || !isFinitePoint2(crusherFeedPosition)) {
    return { active: false, reason: 'missing-proof-anchors' };
  }

  const safeOffsets = {
    wideOffset: proofCameraOffset(offsets?.wideOffset, DIRECT_FEED_PROOF_CAMERA_DEFAULTS.wideOffset),
    tightOffset: proofCameraOffset(offsets?.tightOffset, DIRECT_FEED_PROOF_CAMERA_DEFAULTS.tightOffset),
    targetLift: Number.isFinite(Number(offsets?.targetLift)) ? Number(offsets.targetLift) : DIRECT_FEED_PROOF_CAMERA_DEFAULTS.targetLift,
  };
  const excavator = normalisePoint3(excavatorPosition, 'excavatorPosition');
  const crusherFeed = normalisePoint3(crusherFeedPosition, 'crusherFeedPosition');
  const screener = isFinitePoint2(screenerPosition)
    ? normalisePoint3(screenerPosition, 'screenerPosition')
    : crusherFeed;
  const width = Math.max(1, Number(viewportWidth) || 1280);
  const height = Math.max(1, Number(viewportHeight) || 720);
  const shortOrNarrow = width < 760 || height < 520;
  const offset = shortOrNarrow ? safeOffsets.tightOffset : safeOffsets.wideOffset;

  const target = {
    x: roundFlowCoord((excavator.x * 0.28) + (crusherFeed.x * 0.48) + (screener.x * 0.24)),
    y: roundFlowCoord(Math.max(excavator.y, crusherFeed.y, screener.y) + safeOffsets.targetLift),
    z: roundFlowCoord((excavator.z * 0.32) + (crusherFeed.z * 0.48) + (screener.z * 0.20)),
  };

  return {
    active: true,
    mode: 'direct-feed-proof',
    viewportClass: shortOrNarrow ? 'tight' : 'wide',
    target,
    cameraPosition: {
      x: roundFlowCoord(target.x + offset.x),
      y: roundFlowCoord(target.y + offset.y),
      z: roundFlowCoord(target.z + offset.z),
    },
    overlay: {
      compact: shortOrNarrow,
      anchor: shortOrNarrow ? 'bottom-proof-strip' : 'right-proof-card',
      hideHint: true,
    },
  };
}

export function getDirectFeedProofGuidePlan({
  excavatorPosition,
  rubblePosition,
  crusherFeedPosition,
  feedTonnes = 0,
  elapsedSeconds = 1.8,
  cyclesCompleted = 0,
} = {}) {
  if (!isFinitePoint2(excavatorPosition) || !isFinitePoint2(crusherFeedPosition)) {
    return { active: false, reason: 'missing-guide-anchors' };
  }
  if ((Number(feedTonnes) || 0) <= 0) {
    return { active: false, reason: 'empty-guide-feed' };
  }

  const excavator = normalisePoint3(excavatorPosition, 'excavatorPosition');
  const rubble = isFinitePoint2(rubblePosition)
    ? normalisePoint3(rubblePosition, 'rubblePosition')
    : { x: excavator.x - 6, y: excavator.y, z: excavator.z - 4 };
  const hopper = normalisePoint3(crusherFeedPosition, 'crusherFeedPosition');
  const cyclePlan = getExcavatorCrusherFeedCyclePlan({
    elapsedSeconds,
    feedTonnes,
    excavatorPosition: excavator,
    rubblePosition: rubble,
    crusherFeedPosition: hopper,
    hasScreener: true,
  });
  const phaseCallouts = {
    scoop: 'Excavator scooping shot rock',
    swing: 'Bucket swinging to hopper',
    dump: 'Excavator bucket feeding crusher',
    processing: 'Crusher processing feed',
    complete: 'Feed cycle ready to book',
  };
  const streamPeak = Math.max(excavator.y + 1.5, hopper.y + 1.8);
  const pathPoints = [
    { x: roundFlowCoord(excavator.x), y: roundFlowCoord(excavator.y + 1.5), z: roundFlowCoord(excavator.z) },
    {
      x: roundFlowCoord((excavator.x + hopper.x) / 2),
      y: roundFlowCoord(streamPeak),
      z: roundFlowCoord((excavator.z + hopper.z) / 2),
    },
    { x: roundFlowCoord(hopper.x), y: roundFlowCoord(hopper.y), z: roundFlowCoord(hopper.z) },
  ];

  return {
    active: true,
    mode: 'direct-feed-guide',
    phase: cyclePlan.phase,
    phaseProgress: cyclePlan.phaseProgress,
    coreMutationReady: cyclePlan.coreMutationReady,
    showMaterialStream: Boolean(cyclePlan.showMaterialStream),
    callout: phaseCallouts[cyclePlan.phase] || 'Excavator feeding crusher',
    badge: `${Math.max(0, Math.floor(Number(cyclesCompleted) || 0))} proven feed cycles`,
    feedTonnes: roundFlowTonnes(feedTonnes),
    pathPoints,
    streamFrom: cyclePlan.streamFrom,
    streamTo: cyclePlan.streamTo,
  };
}

function segmentEnd({ x, y }, rotationZ, length) {
  return {
    x: x - Math.sin(rotationZ) * length,
    y: y + Math.cos(rotationZ) * length,
  };
}

export function getExcavatorDiggingReach(pose = EXCAVATOR_POSE.digging) {
  const boomStart = { x: 0, y: 0 };
  const boomTip = segmentEnd(boomStart, pose.boomRotationZ, pose.boomLength);
  const armTip = segmentEnd(boomTip, pose.boomRotationZ + pose.armRotationZ, pose.armLength);
  const bucketTip = segmentEnd(
    armTip,
    pose.boomRotationZ + pose.armRotationZ + pose.bucketRotationZ,
    pose.bucketLength
  );

  return {
    boomTipX: boomTip.x,
    boomTipY: boomTip.y,
    bucketTipX: bucketTip.x,
    bucketTipY: bucketTip.y,
  };
}

export function getVehicleYawForDirection(direction, forwardAxis = VEHICLE_FORWARD_AXES.dumper) {
  const dx = Number(direction?.x) || 0;
  const dz = Number(direction?.z) || 0;
  const len = Math.hypot(dx, dz);
  if (len === 0) return 0;

  const fx = Number(forwardAxis?.x) || 0;
  const fz = Number(forwardAxis?.z) || 0;
  const fl = Math.hypot(fx, fz);
  if (fl === 0) return Math.atan2(-dz, dx);

  const source = Math.atan2(fz / fl, fx / fl);
  const target = Math.atan2(dz / len, dx / len);
  return normalizeAngle(source - target);
}

export function getVehicleForwardForYaw(yaw, forwardAxis = VEHICLE_FORWARD_AXES.dumper) {
  const fx = Number(forwardAxis?.x) || 0;
  const fz = Number(forwardAxis?.z) || 0;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return {
    x: fx * cos + fz * sin,
    z: -fx * sin + fz * cos,
  };
}

export function getExcavatorCrusherTrackPlan({
  excavatorPosition,
  crusherFeedPosition,
  standOff = 18,
  arrivalDistance = 3,
} = {}) {
  if (!isFinitePoint2(excavatorPosition) || !isFinitePoint2(crusherFeedPosition)) {
    return { active: false, reason: 'missing-anchor' };
  }

  const excavator = normalisePoint(excavatorPosition, 'excavatorPosition');
  const feedPoint = normalisePoint(crusherFeedPosition, 'crusherFeedPosition');
  const dx = excavator.x - feedPoint.x;
  const dz = excavator.z - feedPoint.z;
  const len = Math.hypot(dx, dz) || 1;
  const offset = Math.max(8, Number(standOff) || 18);
  const target = {
    x: roundFlowCoord(feedPoint.x + (dx / len) * offset),
    z: roundFlowCoord(feedPoint.z + (dz / len) * offset),
  };
  const distanceToTarget = Math.hypot(excavator.x - target.x, excavator.z - target.z);

  return {
    active: true,
    excavator,
    feedPoint,
    target,
    distanceToTarget: roundFlowCoord(distanceToTarget),
    shouldMove: distanceToTarget > Math.max(0.5, Number(arrivalDistance) || 3),
    faceDirection: {
      x: roundFlowCoord(feedPoint.x - target.x),
      z: roundFlowCoord(feedPoint.z - target.z),
    },
  };
}

export function getExcavatorCrusherTrackingDecision({
  excavatorPosition,
  rubblePosition,
  crusherFeedPosition,
  looseGroundTonnes = 0,
  standOff = 18,
  arrivalDistance = 3,
  maxRubbleReach = 42,
  maxCrusherReach = 38,
  maxRubbleCrusherDistance = 58,
} = {}) {
  const trackPlan = getExcavatorCrusherTrackPlan({
    excavatorPosition,
    crusherFeedPosition,
    standOff,
    arrivalDistance,
  });
  if (!trackPlan.active) return { ...trackPlan, directFeedAvailable: false };

  const excavator = normalisePoint(excavatorPosition, 'excavatorPosition');
  const hopper = normalisePoint(crusherFeedPosition, 'crusherFeedPosition');
  const rubble = isFinitePoint2(rubblePosition) ? normalisePoint(rubblePosition, 'rubblePosition') : null;
  const hasLooseGround = (Number(looseGroundTonnes) || 0) > 0;
  const closeEnoughToMuck = Boolean(rubble) && Math.hypot(excavator.x - rubble.x, excavator.z - rubble.z) < maxRubbleReach;
  const closeEnoughToCrusher = Math.hypot(excavator.x - hopper.x, excavator.z - hopper.z) < maxCrusherReach;
  const crusherCloseToMuck = Boolean(rubble) && Math.hypot(rubble.x - hopper.x, rubble.z - hopper.z) < maxRubbleCrusherDistance;
  const directFeedAvailable = hasLooseGround && closeEnoughToMuck && closeEnoughToCrusher && crusherCloseToMuck;

  return {
    ...trackPlan,
    rubble,
    hasLooseGround,
    closeEnoughToMuck,
    closeEnoughToCrusher,
    crusherCloseToMuck,
    directFeedAvailable,
    reason: directFeedAvailable ? 'direct-feed-ready' : (trackPlan.shouldMove ? 'tracking-to-hopper' : 'waiting-for-rubble-reach'),
  };
}

export function getDumperLoaderParkingTarget({
  productPilePosition,
  loaderPosition,
  standOff = 12,
} = {}) {
  if (!isFinitePoint2(productPilePosition)) {
    return { active: false, reason: 'missing-product-pile' };
  }
  if (!isFinitePoint2(loaderPosition)) {
    const pile = normalisePoint(productPilePosition, 'productPilePosition');
    return { active: true, x: pile.x, z: pile.z, source: 'product-pile' };
  }

  const pile = normalisePoint(productPilePosition, 'productPilePosition');
  const loader = normalisePoint(loaderPosition, 'loaderPosition');
  const dx = loader.x - pile.x;
  const dz = loader.z - pile.z;
  const len = Math.hypot(dx, dz) || 1;
  const offset = Math.max(7, Number(standOff) || 12);

  return {
    active: true,
    x: roundFlowCoord(loader.x + (dx / len) * offset),
    z: roundFlowCoord(loader.z + (dz / len) * offset),
    loader,
    productPile: pile,
    source: 'loader-side',
  };
}

export function createEdgeHaulRoute({
  start,
  productTarget,
  edgeTarget,
  alreadyLoaded = false,
  useHaulRoad = false,
  speed = 42,
  minDuration = 1.8,
  maxDuration = 6.5,
} = {}) {
  const from = normalisePoint(start, 'start');
  const edge = normalisePoint(edgeTarget, 'edgeTarget');
  const waypoints = [from];

  if (!alreadyLoaded && productTarget) {
    waypoints.push(normalisePoint(productTarget, 'productTarget'));
  }
  if (useHaulRoad) {
    const roadStart = waypoints.at(-1);
    const roadWaypoints = createHaulRoadRouteWaypoints({
      start: roadStart,
      target: edge,
      includeRamp: true,
      destinationStage: 'edgeStockpile',
    });
    roadWaypoints.slice(1).forEach(point => waypoints.push(point));
  } else {
    waypoints.push(edge);
  }

  return buildRouteFromWaypoints(waypoints, {
    speed,
    minDuration,
    maxDuration,
    loadAtWaypointIndex: alreadyLoaded ? 0 : Math.min(1, waypoints.length - 1),
    tipAtWaypointIndex: waypoints.length - 1,
  });
}

export function createPlantFeedRoute({
  start,
  rubbleTarget,
  crusherTarget,
  alreadyLoaded = false,
  useHaulRoad = false,
  speed = 34,
  minDuration = 1.6,
  maxDuration = 5.5,
} = {}) {
  const from = normalisePoint(start, 'start');
  const crusher = normalisePoint(crusherTarget, 'crusherTarget');
  const waypoints = [from];

  if (!alreadyLoaded && rubbleTarget) {
    waypoints.push(normalisePoint(rubbleTarget, 'rubbleTarget'));
  }
  if (useHaulRoad) {
    const roadStart = waypoints.at(-1);
    const roadWaypoints = createHaulRoadRouteWaypoints({
      start: roadStart,
      target: crusher,
      includeRamp: true,
      destinationStage: 'crusherFeed',
    });
    roadWaypoints.slice(1).forEach(point => waypoints.push(point));
  } else {
    waypoints.push(crusher);
  }

  return buildRouteFromWaypoints(waypoints, {
    speed,
    minDuration,
    maxDuration,
    loadAtWaypointIndex: alreadyLoaded ? 0 : Math.min(1, waypoints.length - 1),
    tipAtWaypointIndex: waypoints.length - 1,
    routeType: 'plant-feed',
  });
}

function buildRouteFromWaypoints(waypoints, {
  speed,
  minDuration,
  maxDuration,
  loadAtWaypointIndex,
  tipAtWaypointIndex,
  routeType = 'edge-haul',
}) {
  const segments = [];
  let totalDistance = 0;
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    const distance = Math.hypot(b.x - a.x, b.z - a.z);
    if (distance <= 0) continue;
    totalDistance += distance;
    segments.push({ from: a, to: b, distance });
  }

  const rawDuration = totalDistance / Math.max(1, speed);
  return {
    routeType,
    waypoints,
    segments,
    totalDistance,
    durationSeconds: Math.max(minDuration, Math.min(maxDuration, rawDuration)),
    loadAtWaypointIndex,
    tipAtWaypointIndex,
    stageLabels: waypoints.map((point, index) => ({
      index,
      stage: point.stage || (index === loadAtWaypointIndex ? 'load' : (index === tipAtWaypointIndex ? 'tip' : 'travel')),
      label: point.label || (index === loadAtWaypointIndex ? 'Load point' : (index === tipAtWaypointIndex ? 'Tip point' : 'Route point')),
    })),
  };
}

export function getRouteProgressState(route, progress = 0) {
  if (!route || !Array.isArray(route.segments) || !Array.isArray(route.waypoints)) {
    throw new Error('Invalid route for progress state');
  }

  const clampedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const totalDistance = Math.max(0, Number(route.totalDistance) || 0);
  const travelledDistance = totalDistance * clampedProgress;
  let remaining = travelledDistance;
  let activeSegmentIndex = route.segments.length ? route.segments.length - 1 : 0;
  let segmentProgress = 1;
  let position = route.waypoints.at(-1) || { x: 0, z: 0 };

  if (!route.segments.length || totalDistance === 0) {
    activeSegmentIndex = 0;
    segmentProgress = 1;
  } else {
    for (let i = 0; i < route.segments.length; i++) {
      const segment = route.segments[i];
      const distance = Math.max(0, Number(segment.distance) || 0);
      if (remaining <= distance || i === route.segments.length - 1) {
        activeSegmentIndex = i;
        segmentProgress = distance === 0 ? 1 : Math.max(0, Math.min(1, remaining / distance));
        position = {
          x: segment.from.x + (segment.to.x - segment.from.x) * segmentProgress,
          z: segment.from.z + (segment.to.z - segment.from.z) * segmentProgress,
        };
        break;
      }
      remaining -= distance;
    }
  }

  const reachedWaypointIndexes = [0];
  let accumulated = 0;
  route.segments.forEach((segment, index) => {
    accumulated += Math.max(0, Number(segment.distance) || 0);
    if (travelledDistance >= accumulated - 1e-9) reachedWaypointIndexes.push(index + 1);
  });

  return {
    progress: clampedProgress,
    travelledDistance,
    remainingDistance: Math.max(0, totalDistance - travelledDistance),
    activeSegmentIndex,
    segmentProgress,
    position,
    reachedWaypointIndexes,
    loadReached: reachedWaypointIndexes.includes(route.loadAtWaypointIndex),
    tipReached: reachedWaypointIndexes.includes(route.tipAtWaypointIndex),
    stage: route.stageLabels?.[Math.min(route.stageLabels.length - 1, activeSegmentIndex + 1)]?.stage || 'travel',
    stageLabel: route.stageLabels?.[Math.min(route.stageLabels.length - 1, activeSegmentIndex + 1)]?.label || 'Travelling',
  };
}

export function getBlastActionUiState(markerCount = 0) {
  const count = Math.max(0, Math.floor(Number(markerCount) || 0));
  if (count <= 0) {
    return {
      visible: false,
      label: 'No blast armed',
      canDetonate: false,
      canRemove: false,
    };
  }

  return {
    visible: true,
    label: `${count} blast ${count === 1 ? 'marker' : 'markers'} armed`,
    detonateLabel: '💥 Detonate blast',
    removeLabel: '✕ Remove blast',
    canDetonate: true,
    canRemove: true,
  };
}

export function getEdgeHaulRouteUiState(route, progress = 0, { tipping = false } = {}) {
  const state = getRouteProgressState(route, progress);
  const percent = Math.round(state.progress * 100);

  if (tipping || state.tipReached) {
    return {
      stage: 'tipping',
      label: '⛰ Tipping at edge',
      percent: 100,
      busy: true,
    };
  }

  if (!state.loadReached && route.loadAtWaypointIndex > 0) {
    return {
      stage: 'to_product',
      label: `🚛 Driving to product bay ${percent}%`,
      percent,
      busy: true,
    };
  }

  return {
    stage: 'to_edge',
    label: `🚛 Hauling to edge ${percent}%`,
    percent,
    busy: true,
  };
}

export function getPlantFeedRouteUiState(route, progress = 0, { processing = false } = {}) {
  const state = getRouteProgressState(route, progress);
  const percent = Math.round(state.progress * 100);

  if (processing || state.tipReached) {
    return {
      stage: 'processing',
      label: '🏭 Feeding crusher',
      percent: 100,
      busy: true,
    };
  }

  if (!state.loadReached && route.loadAtWaypointIndex > 0) {
    return {
      stage: 'to_rubble',
      label: `🪨 Driving to shot rock ${percent}%`,
      percent,
      busy: true,
    };
  }

  return {
    stage: 'to_crusher',
    label: `🚛 Hauling to crusher ${percent}%`,
    percent,
    busy: true,
  };
}

export function getLoaderProductCycleUiState(progress = 0) {
  const percent = Math.round(Math.max(0, Math.min(1, Number(progress) || 0)) * 100);
  return {
    stage: 'loading_product',
    label: `⛟ Loading dumper ${percent}%`,
    percent,
    busy: true,
  };
}

export function getLoaderProductCyclePlan({
  loaderPosition,
  productPilePosition,
  dumperPosition,
  progress = 0,
  loadedTonnes = 0,
} = {}) {
  if (!isFinitePoint2(loaderPosition) || !isFinitePoint2(productPilePosition) || !isFinitePoint2(dumperPosition)) {
    return { active: false, reason: 'missing-anchor' };
  }
  if ((Number(loadedTonnes) || 0) <= 0) {
    return { active: false, reason: 'empty-load' };
  }

  const loader = normalisePoint(loaderPosition, 'loaderPosition');
  const pile = normalisePoint(productPilePosition, 'productPilePosition');
  const dumper = normalisePoint(dumperPosition, 'dumperPosition');
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const stage = p < 0.25 ? 'scoop' : (p < 0.55 ? 'swing' : (p < 0.78 ? 'dump' : 'return'));
  const hasMaterial = stage === 'swing' || stage === 'dump';
  const bucketLift = stage === 'scoop'
    ? smoothstep(p / 0.25) * 0.35
    : (stage === 'return' ? 1 - smoothstep((p - 0.78) / 0.22) * 0.65 : 1);
  const bucketCurl = stage === 'scoop'
    ? -0.45 + smoothstep(p / 0.25) * 0.75
    : (stage === 'dump' ? 0.3 + smoothstep((p - 0.55) / 0.23) * 0.55 : 0.3);
  const travelMix = stage === 'scoop'
    ? 0
    : (stage === 'swing' ? smoothstep((p - 0.25) / 0.3) : 1);
  const bucketXZ = lerpPoint2(pile, dumper, travelMix);
  const bucketWorld = {
    x: roundFlowCoord(bucketXZ.x),
    y: roundFlowCoord(stage === 'scoop' ? 2.4 + bucketLift * 1.6 : 3.8 + bucketLift * 2.6),
    z: roundFlowCoord(bucketXZ.z),
  };
  const streamTo = {
    x: roundFlowCoord(dumper.x),
    y: 3.2,
    z: roundFlowCoord(dumper.z),
  };

  return {
    active: true,
    stage,
    progress: roundFlowCoord(p),
    loadedTonnes: roundFlowTonnes(loadedTonnes),
    hasMaterial,
    showMaterialStream: stage === 'dump' && p >= 0.58 && p <= 0.72,
    bucketLift: roundFlowCoord(bucketLift),
    bucketCurl: roundFlowCoord(bucketCurl),
    faceDirection: {
      x: roundFlowCoord((stage === 'scoop' ? pile : dumper).x - loader.x),
      z: roundFlowCoord((stage === 'scoop' ? pile : dumper).z - loader.z),
    },
    bucketWorld,
    streamFrom: bucketWorld,
    streamTo,
  };
}

export function getCrusherTipCyclePlan({
  dumperPosition,
  crusherFeedPosition,
  progress = 0,
  loadedTonnes = 0,
} = {}) {
  if (!isFinitePoint2(dumperPosition) || !isFinitePoint2(crusherFeedPosition)) {
    return { active: false, reason: 'missing-anchor' };
  }
  if ((Number(loadedTonnes) || 0) <= 0) {
    return { active: false, reason: 'empty-load' };
  }

  const dumper = normalisePoint3(dumperPosition, 'dumperPosition');
  const hopper = normalisePoint3(crusherFeedPosition, 'crusherFeedPosition');
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const stage = p < 0.22 ? 'raise' : (p < 0.72 ? 'tip' : 'lower');
  const bedLiftProgress = stage === 'raise'
    ? 0.5 * smoothstep(p / 0.22)
    : (stage === 'lower' ? 0.5 + 0.5 * smoothstep((p - 0.72) / 0.28) : 0.5);
  const streamFrom = {
    x: roundFlowCoord(dumper.x + (hopper.x - dumper.x) * 0.34),
    y: roundFlowCoord(Math.max(dumper.y + 4.8, hopper.y + 2.4)),
    z: roundFlowCoord(dumper.z + (hopper.z - dumper.z) * 0.34),
  };

  return {
    active: true,
    stage,
    progress: roundFlowCoord(p),
    loadedTonnes: roundFlowTonnes(loadedTonnes),
    tipVisualProgress: roundFlowCoord(bedLiftProgress),
    showMaterialStream: stage === 'tip' && p >= 0.32 && p <= 0.66,
    faceDirection: {
      x: roundFlowCoord(hopper.x - dumper.x),
      z: roundFlowCoord(hopper.z - dumper.z),
    },
    streamFrom,
    streamTo: {
      x: roundFlowCoord(hopper.x),
      y: roundFlowCoord(hopper.y),
      z: roundFlowCoord(hopper.z),
    },
  };
}

export function getPlantProcessingAnimationPlan({
  progress = 0,
  feedTonnes = 0,
  hasCrusher = true,
  hasScreener = true,
} = {}) {
  if ((Number(feedTonnes) || 0) <= 0) {
    return { active: false, reason: 'empty-feed' };
  }
  if (!hasCrusher) {
    return { active: false, reason: 'missing-crusher' };
  }

  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const stage = p < 0.24 ? 'hopper-feed'
    : (p < 0.58 ? 'crushing'
      : (p < 0.84 && hasScreener ? 'screening' : 'discharge'));
  const rampUp = smoothstep(Math.min(1, p / 0.18));
  const rampDown = 1 - smoothstep(Math.max(0, (p - 0.82) / 0.18));
  const intensity = Math.max(0.18, Math.min(1, rampUp * rampDown));
  const hopperFill = stage === 'hopper-feed'
    ? 0.25 + smoothstep(p / 0.24) * 0.75
    : (stage === 'crushing' ? 1 - smoothstep((p - 0.24) / 0.34) * 0.55 : Math.max(0, 0.45 - smoothstep((p - 0.58) / 0.42) * 0.45));
  const dischargePulse = stage === 'discharge' || stage === 'screening'
    ? smoothstep(Math.max(0, (p - 0.58) / 0.18)) * rampDown
    : 0;

  return {
    active: true,
    stage,
    progress: roundFlowCoord(p),
    feedTonnes: roundFlowTonnes(feedTonnes),
    intensity: roundFlowCoord(intensity),
    crusherFlywheelSpeed: roundFlowCoord(3 + intensity * 8),
    crusherRollerSpeed: roundFlowCoord(4.5 + intensity * 9),
    beltSpeed: roundFlowCoord(0.35 + intensity * 1.85),
    hopperFillScale: roundFlowCoord(hopperFill),
    screenerShakeY: hasScreener ? roundFlowCoord(Math.sin(p * Math.PI * 18) * 0.16 * intensity) : 0,
    screenerShakeZ: hasScreener ? roundFlowCoord(Math.sin(p * Math.PI * 14) * 0.08 * intensity) : 0,
    materialVisible: hopperFill > 0.04 || dischargePulse > 0,
    dischargePulse: roundFlowCoord(dischargePulse),
  };
}

export function getAutonomousPlantFeedVisualPlan({
  elapsedSeconds = 0,
  tipSeconds = 2,
  processingSeconds = 0.45,
  loadedTonnes = 0,
  dumperPosition,
  crusherFeedPosition,
  hasCrusher = true,
  hasScreener = true,
} = {}) {
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const tipDuration = Math.max(0.1, Number(tipSeconds) || 2);
  const processingDuration = Math.max(0.1, Number(processingSeconds) || 0.45);
  const tonnes = Number(loadedTonnes) || 0;

  if (elapsed < tipDuration) {
    const progress = elapsed / tipDuration;
    return {
      active: true,
      phase: 'tipping',
      coreMutationReady: false,
      tipPlan: getCrusherTipCyclePlan({
        dumperPosition,
        crusherFeedPosition,
        progress,
        loadedTonnes: tonnes,
      }),
      processingPlan: { active: false, reason: 'tip-not-finished' },
      processingProgress: 0,
    };
  }

  if (elapsed < tipDuration + processingDuration) {
    const processingProgress = (elapsed - tipDuration) / processingDuration;
    return {
      active: true,
      phase: 'processing',
      coreMutationReady: false,
      tipPlan: getCrusherTipCyclePlan({
        dumperPosition,
        crusherFeedPosition,
        progress: 1,
        loadedTonnes: tonnes,
      }),
      processingPlan: getPlantProcessingAnimationPlan({
        progress: processingProgress,
        feedTonnes: tonnes,
        hasCrusher,
        hasScreener,
      }),
      processingProgress: roundFlowCoord(processingProgress),
    };
  }

  return {
    active: false,
    phase: 'complete',
    coreMutationReady: true,
    tipPlan: getCrusherTipCyclePlan({
      dumperPosition,
      crusherFeedPosition,
      progress: 1,
      loadedTonnes: tonnes,
    }),
    processingPlan: getPlantProcessingAnimationPlan({
      progress: 1,
      feedTonnes: tonnes,
      hasCrusher,
      hasScreener,
    }),
    processingProgress: 1,
  };
}

export function getExcavatorCrusherFeedUiState(plan = null) {
  if (!plan?.active && plan?.phase !== 'complete') {
    return {
      stage: 'idle',
      label: '🏭 Process load',
      busy: false,
      percent: 0,
    };
  }

  if (plan.coreMutationReady || plan.phase === 'complete') {
    return {
      stage: 'complete',
      label: '🏭 Finishing crusher feed',
      busy: true,
      percent: 100,
    };
  }

  const phaseWeights = {
    scoop: [0, 30, '⛏ Scooping shot rock'],
    swing: [30, 55, '⛏ Swinging to hopper'],
    dump: [55, 82, '🏭 Bucket feeding crusher'],
    processing: [82, 100, '⚙️ Crusher processing'],
  };
  const [start, end, label] = phaseWeights[plan.phase] || phaseWeights.scoop;
  const progress = Math.max(0, Math.min(1, Number(plan.phaseProgress) || Number(plan.processingProgress) || 0));
  return {
    stage: plan.phase,
    label: `${label} ${Math.round(start + (end - start) * progress)}%`,
    busy: true,
    percent: Math.round(start + (end - start) * progress),
  };
}

export function getExcavatorCrusherFeedCyclePlan({
  elapsedSeconds = 0,
  scoopSeconds = 0.85,
  swingSeconds = 0.55,
  dumpSeconds = 0.75,
  processingSeconds = 0.45,
  feedTonnes = 0,
  excavatorPosition,
  rubblePosition,
  crusherFeedPosition,
  hasCrusher = true,
  hasScreener = true,
} = {}) {
  if (!isFinitePoint2(excavatorPosition) || !isFinitePoint2(rubblePosition) || !isFinitePoint2(crusherFeedPosition)) {
    return { active: false, phase: 'idle', reason: 'missing-anchor', coreMutationReady: false };
  }
  const tonnes = Number(feedTonnes) || 0;
  if (tonnes <= 0) {
    return { active: false, phase: 'idle', reason: 'empty-feed', coreMutationReady: false };
  }

  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const scoopDuration = Math.max(0.1, Number(scoopSeconds) || 0.85);
  const swingDuration = Math.max(0.1, Number(swingSeconds) || 0.55);
  const dumpDuration = Math.max(0.1, Number(dumpSeconds) || 0.75);
  const processingDuration = Math.max(0.1, Number(processingSeconds) || 0.45);
  const scoopEnd = scoopDuration;
  const swingEnd = scoopEnd + swingDuration;
  const dumpEnd = swingEnd + dumpDuration;
  const processingEnd = dumpEnd + processingDuration;

  const excavator = normalisePoint3(excavatorPosition, 'excavatorPosition');
  const rubble = normalisePoint3(rubblePosition, 'rubblePosition');
  const hopper = normalisePoint3(crusherFeedPosition, 'crusherFeedPosition');

  if (elapsed >= processingEnd) {
    return {
      active: false,
      phase: 'complete',
      coreMutationReady: true,
      feedTonnes: roundFlowTonnes(tonnes),
      processingPlan: getPlantProcessingAnimationPlan({ progress: 1, feedTonnes: tonnes, hasCrusher, hasScreener }),
    };
  }

  let phase = 'scoop';
  let phaseProgress = Math.min(1, elapsed / scoopDuration);
  if (elapsed >= scoopEnd && elapsed < swingEnd) {
    phase = 'swing';
    phaseProgress = (elapsed - scoopEnd) / swingDuration;
  } else if (elapsed >= swingEnd && elapsed < dumpEnd) {
    phase = 'dump';
    phaseProgress = (elapsed - swingEnd) / dumpDuration;
  } else if (elapsed >= dumpEnd) {
    phase = 'processing';
    phaseProgress = (elapsed - dumpEnd) / processingDuration;
  }

  const bucketLift = phase === 'scoop'
    ? 0.12 + smoothstep(phaseProgress) * 0.2
    : (phase === 'swing' ? 0.32 + smoothstep(phaseProgress) * 0.36
      : (phase === 'dump' ? 0.72 : 0.42));
  const bucketCurl = phase === 'scoop'
    ? 0.72 - smoothstep(phaseProgress) * 0.28
    : (phase === 'dump' ? 0.12 : 0.48);
  const reachBlend = phase === 'scoop' ? 0 : smoothstep(phaseProgress);
  const bucketWorld = {
    x: roundFlowCoord((phase === 'scoop' ? rubble.x : (rubble.x + (hopper.x - rubble.x) * reachBlend))),
    y: roundFlowCoord(Math.max(excavator.y + 3.2, (phase === 'dump' ? hopper.y + 3.1 : excavator.y + 2.8 + bucketLift * 5.2))),
    z: roundFlowCoord((phase === 'scoop' ? rubble.z : (rubble.z + (hopper.z - rubble.z) * reachBlend))),
  };
  const processingProgress = phase === 'processing' ? roundFlowCoord(phaseProgress) : 0;

  return {
    active: true,
    phase,
    phaseProgress: roundFlowCoord(phaseProgress),
    coreMutationReady: false,
    feedTonnes: roundFlowTonnes(tonnes),
    bucketLift: roundFlowCoord(bucketLift),
    bucketCurl: roundFlowCoord(bucketCurl),
    faceDirection: {
      x: roundFlowCoord((phase === 'scoop' ? rubble : hopper).x - excavator.x),
      z: roundFlowCoord((phase === 'scoop' ? rubble : hopper).z - excavator.z),
    },
    showMaterialStream: phase === 'dump' && phaseProgress >= 0.25 && phaseProgress <= 0.82,
    streamFrom: bucketWorld,
    streamTo: {
      x: roundFlowCoord(hopper.x),
      y: roundFlowCoord(hopper.y),
      z: roundFlowCoord(hopper.z),
    },
    processingProgress,
    processingPlan: phase === 'processing'
      ? getPlantProcessingAnimationPlan({ progress: phaseProgress, feedTonnes: tonnes, hasCrusher, hasScreener })
      : { active: false, reason: phase === 'dump' ? 'bucket-dump-not-finished' : 'bucket-not-at-hopper' },
  };
}

export function getScreenerDischargeFlows({
  screenerPosition,
  stockpiles = [],
  materialBefore = {},
  materialAfter = {},
} = {}) {
  if (!isFinitePoint2(screenerPosition)) return [];
  const origin = normalisePoint3(screenerPosition, 'screenerPosition');
  return SCREENER_DISCHARGE_PRODUCT_KEYS.map(productKey => {
    const before = Number(materialBefore?.[productKey]) || 0;
    const after = Number(materialAfter?.[productKey]) || 0;
    const tonnes = roundFlowTonnes(Math.max(0, after - before));
    if (tonnes <= 0) return null;

    const offset = SCREENER_DISCHARGE_OFFSETS[productKey];
    // These flows are visual proof of material leaving the screener belt and landing in the
    // local loader-accessible product chunk. The named stockpile buckets may later be hauled
    // to edge/top stockpiles, but the belt discharge should not visually fly across the quarry.
    const target = {
      x: origin.x + offset.x * 1.6,
      y: 1.2,
      z: origin.z + offset.z * 1.6,
    };

    return {
      productKey,
      tonnes,
      visualTarget: 'loader-product-chunk',
      from: {
        x: roundFlowCoord(origin.x + offset.x),
        y: roundFlowCoord(origin.y + offset.y),
        z: roundFlowCoord(origin.z + offset.z),
      },
      to: {
        x: roundFlowCoord(target.x),
        y: roundFlowCoord(target.y),
        z: roundFlowCoord(target.z),
      },
    };
  }).filter(Boolean);
}

function lerpPoint2(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function smoothstep(value) {
  const x = Math.max(0, Math.min(1, Number(value) || 0));
  return x * x * (3 - 2 * x);
}

function normalisePoint(point, label) {
  const x = Number(point?.x);
  const z = Number(point?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new Error(`Invalid ${label} for edge haul route`);
  }
  return { x, z };
}

function isFinitePoint2(point) {
  return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.z));
}

function normalisePoint3(point, label) {
  const x = Number(point?.x);
  const y = Number(point?.y) || 0;
  const z = Number(point?.z);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new Error(`Invalid ${label} for screener discharge flow`);
  }
  return { x, y, z };
}

function roundFlowTonnes(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function roundFlowCoord(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getPileCenterY({ terrainHeight = 0, pileHeight = 1, clearance = 0.02 } = {}) {
  const ground = Number.isFinite(Number(terrainHeight)) ? Number(terrainHeight) : 0;
  const height = Math.max(0, Number(pileHeight) || 0);
  const lift = Math.max(0, Number(clearance) || 0);
  return roundFlowCoord(ground + (height / 2) + lift);
}

export function getScaledChildPileLocalY({ equipmentY = 0, terrainHeight = 0, pileHeight = 1, parentScaleY = 1, clearance = 0 } = {}) {
  const scale = Math.max(0.0001, Math.abs(Number(parentScaleY) || 1));
  const worldPileHeight = Math.max(0, Number(pileHeight) || 0) * scale;
  const worldCenterY = getPileCenterY({ terrainHeight, pileHeight: worldPileHeight, clearance });
  return roundFlowCoord((worldCenterY - (Number(equipmentY) || 0)) / scale);
}

export function getLoosePileRestingY({ terrainHeight = 0, pileHeight = 1, clearance = 0.02 } = {}) {
  return getPileCenterY({ terrainHeight, pileHeight, clearance });
}

export function stepGravityParticle({
  position = {},
  velocity = {},
  life = 1,
  decay = 0,
  dt = 0,
  groundY = 0,
  gravity = 22,
  restHeight = 0.2,
  bounce = 0.2,
  friction = 0.6,
} = {}) {
  const safeDt = Math.max(0, Number(dt) || 0);
  const nextVelocity = {
    x: Number(velocity.x) || 0,
    y: (Number(velocity.y) || 0) - Math.max(0, Number(gravity) || 0) * safeDt,
    z: Number(velocity.z) || 0,
  };
  const nextPosition = {
    x: (Number(position.x) || 0) + nextVelocity.x * safeDt,
    y: (Number(position.y) || 0) + nextVelocity.y * safeDt,
    z: (Number(position.z) || 0) + nextVelocity.z * safeDt,
  };
  const ground = (Number.isFinite(Number(groundY)) ? Number(groundY) : 0) + Math.max(0, Number(restHeight) || 0);
  let grounded = false;
  if (nextPosition.y < ground) {
    nextPosition.y = ground;
    nextVelocity.y *= -Math.max(0, Number(bounce) || 0);
    nextVelocity.x *= Math.max(0, Number(friction) || 0);
    nextVelocity.z *= Math.max(0, Number(friction) || 0);
    grounded = true;
  }
  return {
    position: {
      x: roundFlowCoord(nextPosition.x),
      y: roundFlowCoord(nextPosition.y),
      z: roundFlowCoord(nextPosition.z),
    },
    velocity: {
      x: roundFlowCoord(nextVelocity.x),
      y: roundFlowCoord(nextVelocity.y),
      z: roundFlowCoord(nextVelocity.z),
    },
    life: roundFlowCoord((Number(life) || 0) - (Number(decay) || 0) * safeDt),
    grounded,
  };
}

export function getRotatedEquipmentYaw(currentYaw = 0, direction = 1, stepRadians = Math.PI / 12) {
  const yaw = Number.isFinite(Number(currentYaw)) ? Number(currentYaw) : 0;
  const sign = Number(direction) < 0 ? -1 : 1;
  const step = Number.isFinite(Number(stepRadians)) ? Math.abs(Number(stepRadians)) : Math.PI / 12;
  return normalizeAngle(yaw + sign * step);
}

function normalizeAngle(angle) {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
}
