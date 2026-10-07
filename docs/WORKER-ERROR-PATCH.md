# Patch the hidden browser simulation error

This patch applies to the Qwen2.5 3B browser edition (base release browser-ai-qwen3b-v1-37613223926). It preserves structured worker/GPU error messages that were reduced to "[object Object]", makes saved-run errors readable, and refreshes the changed scripts. It does not establish the cause of your GPU/runtime failure or make an unsupported device compatible. No fallback AI or external inference API is added.

It also fixes Evidence geography by importing the included Cesium ES module rather than its browser-script bundle. The globe uses the existing locally hosted Natural Earth II reference tiles and remains visible when a snapshot has no coordinates. Markers still require coordinates retrieved directly from ClinicalTrials.gov; unverified imported locations and generated predictions are not plotted. No external map API is added.

1. Export any scenarios you want to keep. Back up the domain files before replacing them. Stop active runs and close all Scenario Lab tabs.
2. In Hostinger File Manager, open the domain's public_html and upload Oncotics-Qwen3B-Worker-Error-Patch.zip. Extract directly into public_html and replace the matching files. There must not be a nested public_html folder.
3. Retain the included .htaccess. Purge the Hostinger/CDN site cache, then open https://oncotics.com/scenario-lab/ in a new normal browser window and force refresh.
4. Load AI again. Select the failed scenario, then resume. The new worker must attempt the run to capture the underlying error; previously saved "[object Object]" text cannot be reconstructed.
5. Send the new full error text and your browser/device details. If the error reports GPU memory or device loss, close other GPU-heavy tabs/apps before retrying. If the runtime still fails, the newly preserved details are needed to make a targeted fix.

Do not clear all browser site data: that can delete scenarios and imaging data. The patch contains no replacement model shards, imaging weights or evidence data. Existing cached model weights can be reused. Existing Qwen research-license requirements and AGPL source notices remain applicable.

Checks for this patch: unit/checkpoint regression tests, the actual pinned WebLLM 0.2.79 worker dispatch for successful and structured-failure RPC results, and a browser test using an explicitly injected synthetic GPU error to verify the failed-run UI and saved checkpoint. These fault tests do not perform AI inference. The unchanged 3B model was tested with real inference in the base release; no new consumer-GPU performance or clinical-validation claim is made.
