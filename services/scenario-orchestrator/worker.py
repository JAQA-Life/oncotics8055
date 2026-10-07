"""Single durable worker with a heartbeat, explicit stage IDs and no POST retries.

Upstream task registries are process-local. Interrupted jobs fail explicitly;
they are never silently replayed, which could duplicate cloud charges.
"""
import logging
import os
import json
from pathlib import Path
import threading
import time
from audit import report
from engines import Engine, EngineError, enabled
from store import Store, canonical

log = logging.getLogger('oncotics.worker')

class Cancelled(Exception):
    pass

def execute(store, sid, owner, engine_factory=Engine):
    job = store.get(sid)
    spec = job['spec']
    engine = None
    deadline = time.monotonic() + int(os.environ.get('SCENARIO_TIMEOUT_SECONDS', '14400'))
    ids = {}
    def check_cancel():
        if store.cancelled(sid):
            raise Cancelled()
        if time.monotonic() >= deadline:
            raise EngineError('Scenario exceeded its execution deadline')
    def stage(name, progress, **extra):
        check_cancel()
        store.update(sid, stage=name, progress=progress, **extra)
    def poll(name, base, span):
        return lambda p: stage(name, base + span * min(100, max(0, float(p.get('progress', p.get('progress_percent', 0))))) / 100,
                               engine_progress={'provenance': 'SIMULATED', 'data': p})
    def save_ids():
        store.update(sid, engine_ids=dict(ids))
    def stop():
        if ids.get('simulation_id'):
            try:
                engine.call('/api/simulation/stop', {'simulation_id': ids['simulation_id']})
                return True
            except EngineError:
                return False
        return False
    try:
        check_cancel()
        engine = engine_factory(spec['engine'])
        snapshot = store.snapshot(spec['snapshot_id'], owner)
        data = snapshot['snapshot']
        if not enabled(spec['engine']):
            raise EngineError('Selected engine is disabled')
        stage('ontology', 5, snapshot_sha256=snapshot['sha256'])
        # Only labeled, selected source fields enter the model seed. Raw receipts
        # remain in the immutable snapshot and the reproducibility export.
        compact_evidence = {'entities': data.get('entities', []),
                            'records': [{k: v for k, v in r.items() if k != 'raw'} for r in data['records']],
                            'locations': data['locations'], 'limitations': data['limitations']}
        actors = [{'name': 'Synthetic ' + role, 'entity_type': 'ScenarioStakeholder', 'role': role, 'provenance': 'SIMULATED',
                   'note': 'Hypothetical research role template, not a real person or source-backed identity.'}
                  for role in ('Researcher', 'Trial Sponsor', 'Medical Physicist', 'Supply Analyst', 'Regulatory Observer')]
        seed = canonical({'research_only': True, 'evidence_snapshot_sha256': snapshot['sha256'],
                          'evidence': compact_evidence, 'synthetic_stakeholders': actors,
                          'assumptions': [{'provenance': 'ASSUMPTION', 'text': a} for a in spec['assumptions']]})
        versions = json.loads((Path(__file__).parent / 'upstream-versions.json').read_text(encoding='utf-8'))
        store.update(sid, manifest={'schema': 'oncotics-run-manifest/1', 'snapshot_id': snapshot['id'],
                     'snapshot_sha256': snapshot['sha256'], 'seed_sha256': __import__('hashlib').sha256(seed.encode()).hexdigest(),
                     'upstream': versions[spec['engine']], 'configured_model': os.environ.get('LOCAL_LLM_MODEL' if spec['engine'] == 'local' else 'CLOUD_LLM_MODEL', 'not-recorded'),
                     'embedding_model': os.environ.get('LOCAL_EMBEDDING_MODEL', 'not-recorded') if spec['engine'] == 'local' else 'provider-managed',
                     'deterministic': False, 'seed_kind': 'Source titles/identifiers/coordinates with exact receipt locators, routing hints and assumptions; full raw records excluded from model seed.'})
        requirement = 'RESEARCH-ONLY SOCIAL SCENARIO. Synthetic stakeholders only; no patient outcomes or medical advice. ' + spec['question'] + '\nExplicit assumptions:\n' + '\n'.join(spec['assumptions'])
        ids['project_id'] = engine.identifier(engine.ontology(seed, requirement, spec['title'])['project_id'])
        save_ids()
        stage('graph', 15)
        build = engine.call('/api/graph/build', {'project_id': ids['project_id'], 'graph_name': 'oncotics-simulation-' + sid})
        ids['graph_task_id'] = engine.identifier(build['task_id'])
        save_ids()
        engine.wait('/api/graph/task/' + ids['graph_task_id'], None, lambda d: d.get('status') == 'completed', poll('graph', 15, 20), check_cancel, deadline)
        project = engine.call('/api/graph/project/' + ids['project_id'])
        ids['graph_id'] = engine.identifier(project['graph_id'])
        save_ids()
        entities = engine.call('/api/simulation/entities/' + ids['graph_id'] + '?entity_types=ScenarioStakeholder&enrich=false')
        count = entities.get('filtered_count', len(entities.get('entities', [])))
        if type(count) is not int or count < 1 or count > spec['agent_budget']:
            raise EngineError('Extracted stakeholder count exceeds the agent budget or is empty. Narrow evidence and create a new scenario.')
        created = engine.call('/api/simulation/create', {'project_id': ids['project_id'], 'graph_id': ids['graph_id'], 'enable_twitter': True, 'enable_reddit': True})
        ids['simulation_id'] = engine.identifier(created['simulation_id'])
        save_ids()
        stage('agents', 35)
        prepared = engine.call('/api/simulation/prepare', {'simulation_id': ids['simulation_id'], 'entity_types': ['ScenarioStakeholder'], 'use_llm_for_profiles': True, 'parallel_profile_count': 2}, timeout=180)
        prepare_body = {'simulation_id': ids['simulation_id']}
        if prepared.get('task_id'):
            prepare_body['task_id'] = engine.identifier(prepared['task_id'])
            ids['prepare_task_id'] = prepare_body['task_id']
            save_ids()
        engine.wait('/api/simulation/prepare/status', prepare_body, lambda d: d.get('status') in ('ready', 'completed'), poll('agents', 35, 20), check_cancel, deadline)
        profiles = engine.call('/api/simulation/' + ids['simulation_id'] + '/profiles?platform=reddit')['profiles']
        if not isinstance(profiles, list) or not 1 <= len(profiles) <= spec['agent_budget']:
            raise EngineError('Generated agent count is outside the configured budget')
        agents = [{'provenance': 'SIMULATED', 'synthetic': True, 'profile': p} for p in profiles]
        stage('simulation', 55, agents=agents, agent_count=len(agents))
        engine.call('/api/simulation/start', {'simulation_id': ids['simulation_id'], 'platform': 'parallel', 'max_rounds': spec['rounds'], 'enable_graph_memory_update': True})
        def running(p):
            check_cancel()
            events = engine.call('/api/simulation/' + ids['simulation_id'] + '/actions?limit=100')['actions']
            stage('simulation', 55 + 30 * min(100, max(0, float(p.get('progress_percent', 0)))) / 100,
                  engine_progress={'provenance': 'SIMULATED', 'data': p}, events=[{'provenance': 'SIMULATED', 'data': e} for e in events])
        engine.wait('/api/simulation/' + ids['simulation_id'] + '/run-status', None, lambda d: d.get('runner_status') == 'completed', running, check_cancel, deadline)
        stage('report', 85)
        generated = engine.call('/api/report/generate', {'simulation_id': ids['simulation_id']})
        ids['report_id'] = engine.identifier(generated['report_id'])
        save_ids()
        report_body = {'simulation_id': ids['simulation_id']}
        if generated.get('task_id'):
            ids['report_task_id'] = engine.identifier(generated['task_id'])
            report_body['task_id'] = ids['report_task_id']
            save_ids()
        engine.wait('/api/report/generate/status', report_body, lambda d: d.get('status') == 'completed', poll('report', 85, 10), check_cancel, deadline)
        raw_report = engine.call('/api/report/' + ids['report_id'])
        stage('audit', 95)
        audited = report(data, spec, raw_report, len(agents))
        graph = engine.call('/api/graph/data/' + ids['graph_id'])
        check_cancel()
        store.update(sid, state='completed', stage='completed', progress=100, report=audited,
                     simulation_graph={'provenance': 'SIMULATED', 'data': graph},
                     world={'reality': data['locations'], 'simulation': [], 'difference': [],
                            'limitation': 'These upstream social engines do not return validated geographic changes. Simulation and difference layers remain empty.'})
    except Cancelled:
        confirmed = stop()
        store.update(sid, state='cancelled', stage='cancelled', upstream_stop_confirmed=confirmed,
                     error='Cancellation requested. Background ontology/graph/report tasks may finish upstream; cleanup is operator-managed.')
    except Exception as exc:
        confirmed = stop()
        log.error('Scenario %s failed (%s)', sid, type(exc).__name__)
        store.update(sid, state='failed', stage='failed', upstream_stop_confirmed=confirmed,
                     error=str(exc) if isinstance(exc, EngineError) else 'Integration failed; inspect restricted service logs and recorded stage IDs.')

