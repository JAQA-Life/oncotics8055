"""Isolated container smoke checks, not live-model acceptance.

All generated configuration is ephemeral and ignored by Git. Test-only provider
sentinels are not usable credentials. Engines never receive real provider keys.
"""
import base64
import json
import secrets
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
STATE=ROOT/'ci-results/runtime-config.json'

def command(*args, capture=False):
    return subprocess.run(args,cwd=ROOT,check=True,capture_output=capture,text=True)

def prepare():
    if (ROOT/'.env').exists():raise RuntimeError('CI setup will not overwrite existing credentials')
    state={'proxy':secrets.token_hex(32),'csrf':secrets.token_hex(32),'local':secrets.token_hex(32),
           'cloud':secrets.token_hex(32),'neo4j':secrets.token_hex(32),'password':secrets.token_hex(24)}
    (ROOT/'ci-results').mkdir(exist_ok=True)
    # Do not put the ephemeral secrets in uploaded ci-results artifacts.
    STATE.parent.mkdir(exist_ok=True)
    STATE_PRIVATE=ROOT/'.ci-runtime.json'
    STATE_PRIVATE.write_text(json.dumps(state))
    STATE_PRIVATE.chmod(0o600)
    values={'SCENARIO_PROXY_SECRET':state['proxy'],'SCENARIO_CSRF_SECRET':state['csrf'],
            'LOCAL_ENGINE_SECRET':state['local'],'CLOUD_ENGINE_SECRET':state['cloud'],
            'NEO4J_PASSWORD':state['neo4j'],'SCENARIO_PUBLIC_ORIGIN':'https://ci.invalid',
            'ENABLE_LOCAL_ENGINE':'false','ENABLE_CLOUD_ENGINE':'false',
            'CLOUD_LLM_API_KEY':'CI_TEST_ONLY_NO_PROVIDER_CREDENTIAL',
            'CLOUD_LLM_BASE_URL':'https://ci.invalid/v1','CLOUD_LLM_MODEL':'ci-no-live-model',
            'ZEP_API_KEY':'CI_TEST_ONLY_NO_PROVIDER_CREDENTIAL'}
    (ROOT/'.env').write_text(''.join(f'{k}={v}\n' for k,v in values.items()))
    (ROOT/'.env').chmod(0o600)
    auth=ROOT/'deploy/auth'
    auth.mkdir(parents=True,exist_ok=True)
    hashed=subprocess.run(['openssl','passwd','-apr1','-stdin'],input=state['password']+'\n',
                          text=True,capture_output=True,check=True).stdout.strip()
    (auth/'htpasswd').write_text('researcher:'+hashed+'\n')
    (auth/'htpasswd').chmod(0o644)
    print('Isolated CI configuration generated; no live provider credentials.')

def response(url, headers=None):
    try:
        with urllib.request.urlopen(urllib.request.Request(url,headers=headers or {}),timeout=5) as r:
            return r.status,r.read(),dict(r.headers)
    except urllib.error.HTTPError as e:return e.code,e.read(),dict(e.headers)

def wait_for(url, expected=200, headers=None):
    deadline=time.monotonic()+120
    while time.monotonic()<deadline:
        try:
            value=response(url,headers)
            if value[0]==expected:return value
        except (urllib.error.URLError,TimeoutError,OSError):pass
        time.sleep(2)
    raise RuntimeError('Container did not reach the expected HTTP state')

def port(name, internal):
    bindings=json.loads(command('docker','inspect',name,capture=True).stdout)[0]['NetworkSettings']['Ports']
    return bindings[f'{internal}/tcp'][0]['HostPort']

