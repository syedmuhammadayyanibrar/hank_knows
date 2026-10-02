const MACHINE_PATTERNS = [
  {
    id: 'Press 4',
    name: 'Minster 200-Ton Mechanical Press 4',
    aliases: ['press 4', 'press-4', 'press4', 'pres 4', 'pres-4', 'pres4', 'press', 'ram', 'la prensa 4', 'prensa 4', 'die change', 'die chnage', 'die is stuck']
  },
  {
    id: 'Lathe 3',
    name: 'Mazak Quick Turn Lathe 3',
    aliases: ['lathe 3', 'lathe-3', 'lathe3', 'lathe', 'chuck', 'mazak']
  },
  {
    id: 'CNC Mill 2',
    name: 'Haas VF-2 CNC Mill 2',
    aliases: ['cnc mill 2', 'cnc mill', 'mill 2', 'cnc 2', 'haas', 'mill', 'cnc', 'coolant tank', 'coolant reservoir', 'coolant']
  },
  {
    id: 'Compressor A',
    name: 'Rotary Screw Air Compressor A',
    aliases: ['compressor a', 'compressor-a', 'compressor', 'air compressor', 'compressor panel']
  },
  {
    id: 'Conveyor B',
    name: 'Chip and Scrap Conveyor B',
    aliases: ['conveyor b', 'conveyor-b', 'conveyor', 'belt']
  },
  {
    id: 'Tank 4',
    name: 'Parts Washer and Vapor Degreaser Tank 4',
    aliases: ['tank 4', 'tank-4', 'tank4', 'degreaser', 'washer', 'parts washer', 'solvent tank', 'solvent']
  },
  {
    id: 'Grinder',
    name: 'Toolroom Pedestal Grinder',
    aliases: ['grinder', 'pedestal grinder', 'bench grinder']
  }
];

