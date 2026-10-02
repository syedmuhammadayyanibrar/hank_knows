import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createKnowledgeBase,
  addKnowledgeItem,
  getAllItems,
  recordKnowledgeUsage,
  findBestMatch
} from '../js/knowledgeBase.js';

test('createKnowledgeBase: initializes empty or with provided items', () => {
  const kb = createKnowledgeBase();
  assert.strictEqual(getAllItems(kb).length, 0);
});

test('addKnowledgeItem and recordKnowledgeUsage: stores veteran answer and increments usage', () => {
  const kb = createKnowledgeBase();
  const item = addKnowledgeItem(kb, {
    question: 'press 4 is making a grinding noise, red light on',
    answer: 'Shut it down, the ram bearing is dry. Grease the left fitting with the red gun, 3 pumps, then restart.',
    machineId: 'Press 4',
    capturedFrom: 'Hank',
    capturedAt: 'Today 07:16'
  });

  assert.strictEqual(getAllItems(kb).length, 1);
  assert.strictEqual(item.usageCount, 0);

  const updated = recordKnowledgeUsage(kb, item.id);
  assert.strictEqual(updated.usageCount, 1);
});

test('findBestMatch: matches newly asked question against stored knowledge', () => {
  const kb = createKnowledgeBase();
  addKnowledgeItem(kb, {
    question: 'press 4 is making a grinding noise, red light on',
    answer: 'Shut it down, the ram bearing is dry. Grease the left fitting with the red gun, 3 pumps, then restart.',
    machineId: 'Press 4',
    capturedFrom: 'Hank'
  });

  const match = findBestMatch('grinding sound from the press, red light', kb);
  assert.ok(match !== null);
  assert.ok(match.item.answer.includes('ram bearing'));
  assert.ok(match.score > 0.15);
});
