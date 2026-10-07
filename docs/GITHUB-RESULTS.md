# Oncotics GitHub test results

Verified 7 October 2026. [Passing GitHub Actions run](https://github.com/JAQA-Life/oncotics8055/actions/runs/37586441636).
Tested application commit: `f5b95873c310a311158fd2c24ba967a2353412a0`.
Complete source: [codex/scenario-lab-validation](https://github.com/JAQA-Life/oncotics8055/tree/codex/scenario-lab-validation).

| Check | Result |
| --- | --- |
| Oncotics integration tests | 32 passed |
| Preserved original MiroFish backend tests | 129 passed with container network disconnected |
| Imaging model integrity | All four SHA-256 hashes match |
| JavaScript, Python and whitespace checks | Passed |
| Orchestrator deployment image and HTTP health | Passed |
| Web deployment image, authenticated API/UI gateway and imaging route headers | Passed |
| Original MiroFish deployment image, Python 3.11 compilation and OASIS imports | Passed |
| MiroFish-Offline deployment image, private HTTP health, Python 3.11 compilation and OASIS imports | Passed |
| Neo4j 5.26 startup and Offline storage initialization | Passed |

The passing run contains five downloadable result artifacts, including JUnit
results for both test suites. Artifacts expire after seven days; the workflow
and committed report preserve the test scope and links.

GitHub testing found and fixed three deployment problems: the engine image used
Python 3.12 while OASIS requires Python below 3.12; the custom web startup command
bypassed Nginx template processing; and an unconstrained MCP SDK upgrade broke
CAMEL's simulation imports. Engine images now use Python 3.11, Nginx uses its
official entrypoint plus an API configuration hook, and MCP is constrained to
the 1.24.0 version recorded in both upstream lockfiles. Native Cairo, libmagic
and OpenMP libraries are installed. The Offline test probes HTTP inside the
private network because Docker suppresses published ports on internal networks.
Both upstream source trees and all imaging models remain unchanged.

This validates the stated tests, builds, runtime imports and startup checks.
It does not validate real Ollama/Zep/LLM simulation, ReportAgent completion,
scientific or clinical accuracy, DICOM/model inference, production HTTPS,
security hardening, backup restoration or capacity under load. The pipeline
uses synthetic integration fixtures and test-only provider sentinels. Live
acceptance remains required before public production deployment.

GitHub Actions runs the checks and is not a persistent host for the full
application. To deploy the tested code, use this branch or the updated
Oncotics-Scenario-Lab-GitHub-Tested.zip and follow docs/DEPLOYMENT.md.
