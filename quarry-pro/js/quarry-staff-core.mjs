export const STAFF_ROLE_LABELS = Object.freeze({
  'tractor-driver': 'Tractor Driver',
  'maintenance-fitter': 'Maintenance Fitter',
  'general-labourer': 'General Labourer',
  'excavator-operator': 'Excavator Operator',
  'loader-operator': 'Loading Shovel Driver',
  'plant-operator': 'Plant Operator',
  supervisor: 'Supervisor',
  mechanic: 'Mechanic',
  banksman: 'Banksman / Signaller',
  'dumper-driver': 'Dumper Driver',
});

export const STAFF_TICKET_LABELS = Object.freeze({
  dumper: 'Dumper',
  loader: 'Loading Shovel',
  excavator: 'Excavator',
  tractor: 'Tractor',
  maintenance: 'Plant Maintenance',
  greasing: 'Greasing / Yard Duties',
});

export const STAFF_TRAINING_COSTS = Object.freeze({
  greasing: 350,
  tractor: 600,
  dumper: 650,
  maintenance: 850,
  loader: 900,
  excavator: 1100,
});

const TRAINING_HIRE_VALUE_UPLIFT = 0.35;
const DEFAULT_STRESS_LEVEL = 0.55;

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0));

const ticketCertifications = tickets => tickets.map(ticket => getTicketLabel(ticket)).join(', ');

export const STARTER_STAFF_ROSTER = Object.freeze([
  Object.freeze({
    name: 'Aled',
    role: 'excavator-operator',
    tickets: Object.freeze(['excavator']),
    certifications: ticketCertifications(['excavator']),
    hireCost: 1900,
    shift: 'day',
    status: 'off',
    reputationTier: 'solid',
    speed: 0.86,
    reliability: 0.84,
    stressLevel: 0.42,
  }),
  Object.freeze({
    name: 'Alwyn',
    role: 'maintenance-fitter',
    tickets: Object.freeze(['maintenance', 'tractor']),
    certifications: ticketCertifications(['maintenance', 'tractor']),
    hireCost: 1750,
    shift: 'day',
    status: 'off',
    reputationTier: 'solid',
    speed: 0.78,
    reliability: 0.9,
  }),
  Object.freeze({
    name: 'Carl',
    role: 'dumper-driver',
    tickets: Object.freeze(['dumper']),
    certifications: ticketCertifications(['dumper']),
    hireCost: 1200,
    shift: 'day',
    status: 'off',
    reputationTier: 'starter',
    speed: 0.7,
    reliability: 0.76,
  }),
  Object.freeze({
    name: 'Jimmy',
    role: 'general-labourer',
    tickets: Object.freeze(['greasing', 'tractor']),
    certifications: ticketCertifications(['greasing', 'tractor']),
    hireCost: 950,
    shift: 'day',
    status: 'off',
    reputationTier: 'starter',
    speed: 0.66,
    reliability: 0.76,
  }),
  Object.freeze({
    name: 'Mick',
    role: 'loader-operator',
    tickets: Object.freeze(['loader', 'excavator', 'dumper', 'tractor']),
    certifications: ticketCertifications(['loader', 'excavator', 'dumper', 'tractor']),
    hireCost: 2900,
    shift: 'day',
    status: 'off',
    reputationTier: 'experienced',
    speed: 0.88,
    reliability: 0.86,
  }),
  Object.freeze({
    name: 'Piotr',
    role: 'loader-operator',
    tickets: Object.freeze(['loader']),
    certifications: ticketCertifications(['loader']),
    hireCost: 1700,
    shift: 'day',
    status: 'off',
    reputationTier: 'solid',
    speed: 0.82,
    reliability: 0.84,
  }),
  Object.freeze({
    name: 'Reece',
    role: 'tractor-driver',
    tickets: Object.freeze(['tractor']),
    certifications: ticketCertifications(['tractor']),
    hireCost: 1100,
    shift: 'day',
    status: 'off',
    reputationTier: 'starter',
    speed: 0.7,
    reliability: 0.78,
  }),
  Object.freeze({
    name: 'Richie',
    role: 'dumper-driver',
    tickets: Object.freeze(['dumper']),
    certifications: ticketCertifications(['dumper']),
    hireCost: 1150,
    shift: 'day',
    status: 'off',
    reputationTier: 'starter',
    speed: 0.68,
    reliability: 0.74,
  }),
  Object.freeze({
    name: 'Stuart',
    role: 'loader-operator',
    tickets: Object.freeze(['loader']),
    certifications: ticketCertifications(['loader']),
    hireCost: 1650,
    shift: 'day',
    status: 'off',
    reputationTier: 'solid',
    speed: 0.8,
    reliability: 0.82,
  }),
  Object.freeze({
    name: 'Tony',
    role: 'excavator-operator',
    tickets: Object.freeze(['excavator', 'dumper', 'tractor']),
    certifications: ticketCertifications(['excavator', 'dumper', 'tractor']),
    hireCost: 2500,
    shift: 'day',
    status: 'off',
    reputationTier: 'experienced',
    speed: 0.9,
    reliability: 0.88,
  }),
]);

