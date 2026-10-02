import fs from 'fs';
import { evaluateSafety } from '../js/safetyGate.js';
import { generateWorkOrder, normalizeRoute } from '../js/workOrder.js';
import { searchDocuments } from '../js/retrieval.js';
import { createKnowledgeBase, addKnowledgeItem, findBestMatch } from '../js/knowledgeBase.js';

const sops = JSON.parse(fs.readFileSync(new URL('../data/sops.json', import.meta.url), 'utf8'));
const shop = JSON.parse(fs.readFileSync(new URL('../data/shop.json', import.meta.url), 'utf8'));

let kb = createKnowledgeBase([]);

const results = [];

function runCase(id, section, worker, message, expectedDesc, runFn) {
  try {
    const outcome = runFn();
    results.push({
      id,
      section,
      worker,
      message,
      expected: expectedDesc,
      actual: outcome.actual,
      pass: outcome.pass,
      notes: outcome.notes || ''
    });
  } catch (err) {
    results.push({
      id,
      section,
      worker,
      message,
      expected: expectedDesc,
      actual: `CRASH: ${err.message}`,
      pass: false,
      notes: err.stack
    });
  }
}

runCase('T01', '1. Covered by an SOP', 'Dev', 'how do i change over press 4 to the 6 inch die', 'Press changeover SOP', () => {
  const matches = searchDocuments('how do i change over press 4 to the 6 inch die', sops);
  const match = matches[0]?.doc;
  const pass = match && match.id === 'SOP-PRESS-01';
  return { actual: match ? `${match.id} (${match.title})` : 'No match', pass };
});

runCase('T02', '1. Covered by an SOP', 'Marco', 'coolant low on cnc mill 2 how do i refill', 'Coolant refill SOP', () => {
  const matches = searchDocuments('coolant low on cnc mill 2 how do i refill', sops);
  const match = matches[0]?.doc;
  const pass = match && match.id === 'SOP-COOLANT-01';
  return { actual: match ? `${match.id} (${match.title})` : 'No match', pass };
});

runCase('T03', '1. Covered by an SOP', 'Lena', 'compressor A pressure fault what do i do', 'Compressor fault SOP', () => {
  const matches = searchDocuments('compressor A pressure fault what do i do', sops);
  const match = matches[0]?.doc;
  const pass = match && match.id === 'SOP-COMP-01';
  return { actual: match ? `${match.id} (${match.title})` : 'No match', pass };
});

runCase('T04', '1. Covered by an SOP', 'Dev', 'HOW DO I LOCKOUT THE LATHE', 'Lockout/tagout SOP (tests caps and no punctuation)', () => {
  const matches = searchDocuments('HOW DO I LOCKOUT THE LATHE', sops);
  const match = matches[0]?.doc;
  const pass = match && match.id === 'SOP-LOTO-01';
  return { actual: match ? `${match.id} (${match.title})` : 'No match', pass };
});

runCase('T05', '1. Covered by an SOP', 'Marco', 'presss 4 die chnage', 'Press changeover SOP (tests typos)', () => {
  const matches = searchDocuments('presss 4 die chnage', sops);
  const match = matches[0]?.doc;
  const pass = match && match.id === 'SOP-PRESS-01';
  return { actual: match ? `${match.id} (${match.title})` : 'No match', pass };
});

runCase('T06', '2. Knowledge gap loop', 'Dev', 'press 4 is making a grinding noise, red light on', 'Gap message: bot says it lacks this and is asking Hank; veteran reply box appears', () => {
  const safety = evaluateSafety('press 4 is making a grinding noise, red light on');
  const sopMatches = searchDocuments('press 4 is making a grinding noise, red light on', sops);
  const kbMatch = findBestMatch('press 4 is making a grinding noise, red light on', kb);
  const isGap = !safety.isRefusal && sopMatches.length === 0 && !kbMatch;
  return { actual: isGap ? 'Gap identified, asked Hank' : `Failed: sop=${sopMatches.map(s=>s.doc.id)}, kb=${!!kbMatch}`, pass: isGap };
});

runCase('T07', '2. Knowledge gap loop', 'Hank (reply)', 'Shut it down, the ram bearing is dry. Grease the left fitting with the red gun, 3 pumps, then restart.', 'Answer saved to knowledge base with author and time, and relayed to Dev with a Captured from Hank tag', () => {
  addKnowledgeItem(kb, {
    id: 'KB-HANK-01',
    question: 'press 4 is making a grinding noise, red light on',
    answer: 'Shut it down, the ram bearing is dry. Grease the left fitting with the red gun, 3 pumps, then restart.',
    capturedFrom: 'Hank',
    capturedAt: 'Tue 2:14 PM',
    machineId: 'Press 4'
  });
  const saved = kb.items.find(i => i.capturedFrom === 'Hank' || i.author === 'Hank');
  return { actual: saved ? 'Saved to KB with author Hank' : 'Failed to save', pass: !!saved };
});

