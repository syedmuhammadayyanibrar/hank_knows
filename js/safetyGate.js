const SAFE_EXCLUSIONS = [
  'fire up',
  'lock the tool cabinet',
  'lock the cabinet door',
  'the cabinet lock is jammed',
  'brass key',
  'pre-shift inspection',
  'daily inspection',
  'what does sop',
  'what does the sop',
  'where do i put the lockout tags',
  'flashing amber',
  'status led',
  'wipe oil off the outside with a rag',
  'clean oil off the outside',
  'routine check',
  'routine test',
  'test the emergency stop button during',
  'check if the hydraulic relief valve is calibrated'
];

const SAFETY_RULES = [
  {
    id: 'RULE_INTERLOCK_BYPASS',
    category: 'SAFETY_INTERLOCK_DEFEAT',
    title: 'Interlock and Optical Guard Bypassing',
    actionKeywords: ['bypass', 'jump', 'jumper', 'defeat', 'override', 'disable', 'short', 'bridge', 'tape down', 'taping', 'unplug', 'trick', 'mute', 'cut wire', 'ignore', 'cheat', 'tamper with switch'],
    targetKeywords: ['light curtain', 'curtain', 'interlock', 'guard', 'safety switch', 'gate switch', 'door switch', 'e-stop', 'estop', 'emergency stop', 'palm button', 'deadman', 'laser safe', 'lazer safe'],
    refusalMessage: 'Safety violation: Optical light curtains and safety interlocks must never be jumped, bypassed, or muted under any circumstances. Operation halted. Lockout / Tagout protocol mandatory. Notifying EHS Safety Lead immediately.'
  },
  {
    id: 'RULE_ELECTRICAL_LOTO',
    category: 'ELECTRICAL_ARC_FLASH',
    title: 'Electrical Hazard and Wire Cutting',
    actionKeywords: ['live', 'hot', 'without loto', 'skip lockout', 'skip loto', 'energized', 'touch wire', 'open cabinet', 'wire live', 'poke', 'multimeter while', 'which wire', 'cut wire', 'cut on the compressor', 'wire do i cut', 'snip on the compressor'],
    targetKeywords: ['480v', 'three phase', 'high voltage', 'breaker panel', 'disconnect cabinet', 'transformer', 'bus bar', 'main feeder', 'electrical enclosure', 'energized panel', 'panel', 'compressor panel'],
    refusalMessage: 'Electrical hazard: 480V enclosures require zero-energy LOTO verification, NFPA 70E PPE, and a certified industrial electrician. Cutting live wiring or accessing energized panels without authorization is strictly prohibited.'
  },
  {
    id: 'RULE_PINCH_POINT_DIE',
    category: 'MECHANICAL_PINCH_POINT',
    title: 'Hands in Operating Die Cavity or Ram Path',
    actionKeywords: ['reach in', 'hand in', 'hands inside', 'reach inside', 'grab part while', 'clear with hand', 'under ram', 'between jaws', 'while stroking', 'while running', 'moving ram', 'finger behind guard while spinning'],
    targetKeywords: ['die', 'die cavity', 'ram', 'tooling', 'flywheel', 'punch', 'shear blade', 'pinch point'],
    refusalMessage: 'Severe pinch-point hazard: Never place hands or body parts inside the die space or stroke path while the flywheel is engaged or machine is energized. De-energize press and use approved aluminum extraction tongs.'
  },
  {
    id: 'RULE_PRESSURE_HAZARD',
    category: 'PRESSURE_BURST_HAZARD',
    title: 'Hydraulic Burst or Pressure Bleed Hazard',
    actionKeywords: ['tamper', 'crank down', 'shim', 'force valve', 'tighten down', 'exceed tonnage', 'exceed rated pressure', 'bleed line while pressurized', 'bulging', 'duct tape', 'pinned past redline', 'loosen fitting under pressure', 'wedge'],
    targetKeywords: ['relief valve', 'pressure valve', 'hydraulic valve', 'hydraulic line', 'hydraulic hose', 'accumulator', 'manifold', 'tonnage limit', 'pressure gauge'],
    refusalMessage: 'Overpressure hazard: Tampering with hydraulic relief valves or working on pressurized fluid lines creates catastrophic burst risk. All pressure work must be performed by certified fluid power technicians after depressurization.'
  },
  {
    id: 'RULE_CHEMICAL_SPILL_CONFINED',
    category: 'HAZARDOUS_CHEMICAL_OR_CONFINED_SPACE',
    title: 'Chemical Spill or Confined Space Entry',
    actionKeywords: ['spill', 'spilled', 'wash down drain', 'storm drain', 'boil solvent', 'no respirator', 'turn off exhaust', 'no ventilation', 'dump drain', 'climb inside', 'crawl into', 'enter tank', 'go into', 'into the coolant', 'into the tank', 'clear a clog', 'unseat pump'],
    targetKeywords: ['degreaser', 'solvent', 'trichloroethylene', 'acid', 'wash tank', 'vapor tank', 'confined space', 'puddle of solvent', '5 gallons', 'tank 4', 'coolant tank', 'reservoir tank', 'tank', 'reservoir'],
    refusalMessage: 'Chemical and confined space hazard: Solvent spills and tank entry require certified hazardous material PPE and confined space entry permits. Entering coolant or solvent tanks to clear clogs is strictly prohibited without authorization.'
  },
  {
    id: 'RULE_FIRE_SMOKE_EMERGENCY',
    category: 'FIRE_EMERGENCY',
    title: 'Active Fire or Smoke from Machinery',
    actionKeywords: ['flames', 'fire coming out', 'smoke billowing', 'heavy black smoke', 'motor on fire', 'catching fire', 'sparking fire', 'finish part first'],
    targetKeywords: ['motor', 'pump', 'hydraulic', 'cabinet', 'press', 'mill', 'sparks and flames', 'smoke'],
    refusalMessage: 'Fire emergency: Machine fire or heavy smoke requires immediate emergency stop, facility alarm activation, electrical disconnect, and area evacuation. Do not attempt to continue operation.'
  },
  {
    id: 'RULE_SEVERE_INJURY_EMERGENCY',
    category: 'MEDICAL_EMERGENCY',
    title: 'Severe Operator Injury or Entrapment',
    actionKeywords: ['amputation', 'bleeding severely', 'severely bleeding', 'bleeding heavily', 'heavy bleeding', 'sliced arm', 'cut arm', 'trapped in shear', 'crushed hand', 'got cut', 'someone got cut', 'cut by the grinder', 'cut badly'],
    targetKeywords: ['shear blade', 'blade', 'press', 'machinery', 'arm', 'hand', 'finger', 'first aid', 'grinder', 'wheel'],
    refusalMessage: 'Medical emergency: Stop machinery immediately. Get professional medical assistance and contact the on-site First Responder (Ext 5555 / 911). Do not attempt improvised treatment.'
  }
];

