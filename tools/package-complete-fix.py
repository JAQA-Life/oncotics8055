"""Reuse verified, unchanged model weights; package the entire updated application."""
from pathlib import Path
import hashlib, json, os, sys, zipfile, shutil
root=Path(__file__).resolve().parent.parent
public=root/'public_html'
release=root/'release'
base=root/'work/base-release/Oncotics-Hostinger-Upload.zip'
base_sha='55e74176750b5d9b167067c1fc305b356a1247c0dd0c48101b2fe42589548e0f'
def sha(file):
    with file.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()
if '--restore' in sys.argv:
    if sha(base)!=base_sha: raise SystemExit('Base upload checksum mismatch')
    with zipfile.ZipFile(base) as archive:
        for entry in archive.infolist():
            target=(public/entry.filename).resolve()
            if not target.is_relative_to(public.resolve()): raise SystemExit('Unsafe ZIP path')
            if entry.is_dir(): continue
            if not target.exists() or entry.filename=='assets/browser-ai/manifest.json':
                target.parent.mkdir(parents=True,exist_ok=True)
                with archive.open(entry) as source, target.open('wb') as destination: shutil.copyfileobj(source,destination)
    print('Restored unchanged weights from checksum-verified full release.');sys.exit()
manifest_path=public/'assets/browser-ai/manifest.json'
manifest=json.loads(manifest_path.read_text())
if manifest['id']!='Qwen2.5-3B-Instruct-q4f32_1-MLC' or manifest['revision']!='dfa91e859b714acfa489a1464297080656c3460d': raise SystemExit('Unexpected model')
if '--manifest' in sys.argv:
    for file in (public/'scenario-lab').glob('*.mjs*'):
        name=file.relative_to(public).as_posix()
        manifest['files']=[item for item in manifest['files'] if item['path']!=name]+[{'path':name,'bytes':file.stat().st_size,'sha256':sha(file),'source':'Scenario Lab v2 '+os.environ['GITHUB_SHA']}]
    manifest_path.write_text(json.dumps(manifest,indent=2)+'\n');sys.exit()
browser=json.loads((root/'test-results/worker-fault.json').read_text())
if not browser.get('passed'): raise SystemExit('Current browser regressions must pass')
load_result=json.loads((root/'test-results/model-load.json').read_text())
if not load_result.get('passed') or load_result['identity']['id']!=manifest['id']: raise SystemExit('Current actual-model loading must pass')
previous=root/'work/base-release/BUILD-RESULTS.json'
if sha(previous)!='77ff19346e7c56570a7c626937d83fab260902c202581e33c416b2f3cdb09679': raise SystemExit('Base test record checksum mismatch')
base_info=json.loads(previous.read_text())
if base_info['inference']['state']!='completed' or base_info['model']!=manifest['id'] or base_info['model_revision']!=manifest['revision']: raise SystemExit('Passing matching base inference required')
ui=json.loads((root/'test-results/research-ui.json').read_text())
current=json.loads((root/'test-results/browser-results.json').read_text())
inference=current.get('inference') or {}
enhanced=current.get('enhanced') or {}
if not ui.get('passed'): raise SystemExit('Enhanced UI fixtures must pass')
if current.get('failure') or current.get('errors') or inference.get('state')!='completed' or inference.get('model')!=manifest['id'] or enhanced.get('schema')!='oncotics-browser-scenario/2' or enhanced.get('tick')!=1 or not current.get('tokenizer'): raise SystemExit('Current actual-model v2 inference and tokenizer checks must pass')
info={'edition':'Oncotics Browser Scenario Lab v2 — complete replacement','commit':os.environ['GITHUB_SHA'],'workflow_run':os.environ['GITHUB_RUN_ID'],'model':manifest['id'],'model_revision':manifest['revision'],'webllm_version':manifest['webllm_version'],'research_only':True,'external_ai_api':False,'simulation_backend':False,'current_checks':['Unit regressions: evidence, memory isolation, token budgets, typed actions, checkpoint recovery and tampering','Actual pinned WebLLM worker RPC dispatch','Browser structured failure and zero saved steps','Real Cesium WebGL geography and tab switches','Hosting HTML/JSON failure UI','Enhanced network, keyboard inspection, agent memory, exports and reload integrity using explicit synthetic action fixtures','Current actual Qwen 3B tokenizer, WebGPU loading and one-agent one-round action inference','Full asset hashes and four unchanged ONNX packs'], 'current_browser_checks':browser,'current_enhanced_ui_checks':ui,'current_actual_model_load':load_result,'current_real_inference':current,'inference':inference,'base_asset_origin':{'release':'browser-ai-qwen3b-v1-37613223926','upload_sha256':base_sha,'meaning':'Unchanged weights restored from checksum-verified base; inference was repeated on the current code.'},'limits':'Not clinically validated. Real inference is tested on a software GPU with synthetic evidence, not every device or live evidence provider. The deployed Hostinger configuration and visitor GPU still require acceptance testing.'}
(root/'docs/BUILD-RESULTS.json').write_text(json.dumps(info,indent=2)+'\n')
(public/'scenario-lab/build-results.json').write_text(json.dumps(info,indent=2)+'\n')
def package(target,entries):
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
        for file,name in sorted(entries,key=lambda x:x[1]): archive.write(file,name)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None: raise SystemExit('Archive CRC failed: '+target.name)
