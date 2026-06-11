import {
  getStaffHireCost,
  getStaffRpgStats,
  getTicketLabel,
} from './quarry-staff-core.mjs';

// Used-plant prices scaled for game pacing: a working pit should be able to
// buy its next machine after a few processed shots, not after a few clicks.
const EQUIPMENT_COSTS = {
  dumper: 8500,
  excavator: 12500,
  crusher: 18000,
  screener: 14000,
  loader: 6500,
};

const OPERATOR_TICKET_BY_EQUIPMENT = Object.freeze({
  dumper: 'dumper',
  excavator: 'excavator',
  loader: 'loader',
});

export const SCREENED_PRODUCT_KEYS = ['stockpile10mm', 'stockpile20mm', 'stockpile40mm', 'dust'];
export const CRUSHER_PRODUCT_KEYS = ['crushedStone'];
export const SELLABLE_PRODUCT_KEYS = [...CRUSHER_PRODUCT_KEYS, ...SCREENED_PRODUCT_KEYS];
export const EDGE_PRODUCT_KEYS = ['edgeType1', 'edge10mm', 'edge20mm', 'edge40mm', 'edgeDust'];
export const EDGE_PRODUCT_MAP = {
  crushedStone: 'edgeType1',
  stockpile10mm: 'edge10mm',
  stockpile20mm: 'edge20mm',
  stockpile40mm: 'edge40mm',
  dust: 'edgeDust',
};
export const EDGE_HAUL_THRESHOLD_TONNES = 5;
export const DEFAULT_DUST_STATE = Object.freeze({
  index: 12,
  suppressionLevel: 38,
  lastActivity: 'idle',
});
export const DEFAULT_WATER_STATE = Object.freeze({
  waterTableLevel: -18,
  currentPitDepth: 0,
  lagoonLevel: 42,
  lagoonCapacity: 100,
  pumpStatus: 'idle',
  pumpLocation: null,
  pitWaterTonnes: 0,
  deeperHoleWaterTonnes: 0,
  councilWaterSoldTonnes: 0,
  councilWaterRevenue: 0,
  tractorTask: null,
  tractorDriver: null,
  siltRisk: 18,
});
export const STARTER_QUARRY_EQUIPMENT = Object.freeze(['excavator', 'dumper', 'crusher', 'screener', 'loader']);
export const DIRECT_FEED_STARTER_EQUIPMENT = Object.freeze(['excavator', 'crusher', 'screener']);
export const STARTER_QUARRY_DEFAULTS = Object.freeze({
  loanAmount: 25000,
  blastTonnes: 1800,
  haulCycles: 3,
  payloadTonnes: 45,
});
export const DIRECT_FEED_STARTER_DEFAULTS = Object.freeze({
  loanAmount: 25000,
  blastTonnes: 1800,
  feedCycles: 3,
  payloadTonnes: 25,
});

// One real quarry economy: blasting and running plant costs money, finished
// aggregate sold from the edge stockpiles earns it, and the bank charges for
// every hour you sit on borrowed cash. Prices are £/t in UK aggregate range.
const DEFAULT_ECONOMY = {
  pricePerTonneCrushed: 5,
  pricePerTonneScreened: 9,
  xpPerTonne: 2,            // XP per tonne SOLD at the edge
  xpPerTonneProduced: 0.5,  // small XP for tonnes through the plant
  screenYield: 0.92,        // 92% to product decks
  screenOversizeReturn: 0.05, // 5% oversize recirculated to the crusher feed
  blastCostPerTonne: 1.2,   // drilling + explosives + shotfirer
  fuelCostPerHaulCycle: 9,
  fuelCostPerDirectFeedCycle: 5,
  fuelCostPerEdgeRun: 4,
  machineStandingCostPerHour: 3,
  operatorWagePerHour: 22,
  loanInterestPerHour: 0.001, // 0.1% of balance per game hour
  productPrices: {
    stockpile10mm: 14,
    stockpile20mm: 12,
    stockpile40mm: 9,
    dust: 5,
  },
  edgeProductPrices: {
    edgeType1: 8,
    edge10mm: 16,
    edge20mm: 13.5,
    edge40mm: 10,
    edgeDust: 5,
  },
  // Live market demand multipliers — drift hour by hour, so the best product
  // to haul to the edge changes over a shift.
  demand: {
    edgeType1: 1,
    edge10mm: 1,
    edge20mm: 1,
    edge40mm: 1,
    edgeDust: 1,
  },
};
export const DEMAND_MIN = 0.7;
export const DEMAND_MAX = 1.35;

export function createInitialGameState() {
  return {
    cash: 25000,
    xp: 0,
    level: 1,
    gameHours: 0,
    tonnesToday: 0,
    dailyTarget: 1000,
    blasts: 0,
    haulCycles: 0,
    soldTonnes: 0,
    costs: {
      blasting: 0,
      fuel: 0,
      wages: 0,
      interest: 0,
    },
    loans: {
      balance: 0,
      interestRateApr: 0.085,
    },
    equipment: {
      dumper: 0,
      excavator: 0,
      crusher: 0,
      screener: 0,
      loader: 0,
    },
    material: {
      looseGround: 0,
      blastedRock: 0,
      crusherFeed: 0,
      crushedStone: 0,
      screenedProduct: 0,
      stockpile10mm: 0,
      stockpile20mm: 0,
      stockpile40mm: 0,
      dust: 0,
      rejects: 0,
      edgeType1: 0,
      edge10mm: 0,
      edge20mm: 0,
      edge40mm: 0,
      edgeDust: 0,
    },
    dumperLoad: {
      productKey: null,
      tonnes: 0,
    },
    dumperLoads: {},
    staffAssignments: {},
    facilities: {
      welfareCabin: false,
    },
    dust: { ...DEFAULT_DUST_STATE },
    water: { ...DEFAULT_WATER_STATE },
    quarryFace: {
      totalTonnes: 12000,
      remainingTonnes: 12000,
      blasts: 0,
    },
    economy: cloneEconomy(DEFAULT_ECONOMY),
    objective: 'Mark and fire a blast to create shot rock',
    events: [],
  };
}

export function cloneState(state) {
  return {
    ...state,
    equipment: { ...state.equipment },
    material: { ...state.material },
    costs: { blasting: 0, fuel: 0, wages: 0, interest: 0, ...(state.costs || {}) },
    quarryFace: state.quarryFace ? { ...state.quarryFace } : undefined,
    dumperLoad: state.dumperLoad ? { ...state.dumperLoad } : { productKey: null, tonnes: 0 },
    dumperLoads: cloneDumperLoads(state.dumperLoads),
    staffAssignments: cloneStaffAssignments(state.staffAssignments),
    facilities: { ...(state.facilities || { welfareCabin: false }) },
    dust: { ...DEFAULT_DUST_STATE, ...(state.dust || {}) },
    water: { ...DEFAULT_WATER_STATE, ...(state.water || {}) },
    economy: cloneEconomy(state.economy || DEFAULT_ECONOMY),
    loans: { ...(state.loans || { balance: 0, interestRateApr: 0 }) },
    events: [...(state.events || [])],
  };
}

export function getEquipmentCost(type) {
  if (!(type in EQUIPMENT_COSTS)) throw new Error(`Unknown equipment type: ${type}`);
  return EQUIPMENT_COSTS[type];
}

