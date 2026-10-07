# Engineering validation and acceptance limits

The release is gated by:

1. Unit/workflow checks for receipt preservation, source and field attribution, snapshot tampering, CORS/network failures, response limits, bounded specifications, escaped content, unknown model citations, checkpoint writes, pause/resume and invalid output.
2. Asset integrity checks for every acquired browser model/runtime file and each of the four original ONNX models; OHIF entry point presence.
3. A real browser WebGPU test using the actual self-hosted Qwen model. Public evidence in this test is clearly synthetic CI fixture data, not claimed live provider data. The model is not mocked. A one-role/one-round run must produce valid labeled output and complete its report. The browser test covers source review, agent inspection, export, IndexedDB reload, unsupported difference view, unsupported GPU fallback and network requests.
4. Packaging checks for the final ZIPs, source offer, manifest, runtime and original model files.

Actual results, model revision, browser/device adapter and timing are recorded in `test-results/browser-results.json`; the exported synthetic test run and screenshot are included for inspection. CI uses a headless browser with Mesa Lavapipe, a software Vulkan adapter. A successful software-adapter test does not establish performance across consumer GPUs or mobiles. Public provider CORS/rate limits and live source availability must be checked on the deployed domain. AI loading can be cancelled; worker failures, initialization and generation timeouts fail visibly.

Hostinger production acceptance must additionally check HTTPS, static headers/MIME, complete extraction, cache behavior, page routes, first-load bandwidth, device support, local persistence, pause/resume, exports, deletion and source notices on the real domain. Original asset retention and hashes do not constitute end-to-end DICOM or imaging-model validation; the existing imaging workflow needs its own domain/device smoke check.

This is an engineering-tested research package, not clinically validated software. There has been no prospective medical study, regulatory clearance, model accuracy certification, or production traffic/load study. A qualified reviewer must assess examples against their evidence before a public research pilot.
