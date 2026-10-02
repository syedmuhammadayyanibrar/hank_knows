import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorkOrder, extractMachine, extractSeverity, extractRoute } from '../js/workOrder.js';

test('Normal case: typical grinding noise on Press 4 routes to Hank with medium severity', () => {
  const query = 'Press 4 is making a grinding noise, red light on';
  const worker = { name: 'Dev', id: 'dev' };
  const wo = generateWorkOrder({ query, worker, counter: 2, timestamp: '07:14' });

  assert.strictEqual(wo.id, 'WO-4102');
  assert.strictEqual(wo.machine, 'Press 4');
  assert.strictEqual(wo.severity, 'MEDIUM');
  assert.strictEqual(wo.route, 'Hank (Tooling & Setup)');
  assert.strictEqual(wo.reportedBy, 'Dev');
  assert.strictEqual(wo.time, '07:14');
  assert.ok(wo.issue.includes('grinding') || wo.issue.includes('Press 4'));
});

test('Edge case: lowercase informal machine reference maps to CNC Mill 2 with correct route', () => {
  const query = 'the haas vertical mill in cell 2 has low coolant';
  const worker = { name: 'Marco', id: 'marco' };
  const machine = extractMachine(query);
  const severity = extractSeverity(query);
  const route = extractRoute(query, machine.id, severity);
  const wo = generateWorkOrder({ query, worker, counter: 3, timestamp: '07:18' });

  assert.strictEqual(machine.id, 'CNC Mill 2');
  assert.strictEqual(severity, 'LOW');
  assert.strictEqual(route, 'CNC Specialist');
  assert.strictEqual(wo.machine, 'CNC Mill 2');
  assert.strictEqual(wo.reportedBy, 'Marco');
});

test('Safety-critical case: safety refusal generates HIGH severity work order routed to SAFETY / EHS', () => {
  const query = 'solvent spilled near tank 4, how do i clean it up';
  const worker = { name: 'Lena', id: 'lena' };
  const safetyResult = {
    isRefusal: true,
    severity: 'HIGH',
    category: 'HAZARDOUS_CHEMICAL_OR_CONFINED_SPACE'
  };

  const wo = generateWorkOrder({
    query,
    worker,
    counter: 5,
    timestamp: '07:22',
    safetyResult
  });

  assert.strictEqual(wo.id, 'WO-4105');
  assert.strictEqual(wo.machine, 'Tank 4');
  assert.strictEqual(wo.severity, 'HIGH');
  assert.strictEqual(wo.route, 'SAFETY / EHS');
  assert.strictEqual(wo.reportedBy, 'Lena');
  assert.strictEqual(wo.time, '07:22');
});
