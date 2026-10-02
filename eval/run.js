import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { searchDocuments } from '../js/retrieval.js';
import { evaluateSafety } from '../js/safetyGate.js';
import { generateWorkOrder, normalizeRoute } from '../js/workOrder.js';
import { createKnowledgeBase, addKnowledgeItem, findBestMatch } from '../js/knowledgeBase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const datasetPath = path.join(rootDir, 'eval', 'dataset.json');
const sopsPath = path.join(rootDir, 'data', 'sops.json');
const shopPath = path.join(rootDir, 'data', 'shop.json');
const resultsPath = path.join(rootDir, 'eval', 'results.json');
const baselinePath = path.join(rootDir, 'eval', 'baseline.json');

const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
const sops = JSON.parse(fs.readFileSync(sopsPath, 'utf8'));
const shop = JSON.parse(fs.readFileSync(shopPath, 'utf8'));

const kb = createKnowledgeBase();
addKnowledgeItem(kb, {
  id: 'KB-HANK-01',
  question: 'press 4 is making a grinding noise, red light on',
  answer: 'Shut it down, the ram bearing is dry. Grease the left fitting with the red gun, 3 pumps, then restart.',
  machineId: 'Press 4',
  capturedFrom: 'Hank',
  capturedAt: 'Today 07:16'
});

function evaluateSplit(cases) {
  const caseResults = [];

  for (const c of cases) {
    const safety = evaluateSafety(c.text);
    const kbMatch = findBestMatch(c.text, kb, 0.22);
    const sopMatches = searchDocuments(c.text, sops, { threshold: 0.22 });
    const wo = generateWorkOrder({ query: c.text, shopData: shop, safetyResult: safety });

    let actualBehavior = 'admit_gap';
    let actualSource = null;
    const top3 = sopMatches.slice(0, 3).map(m => m.doc.id);

    if (safety.isRefusal) {
      actualBehavior = 'refuse_and_escalate';
      actualSource = null;
    } else if (kbMatch && kbMatch.item) {
      actualBehavior = 'answer_kb';
      actualSource = kbMatch.item.id;
    } else if (sopMatches.length > 0) {
      actualBehavior = 'answer_sop';
      actualSource = sopMatches[0].doc.id;
    } else {
      actualBehavior = 'admit_gap';
      actualSource = null;
    }

    const actualMachine = wo.machine;
    const actualSeverity = wo.normalizedSeverity || wo.severity.toLowerCase();
    const actualRoute = wo.normalizedRoute || normalizeRoute(wo.route);

    const behaviorPass = (c.expected_behavior === actualBehavior) &&
      (c.expected_source ? c.expected_source === actualSource : true);

    const machinePass = actualMachine === c.expected_machine;
    const severityPass = actualSeverity === c.expected_severity;
    const routePass = actualRoute === c.expected_route;
    const woPass = machinePass && severityPass && routePass;
    const allPass = behaviorPass && woPass;

    caseResults.push({
      id: c.id,
      text: c.text,
      group: c.group,
      expected: {
        behavior: c.expected_behavior,
        source: c.expected_source,
        machine: c.expected_machine,
        severity: c.expected_severity,
        route: c.expected_route
      },
      actual: {
        behavior: actualBehavior,
        source: actualSource,
        top3: top3,
        machine: actualMachine,
        severity: actualSeverity,
        route: actualRoute
      },
      passes: {
        behavior: behaviorPass,
        machine: machinePass,
        severity: severityPass,
        route: routePass,
        work_order: woPass,
        all: allPass
      }
    });
  }

  const safetyCases = caseResults.filter(r => r.group === 'uncovered_safety');
  const safetyPassed = safetyCases.filter(r => r.actual.behavior === 'refuse_and_escalate').length;

  const nonSafetyCases = caseResults.filter(r => r.group === 'covered' || r.group === 'adversarial');
  const falseRefusals = nonSafetyCases.filter(r => r.actual.behavior === 'refuse_and_escalate').length;

  const uncoveredCases = caseResults.filter(r => r.group === 'uncovered_low_stakes' || r.group === 'uncovered_safety');
  const gapPassed = uncoveredCases.filter(r => r.actual.behavior !== 'answer_sop' && r.actual.behavior !== 'answer_kb').length;

  const coveredCases = caseResults.filter(r => r.group === 'covered');
  const retrievalTop1Passed = coveredCases.filter(r => r.actual.source === r.expected.source).length;
  const retrievalTop3Passed = coveredCases.filter(r => r.actual.top3.includes(r.expected.source)).length;

  const reuseCases = caseResults.filter(r => r.group === 'paraphrase_reuse');
  const reusePassed = reuseCases.filter(r => r.actual.behavior === 'answer_kb' && r.actual.source === r.expected.source).length;

  const machinePassed = caseResults.filter(r => r.passes.machine).length;
  const severityPassed = caseResults.filter(r => r.passes.severity).length;
  const routePassed = caseResults.filter(r => r.passes.route).length;
  const woPassed = caseResults.filter(r => r.passes.work_order).length;
  const totalCases = caseResults.length;

  function toMetric(passed, total) {
    const pct = total === 0 ? 100 : Math.round((passed / total) * 1000) / 10;
    return { passed, total, percentage: pct };
  }

  const groupBreakdown = {};
  const allGroups = ['covered', 'uncovered_low_stakes', 'uncovered_safety', 'paraphrase_reuse', 'adversarial'];

  for (const g of allGroups) {
    const inGroup = caseResults.filter(r => r.group === g);
    const passed = inGroup.filter(r => r.passes.all).length;
    groupBreakdown[g] = toMetric(passed, inGroup.length);
  }

  const failures = caseResults.filter(r => !r.passes.all);

  return {
    metrics: {
      safety_recall: toMetric(safetyPassed, safetyCases.length),
      false_refusal_rate: toMetric(falseRefusals, nonSafetyCases.length),
      gap_detection: toMetric(gapPassed, uncoveredCases.length),
      wrong_answer_rate: toMetric(uncoveredCases.length - gapPassed, uncoveredCases.length),
      retrieval_top1: toMetric(retrievalTop1Passed, coveredCases.length),
      retrieval_top3: toMetric(retrievalTop3Passed, coveredCases.length),
      knowledge_reuse: toMetric(reusePassed, reuseCases.length),
      work_order_machine: toMetric(machinePassed, totalCases),
      work_order_severity: toMetric(severityPassed, totalCases),
      work_order_route: toMetric(routePassed, totalCases),
      work_order_overall: toMetric(woPassed, totalCases),
      overall_pass: toMetric(caseResults.filter(r => r.passes.all).length, totalCases)
    },
    groupBreakdown,
    failures,
    caseResults
  };
}

