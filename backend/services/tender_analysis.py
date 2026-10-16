"""Tender Analysis and Investigation Service integrating flagging, matching, and graph intelligence."""
from datetime import datetime
from typing import Any, Optional
import pandas as pd
import numpy as np

from backend.config import DISCLAIMER_TEXT
from backend.models.schemas import (
    FlagResult,
    InvestigationDetail,
    SummaryMetrics,
    TenderDetail,
    TenderListItem,
    TenderPaginationResponse,
)
from backend.services.data_loader import DataLoader
from backend.services.entity_matching import EntityMatcher
from backend.services.flagging_engine import FlaggingEngine
from backend.services.graph_engine import GraphEngine
from backend.services.persistence import InvestigationStore


class TenderService:
    def __init__(
        self,
        loader: DataLoader,
        flagging_engine: FlaggingEngine,
        graph_engine: GraphEngine,
        matcher: EntityMatcher,
        store: InvestigationStore,
    ) -> None:
        self.loader = loader
        self.flagging_engine = flagging_engine
        self.graph_engine = graph_engine
        self.matcher = matcher
        self.store = store

        self._flags_cache: dict[str, list[FlagResult]] = {}
        self._summary_cache: Optional[SummaryMetrics] = None

    def initialize(self) -> None:
        """Load data, fit models, and populate graph."""
        self.loader.load_all()
        tenders_df = self.loader.get_tenders()
        nodes_df = self.loader.get_nodes()
        edges_df = self.loader.get_edges()

        self.flagging_engine.fit_dataset(tenders_df)
        self.graph_engine.build_graph(nodes_df, edges_df)
        self.matcher.fit_nodes(nodes_df)

        # Precompute flags for fast search & filtering
        self._flags_cache.clear()
        for _, row in tenders_df.iterrows():
            tid = str(row["tender_id"])
            flags = self.flagging_engine.evaluate_tender(row.to_dict())
            self._flags_cache[tid] = flags

        self._compute_summary()

    def _compute_summary(self) -> None:
        tenders = self.loader.get_tenders()
        nodes = self.loader.get_nodes()
        edges = self.loader.get_edges()

        total_tenders = len(tenders)
        unique_buyers = int(tenders["buyer_id"].nunique())
        unique_winners = int(tenders["winner_company_id"].nunique())

        flagged_count = sum(1 for flags in self._flags_cache.values() if flags)
        total_flags = sum(len(flags) for flags in self._flags_cache.values())

        rule_breakdown: dict[str, int] = {}
        for flags in self._flags_cache.values():
            for f in flags:
                rule_breakdown[f.rule_name] = rule_breakdown.get(f.rule_name, 0) + 1

        pct_flagged = round((flagged_count / total_tenders) * 100, 1) if total_tenders else 0.0

        graph_stats = self.graph_engine.get_graph_stats()

        self._summary_cache = SummaryMetrics(
            total_tenders=total_tenders,
            unique_buyers=unique_buyers,
            unique_winners=unique_winners,
            flagged_tenders_count=flagged_count,
            flagged_tenders_percentage=pct_flagged,
            total_flags_triggered=total_flags,
            rule_breakdown=rule_breakdown,
            entities_indexed=len(nodes),
            relationships_indexed=len(edges),
            connected_components_count=graph_stats.get("connected_components_count", 0),
            api_status="healthy",
            data_source="verified_local_csv",
            disclaimer=DISCLAIMER_TEXT,
        )

    def get_summary(self) -> SummaryMetrics:
        if self._summary_cache is None:
            self._compute_summary()
        assert self._summary_cache is not None
        return self._summary_cache

    def get_tenders_paginated(
        self,
        search: str = "",
        category: Optional[str] = None,
        buyer_id: Optional[str] = None,
        procedure: Optional[str] = None,
        flagged_only: bool = False,
        sort_by: str = "tender_id",
        sort_order: str = "asc",
        page: int = 1,
        page_size: int = 25,
    ) -> TenderPaginationResponse:
        tenders = self.loader.get_tenders()

        # Filtering mask
        mask = pd.Series(True, index=tenders.index)

        if search:
            q = search.strip().lower()
            s_mask = (
                tenders["tender_id"].str.lower().str.contains(q, na=False)
                | tenders["title"].str.lower().str.contains(q, na=False)
                | tenders["buyer"].str.lower().str.contains(q, na=False)
                | tenders["winner_name"].str.lower().str.contains(q, na=False)
                | tenders["winner_company_id"].str.lower().str.contains(q, na=False)
            )
            mask &= s_mask

        if category and category.lower() != "all":
            mask &= tenders["category"].str.lower() == category.strip().lower()

        if buyer_id and buyer_id.lower() != "all":
            mask &= tenders["buyer_id"].str.strip() == buyer_id.strip()

        if procedure and procedure.lower() != "all":
            mask &= tenders["procedure"].str.lower() == procedure.strip().lower()

        if flagged_only:
            flagged_ids = {tid for tid, flags in self._flags_cache.items() if flags}
            mask &= tenders["tender_id"].isin(flagged_ids)

        filtered = tenders[mask].copy()

        # Attach flag count for sorting if needed
        filtered["flag_count"] = filtered["tender_id"].map(lambda tid: len(self._flags_cache.get(tid, [])))

        # Sorting
        ascending = sort_order.lower() == "asc"
        if sort_by == "value":
            filtered = filtered.sort_values(by="value", ascending=ascending, na_position="last")
        elif sort_by == "flags":
            filtered = filtered.sort_values(by="flag_count", ascending=ascending)
        elif sort_by == "date":
            filtered = filtered.sort_values(by="award_date", ascending=ascending, na_position="last")
        elif sort_by == "n_bidders":
            filtered = filtered.sort_values(by="n_bidders", ascending=ascending)
        else:
            filtered = filtered.sort_values(by="tender_id", ascending=ascending)

        total = len(filtered)
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        total_pages = max(1, (total + page_size - 1) // page_size)
        offset = (page - 1) * page_size
        slice_df = filtered.iloc[offset : offset + page_size]

        items: list[TenderListItem] = []
        for _, row in slice_df.iterrows():
            tid = str(row["tender_id"])
            flags = self._flags_cache.get(tid, [])
            items.append(
                TenderListItem(
                    tender_id=tid,
                    buyer_id=str(row["buyer_id"]),
                    buyer=str(row["buyer"]),
                    category=str(row["category"]),
                    title=str(row["title"]),
                    procedure=str(row["procedure"]),
                    publish_date=row.get("publish_date"),
                    deadline=row.get("deadline"),
                    award_date=row.get("award_date"),
                    n_bidders=int(row["n_bidders"]) if pd.notna(row.get("n_bidders")) else None,
                    winner_company_id=row.get("winner_company_id"),
                    winner_name=row.get("winner_name"),
                    value=float(row["value"]) if pd.notna(row.get("value")) else None,
                    currency=str(row.get("currency", "CU")),
                    flag_count=len(flags),
                    triggered_rules=[f.rule_name for f in flags],
                )
            )

        return TenderPaginationResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            flagged_only=flagged_only,
        )

    def get_tender_detail(self, tender_id: str) -> Optional[TenderDetail]:
        tenders = self.loader.get_tenders()
        match = tenders[tenders["tender_id"] == tender_id.strip()]
        if match.empty:
            return None

        row = match.iloc[0].to_dict()
        tid = str(row["tender_id"])
        flags = self._flags_cache.get(tid, self.flagging_engine.evaluate_tender(row))

        # Parse bidder ids and names
        bids_str = str(row.get("bidder_ids") or "")
        bidder_ids = [b.strip() for b in bids_str.split(";") if b.strip()] if bids_str and bids_str != "nan" else []

        names_str = str(row.get("bidder_names") or "")
        bidder_names = [n.strip() for n in names_str.split(";") if n.strip()] if names_str and names_str != "nan" else []

        # Durations
        bidding_days: Optional[int] = None
        award_days: Optional[int] = None
        age_at_award: Optional[int] = None

        try:
            if row.get("publish_date") and row.get("deadline"):
                d1 = datetime.strptime(str(row["publish_date"])[:10], "%Y-%m-%d")
                d2 = datetime.strptime(str(row["deadline"])[:10], "%Y-%m-%d")
                bidding_days = (d2 - d1).days
            if row.get("deadline") and row.get("award_date"):
                d2 = datetime.strptime(str(row["deadline"])[:10], "%Y-%m-%d")
                d3 = datetime.strptime(str(row["award_date"])[:10], "%Y-%m-%d")
                award_days = (d3 - d2).days
            if row.get("winner_reg_date") and row.get("award_date"):
                d0 = datetime.strptime(str(row["winner_reg_date"])[:10], "%Y-%m-%d")
                d3 = datetime.strptime(str(row["award_date"])[:10], "%Y-%m-%d")
                age_at_award = (d3 - d0).days
        except Exception:
            pass

        return TenderDetail(
            tender_id=tid,
            buyer_id=str(row["buyer_id"]),
            buyer=str(row["buyer"]),
            category=str(row["category"]),
            title=str(row["title"]),
            procedure=str(row["procedure"]),
            publish_date=row.get("publish_date"),
            deadline=row.get("deadline"),
            award_date=row.get("award_date"),
            n_bidders=int(row["n_bidders"]) if pd.notna(row.get("n_bidders")) else None,
            winner_company_id=row.get("winner_company_id"),
            winner_name=row.get("winner_name"),
            value=float(row["value"]) if pd.notna(row.get("value")) else None,
            currency=str(row.get("currency", "CU")),
            flag_count=len(flags),
            triggered_rules=[f.rule_name for f in flags],
            bidder_ids=bidder_ids,
            bidder_names=bidder_names,
            second_bid_value=float(row["second_bid_value"]) if pd.notna(row.get("second_bid_value")) else None,
            winner_reg_date=row.get("winner_reg_date"),
            flags=flags,
            bidding_window_days=bidding_days,
            award_window_days=award_days,
            winner_age_at_award_days=age_at_award,
        )

    def get_investigation_bundle(self, tender_id: str) -> Optional[InvestigationDetail]:
        tender = self.get_tender_detail(tender_id)
        if not tender:
            return None

        # Winner matching
        winner_match = self.matcher.match_winner(tender.winner_company_id, tender.winner_name)

        # Graph neighborhood for matched entity
        neighborhood = None
        target_node_id = winner_match.candidate_node_id or tender.winner_company_id
        if target_node_id:
            neighborhood = self.graph_engine.get_neighborhood(target_node_id, hops=2, max_nodes=35)

        saved_record = self.store.get_investigation(tender_id)

        return InvestigationDetail(
            tender=tender,
            flags=tender.flags,
            winner_match=winner_match,
            entity_neighborhood=neighborhood,
            saved_record=saved_record,
            disclaimer=DISCLAIMER_TEXT,
        )
