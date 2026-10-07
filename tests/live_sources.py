"""Optional smoke check of public providers, with no patient data or model calls."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'services/scenario-orchestrator'))
import evidence
if __name__=='__main__':
    import json
    results=[]
    for source, query in [('ctgov','PSMA'),('epmc','PSMA'),('uniprot','FOLH1'),('pubchem','osimertinib'),('openfda','osimertinib')]:
        try:
            payload,url,status=evidence.retrieve(source,query)
            rs,ps=evidence.records(source,payload,{'id':'smoke'},query)
            results.append({'source':source,'status':status,'records':len(rs),'coordinates':len(ps),'url':url})
        except Exception as exc:results.append({'source':source,'error_type':type(exc).__name__})
    print(json.dumps(results,indent=2))
