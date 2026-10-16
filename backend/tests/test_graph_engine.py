"""Unit tests for NetworkX GraphEngine."""
import pandas as pd
import pytest
from backend.services.graph_engine import GraphEngine


@pytest.fixture
def graph():
    eng = GraphEngine()
    nodes = pd.DataFrame([
        {"node_id": "N1", "name": "Company Alpha", "kind": "company"},
        {"node_id": "N2", "name": "John Doe", "kind": "officer"},
        {"node_id": "N3", "name": "Company Beta", "kind": "company"},
        {"node_id": "N4", "name": "Offshore Hub Ltd", "kind": "offshore_entity"},
        {"node_id": "N5", "name": "Isolated Entity", "kind": "company"},
    ])
    edges = pd.DataFrame([
        {"edge_id": "E1", "start_id": "N2", "end_id": "N1", "rel_type": "director_of"},
        {"edge_id": "E2", "start_id": "N2", "end_id": "N3", "rel_type": "director_of"},
        {"edge_id": "E3", "start_id": "N4", "end_id": "N1", "rel_type": "shareholder_of"},
    ])
    eng.build_graph(nodes, edges)
    return eng


def test_neighborhood(graph):
    nh = graph.get_neighborhood("N2", hops=1)
    assert nh is not None
    assert nh.center_node.node_id == "N2"
    node_ids = {n.node_id for n in nh.nodes}
    assert "N1" in node_ids
    assert "N3" in node_ids
    assert len(nh.edges) == 2


def test_shortest_path_exists(graph):
    res = graph.find_shortest_path("N3", "N4")
    assert res.path_found is True
    assert res.hops == 3  # N3 - N2 - N1 - N4
    assert res.node_path == ["N3", "N2", "N1", "N4"]


def test_shortest_path_disconnected(graph):
    res = graph.find_shortest_path("N1", "N5")
    assert res.path_found is False
    assert res.hops == 0
    assert "No recorded relationship path" in res.message


def test_connected_components(graph):
    comps = graph.get_connected_components(min_size=1)
    # Component 1 has 4 nodes (N1, N2, N3, N4), Component 2 has 1 node (N5)
    assert len(comps) >= 1
    assert comps[0].node_count == 4