def main():
    logging.basicConfig(level=logging.INFO)
    store = Store()
    with store.db() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT heartbeat FROM worker_lock WHERE id=1').fetchone()
        if row and time.time() - row[0] < 90:
            raise RuntimeError('Another worker is active; only one worker is supported for this deployment.')
        db.execute('INSERT OR REPLACE INTO worker_lock VALUES(1,?)', (time.time(),))
    alive = threading.Event()
    alive.set()
    def heartbeat():
        while alive.wait(0) and alive.is_set():
            with store.db() as db:
                db.execute('UPDATE worker_lock SET heartbeat=? WHERE id=1', (time.time(),))
            time.sleep(10)
    threading.Thread(target=heartbeat, daemon=True).start()
    try:
        with store.db() as db:
            interrupted = list(db.execute("SELECT * FROM jobs WHERE state='running'"))
        for row in interrupted:
            old = store.decode(row)
            sim = old.get('engine_ids', {}).get('simulation_id')
            if sim:
                try:
                    Engine(old['spec']['engine']).call('/api/simulation/stop', {'simulation_id': sim})
                except EngineError:
                    pass
            store.update(row['id'], state='failed', stage='interrupted', error='Worker restarted. Run was not replayed; inspect engine IDs and clean up upstream tasks before rerunning.')
        while True:
            claimed = store.claim()
            if claimed:
                execute(store, *claimed)
            else:
                time.sleep(2)
    finally:
        alive.clear()
        with store.db() as db:
            db.execute('DELETE FROM worker_lock WHERE id=1')

if __name__ == '__main__':
    main()
