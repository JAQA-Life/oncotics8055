# Complete Oncotics browser edition replacement

Download **Oncotics-Hostinger-Upload.zip** for Hostinger File Manager. This is the whole website, including Qwen2.5 3B weights, original imaging/OHIF/model packs, notices and corresponding source. No earlier ZIP or patch is needed.

Back up the current website. Extract this ZIP directly into the domain's `public_html` folder and replace matching files, including `.htaccess`. Purge the hosting/CDN cache and reload `/scenario-lab/`. Do not clear browser storage: saved scenarios and imaging data are stored on your device.

Included fixes:
- Structured GPU/worker errors retain their message instead of displaying `[object Object]`.
- Evidence geography uses the actual Cesium ES module and bundled reference imagery. Only direct source-reported coordinates become FACT markers; empty evidence displays a globe and an explanation.
- Same-site model requests retain same-site browser verification cookies. JSON/model delivery checks identify HTML error/challenge pages and name the affected file before JSON parsing or caching.
- Runtime version URLs refresh the changed scenario modules and worker.

The package cannot change hosting rules that replace assets with browser-check HTML. If this persists, use the named file to check the extracted path and ask hosting support to correct its static-file delivery/browser-check configuration. Do not turn off website security globally.

AI runs in the visitor's compatible WebGPU browser, with no external AI inference API or simulation backend. It is the browser edition, not execution of the Python MiroFish engines. Qwen 3B uses a non-commercial research license; this product is research-only and has no validated clinical predictive claims.

Validation: current unit, actual Qwen model loading through the new file-delivery checks, pinned SDK worker, real Cesium rendering, injected GPU failure/checkpoint and hosting HTML UI regressions plus full original/model asset integrity checks. Actual Qwen 3B inference passed on the matching base model release and is documented separately; this update did not repeat that inference or validate the visitor's GPU/Hostinger configuration. Full results and SHA-256 sums are included.