export function getEquipmentResaleValue(type, { resaleRate = 0.5 } = {}) {
  const cost = getEquipmentCost(type);
  const safeRate = Number.isFinite(Number(resaleRate))
    ? Math.max(0, Math.min(1, Number(resaleRate)))
    : 0.5;
  return roundT(cost * safeRate);
}

export function canAffordEquipment(state, type) {
  return state.cash >= getEquipmentCost(type);
}

export function placeEquipmentInState(state, type, { equipmentId = null } = {}) {
  const cost = getEquipmentCost(type);
  if (state.cash < cost) {
    throw new Error(`Not enough cash for ${type}`);
  }

  const next = cloneState(state);
  next.cash = roundT(next.cash - cost);
  next.equipment[type] = (next.equipment[type] || 0) + 1;
  if (equipmentId && getRequiredTicketForEquipment(type)) {
    next.staffAssignments[equipmentId] = {
      equipmentId,
      equipmentType: type,
      workerName: null,
      stats: null,
    };
  }
  next.events.push({ type: 'equipment_placed', equipmentType: type, equipmentId, cost });
  return withObjectiveProgress(next);
}

export function getRequiredTicketForEquipment(type) {
  return OPERATOR_TICKET_BY_EQUIPMENT[type] || null;
}

export function getEquipmentOperatorStatus(state, { equipmentId, equipmentType }) {
  const requiredTicket = getRequiredTicketForEquipment(equipmentType);
  const assignment = equipmentId ? state.staffAssignments?.[equipmentId] : null;
  return {
    needsOperator: Boolean(requiredTicket),
    assigned: Boolean(requiredTicket && assignment?.workerName),
    equipmentId: equipmentId || null,
    equipmentType,
    requiredTicket,
    workerName: assignment?.workerName || null,
    nextAction: requiredTicket && !assignment?.workerName
      ? `Hire an ${getTicketLabel(requiredTicket)} ticket holder from the roster`
      : null,
  };
}

export function assignStaffToEquipment(state, { equipmentId, equipmentType, worker }) {
  if (!equipmentId) throw new Error('Equipment id is required');
  if (!worker) throw new Error('Worker is required');
  const requiredTicket = getRequiredTicketForEquipment(equipmentType);
  if (!requiredTicket) throw new Error(`${equipmentType} does not need a roster operator`);
  const tickets = Array.isArray(worker.tickets) ? worker.tickets : [];
  if (!tickets.includes(requiredTicket)) {
    throw new Error(`${worker.name || 'Worker'} needs an ${getTicketLabel(requiredTicket)} ticket`);
  }
  const hireCost = getStaffHireCost(worker);
  if ((state.cash || 0) < hireCost) throw new Error(`Not enough cash to hire ${worker.name}`);

  const next = cloneState(state);
  const staffAssignments = next.staffAssignments || {};
  const alreadyAssigned = Object.entries(staffAssignments).find(([id, assignment]) => (
    id !== equipmentId && assignment?.workerName === worker.name
  ));
  if (alreadyAssigned) throw new Error(`${worker.name} is already assigned to another machine`);

  next.cash = roundT(next.cash - hireCost);
  next.staffAssignments[equipmentId] = {
    equipmentId,
    equipmentType,
    workerName: worker.name,
    hireCost,
    assignedAt: Date.now(),
    stats: getStaffRpgStats(worker, {
      machineComfort: getMachineComfort(equipmentType),
      hasCabin: Boolean(next.facilities?.welfareCabin),
    }),
  };
  next.events.push({ type: 'staff_assigned', equipmentId, equipmentType, workerName: worker.name, hireCost });
  return withObjectiveProgress(next);
}

function getMachineComfort(equipmentType) {
  if (equipmentType === 'loader') return 0.65;
  if (equipmentType === 'excavator') return 0.55;
  if (equipmentType === 'dumper') return 0.45;
  return 0;
}

export function sellEquipmentInState(state, type, options = {}) {
  if (!(type in EQUIPMENT_COSTS)) throw new Error(`Unknown equipment type: ${type}`);
  const owned = Number(state.equipment?.[type]) || 0;
  if (owned <= 0) throw new Error(`No ${type} available to sell`);

  const resaleValue = getEquipmentResaleValue(type, options);
  const next = cloneState(state);
  next.cash = roundT(next.cash + resaleValue);
  next.equipment[type] = Math.max(0, (next.equipment[type] || 0) - 1);
  if (options.equipmentId && next.staffAssignments) delete next.staffAssignments[options.equipmentId];
  next.events.push({ type: 'equipment_sold', equipmentType: type, equipmentId: options.equipmentId || null, resaleValue });
  return withObjectiveProgress(next);
}

export function getBlastCost(state, tonnes) {
  const rate = state?.economy?.blastCostPerTonne ?? DEFAULT_ECONOMY.blastCostPerTonne;
  return roundT(Math.max(0, Number(tonnes) || 0) * rate);
}

function applyBlastCostInPlace(state, tonnes) {
  const cost = getBlastCost(state, tonnes);
  if (cost <= 0) return 0;
  // Overdraft allowed so a skint player can always shoot rock and trade out
  // of trouble — the interest charge makes it expensive, not impossible.
  state.cash = roundT(state.cash - cost);
  state.costs.blasting = roundT((state.costs.blasting || 0) + cost);
  return cost;
}

export function recordBlast(state, tonnes = 500) {
  const next = cloneState(state);
  const cost = applyBlastCostInPlace(next, tonnes);
  next.material.looseGround = roundT((next.material.looseGround || 0) + tonnes);
  next.material.blastedRock = roundT(next.material.blastedRock + tonnes);
  applyDustActivityInPlace(next, { blastTonnes: tonnes });
  next.blasts += 1;
  next.events.push({ type: 'blast_fired', tonnes, cost });
  return withObjectiveProgress(next);
}

export function recordQuarryFaceBlast(state, { tonnes = 1800 } = {}) {
  const next = cloneState(state);
  const face = next.quarryFace || { totalTonnes: tonnes, remainingTonnes: tonnes, blasts: 0 };
  const produced = roundT(Math.max(0, Math.min(tonnes, face.remainingTonnes || 0)));

  next.quarryFace = {
    ...face,
    remainingTonnes: roundT(Math.max(0, (face.remainingTonnes || 0) - produced)),
    blasts: (face.blasts || 0) + (produced > 0 ? 1 : 0),
  };

  if (produced <= 0) {
    next.events.push({ type: 'quarry_face_depleted', tonnes: 0 });
    return withObjectiveProgress(next);
  }

  const cost = applyBlastCostInPlace(next, produced);
  next.material.looseGround = roundT((next.material.looseGround || 0) + produced);
  next.material.blastedRock = roundT((next.material.blastedRock || 0) + produced);
  applyDustActivityInPlace(next, { blastTonnes: produced });
  next.blasts += 1;
  next.events.push({ type: 'quarry_face_blasted', tonnes: produced, cost, remainingTonnes: next.quarryFace.remainingTonnes });
  return withObjectiveProgress(next);
}

export function hasLoadingChain(state) {
  return state.equipment.excavator > 0 && state.equipment.dumper > 0 && state.equipment.crusher > 0;
}

export function hasExcavatorCrusherChain(state) {
  return state.equipment.excavator > 0 && state.equipment.crusher > 0;
}

export function getThroughputPerMinute(state) {
  if (!hasExcavatorCrusherChain(state)) return 0;
  const loadingRate = state.equipment.excavator * 35;
  const haulRate = state.equipment.dumper > 0 ? state.equipment.dumper * 45 : loadingRate;
  const crushingRate = state.equipment.crusher * 80;
  return Math.min(loadingRate, haulRate, crushingRate);
}

