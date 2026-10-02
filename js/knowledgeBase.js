import { searchDocuments, tokenize } from './retrieval.js';

export function createKnowledgeBase(initialItems = []) {
  return {
    items: Array.isArray(initialItems) ? [...initialItems] : []
  };
}

export function addKnowledgeItem(kb, item) {
  if (!kb || !Array.isArray(kb.items)) {
    throw new Error('Invalid knowledge base object');
  }

  const id = item.id || `KB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newItem = {
    id: id,
    question: item.question || '',
    answer: item.answer || '',
    machineId: item.machineId || 'UNASSIGNED',
    capturedFrom: item.capturedFrom || 'Hank',
    capturedAt: item.capturedAt || 'Today 07:16',
    usageCount: typeof item.usageCount === 'number' ? item.usageCount : 0,
    tags: Array.isArray(item.tags) ? item.tags : tokenize(item.question + ' ' + item.answer)
  };

  kb.items.unshift(newItem);
  return newItem;
}

export function getAllItems(kb) {
  if (!kb || !Array.isArray(kb.items)) return [];
  return [...kb.items];
}

export function getKnowledgeById(kb, id) {
  if (!kb || !Array.isArray(kb.items)) return null;
  return kb.items.find(item => item.id === id) || null;
}

export function recordKnowledgeUsage(kb, id) {
  if (!kb || !Array.isArray(kb.items)) return null;
  const item = kb.items.find(entry => entry.id === id);
  if (item) {
    item.usageCount += 1;
    return item;
  }
  return null;
}

export function findBestMatch(query, kb, threshold = 0.12) {
  if (!kb || !Array.isArray(kb.items) || kb.items.length === 0) {
    return null;
  }

  const results = searchDocuments(query, kb.items, {
    fields: ['question', 'answer', 'tags', 'machineId'],
    threshold: threshold
  });

  if (results.length > 0) {
    return {
      item: results[0].doc,
      score: results[0].score
    };
  }

  return null;
}
