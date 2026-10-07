"""Package the exact tested static build and its corresponding source."""
from pathlib import Path
import hashlib, json, os, zipfile

root = Path(__file__).resolve().parent.parent
public = root / 'public_html'
release = root / 'release'
release.mkdir(exist_ok=True)
manifest = json.loads((public / 'assets/browser-ai/manifest.json').read_text())
results = json.loads((root / 'test-results/browser-results.json').read_text())
if results.get('failure') or results.get('inference', {}).get('state') != 'completed':
    raise SystemExit('A passing real-model browser result is required before packaging.')

source_offer = public / 'scenario-lab/source-code.zip'
def package(target, entries):
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as archive:
        for file, name in sorted(entries, key=lambda pair: pair[1]):
            archive.write(file, name)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise SystemExit('ZIP CRC verification failed: ' + str(target))

# Integration source, full application text, existing dependency notices, bundled
# source maps and exact npm package source. Large model/media binaries are supplied
# in the complete project/upload, not duplicated inside the public source offer.
source_files = []
skip = {'node_modules', 'dist', 'release', '.git', 'test-results'}
binary_ext = {'.onnx', '.bin', '.wasm', '.zip', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.gif', '.woff', '.woff2', '.ttf', '.ktx2', '.glb', '.dcm', '.mp4', '.pdf'}
for file in root.rglob('*'):
    relative = file.relative_to(root)
    if file.is_file() and not any(p in skip for p in relative.parts) and file.suffix.lower() not in binary_ext:
        source_files.append((file, relative.as_posix()))
webllm = root / 'node_modules/@mlc-ai/web-llm'
for file in webllm.rglob('*'):
    if file.is_file():
        source_files.append((file, 'dependencies/web-llm/' + file.relative_to(webllm).as_posix()))
package(source_offer, source_files)

required = ['index.html', '.htaccess', 'scenario-lab/index.html', 'scenario-lab/lab.mjs', 'scenario-lab/model-worker.mjs', 'scenario-lab/model-client.mjs', 'scenario-lab/source-code.zip', 'assets/browser-ai/manifest.json', 'assets/browser-ai/model.wasm', 'assets/ohif/index.html']
required += [item['path'] for item in manifest['files']]
for name in required:
    if not (public / name).is_file():
        raise SystemExit('Missing release file: ' + name)
for item in manifest['files']:
    file = public / item['path']
    if file.stat().st_size != item['bytes'] or hashlib.sha256(file.read_bytes()).hexdigest() != item['sha256']:
        raise SystemExit('Release model hash mismatch: ' + item['path'])

info = {
    'edition': 'Oncotics Browser Scenario Lab', 'commit': os.environ.get('GITHUB_SHA', 'local'),
    'workflow_run': os.environ.get('GITHUB_RUN_ID'), 'model': manifest['id'],
    'model_revision': manifest['revision'], 'webllm_version': manifest['webllm_version'],
    'research_only': True, 'external_ai_api': False, 'simulation_backend': False,
    'checks': results['checks'], 'inference': results['inference'], 'gpu': results.get('gpu'),
}
(root / 'docs/BUILD-RESULTS.json').write_text(json.dumps(info, indent=2) + '\n')
(public / 'scenario-lab/build-results.json').write_text(json.dumps(info, indent=2) + '\n')

upload = release / 'Oncotics-Hostinger-Upload.zip'
package(upload, [(file, file.relative_to(public).as_posix()) for file in public.rglob('*') if file.is_file()])
complete = release / 'Oncotics-Browser-AI-Complete-Project.zip'
project = []
for file in root.rglob('*'):
    relative = file.relative_to(root)
    if file.is_file() and not any(p in {'node_modules', 'dist', 'release', '.git'} for p in relative.parts):
        project.append((file, relative.as_posix()))
package(complete, project)
for file in (upload, complete):
    with zipfile.ZipFile(file) as archive:
        prefix = '' if file == upload else 'public_html/'
        for name in required:
            if prefix + name not in archive.namelist():
                raise SystemExit('Incomplete ZIP: ' + name)

checksums = '\n'.join(hashlib.sha256(file.read_bytes()).hexdigest() + '  ' + file.name for file in (upload, complete)) + '\n'
(release / 'SHA256SUMS.txt').write_text(checksums)
for source, name in [('docs/HOSTINGER-UPLOAD.md','HOSTINGER-UPLOAD.md'), ('docs/BUILD-RESULTS.json','BUILD-RESULTS.json')]:
    (release / name).write_bytes((root / source).read_bytes())
print('RELEASE_RESULT', json.dumps({'info': info, 'assets': [{'name':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()} for file in (upload, complete)]}))
