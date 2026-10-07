# Oncotics Browser Scenario Lab

Complete static Oncotics site with a WebLLM/WebGPU Scenario Lab at `/scenario-lab/`. Qwen2.5 3B Instruct (`q4f32_1`), compiled runtime and tokenizer files are self-hosted. Prompts never go to an external AI API. Public evidence APIs remain enabled.

This edition implements the approved browser-only rewrite. It does **not** execute the Python MiroFish engines, OASIS, Neo4j or Ollama. The original engine integration remains on the `main` branch; this edition is on `codex/browser-ai-edition`.

Upload the prebuilt `Oncotics-Hostinger-Upload.zip` contents to your domain's web root. Read [the Hostinger guide](docs/HOSTINGER-UPLOAD.md). No VPS, API key, AI account, server database or persistent Node.js process is needed.

Existing Oncotics branding, oncology workspace, globe, OHIF viewer, ONNX runtime and four original imaging model packs are retained. Model hashes are checked during the build. This is research software; no medical or clinical validation is implied. Qwen2.5 3B uses a non-commercial research license by default; commercial use requires a separate license from Alibaba Cloud. Plan for roughly 1.8 GB of initial model downloads and about 3 GB GPU memory plus headroom. Keep the included model license and attribution notice.

## Build and verify

Requires Node.js 24 for development/builds only.

```sh
npm ci --ignore-scripts
npm test
npm run vendor
npm run build
npx playwright install --with-deps chromium
npm run test:browser
python3 tools/package-release.py
```

The prebuilt complete project includes the acquired files, so `npm run vendor` can be omitted when rebuilding that package. The GitHub source branch does not commit the large new AI model weights: acquisition is required when building from GitHub. Model acquisition uses public artifact repositories at build time, not AI inference APIs. The release records the exact model revision, runtime version, asset hashes and build commit. The release's `package-lock.json` pins npm dependencies.

`npm run preview` serves a local preview at `http://127.0.0.1:4173`. It is a development file server, not a simulation or AI backend. In production Hostinger serves the static files over HTTPS.

See [architecture](docs/ARCHITECTURE.md), [research safeguards](docs/RESEARCH-SAFEGUARDS.md), [notices](docs/THIRD-PARTY-NOTICES.md) and [release checks](docs/VALIDATION.md).
