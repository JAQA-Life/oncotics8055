# Research and provenance boundaries

Scenario Lab is a public-evidence research tool. It does not make medical recommendations and must not be used to determine treatment, diagnosis, eligibility, safety, efficacy, regulatory approval, reimbursement or supply procurement. Simulation output is not evidence of what will happen.

| Label | Allowed meaning | Construction |
|---|---|---|
| FACT | A source-reported field in a preserved public response | Record title/identifier/coordinate, exact source URL, receipt, JSON locator and response hash |
| DERIVED | An explicitly documented transformation | Alias routing hint, query-match edge, deterministic record/agent count |
| ASSUMPTION | A researcher-stated hypothetical condition | Validated explicit assumption list, never promoted automatically |
| SIMULATED | Synthetic engine output | Every persona, action, generated graph, upstream narrative and report statement |

FACT does **not** mean independently verified scientific truth or a supported clinical interpretation. Records may be stale, incomplete, incorrect, irrelevant or contradictory. Alias hints are not confirmed entity matches. Source counts are bounded retrieved occurrences, not exhaustive totals. A label search is not an approval determination. Trial coordinates are source-reported public sites, not patient locations or utilization/capacity data.

The provenance auditor is a deterministic boundary, not an LLM clinical fact-checker. No engine sentence is promoted by a model classification, citation string or textual similarity. It can list exact source fields as FACT, documented deterministic transformations as DERIVED, submitted assumptions as ASSUMPTION, and model narrative as SIMULATED. It does not verify the medical validity of claims or certify safety.

Researchers must review evidence/coverage before creating a run. The API enforces non-empty recent snapshots, a bounded assumption list, public-data/research confirmations, explicit cloud consent, engine selection, maximum rounds and an agent budget. Input checks reject common personal identifiers and patient-context patterns before persistence or provider access. These checks are conservative heuristics, not comprehensive PHI detection; the service accepts public concepts only and provides no patient/file-upload pipeline.

Private mode keeps model and graph execution on the sample isolated local network. Evidence retrieval contacts the selected public sources and sends public search concepts. Cloud mode sends a compact seed containing source fields/locators, question and assumptions to configured external services. There is no silent fallback from local to cloud. Existing imaging remains separate and no images, DICOM files or imaging model outputs are read by Scenario Lab.

All agents are synthetic, including names resembling real individuals. Profiles are neither verified professional identities nor clinical advice. The action inspector shows returned synthetic interactions only. Full memory, private reasoning and per-agent evidence-access counts are not inferred. World simulation/difference modes are empty unless a future adapter defines source-linked structured geographic deltas; free-form narrative cannot create geographic observations.

Source text and model outputs are untrusted content. The frontend escapes displayed text and does not render upstream HTML/Markdown as executable content. Source redirects are not followed. Evidence has a separate read-only worker mount and no simulation-to-evidence promotion path.
