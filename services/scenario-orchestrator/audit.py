"""Deterministic provenance boundary; model text can never promote itself."""
import re

def report(snapshot, spec, engine_report, agent_count):
    claims = [{'provenance': 'FACT', 'text': r['title'], 'record_id': r['id'],
               'url': r['url'], 'receipt_id': r['receipt_id'], 'locator': r['locator'],
               'qualification': 'Source-reported title/identifier only.'} for r in snapshot['records']]
    claims.append({'provenance': 'DERIVED', 'text': f"Retrieved {len(snapshot['records'])} source record occurrences; generated {agent_count} synthetic agents.",
                   'method': 'Count snapshot.records and engine profiles; no clinical inference.'})
    claims.extend({'provenance': 'ASSUMPTION', 'text': x, 'author': 'Researcher'} for x in spec['assumptions'])
    # Whole upstream narrative stays SIMULATED even if it contains the word FACT,
    # citations, matching factual words, instructions, or apparent authority.
    content = engine_report.get('markdown_content', '')
    if not isinstance(content, str):
        raise ValueError('Incompatible upstream report content')
    for sentence in re.split(r'(?<=[.!?])\s+|\n+', content):
        if sentence.strip():
            claims.append({'provenance': 'SIMULATED', 'text': sentence.strip(),
                           'engine_report_id': engine_report.get('report_id'), 'verified': False})
    return {'schema': 'oncotics-scenario-report/1', 'research_only': True, 'claims': claims,
            'audit': {'method': 'Allowlisted source fields + deterministic derivations; all engine narrative stays SIMULATED.',
                      'clinical_claim_validation': False, 'source_count': len(snapshot['records'])},
            'limitations': snapshot['limitations'] + ['Social-agent simulations are not validated models of cancer biology, treatment outcomes, approval, capacity, or geographic change.',
                'Synthetic personas do not represent real people; agent statements are not expert advice.',
                'Model/provider versions, source coverage, assumptions and nondeterminism limit reproducibility.'],
            'upstream_report': {'provenance': 'SIMULATED', 'data': engine_report}}
