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

To run the automated test suite in Node:

```bash
node --test
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

1. **Safety Gate Evaluation**: The query is screened for dangerous bypass attempts (e.g., optical light curtains, interlocks, 480V live cabinet access, pinch points, chemical boiling). If a violation is detected, the assistant strictly refuses to guess, halts operation advice, and simultaneously issues a HIGH-severity work order routed to SAFETY / EHS.
2. **Prior Knowledge Lookup**: Incoming safe inquiries are checked against previously captured veteran tips using token vectorization and similarity matching. If a prior veteran fix exists, it is served immediately with a yellow highlight, a "REUSED" stamp, and incremented usage statistics.
3. **SOP Retrieval & Gap Detection**: Queries are evaluated against plant Standard Operating Procedures. If the SOP covers the baseline but misses critical floor nuances (such as recurring 5052 aluminum coil galling during humid shifts), the system flags the knowledge gap and routes a medium-severity ticket to Hank (Lead Toolmaker).
4. **Tribal Knowledge Capture**: Hank provides the actual shop-floor resolution from his 34 years of experience. The resolution is saved into the live Knowledge Base as an index card, immediately resolving the active operator's question.
5. **Continuous Reuse**: Subsequent operators who encounter the same failure mode receive Hank's captured wisdom instantly without having to pull the veteran away from their machine.

## Limitations

- **Mock Documents**: The current implementation loads mock shop metadata (`data/shop.json`) and operating procedures (`data/sops.json`) representing a stamping and CNC machining bay.
- **Client-Side Keyword Matching**: Retrieval uses a pure TF-IDF vectorizer and token overlap rather than dense vector embeddings or semantic neural search.
- **Not Sidekick's Real System**: This prototype is a standalone demonstration of the capture-and-reuse loop; it does not connect to enterprise PLCs, live MES databases, or Sidekick's production backend services.

## What I'd build next

1. **Audio-First Voice Capture for Veterans**: Enable Hank to dictate 15-second voice memos over shop noise with whisper-model noise cancelling, auto-transcribing and extracting action steps directly into the knowledge base while keeping his hands free.
2. **PLC & Sensor Telemetry Correlation**: Ingest real-time OPC-UA / MQTT telemetry (spindle load, hydraulic oil temperature, motor vibration) so the assistant can automatically link Hank's advice to specific abnormal sensor signatures before a jam occurs.
3. **Two-Party Supervisor Verification Workflow**: Add a shop-floor signoff state machine where captured veteran tricks undergo a 1-click engineering/EHS review tag before graduating from informal floor tips into permanent revisions of plant SOPs.
