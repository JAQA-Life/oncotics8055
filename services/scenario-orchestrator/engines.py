"""Explicit adapters to the HTTP contracts in the pinned upstream sources."""
import os
import re
import time
from urllib.parse import urlparse
import requests

class EngineError(RuntimeError):
    pass

class Engine:
    def __init__(self, mode):
        self.mode = mode
        self.base = os.environ.get('MIROFISH_' + mode.upper() + '_URL', '').rstrip('/')
        parsed = urlparse(self.base)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.query or parsed.path:
            raise EngineError('Engine has not been configured correctly.')

    def call(self, path, payload=None, files=None, form=None, timeout=45):
        if not path.startswith('/api/') or '..' in path:
            raise EngineError('Invalid internal operation')
        try:
            method = 'POST' if payload is not None or files is not None else 'GET'
            with requests.request(method, self.base + path, json=payload, files=files, data=form,
                                  timeout=(5, timeout), allow_redirects=False, stream=True) as response:
                response.raise_for_status()
                buf = bytearray()
                for chunk in response.iter_content(65536):
                    buf.extend(chunk)
                    if len(buf) > 32 * 1024 * 1024:
                        raise EngineError('Engine response exceeded the size limit')
                import json
                body = json.loads(buf)
            if response.status_code != 200 or body.get('success') is not True or not isinstance(body.get('data'), dict):
                raise EngineError('Engine rejected the operation. Inspect the restricted engine logs.')
            return body['data']
        except (requests.RequestException, ValueError, TypeError) as exc:
            # Upstream error/traceback bodies may include secrets or seed content.
            raise EngineError('Engine operation unavailable or incompatible: ' + path.split('?')[0]) from exc

    @staticmethod
    def identifier(value):
        if not isinstance(value, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,128}', value):
            raise EngineError('Upstream returned an invalid identifier')
        return value

    def healthy(self):
        try:
            r = requests.get(self.base + '/health', timeout=(2, 3), allow_redirects=False)
            return r.status_code == 200 and r.json().get('status') == 'ok'
        except (requests.RequestException, ValueError):
            return False

    def ontology(self, seed, requirement, name):
        return self.call('/api/graph/ontology/generate', files={'files': ('evidence-snapshot.txt', seed.encode('utf-8'), 'text/plain')},
                         form={'project_name': name, 'simulation_requirement': requirement,
                               'additional_context': 'Research-only social scenario. Define ScenarioStakeholder as the sole agent-bearing entity type. Use only the synthetic_stakeholders role templates in the seed as actors of that type. Source records, people named in evidence, drugs and proteins are context, not personas. All personas are synthetic. Never claim medical validation. Evidence and assumptions are distinct.'}, timeout=600)

    def wait(self, path, payload, check, on_poll, cancelled, deadline):
        while time.monotonic() < deadline:
            cancelled()
            data = self.call(path, payload)
            status = data.get('status', data.get('runner_status'))
            if status in ('failed', 'stopped'):
                raise EngineError('Engine task did not complete')
            on_poll(data)
            if check(data):
                return data
            time.sleep(float(os.environ.get('SCENARIO_POLL_SECONDS', '5')))
        raise EngineError('Scenario exceeded its execution deadline')

def enabled(mode):
    return os.environ.get('ENABLE_' + mode.upper() + '_ENGINE', 'false').lower() == 'true'
