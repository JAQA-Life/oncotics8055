# Verification report — 7 October 2026

## Completed

| Check | Result |
|---|---|
| New integration suite | **32 passed**; see `docs/test-results.xml` |
| Real upstream HTTP route/method assertions | Passed for both pinned engines |
| HTTP adapter multipart upload, JSON and error redaction | Passed against local HTTP fixture |
| Evidence integrity, path traversal rejection and per-user access | Passed |
| CSRF, trusted proxy authentication, explicit research/cloud confirmations | Passed |
| Concurrent idempotent job creation and atomic claims | Passed |
| Evidence → graph → personas → simulation → report → provenance pipeline | Passed with explicit synthetic engine fixtures; not a live LLM test |
| Cancellation, initialization failures and agent-budget failure | Passed |
| Narrative attempting to label itself FACT | Remains SIMULATED |
| Geographic evidence/graph reference integrity | Passed |
| Live public source adapter smoke checks | ClinicalTrials.gov, Europe PMC, UniProt, PubChem and openFDA all returned HTTP 200 and parsed records |
| Deployment YAML syntax and boundaries | Parsed; private simulation network is internal; no engine/API/Neo4j/Ollama host ports |
| Python syntax | Orchestrator, tools, tests and both complete upstream backend trees compile |
| JavaScript syntax | Scenario Lab script and existing workspace/imaging inline scripts pass Node syntax checks |
| Four input ZIP preservation | All supplied files included; OHIF/ORT/model files unchanged byte-for-byte; intentional site HTML/navigation/sitemap edits only |
| Four model checksums | Match each original pack's declared SHA-256; see `docs/model-integrity.json` |
| Complete upstream source preservation | 128 cloud and 102 Offline source files identical to downloaded pinned archives; see `docs/upstream-integrity.json` |
| Browser smoke test | Scenario Lab loads with Oncotics styling, evidence/difference empty states and disabled execution when API absent; original Imaging Workbench loads and recognizes all four model packs |

The initial openFDA probe exposed a query-encoding issue: literal URL `+` separators passed through parameter encoding became `%2B`. The adapter now passes space-separated search clauses, preserving the [official openFDA query syntax](https://open.fda.gov/apis/query-syntax/). The final smoke check returned one source label for the public osimertinib/Tagrisso query. No test source records are inserted into the shipped UI.

Public-source smoke probes used PSMA/FOLH1 and osimertinib only. Final observed bounded results were ten ClinicalTrials.gov studies with nineteen source coordinates, ten Europe PMC records, ten UniProt records, one PubChem record and one openFDA label. These counts describe this test query/result window, not complete coverage or medical evidence. Public data may change after this report.

## Environment limitations and unverified checks

- Docker was not installed on the build host. No Docker images were built, no Compose services were started, and Nginx/container health or Compose interpolation was not executed. YAML parsing is not a substitute for `docker compose config`, image build and runtime acceptance.
- No real local or cloud LLM simulation was run. Ollama model loading, Neo4j initialization/vector dimensions, OASIS execution, real persona ontology adherence, Zep service behavior, credentials/quotas and ReportAgent tool execution require the deployment acceptance checks in `docs/DEPLOYMENT.md`.
- The upstream original repository's auxiliary root test suite ran: **26 passed, 2 blocked by Windows symlink privilege** (`WinError 1314`). These are repository star-history tests, unrelated to the new scenario workflow; upstream tests/source were preserved without edits.
- The upstream original backend suite was attempted and stopped at collection because `flask_cors` and the rest of the full engine dependency environment were not installed locally. The engine Dockerfiles install their own declared requirements. The Offline repository has no comparable bundled test suite in this snapshot.
- There is no existing site build or lint configuration; the site is prebuilt static HTML/JavaScript, and OHIF/ORT are supplied bundles. Source syntax, preservation checks and the new integration test suite were run instead. A full OHIF source build cannot be run from these ZIPs.
- Browser verification did not load patient/DICOM files or execute model inference. The original imaging page and model catalog worked; inference and DICOMweb regressions must still be tested on the deployed HTTPS origin with consented/deidentified test data.
- Cesium reality rendering with a full authenticated evidence snapshot was not exercised in the browser. Structured coordinate parsing and graph-reference tests passed, but runtime globe rendering and fallback should be part of target-host acceptance.

This package provides the integration source and deployment configuration. It is **not a claim that the complete deployment has passed production acceptance**.

## Reproduce integration checks

Use an isolated Python 3.12 environment at project root:

```sh
python -m venv .venv
# activate your environment as appropriate for your platform
pip install -r requirements-test.txt
python -m pytest tests -q
python -m compileall -q services/scenario-orchestrator
node --check scenario-lab/lab.js
python tests/live_sources.py
docker compose config --quiet
```

`tests/live_sources.py` contacts public sources but invokes no simulation model. Engine/backend test environments should be installed and run separately from the orchestrator environment because both upstream repositories use the Python package name `app`.
