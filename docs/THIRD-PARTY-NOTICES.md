# Source and dependency notices

The new Browser Scenario Lab integration is offered under AGPL-3.0-or-later; see the included `LICENSE`. The published site offers its corresponding integration source at `/scenario-lab/source-code.zip`. Keep that link and source archive when hosting the site. Existing Oncotics content/assets retain their existing notices; do not assume the integration license overrides upstream asset/model terms.

- WebLLM npm package `@mlc-ai/web-llm` 0.2.79: Apache-2.0. Source: https://github.com/mlc-ai/web-llm. Included license and its dependency notices are under `assets/browser-ai/licenses/`. Worker/client bundles include source maps and preserved license comments.
- MLC-LLM compiled browser model library: Apache-2.0. Source: https://github.com/mlc-ai/mlc-llm and https://github.com/mlc-ai/binary-mlc-llm-libs. The exact compiled model URL and SHA-256 are recorded in the manifest.
- Qwen2.5-0.5B-Instruct, MLC quantization `q4f32_1`: Apache-2.0. Model source: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct and quantized files https://huggingface.co/mlc-ai/Qwen2.5-0.5B-Instruct-q4f32_1-MLC. The included manifest pins the downloaded model revision and checksums. Qwen license is included locally.
- Existing OHIF viewer, Cesium and ONNX Runtime retain their bundled license files, original notices and attribution. Their assets are preserved from the original Oncotics package.
- The four existing imaging model packs retain each pack's model card/license and research-use restrictions under `assets/models/`. Do not infer commercial or clinical clearance from the scenario integration.
- esbuild and Playwright are development/test dependencies with their upstream licenses, pinned through package-lock in the release. They are not simulation services.

This browser upload contains no MiroFish, OASIS, Zep, Neo4j or Ollama executable services. Their original source and notices remain in the separate engine version in the repository's main branch. Do not present this rewrite as execution of those engines.

The complete project and exact build identifiers are included in the release. Acquisition URLs are build-time provenance. Published model inference uses locally hosted files and the visitor's GPU.