const devCases = dataset.filter(c => c.split === 'dev');
const testCases = dataset.filter(c => c.split === 'test');

const devEval = evaluateSplit(devCases);
const testEval = evaluateSplit(testCases);

const outputResults = {
  timestamp: new Date().toISOString(),
  headline: "TEST SPLIT METRICS",
  test: testEval.metrics,
  test_group_breakdown: testEval.groupBreakdown,
  test_failures: testEval.failures.map(f => ({
    id: f.id,
    text: f.text,
    expected: f.expected,
    actual: f.actual
  })),
  dev: devEval.metrics,
  dev_group_breakdown: devEval.groupBreakdown,
  dev_failures: devEval.failures.map(f => ({
    id: f.id,
    text: f.text,
    expected: f.expected,
    actual: f.actual
  }))
};

fs.writeFileSync(resultsPath, JSON.stringify(outputResults, null, 2));

console.log('========================================================================');
console.log('                      HANK KNOWS - EVALUATION RESULTS                   ');
console.log('========================================================================');
console.log(`Evaluated ${dataset.length} cases (Dev: ${devCases.length}, Test: ${testCases.length})`);
console.log('');
console.log('HEADLINE METRICS (TEST SPLIT):');
console.log('------------------------------------------------------------------------');
console.log(`Safety Gate Recall (Headline)   : ${testEval.metrics.safety_recall.passed}/${testEval.metrics.safety_recall.total} (${testEval.metrics.safety_recall.percentage}%)`);
console.log(`False Refusal Rate (Adversarial): ${testEval.metrics.false_refusal_rate.passed}/${testEval.metrics.false_refusal_rate.total} (${testEval.metrics.false_refusal_rate.percentage}%)`);
console.log(`Gap Detection Rate              : ${testEval.metrics.gap_detection.passed}/${testEval.metrics.gap_detection.total} (${testEval.metrics.gap_detection.percentage}%)`);
console.log(`SOP Retrieval Top-1 Accuracy    : ${testEval.metrics.retrieval_top1.passed}/${testEval.metrics.retrieval_top1.total} (${testEval.metrics.retrieval_top1.percentage}%)`);
console.log(`SOP Retrieval Top-3 Recall      : ${testEval.metrics.retrieval_top3.passed}/${testEval.metrics.retrieval_top3.total} (${testEval.metrics.retrieval_top3.percentage}%)`);
console.log(`Knowledge Reuse Hit Rate        : ${testEval.metrics.knowledge_reuse.passed}/${testEval.metrics.knowledge_reuse.total} (${testEval.metrics.knowledge_reuse.percentage}%)`);
console.log(`Work Order Machine Accuracy     : ${testEval.metrics.work_order_machine.passed}/${testEval.metrics.work_order_machine.total} (${testEval.metrics.work_order_machine.percentage}%)`);
console.log(`Work Order Severity Accuracy    : ${testEval.metrics.work_order_severity.passed}/${testEval.metrics.work_order_severity.total} (${testEval.metrics.work_order_severity.percentage}%)`);
console.log(`Work Order Route Accuracy       : ${testEval.metrics.work_order_route.passed}/${testEval.metrics.work_order_route.total} (${testEval.metrics.work_order_route.percentage}%)`);
console.log(`Work Order Overall Accuracy     : ${testEval.metrics.work_order_overall.passed}/${testEval.metrics.work_order_overall.total} (${testEval.metrics.work_order_overall.percentage}%)`);
console.log('');
console.log('GROUP BREAKDOWN (TEST SPLIT):');
console.log('------------------------------------------------------------------------');
for (const [grp, m] of Object.entries(testEval.groupBreakdown)) {
  console.log(`- ${grp.padEnd(24)}: ${m.passed}/${m.total} (${m.percentage}%)`);
}

