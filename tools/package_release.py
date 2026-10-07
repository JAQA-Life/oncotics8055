"""Generate the exact network source offer and optionally a complete project ZIP."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def include(path):
    return not any(x in {'.git','__pycache__','.pytest_cache','node_modules','auth','data','uploads','ci-results'} for x in path.parts) and path.name not in {'.env','.ci-runtime.json','.ci-compose.yaml','source-code.zip'} and not path.suffix in {'.pyc','.sqlite','.sqlite-wal','.sqlite-shm'}

def source_offer():
    sources=['services','deploy','scenario-lab','tests','tools','docs','.github']
    singles=['README.md','THIRD-PARTY-NOTICES.md','LICENSE-SCENARIO-LAB','compose.yaml','.env.example','.dockerignore','requirements-test.txt']
    target=ROOT/'scenario-lab/source-code.zip'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for directory in sources:
            for p in sorted((ROOT/directory).rglob('*')):
                if p.is_file() and include(p.relative_to(ROOT)):z.write(p,p.relative_to(ROOT).as_posix())
        for name in singles:z.write(ROOT/name,name)
    return target

def project_zip(target):
    target=Path(target).resolve()
    if target.is_relative_to(ROOT):raise ValueError('Write the release ZIP outside the project tree to avoid recursive packaging.')
    target.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
        for p in sorted(ROOT.rglob('*')):
            relative=p.relative_to(ROOT)
            if p.is_file() and (include(relative) or relative.as_posix()=='scenario-lab/source-code.zip'):
                z.write(p,'oncotics/'+relative.as_posix())
    sha=hashlib.sha256(target.read_bytes()).hexdigest()
    target.with_suffix(target.suffix+'.sha256').write_text(sha+'  '+target.name+'\n')
    print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'sha256':sha}))

if __name__=='__main__':
    offer=source_offer();print('Source offer:',offer.stat().st_size,'bytes')
    if len(sys.argv)>1:project_zip(sys.argv[1])
