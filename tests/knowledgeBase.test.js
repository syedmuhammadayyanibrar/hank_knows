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
    question: 'Press-03 coil feed sticking on 5052 aluminum strip',
    answer: '5052 aluminum galls on guide pins in humidity. Clean rollers and apply dry lube spray.',
    machineId: 'Press-03',
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
    question: 'Press-03 aluminum coil feed sticks every 40 strokes',
    answer: '5052 aluminum galls on guide pins in humidity. Wipe rollers with dry lube spray.',
    machineId: 'Press-03',
    capturedFrom: 'Hank'
  });

  const match = findBestMatch('Press-03 coil feed is slipping and catching on aluminum stock', kb);
  assert.ok(match !== null);
  assert.ok(match.item.answer.includes('dry lube spray'));
  assert.ok(match.score > 0.1);
});
