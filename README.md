# Oncotics with Scenario Lab

This is the complete reconstructed Oncotics site from all four supplied ZIPs, plus the `/scenario-lab/` frontend, an authenticated Oncotics API/orchestrator, and the actual source code of two separately deployed MiroFish engines. Existing OHIF, ONNX Runtime and trained model assets are included.

Start with **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. Read **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**, **[docs/RESEARCH-SAFEGUARDS.md](docs/RESEARCH-SAFEGUARDS.md)** and **[docs/VALIDATION.md](docs/VALIDATION.md)** before operating the service.

The site retains its static architecture and navy/teal branding. Scenario Lab requires a backend host. Uploading the project to a static-only hosting account does not start simulations. Do not upload `services`, `deploy`, tests, credentials or runtime data into a public web root.

## Included

- Original public evidence workspace and imaging pages; navigation additions only, with a privacy disclosure and homepage card.
- All supplied OHIF and ONNX Runtime files, unchanged. All four model packs, unchanged, located at `/assets/models/` as the imaging page expects.
- Evidence-first scenario creation, source receipts, entity alias hints, immutable hashed snapshots, explicit assumptions, local/cloud selection, cloud consent, durable job queue, bounded progress/action inspection, synthetic personas, reports and JSON exports.
- FACT / DERIVED / ASSUMPTION / SIMULATED provenance. Engine text can never promote itself into evidence, including text that claims to be a FACT or cites a source.
- Source-backed trial coordinates using the existing self-hosted Cesium build. Simulation and difference modes explicitly show no supported geographic deltas; neither pinned upstream engine supplies those data.
- Separate original MiroFish/cloud and MiroFish-Offline/local containers. Offline Neo4j and Ollama have an internal network with no internet route during runs. Public evidence retrieval still contacts the selected providers.

## Important capability limits

These engines simulate social-agent interactions. They are not validated oncology, pharmacology, radiophysics, clinical-outcome, approval or supply-capacity models. The adapter passes labeled source titles, identifiers, source-reported coordinates, routing hints and assumptions to the model seed; full records are preserved in snapshots/exports but excluded from the compact seed. Agent budgets are maximum limits, not exact persona counts. Private reasoning, complete per-agent memory, evidence-access inventories and geographic deltas are not exposed or inferred by this integration.

The supplied application had no nuclear-medicine backend, canonical server graph or NNDC adapter. This integration reuses existing source endpoints and extracted alias dictionaries; it does not invent missing services. The five initial server adapters are ClinicalTrials.gov, Europe PMC, UniProt, PubChem and openFDA label search. Other existing browser-side sources remain available in the original workspace.

## Upstream source and licensing

Preserved repositories:

- `services/mirofish-cloud`: https://github.com/666ghj/MiroFish at `7657031ac01184afe2cb220f5ee3545573b5e843`.
- `services/mirofish-offline`: https://github.com/nikmcfly/MiroFish-Offline at `313fe642853ff9fff05e3ecae2e439886c2d29f4`.

Their source trees remain unmodified. `deploy/engine_wsgi.py` is an external entrypoint copied into each engine image. Engine frontends remain available as source; the deployed user-facing frontend is Oncotics. See **[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)** and each upstream LICENSE. New Scenario Lab integration code is supplied under AGPL-3.0-or-later. Original Oncotics files and model assets retain their existing notices; no blanket relicensing is asserted.

The visible source offer is `/scenario-lab/source-code.zip`. Regenerate it from the deployed sources after any integration or engine modification using `python tools/package_release.py`. Consult the AGPL text and review the exact deployment/license obligations; separate containers are not an exemption from source-availability obligations.

## Verification status

See `docs/VALIDATION.md` for executed tests and limitations. Docker/container startup and real model-backed end-to-end runs were unavailable on the build host. These are release acceptance checks to complete in the target environment, not claimed successes.
