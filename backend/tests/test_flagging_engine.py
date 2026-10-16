"""Unit tests for FlaggingEngine rules and thresholds."""
import pandas as pd
import pytest
from backend.services.flagging_engine import FlaggingEngine


@pytest.fixture
def engine():
    eng = FlaggingEngine()
    # Mock fitted dataset
    mock_df = pd.DataFrame([
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C01"},
        {"buyer_id": "B01", "winner_company_id": "C02"},
        {"buyer_id": "B01", "winner_company_id": "C03"},
    ])
    eng.fit_dataset(mock_df)
    return eng


def test_single_bidder_rule(engine):
    # Triggers on 1
    flags = engine.evaluate_tender({"n_bidders": 1, "winner_name": "Test Co"})
    rule_ids = [f.rule_id for f in flags]
    assert "RULE_SINGLE_BIDDER" in rule_ids

    # Does not trigger on 2
    flags2 = engine.evaluate_tender({"n_bidders": 2, "winner_name": "Test Co"})
    assert "RULE_SINGLE_BIDDER" not in [f.rule_id for f in flags2]


def test_short_window_rule(engine):
    # 5 days window <= 7 days
    flags = engine.evaluate_tender({
        "publish_date": "2023-01-01",
        "deadline": "2023-01-06",
    })
    rule_ids = [f.rule_id for f in flags]
    assert "RULE_SHORT_WINDOW" in rule_ids
    assert flags[0].calculated_value == 5

    # 15 days window
    flags2 = engine.evaluate_tender({
        "publish_date": "2023-01-01",
        "deadline": "2023-01-16",
    })
    assert "RULE_SHORT_WINDOW" not in [f.rule_id for f in flags2]


def test_newly_registered_winner_rule(engine):
    # 45 days age <= 90 days
    flags = engine.evaluate_tender({
        "winner_reg_date": "2023-01-01",
        "award_date": "2023-02-15",
    })
    rule_ids = [f.rule_id for f in flags]
    assert "RULE_NEW_COMPANY" in rule_ids
    assert flags[0].calculated_value == 45


def test_close_bid_spread_rule(engine):
    # Winner 100,000, 2nd 101,500 (1.5% difference <= 3%)
    flags = engine.evaluate_tender({
        "value": 100000.0,
        "second_bid_value": 101500.0,
    })
    rule_ids = [f.rule_id for f in flags]
    assert "RULE_CLOSE_BIDS" in rule_ids


def test_threshold_hugging_rule(engine):
    # 492,000 is between 475,000 and 500,000
    flags = engine.evaluate_tender({"value": 492000.0})
    rule_ids = [f.rule_id for f in flags]
    assert "RULE_THRESHOLD_HUGGING" in rule_ids

    # 400,000 does not trigger
    flags2 = engine.evaluate_tender({"value": 400000.0})
    assert "RULE_THRESHOLD_HUGGING" not in [f.rule_id for f in flags2]


def test_repeat_winner_rule(engine):
    # B01 has 10 tenders, C01 won 8 (80% >= 40%)
    flags = engine.evaluate_tender({
        "buyer_id": "B01",
        "winner_company_id": "C01",
        "buyer": "Buyer 1",
        "winner_name": "Company 1",
    })
    rule_ids = [f.rule_id for f in flags]
    assert "RULE_REPEAT_WINNER" in rule_ids
