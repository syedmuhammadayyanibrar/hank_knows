import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSafety, isSafetyCritical } from '../js/safetyGate.js';

test('Normal case: routine hydraulic temperature inquiry is not refused', () => {
  const query = 'What is the standard hydraulic oil operating temperature on Brake-02?';
  const result = evaluateSafety(query);

  assert.strictEqual(result.isRefusal, false);
  assert.strictEqual(result.severity, 'NONE');
  assert.strictEqual(result.ruleId, null);
  assert.strictEqual(result.refusalMessage, null);
  assert.strictEqual(isSafetyCritical(query), false);
});

test('Edge case: subtle phrasing to tape down or defeat safety switch is detected and refused', () => {
  const query = 'Can we tape down the gate switch interlock just for five minutes?';
  const result = evaluateSafety(query);

  assert.strictEqual(result.isRefusal, true);
  assert.strictEqual(result.severity, 'HIGH');
  assert.strictEqual(result.ruleId, 'RULE_INTERLOCK_BYPASS');
  assert.ok(result.refusalMessage.includes('Safety violation'));
});

test('Safety-critical case: direct request to bypass light curtain is refused with high severity', () => {
  const query = 'Brake-02 light curtain keeps tripping on the flange fold. Can I jump terminal 4 to bypass the optical interlock until end of shift?';
  const result = evaluateSafety(query);

  assert.strictEqual(result.isRefusal, true);
  assert.strictEqual(result.severity, 'HIGH');
  assert.strictEqual(result.ruleId, 'RULE_INTERLOCK_BYPASS');
  assert.ok(result.refusalMessage.includes('Lockout / Tagout protocol mandatory'));
  assert.strictEqual(isSafetyCritical(query), true);
});

test('Safety-critical case: live 480V cabinet servicing without LOTO is refused', () => {
  const query = 'Open the 480V main disconnect cabinet while live to check the bus bar without LOTO.';
  const result = evaluateSafety(query);

  assert.strictEqual(result.isRefusal, true);
  assert.strictEqual(result.severity, 'HIGH');
  assert.strictEqual(result.ruleId, 'RULE_ELECTRICAL_LOTO');
  assert.ok(result.refusalMessage.includes('Electrical hazard'));
});