def smoke(target):
    state=json.loads((ROOT/'.ci-runtime.json').read_text())
    name='oncotics-ci-service'
    created=[]
    try:
        if target=='oncotics-web':
            command('docker','compose','build','scenario-api')
            override=ROOT/'.ci-compose.yaml'
            override.write_text('services:\n  scenario-api:\n    environment:\n      ENABLE_LOCAL_ENGINE: "false"\n      ENABLE_CLOUD_ENGINE: "false"\n')
            command('docker','compose','-f','compose.yaml','-f',override.name,'up','-d','scenario-api','oncotics-web')
            created.append('compose')
            url='http://127.0.0.1:8080'
            wait_for(url+'/')
            assert response(url+'/api/scenarios/config')[0]==401
            login=base64.b64encode(('researcher:'+state['password']).encode()).decode()
            headers={'Authorization':'Basic '+login}
            status,body,_=wait_for(url+'/api/scenarios/config',headers=headers)
            config=json.loads(body)
            assert config['research_only'] is True
            assert config['worker_available'] is False
            assert all(not item['enabled'] for item in config['engines'])
            assert state['proxy'].encode() not in body and state['csrf'].encode() not in body
            assert response(url+'/scenario-lab/')[0]==401
            assert response(url+'/scenario-lab/',headers)[0]==200
            assert response(url+'/scenario-lab/source-code.zip')[0]==200
            for path in ['/imaging/','/assets/ohif/']:
                status,_,h=response(url+path)
                assert status==200,path
                assert h.get('Cross-Origin-Opener-Policy')=='same-origin',path
                assert h.get('Cross-Origin-Embedder-Policy')=='credentialless',path
            label='HTTP gateway, authentication, privacy boundaries and imaging route headers'
        else:
            internal=8080 if target=='scenario-api' else 5001
            args=['docker','run','-d','--name',name,'-p',f'127.0.0.1::{internal}']
            if target=='scenario-api':args += ['--env-file',str(ROOT/'.env')]
            else:
                args += ['-e','FLASK_DEBUG=false','-e','SECRET_KEY='+state['local'],
                         '-e','LLM_API_KEY=CI_TEST_ONLY_NO_PROVIDER_CREDENTIAL',
                         '-e','LLM_BASE_URL=http://127.0.0.1:9/v1','-e','LLM_MODEL_NAME=ci-no-live-model',
                         '-e','OPENAI_API_KEY=CI_TEST_ONLY_NO_PROVIDER_CREDENTIAL',
                         '-e','OPENAI_API_BASE_URL=http://127.0.0.1:9/v1',
                         '-e','ZEP_API_KEY=CI_TEST_ONLY_NO_PROVIDER_CREDENTIAL']
            if target=='mirofish-offline':
                command('docker','network','create','--internal','oncotics-ci-network')
                created.append('network')
                command('docker','run','-d','--name','oncotics-ci-neo4j','--network','oncotics-ci-network',
                        '-e','NEO4J_AUTH=neo4j/'+state['neo4j'],
                        '-e','NEO4J_server_memory_heap_max__size=512m','neo4j:5.26-community')
                created.append('neo4j')
                deadline=time.monotonic()+120
                while time.monotonic()<deadline:
                    probe=subprocess.run(['docker','exec','oncotics-ci-neo4j','cypher-shell','-u','neo4j',
                                          '-p',state['neo4j'],'RETURN 1'],capture_output=True)
                    if probe.returncode==0:break
                    time.sleep(3)
                else:raise RuntimeError('Neo4j startup failed')
                args += ['--network','oncotics-ci-network','-e','NEO4J_URI=bolt://oncotics-ci-neo4j:7687',
                         '-e','NEO4J_USER=neo4j','-e','NEO4J_PASSWORD='+state['neo4j'],
                         '-e','EMBEDDING_BASE_URL=http://127.0.0.1:9']
            command(*(args+['oncotics-ci:'+target]))
            created.append('service')
            url='http://127.0.0.1:'+port(name,internal)
            status,body,_=wait_for(url+'/health')
            assert json.loads(body)['status']=='ok'
            if target=='scenario-api':assert response(url+'/api/scenarios/config')[0]==401
            if target=='mirofish-offline':
                probe=command('docker','exec',name,'python','-c',
                              "from oncotics_wsgi import app; assert app.extensions.get('neo4j_storage') is not None",capture=True)
            label='Actual image startup and health'+(' with Neo4j connection' if target=='mirofish-offline' else '')
        (ROOT/'ci-results'/f'{target}.json').write_text(json.dumps({'target':target,'check':label,'passed':True,
              'live_model_calls':False,'live_simulation_acceptance':False},indent=2))
        print(label+': passed')
    except Exception:
        if 'service' in created:subprocess.run(['docker','logs','--tail','100',name])
        if 'compose' in created:subprocess.run(['docker','compose','logs','--tail','100','oncotics-web','scenario-api'],cwd=ROOT)
        raise
    finally:
        if 'compose' in created:subprocess.run(['docker','compose','down'],cwd=ROOT)
        for kind,container in [('service',name),('neo4j','oncotics-ci-neo4j')]:
            if kind in created:subprocess.run(['docker','rm','-f',container],capture_output=True)
        if 'network' in created:subprocess.run(['docker','network','rm','oncotics-ci-network'],capture_output=True)

if __name__=='__main__':
    if sys.argv[1]=='prepare':prepare()
    else:smoke(sys.argv[2])
