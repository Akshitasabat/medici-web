"""Flagging Engine for explainable public procurement screening rules."""
from datetime import datetime
from typing import Any, Optional
import pandas as pd
import numpy as np

from backend.config import (
    SINGLE_BIDDER_THRESHOLD,
    SHORT_WINDOW_DAYS_THRESHOLD,
    NEW_COMPANY_DAYS_THRESHOLD,
    REPEAT_WINNER_MIN_TENDERS,
    REPEAT_WINNER_SHARE_THRESHOLD,
    CLOSE_BID_SPREAD_THRESHOLD,
    THRESHOLD_HUGGING_LOWER,
    THRESHOLD_HUGGING_UPPER,
)
from backend.models.schemas import FlagResult, RuleDefinition


class FlaggingEngine:
    def __init__(
        self,
        repeat_winner_share_threshold: float = REPEAT_WINNER_SHARE_THRESHOLD,
        repeat_winner_min_tenders: int = REPEAT_WINNER_MIN_TENDERS,
        short_window_days_threshold: int = SHORT_WINDOW_DAYS_THRESHOLD,
        new_company_days_threshold: int = NEW_COMPANY_DAYS_THRESHOLD,
        close_bid_spread_threshold: float = CLOSE_BID_SPREAD_THRESHOLD,
        threshold_hugging_lower: float = THRESHOLD_HUGGING_LOWER,
        threshold_hugging_upper: float = THRESHOLD_HUGGING_UPPER,
    ):
        self.repeat_winner_share_threshold = repeat_winner_share_threshold
        self.repeat_winner_min_tenders = repeat_winner_min_tenders
        self.short_window_days_threshold = short_window_days_threshold
        self.new_company_days_threshold = new_company_days_threshold
        self.close_bid_spread_threshold = close_bid_spread_threshold
        self.threshold_hugging_lower = threshold_hugging_lower
        self.threshold_hugging_upper = threshold_hugging_upper

        # Precalculated buyer concentration statistics
        self._buyer_totals: dict[str, int] = {}
        self._buyer_winner_counts: dict[tuple[str, str], int] = {}

    def fit_dataset(self, tenders_df: pd.DataFrame) -> None:
        """Calculate dataset-level aggregates needed for relative rules (e.g., repeat winners)."""
        valid_tenders = tenders_df[tenders_df["buyer_id"].notna() & tenders_df["winner_company_id"].notna()]
        self._buyer_totals = valid_tenders.groupby("buyer_id").size().to_dict()
        self._buyer_winner_counts = valid_tenders.groupby(["buyer_id", "winner_company_id"]).size().to_dict()

    @staticmethod
    def _parse_date(val: Any) -> Optional[datetime]:
        if pd.isna(val) or val is None or str(val).strip().lower() in ("", "nan", "none"):
            return None
        try:
            return datetime.strptime(str(val).strip()[:10], "%Y-%m-%d")
        except (ValueError, TypeError):
            return None

    def evaluate_tender(self, row: dict[str, Any]) -> list[FlagResult]:
        """Evaluate a single tender record against all explainable procurement rules."""
        flags: list[FlagResult] = []

        # 1. Single Bidder Rule
        n_bidders = row.get("n_bidders")
        try:
            n_bidders_val = int(n_bidders) if n_bidders is not None and not pd.isna(n_bidders) else 0
        except (ValueError, TypeError):
            n_bidders_val = 0

        if n_bidders_val == SINGLE_BIDDER_THRESHOLD:
            flags.append(
                FlagResult(
                    rule_id="RULE_SINGLE_BIDDER",
                    rule_name="Single Bidder Contract",
                    triggered=True,
                    explanation=(
                        f"Only 1 bidder participated in this tender. Limited competition merits review "
                        f"to confirm genuine market openness, but does not prove misconduct."
                    ),
                    evidence={"n_bidders": 1, "winner_name": row.get("winner_name")},
                    threshold=SINGLE_BIDDER_THRESHOLD,
                    calculated_value=1,
                    severity="screening_lead",
                )
            )

        # 2. Repeat Winner Concentration Rule
        buyer_id = str(row.get("buyer_id") or "").strip()
        winner_id = str(row.get("winner_company_id") or "").strip()
        if buyer_id and winner_id:
            total_buyer_tenders = self._buyer_totals.get(buyer_id, 0)
            winner_wins = self._buyer_winner_counts.get((buyer_id, winner_id), 0)
            if total_buyer_tenders >= self.repeat_winner_min_tenders:
                win_share = winner_wins / total_buyer_tenders
                if win_share >= self.repeat_winner_share_threshold:
                    flags.append(
                        FlagResult(
                            rule_id="RULE_REPEAT_WINNER",
                            rule_name="High Buyer-Winner Concentration",
                            triggered=True,
                            explanation=(
                                f"Winner {row.get('winner_name') or winner_id} won {winner_wins} out of "
                                f"{total_buyer_tenders} eligible contracts ({win_share:.1%}) from buyer "
                                f"{row.get('buyer') or buyer_id} (screening threshold: >={self.repeat_winner_share_threshold:.0%})."
                            ),
                            evidence={
                                "buyer_id": buyer_id,
                                "buyer_name": row.get("buyer"),
                                "winner_id": winner_id,
                                "winner_name": row.get("winner_name"),
                                "total_buyer_tenders": total_buyer_tenders,
                                "winner_wins": winner_wins,
                                "win_share_pct": round(win_share * 100, 1),
                            },
                            threshold=self.repeat_winner_share_threshold,
                            calculated_value=round(win_share, 4),
                            severity="screening_lead",
                        )
                    )

        # 3. Short Bidding Window Rule
        pub_date = self._parse_date(row.get("publish_date"))
        deadline_date = self._parse_date(row.get("deadline"))
        if pub_date and deadline_date:
            bidding_window = (deadline_date - pub_date).days
            if 0 <= bidding_window <= self.short_window_days_threshold:
                flags.append(
                    FlagResult(
                        rule_id="RULE_SHORT_WINDOW",
                        rule_name="Compressed Bidding Window",
                        triggered=True,
                        explanation=(
                            f"Submission deadline was {bidding_window} days after publication "
                            f"(screening threshold: <={self.short_window_days_threshold} days). "
                            f"Compressed windows may disadvantage external competitors."
                        ),
                        evidence={
                            "publish_date": str(row.get("publish_date")),
                            "deadline": str(row.get("deadline")),
                            "bidding_window_days": bidding_window,
                        },
                        threshold=self.short_window_days_threshold,
                        calculated_value=bidding_window,
                        severity="screening_lead",
                    )
                )

        # 4. Newly Registered Company Rule
        reg_date = self._parse_date(row.get("winner_reg_date"))
        award_date = self._parse_date(row.get("award_date"))
        if reg_date and award_date:
            age_days = (award_date - reg_date).days
            if 0 <= age_days <= self.new_company_days_threshold:
                flags.append(
                    FlagResult(
                        rule_id="RULE_NEW_COMPANY",
                        rule_name="Newly Incorporated Winner",
                        triggered=True,
                        explanation=(
                            f"Winning supplier was incorporated {age_days} days prior to contract award "
                            f"(screening threshold: <={self.new_company_days_threshold} days). "
                            f"May indicate a special purpose shell entity."
                        ),
                        evidence={
                            "winner_reg_date": str(row.get("winner_reg_date")),
                            "award_date": str(row.get("award_date")),
                            "company_age_days": age_days,
                        },
                        threshold=self.new_company_days_threshold,
                        calculated_value=age_days,
                        severity="screening_lead",
                    )
                )

        # 5. Close Bid Spread / Cover Bidding Rule
        val = row.get("value")
        second_val = row.get("second_bid_value")
        try:
            v1 = float(val) if val is not None and not pd.isna(val) else None
            v2 = float(second_val) if second_val is not None and not pd.isna(second_val) else None
        except (ValueError, TypeError):
            v1, v2 = None, None

        if v1 is not None and v2 is not None and v1 > 0 and v2 >= v1:
            spread = (v2 - v1) / v1
            if 0 <= spread <= self.close_bid_spread_threshold:
                flags.append(
                    FlagResult(
                        rule_id="RULE_CLOSE_BIDS",
                        rule_name="Narrow Cover Bid Margin",
                        triggered=True,
                        explanation=(
                            f"Second bid ({v2:,.2f}) was within {spread:.2%} of the winning bid ({v1:,.2f}) "
                            f"(screening threshold: <={self.close_bid_spread_threshold:.1%}). "
                            f"Unusually narrow spreads warrant review for cover bidding patterns."
                        ),
                        evidence={
                            "winning_value": v1,
                            "second_bid_value": v2,
                            "bid_spread_pct": round(spread * 100, 2),
                        },
                        threshold=self.close_bid_spread_threshold,
                        calculated_value=round(spread, 4),
                        severity="screening_lead",
                    )
                )

        # 6. Threshold Hugging Rule
        if v1 is not None:
            if self.threshold_hugging_lower <= v1 < self.threshold_hugging_upper:
                ratio = v1 / self.threshold_hugging_upper
                flags.append(
                    FlagResult(
                        rule_id="RULE_THRESHOLD_HUGGING",
                        rule_name="Statutory Threshold Hugging",
                        triggered=True,
                        explanation=(
                            f"Tender value of {v1:,.0f} CU sits at {ratio:.1%} of the 500,000 CU approval limit "
                            f"(screening window: {self.threshold_hugging_lower:,.0f} to {self.threshold_hugging_upper:,.0f} CU). "
                            f"Values clustered immediately below mandatory approval thresholds merit scrutiny."
                        ),
                        evidence={
                            "tender_value": v1,
                            "approval_threshold": self.threshold_hugging_upper,
                            "ratio_pct": round(ratio * 100, 2),
                        },
                        threshold=f"{self.threshold_hugging_lower:,.0f} - {self.threshold_hugging_upper:,.0f} CU",
                        calculated_value=v1,
                        severity="screening_lead",
                    )
                )

        return flags

    def get_rules_metadata(self) -> list[RuleDefinition]:
        """Return human-readable metadata for all implemented screening rules."""
        return [
            RuleDefinition(
                rule_id="RULE_SINGLE_BIDDER",
                name="Single Bidder Contract",
                description="Flags tenders where only one bid was submitted, signaling absence of competition.",
                threshold=1,
                category="Competition",
                is_screening_heuristic=True,
            ),
            RuleDefinition(
                rule_id="RULE_REPEAT_WINNER",
                name="High Buyer-Winner Concentration",
                description="Flags suppliers winning 40% or more of distinct tenders awarded by a specific buyer (min 10 tenders).",
                threshold=f">={int(self.repeat_winner_share_threshold * 100)}% share",
                category="Market Concentration",
                is_screening_heuristic=True,
            ),
            RuleDefinition(
                rule_id="RULE_SHORT_WINDOW",
                name="Compressed Bidding Window",
                description="Flags contracts where the window between publication and deadline was 7 days or fewer.",
                threshold=f"<={self.short_window_days_threshold} days",
                category="Process Integrity",
                is_screening_heuristic=True,
            ),
            RuleDefinition(
                rule_id="RULE_NEW_COMPANY",
                name="Newly Incorporated Winner",
                description="Flags winning entities incorporated within 90 days of contract award.",
                threshold=f"<={self.new_company_days_threshold} days",
                category="Entity Verification",
                is_screening_heuristic=True,
            ),
            RuleDefinition(
                rule_id="RULE_CLOSE_BIDS",
                name="Narrow Cover Bid Margin",
                description="Flags competitions where the runner-up bid was within 3% of the winning bid.",
                threshold=f"<={round(self.close_bid_spread_threshold * 100, 1)}% spread",
                category="Bidding Integrity",
                is_screening_heuristic=True,
            ),
            RuleDefinition(
                rule_id="RULE_THRESHOLD_HUGGING",
                name="Statutory Threshold Hugging",
                description="Flags contracts valued between 475,000 CU and 500,000 CU, just under the 500k CU approval ceiling.",
                threshold=f"{self.threshold_hugging_lower:,.0f} - {self.threshold_hugging_upper:,.0f} CU",
                category="Threshold Evasion",
                is_screening_heuristic=True,
            ),
        ]