console.log('');
console.log('DEV SPLIT SUMMARY:');
console.log('------------------------------------------------------------------------');
console.log(`Safety Gate Recall (Dev)        : ${devEval.metrics.safety_recall.passed}/${devEval.metrics.safety_recall.total} (${devEval.metrics.safety_recall.percentage}%)`);
console.log(`Gap Detection (Dev)             : ${devEval.metrics.gap_detection.passed}/${devEval.metrics.gap_detection.total} (${devEval.metrics.gap_detection.percentage}%)`);
console.log(`SOP Retrieval Top-1 (Dev)       : ${devEval.metrics.retrieval_top1.passed}/${devEval.metrics.retrieval_top1.total} (${devEval.metrics.retrieval_top1.percentage}%)`);
console.log(`Work Order Overall (Dev)        : ${devEval.metrics.work_order_overall.passed}/${devEval.metrics.work_order_overall.total} (${devEval.metrics.work_order_overall.percentage}%)`);

console.log('');
console.log('FAILURES (TEST SPLIT):');
console.log('------------------------------------------------------------------------');
if (testEval.failures.length === 0) {
  console.log('None! All test split cases passed successfully.');
} else {
  for (const f of testEval.failures) {
    console.log(`[${f.id}] "${f.text}"`);
    console.log(`  Expected: behavior=${f.expected.behavior} (${f.expected.source}), machine=${f.expected.machine}, sev=${f.expected.severity}, route=${f.expected.route}`);
    console.log(`  Actual  : behavior=${f.actual.behavior} (${f.actual.source}), machine=${f.actual.machine}, sev=${f.actual.severity}, route=${f.actual.route}`);
  }
}
console.log('========================================================================');

const checkBaseline = process.argv.includes('--check-baseline');
if (checkBaseline && fs.existsSync(baselinePath)) {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const targetRecall = baseline.test_safety_recall || 100;
  if (testEval.metrics.safety_recall.percentage < targetRecall) {
    console.error(`FATAL: Test safety recall ${testEval.metrics.safety_recall.percentage}% is below baseline ${targetRecall}%`);
    process.exit(1);
  }
}
