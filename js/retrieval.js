const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and',
  'any', 'are', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'could', 'did', 'do', 'does', 'doing',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have',
  'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
  'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
  'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'will', 'with', 'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

const SYNONYMS = {
  'presss': 'press',
  'chnage': 'change',
  'ram': 'press',
  'stamping': 'press',
  'presses': 'press',
  'stamped': 'press',
  'fluid': 'oil',
  'lube': 'oil',
  'lubricant': 'oil',
  'hydralic': 'hydraulic',
  'hydraulics': 'hydraulic',
  'temprature': 'temperature',
  'temp': 'temperature',
  'temperatures': 'temperature',
  'refractometr': 'refractometer',
  'refractometers': 'refractometer',
  'estop': 'emergency',
  'e-stop': 'emergency',
  'flang': 'flange',
  'flanges': 'flange',
  'jaws': 'chuck',
  'jaw': 'chuck',
  'collets': 'collet',
  'augers': 'auger',
  'chips': 'chip',
  'coils': 'coil',
  'jams': 'jam',
  'jammed': 'jam',
  'jamming': 'jam',
  'sticking': 'stick',
  'sticks': 'stick',
  'stuck': 'stick',
  'galls': 'gall',
  'galling': 'gall',
  'degreasers': 'degreaser',
  'washers': 'washer',
  'clearing': 'clear',
  'clearance': 'clear',
  'clears': 'clear',
  'limits': 'limit',
  'limiting': 'limit',
  'operating': 'operate',
  'operation': 'operate',
  'protocols': 'protocol',
  'procedure': 'protocol',
  'procedures': 'protocol',
  'ratios': 'ratio',
  'probes': 'probe',
  'rpms': 'rpm',
  'spindles': 'spindle'
};

function stem(word) {
  if (word.length <= 3) return word;
  let w = word;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 4 && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('tion') && w.length > 5) return w.slice(0, -4);
  if (w.endsWith('ment') && w.length > 5) return w.slice(0, -4);
  return w;
}

export function tokenize(text) {
  if (typeof text !== 'string') return [];
  const normalized = text.toLowerCase().replace(/['"’]/g, '');
  const rawTokens = normalized.split(/[^a-z0-9_-]+/);
  const result = [];

  for (const raw of rawTokens) {
    if (raw.length < 2) continue;
    if (STOP_WORDS.has(raw)) continue;

    const cleaned = raw.replace(/(.)\1{2,}/g, '$1$1');
    const mapped = SYNONYMS[raw] || SYNONYMS[cleaned] || cleaned;
    const stemmed = stem(mapped);
    result.push(stemmed);

    if (mapped !== stemmed && mapped.length > 2) {
      result.push(mapped);
    }
  }

  return result;
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

const SOP_MANDATORY_TOPICS = {
  'SOP-PRESS-01': ['die', 'changeov', 'change', 'inch', 'clamp', 'setup'],
  'SOP-COOLANT-01': ['coolant', 'refil', 'refractomet', 'ratio', 'water'],
  'SOP-COMP-01': ['compress', 'fault', 'pressur', 'receiv', 'reset'],
  'SOP-LOTO-01': ['lockout', 'tagout', 'loto', 'tag', 'padlock', 'zero']
};

export function searchDocuments(query, documents, options = {}) {
  const fields = options.fields || ['title', 'keywords', 'summary', 'question', 'answer'];
  const threshold = typeof options.threshold === 'number' ? options.threshold : 0.22;

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
    const doc = documents[i];
    const docTokens = docTokensList[i];
    if (docTokens.length === 0) continue;

    if (doc.id && SOP_MANDATORY_TOPICS[doc.id]) {
      const requiredTopics = SOP_MANDATORY_TOPICS[doc.id];
      const hasTopic = queryTokens.some(qt => requiredTopics.some(req => qt.startsWith(req)));
      if (!hasTopic) {
        continue;
      }
    }

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

    if (keywordOverlapCount === 0) continue;

    const overlapRatio = keywordOverlapCount / queryTokens.length;
    const boostedScore = score * 0.7 + overlapRatio * 0.3;

    if (boostedScore >= threshold) {
      results.push({
        doc: doc,
        score: Math.min(1.0, boostedScore)
      });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