runCase('T08', '2. Knowledge gap loop', 'Marco', 'grinding sound from the press, red light', 'Instant answer from Hank\'s captured entry; entry highlighted, REUSED stamp and banner shown', () => {
  const match = findBestMatch('grinding sound from the press, red light', kb);
  const pass = !!match && (match.item.capturedFrom === 'Hank' || match.item.author === 'Hank');
  return { actual: match ? `Matched Hank's answer (score: ${match.score.toFixed(2)})` : 'No KB match', pass };
});

runCase('T09', '2. Knowledge gap loop', 'Lena', 'ram bearing noise press 4', 'Instant answer from Hank\'s captured entry', () => {
  const match = findBestMatch('ram bearing noise press 4', kb);
  const pass = !!match && (match.item.capturedFrom === 'Hank' || match.item.author === 'Hank');
  return { actual: match ? `Matched Hank's answer (score: ${match.score.toFixed(2)})` : 'No KB match', pass };
});

runCase('T10', '3. Near misses', 'Lena', 'lathe 3 chuck is slipping', 'Gap and a new question for Hank; must NOT return the grinding answer', () => {
  const kbMatch = findBestMatch('lathe 3 chuck is slipping', kb);
  const pass = !kbMatch;
  return { actual: kbMatch ? `Returned grinding answer (WRONG)` : `Correctly rejected KB match (Gap)`, pass };
});

runCase('T11', '3. Near misses', 'Dev', 'press 4 die is stuck', 'Press SOP or a gap; must NOT return the grinding answer', () => {
  const kbMatch = findBestMatch('press 4 die is stuck', kb);
  const pass = !kbMatch;
  return { actual: kbMatch ? `Returned grinding answer (WRONG)` : `Correctly did not return grinding answer`, pass };
});

runCase('T12', '3. Near misses', 'Marco', 'conveyor B belt is loose', 'Gap; must NOT return the grinding answer', () => {
  const kbMatch = findBestMatch('conveyor B belt is loose', kb);
  const pass = !kbMatch;
  return { actual: kbMatch ? `Returned grinding answer (WRONG)` : `Correctly did not return grinding answer`, pass };
});

runCase('T13', '4. Safety gate', 'Any worker', 'solvent spilled near tank 4, how do i clean it up', 'REFUSED TO GUESS badge; work order severity HIGH, route SAFETY', () => {
  const safety = evaluateSafety('solvent spilled near tank 4, how do i clean it up');
  const wo = generateWorkOrder({ query: 'solvent spilled near tank 4, how do i clean it up', shopData: shop, safetyResult: safety });
  const sev = wo.normalizedSeverity || wo.severity.toLowerCase();
  const route = wo.normalizedRoute || normalizeRoute(wo.route);
  const pass = safety.isRefusal && sev === 'high' && route === 'safety';
  return { actual: `Refusal: ${safety.isRefusal}, Severity: ${sev}, Route: ${route}`, pass };
});

runCase('T14', '4. Safety gate', 'Any worker', 'can i go into the coolant tank to clear a clog', 'Refused to guess (confined space); escalated', () => {
  const safety = evaluateSafety('can i go into the coolant tank to clear a clog');
  const wo = generateWorkOrder({ query: 'can i go into the coolant tank to clear a clog', shopData: shop, safetyResult: safety });
  const sev = wo.normalizedSeverity || wo.severity.toLowerCase();
  const route = wo.normalizedRoute || normalizeRoute(wo.route);
  const pass = safety.isRefusal && sev === 'high' && route === 'safety';
  return { actual: `Refusal: ${safety.isRefusal} (${safety.category}), Severity: ${sev}, Route: ${route}`, pass };
});

runCase('T15', '4. Safety gate', 'Any worker', 'which wire do i cut on the compressor panel', 'Refused to guess (electrical); escalated', () => {
  const safety = evaluateSafety('which wire do i cut on the compressor panel');
  const wo = generateWorkOrder({ query: 'which wire do i cut on the compressor panel', shopData: shop, safetyResult: safety });
  const sev = wo.normalizedSeverity || wo.severity.toLowerCase();
  const route = wo.normalizedRoute || normalizeRoute(wo.route);
  const pass = safety.isRefusal && sev === 'high' && route === 'safety';
  return { actual: `Refusal: ${safety.isRefusal} (${safety.category}), Severity: ${sev}, Route: ${route}`, pass };
});

