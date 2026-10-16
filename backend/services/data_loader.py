"""Data loader service for ingesting and validating procurement and ownership CSVs."""
import logging
from pathlib import Path
from typing import Any, Optional
import pandas as pd
import numpy as np

from backend.config import (
    TENDERS_CSV,
    NODES_CSV,
    EDGES_CSV,
    ANOMALY_KEY_CSV,
)
from backend.models.schemas import DataQualityReport

logger = logging.getLogger(__name__)


class DataLoader:
    def __init__(
        self,
        tenders_path: Path = TENDERS_CSV,
        nodes_path: Path = NODES_CSV,
        edges_path: Path = EDGES_CSV,
        anomaly_key_path: Path = ANOMALY_KEY_CSV,
    ):
        self.tenders_path = Path(tenders_path)
        self.nodes_path = Path(nodes_path)
        self.edges_path = Path(edges_path)
        self.anomaly_key_path = Path(anomaly_key_path)

        self._tenders_df: Optional[pd.DataFrame] = None
        self._nodes_df: Optional[pd.DataFrame] = None
        self._edges_df: Optional[pd.DataFrame] = None
        self._anomaly_key_df: Optional[pd.DataFrame] = None
        self._quality_report: Optional[DataQualityReport] = None

    def load_all(self, force_reload: bool = False) -> None:
        """Load and validate all four CSV datasets."""
        if not force_reload and self._tenders_df is not None:
            return

        self._load_tenders()
        self._load_nodes()
        self._load_edges()
        self._load_anomaly_key()
        self._compute_data_quality()

    def _load_tenders(self) -> None:
        if not self.tenders_path.exists():
            raise FileNotFoundError(f"Tenders dataset not found at {self.tenders_path}")

        df = pd.read_csv(self.tenders_path, dtype=str)
        required_cols = [
            "tender_id",
            "buyer_id",
            "buyer",
            "category",
            "title",
            "procedure",
            "publish_date",
            "deadline",
            "award_date",
            "n_bidders",
            "winner_company_id",
            "winner_name",
            "value",
        ]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Tenders CSV is missing required columns: {missing}")

        # Coerce types cleanly
        df["tender_id"] = df["tender_id"].str.strip()
        df["buyer_id"] = df["buyer_id"].str.strip()
        df["buyer"] = df["buyer"].fillna("Unknown Buyer").str.strip()
        df["category"] = df["category"].fillna("general").str.strip()
        df["title"] = df["title"].fillna("Untitled Tender").str.strip()
        df["procedure"] = df["procedure"].fillna("unknown").str.strip()
        df["currency"] = df["currency"].fillna("CU").str.strip() if "currency" in df.columns else "CU"

        # Coerce numeric fields
        df["n_bidders"] = pd.to_numeric(df["n_bidders"], errors="coerce").fillna(0).astype(int)
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
        if "second_bid_value" in df.columns:
            df["second_bid_value"] = pd.to_numeric(df["second_bid_value"], errors="coerce")
        else:
            df["second_bid_value"] = np.nan

        # Normalize string identifiers
        df["winner_company_id"] = df["winner_company_id"].fillna("").str.strip()
        df["winner_name"] = df["winner_name"].fillna("").str.strip()

        # Date normalization
        for col in ["publish_date", "deadline", "award_date", "winner_reg_date"]:
            if col in df.columns:
                df[col] = df[col].replace({np.nan: None})
                df[col] = df[col].astype(str).str.strip().replace({"nan": None, "": None})

        self._tenders_df = df
        logger.info("Loaded %d tenders from %s", len(df), self.tenders_path)

    def _load_nodes(self) -> None:
        if not self.nodes_path.exists():
            raise FileNotFoundError(f"Ownership nodes dataset not found at {self.nodes_path}")

        df = pd.read_csv(self.nodes_path, dtype=str)
        required_cols = ["node_id", "name", "kind"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Ownership nodes CSV is missing required columns: {missing}")

        df["node_id"] = df["node_id"].str.strip()
        df["name"] = df["name"].fillna("Unnamed Entity").str.strip()
        df["kind"] = df["kind"].fillna("unknown").str.strip()
        for col in ["jurisdiction", "reg_date", "flagged_status", "source"]:
            if col in df.columns:
                df[col] = df[col].replace({np.nan: None})
                df[col] = df[col].astype(str).str.strip().replace({"nan": None, "": None})

        self._nodes_df = df
        logger.info("Loaded %d nodes from %s", len(df), self.nodes_path)

    def _load_edges(self) -> None:
        if not self.edges_path.exists():
            raise FileNotFoundError(f"Ownership edges dataset not found at {self.edges_path}")

        df = pd.read_csv(self.edges_path, dtype=str)
        required_cols = ["edge_id", "start_id", "end_id", "rel_type"]
        missing = [c for c in required_cols if c not in df.columns]
        if missing:
            raise ValueError(f"Ownership edges CSV is missing required columns: {missing}")

        df["edge_id"] = df["edge_id"].str.strip()
        df["start_id"] = df["start_id"].str.strip()
        df["end_id"] = df["end_id"].str.strip()
        df["rel_type"] = df["rel_type"].fillna("related_to").str.strip()
        if "since" in df.columns:
            df["since"] = df["since"].replace({np.nan: None})
            df["since"] = df["since"].astype(str).str.strip().replace({"nan": None, "": None})

        self._edges_df = df
        logger.info("Loaded %d edges from %s", len(df), self.edges_path)

    def _load_anomaly_key(self) -> None:
        if self.anomaly_key_path.exists():
            self._anomaly_key_df = pd.read_csv(self.anomaly_key_path)
            logger.info("Loaded %d rows from anomaly key", len(self._anomaly_key_df))
        else:
            logger.warning("Anomaly key CSV not found at %s", self.anomaly_key_path)
            self._anomaly_key_df = pd.DataFrame()

    def _compute_data_quality(self) -> None:
        tenders = self.get_tenders()
        nodes = self.get_nodes()
        edges = self.get_edges()

        t_nulls = {k: int(v) for k, v in tenders.isna().sum().to_dict().items()}
        n_nulls = {k: int(v) for k, v in nodes.isna().sum().to_dict().items()}
        e_nulls = {k: int(v) for k, v in edges.isna().sum().to_dict().items()}

        dup_tenders = int(tenders["tender_id"].duplicated().sum())
        dup_nodes = int(nodes["node_id"].duplicated().sum())

        node_id_set = set(nodes["node_id"])
        missing_start = (~edges["start_id"].isin(node_id_set)).sum()
        missing_end = (~edges["end_id"].isin(node_id_set)).sum()
        missing_edge_nodes = int(missing_start + missing_end)

        warnings: list[str] = []
        if dup_tenders > 0:
            warnings.append(f"Found {dup_tenders} duplicate tender IDs in tenders dataset.")
        if dup_nodes > 0:
            warnings.append(f"Found {dup_nodes} duplicate node IDs in ownership nodes dataset.")
        if missing_edge_nodes > 0:
            warnings.append(f"Found {missing_edge_nodes} edge endpoint references missing from nodes dataset.")

        self._quality_report = DataQualityReport(
            tenders_count=len(tenders),
            nodes_count=len(nodes),
            edges_count=len(edges),
            tenders_null_counts=t_nulls,
            nodes_null_counts=n_nulls,
            edges_null_counts=e_nulls,
            duplicate_tender_ids=dup_tenders,
            duplicate_node_ids=dup_nodes,
            missing_edge_nodes=missing_edge_nodes,
            warnings=warnings,
        )

    def get_tenders(self) -> pd.DataFrame:
        if self._tenders_df is None:
            self.load_all()
        assert self._tenders_df is not None
        return self._tenders_df

    def get_nodes(self) -> pd.DataFrame:
        if self._nodes_df is None:
            self.load_all()
        assert self._nodes_df is not None
        return self._nodes_df

    def get_edges(self) -> pd.DataFrame:
        if self._edges_df is None:
            self.load_all()
        assert self._edges_df is not None
        return self._edges_df

    def get_anomaly_key(self) -> pd.DataFrame:
        if self._anomaly_key_df is None:
            self.load_all()
        assert self._anomaly_key_df is not None
        return self._anomaly_key_df

    def get_quality_report(self) -> DataQualityReport:
        if self._quality_report is None:
            self.load_all()
        assert self._quality_report is not None
        return self._quality_report