export function completeHaulCycle(state, { payloadTonnes = 45 } = {}) {
  if (!hasLoadingChain(state)) return cloneState(state);
  const availableLoose = state.material.looseGround ?? state.material.blastedRock;
  if (availableLoose <= 0) return cloneState(state);

  const next = cloneState(state);
  const moved = roundT(Math.min(payloadTonnes, next.material.looseGround ?? next.material.blastedRock));
  next.material.looseGround = roundT(Math.max(0, (next.material.looseGround ?? next.material.blastedRock) - moved));
  next.material.blastedRock = roundT(Math.max(0, (next.material.blastedRock || 0) - moved));
  next.material.crusherFeed = roundT(next.material.crusherFeed + moved);

  // Real quarry flow for the game: face → excavator/dumper → crusher → screener → product bays.
  const crushed = next.material.crusherFeed;
  next.material.crusherFeed = 0;
  const { sellableTonnes } = processCrusherOutput(next, crushed);
  applyFuelCostInPlace(next, next.economy.fuelCostPerHaulCycle);
  applyDustActivityInPlace(next, { haulLoads: 1, crusherTonnes: moved, screenerTonnes: sellableTonnes });

  next.tonnesToday = roundT(next.tonnesToday + sellableTonnes);
  next.xp = roundT(next.xp + sellableTonnes * (next.economy.xpPerTonneProduced ?? 0.5));
  next.haulCycles += 1;
  next.events.push({ type: 'haul_cycle_complete', payloadTonnes: moved, sellableTonnes });

  return withObjectiveProgress(next);
}

export function completeExcavatorCrusherCycle(state, { payloadTonnes = 25 } = {}) {
  if (!hasExcavatorCrusherChain(state)) return cloneState(state);
  const availableLoose = state.material.looseGround ?? state.material.blastedRock;
  if (availableLoose <= 0) return cloneState(state);

  const next = cloneState(state);
  const moved = roundT(Math.min(payloadTonnes, next.material.looseGround ?? next.material.blastedRock));
  next.material.looseGround = roundT(Math.max(0, (next.material.looseGround ?? next.material.blastedRock) - moved));
  next.material.blastedRock = roundT(Math.max(0, (next.material.blastedRock || 0) - moved));

  // Crush the fresh dig plus any oversize recirculated from the screen.
  const crushed = roundT(moved + (next.material.crusherFeed || 0));
  next.material.crusherFeed = 0;
  const { sellableTonnes } = processCrusherOutput(next, crushed);
  applyFuelCostInPlace(next, next.economy.fuelCostPerDirectFeedCycle);
  applyDustActivityInPlace(next, { crusherTonnes: moved, screenerTonnes: sellableTonnes });
  next.tonnesToday = roundT(next.tonnesToday + sellableTonnes);
  next.xp = roundT(next.xp + sellableTonnes * (next.economy.xpPerTonneProduced ?? 0.5));
  next.haulCycles += 1;
  next.events.push({ type: 'excavator_crusher_cycle_complete', payloadTonnes: moved, sellableTonnes });

  return withObjectiveProgress(next);
}

export function loadDumperFromScreenedStockpile(state, { productKey = null, payloadTonnes = 25, dumperId = 'default' } = {}) {
  if ((state.equipment.dumper || 0) <= 0) throw new Error('Place a dumper before loading product');
  if (((state.equipment.loader || 0) + (state.equipment.excavator || 0)) <= 0) {
    throw new Error('Place a loader or excavator before loading product');
  }
  const activeDumperId = normaliseDumperId(dumperId);
  if ((getDumperLoad(state, activeDumperId).tonnes || 0) > 0) return cloneState(state);

  // Default to whichever product is fetching the best live price.
  const selectedKey = productKey || getBestMarketProductKey(state) || getBestSellableProductKey(state);
  if (!selectedKey) return cloneState(state);
  const edgeKey = productToEdgeKey(selectedKey);
  if (!edgeKey) throw new Error(`Unknown sellable product: ${selectedKey}`);

  const next = cloneState(state);
  const available = next.material[selectedKey] || 0;
  const loaded = roundT(Math.min(available, payloadTonnes));
  if (loaded <= 0) return next;

  next.material[selectedKey] = roundT(available - loaded);
  setDumperLoad(next, activeDumperId, { productKey: selectedKey, tonnes: loaded });
  applyDustActivityInPlace(next, { haulLoads: 0.35 });
  next.events.push({ type: 'product_loaded_for_edge', productKey: selectedKey, tonnes: loaded, dumperId: activeDumperId });
  return withObjectiveProgress(next);
}

export function tipDumperToEdgeStockpile(state, { dumperId = 'default' } = {}) {
  const activeDumperId = normaliseDumperId(dumperId);
  const load = getDumperLoad(state, activeDumperId);
  if (!load.productKey || load.tonnes <= 0) return cloneState(state);
  const edgeKey = productToEdgeKey(load.productKey);
  if (!edgeKey) throw new Error(`Unknown screened product: ${load.productKey}`);

  const next = cloneState(state);
  const tipped = roundT(load.tonnes);
  const pricePerTonne = getMarketPrice(next, edgeKey);
  const revenue = roundT(tipped * pricePerTonne);
  next.material[edgeKey] = roundT((next.material[edgeKey] || 0) + tipped);
  next.cash = roundT(next.cash + revenue);
  next.soldTonnes = roundT((next.soldTonnes || 0) + tipped);
  next.xp = roundT(next.xp + tipped * next.economy.xpPerTonne);
  applyFuelCostInPlace(next, next.economy.fuelCostPerEdgeRun);
  applyDustActivityInPlace(next, { haulLoads: 1 });
  setDumperLoad(next, activeDumperId, { productKey: null, tonnes: 0 });
  next.events.push({
    type: 'edge_stockpile_tipped',
    productKey: load.productKey,
    edgeKey,
    tonnes: tipped,
    pricePerTonne,
    revenue,
    dumperId: activeDumperId,
  });
  return withObjectiveProgress(next);
}

/** Live sale price: base £/t scaled by the drifting demand multiplier. */
export function getMarketPrice(state, edgeKey) {
  const prices = state.economy?.edgeProductPrices || DEFAULT_ECONOMY.edgeProductPrices;
  const demand = state.economy?.demand?.[edgeKey] ?? 1;
  return Math.round((prices[edgeKey] || 0) * demand * 100) / 100;
}

/** The edge product fetching the best live £/t among materials we hold. */
export function getBestMarketProductKey(state) {
  let bestKey = null;
  let bestPrice = -Infinity;
  for (const key of SELLABLE_PRODUCT_KEYS) {
    if ((state.material[key] || 0) <= 0) continue;
    const price = getMarketPrice(state, productToEdgeKey(key));
    if (price > bestPrice) {
      bestPrice = price;
      bestKey = key;
    }
  }
  return bestKey;
}

export function completeEdgeHaulCycle(state, { productKey = null, payloadTonnes = 25, dumperId = 'default' } = {}) {
  const activeDumperId = normaliseDumperId(dumperId);
  const currentLoad = getDumperLoad(state, activeDumperId);
  const loadedState = currentLoad.tonnes > 0
    ? cloneState(state)
    : loadDumperFromScreenedStockpile(state, { productKey, payloadTonnes, dumperId: activeDumperId });
  const loaded = getDumperLoad(loadedState, activeDumperId);
  if (!loaded.productKey || loaded.tonnes <= 0) return loadedState;
  return tipDumperToEdgeStockpile(loadedState, { dumperId: activeDumperId });
}

