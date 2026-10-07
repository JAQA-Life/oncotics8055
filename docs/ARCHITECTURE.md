# Reconstructed application and integration

## Four inputs

1. `oncotics-part1-site V9.zip`: the static homepage and informational pages, a large standalone HTML/JavaScript precision-oncology workspace, the imaging workbench, styles/images, the self-hosted Cesium runtime and static Apache configuration. No root package manager or backend exists in this input.
2. `oncotics-part2-ohif.zip`: prebuilt OHIF bundles, assets and viewer configuration under `assets/ohif`. It is not a buildable OHIF source checkout.
3. `oncotics-part3-ohif-ort.zip`: prebuilt ONNX Runtime browser artifacts and WASM files under `assets/ohif/ort`.
4. `oncotics-ai-model-packs (2).zip`: four model folders, ONNX weights, manifests, documentation and licenses. The imaging page's `PACK_BASE` is `/assets/models/`; the archive's top-level pack folders were placed there without byte changes.

`docs/input-manifest.json` records archive hashes and preservation checks. Imaging page script/style blocks are unchanged. Navigation links were added to the existing HTML pages, along with a homepage Scenario Lab card, sitemap entry and a Scenario Lab-specific privacy disclosure. No OHIF bundle, WASM file, model weight, model manifest or existing Cesium asset was edited.

## Runtime boundary

```text
Browser: existing static Oncotics + /scenario-lab/
  |
  | same-origin /api/scenarios, authenticated at Nginx
  v
Oncotics Scenario API ---- writes --> evidence-data (frozen JSON snapshots)
  |                                  ^ read-only mount for worker
  | durable jobs                     |
  v                                  |
scenario-data SQLite <--> Scenario worker (one deployment process)
                             |                    |
                             v                    v
                      MiroFish-Offline       Original MiroFish
                      private network       cloud egress network
                       |       |                  |
                       v       v                  v
                     Neo4j   Ollama         Zep + configured LLM
                     simulation only
```

The browser receives normalized results through Oncotics. Engine URLs and credentials are server-side. There is no browser engine proxy and no arbitrary endpoint/URL input. The API exposes only Oncotics operations. A separately authenticated trusted reverse proxy establishes `X-Oncotics-User`; its private shared header secret is required by the API. Users cannot choose an owner in their JSON payload. All snapshot/scenario/export/cancellation reads are owner-scoped.

The authoritative evidence graph is a frozen provenance graph within the JSON snapshot, rather than another Neo4j database: source record nodes, resolved query-hint nodes and explicitly DERIVED `retrieved_for_query` edges. Such edges assert retrieval relevance only. No clinical relationship is inferred from co-occurrence. The worker mounts this volume read-only. Neither MiroFish graph nor generated report writes back into evidence. If adding a Neo4j evidence service later, use another instance and distinct credentials; never reuse simulation storage.

## Evidence and entity resolution

`entity-aliases.json` was extracted from the existing workspace's GENE_ALIASES and DRUG_BRANDS maps (including extensions such as PSMA → FOLH1). These remain routing hints. No database-confirmed canonical entity identity is asserted. Public source IDs are preserved on retrieved records; researchers must review relevance and ambiguity before running.

The initial backend adapters use the same providers/endpoints already present in the source application. Each source/concept request preserves timestamp, request URL, response status, exact raw JSON payload and SHA-256 hash. Record fields carry receipt IDs and JSON locators. Search failures and empty results are represented explicitly and never replaced with demo records. There is a bounded search per source/concept (generally ten records, five labels), so counts reflect retrieved occurrences, not complete database totals or a systematic review.

Evidence snapshots have UUID filenames and no update API. Their hashes are verified before use and export. Only snapshot owner/source data are persisted, not arbitrary uploaded files. A run includes the source snapshot hash, compact seed hash, upstream repository commit, configured model names, explicit specification, stage IDs and timestamps. Model weights/provider revisions are not automatically fingerprinted; operators should record image digests and Ollama model digests for acceptance.

