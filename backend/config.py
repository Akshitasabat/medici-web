"""Medici Web Backend Configuration."""
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_DIR = BASE_DIR / "database"
DATA_SQLITE_PATH = BASE_DIR / "medici_investigations.db"

TENDERS_CSV = DATABASE_DIR / "tenders.csv"
NODES_CSV = DATABASE_DIR / "ownership_nodes.csv"
EDGES_CSV = DATABASE_DIR / "ownership_edges.csv"
ANOMALY_KEY_CSV = DATABASE_DIR / "anomaly_key.csv"

# Flagging Engine Screening Heuristics
SINGLE_BIDDER_THRESHOLD = 1
SHORT_WINDOW_DAYS_THRESHOLD = 7
NEW_COMPANY_DAYS_THRESHOLD = 90
REPEAT_WINNER_MIN_TENDERS = 10
REPEAT_WINNER_SHARE_THRESHOLD = 0.40  # 40% buyer concentration
CLOSE_BID_SPREAD_THRESHOLD = 0.03     # 3% second bid spread
THRESHOLD_HUGGING_LOWER = 475000.0   # 95% of 500k CU approval threshold
THRESHOLD_HUGGING_UPPER = 500000.0

DISCLAIMER_TEXT = (
    "Flags identify records for further review. They are screening heuristics "
    "and not proof of misconduct or corruption."
)
