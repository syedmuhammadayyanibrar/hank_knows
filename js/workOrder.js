const MACHINE_DATABASE = [
  {
    id: 'Press-03',
    name: 'Minster 200-Ton Mechanical Press',
    patterns: ['press-03', 'press 03', 'press 3', 'press3', 'minster', 'stamping press', 'press', 'feed roll', 'coil feed']
  },
  {
    id: 'Brake-02',
    name: 'Amada HFE-1003 Hydraulic Press Brake',
    patterns: ['brake-02', 'brake 02', 'brake 2', 'brake2', 'amada', 'press brake', 'brake', 'backgauge', 'flange fold']
  },
  {
    id: 'CNC-08',
    name: 'Haas VF-4 4-Axis Vertical Machining Center',
    patterns: ['cnc-08', 'cnc 08', 'cnc 8', 'cnc8', 'haas vf-4', 'haas vf4', 'haas', 'vertical mill', 'mill cell', 'mill', 'cnc', 'auger', 'spindle']
  },
  {
    id: 'Lathe-01',
    name: 'Mazak Quick Turn 250 CNC Lathe',
    patterns: ['lathe-01', 'lathe 01', 'lathe 1', 'lathe1', 'mazak', 'quick turn', 'turning bay', 'lathe', 'chuck', 'collet']
  },
  {
    id: 'Degreaser-01',
    name: 'Safety-Kleen Heated Parts Washer',
    patterns: ['degreaser-01', 'degreaser 01', 'degreaser 1', 'degreaser', 'safety-kleen', 'washer', 'parts washer', 'solvent tank', 'wash station']
  }
];

export function extractMachine(text, shopData = null) {
  if (typeof text !== 'string') {
    return { id: 'UNASSIGNED', name: 'General / Floor' };
  }

  const clean = text.toLowerCase();

  const machines = (shopData && shopData.machines)
    ? shopData.machines.map(m => ({
        id: m.id,
        name: m.name,
        patterns: [m.id.toLowerCase(), ...(m.aliases || []).map(a => a.toLowerCase())]
      }))
    : MACHINE_DATABASE;

  for (const m of machines) {
    for (const pat of m.patterns) {
      if (clean.includes(pat)) {
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

  const highSignals = [
    'smoke', 'fire', 'spark', 'sparking', 'leak', 'leaking', 'burst', 'blow',
    'hydraulic burst', 'overheat', 'overheating', 'hazard', 'severe', 'jammed at bottom',
    '480v', 'arc flash', 'critical', 'injury', 'blood', 'broken die', 'shattered'
  ];

  for (const signal of highSignals) {
    if (clean.includes(signal)) return 'HIGH';
  }

  const mediumSignals = [
    'jam', 'jamming', 'stick', 'sticking', 'misfeed', 'chatter', 'vibrate',
    'vibration', 'burr', 'burrs', 'rough cut', 'slip', 'slipping', 'slow',
    'tolerance', 'out of spec', 'catching', 'galling', 'drag', 'hesitation'
  ];

  for (const signal of mediumSignals) {
    if (clean.includes(signal)) return 'MEDIUM';
  }

  return 'LOW';
}

export function extractRoute(text, machineId, severity, safetyResult = null) {
  if ((safetyResult && safetyResult.isRefusal) || severity === 'HIGH') {
    if (safetyResult && safetyResult.isRefusal) {
      return 'SAFETY / EHS';
    }
    const clean = typeof text === 'string' ? text.toLowerCase() : '';
    if (clean.includes('electrical') || clean.includes('voltage') || clean.includes('wire') || clean.includes('breaker')) {
      return 'Electrical Maintenance';
    }
    if (clean.includes('hydraulic') || clean.includes('leak') || clean.includes('pressure') || clean.includes('oil')) {
      return 'Hydraulics & Mechanical';
    }
    return 'SAFETY / EHS';
  }

  const clean = typeof text === 'string' ? text.toLowerCase() : '';

  if (machineId === 'Press-03' || clean.includes('coil') || clean.includes('die') || clean.includes('feed') || clean.includes('stamp')) {
    return 'Hank (Tooling & Setup)';
  }

  if (machineId === 'CNC-08' || clean.includes('mill') || clean.includes('spindle') || clean.includes('auger') || clean.includes('coolant')) {
    return 'CNC Specialist';
  }

  if (machineId === 'Brake-02' || clean.includes('brake') || clean.includes('bend') || clean.includes('backgauge') || clean.includes('flange')) {
    return 'Tooling & Forming';
  }

  if (machineId === 'Lathe-01' || clean.includes('lathe') || clean.includes('chuck') || clean.includes('turning')) {
    return 'Turning Specialist';
  }

  if (clean.includes('electrical') || clean.includes('sensor') || clean.includes('wiring') || clean.includes('screen')) {
    return 'Electrical Maintenance';
  }

  return 'General Maintenance';
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
    reportedBy: reportedBy,
    time: formattedTime
  };
}
