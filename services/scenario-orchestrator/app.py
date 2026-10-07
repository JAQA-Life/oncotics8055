"""Authenticated same-origin Scenario Lab API. Engines are never browser endpoints."""
import hashlib
import hmac
import os
import time
import uuid
from flask import Flask, g, jsonify, request
from werkzeug.exceptions import HTTPException
import evidence
from engines import Engine, enabled
from store import Store, digest
from validation import Invalid, entities, scenario

def create_app(store=None):
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 64 * 1024
    store = store or Store()
    proxy_key = os.environ.get('SCENARIO_PROXY_SECRET', '')
    csrf_key = os.environ.get('SCENARIO_CSRF_SECRET', '')
    if len(proxy_key) < 32 or len(csrf_key) < 32 or proxy_key == csrf_key:
        raise RuntimeError('Set distinct proxy and CSRF secrets of at least 32 characters.')
    origin = os.environ.get('SCENARIO_PUBLIC_ORIGIN', 'https://oncotics.com').rstrip('/')
    with store.db() as db:
        db.execute('CREATE TABLE IF NOT EXISTS requests (owner TEXT, at REAL)')

    def csrf(owner, day=None):
        day = int(time.time() // 86400) if day is None else day
        return hmac.new(csrf_key.encode(), f'{owner}:{day}'.encode(), hashlib.sha256).hexdigest()

    @app.before_request
    def authenticate():
        if request.path == '/health':
            return None
        if not hmac.compare_digest(request.headers.get('X-Oncotics-Proxy', ''), proxy_key):
            return jsonify(error='Authentication required'), 401
        owner = request.headers.get('X-Oncotics-User', '')
        if not owner or len(owner) > 128:
            return jsonify(error='Authentication required'), 401
        g.owner = owner
        if request.method != 'GET':
            if request.headers.get('Origin') not in (None, origin):
                return jsonify(error='Cross-origin mutations are not accepted'), 403
            token = request.headers.get('X-CSRF-Token', '')
            if not any(hmac.compare_digest(token, csrf(owner, day)) for day in (int(time.time() // 86400), int(time.time() // 86400) - 1)):
                return jsonify(error='Refresh Scenario Lab before submitting'), 403

    @app.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        return response

    @app.errorhandler(Exception)
    def errors(exc):
        if isinstance(exc, HTTPException):
            return jsonify(error=exc.description), exc.code
        if isinstance(exc, FileNotFoundError):
            return jsonify(error='Record not found'), 404
        if isinstance(exc, (Invalid, ValueError)):
            return jsonify(error=str(exc)), 400
        app.logger.error('Scenario API failed (%s)', type(exc).__name__)
        return jsonify(error='Scenario service failed. No results have been inferred.'), 500

    @app.get('/health')
    def health():
        return jsonify(status='ok', service='oncotics-scenario-orchestrator')

    @app.get('/api/scenarios/config')
    def config():
        modes = []
        for mode in ('local', 'cloud'):
            active = enabled(mode)
            healthy = False
            if active:
                try:
                    healthy = Engine(mode).healthy()
                except RuntimeError:
                    pass
            modes.append({'id': mode, 'enabled': active, 'available': healthy})
        with store.db() as db:
            lock = db.execute('SELECT heartbeat FROM worker_lock WHERE id=1').fetchone()
        return jsonify(csrf_token=csrf(g.owner), sources=list(evidence.SOURCES), engines=modes,
                       worker_available=bool(lock and time.time() - lock[0] < 90),
                       limits={'rounds': 30, 'agents': 200, 'entities': 6}, research_only=True)

    @app.post('/api/scenarios/evidence')
    def collect():
        value = request.get_json()
        if not isinstance(value, dict) or value.get('public_data_only') is not True:
            raise Invalid('Only public, non-patient evidence concepts are accepted.')
        concepts = entities(value.get('entities'))
        sources = value.get('sources', ['ctgov', 'epmc', 'uniprot'])
        if not isinstance(sources, list) or not sources or any(x not in evidence.SOURCES for x in sources):
            raise Invalid('Select a supported public evidence source.')
        with store.db() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM requests WHERE at<?', (time.time() - 3600,))
            count = db.execute('SELECT count(*) FROM requests WHERE owner=?', (g.owner,)).fetchone()[0]
            if count >= 6:
                return jsonify(error='Evidence retrieval limit reached. Try again within one hour.'), 429
            db.execute('INSERT INTO requests VALUES(?,?)', (g.owner, time.time()))
        result = store.freeze(g.owner, evidence.snapshot(concepts, list(dict.fromkeys(sources))))
        result.pop('owner')
        return jsonify(result), 201

    @app.get('/api/scenarios/evidence/<sid>')
    def get_evidence(sid):
        result = store.snapshot(sid, g.owner)
        result.pop('owner')
        return jsonify(result)

    @app.post('/api/scenarios')
    def create():
        spec = scenario(request.get_json())
        if not enabled(spec['engine']):
            return jsonify(error='Selected engine is disabled'), 503
        snap = store.snapshot(spec['snapshot_id'], g.owner)
        if not snap['snapshot']['records']:
            raise Invalid('No source-backed evidence was retrieved. Refine concepts or change sources before creating a scenario.')
        if time.time() - snap['snapshot']['created_at'] > 86400:
            raise Invalid('Snapshot is older than 24 hours. Retrieve current evidence.')
        idem = request.headers.get('Idempotency-Key', '')
        try:
            uuid.UUID(idem)
        except (ValueError, AttributeError):
            raise Invalid('Provide a UUID Idempotency-Key')
        return jsonify(store.create(g.owner, spec, idem)), 202

    @app.get('/api/scenarios')
    def listing():
        rows = store.list(g.owner)
        return jsonify(scenarios=[{k: row.get(k) for k in ('id', 'state', 'stage', 'progress', 'spec', 'created_at', 'error')} for row in rows])

    @app.get('/api/scenarios/<sid>')
    def get_scenario(sid):
        return jsonify(store.get(sid, g.owner))

    @app.post('/api/scenarios/<sid>/cancel')
    def cancel(sid):
        store.cancel(sid, g.owner)
        return jsonify(message='Cancellation requested; in-flight upstream tasks may finish before the worker can stop them.'), 202

    @app.get('/api/scenarios/<sid>/export')
    def export(sid):
        value = store.get(sid, g.owner)
        snapshot = store.snapshot(value['spec']['snapshot_id'], g.owner)
        snapshot.pop('owner')
        response = jsonify(schema='oncotics-scenario-export/1', scenario=value, evidence=snapshot,
                           integrity={'evidence_sha256': snapshot['sha256'], 'scenario_sha256': digest(value)})
        response.headers['Content-Disposition'] = 'attachment; filename="oncotics-scenario-' + str(uuid.UUID(sid)) + '.json"'
        return response

    return app
