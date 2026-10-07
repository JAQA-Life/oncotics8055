# Deployment and operation

## Prerequisites

- Docker Engine/Desktop with Compose v2, a Linux container host, adequate disk space for OHIF/model assets and Python dependencies, and sufficient RAM/CPU/GPU for the chosen Ollama model.
- HTTPS reverse proxy in front of the loopback-bound web container. Set `SCENARIO_PUBLIC_ORIGIN` to the exact HTTPS origin users will access. The sample does not provision certificates or DNS.
- Choose a model license and hardware footprint suitable for your organization. The sample model names are configuration defaults inherited from upstream, not medical endorsements. GPU support is optional; for NVIDIA, add the standard Docker GPU reservation/device configuration to the Ollama service on a host with its driver/runtime installed.

## Configure

1. Extract the project. Copy `.env.example` to `.env`. Generate distinct strong secrets (minimum 32 characters) for `SCENARIO_PROXY_SECRET`, `SCENARIO_CSRF_SECRET`, `LOCAL_ENGINE_SECRET` and `NEO4J_PASSWORD`. Set `SCENARIO_PUBLIC_ORIGIN`. Keep cloud disabled for initial local deployment.
2. Create `deploy/auth/` and its Nginx password file. For example, on a shell with Docker available:

   ```sh
   mkdir -p deploy/auth
   docker run --rm -it -v "$PWD/deploy/auth:/auth" httpd:2.4-alpine htpasswd -cB /auth/htpasswd researcher
   ```

   This prompts for the password. Use unique accounts for each researcher. Add more accounts with `htpasswd -B` **without** `-c` to avoid overwriting the file. Do not put plaintext passwords into shell arguments. This Basic-auth example relies on HTTPS; an organizational SSO gateway can replace it, retaining a trusted server-generated identity and the private proxy header secret.
3. Run `python tools/preflight.py`. It validates required configuration; it does not start services or call models.
4. Preload the configured local LLM and embedding models:

   ```sh
   docker compose --profile setup run --rm local-model-loader
   ```

   This temporary loader has internet access to download models. It uses the shared model volume, then exits. The normal Ollama and Offline engine run only on an internal Docker network. If using existing private model infrastructure, review/adjust those networks explicitly; an external model endpoint does not qualify as private/local execution.
5. Build and start:

   ```sh
   docker compose config --quiet
   docker compose build
   docker compose up -d
   ```

6. Route your HTTPS origin to `127.0.0.1:8080`. The static site is public; `/scenario-lab/` and `/api/scenarios` require authentication. The source archive is publicly readable. No engine, Neo4j or Ollama port is published to the host.

The web entrypoint substitutes only `SCENARIO_PROXY_SECRET`; Nginx's `$remote_user`, `$host` and other variables remain Nginx variables. The API rejects requests without the private proxy header and authenticated username. Keep the API off public ingress, and never accept client-provided identity headers in an external gateway. `X-CSRF-Token` is tied to the authenticated user; modifying requests from other origins are rejected.

## Enable cloud separately

Set `CLOUD_ENGINE_SECRET`, `CLOUD_LLM_API_KEY`, `CLOUD_LLM_BASE_URL`, `CLOUD_LLM_MODEL` and `ZEP_API_KEY` in `.env`, then set `ENABLE_CLOUD_ENGINE=true`. Use a configured compatible provider with sufficient quota. Run:

```sh
python tools/preflight.py
docker compose --profile cloud build
docker compose --profile cloud up -d
```

The original MiroFish service uses its own upload volume and external graph/model configuration. It shares no database or files with Offline. Cloud consent is enforced by both frontend and API. The UI status means the service's health endpoint responded, not that credentials, quotas, model capabilities or Zep connectivity were fully validated. Complete a small acceptance run before enabling researcher access.

## Existing static/Hostinger deployment

The original `.htaccess` stays intact. Upload only original static files/directories and `scenario-lab/` to the existing site; do not expose the source project directory indiscriminately. Model packs belong at `/assets/models/`. A VPS/container backend and a same-origin authenticated reverse proxy for `/api/scenarios` are required. Ordinary shared hosting cannot run the Python engines, Neo4j and Ollama by uploading ZIPs. Copy the authentication/identity-header behavior from the sample Nginx configuration into your actual reverse proxy and point to the Scenario API. Static-only preview disables runs explicitly.

Nginx in the sample retains the OHIF client-route fallback and imaging cross-origin isolation headers. Keep the existing page-specific CSPs, correct WASM MIME types and `Cross-Origin-Embedder-Policy: credentialless` for imaging and OHIF. Test DICOM loading, workers and inference on the deployed origin before release.

## Acceptance checks on the target host

1. Check `docker compose ps`, logs and the API's internal `/health` endpoint. Verify the worker heartbeat makes runs available in the UI. Model pulls must have finished.
2. Retrieve one public concept from a few providers. Check source URLs/locators, empty/unavailable states and owner-isolated history using two accounts.
3. Run a small one- or two-round local scenario. Check graph build, generated count/budget, personas, action progress, memory updates in simulation storage, ReportAgent completion and SIMULATED report labels. Inspect configured model names/digests and the exported snapshot/seed hashes.
4. Repeat a small cloud run only after configuring credentials and enabling the profile; verify cloud consent and external service billing/quota behavior.
5. Cancel a running scenario and restart the worker during a separate test run. Verify visible failure/recovery states and inspect upstream tasks for cleanup. No duplicate POST replay should occur.
6. Check source download and AGPL notices against the exact deployed version. Rebuild source archive after changes.
7. Check original evidence search, OHIF/DICOMweb viewer routes, ONNX Runtime workers and all four model-pack loaders on the deployed HTTPS origin. Hash preservation checks do not constitute successful runtime inference tests.

## Operations

- Supported capacity: **one worker and one WSGI process per engine**. Upstream task registries are in memory. Do not raise engine process counts or scale worker replicas without replacing task coordination and testing upstream behavior. The SQLite volume must use a local filesystem with working locking/WAL semantics.
- Persistent volumes: `scenario-data`, `evidence-data`, `offline-data`, `cloud-data`, `neo4j-simulation-data/logs` and `local-models`. Back up consistently. Engine data may contain synthetic discussions plus copies of public seed material. Worker has read-only evidence access.
- The worker does not retry ambiguous mutating engine operations. Interrupted jobs are failed visibly. Inspect stored stage IDs and upstream volumes/logs; ontology/build/report tasks can finish after API timeout or cancellation. Clean up orphaned tasks before rerunning a scenario.
- Research queries and reports are server-persisted. Configure user/account policy, source terms, retention, backup retention and deletion with your organization. There is no default automatic retention or destructive deletion API. Stop workers before operator-managed snapshot/job deletion; preserve audit records when required.
- Keep engine logs restricted: upstream code can log request bodies/errors. This API redacts upstream error/traceback bodies before returning errors to browsers. Do not send sensitive information in the first place.
- Tags in the sample are explicit but not immutable digests. Upstream dependency ranges remain as provided. For a reproducible deployment, resolve and record container digests, scan images/dependencies and lock tested transitive dependencies on the target build platform. Container builds were not executed on the package host.
