import ast
from pathlib import Path
import pytest

ROOT = Path(__file__).resolve().parents[1]
OPERATIONS = {
 'graph.py': {'/ontology/generate':'POST','/build':'POST','/task/<task_id>':'GET','/project/<project_id>':'GET','/data/<graph_id>':'GET'},
 'simulation.py': {'/create':'POST','/prepare':'POST','/prepare/status':'POST','/start':'POST','/stop':'POST','/<simulation_id>/profiles':'GET','/<simulation_id>/run-status':'GET','/<simulation_id>/actions':'GET','/entities/<graph_id>':'GET'},
 'report.py': {'/generate':'POST','/generate/status':'POST','/<report_id>':'GET'}
}

@pytest.mark.parametrize('engine',['mirofish-cloud','mirofish-offline'])
def test_adapter_operations_exist_in_actual_upstream_code(engine):
    for file, expected in OPERATIONS.items():
        tree=ast.parse((ROOT/'services'/engine/'backend/app/api'/file).read_text(encoding='utf-8'))
        routes={}
        for node in tree.body:
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):
                for dec in node.decorator_list:
                    if isinstance(dec,ast.Call) and isinstance(dec.func,ast.Attribute) and dec.func.attr=='route':
                        methods=next((ast.literal_eval(k.value) for k in dec.keywords if k.arg=='methods'),['GET'])
                        routes.setdefault(ast.literal_eval(dec.args[0]),[]).extend(methods)
        for path,method in expected.items():assert method in routes.get(path,[]),(engine,file,path)
