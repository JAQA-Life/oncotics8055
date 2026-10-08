# Oncotics Scenario Lab v2 — complete browser edition

The full website and complete project ZIPs include Qwen2.5 3B model weights, the existing Oncotics UI, OHIF and four unchanged imaging model packs. No earlier ZIP or patch is required.

Implemented improvements:
- Relevant, exact provider-field excerpts selected by local lexical BM25 ranking, with source field pointers, character offsets, receipt hashes and provenance. Preview the selected excerpts before running. Europe PMC requests the documented core response; unavailable fields are never invented.
- Separate per-agent own-event memory and other-agent observations under an explicit public-rounds policy. Each event records exactly which earlier events and source excerpts were supplied.
- Hash-checked Qwen tokenizer budgeting in the dedicated worker. Mandatory question/assumptions are retained; optional excerpts/observations are removed when necessary. The budget reserves schema allowance, output and a safety margin.
- Four validated research actions: identify a gap, challenge an explicit assumption, request verification, and propose a hypothesis. Versioned rules update simulated bookkeeping with a replayable state hash chain; source evidence remains separate.
- Live SVG event network and timeline, keyboard-accessible event inspection, source/context audits, agent memory inspection, reports and exports.
- Local GPU feature/buffer/storage diagnostics, per-event generation settings, token metrics and elapsed times. Measurements do not guarantee available VRAM, speed or scientific confidence.

Original saved scenarios remain available in their original execution format. New scenarios use schema v2. The imaging databases are not migrated or cleared.

Back up the website. Extract Oncotics-Hostinger-Upload.zip directly into the domain's public_html, replace matching files including .htaccess, purge hosting/CDN cache and refresh /scenario-lab/. Do not clear browser storage. Read HOSTINGER-UPLOAD.md for File Manager and Web App deployment settings.

Inference stays on the visitor's WebGPU device; no external AI inference API or simulation backend is used. Public evidence queries reach the selected public providers. This is a browser reimplementation, not execution of the Python MiroFish/OASIS engines. No clinical prediction or geographic outcome validation is claimed. Qwen 3B has a non-commercial research/evaluation license; commercial use requires a separate model license.

Release publication requires unit/failure/legacy regressions, current browser graph/memory/export checks, real Qwen loading/token budgeting and a real schema-v2 model-generated action on explicitly synthetic test evidence, plus full model/static/imaging asset checks and ZIP CRC/hash verification. The software-GPU CI run is a functional test, not a visitor-device speed or clinical-quality benchmark. Exact results and hashes accompany the release.
