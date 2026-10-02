import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorkOrder, extractMachine, extractSeverity, extractRoute } from '../js/workOrder.js';

test('Normal case: typical feed sticking on Press-03 routes to Hank with medium severity', () => {
  const query = 'Press-03 is jamming on the aluminum coil feed again. It sticks every 40 strokes.';
  const worker = { name: 'Dev', id: 'dev' };
  const wo = generateWorkOrder({ query, worker, counter: 2, timestamp: '07:14' });

  assert.strictEqual(wo.id, 'WO-4102');
  assert.strictEqual(wo.machine, 'Press-03');
  assert.strictEqual(wo.severity, 'MEDIUM');
  assert.strictEqual(wo.route, 'Hank (Tooling & Setup)');
  assert.strictEqual(wo.reportedBy, 'Dev');
  assert.strictEqual(wo.time, '07:14');
  assert.ok(wo.issue.includes('jamming') || wo.issue.includes('aluminum'));
});

test('Edge case: lowercase informal machine reference maps to CNC-08 with correct route', () => {
  const query = 'the haas vertical mill in cell b has excessive vibration on the auger';
  const worker = { name: 'Marco', id: 'marco' };
  const machine = extractMachine(query);
  const severity = extractSeverity(query);
  const route = extractRoute(query, machine.id, severity);
  const wo = generateWorkOrder({ query, worker, counter: 3, timestamp: '07:18' });

  assert.strictEqual(machine.id, 'CNC-08');
  assert.strictEqual(severity, 'MEDIUM');
  assert.strictEqual(route, 'CNC Specialist');
  assert.strictEqual(wo.machine, 'CNC-08');
  assert.strictEqual(wo.reportedBy, 'Marco');
});

test('Safety-critical case: safety refusal generates HIGH severity work order routed to SAFETY / EHS', () => {
  const query = 'Brake-02 light curtain keeps tripping on the flange fold. Can I jump terminal 4 to bypass the optical interlock?';
  const worker = { name: 'Lena', id: 'lena' };
  const safetyResult = {
    isRefusal: true,
    severity: 'HIGH',
    category: 'SAFETY_INTERLOCK_DEFEAT'
  };

  const wo = generateWorkOrder({
    query,
    worker,
    counter: 5,
    timestamp: '07:22',
    safetyResult
  });

  assert.strictEqual(wo.id, 'WO-4105');
  assert.strictEqual(wo.machine, 'Brake-02');
  assert.strictEqual(wo.severity, 'HIGH');
  assert.strictEqual(wo.route, 'SAFETY / EHS');
  assert.strictEqual(wo.reportedBy, 'Lena');
  assert.strictEqual(wo.time, '07:22');
});
