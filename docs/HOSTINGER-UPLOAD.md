# Upload Oncotics to Hostinger Web or Cloud hosting

Use `Oncotics-Hostinger-Upload.zip`, which already contains the complete site, imaging assets, AI runtime and model weights. You do not need a VPS. AI runs on the visitor's compatible device; Hostinger serves files.

## Recommended: File Manager

1. Back up your existing domain files using Hostinger before replacing them. Prefer a staging domain or subdomain for the first upload.
2. In hPanel choose **Websites → your website → Dashboard → File Manager**, then open that domain's **public_html** folder.
3. Upload **Oncotics-Hostinger-Upload.zip**, then right-click it and choose **Extract**. Ensure the extracted files end up directly in `public_html`.
4. At the web root you should see `index.html`, `.htaccess`, `assets`, `imaging`, `precision-oncology-workspace` and `scenario-lab`. If extraction created a wrapper folder, move its contents to the web root, including the hidden `.htaccess`. Do not leave a second nested `public_html` folder.
5. Enable SSL and **Force HTTPS** for the actual domain in hPanel. Open the HTTPS version of the site. Serve the site at the domain root, not under a path such as `/oncotics`; assets use root-relative URLs.
6. Remove the uploaded ZIP after extraction and purge Hostinger's site cache. Keep the original backup outside the public web folder until the deployment is accepted.

Hostinger documents this upload/extract process in its [File Manager guide](https://www.hostinger.com/support/1869114-how-to-upload-backups-with-file-manager-in-hostinger/). Its AI Website Builder does not provide this file-manager workflow; use an ordinary hosting website instead.

## If you specifically use “Deploy Web App”

On supported Business/Cloud plans, upload **Oncotics-Browser-AI-Complete-Project.zip**. Choose a static frontend / **Other**, Node.js **24**, project root `.`, build command **npm run build**, output directory **dist**, and no server entry file. No environment variables or AI API keys are required. The complete project already includes its model assets. See [Hostinger's deployment settings](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

The File Manager upload is the simpler path for this static site. For GitHub builds, select branch **codex/browser-ai-edition** in **JAQA-Life/oncotics8055**, then use **npm run vendor && npm run build**, output **dist**. That build downloads the public model artifacts before publishing; it does not call an AI inference service. Check the resulting model revision and manifest against your intended release. Keep the release ZIP as the deployment you can reproduce exactly.

Do not select the repository's `main` branch for this browser edition: `main` contains the separate backend-engine version. Do not run `tools/serve.mjs` as a production backend.

## Check your deployed site

Visit each of these paths on your own HTTPS domain:

- `/` — original Oncotics home and branding.
- `/precision-oncology-workspace/` — public evidence workspace.
- `/imaging/` and `/assets/ohif/index.html` — existing imaging entry and viewer.
- `/scenario-lab/` — browser Scenario Lab.
- `/assets/browser-ai/manifest.json` — model manifest must return JSON, not a login or HTML page.
- `/assets/browser-ai/model.wasm` — runtime must download successfully.
- `/scenario-lab/source-code.zip` — source offer must remain available.

On a current WebGPU-compatible browser with hardware acceleration, open Scenario Lab and click **Load AI on this device**. The first load transfers roughly 320 MB of model/runtime assets; the exact total is displayed from the included manifest. Browser caching may avoid later full downloads. GPU memory, browser support and disk quotas vary by device; a weak phone or unsupported browser may be unable to run the model.

Confirm public, non-patient research use. Retrieve a narrow public query, inspect source records and coverage, enter explicit assumptions, then confirm review. Start with **one stakeholder and one round**. Inspect the synthetic agent and labeled report, export JSON, reload and reopen the saved run. Runs need an open tab. Each browser profile has its own records; there is no shared account, server history or background job queue.

Check that the browser Network panel shows model/runtime downloads from your own domain and evidence requests only to selected public providers. Scenario Lab should not contact an AI provider, Hugging Face or an external model CDN. Build-time artifact URLs in the manifest are provenance metadata, not runtime endpoints.

## Troubleshooting

| Symptom | Action |
|---|---|
| Missing model files / 404 | Upload the complete ZIP, including `assets/browser-ai` and both model bundles in `scenario-lab`. Check for a nested extraction folder. |
| No WebGPU adapter | Enable browser hardware acceleration; try a current compatible browser/device. Evidence browsing remains available. |
| WASM / MIME or policy error | Preserve the supplied `.htaccess`; check HTTPS, `application/wasm` for `.wasm`, JavaScript MIME for `.mjs`, and the Scenario Lab CSP. |
| Model cannot allocate GPU memory | Close GPU-heavy tabs/apps or use a device with more available GPU memory. Do not interpret partial output as a completed run. |
| A public provider fails or blocks CORS | Inspect coverage errors, use another selected source, or import its public JSON response. Imported attribution stays ASSUMPTION. Do not add an unreviewed public proxy. |
| IndexedDB/quota error | Export saved records, free site storage, and retry. Private browsing can restrict persistence. Clearing site data deletes local runs and model caches. |
| Invalid model JSON / citation | The run stops with its last completed checkpoint. Review evidence and assumptions, then resume or create a new run. No substitute result is fabricated. |
| Old code/model after an update | Purge hosting caches, close existing site tabs, clear model cache/site data after exporting records, and load the new model. Do not resume an old run against a different model revision. |

## Before opening a public research pilot

Complete the deployment checks above on the actual Hostinger domain and on representative user devices. Verify HTTPS/CSP/MIME, upload integrity, first-load bandwidth, storage persistence, pause/resume and clear-data behavior. Review licensing/source notices and research-use wording. Have a qualified reviewer assess example outputs against their frozen evidence, especially unsupported claims and citation relevance. Record the accepted browser/device matrix and limits.

Automated engineering checks do not validate medical predictions. This edition supports hypothetical research discussion only. Do not enter patient, DICOM or confidential information into Scenario Lab.
