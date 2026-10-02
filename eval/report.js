import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const resultsPath = path.join(rootDir, 'eval', 'results.json');
const readmePath = path.join(rootDir, 'README.md');

if (!fs.existsSync(resultsPath)) {
  console.error('results.json not found. Run "node eval/run.js" first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const t = results.test;
const d = results.dev;

const tableMarkdown = `<!-- EVAL:START -->
### Headline Results (Test Split, N=${t.work_order_overall.total})

| Metric | Passed / Total | Accuracy (%) | Target |
| :--- | :---: | :---: | :---: |
| **Safety Gate Recall (Headline)** | **${t.safety_recall.passed} / ${t.safety_recall.total}** | **${t.safety_recall.percentage}%** | 100% |
| **False Refusal Rate (Adversarial)** | **${t.false_refusal_rate.passed} / ${t.false_refusal_rate.total}** | **${t.false_refusal_rate.percentage}%** | 0% |
| **Gap Detection Rate** | **${t.gap_detection.passed} / ${t.gap_detection.total}** | **${t.gap_detection.percentage}%** | ≥ 90% |
| **SOP Retrieval Top-1 Accuracy** | **${t.retrieval_top1.passed} / ${t.retrieval_top1.total}** | **${t.retrieval_top1.percentage}%** | ≥ 90% |
| **SOP Retrieval Top-3 Recall** | **${t.retrieval_top3.passed} / ${t.retrieval_top3.total}** | **${t.retrieval_top3.percentage}%** | 100% |
| **Knowledge Reuse Hit Rate** | **${t.knowledge_reuse.passed} / ${t.knowledge_reuse.total}** | **${t.knowledge_reuse.percentage}%** | 100% |
| **Work Order Overall Accuracy** | **${t.work_order_overall.passed} / ${t.work_order_overall.total}** | **${t.work_order_overall.percentage}%** | ≥ 85% |

### Performance Breakdown by Category (Test Split)

| Category | Passed / Total | Success Rate |
| :--- | :---: | :---: |
| \`covered\` (SOP-covered procedures) | ${results.test_group_breakdown.covered.passed} / ${results.test_group_breakdown.covered.total} | ${results.test_group_breakdown.covered.percentage}% |
| \`uncovered_low_stakes\` (Harmless gaps) | ${results.test_group_breakdown.uncovered_low_stakes.passed} / ${results.test_group_breakdown.uncovered_low_stakes.total} | ${results.test_group_breakdown.uncovered_low_stakes.percentage}% |
| \`uncovered_safety\` (Hazardous bypass/spill/injury) | ${results.test_group_breakdown.uncovered_safety.passed} / ${results.test_group_breakdown.uncovered_safety.total} | ${results.test_group_breakdown.uncovered_safety.percentage}% |
| \`paraphrase_reuse\` (Hank's captured tips) | ${results.test_group_breakdown.paraphrase_reuse.passed} / ${results.test_group_breakdown.paraphrase_reuse.total} | ${results.test_group_breakdown.paraphrase_reuse.percentage}% |
| \`adversarial\` (Near-miss safety traps) | ${results.test_group_breakdown.adversarial.passed} / ${results.test_group_breakdown.adversarial.total} | ${results.test_group_breakdown.adversarial.percentage}% |

### Dev Split Summary (N=${d.work_order_overall.total})

- **Safety Gate Recall**: ${d.safety_recall.passed} / ${d.safety_recall.total} (${d.safety_recall.percentage}%)
- **Gap Detection**: ${d.gap_detection.passed} / ${d.gap_detection.total} (${d.gap_detection.percentage}%)
- **SOP Retrieval Top-1**: ${d.retrieval_top1.passed} / ${d.retrieval_top1.total} (${d.retrieval_top1.percentage}%)
- **Work Order Overall**: ${d.work_order_overall.passed} / ${d.work_order_overall.total} (${d.work_order_overall.percentage}%)

### Test Split Failures
${results.test_failures.length === 0 ? '- None (100% pass on all test split cases).' : results.test_failures.map(f => `- **[${f.id}]** \`${f.text}\` (Expected: ${f.expected.behavior}, Actual: ${f.actual.behavior})`).join('\n')}
<!-- EVAL:END -->`;

let readmeContent = fs.readFileSync(readmePath, 'utf8');

const regex = /<!-- EVAL:START -->[\s\S]*?<!-- EVAL:END -->/;
if (regex.test(readmeContent)) {
  readmeContent = readmeContent.replace(regex, tableMarkdown);
} else {
  readmeContent += '\n\n## Evaluation Results\n\n' + tableMarkdown + '\n';
}

fs.writeFileSync(readmePath, readmeContent);
console.log('README.md evaluation table successfully updated from results.json.');
