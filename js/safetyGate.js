const SAFETY_RULES = [
  {
    id: 'RULE_INTERLOCK_BYPASS',
    category: 'SAFETY_INTERLOCK_DEFEAT',
    title: 'Interlock and Optical Guard Bypassing',
    actionKeywords: ['bypass', 'jump', 'jumper', 'defeat', 'override', 'disable', 'short', 'bridge', 'tape down', 'taping', 'unplug', 'trick', 'mute', 'cut wire', 'ignore'],
    targetKeywords: ['light curtain', 'curtain', 'interlock', 'guard', 'safety switch', 'gate switch', 'door switch', 'e-stop', 'estop', 'emergency stop', 'palm button', 'deadman', 'laser safe', 'lazer safe'],
    refusalMessage: 'Safety violation: Optical light curtains and safety interlocks must never be jumped, bypassed, or muted under any circumstances. Operation halted. Lockout / Tagout protocol mandatory. Notifying EHS Safety Lead immediately.'
  },
  {
    id: 'RULE_ELECTRICAL_LOTO',
    category: 'ELECTRICAL_ARC_FLASH',
    title: 'Live High-Voltage Servicing without LOTO',
    actionKeywords: ['live', 'hot', 'without loto', 'skip lockout', 'skip loto', 'energized', 'touch wire', 'open cabinet', 'wire live'],
    targetKeywords: ['480v', 'three phase', 'high voltage', 'breaker panel', 'disconnect cabinet', 'transformer', 'bus bar', 'main feeder', 'enclosure'],
    refusalMessage: 'Electrical hazard: 480V enclosures require zero-energy LOTO verification, NFPA 70E PPE, and a certified industrial electrician. Unqualified personnel are strictly prohibited from servicing energized electrical enclosures.'
  },
  {
    id: 'RULE_PINCH_POINT_DIE',
    category: 'MECHANICAL_PINCH_POINT',
    title: 'Hands in Operating Die Cavity or Ram Path',
    actionKeywords: ['reach in', 'hand in', 'finger', 'hands inside', 'reach inside', 'grab part while', 'clear with hand', 'under ram', 'between jaws', 'while stroking', 'while running', 'moving ram'],
    targetKeywords: ['die', 'die cavity', 'ram', 'tooling', 'flywheel', 'punch', 'shear blade', 'pinch point'],
    refusalMessage: 'Severe pinch-point hazard: Never place hands or body parts inside the die space or stroke path while the flywheel is engaged or machine is energized. De-energize press and use approved aluminum extraction tongs.'
  },
  {
    id: 'RULE_PRESSURE_RELIEF',
    category: 'HYDRAULIC_BURST_HAZARD',
    title: 'Tampering with Hydraulic Relief Valves',
    actionKeywords: ['tamper', 'override', 'crank down', 'shim', 'force valve', 'tighten down', 'exceed tonnage', 'exceed rated pressure'],
    targetKeywords: ['relief valve', 'pressure valve', 'hydraulic valve', 'accumulator', 'manifold', 'tonnage limit'],
    refusalMessage: 'Overpressure hazard: Tampering with hydraulic or pneumatic relief valves creates catastrophic burst risk. All pressure adjustments must be performed by certified fluid power technicians.'
  },
  {
    id: 'RULE_TOXIC_CHEMISTRY',
    category: 'HAZARDOUS_VAPOR_CHEMICAL',
    title: 'Unventilated Solvent Heating or Chemical Discharge',
    actionKeywords: ['heat solvent', 'boil solvent', 'no respirator', 'turn off exhaust', 'no ventilation', 'dump drain', 'mix solvent with bleach'],
    targetKeywords: ['degreaser', 'solvent', 'trichloroethylene', 'acid', 'wash tank', 'vapor tank'],
    refusalMessage: 'Chemical hazard: Vapor degreaser chemistry requires continuous active exhaust ventilation and rated chemical-resistant PPE. Heating solvents or discharging chemicals without exhaust verification is strictly prohibited.'
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

  const clean = text.toLowerCase();

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

  const directCriticalPhrases = [
    'bypass light curtain',
    'bypass the light curtain',
    'jump light curtain',
    'jump the light curtain',
    'bypass interlock',
    'bypass safety',
    'disable curtain',
    'jump terminal 4',
    'defeat interlock',
    'work live on 480v',
    'reach inside die while running'
  ];

  for (const phrase of directCriticalPhrases) {
    if (clean.includes(phrase)) {
      return {
        isRefusal: true,
        severity: 'HIGH',
        category: 'SAFETY_INTERLOCK_DEFEAT',
        reason: 'Direct Safety Defeat Attempt',
        refusalMessage: 'Safety violation: Optical light curtains and safety interlocks must never be jumped, bypassed, or muted under any circumstances. Operation halted. Lockout / Tagout protocol mandatory. Notifying EHS Safety Lead immediately.',
        ruleId: 'RULE_INTERLOCK_BYPASS'
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