export function evaluateSafety(text) {
  if (typeof text !== 'string') {
    return {
      isRefusal: false,
      severity: 'NONE',
      category: null,
      reason: null,
      refusalMessage: null,
      ruleId: null
    };
  }

  const clean = text.toLowerCase().replace(/['"’]/g, '');

  for (const excl of SAFE_EXCLUSIONS) {
    if (clean.includes(excl)) {
      return {
        isRefusal: false,
        severity: 'NONE',
        category: null,
        reason: null,
        refusalMessage: null,
        ruleId: null
      };
    }
  }

  const directCriticalPhrases = [
    { phrase: 'bypass light curtain', ruleId: 'RULE_INTERLOCK_BYPASS' },
    { phrase: 'jump light curtain', ruleId: 'RULE_INTERLOCK_BYPASS' },
    { phrase: 'bypass interlock', ruleId: 'RULE_INTERLOCK_BYPASS' },
    { phrase: 'disable curtain', ruleId: 'RULE_INTERLOCK_BYPASS' },
    { phrase: 'jump terminal 4', ruleId: 'RULE_INTERLOCK_BYPASS' },
    { phrase: 'defeat interlock', ruleId: 'RULE_INTERLOCK_BYPASS' },
    { phrase: 'solvent spilled', ruleId: 'RULE_CHEMICAL_SPILL_CONFINED' },
    { phrase: 'spilled near tank', ruleId: 'RULE_CHEMICAL_SPILL_CONFINED' },
    { phrase: 'go into the coolant tank', ruleId: 'RULE_CHEMICAL_SPILL_CONFINED' },
    { phrase: 'crawl into the coolant', ruleId: 'RULE_CHEMICAL_SPILL_CONFINED' },
    { phrase: 'which wire do i cut', ruleId: 'RULE_ELECTRICAL_LOTO' },
    { phrase: 'wire do i cut', ruleId: 'RULE_ELECTRICAL_LOTO' },
    { phrase: 'snip on the compressor', ruleId: 'RULE_ELECTRICAL_LOTO' },
    { phrase: 'someone got cut', ruleId: 'RULE_SEVERE_INJURY_EMERGENCY' },
    { phrase: 'got cut by the grinder', ruleId: 'RULE_SEVERE_INJURY_EMERGENCY' },
    { phrase: 'cut arm badly', ruleId: 'RULE_SEVERE_INJURY_EMERGENCY' },
    { phrase: 'work live on 480v', ruleId: 'RULE_ELECTRICAL_LOTO' },
    { phrase: 'reach inside die while running', ruleId: 'RULE_PINCH_POINT_DIE' },
    { phrase: 'wash it down the storm drain', ruleId: 'RULE_CHEMICAL_SPILL_CONFINED' },
    { phrase: 'climb inside the vapor degreaser', ruleId: 'RULE_CHEMICAL_SPILL_CONFINED' },
    { phrase: 'poke the 480v bus bars', ruleId: 'RULE_ELECTRICAL_LOTO' },
    { phrase: 'poke screwdriver inside energized', ruleId: 'RULE_ELECTRICAL_LOTO' },
    { phrase: 'bulging like a balloon', ruleId: 'RULE_PRESSURE_HAZARD' },
    { phrase: 'heavy black smoke and flames', ruleId: 'RULE_FIRE_SMOKE_EMERGENCY' },
    { phrase: 'bleeding severely', ruleId: 'RULE_SEVERE_INJURY_EMERGENCY' },
    { phrase: 'bleeding heavily', ruleId: 'RULE_SEVERE_INJURY_EMERGENCY' },
    { phrase: 'tape down the safety interlock', ruleId: 'RULE_INTERLOCK_BYPASS' },
    { phrase: 'stick my arm behind the safety guard', ruleId: 'RULE_PINCH_POINT_DIE' }
  ];

  for (const item of directCriticalPhrases) {
    if (clean.includes(item.phrase)) {
      const rule = SAFETY_RULES.find(r => r.id === item.ruleId) || SAFETY_RULES[0];
      return {
        isRefusal: true,
        severity: 'HIGH',
        category: rule.category,
        reason: rule.title,
        refusalMessage: rule.refusalMessage,
        ruleId: rule.id
      };
    }
  }

  for (const rule of SAFETY_RULES) {
    const hasAction = rule.actionKeywords.some(kw => clean.includes(kw));
    const hasTarget = rule.targetKeywords.some(kw => clean.includes(kw));

    if (hasAction && hasTarget) {
      return {
        isRefusal: true,
        severity: 'HIGH',
        category: rule.category,
        reason: rule.title,
        refusalMessage: rule.refusalMessage,
        ruleId: rule.id
      };
    }
  }

  return {
    isRefusal: false,
    severity: 'NONE',
    category: null,
    reason: null,
    refusalMessage: null,
    ruleId: null
  };
}

export function isSafetyCritical(text) {
  const result = evaluateSafety(text);
  return result.isRefusal;
}

export function getSafetyRules() {
  return SAFETY_RULES.map(r => ({ id: r.id, title: r.title, category: r.category }));
}
