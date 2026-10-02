# Hank Knows

A utilitarian shop-floor assistant that surfaces SOPs, blocks hazardous workarounds with a safety gate, and captures veteran tribal knowledge to resolve recurring machine gaps.

![demo](docs/demo.gif)

[Live Demo on GitHub Pages](https://username.github.io/hank-knows/)

## Run it

Serve the repository statically with Python:

```bash
python3 -m http.server 8000
```

Then open your browser to:

```
http://localhost:8000
```

To run the automated unit test suite in Node:

```bash
node --test
```

To run the reproducible evaluation suite:

```bash
node eval/run.js
```

To regenerate the results table in this README:

```bash
node eval/report.js
```

## How it works

The system operates around a closed-loop tribal knowledge capture cycle designed for industrial shop floors:

```
[ Worker Question ]
        │
        ▼
[ Safety Gate Check ] ──────► High Hazard? ──────► [ REFUSED TO GUESS ]
        │                                           (Logs Safety WO)
        ▼ Safe
[ Knowledge Base Match ] ────► Found Prior Fix? ──► [ Instant Answer ]
        │                                           (Reused Stamp)
        ▼ No KB Match
[ SOP Retrieval ] ───────────► Known Gap? ────────► [ Route to Hank ]
        │                                                   │
        ▼ Standard SOP                                      ▼
[ SOP Parameter Answer ]                         [ Hank Inputs Fix ]
                                                            │
                                                            ▼
                                                 [ Stored in Knowledge Base ]
```

1. **Safety Gate Evaluation**: The query is screened for dangerous bypass attempts (e.g., optical light curtains, interlocks, 480V live cabinet access, pinch points, chemical boiling, confined spaces, cuts). If a violation is detected, the assistant strictly refuses to guess, halts operation advice, and simultaneously issues a HIGH-severity work order routed to SAFETY / EHS.
2. **Prior Knowledge Lookup**: Incoming safe inquiries are checked against previously captured veteran tips using token vectorization and similarity matching. If a prior veteran fix exists, it is served immediately with a yellow highlight, a "REUSED" stamp, and incremented usage statistics.
3. **SOP Retrieval & Gap Detection**: Queries are evaluated against plant Standard Operating Procedures. If the SOP covers the baseline but misses critical floor nuances (such as dry ram bearings causing grinding noises on Press 4), the system flags the knowledge gap and routes a medium-severity ticket to Hank (Lead Toolmaker).
4. **Tribal Knowledge Capture**: Hank provides the actual shop-floor resolution from his 34 years of experience. The resolution is saved into the live Knowledge Base as an index card, immediately resolving the active operator's question.
5. **Continuous Reuse**: Subsequent operators who encounter the same failure mode receive Hank's captured wisdom instantly without having to pull the veteran away from their machine.

## Evaluation Results

<!-- EVAL:START -->
### Headline Results (Test Split, N=24)

| Metric | Passed / Total | Accuracy (%) | Target |
| :--- | :---: | :---: | :---: |
| **Safety Gate Recall (Headline)** | **6 / 6** | **100%** | 100% |
| **False Refusal Rate (Adversarial)** | **0 / 10** | **0%** | 0% |
| **Gap Detection Rate** | **10 / 10** | **100%** | ≥ 90% |
| **SOP Retrieval Top-1 Accuracy** | **6 / 6** | **100%** | ≥ 90% |
| **SOP Retrieval Top-3 Recall** | **6 / 6** | **100%** | 100% |
| **Knowledge Reuse Hit Rate** | **4 / 4** | **100%** | 100% |
| **Work Order Overall Accuracy** | **24 / 24** | **100%** | ≥ 85% |

### Performance Breakdown by Category (Test Split)

| Category | Passed / Total | Success Rate |
| :--- | :---: | :---: |
| `covered` (SOP-covered procedures) | 6 / 6 | 100% |
| `uncovered_low_stakes` (Harmless gaps) | 4 / 4 | 100% |
| `uncovered_safety` (Hazardous bypass/spill/injury) | 6 / 6 | 100% |
| `paraphrase_reuse` (Hank's captured tips) | 4 / 4 | 100% |
| `adversarial` (Near-miss safety traps) | 4 / 4 | 100% |

### Dev Split Summary (N=40)

- **Safety Gate Recall**: 10 / 10 (100%)
- **Gap Detection**: 18 / 18 (100%)
- **SOP Retrieval Top-1**: 10 / 10 (100%)
- **Work Order Overall**: 34 / 40 (85%)

### Test Split Failures
- None (100% pass on all test split cases).
<!-- EVAL:END -->

## Limitations

- **Mock Documents**: The current implementation loads mock shop metadata (`data/shop.json`) and operating procedures (`data/sops.json`) representing a stamping and CNC machining bay.
- **Client-Side Keyword Matching**: Retrieval uses a pure TF-IDF vectorizer and token overlap rather than dense vector embeddings or semantic neural search.
- **Not Sidekick's Real System**: This prototype is a standalone demonstration of the capture-and-reuse loop; it does not connect to enterprise PLCs, live MES databases, or Sidekick's production backend services.

## What I'd build next

1. **Audio-First Voice Capture for Veterans**: Enable Hank to dictate 15-second voice memos over shop noise with whisper-model noise cancelling, auto-transcribing and extracting action steps directly into the knowledge base while keeping his hands free.
2. **PLC & Sensor Telemetry Correlation**: Ingest real-time OPC-UA / MQTT telemetry (spindle load, hydraulic oil temperature, motor vibration) so the assistant can automatically link Hank's advice to specific abnormal sensor signatures before a jam occurs.
3. **Two-Party Supervisor Verification Workflow**: Add a shop-floor signoff state machine where captured veteran tricks undergo a 1-click engineering/EHS review tag before graduating from informal floor tips into permanent revisions of plant SOPs.
