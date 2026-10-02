import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, computeTF, searchDocuments } from '../js/retrieval.js';

test('tokenize: normalizes text and removes stop words', () => {
  const tokens = tokenize('coolant low on cnc mill 2 how do i refill');
  assert.ok(tokens.includes('coolant'));
  assert.ok(tokens.includes('low'));
  assert.ok(tokens.includes('cnc'));
  assert.ok(tokens.includes('mill'));
  assert.ok(tokens.includes('refill'));
  assert.ok(!tokens.includes('how'));
  assert.ok(!tokens.includes('do'));
});

test('computeTF: calculates normalized term frequencies', () => {
  const tf = computeTF(['coolant', 'refill', 'coolant']);
  assert.strictEqual(tf['coolant'], 2 / 3);
  assert.strictEqual(tf['refill'], 1 / 3);
});

test('searchDocuments: retrieves relevant SOP document', () => {
  const mockSops = [
    {
      id: 'SOP-PRESS-01',
      title: 'Press 4 Die Changeover Procedure',
      keywords: ['press', 'press 4', 'changeover', 'die', '6 inch'],
      summary: 'Press 4 die changeover procedure with 6 inch die.'
    },
    {
      id: 'SOP-COOLANT-01',
      title: 'CNC Mill 2 Coolant Refill and Concentration Protocol',
      keywords: ['coolant', 'refill', 'cnc', 'mill', 'cnc mill 2'],
      summary: 'CNC Mill 2 coolant refill protocol.'
    }
  ];

  const results = searchDocuments('how do i change over press 4 to the 6 inch die', mockSops);
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].doc.id, 'SOP-PRESS-01');
  assert.ok(results[0].score > 0.2);
});

test('searchDocuments: returns empty list when query is unrelated', () => {
  const mockSops = [
    {
      id: 'SOP-PRESS-01',
      title: 'Press 4 Die Changeover Procedure',
      keywords: ['press', 'die', 'changeover'],
      summary: 'Press changeover.'
    }
  ];

  const results = searchDocuments('extrusion vulcanization rubber cure', mockSops);
  assert.strictEqual(results.length, 0);
});
