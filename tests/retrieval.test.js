import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, computeTF, searchDocuments } from '../js/retrieval.js';

test('tokenize: normalizes text and removes stop words', () => {
  const tokens = tokenize('What is the standard hydraulic oil temperature on Brake-02?');
  assert.ok(tokens.includes('standard'));
  assert.ok(tokens.includes('hydraulic'));
  assert.ok(tokens.includes('oil'));
  assert.ok(tokens.includes('temperature'));
  assert.ok(tokens.includes('brake-02') || tokens.includes('brake'));
  assert.ok(!tokens.includes('the'));
  assert.ok(!tokens.includes('is'));
});

test('computeTF: calculates normalized term frequencies', () => {
  const tf = computeTF(['hydraulic', 'oil', 'hydraulic']);
  assert.strictEqual(tf['hydraulic'], 2 / 3);
  assert.strictEqual(tf['oil'], 1 / 3);
});

test('searchDocuments: retrieves relevant SOP document', () => {
  const mockSops = [
    {
      id: 'SOP-101',
      title: 'Minster 200T Mechanical Press Feed Clearing',
      keywords: ['press', 'feed', 'jam', 'coil'],
      summary: 'Clearing mechanical feed jam with aluminum probe.'
    },
    {
      id: 'SOP-102',
      title: 'Amada Press Brake Hydraulic Temperature and Backgauge Calibration',
      keywords: ['brake', 'hydraulic', 'temperature', 'oil'],
      summary: 'Hydraulic oil operating range 110F to 130F.'
    }
  ];

  const results = searchDocuments('hydraulic oil temperature on brake', mockSops);
  assert.ok(results.length > 0);
  assert.strictEqual(results[0].doc.id, 'SOP-102');
  assert.ok(results[0].score > 0.1);
});

test('searchDocuments: returns empty list when query is unrelated', () => {
  const mockSops = [
    {
      id: 'SOP-101',
      title: 'Minster 200T Mechanical Press Feed Clearing',
      keywords: ['press', 'feed', 'jam'],
      summary: 'Clearing mechanical press.'
    }
  ];

  const results = searchDocuments('extrusion vulcanization rubber cure', mockSops);
  assert.strictEqual(results.length, 0);
});