export function completePlantFeedCycle(state, { payloadTonnes = 45, directPayloadTonnes = 25 } = {}) {
  const availableLoose = state.material?.looseGround ?? state.material?.blastedRock ?? 0;
  if (availableLoose <= 0) return cloneState(state);
  if (hasLoadingChain(state)) return completeHaulCycle(state, { payloadTonnes });
  if (hasExcavatorCrusherChain(state)) return completeExcavatorCrusherCycle(state, { payloadTonnes: directPayloadTonnes });
  return cloneState(state);
}

export function buildStarterQuarryState(state = createInitialGameState(), options = {}) {
  const cfg = { ...STARTER_QUARRY_DEFAULTS, ...options };
  let next = cloneState(state);

  for (const equipmentType of STARTER_QUARRY_EQUIPMENT) {
    if ((next.equipment[equipmentType] || 0) > 0) continue;
    const cost = getEquipmentCost(equipmentType);
    while (next.cash < cost) {
      next = takeBankLoan(next, cfg.loanAmount);
    }
    next = placeEquipmentInState(next, equipmentType);
  }

  if ((next.material.looseGround || 0) <= 0 && totalScreenedStockpiles(next) <= 0) {
    next = recordQuarryFaceBlast(next, { tonnes: cfg.blastTonnes });
  }

  for (let i = 0; i < cfg.haulCycles; i += 1) {
    const before = totalScreenedStockpiles(next) + (next.material.crushedStone || 0) + (next.material.looseGround || 0);
    next = completeHaulCycle(next, { payloadTonnes: cfg.payloadTonnes });
    const after = totalScreenedStockpiles(next) + (next.material.crushedStone || 0) + (next.material.looseGround || 0);
    if (after === before) break;
  }

  next.events.push({
    type: 'starter_quarry_ready',
    equipment: STARTER_QUARRY_EQUIPMENT.slice(),
    screenedTonnes: totalScreenedStockpiles(next),
    edgeReady: shouldHaulProductToEdge(next),
  });
  return withObjectiveProgress(next);
}

export function buildDirectFeedStarterState(state = createInitialGameState(), options = {}) {
  const cfg = { ...DIRECT_FEED_STARTER_DEFAULTS, ...options };
  let next = cloneState(state);

  for (const equipmentType of DIRECT_FEED_STARTER_EQUIPMENT) {
    if ((next.equipment[equipmentType] || 0) > 0) continue;
    const cost = getEquipmentCost(equipmentType);
    while (next.cash < cost) {
      next = takeBankLoan(next, cfg.loanAmount);
    }
    next = placeEquipmentInState(next, equipmentType);
  }

  if ((next.material.looseGround || 0) <= 0 && totalScreenedStockpiles(next) <= 0) {
    next = recordQuarryFaceBlast(next, { tonnes: cfg.blastTonnes });
  }

  for (let i = 0; i < cfg.feedCycles; i += 1) {
    const before = totalScreenedStockpiles(next) + (next.material.crushedStone || 0) + (next.material.looseGround || 0);
    next = completeExcavatorCrusherCycle(next, { payloadTonnes: cfg.payloadTonnes });
    const after = totalScreenedStockpiles(next) + (next.material.crushedStone || 0) + (next.material.looseGround || 0);
    if (after === before) break;
  }

  next.events.push({
    type: 'direct_feed_starter_ready',
    equipment: DIRECT_FEED_STARTER_EQUIPMENT.slice(),
    screenedTonnes: totalScreenedStockpiles(next),
    edgeReady: shouldHaulProductToEdge(next),
  });
  return withObjectiveProgress(next);
}

export function getDirectFeedProofEvidence(state, options = {}) {
  const directFeedCycles = (state.events || [])
    .filter(event => event.type === 'excavator_crusher_cycle_complete')
    .length;
  const screenedProduct = totalScreenedStockpiles(state);
  const edgeStockpile = totalEdgeStockpiles(state);
  const urlMode = options.mode ? `?demo=${options.mode}` : '?demo=direct-feed';
  const timestamp = typeof options.now === 'string'
    ? options.now
    : (options.now instanceof Date ? options.now : new Date()).toISOString();
  const checks = [
    { key: 'excavator', label: 'Excavator placed', ready: (state.equipment.excavator || 0) > 0 },
    { key: 'plant', label: 'Crusher and screener placed', ready: (state.equipment.crusher || 0) > 0 && (state.equipment.screener || 0) > 0 },
    { key: 'no-dumper', label: 'No dumper/loader in this proof path', ready: (state.equipment.dumper || 0) === 0 && (state.equipment.loader || 0) === 0 },
    { key: 'direct-cycles', label: 'Direct excavator feed cycles recorded', ready: directFeedCycles > 0 },
    { key: 'screened-product', label: 'Screened product visible from plant', ready: screenedProduct > 0 },
  ];

  return {
    mode: options.mode || 'direct-feed',
    urlMode,
    url: options.url || urlMode,
    label: 'PRIVATE PROOF · DIRECT EXCAVATOR FEED',
    note: 'Internal AHS Control Station proof — excavator feeds crusher/screener directly, no dumper placed.',
    timestamp,
    ready: checks.every(check => check.ready),
    checks,
    equipment: {
      excavator: state.equipment.excavator || 0,
      dumper: state.equipment.dumper || 0,
      loader: state.equipment.loader || 0,
      crusher: state.equipment.crusher || 0,
      screener: state.equipment.screener || 0,
    },
    tonnes: {
      looseGround: roundT(state.material.looseGround || 0),
      screenedProduct,
      edgeStockpile,
      tonnesToday: roundT(state.tonnesToday || 0),
    },
    cycles: {
      directFeed: directFeedCycles,
      dumperHaul: (state.events || []).filter(event => event.type === 'haul_cycle_complete').length,
    },
  };
}

export function getDumperLoad(state, dumperId = 'default') {
  const activeDumperId = normaliseDumperId(dumperId);
  return state.dumperLoads?.[activeDumperId]
    || (activeDumperId === 'default' ? state.dumperLoad : null)
    || { productKey: null, tonnes: 0 };
}

export function totalLoadedDumperProduct(state) {
  const loads = Object.values(state.dumperLoads || {});
  if (loads.length === 0 && state.dumperLoad) loads.push(state.dumperLoad);
  return roundT(loads.reduce((total, load) => {
    if (!load?.productKey || (load.tonnes || 0) <= 0) return total;
    return total + load.tonnes;
  }, 0));
}

export function getBestScreenedProductKey(state) {
  return SCREENED_PRODUCT_KEYS
    .find(key => (state.material[key] || 0) > 0) || null;
}

export function getBestSellableProductKey(state) {
  return SELLABLE_PRODUCT_KEYS
    .find(key => (state.material[key] || 0) > 0) || null;
}

export function productToEdgeKey(productKey) {
  return EDGE_PRODUCT_MAP[productKey] || null;
}

export function shouldHaulProductToEdge(state, { thresholdTonnes = EDGE_HAUL_THRESHOLD_TONNES } = {}) {
  return totalSellableProductStockpiles(state) >= thresholdTonnes;
}

