# GitHub validation

The Oncotics validation workflow runs source/integration tests and builds each
actual deployment image separately. It checks model-file hashes and existing
JavaScript syntax. Container smoke checks cover the web/API authentication
gateway, imaging route headers, engine import/startup and the Offline engine's
Neo4j connection.

The workflow uses no paid provider credentials. Provider keys marked CI_TEST_ONLY
are sentinels, not credentials, and no graph generation or model simulation is
requested. It does not certify live local/cloud LLM behavior, Zep access, OASIS
simulation, ReportAgent completion, full browser behavior, clinical validity,
imaging inference or production capacity. Those acceptance checks remain in
DEPLOYMENT.md and VALIDATION.md.

Results are attached as seven-day GitHub Actions artifacts. Each failed build or
smoke check fails the workflow; there are no success overrides. Run manually from
Actions or push a reviewed change. This repository contains the original large
assets for the first validation snapshot; consider Git LFS or release assets for
future binary revisions to avoid growing Git history.
