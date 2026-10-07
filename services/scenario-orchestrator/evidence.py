"""Server equivalents of existing Oncotics public-source adapters.

Search relevance is not scientific confirmation. FACT means a preserved source
field, with a locator and receipt, never a clinical interpretation.
"""
import concurrent.futures
import json
import re
import time
from pathlib import Path
from urllib.parse import quote
import requests
from store import digest

SOURCES = ('ctgov', 'epmc', 'uniprot', 'pubchem', 'openfda')
ALIASES = json.loads((Path(__file__).parent / 'entity-aliases.json').read_text(encoding='utf-8'))

def resolve(concepts):
    out = []
    for concept in concepts:
        mapping = ALIASES['genes'].get(concept.upper()) or ALIASES['drugs'].get(concept.lower())
        out.append({'input': concept, 'normalized': mapping or concept,
                    'provenance': 'DERIVED', 'method': 'Existing Oncotics alias routing hint' if mapping else 'Unresolved public search concept',
                    'confirmed': False, 'canonical_source_id': None})
    return out

def get_json(url, params=None):
    # Fixed provider hosts only; no redirects to arbitrary/internal hosts.
    with requests.get(url, params=params, timeout=(5, 20), allow_redirects=False,
                      headers={'Accept': 'application/json', 'User-Agent': 'Oncotics-Scenario-Lab/1.0'}, stream=True) as response:
        if response.status_code != 404:
            response.raise_for_status()
        if response.status_code not in (200, 404):
            raise ValueError('Provider redirect or unexpected response')
        buf = bytearray()
        for chunk in response.iter_content(65536):
            buf.extend(chunk)
            if len(buf) > 8 * 1024 * 1024:
                raise ValueError('Provider response exceeds evidence size limit')
        return json.loads(buf), response.url, response.status_code

def retrieve(source, concept):
    q = concept.replace('"', '').replace('\\', '')
    if source == 'ctgov':
        return get_json('https://clinicaltrials.gov/api/v2/studies', {'query.term': q, 'pageSize': 10, 'format': 'json'})
    if source == 'epmc':
        return get_json('https://www.ebi.ac.uk/europepmc/webservices/rest/search', {'query': '"' + q + '"', 'format': 'json', 'pageSize': 10})
    if source == 'uniprot':
        return get_json('https://rest.uniprot.org/uniprotkb/search', {'query': 'organism_id:9606 AND (' + ('gene_exact:' + q if re.fullmatch(r'[A-Z0-9-]{2,20}', q) else '"' + q + '"') + ')', 'format': 'json', 'size': 10})
    if source == 'pubchem':
        return get_json('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/' + quote(q, safe='') + '/property/Title,MolecularFormula/JSON')
    if source == 'openfda':
        # Same four label search fields used by the supplied workspace.
        terms = [q] + [brand for brand, generic in ALIASES['drugs'].items() if generic.lower() == q.lower()][:3]
        # requests encodes spaces as URL '+' separators. A literal '+' string
        # would instead be encoded as %2B, changing the query syntax.
        search = ' '.join(field + ':"' + term + '"' for field in ('openfda.generic_name', 'openfda.brand_name', 'openfda.substance_name', 'spl_product_data_elements') for term in terms)
        return get_json('https://api.fda.gov/drug/label.json', {'search': search, 'limit': 5})
    raise ValueError('Unsupported evidence source')