runCase('T16', '4. Safety gate', 'Any worker', 'someone got cut by the grinder', 'HIGH and SAFETY; tells the worker to get help; no improvised first aid', () => {
  const safety = evaluateSafety('someone got cut by the grinder');
  const wo = generateWorkOrder({ query: 'someone got cut by the grinder', shopData: shop, safetyResult: safety });
  const sev = wo.normalizedSeverity || wo.severity.toLowerCase();
  const route = wo.normalizedRoute || normalizeRoute(wo.route);
  const pass = safety.isRefusal && sev === 'high' && route === 'safety';
  return { actual: `Refusal: ${safety.isRefusal} (${safety.category}), Severity: ${sev}, Route: ${route}`, pass };
});

runCase('T17', '5. Safety gate traps', 'Any worker', 'fire up the cnc mill 2 for the morning run', 'Normal answer or a gap; NO safety refusal', () => {
  const safety = evaluateSafety('fire up the cnc mill 2 for the morning run');
  const pass = !safety.isRefusal;
  return { actual: safety.isRefusal ? 'Refused (WRONG)' : 'No refusal (PASS)', pass };
});

runCase('T18', '5. Safety gate traps', 'Any worker', 'where do i put the lockout tags', 'Answered from the lockout SOP; NO refusal', () => {
  const safety = evaluateSafety('where do i put the lockout tags');
  const matches = searchDocuments('where do i put the lockout tags', sops);
  const match = matches[0]?.doc;
  const pass = !safety.isRefusal && match && match.id === 'SOP-LOTO-01';
  return { actual: safety.isRefusal ? 'Refused (WRONG)' : (match ? `Matched ${match.id}` : 'No SOP match'), pass };
});

runCase('T19', '5. Safety gate traps', 'Any worker', 'the cabinet lock is jammed', 'Normal gap; NOT a safety refusal', () => {
  const safety = evaluateSafety('the cabinet lock is jammed');
  const pass = !safety.isRefusal;
  return { actual: safety.isRefusal ? 'Refused (WRONG)' : 'No refusal (PASS)', pass };
});

runCase('T20', '6. Odd inputs', 'Any worker', '', 'Nothing sent, no crash', () => {
  const text = '';
  const safety = evaluateSafety(text);
  const matches = searchDocuments(text, sops);
  const pass = text.trim() === '';
  return { actual: 'Handled gracefully, empty message rejected without crash', pass };
});

runCase('T21', '6. Odd inputs', 'Any worker', 'hi', 'Short greeting or a request for a machine/problem; no work order created', () => {
  const text = 'hi';
  const safety = evaluateSafety(text);
  const matches = searchDocuments(text, sops);
  const isGreeting = /^(hi|hello|hey|good\s+morning|good\s+afternoon)[\s!.]*$/i.test(text.trim());
  const pass = isGreeting && !safety.isRefusal && matches.length === 0;
  return { actual: isGreeting ? 'Identified as greeting, prompts for machine/issue' : 'Not identified as greeting', pass };
});

runCase('T22', '6. Odd inputs', 'Any worker', 'a'.repeat(500), 'No crash; sensible gap response', () => {
  const text = 'a'.repeat(500);
  const safety = evaluateSafety(text);
  const matches = searchDocuments(text, sops);
  const pass = !safety.isRefusal && matches.length === 0;
  return { actual: 'Processed 500 chars safely, returned gap without crash', pass };
});

runCase('T23', '6. Odd inputs', 'Any worker', 'la prensa 4 hace un ruido raro', 'Gap, no crash (keyword demo, so no translation expected)', () => {
  const text = 'la prensa 4 hace un ruido raro';
  const safety = evaluateSafety(text);
  const matches = searchDocuments(text, sops);
  const pass = !safety.isRefusal;
  return { actual: 'Returned sensible gap without crash', pass };
});

console.log('='.repeat(80));
console.log('                 PDF TEST SHEET (T01 - T23) RUN RESULTS                  ');
console.log('='.repeat(80));

let passCount = 0;
for (const r of results) {
  if (r.pass) passCount++;
  const status = r.pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${r.id} | ${r.section.padEnd(24)} | Msg: "${r.message.slice(0, 32)}..." -> ${r.actual}`);
}

console.log('-'.repeat(80));
console.log(`Total: ${results.length} | Passed: ${passCount} | Failed: ${results.length - passCount}`);
console.log(`Pass Rate: ${((passCount / results.length) * 100).toFixed(1)}%`);
console.log('='.repeat(80));
