"""Focused checks for the complete uploaded release; no model/provider calls."""
import hashlib
import json
import re
import subprocess
import tempfile
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.current=None
        self.scripts=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=='script':self.current=[dict(attrs),'']
    def handle_data(self,data):
        if self.current is not None:self.current[1]+=data
    def handle_endtag(self,tag):
        if tag.lower()=='script' and self.current is not None:
            self.scripts.append(self.current)
            self.current=None

def main():
    models = json.loads((ROOT/'docs/model-integrity.json').read_text())
    for model in models:
        path = ROOT/'assets/models'/model['id']/'model.onnx'
        assert path.stat().st_size == model['bytes'], str(path)
        assert hashlib.sha256(path.read_bytes()).hexdigest() == model['sha256'], str(path)
    subprocess.run(['node', '--check', str(ROOT/'scenario-lab/lab.js')], check=True)
    scripts = 0
    with tempfile.TemporaryDirectory() as scratch:
        for folder in ['imaging', 'precision-oncology-workspace']:
            html = (ROOT/folder/'index.html').read_text(encoding='utf-8')
            parser=Scripts()
            parser.feed(html)
            for index, (attrs, content) in enumerate(parser.scripts):
                if 'src' in attrs or not content.strip():continue
                if attrs.get('type','').lower() in {'application/ld+json','importmap','application/json'}:continue
                path = Path(scratch)/f'{folder}-{index}.mjs'
                path.write_text(content, encoding='utf-8')
                subprocess.run(['node','--check',str(path)],check=True)
                scripts += 1
    for folder in ['services/scenario-orchestrator','services/mirofish-cloud/backend','services/mirofish-offline/backend','tools']:
        subprocess.run(['python','-m','compileall','-q',str(ROOT/folder)],check=True)
    results = {'models_verified':len(models),'original_inline_scripts_checked':scripts,
               'scenario_javascript':'passed','python_syntax':'passed',
               'live_simulations_executed':False,'imaging_inference_executed':False}
    output = ROOT/'ci-results'
    output.mkdir(exist_ok=True)
    (output/'source-checks.json').write_text(json.dumps(results,indent=2))
    print(json.dumps(results))

if __name__=='__main__':main()