export function getEdgeHaulPlayabilityStatus(state) {
  const screenedTonnes = totalSellableProductStockpiles(state);
  const edgeTonnes = totalEdgeStockpiles(state);
  const loadedTonnes = totalLoadedDumperProduct(state);
  const bestProductKey = getBestSellableProductKey(state);
  const hasDumper = (state.equipment?.dumper || 0) > 0;
  const hasLoader = ((state.equipment?.loader || 0) + (state.equipment?.excavator || 0)) > 0;

  const base = {
    ready: false,
    stage: 'needs-product',
    nextAction: 'Process blasted rock through the crusher to make a local Type 1 pile',
    screenedTonnes,
    edgeTonnes,
    loadedTonnes,
    bestProductKey,
    hasDumper,
    hasLoader,
  };

  if (loadedTonnes > 0) {
    return {
      ...base,
      ready: true,
      stage: 'loaded-for-edge',
      nextAction: 'Watch the dumper drive to the quarry edge and tip into outbound stockpiles',
    };
  }

  if (screenedTonnes <= 0 || !bestProductKey) return base;
  if (!hasDumper) {
    return {
      ...base,
      stage: 'needs-dumper',
      nextAction: 'Place a dumper so crusher product can be hauled to the quarry edge',
    };
  }
  if (!hasLoader) {
    return {
      ...base,
      stage: 'needs-loader',
      nextAction: 'Place a loader or excavator beside the product pile to fill the dumper',
    };
  }

  return {
    ...base,
    ready: true,
    stage: 'ready-to-load',
    nextAction: 'Tap Tip Edge: loader/front shovel fills a dumper from the screener product pile',
  };
}

export function getEdgeHaulEvidence(state, options = {}) {
  const status = getEdgeHaulPlayabilityStatus(state);
  const dumperId = normaliseDumperId(options.dumperId || 'default');
  const selectedLoad = getDumperLoad(state, dumperId);
  const latestTip = [...(state.events || [])].reverse()
    .find(event => event.type === 'edge_stockpile_tipped' && (!options.dumperId || event.dumperId === dumperId));
  const productKey = selectedLoad.productKey || latestTip?.productKey || status.bestProductKey;
  const edgeKey = productToEdgeKey(productKey);
  const loadedTonnes = roundT(selectedLoad.tonnes || status.loadedTonnes || 0);
  const availableProduct = productKey ? roundT(state.material?.[productKey] || 0) : 0;
  const estimatedLoadTonnes = roundT(Math.min(
    Number(options.payloadTonnes) || 25,
    loadedTonnes > 0 ? loadedTonnes : availableProduct
  ));
  const prices = state.economy?.edgeProductPrices || DEFAULT_ECONOMY.edgeProductPrices;
  const estimatedCashValue = edgeKey ? roundT(estimatedLoadTonnes * (prices[edgeKey] || 0)) : 0;
  const lastTipTonnes = roundT(Number(options.lastTipTonnes) || latestTip?.tonnes || 0);
  const requestedPhase = options.phase || status.stage;
  const phaseHeadlines = {
    'needs-product': 'Crusher/screener must make a local product pile first',
    'needs-dumper': 'Dumper needed for edge stockpile haulage',
    'needs-loader': 'Loader/front shovel needed beside screener product pile',
    'ready-to-load': 'Loader/front shovel ready at screener product pile',
    'loaded-for-edge': 'Loaded dumper ready to travel to quarry-edge stockpiles',
    'loading-at-product': 'Loader/front shovel filling dumper at screener product pile',
    'hauling-to-edge': 'Loaded dumper travelling to quarry-edge stockpiles',
    'tipping-at-edge': 'Dumper tipping product into outbound edge pile',
    'tipped-at-edge': 'Dumper tipped product into outbound edge pile',
  };

  return {
    ready: status.ready,
    phase: requestedPhase,
    headline: phaseHeadlines[requestedPhase] || status.nextAction,
    nextAction: status.nextAction,
    productKey,
    edgeKey,
    productLabel: formatProductKey(productKey),
    edgeLabel: formatProductKey(edgeKey),
    screenedTonnes: status.screenedTonnes,
    edgeTonnes: status.edgeTonnes,
    loadedTonnes,
    estimatedLoadTonnes,
    estimatedCashValue,
    lastTipTonnes,
    checks: [
      { key: 'product', label: 'Screened product pile has material', ready: status.screenedTonnes > 0 },
      { key: 'loader', label: 'Loader/front shovel can fill dumper', ready: status.hasLoader },
      { key: 'dumper', label: 'Dumper available for edge run', ready: status.hasDumper },
    ],
  };
}

export function totalEdgeStockpiles(state) {
  return roundT(EDGE_PRODUCT_KEYS.reduce((total, key) => total + (state.material[key] || 0), 0));
}

export function sellStockpileLoad(state, productKey, tonnes = 25) {
  const next = cloneState(state);
  next.events.push({
    type: 'screened_stockpile_sale_blocked',
    productKey,
    tonnes: roundT(Math.max(0, Number(tonnes) || 0)),
    reason: 'edge-stockpile-payment-only',
  });
  return withObjectiveProgress(next);
}

export function takeBankLoan(state, amount) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Loan amount must be positive');
  const next = cloneState(state);
  next.cash = roundT(next.cash + amount);
  next.loans.balance = roundT((next.loans.balance || 0) + amount);
  next.events.push({ type: 'bank_loan', amount });
  return withObjectiveProgress(next);
}

export function repayBankLoan(state, amount = 10000) {
  const next = cloneState(state);
  const repayable = Math.min(
    Math.max(0, Number(amount) || 0),
    Math.max(0, next.loans.balance || 0),
    Math.max(0, next.cash || 0)
  );
  const repaid = roundT(repayable);
  if (repaid <= 0) return next;
  next.cash = roundT(next.cash - repaid);
  next.loans.balance = roundT((next.loans.balance || 0) - repaid);
  next.events.push({ type: 'bank_loan_repaid', amount: repaid, balance: next.loans.balance });
  return withObjectiveProgress(next);
}

/**
 * One game hour of running the site: loan interest, operator wages, plant
 * standing costs, and a random walk on market demand. The 3D layer calls
 * this on a steady tick so time costs money like a real operation.
 */
export function advanceGameHour(state, { random = Math.random } = {}) {
  const next = cloneState(state);
  const economy = next.economy;
  next.gameHours = (next.gameHours || 0) + 1;

  const interest = roundT((next.loans.balance || 0) * (economy.loanInterestPerHour ?? 0.001));
  const operators = Object.values(next.staffAssignments || {})
    .filter(assignment => assignment?.workerName).length;
  const wages = roundT(operators * (economy.operatorWagePerHour ?? 22));
  const machineCount = Object.values(next.equipment || {})
    .reduce((total, count) => total + (Number(count) || 0), 0);
  const standing = roundT(machineCount * (economy.machineStandingCostPerHour ?? 3));

  const totalCost = roundT(interest + wages + standing);
  if (totalCost > 0) {
    next.cash = roundT(next.cash - totalCost);
    next.costs.interest = roundT((next.costs.interest || 0) + interest);
    next.costs.wages = roundT((next.costs.wages || 0) + wages);
    next.costs.fuel = roundT((next.costs.fuel || 0) + standing);
  }

  // Demand drifts a few percent per hour, bounded so no product becomes
  // worthless or absurdly lucrative.
  const moves = {};
  for (const key of EDGE_PRODUCT_KEYS) {
    const current = economy.demand[key] ?? 1;
    const drifted = current + (random() - 0.5) * 0.12;
    economy.demand[key] = Math.round(clampRange(drifted, DEMAND_MIN, DEMAND_MAX) * 1000) / 1000;
    moves[key] = roundT(economy.demand[key] - current);
  }

  next.events.push({
    type: 'game_hour_elapsed',
    gameHours: next.gameHours,
    interest,
    wages,
    standing,
    totalCost,
    demand: { ...economy.demand },
    demandMoves: moves,
  });
  return withObjectiveProgress(next);
}

