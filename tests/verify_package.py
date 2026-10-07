"""Verify reconstruction against every byte of all four supplied ZIP archives."""
import hashlib
import json
import zipfile
from pathlib import Path

def sha(data):return hashlib.sha256(data).hexdigest()

def verify(root, archives):
    allowed={'index.html','about/index.html','contact/index.html','privacy/index.html','precision-oncology-workspace/index.html','imaging/index.html','sitemap.xml'}
    result=[]
    for source, models in archives:
        preserved=0; changed=[]
        with zipfile.ZipFile(source) as z:
            for f in z.infolist():
                if f.is_dir():continue
                destination=root/('assets/models/'+f.filename if models else f.filename)
                assert destination.is_file(),str(destination)
                original=z.read(f); actual=destination.read_bytes()
                if original!=actual:
                    assert not models and f.filename in allowed,f.filename
                    changed.append(f.filename)
                else:preserved+=1
        result.append({'archive':Path(source).name,'sha256':sha(Path(source).read_bytes()),'preserved_files':preserved,'intentional_changes':changed})
    # Model pack checksums declared by the original pack are preserved verbatim.
    return result

if __name__=='__main__':
    import sys
    manifest=verify(Path(sys.argv[1]),[(sys.argv[2],False),(sys.argv[3],False),(sys.argv[4],False),(sys.argv[5],True)])
    print(json.dumps(manifest,indent=2))
