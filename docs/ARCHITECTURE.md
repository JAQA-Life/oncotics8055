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

The frozen seed gives the model up to eight source titles/identifiers, bounded assumptions and two recent statements. It does not read full papers or all provider metadata. Up to five fixed synthetic stakeholder roles and four rounds yield at most twenty interactions. Prompts are bounded to 3,800 UTF-8 bytes; model context is 4,096 tokens with short, schema-constrained responses. This deliberately limits memory and device cost. The Qwen2.5 3B general-purpose model can still hallucinate or misinterpret evidence.

Every event is saved to IndexedDB before progress advances. A failed write does not count as completion. Pause/resume uses saved checkpoints; reloading an abandoned run marks it interrupted when no other tab holds the run lock. Web Locks prevent concurrent runs in the same browser profile. Model revisions must match before resuming. GPU memory failure, invalid JSON and unknown references stop the run. The report compiles saved events and assumptions without a second AI synthesis pass.

Reality geography displays only directly retrieved trial coordinates. Imported unverified coordinates are excluded. Simulation/difference views explain the unsupported capability and do not create inferred heat maps or geographic outcomes. Cesium is self-hosted without remote imagery/terrain in Scenario Lab.

The separately deployable original/cloud and offline MiroFish engines remain in the repository's `main` version. They have not been ported into JavaScript. This browser edition replaces their workflow and cannot claim engine equivalence, scale or unattended execution. No cloud/local engine selector or BYOK control is presented because only on-device inference is supported here.

Imaging assets and scripts remain separate. Scenario Lab does not read the imaging IndexedDB stores, DICOM data or the ONNX model input/output. Original ONNX weight hashes are verified during every build.
