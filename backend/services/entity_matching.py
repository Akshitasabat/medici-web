"""Entity Matching Service for linking tender winners to ownership graph nodes."""
import difflib
import re
from typing import Any, Optional
import pandas as pd

from backend.models.schemas import WinnerMatchCandidate


class EntityMatcher:
    def __init__(self) -> None:
        self._nodes_by_id: dict[str, dict[str, Any]] = {}
        self._nodes_by_norm_name: dict[str, list[dict[str, Any]]] = {}
        self._all_company_nodes: list[dict[str, Any]] = []

    def fit_nodes(self, nodes_df: pd.DataFrame) -> None:
        """Index entity nodes by ID and normalized name."""
        self._nodes_by_id.clear()
        self._nodes_by_norm_name.clear()
        self._all_company_nodes.clear()

        for _, row in nodes_df.iterrows():
            nid = str(row["node_id"]).strip()
            name = str(row["name"]).strip() if pd.notna(row["name"]) else nid
            kind = str(row["kind"]).strip() if pd.notna(row["kind"]) else "unknown"

            entry = {
                "node_id": nid,
                "name": name,
                "kind": kind,
                "jurisdiction": str(row.get("jurisdiction")) if pd.notna(row.get("jurisdiction")) else None,
                "reg_date": str(row.get("reg_date")) if pd.notna(row.get("reg_date")) else None,
            }

            self._nodes_by_id[nid] = entry
            norm = self.normalize_name(name)
            if norm:
                self._nodes_by_norm_name.setdefault(norm, []).append(entry)

            if kind in ("company", "offshore_entity"):
                self._all_company_nodes.append(entry)

    @staticmethod
    def normalize_name(name: str) -> str:
        """Conservative normalization for entity name matching."""
        if not name or not isinstance(name, str):
            return ""
        s = name.lower().strip()
        # Remove punctuation
        s = re.sub(r"[^\w\s]", " ", s)
        # Remove common corporate suffixes
        s = re.sub(r"\b(ltd|limited|llc|inc|corp|corporation|co|plc)\b", "", s)
        # Collapse whitespace
        s = re.sub(r"\s+", " ", s).strip()
        return s

    def match_winner(
        self,
        winner_id: Optional[str],
        winner_name: Optional[str],
        fuzzy_threshold: float = 0.85,
    ) -> WinnerMatchCandidate:
        """Match a tender winner to the ownership nodes according to strict priority."""
        wid = str(winner_id or "").strip()
        wname = str(winner_name or "").strip()

        # Priority 1: Exact Entity ID Match
        if wid and wid in self._nodes_by_id:
            node = self._nodes_by_id[wid]
            return WinnerMatchCandidate(
                tender_winner_id=wid,
                tender_winner_name=wname,
                candidate_node_id=node["node_id"],
                candidate_node_name=node["name"],
                candidate_node_kind=node["kind"],
                match_method="exact_id",
                match_status="verified_id_match",
                confidence_score=1.0,
                is_verified=True,
                notes="Verified direct identifier match between tender record and ownership registry.",
            )

        # Priority 2: Exact Normalized Name Match
        norm_wname = self.normalize_name(wname)
        if norm_wname and norm_wname in self._nodes_by_norm_name:
            candidates = self._nodes_by_norm_name[norm_wname]
            node = candidates[0]
            count_note = f" (1 of {len(candidates)} entities sharing this normalized name)" if len(candidates) > 1 else ""
            return WinnerMatchCandidate(
                tender_winner_id=wid,
                tender_winner_name=wname,
                candidate_node_id=node["node_id"],
                candidate_node_name=node["name"],
                candidate_node_kind=node["kind"],
                match_method="exact_name",
                match_status="exact_name_candidate",
                confidence_score=0.90,
                is_verified=False,
                notes=(
                    f"Exact normalized name candidate{count_note}. "
                    f"ID was not verified; manual confirmation required."
                ),
            )

        # Priority 3: Fuzzy Name Candidate Discovery
        if norm_wname and self._all_company_nodes:
            best_node: Optional[dict[str, Any]] = None
            best_score = 0.0

            for node in self._all_company_nodes:
                c_norm = self.normalize_name(node["name"])
                if not c_norm:
                    continue
                ratio = difflib.SequenceMatcher(None, norm_wname, c_norm).ratio()
                if ratio > best_score:
                    best_score = ratio
                    best_node = node

            if best_node and best_score >= fuzzy_threshold:
                return WinnerMatchCandidate(
                    tender_winner_id=wid,
                    tender_winner_name=wname,
                    candidate_node_id=best_node["node_id"],
                    candidate_node_name=best_node["name"],
                    candidate_node_kind=best_node["kind"],
                    match_method="fuzzy_name",
                    match_status="fuzzy_candidate",
                    confidence_score=round(best_score, 2),
                    is_verified=False,
                    notes=(
                        f"Fuzzy name candidate ({best_score:.0%} similarity). "
                        f"Manual verification required before treating as the same entity."
                    ),
                )

        # Unmatched
        return WinnerMatchCandidate(
            tender_winner_id=wid,
            tender_winner_name=wname,
            candidate_node_id=None,
            candidate_node_name=None,
            candidate_node_kind=None,
            match_method="none",
            match_status="unmatched",
            confidence_score=0.0,
            is_verified=False,
            notes="No matching entity found in the ownership database.",
        )