def records(source, payload, receipt, concept):
    result, places = [], []
    def add(source_id, title, path, url, raw):
        rid = source + ':' + str(source_id)
        result.append({'id': rid, 'source': source, 'source_id': str(source_id), 'title': title,
                       'url': url, 'locator': path, 'receipt_id': receipt['id'],
                       'provenance': 'FACT', 'meaning': 'Source-reported field; not independently verified',
                       'matched_query': concept, 'raw': raw})
        return rid
    if source == 'ctgov':
        for i, item in enumerate(payload.get('studies', [])):
            protocol = item.get('protocolSection', {})
            ident = protocol.get('identificationModule', {})
            nct = ident.get('nctId')
            if not nct:
                continue
            rid = add(nct, ident.get('briefTitle', nct), f'/studies/{i}/protocolSection/identificationModule/' + ('briefTitle' if ident.get('briefTitle') else 'nctId'), 'https://clinicaltrials.gov/study/' + quote(nct), item)
            for j, loc in enumerate(protocol.get('contactsLocationsModule', {}).get('locations', [])):
                geo = loc.get('geoPoint', {})
                lat, lon = geo.get('lat'), geo.get('lon')
                if type(lat) in (int, float) and type(lon) in (int, float) and -90 <= lat <= 90 and -180 <= lon <= 180:
                    places.append({'id': rid + ':' + str(j), 'lat': lat, 'lon': lon, 'label': loc.get('facility', loc.get('city', nct)),
                                   'record_id': rid, 'provenance': 'FACT', 'receipt_id': receipt['id'],
                                   'locator': f'/studies/{i}/protocolSection/contactsLocationsModule/locations/{j}/geoPoint'})
    elif source == 'epmc':
        for i, item in enumerate(payload.get('resultList', {}).get('result', [])):
            sid = str(item.get('id', ''))
            origin = str(item.get('source', ''))
            if sid and origin:
                add(origin + ':' + sid, item.get('title', sid), f'/resultList/result/{i}/title', 'https://europepmc.org/article/' + quote(origin) + '/' + quote(sid), item)
    elif source == 'uniprot':
        for i, item in enumerate(payload.get('results', [])):
            acc = item.get('primaryAccession')
            if acc:
                add(acc, item.get('uniProtkbId', acc), f'/results/{i}/' + ('uniProtkbId' if item.get('uniProtkbId') else 'primaryAccession'), 'https://www.uniprot.org/uniprotkb/' + quote(acc) + '/entry', item)
    elif source == 'pubchem':
        for i, item in enumerate(payload.get('PropertyTable', {}).get('Properties', [])):
            if item.get('CID'):
                add(item['CID'], item.get('Title', str(item['CID'])), f'/PropertyTable/Properties/{i}/' + ('Title' if item.get('Title') else 'CID'), 'https://pubchem.ncbi.nlm.nih.gov/compound/' + str(item['CID']), item)
    elif source == 'openfda':
        for i, item in enumerate(payload.get('results', [])):
            sid = item.get('set_id') or item.get('id')
            if sid:
                title = ', '.join(item.get('openfda', {}).get('generic_name', [])) or sid
                add(sid, title, f'/results/{i}/openfda/generic_name' if item.get('openfda', {}).get('generic_name') else f'/results/{i}/' + ('set_id' if item.get('set_id') else 'id'), 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=' + quote(sid), item)
    return result, places

def snapshot(concepts, sources):
    resolved = resolve(concepts)
    receipts, entries, places = [], [], []
    def one(source, entity):
        concept = entity['normalized']
        receipt = {'id': digest([source, concept])[:24], 'source': source, 'query': concept,
                   'retrieved_at': time.time(), 'status': 'unavailable'}
        try:
            payload, url, status = retrieve(source, concept)
            receipt.update(url=url, http_status=status, payload=payload, sha256=digest(payload), status='ok' if status == 200 else 'empty')
            rs, ps = records(source, payload, receipt, concept)
            if not rs:
                receipt['status'] = 'empty'
            return receipt, rs, ps
        except (requests.RequestException, ValueError, KeyError, TypeError):
            receipt['error'] = 'Public source unavailable or returned an incompatible response; no evidence inferred.'
            return receipt, [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        futures = [pool.submit(one, s, e) for s in sources for e in resolved]
        for future in futures:
            r, es, ps = future.result()
            receipts.append(r)
            entries.extend(es)
            places.extend(ps)
    # Keep each retrieved occurrence: locators are tied to its exact raw receipt.
    for i, entry in enumerate(entries):
        entry['id'] += ':' + entry['receipt_id']
    for place in places:
        place['record_id'] += ':' + place['receipt_id']
        place['id'] += ':' + place['receipt_id']
    return {'schema': 'oncotics-evidence-snapshot/1', 'created_at': time.time(),
            'entities': resolved, 'receipts': receipts, 'records': entries, 'locations': places,
            'graph': {'nodes': [{'id': x['id'], 'provenance': 'FACT', 'receipt_id': x['receipt_id']} for x in entries] + [{'id': 'query:' + e['normalized'], 'provenance': 'DERIVED', 'label': e['normalized']} for e in resolved],
                      'edges': [{'from': x['id'], 'to': 'query:' + x['matched_query'], 'relation': 'retrieved_for_query', 'provenance': 'DERIVED', 'method': 'Public source query match; not a biological relationship'} for x in entries]},
            'limitations': ['Bounded source search, not a systematic review.', 'Absence of retrieved records is not evidence of absence.',
                           'Search matches and alias mappings require researcher review.', 'No nuclear data adapter exists in the supplied app; no nuclear values are invented.']}