export function extractMachine(text, shopData = null) {
  if (typeof text !== 'string') {
    return { id: 'UNASSIGNED', name: 'General / Floor' };
  }

  let clean = text.toLowerCase().replace(/['"’]/g, '');
  clean = clean.replace(/presss+/g, 'press');

  const machines = (shopData && shopData.machines)
    ? shopData.machines.map(m => ({
        id: m.id,
        name: m.name,
        aliases: [m.id.toLowerCase(), ...(m.aliases || []).map(a => a.toLowerCase())]
      }))
    : MACHINE_PATTERNS;

  for (const m of machines) {
    for (const alias of m.aliases) {
      const regex = new RegExp(`(^|[^a-z0-9])${alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
      if (regex.test(clean)) {
        return { id: m.id, name: m.name };
      }
    }
  }

  return { id: 'UNASSIGNED', name: 'General / Floor' };
}

export function extractSeverity(text, safetyResult = null) {
  if (safetyResult && safetyResult.isRefusal) {
    return 'HIGH';
  }

  if (typeof text !== 'string') return 'LOW';
  const clean = text.toLowerCase();

  if (clean.includes('fire up')) {
    return 'LOW';
  }

  const highSignals = [
    'smoke', 'fire', 'flame', 'spark', 'sparking', 'burst', 'blow', 'amputation',
    'severe bleeding', 'bleeding severely', 'bleeding heavily', 'trapped', 'crushed',
    'pinned past redline', 'bulging like a balloon', 'hydraulic burst', '480v',
    'arc flash', 'critical', 'spill', 'spilled', 'wash down drain', 'storm drain',
    'climb inside', 'someone got cut', 'cut arm badly'
  ];

  for (const signal of highSignals) {
    if (clean.includes(signal)) return 'HIGH';
  }

  const mediumSignals = [
    'jam', 'jamming', 'jammed', 'stick', 'sticking', 'misfeed', 'chatter', 'vibrate',
    'vibration', 'burr', 'burrs', 'rough cut', 'slip', 'slipping', 'slow',
    'tolerance', 'out of spec', 'catching', 'galling', 'drag', 'hesitation',
    'leak', 'leaking', 'overheat', 'overheating', 'bind', 'binding', 'grind',
    'grinding', 'loose', 'stuck', 'fault', 'not closing', 'slack'
  ];

  for (const signal of mediumSignals) {
    if (clean.includes(signal)) return 'MEDIUM';
  }

  return 'LOW';
}

export function extractRoute(text, machineId, severity, safetyResult = null) {
  if ((safetyResult && safetyResult.isRefusal) || severity === 'HIGH') {
    return 'SAFETY / EHS';
  }

  const clean = typeof text === 'string' ? text.toLowerCase() : '';

  if (clean.includes('jammed') || clean.includes('lock is jammed')) {
    return 'Mechanical Maintenance';
  }

  const supervisorSignals = [
    'rag', 'towel', 'scrap truck', 'pickup', 'forklift', 'wi-fi', 'wifi',
    'leave early', 'quota', 'shift schedule', 'password', 'lunch', 'break',
    'training', 'drawing', 'print', 'hex key', 'deburring tool', 'who is',
    'where are', 'where do i put the lockout tags', 'where do', 'where is'
  ];

  for (const signal of supervisorSignals) {
    if (clean.includes(signal) && (machineId === 'UNASSIGNED' || clean.includes('where do i put'))) {
      return 'Shift Supervisor';
    }
  }

  if (machineId === 'Press 4' || machineId === 'Press-03' || clean.includes('press') || clean.includes('die') || clean.includes('ram')) {
    return 'Hank (Tooling & Setup)';
  }

  if (machineId === 'CNC Mill 2' || machineId === 'CNC-08' || clean.includes('mill') || clean.includes('cnc')) {
    return 'CNC Specialist';
  }

  if (machineId === 'Lathe 3' || machineId === 'Lathe-01' || clean.includes('lathe') || clean.includes('chuck')) {
    return 'Turning Specialist';
  }

  if (machineId === 'Compressor A' || clean.includes('compressor')) {
    return 'Plant Facilities';
  }

  if (machineId === 'Conveyor B' || clean.includes('conveyor') || clean.includes('belt')) {
    return 'Mechanical Maintenance';
  }

  if (clean.includes('electrical') || clean.includes('wiring') || clean.includes('panel')) {
    return 'Electrical Maintenance';
  }

  return 'General Maintenance';
}

export function normalizeRoute(rawRoute) {
  if (!rawRoute) return 'maintenance';
  const r = rawRoute.toLowerCase();
  if (r.includes('safety') || r.includes('ehs')) return 'safety';
  if (r.includes('supervisor') || r.includes('lead')) return 'supervisor';
  return 'maintenance';
}

export function extractIssue(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    return 'Unspecified shop request';
  }

  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (cleaned.length <= 90) {
    return cleaned;
  }

  const firstSentence = cleaned.split(/[.?!]/)[0];
  if (firstSentence && firstSentence.length <= 90 && firstSentence.length >= 15) {
    return firstSentence.trim();
  }

  return cleaned.slice(0, 87) + '...';
}

export function generateWorkOrder({ query, worker = null, shopData = null, counter = 1, timestamp = null, safetyResult = null }) {
  const machine = extractMachine(query, shopData);
  const severity = extractSeverity(query, safetyResult);
  const route = extractRoute(query, machine.id, severity, safetyResult);
  const issue = extractIssue(query);

  let formattedTime = timestamp;
  if (!formattedTime) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    formattedTime = `${hours}:${minutes}`;
  }

  const woNumber = `WO-${4100 + counter}`;
  const reportedBy = worker ? worker.name : 'Dev';

  return {
    id: woNumber,
    machine: machine.id,
    machineName: machine.name,
    issue: issue,
    severity: severity,
    route: route,
    normalizedSeverity: severity.toLowerCase(),
    normalizedRoute: normalizeRoute(route),
    reportedBy: reportedBy,
    time: formattedTime
  };
}
