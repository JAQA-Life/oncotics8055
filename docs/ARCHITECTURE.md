# Browser architecture and scope

```text
Hostinger static site (HTTPS)
  ├── Original Oncotics pages, OHIF, Cesium, ONNX model packs
  └── /scenario-lab/
         ├── Evidence acquisition → selected public evidence APIs
         ├── IndexedDB: immutable evidence snapshots + local run records
         ├── Bounded scenario scheduler + checkpointed synthetic events
         ├── Same-origin worker → WebLLM → WebGPU on visitor's device
         │                         └── self-hosted Qwen model / WASM / tokenizer
         └── Labeled deterministic reports + JSON/text exports
```

There is no application database, external AI API, AI key, Python server or separate orchestrator deployment in this edition. `runner.mjs` orchestrates the bounded browser simulation; browser downloads are served by Hostinger. The model runs inside a dedicated worker. Worker fetches are restricted to same-origin `/assets/browser-ai/`; a per-route CSP supplies another boundary. Evidence calls omit credentials and referrers. Selected providers can still log evidence queries.

The existing public source routes and alias hints are reused for ClinicalTrials.gov, Europe PMC, UniProt, PubChem and openFDA. Up to six concepts and five sources are allowed; retrieval uses three concurrent requests with 25-second timeouts and bounded response sizes. Provider failures are explicit, without fixtures or inferred evidence. Imported source attribution is unverified.

Evidence envelopes preserve provider payloads, field locators, timestamps and SHA-256 hashes. Their graph is separate from the generated simulation graph. Aliases and query-match edges are DERIVED; they do not establish biological relationships. Integrity checks reconstruct the graph/records from receipts. Hashes detect accidental or inconsistent changes; they are not signatures and do not defeat a malicious operator or a person with browser developer access.

New scenarios use schema `oncotics-browser-scenario/2`. Their frozen seed contains at most twelve exact excerpts from known provider fields, ranked locally using lexical BM25 scoring against the question and concepts. Each excerpt retains its field locator, character offsets, receipt hash, passage hash and original provenance. Up to three excerpts per record limit source domination. Retrieval can return descriptions/abstracts where providers supply them; absent fields are never generated. Source payloads remain available for reading in context. Excerpts can omit important qualifications.

Each fixed synthetic role has its own committed history and separately labeled observations of other agents' public committed events. Before a turn, the engine selects at most three own events and three relevant observations. It uses the pinned Qwen tokenizer and chat template to count the prompt, adds a conservative schema allowance, reserves 192 output tokens and a 128-token margin within the 4,096-token context. Low-ranked evidence and memories are omitted when necessary; question and assumptions are never silently shortened. An oversized mandatory context stops the run.

Versioned rules support four actions: identify an evidence gap, challenge an explicit assumption, request verification and propose a hypothesis. An action must target a supplied evidence or assumption reference. Evidence targets must be cited. Rules update a simulated research-item queue and integer clock, never evidence records, clinical outcomes or geography. Saving precedes advancement of state, memory and progress. Events carry supplied evidence/memory IDs, prompt/schema hashes, generation settings, timings and a state hash chain. Replays verify these records against the frozen evidence. Seeds and hashes aid inspection; they do not guarantee identical outputs across devices or resist a malicious operator.

The network view shows synthetic agents, committed events, generation edges and events supplied as context. It does not represent real people, observed social ties or causal effects. Inspecting a node exposes exactly which excerpts and prior event IDs were supplied. Device diagnostics record browser buffer limits and storage estimates locally; WebGPU limits cannot establish total free GPU memory. Older schema-1 saved scenarios remain readable and resumable using their original workflow. They are not silently upgraded.

Every event is saved to IndexedDB before progress advances. A failed write does not count as completion. Pause/resume uses saved checkpoints; reloading an abandoned run marks it interrupted when no other tab holds the run lock. Web Locks prevent concurrent runs in the same browser profile. Model revisions must match before resuming. GPU memory failure, invalid JSON and unknown references stop the run. The report compiles saved events and assumptions without a second AI synthesis pass.

Reality geography displays only directly retrieved trial coordinates. Imported unverified coordinates are excluded. Simulation/difference views explain the unsupported capability and do not create inferred heat maps or geographic outcomes. Cesium is self-hosted without remote imagery/terrain in Scenario Lab.

The separately deployable original/cloud and offline MiroFish engines remain in the repository's `main` version. They have not been ported into JavaScript. This browser edition replaces their workflow and cannot claim engine equivalence, scale or unattended execution. No cloud/local engine selector or BYOK control is presented because only on-device inference is supported here.

Imaging assets and scripts remain separate. Scenario Lab does not read the imaging IndexedDB stores, DICOM data or the ONNX model input/output. Original ONNX weight hashes are verified during every build.