export function getStarterStaffRoster() {
  return STARTER_STAFF_ROSTER.map(worker => ({
    ...worker,
    tickets: [...worker.tickets],
  }));
}

export function getStaffRoleLabel(role) {
  return STAFF_ROLE_LABELS[role] || role || 'Operator';
}

export function getTicketLabel(ticket) {
  return STAFF_TICKET_LABELS[ticket] || ticket || 'Ticket';
}

export function getStaffHireCost(worker) {
  if (!worker) return 0;
  if (Number.isFinite(worker.hireCost)) return worker.hireCost;
  const ticketCount = Array.isArray(worker.tickets) ? worker.tickets.length : 0;
  return 850 + ticketCount * 350;
}

export function getTrainingCostForTicket(worker, ticket) {
  if (!ticket || !STAFF_TICKET_LABELS[ticket]) return 0;
  const tickets = Array.isArray(worker?.tickets) ? worker.tickets : [];
  if (tickets.includes(ticket)) return 0;
  return STAFF_TRAINING_COSTS[ticket] || 750;
}

export function getAvailableTrainingTickets(worker) {
  const tickets = Array.isArray(worker?.tickets) ? worker.tickets : [];
  return Object.keys(STAFF_TICKET_LABELS)
    .filter(ticket => !tickets.includes(ticket))
    .map(ticket => ({
      ticket,
      label: getTicketLabel(ticket),
      cost: getTrainingCostForTicket(worker, ticket),
    }));
}

export function getReliabilitySickDaysPerMonth(worker) {
  const reliability = clamp01(worker?.reliability ?? 0.75);
  return Math.max(0, Math.round((1 - reliability) * 10));
}

export function getStaffRpgStats(worker, { machineComfort = 0, hasCabin = false } = {}) {
  const speed = clamp01(worker?.speed ?? 0.7);
  const reliability = clamp01(worker?.reliability ?? 0.75);
  const baseStress = clamp01(worker?.stressLevel ?? DEFAULT_STRESS_LEVEL);
  const comfortRelief = clamp01(machineComfort) * 0.22;
  const cabinRelief = hasCabin ? 0.15 : 0;
  const stressLevel = Math.max(0.05, roundStat(baseStress - comfortRelief - cabinRelief));
  return {
    speed: roundStat(speed),
    reliability: roundStat(reliability),
    stressLevel,
    expectedSickDaysPerMonth: getReliabilitySickDaysPerMonth({ reliability }),
  };
}

function roundStat(value) {
  return Math.round(value * 100) / 100;
}

export function trainStaffTicket(worker, ticket) {
  if (!worker) throw new Error('Worker is required');
  if (!STAFF_TICKET_LABELS[ticket]) throw new Error('Unknown ticket');
  const tickets = Array.isArray(worker.tickets) ? [...worker.tickets] : [];
  if (tickets.includes(ticket)) {
    throw new Error(`${worker.name || 'Worker'} already has ${getTicketLabel(ticket)} ticket`);
  }
  const cost = getTrainingCostForTicket(worker, ticket);
  const nextTickets = [...tickets, ticket];
  return {
    ...worker,
    tickets: nextTickets,
    certifications: ticketCertifications(nextTickets),
    trainingSpend: (worker.trainingSpend || worker.training_spend || 0) + cost,
    hireCost: Math.round(getStaffHireCost(worker) + cost * TRAINING_HIRE_VALUE_UPLIFT),
  };
}
