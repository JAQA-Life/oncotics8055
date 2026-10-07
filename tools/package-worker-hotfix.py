"""Package only the patch; pin and verify the previously tested base archive."""
from pathlib import Path
import hashlib, json, os, subprocess, zipfile
root = Path(__file__).resolve().parent.parent
public = root / 'public_html'
base = root / 'work/base-release/Oncotics-Hostinger-Upload.zip'
base_sha = '55e74176750b5d9b167067c1fc305b356a1247c0dd0c48101b2fe42589548e0f'
def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()
if sha(base) != base_sha:
    raise SystemExit('Base release checksum mismatch')
with zipfile.ZipFile(base) as archive:
    manifest = json.loads(archive.read('assets/browser-ai/manifest.json'))
    source_bytes = archive.read('scenario-lab/source-code.zip')
if manifest['id'] != 'Qwen2.5-3B-Instruct-q4f32_1-MLC' or manifest['revision'] != 'dfa91e859b714acfa489a1464297080656c3460d':
    raise SystemExit('Unexpected base model')
changed = ['scenario-lab/index.html', 'scenario-lab/lab.mjs', 'scenario-lab/runner.mjs', 'scenario-lab/model.mjs', 'scenario-lab/errors.mjs', 'scenario-lab/notices.html', 'scenario-lab/model-worker.mjs', 'scenario-lab/model-worker.mjs.map', 'scenario-lab/model-client.mjs', 'scenario-lab/model-client.mjs.map', '.htaccess']
for name in changed:
    if not (public / name).is_file():
        raise SystemExit('Missing patch file: ' + name)
    if name.endswith('.mjs') or name.endswith('.mjs.map'):
        item = {'path': name, 'bytes': (public / name).stat().st_size, 'sha256': sha(public / name), 'source': 'Error-preserving patch commit ' + os.environ['GITHUB_SHA']}
        manifest['files'] = [x for x in manifest['files'] if x['path'] != name] + [item]
manifest_path = public / 'assets/browser-ai/manifest.json'
manifest_path.parent.mkdir(parents=True, exist_ok=True)
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
source_base = root / 'work/base-source.zip'
source_base.write_bytes(source_bytes)
modified = subprocess.check_output(['git', 'diff', '--name-only', '355dca7100270fc49bfe9cef29cd52df0b1ad9e1', 'HEAD'], cwd=root, text=True).splitlines()
source_paths = set(modified + ['public_html/' + x for x in changed] + ['public_html/assets/browser-ai/manifest.json'])
source_offer = public / 'scenario-lab/source-code.zip'
with zipfile.ZipFile(source_base) as old, zipfile.ZipFile(source_offer, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as target:
    for entry in old.infolist():
        if entry.filename not in source_paths:
            target.writestr(entry, old.read(entry.filename))
    for name in sorted(source_paths):
        file = root / name
        if file.is_file():
            target.write(file, name)
changed += ['assets/browser-ai/manifest.json', 'scenario-lab/source-code.zip']
release = root / 'release'
release.mkdir(exist_ok=True)
patch = release / 'Oncotics-Qwen3B-Worker-Error-Patch.zip'
with zipfile.ZipFile(patch, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
    for name in changed:
        archive.write(public / name, name)
with zipfile.ZipFile(patch) as archive:
    if archive.testzip() is not None or set(changed) != set(archive.namelist()):
        raise SystemExit('Patch archive verification failed')
result = {'type': 'structured worker error and cache refresh patch', 'commit': os.environ['GITHUB_SHA'], 'workflow_run': os.environ['GITHUB_RUN_ID'], 'base_release': 'browser-ai-qwen3b-v1-37613223926', 'base_zip_sha256': base_sha, 'model': manifest['id'], 'model_revision': manifest['revision'], 'validation': 'Unit regressions, pinned SDK dispatch and injected-error browser UI; no new model inference.', 'browser_test': json.loads((root / 'test-results/worker-fault.json').read_text()), 'name': patch.name, 'bytes': patch.stat().st_size, 'sha256': sha(patch)}
(release / 'PATCH-RESULTS.json').write_text(json.dumps(result, indent=2) + '\n')
(release / 'SHA256SUMS.txt').write_text(result['sha256'] + '  ' + patch.name + '\n')
(release / 'PATCH-INSTRUCTIONS.md').write_bytes((root / 'docs/WORKER-ERROR-PATCH.md').read_bytes())
print('PATCH_RESULT', json.dumps(result))