## Run pipeline and actual upstream contracts

1. Researcher retrieves evidence through `POST /api/scenarios/evidence`, inspects coverage/records and acknowledges review.
2. `POST /api/scenarios` validates public-data/research confirmations, cloud consent, assumption list, agent/round bounds, owner and snapshot age/contents. A UUID idempotency key avoids duplicate job creation. The response is a durable queued job, not a long simulation request.
3. Worker constructs a compact source-field seed and calls upstream multipart `POST /api/graph/ontology/generate` with `files`, `project_name`, `simulation_requirement` and `additional_context`.
4. `POST /api/graph/build`, then `GET /api/graph/task/{task_id}` and `GET /api/graph/project/{project_id}`.
5. `GET /api/simulation/entities/{graph_id}?enrich=false` checks the extracted count before expensive profile generation. No exact agent-count setting is invented.
6. `POST /api/simulation/create`, `POST /api/simulation/prepare`, `POST /api/simulation/prepare/status`, then `GET /api/simulation/{simulation_id}/profiles?platform=reddit`.
7. `POST /api/simulation/start` with platform `parallel`, bounded `max_rounds` and memory updates enabled only for the separate simulation graph.
8. Poll `GET /api/simulation/{simulation_id}/run-status` and its bounded `actions` endpoint. The frontend polls the Oncotics API, never either upstream engine.
9. `POST /api/report/generate`, `POST /api/report/generate/status`, `GET /api/report/{report_id}` and `GET /api/graph/data/{graph_id}`.
10. Deterministic provenance auditing, persisted normalized report, JSON export and completion.

Both pinned sources were inspected; route/method assertions check these actual operations. Multipart and JSON adapter behavior is tested against a local HTTP fixture. These checks do not replace an actual paid/local-model integration test.

## Queue and recovery

SQLite transactions serialize job creation and claims. Each owner can have at most three active jobs; source retrieval is limited to six snapshots/hour/user and API traffic is rate limited at Nginx. The supported deployment uses one worker and one process per engine (upstream task registries are process-local). The worker serializes long engine jobs, persists stage IDs, sends heartbeats and has an execution deadline. Mutating engine calls are never automatically retried because their effects/costs may be ambiguous after a timeout.

After worker restart, running jobs fail visibly and are not replayed. A stop request is attempted for recorded simulation IDs. Graph/ontology/report tasks may still finish upstream and need operator cleanup. Cancellation is checked between engine calls/polls and is not instantaneous. No report is presented as completed after cancellation. Horizontal worker scaling, automatic graph-task cancellation, arbitrary agent-count controls and distributed queue support are outside this implementation.

## Frontend and geographic views

The six panels are Overview, Evidence, Agents, Simulation, World and Report. Engine personas/actions/graphs are always SIMULATED. Agent inspection shows the exact returned profile and a bounded action window; it does not fabricate full memory, private reasoning or evidence-access inventories.

The seed includes five explicitly SIMULATED stakeholder role templates (researcher, trial sponsor, medical physicist, supply analyst and regulatory observer). Ontology instructions reserve `ScenarioStakeholder` for these hypothetical actors; entity reading and profile preparation filter to this type. Real source people, molecular entities and trial records are context, not verified personas. The extracted/generated count is checked against the researcher's budget; no exact population-count API is invented. The model's adherence to this ontology must be checked during acceptance.

Reality mode renders only source-provided ClinicalTrials.gov coordinates with the existing local Cesium ES module and a source table fallback. No external tile provider/geocoding or device location is used. Simulation/difference modes are explicit unsupported-data states because the engines return social interaction data, not validated spatial deltas. Do not derive new trial sites or capacity changes from narrative text.

Existing browser evidence sources remain directly browser-queried as before. Only Scenario Lab is server-backed. Existing imaging/model interfaces remain independent and never supply patient images to the scenario service.
