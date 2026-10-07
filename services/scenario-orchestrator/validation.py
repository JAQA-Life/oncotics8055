"""Conservative public-research inputs. These checks are not a PHI detector."""
import re

class Invalid(ValueError):
    pass

SENSITIVE = re.compile(r'[^\s@]+@[^\s@]+\.[a-z]{2,}|\b(?:dob|date of birth|mrn|patient name|patient id|medical record|ssn|study instance uid|accession number)\b|\b\d{3}-\d{2}-\d{4}\b|\b\d{1,3}\s*(?:year[- ]old|y/o|yo)\b|\b(?:my|our)\s+(?:patient|mother|father|wife|husband|child)\b|\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b|\b\d+(?:\.\d+){6,}\b|\b\d{3}[ .-]\d{3}[ .-]\d{4}\b', re.I)

def text(value, limit=1000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise Invalid('Provide a non-empty public research concept within the length limit.')
    if SENSITIVE.search(value) or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', value):
        raise Invalid('Sensitive identifiers are not accepted. Use public, non-patient research concepts.')
    return value.strip()

def entities(value):
    if not isinstance(value, list) or not 1 <= len(value) <= 6:
        raise Invalid('Choose between one and six evidence concepts.')
    return list(dict.fromkeys(text(x, 120) for x in value))

def scenario(value):
    if not isinstance(value, dict):
        raise Invalid('Expected a JSON object.')
    if value.get('research_only') is not True or value.get('public_data_only') is not True:
        raise Invalid('Confirm research use and public, non-patient data.')
    engine = value.get('engine')
    if engine not in ('local', 'cloud'):
        raise Invalid('Unknown engine.')
    if engine == 'cloud' and value.get('cloud_consent') is not True:
        raise Invalid('Cloud processing requires explicit consent.')
    rounds, budget = value.get('rounds', 10), value.get('agent_budget', 80)
    if type(rounds) is not int or not 1 <= rounds <= 30 or type(budget) is not int or not 1 <= budget <= 200:
        raise Invalid('Use 1–30 rounds and an agent budget of 1–200.')
    assumptions = value.get('assumptions', [])
    if not isinstance(assumptions, list) or not 1 <= len(assumptions) <= 20:
        raise Invalid('State at least one explicit assumption (maximum 20).')
    return {'title': text(value.get('title'), 180), 'question': text(value.get('question'), 2000),
            'engine': engine, 'rounds': rounds, 'agent_budget': budget,
            'snapshot_id': text(value.get('snapshot_id'), 80),
            'assumptions': [text(x, 500) for x in assumptions],
            'research_only': True, 'public_data_only': True,
            'cloud_consent': engine == 'cloud'}
