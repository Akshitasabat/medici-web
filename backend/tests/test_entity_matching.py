"""Unit tests for EntityMatcher."""
import pandas as pd
import pytest
from backend.services.entity_matching import EntityMatcher


@pytest.fixture
def matcher():
    m = EntityMatcher()
    nodes = pd.DataFrame([
        {"node_id": "C001", "name": "Acro Civil Works Ltd", "kind": "company"},
        {"node_id": "C002", "name": "Boreas Water Systems Plc", "kind": "company"},
        {"node_id": "C003", "name": "Solace Medical Supplies Ltd", "kind": "company"},
    ])
    m.fit_nodes(nodes)
    return m


def test_exact_id_match(matcher):
    res = matcher.match_winner("C001", "Some Other Name")
    assert res.match_status == "verified_id_match"
    assert res.candidate_node_id == "C001"
    assert res.is_verified is True


def test_exact_normalized_name_match(matcher):
    # Unknown ID, but exact normalized name
    res = matcher.match_winner("UNKNOWN", "Acro Civil Works")
    assert res.match_status == "exact_name_candidate"
    assert res.candidate_node_id == "C001"
    assert res.is_verified is False


def test_fuzzy_name_match(matcher):
    # Minor typo in name
    res = matcher.match_winner("UNKNOWN", "Boreas Water System", fuzzy_threshold=0.80)
    assert res.match_status in ("exact_name_candidate", "fuzzy_candidate")
    assert res.candidate_node_id == "C002"
    assert res.is_verified is False


def test_unmatched(matcher):
    res = matcher.match_winner("UNKNOWN", "Totally Different Company That Does Not Exist")
    assert res.match_status == "unmatched"
    assert res.candidate_node_id is None
    assert res.is_verified is False
