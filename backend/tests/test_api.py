"""Integration tests for FastAPI endpoints."""
from fastapi.testclient import TestClient
import pytest
from backend.app import app

client = TestClient(app)


def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_api_summary():
    res = client.get("/api/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_tenders"] == 1500
    assert data["entities_indexed"] == 350
    assert data["flagged_tenders_count"] > 0
    assert "RULE_SINGLE_BIDDER" in [k.upper().replace(" ", "_") for k in data["rule_breakdown"].keys()] or len(data["rule_breakdown"]) > 0


def test_api_tenders_pagination():
    res = client.get("/api/tenders?page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 10
    assert data["total"] == 1500
    assert data["total_pages"] == 150


def test_api_tenders_filter_flagged():
    res = client.get("/api/tenders?flagged_only=true&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] > 0
    for item in data["items"]:
        assert item["flag_count"] > 0


def test_api_tender_detail():
    res = client.get("/api/tenders/T00502")
    assert res.status_code == 200
    data = res.json()
    assert data["tender_id"] == "T00502"
    assert "flags" in data


def test_api_entities():
    res = client.get("/api/entities?page_size=5")
    assert res.status_code == 200
    data = res.json()
    assert len(data["items"]) == 5
    assert data["total"] == 350


def test_api_entity_neighborhood():
    res = client.get("/api/entities/C091/neighborhood?hops=1")
    assert res.status_code == 200
    data = res.json()
    assert data["center_node"]["node_id"] == "C091"
    assert len(data["nodes"]) >= 1


def test_api_investigations():
    res = client.get("/api/investigations/T00502")
    assert res.status_code == 200
    data = res.json()
    assert data["tender"]["tender_id"] == "T00502"
    assert data["winner_match"] is not None
    assert data["winner_match"]["candidate_node_id"] == "C091"


def test_api_saved_investigations_lifecycle():
    # Create or update note
    payload = {
        "tender_id": "T00502",
        "status": "under_review",
        "priority": "high",
        "analyst_notes": "Automated test note verifying triage workflow.",
        "tags": "test,priority",
    }
    post_res = client.post("/api/saved-investigations", json=payload)
    assert post_res.status_code == 200
    assert post_res.json()["status"] == "under_review"

    # List
    list_res = client.get("/api/saved-investigations")
    assert list_res.status_code == 200
    tids = [r["tender_id"] for r in list_res.json()]
    assert "T00502" in tids

    # Delete
    del_res = client.delete("/api/saved-investigations/T00502")
    assert del_res.status_code == 200
