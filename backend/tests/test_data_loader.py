"""Unit tests for DataLoader."""
import pytest
from backend.services.data_loader import DataLoader


def test_data_loader_real_csv():
    loader = DataLoader()
    loader.load_all()

    tenders = loader.get_tenders()
    assert len(tenders) == 1500
    assert "tender_id" in tenders.columns
    assert "winner_company_id" in tenders.columns

    nodes = loader.get_nodes()
    assert len(nodes) == 350
    assert "node_id" in nodes.columns

    edges = loader.get_edges()
    assert len(edges) == 247
    assert "start_id" in edges.columns
    assert "end_id" in edges.columns

    report = loader.get_quality_report()
    assert report.tenders_count == 1500
    assert report.nodes_count == 350
    assert report.edges_count == 247
    assert report.duplicate_tender_ids == 0
