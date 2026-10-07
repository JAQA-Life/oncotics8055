"""Configuration validation only; no provider/network/engine calls."""
from pathlib import Path
from urllib.parse import urlparse
import sys

def main():
    root=Path(__file__).resolve().parents[1]
    path=root/'.env'
    if not path.exists():raise ValueError('Copy .env.example to .env and configure required secrets.')
    values={}
    for line in path.read_text().splitlines():
        if line.strip() and not line.lstrip().startswith('#') and '=' in line:
            k,v=line.split('=',1);values[k.strip()]=v.strip().strip('"').strip("'")
    keys=['SCENARIO_PROXY_SECRET','SCENARIO_CSRF_SECRET','LOCAL_ENGINE_SECRET','NEO4J_PASSWORD']
    if values.get('ENABLE_CLOUD_ENGINE','false').lower()=='true':
        keys.append('CLOUD_ENGINE_SECRET')
        for k in ('CLOUD_LLM_API_KEY','CLOUD_LLM_MODEL','ZEP_API_KEY'):
            if not values.get(k):raise ValueError('Configure '+k+' before enabling cloud.')
        if urlparse(values.get('CLOUD_LLM_BASE_URL','')).scheme!='https':raise ValueError('Configure an HTTPS cloud model endpoint.')
    for k in keys:
        if len(values.get(k,''))<32:raise ValueError(k+' requires at least 32 characters.')
    if len(set(values[k] for k in keys))!=len(keys):raise ValueError('Use distinct secrets for each purpose.')
    if urlparse(values.get('SCENARIO_PUBLIC_ORIGIN','')).scheme!='https':raise ValueError('Set the deployed HTTPS public origin.')
    if not (root/'deploy/auth/htpasswd').is_file():raise ValueError('Create deploy/auth/htpasswd with per-user hashed passwords.')
    if not (root/'scenario-lab/source-code.zip').is_file():raise ValueError('Run tools/package_release.py to generate the source offer.')
    print('Required configuration and source offer are present. Complete Docker/runtime acceptance separately.')

if __name__=='__main__':
    try:main()
    except ValueError as e:print(str(e),file=sys.stderr);raise SystemExit(1)