skip={'node_modules','dist','release','.git','work','test-results'}
binary={'.onnx','.bin','.wasm','.zip','.png','.jpg','.jpeg','.webp','.ico','.gif','.woff','.woff2','.ttf','.ktx2','.glb','.dcm','.mp4','.pdf'}
source=[(file,file.relative_to(root).as_posix()) for file in root.rglob('*') if file.is_file() and not any(p in skip for p in file.relative_to(root).parts) and file.suffix.lower() not in binary]
for name in ['web-llm']:
    sdk=root/('node_modules/@mlc-ai/'+name)
    source += [(file,'dependencies/'+name+'/'+file.relative_to(sdk).as_posix()) for file in sdk.rglob('*') if file.is_file()]
package(public/'scenario-lab/source-code.zip',source)
required=['index.html','.htaccess','scenario-lab/index.html','scenario-lab/assets.mjs','scenario-lab/source-code.zip','assets/ohif/index.html']+[item['path'] for item in manifest['files']]
for name in required:
    if not (public/name).is_file(): raise SystemExit('Missing full site file: '+name)
for item in manifest['files']:
    file=public/item['path']
    if file.stat().st_size!=item['bytes'] or sha(file)!=item['sha256']: raise SystemExit('Asset hash failed: '+item['path'])
release.mkdir(exist_ok=True)
upload=release/'Oncotics-Hostinger-Upload.zip'
complete=release/'Oncotics-Browser-AI-Complete-Project.zip'
package(upload,[(file,file.relative_to(public).as_posix()) for file in public.rglob('*') if file.is_file()])
package(complete,[(file,file.relative_to(root).as_posix()) for file in root.rglob('*') if file.is_file() and not any(p in {'node_modules','dist','release','.git','work'} for p in file.relative_to(root).parts)])
for file,prefix in [(upload,''),(complete,'public_html/')]:
    with zipfile.ZipFile(file) as archive:
        for name in required:
            if prefix+name not in archive.namelist(): raise SystemExit('Incomplete archive: '+name)
assets=[{'name':file.name,'bytes':file.stat().st_size,'sha256':sha(file)} for file in [upload,complete]]
(release/'SHA256SUMS.txt').write_text(''.join(item['sha256']+'  '+item['name']+'\n' for item in assets))
(release/'HOSTINGER-UPLOAD.md').write_bytes((root/'docs/HOSTINGER-UPLOAD.md').read_bytes())
(release/'BUILD-RESULTS.json').write_text(json.dumps(info,indent=2)+'\n')
print('RELEASE_RESULT',json.dumps({'info':info,'assets':assets}))
