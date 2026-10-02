const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'did', 'do', 'does', 'doing', 'down',
  'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'will', 'with', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

export function tokenize(text) {
  if (typeof text !== 'string') return [];
  const normalized = text.toLowerCase().replace(/['"’]/g, '');
  const rawTokens = normalized.split(/[^a-z0-9_-]+/);
  return rawTokens.filter(t => t.length > 1 && !STOP_WORDS.has(t));
}

export function computeTF(tokens) {
  const tf = {};
  if (!tokens || tokens.length === 0) return tf;
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  for (const token in tf) {
    tf[token] = tf[token] / tokens.length;
  }
  return tf;
}

export function computeIDF(docTokensList) {
  const idf = {};
  const N = docTokensList.length;
  if (N === 0) return idf;

  const docFreq = {};
  for (const tokens of docTokensList) {
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      docFreq[token] = (docFreq[token] || 0) + 1;
    }
  }

  for (const token in docFreq) {
    idf[token] = Math.log(1 + (N / (docFreq[token] + 1))) + 1;
  }
  return idf;
}

export function buildVector(tf, idf) {
  const vector = {};
  let normSq = 0;
  for (const token in tf) {
    const weight = tf[token] * (idf[token] || 1);
    vector[token] = weight;
    normSq += weight * weight;
  }
  const norm = Math.sqrt(normSq);
  if (norm > 0) {
    for (const token in vector) {
      vector[token] = vector[token] / norm;
    }
  }
  return vector;
}

export function cosineSimilarity(vecA, vecB) {
  let score = 0;
  const [smaller, larger] = Object.keys(vecA).length <= Object.keys(vecB).length
    ? [vecA, vecB]
    : [vecB, vecA];

  for (const key in smaller) {
    if (larger[key]) {
      score += smaller[key] * larger[key];
    }
  }
  return score;
}

export function searchDocuments(query, documents, options = {}) {
  const fields = options.fields || ['title', 'keywords', 'summary', 'question', 'answer'];
  const threshold = typeof options.threshold === 'number' ? options.threshold : 0.05;

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0 || !Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const docTokensList = documents.map(doc => {
    const combinedText = fields
      .map(field => {
        const val = doc[field];
        if (Array.isArray(val)) return val.join(' ');
        if (typeof val === 'string') return val;
        return '';
      })
      .join(' ');
    return tokenize(combinedText);
  });

  const idf = computeIDF(docTokensList);
  const queryTF = computeTF(queryTokens);
  const queryVec = buildVector(queryTF, idf);

  const results = [];
  for (let i = 0; i < documents.length; i++) {
    const docTokens = docTokensList[i];
    if (docTokens.length === 0) continue;

    const docTF = computeTF(docTokens);
    const docVec = buildVector(docTF, idf);
    const score = cosineSimilarity(queryVec, docVec);

    let keywordOverlapCount = 0;
    const docTokenSet = new Set(docTokens);
    for (const qt of queryTokens) {
      if (docTokenSet.has(qt)) {
        keywordOverlapCount++;
      }
    }

    const boostedScore = score + (keywordOverlapCount * 0.05);

    if (boostedScore >= threshold && keywordOverlapCount > 0) {
      results.push({
        doc: documents[i],
        score: Math.min(1.0, boostedScore)
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