function clampRange(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function getObjective(state) {
  if (state.blasts === 0 && state.material.blastedRock === 0) return 'Mark and fire a blast to create shot rock';
  if (state.equipment.excavator === 0) return 'Place an excavator by the blasted rock';
  if (state.equipment.crusher === 0) return 'Place a crusher close enough for the excavator to feed the hopper';
  if (state.equipment.dumper === 0 && state.material.crushedStone === 0 && state.material.screenedProduct === 0) {
    return 'Keep the excavator close to blasted rock and the crusher hopper';
  }
  if (state.equipment.screener === 0) return 'Add a screener to split crusher output into 10mm, 20mm, 40mm and dust stockpiles';
  if (shouldHaulProductToEdge(state) && totalLoadedDumperProduct(state) <= 0) return 'Load screened product into a dumper for the edge stockpiles';
  if (totalLoadedDumperProduct(state) > 0) return 'Drive the loaded dumper to the quarry edge and tip into outbound stockpiles';
  if (state.tonnesToday < state.dailyTarget) return `Produce ${Math.max(0, Math.round(state.dailyTarget - state.tonnesToday)).toLocaleString()}t more before shift end`;
  return 'Daily target hit — expand the plant and improve cycle times';
}

export function withObjectiveProgress(state) {
  const next = cloneState(state);
  next.objective = getObjective(next);
  // Levels are earned mostly by selling: L2 at 400xp (~200t sold), L3 at
  // 1,600xp, L4 at 3,600xp… each level unlocks a deeper bench to blast.
  next.level = Math.max(1, 1 + Math.floor(Math.sqrt(Math.max(0, next.xp) / 400)));
  next.dailyTarget = 600 + next.level * 400;

  // Levelling up unlocks the next bench down, which proves out more reserve.
  const previousLevel = Math.max(1, Number(state.level) || 1);
  if (next.level > previousLevel && next.quarryFace) {
    const provenTonnes = (next.level - previousLevel) * 8000;
    next.quarryFace.totalTonnes = roundT((next.quarryFace.totalTonnes || 0) + provenTonnes);
    next.quarryFace.remainingTonnes = roundT((next.quarryFace.remainingTonnes || 0) + provenTonnes);
    next.events.push({ type: 'bench_unlocked', level: next.level, provenTonnes });
  }
  return next;
}

export function getDustStateAfterActivity(dust = DEFAULT_DUST_STATE, activity = {}) {
  const base = { ...DEFAULT_DUST_STATE, ...(dust || {}) };
  const rise = (Number(activity.blastTonnes) || 0) * 0.006
    + (Number(activity.haulLoads) || 0) * 4.5
    + (Number(activity.crusherTonnes) || 0) * 0.11
    + (Number(activity.screenerTonnes) || 0) * 0.08;
  const dampening = (Number(activity.rainMm) || 0) * 5.5 + (Number(activity.waterPasses) || 0) * 10;
  const index = clamp(roundT((base.index || 0) + rise - dampening), 0, 100);
  const suppressionLevel = clamp(roundT((base.suppressionLevel || 0) + dampening * 1.45 - rise * 0.28), 0, 100);
  return {
    index,
    suppressionLevel,
    lastActivity: activity.lastActivity || describeDustActivity(activity),
  };
}

export function applyDustSuppression(state, { passes = 1, waterTonnes = 6, rainMm = 0 } = {}) {
  const next = cloneState(state);
  next.dust = getDustStateAfterActivity(next.dust, {
    waterPasses: Math.max(0, Number(passes) || 0) + Math.max(0, Number(waterTonnes) || 0) / 12,
    rainMm,
    lastActivity: 'suppression',
  });
  next.events.push({ type: 'dust_suppression_pass', passes, waterTonnes, rainMm, dustIndex: next.dust.index });
  return withObjectiveProgress(next);
}

export function getWaterStatus({
  waterTableLevel = DEFAULT_WATER_STATE.waterTableLevel,
  currentPitDepth = DEFAULT_WATER_STATE.currentPitDepth,
  lagoonLevel = DEFAULT_WATER_STATE.lagoonLevel,
  lagoonCapacity = DEFAULT_WATER_STATE.lagoonCapacity,
  pumpStatus = DEFAULT_WATER_STATE.pumpStatus,
  siltRisk = DEFAULT_WATER_STATE.siltRisk,
} = {}) {
  const table = Number(waterTableLevel);
  const pitDepth = Number(currentPitDepth);
  const capacity = Math.max(1, Number(lagoonCapacity) || DEFAULT_WATER_STATE.lagoonCapacity);
  const level = clamp(Number(lagoonLevel) || 0, 0, capacity);
  const clearance = roundT(pitDepth - table);
  const lagoonPercent = Math.round((level / capacity) * 100);
  const risk = clearance <= 0 ? 'breached' : (clearance <= 4 ? 'near' : 'safe');
  return {
    waterTableLevel: roundT(table),
    currentPitDepth: roundT(pitDepth),
    clearance,
    risk,
    warning: risk === 'breached'
      ? 'Bench is below the water table - start pump planning'
      : (risk === 'near' ? 'Bench is close to the water table' : 'Water table clear of current bench'),
    lagoonLevel: roundT(level),
    lagoonCapacity: roundT(capacity),
    lagoonPercent,
    lagoonStatus: lagoonPercent >= 92 ? 'high'
      : (lagoonPercent <= 18 ? 'low' : 'holding'),
    pumpStatus,
    siltRisk: clamp(Math.round(Number(siltRisk) || 0), 0, 100),
  };
}

export function updateWaterState(state, waterUpdate = {}) {
  const next = cloneState(state);
  next.water = { ...DEFAULT_WATER_STATE, ...(next.water || {}), ...waterUpdate };
  const status = getWaterStatus(next.water);
  next.water = { ...next.water, status: status.risk, warning: status.warning };
  next.events.push({ type: 'water_status_updated', risk: status.risk, clearance: status.clearance });
  return withObjectiveProgress(next);
}

export function getWaterIngressForBlast(water = DEFAULT_WATER_STATE, {
  nextPitDepth = water.currentPitDepth,
  blastTonnes = 0,
  ingressTonnesPerMetre = 12,
} = {}) {
  const base = { ...DEFAULT_WATER_STATE, ...(water || {}) };
  const previousDepth = Number(base.currentPitDepth) || 0;
  const targetDepth = Number(nextPitDepth);
  const table = Number(base.waterTableLevel);
  const crossedWaterTable = previousDepth > table && targetDepth <= table;
  const submergedMetres = Math.max(0, table - targetDepth);
  const ingressTonnes = crossedWaterTable || submergedMetres > 0
    ? roundT(Math.max(1, submergedMetres) * ingressTonnesPerMetre + (Number(blastTonnes) || 0) * 0.01)
    : 0;

  return {
    crossedWaterTable,
    nextPitDepth: roundT(targetDepth),
    ingressTonnes: roundT(ingressTonnes),
    pumpRequired: ingressTonnes > 0,
    risk: getWaterStatus({ ...base, currentPitDepth: targetDepth }).risk,
  };
}

export function applyBlastWaterIngress(state, {
  nextPitDepth,
  blastTonnes = 0,
  ingressTonnesPerMetre = 12,
} = {}) {
  const next = cloneState(state);
  const impact = getWaterIngressForBlast(next.water, {
    nextPitDepth,
    blastTonnes,
    ingressTonnesPerMetre,
  });

  next.water.currentPitDepth = impact.nextPitDepth;

  if (impact.ingressTonnes > 0) {
    next.water.pitWaterTonnes = roundT((next.water.pitWaterTonnes || 0) + impact.ingressTonnes);
    next.water.pumpStatus = 'placed-in-water';
    next.water.pumpLocation = 'pit-water';
    next.events.push({
      type: 'water_table_reached',
      currentPitDepth: impact.nextPitDepth,
      waterTableLevel: next.water.waterTableLevel,
      ingressTonnes: impact.ingressTonnes,
      pumpStatus: next.water.pumpStatus,
      pumpLocation: next.water.pumpLocation,
    });
  }

  const status = getWaterStatus(next.water);
  next.water.status = status.risk;
  next.water.warning = status.warning;
  return withObjectiveProgress(next);
}

export function pumpPitWater(state, {
  tonnes = 0,
  destination = 'lagoon',
  pumpId = 'pump-1',
} = {}) {
  const next = cloneState(state);
  const requested = Math.max(0, Number(tonnes) || 0);
  const pumped = roundT(Math.min(requested, next.water.pitWaterTonnes || 0));
  if (pumped <= 0) return next;

  next.water.pitWaterTonnes = roundT((next.water.pitWaterTonnes || 0) - pumped);
  next.water.pumpStatus = 'pumping';
  next.water.pumpLocation = 'pit-water';

  if (destination === 'deeper-hole') {
    next.water.deeperHoleWaterTonnes = roundT((next.water.deeperHoleWaterTonnes || 0) + pumped);
  } else {
    const capacity = Math.max(1, Number(next.water.lagoonCapacity) || DEFAULT_WATER_STATE.lagoonCapacity);
    const current = Math.max(0, Number(next.water.lagoonLevel) || 0);
    const accepted = roundT(Math.min(pumped, Math.max(0, capacity - current)));
    const overflow = roundT(pumped - accepted);
    next.water.lagoonLevel = roundT(current + accepted);
    if (overflow > 0) {
      next.water.deeperHoleWaterTonnes = roundT((next.water.deeperHoleWaterTonnes || 0) + overflow);
    }
  }

  next.events.push({
    type: 'pit_water_pumped',
    pumpId,
    destination,
    tonnes: pumped,
    pitWaterTonnes: next.water.pitWaterTonnes,
    lagoonLevel: next.water.lagoonLevel,
    deeperHoleWaterTonnes: next.water.deeperHoleWaterTonnes,
  });

  return withObjectiveProgress(next);
}

export function dispatchTractorToLagoons(state, {
  driverName = 'Reese Cakes',
  tractorId = 'reese-cakes-tractor',
} = {}) {
  const next = cloneState(state);
  next.water.tractorTask = 'lagoon-run';
  next.water.tractorDriver = driverName;
  next.events.push({
    type: 'tractor_dispatched_to_lagoons',
    tractorId,
    driverName,
    lagoonLevel: next.water.lagoonLevel,
  });
  return withObjectiveProgress(next);
}

export function sellCouncilWater(state, {
  tonnes = 0,
  pricePerTonne = 1.25,
  council = 'local council',
} = {}) {
  const next = cloneState(state);
  const requested = Math.max(0, Number(tonnes) || 0);
  const sold = roundT(Math.min(requested, next.water.lagoonLevel || 0));
  if (sold <= 0) return next;

  const revenue = roundT(sold * Math.max(0, Number(pricePerTonne) || 0));
  next.water.lagoonLevel = roundT((next.water.lagoonLevel || 0) - sold);
  next.water.councilWaterSoldTonnes = roundT((next.water.councilWaterSoldTonnes || 0) + sold);
  next.water.councilWaterRevenue = roundT((next.water.councilWaterRevenue || 0) + revenue);
  next.cash = roundT((next.cash || 0) + revenue);

  next.events.push({
    type: 'council_water_sold',
    council,
    tonnes: sold,
    pricePerTonne,
    revenue,
  });

  return withObjectiveProgress(next);
}

export function getOperationsSnapshot(state, options = {}) {
  const snapshotState = withObjectiveProgress(state || createInitialGameState());
  const material = snapshotState.material || {};
  const events = snapshotState.events || [];
  const waterStatus = getWaterStatus(snapshotState.water);
  const revenue = roundT(events.reduce((total, event) => {
    if (event.type !== 'edge_stockpile_tipped') return total;
    if (Number.isFinite(Number(event.revenue))) return total + Number(event.revenue);
    const price = snapshotState.economy?.edgeProductPrices?.[event.edgeKey] || 0;
    return total + (Number(event.tonnes) || 0) * price;
  }, 0));
  const councilWaterRevenue = roundT(events.reduce((total, event) => {
    if (event.type !== 'council_water_sold') return total;
    return total + (Number(event.revenue) || 0);
  }, 0));
  const equipmentCounts = { ...(snapshotState.equipment || {}) };
  const activeEquipment = options.activeEquipment || Object.entries(equipmentCounts)
    .flatMap(([type, count]) => Array.from({ length: Number(count) || 0 }, (_, index) => ({
      id: `${type}-${index + 1}`,
      type,
      state: count > 0 ? 'available' : 'idle',
    })));

  return {
    generatedAt: options.generatedAt || null,
    cash: roundT(snapshotState.cash || 0),
    debt: roundT(snapshotState.loans?.balance || 0),
    xp: roundT(snapshotState.xp || 0),
    level: snapshotState.level || 1,
    tonnesToday: roundT(snapshotState.tonnesToday || 0),
    dailyTarget: roundT(snapshotState.dailyTarget || 0),
    material: {
      shotLoose: roundT(Math.max(material.looseGround || 0, material.blastedRock || 0)),
      looseGround: roundT(material.looseGround || 0),
      blastedRock: roundT(material.blastedRock || 0),
      crusherLocalProduct: roundT(material.crushedStone || 0),
      screenerLocalProduct: totalScreenedStockpiles(snapshotState),
      localSellableProduct: totalSellableProductStockpiles(snapshotState),
      edgeStockpiles: totalEdgeStockpiles(snapshotState),
      topStockpiles: totalEdgeStockpiles(snapshotState),
      finalStockpiles: totalEdgeStockpiles(snapshotState),
      loadedDumperProduct: totalLoadedDumperProduct(snapshotState),
      rejects: roundT(material.rejects || 0),
    },
    soldTonnes: roundT(snapshotState.soldTonnes || 0),
    revenue,
    councilWaterRevenue,
    totalRevenue: roundT(revenue + councilWaterRevenue),
    costs: { ...(snapshotState.costs || {}) },
    operatingCosts: roundT(Object.values(snapshotState.costs || {})
      .reduce((total, value) => total + (Number(value) || 0), 0)),
    market: Object.fromEntries(EDGE_PRODUCT_KEYS.map(key => [key, getMarketPrice(snapshotState, key)])),
    gameHours: snapshotState.gameHours || 0,
    quarryFace: { ...(snapshotState.quarryFace || {}) },
    equipmentCounts,
    activeEquipment,
    cycles: {
      blasts: snapshotState.blasts || 0,
      directFeed: events.filter(event => event.type === 'excavator_crusher_cycle_complete').length,
      crusherScreener: events.filter(event => event.type === 'haul_cycle_complete' || event.type === 'excavator_crusher_cycle_complete').length,
      edgeHaulLoads: events.filter(event => event.type === 'edge_stockpile_tipped').length,
      dumperHaul: snapshotState.haulCycles || 0,
    },
    dust: {
      index: roundT(snapshotState.dust?.index ?? DEFAULT_DUST_STATE.index),
      suppressionLevel: roundT(snapshotState.dust?.suppressionLevel ?? DEFAULT_DUST_STATE.suppressionLevel),
      lastActivity: snapshotState.dust?.lastActivity || 'idle',
    },
    water: {
      ...waterStatus,
      pitWaterTonnes: roundT(snapshotState.water?.pitWaterTonnes || 0),
      deeperHoleWaterTonnes: roundT(snapshotState.water?.deeperHoleWaterTonnes || 0),
      councilWaterSoldTonnes: roundT(snapshotState.water?.councilWaterSoldTonnes || 0),
      councilWaterRevenue: roundT(snapshotState.water?.councilWaterRevenue || 0),
      pumpLocation: snapshotState.water?.pumpLocation || null,
      tractorTask: snapshotState.water?.tractorTask || null,
      tractorDriver: snapshotState.water?.tractorDriver || null,
    },
    objective: snapshotState.objective || getObjective(snapshotState),
    recommendedNextAction: getRecommendedNextAction(snapshotState, { waterStatus }),
  };
}

export function totalScreenedStockpiles(state) {
  return roundT(SCREENED_PRODUCT_KEYS.reduce((total, key) => total + (state.material[key] || 0), 0));
}

export function totalSellableProductStockpiles(state) {
  return roundT(SELLABLE_PRODUCT_KEYS.reduce((total, key) => total + (state.material[key] || 0), 0));
}

function cloneEconomy(economy) {
  return {
    ...DEFAULT_ECONOMY,
    ...economy,
    productPrices: { ...(economy.productPrices || DEFAULT_ECONOMY.productPrices) },
    edgeProductPrices: { ...(economy.edgeProductPrices || DEFAULT_ECONOMY.edgeProductPrices) },
    demand: { ...DEFAULT_ECONOMY.demand, ...(economy.demand || {}) },
  };
}

function processCrusherOutput(next, crushed) {
  let sellableTonnes = crushed;
  let rewardRate = next.economy.pricePerTonneCrushed;

  if (next.equipment.screener > 0) {
    // Mass balance like a real plant: most of the feed makes graded product,
    // oversize recirculates to the crusher feed for the next pass, and a
    // small scalpings fraction is genuine waste.
    const yieldRate = next.economy.screenYield ?? 0.92;
    const oversizeRate = next.economy.screenOversizeReturn ?? 0.05;
    const screened = roundT(crushed * yieldRate);
    const oversize = roundT(crushed * oversizeRate);
    const scalpings = roundT(Math.max(0, crushed - screened - oversize));
    // Product split typical of a 3-deck limestone screen.
    const tenMm = roundT(screened * 0.30);
    const twentyMm = roundT(screened * 0.32);
    const fortyMm = roundT(screened * 0.24);
    const dust = roundT(screened - tenMm - twentyMm - fortyMm);

    next.material.screenedProduct = roundT(next.material.screenedProduct + screened);
    next.material.stockpile10mm = roundT(next.material.stockpile10mm + tenMm);
    next.material.stockpile20mm = roundT(next.material.stockpile20mm + twentyMm);
    next.material.stockpile40mm = roundT(next.material.stockpile40mm + fortyMm);
    next.material.dust = roundT(next.material.dust + dust);
    next.material.crusherFeed = roundT((next.material.crusherFeed || 0) + oversize);
    next.material.rejects = roundT(next.material.rejects + scalpings);
    sellableTonnes = screened;
    rewardRate = next.economy.pricePerTonneScreened;
  } else {
    next.material.crushedStone = roundT(next.material.crushedStone + crushed);
  }

  return { sellableTonnes, rewardRate };
}

function applyFuelCostInPlace(state, cost) {
  const fuel = roundT(Math.max(0, Number(cost) || 0));
  if (fuel <= 0) return 0;
  state.cash = roundT(state.cash - fuel);
  state.costs.fuel = roundT((state.costs.fuel || 0) + fuel);
  return fuel;
}

function applyDustActivityInPlace(state, activity) {
  state.dust = getDustStateAfterActivity(state.dust, activity);
}

function describeDustActivity(activity = {}) {
  if ((Number(activity.blastTonnes) || 0) > 0) return 'blast';
  if ((Number(activity.crusherTonnes) || 0) > 0 || (Number(activity.screenerTonnes) || 0) > 0) return 'plant';
  if ((Number(activity.haulLoads) || 0) > 0) return 'haul-road';
  if ((Number(activity.waterPasses) || 0) > 0 || (Number(activity.rainMm) || 0) > 0) return 'suppression';
  return 'idle';
}

function getRecommendedNextAction(state, { waterStatus } = {}) {
  if (waterStatus?.risk === 'breached') return 'Pause deeper bench cuts and plan pumping from the lagoon';
  if (waterStatus?.risk === 'near') return 'Keep the next blast shallow and monitor the lagoon';
  if ((state.dust?.index || 0) >= 70) return 'Send the Bowser along the haul road for dust suppression';
  return getEdgeHaulPlayabilityStatus(state).nextAction || getObjective(state);
}

function cloneDumperLoads(loads = {}) {
  return Object.fromEntries(Object.entries(loads).map(([id, load]) => [
    id,
    { productKey: load?.productKey || null, tonnes: load?.tonnes || 0 },
  ]));
}

function cloneStaffAssignments(assignments = {}) {
  return Object.fromEntries(Object.entries(assignments || {}).map(([id, assignment]) => [
    id,
    {
      ...assignment,
      stats: assignment?.stats ? { ...assignment.stats } : null,
    },
  ]));
}

function setDumperLoad(state, dumperId, load) {
  const activeDumperId = normaliseDumperId(dumperId);
  state.dumperLoads = cloneDumperLoads(state.dumperLoads);
  const previousLoad = state.dumperLoads[activeDumperId] || { productKey: null, tonnes: 0 };
  state.dumperLoads[activeDumperId] = { productKey: load.productKey || null, tonnes: roundT(load.tonnes || 0) };

  // Backwards-compatible alias for existing HUD/objective code and old saved/default state.
  if (activeDumperId === 'default' || (load.tonnes || 0) > 0) {
    state.dumperLoad = { ...state.dumperLoads[activeDumperId] };
  } else if (
    state.dumperLoad?.productKey === previousLoad.productKey
    && (state.dumperLoad?.tonnes || 0) === (previousLoad.tonnes || 0)
  ) {
    state.dumperLoad = getPrimaryLoadedDumperLoad(state);
  }
}

function getPrimaryLoadedDumperLoad(state) {
  const loaded = Object.values(state.dumperLoads || {})
    .find(load => load?.productKey && (load.tonnes || 0) > 0);
  return loaded ? { ...loaded } : { productKey: null, tonnes: 0 };
}

function normaliseDumperId(dumperId) {
  return String(dumperId || 'default');
}

function formatProductKey(productKey) {
  return String(productKey || '')
    .replace('stockpile', '')
    .replace('edge', 'edge ')
    .replace('Dust', ' dust')
    .trim();
}

function roundT(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
