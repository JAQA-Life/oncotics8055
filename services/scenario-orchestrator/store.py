"""Evidence snapshots and simulation jobs have separate persistence boundaries."""
import hashlib
import json
import os
import sqlite3
import time
import uuid
from pathlib import Path

def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))

def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

class Store:
    def __init__(self, data=None, evidence=None):
        self.data = Path(data or os.environ.get('SCENARIO_DATA_DIR', '/data/simulation'))
        self.evidence = Path(evidence or os.environ.get('EVIDENCE_DIR', '/data/evidence'))
        self.data.mkdir(parents=True, exist_ok=True)
        self.evidence.mkdir(parents=True, exist_ok=True)
        with self.db() as db:
            db.executescript('''
            CREATE TABLE IF NOT EXISTS jobs (
              id TEXT PRIMARY KEY, owner TEXT NOT NULL, state TEXT NOT NULL,
              spec TEXT NOT NULL, body TEXT NOT NULL, created REAL NOT NULL,
              updated REAL NOT NULL, cancel INTEGER NOT NULL DEFAULT 0,
              idem TEXT NOT NULL, UNIQUE(owner,idem));
            CREATE TABLE IF NOT EXISTS worker_lock (id INTEGER PRIMARY KEY, heartbeat REAL);
            ''')

    def db(self):
        db = sqlite3.connect(self.data / 'scenarios.sqlite', timeout=30)
        db.row_factory = sqlite3.Row
        db.execute('PRAGMA journal_mode=WAL')
        return db

    def freeze(self, owner, snapshot):
        envelope = {'owner': owner, 'snapshot': snapshot, 'sha256': digest(snapshot)}
        sid = str(uuid.uuid4())
        path = self.evidence / (sid + '.json')
        with path.open('x', encoding='utf-8') as f:
            f.write(canonical(envelope))
        return {'id': sid, **envelope}

    def snapshot(self, sid, owner):
        # UUID validation prevents filesystem traversal. No user-supplied URLs/files.
        sid = str(uuid.UUID(sid))
        value = json.loads((self.evidence / (sid + '.json')).read_text(encoding='utf-8'))
        if value['owner'] != owner:
            raise FileNotFoundError('Snapshot not found')
        if digest(value['snapshot']) != value['sha256']:
            raise ValueError('Evidence integrity check failed')
        return {'id': sid, **value}

    def create(self, owner, spec, idem):
        now, sid = time.time(), str(uuid.uuid4())
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            old = db.execute('SELECT * FROM jobs WHERE owner=? AND idem=?', (owner, idem)).fetchone()
            if old:
                if canonical(spec) != old['spec']:
                    raise ValueError('Idempotency key already used for a different scenario')
                return self.decode(old)
            count = db.execute("SELECT count(*) FROM jobs WHERE owner=? AND state NOT IN ('completed','failed','cancelled')", (owner,)).fetchone()[0]
            if count >= 3:
                raise ValueError('Three active scenarios already exist. Wait or cancel a run.')
            body = {'id': sid, 'spec': spec, 'state': 'queued', 'stage': 'queued',
                    'progress': 0, 'agents': [], 'events': [], 'created_at': now,
                    'provenance': 'SIMULATED', 'research_only': True}
            db.execute('INSERT INTO jobs(id,owner,state,spec,body,created,updated,idem) VALUES(?,?,?,?,?,?,?,?)',
                       (sid, owner, 'queued', canonical(spec), canonical(body), now, now, idem))
        return body

    def decode(self, row):
        return json.loads(row['body'])

    def get(self, sid, owner=None):
        with self.db() as db:
            row = db.execute('SELECT * FROM jobs WHERE id=?', (sid,)).fetchone()
        if not row or (owner is not None and row['owner'] != owner):
            raise FileNotFoundError('Scenario not found')
        return self.decode(row)

    def list(self, owner):
        with self.db() as db:
            return [self.decode(r) for r in db.execute('SELECT * FROM jobs WHERE owner=? ORDER BY created DESC LIMIT 100', (owner,))]

    def update(self, sid, **changes):
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM jobs WHERE id=?', (sid,)).fetchone()
            value = self.decode(row)
            value.update(changes)
            value['updated_at'] = time.time()
            db.execute('UPDATE jobs SET state=?,body=?,updated=? WHERE id=?',
                       (value['state'], canonical(value), time.time(), sid))
        return value

    def claim(self):
        with self.db() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute("SELECT * FROM jobs WHERE state='queued' ORDER BY created LIMIT 1").fetchone()
            if not row:
                return None
            body = self.decode(row)
            body['state'] = 'running'
            db.execute("UPDATE jobs SET state='running',body=?,updated=? WHERE id=?", (canonical(body), time.time(), row['id']))
        return row['id'], row['owner']

    def cancel(self, sid, owner):
        self.get(sid, owner)
        with self.db() as db:
            db.execute('UPDATE jobs SET cancel=1 WHERE id=? AND owner=?', (sid, owner))

    def cancelled(self, sid):
        with self.db() as db:
            return bool(db.execute('SELECT cancel FROM jobs WHERE id=?', (sid,)).fetchone()[0])
