"""Pydantic schemas for request and response validation."""
from typing import Any, Optional
from pydantic import BaseModel, Field


class FlagResult(BaseModel):
    rule_id: str
    rule_name: str
    triggered: bool
    explanation: str
    evidence: dict[str, Any]
    threshold: Optional[Any] = None
    calculated_value: Optional[Any] = None
    severity: str = "screening_lead"  # screening_lead, review_advisory


class TenderListItem(BaseModel):
    tender_id: str
    buyer_id: str
    buyer: str
    category: str
    title: str
    procedure: str
    publish_date: Optional[str] = None
    deadline: Optional[str] = None
    award_date: Optional[str] = None
    n_bidders: Optional[int] = None
    winner_company_id: Optional[str] = None
    winner_name: Optional[str] = None
    value: Optional[float] = None
    currency: str = "CU"
    flag_count: int = 0
    triggered_rules: list[str] = Field(default_factory=list)


class TenderDetail(TenderListItem):
    bidder_ids: list[str] = Field(default_factory=list)
    bidder_names: list[str] = Field(default_factory=list)
    second_bid_value: Optional[float] = None
    winner_reg_date: Optional[str] = None
    flags: list[FlagResult] = Field(default_factory=list)
    bidding_window_days: Optional[int] = None
    award_window_days: Optional[int] = None
    winner_age_at_award_days: Optional[int] = None


class TenderPaginationResponse(BaseModel):
    items: list[TenderListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    flagged_only: bool = False


class EntityNode(BaseModel):
    node_id: str
    name: str
    kind: str
    jurisdiction: Optional[str] = None
    reg_date: Optional[str] = None
    flagged_status: Optional[str] = None
    source: Optional[str] = None
    degree: Optional[int] = 0


class EntityEdge(BaseModel):
    edge_id: str
    start_id: str
    end_id: str
    rel_type: str
    since: Optional[str] = None


class GraphNeighborhood(BaseModel):
    center_node: EntityNode
    nodes: list[EntityNode]
    edges: list[EntityEdge]
    total_nodes: int
    total_edges: int


class GraphPathResponse(BaseModel):
    source_id: str
    target_id: str
    path_found: bool
    node_path: list[str] = Field(default_factory=list)
    nodes: list[EntityNode] = Field(default_factory=list)
    edges: list[EntityEdge] = Field(default_factory=list)
    hops: int = 0
    message: Optional[str] = None


class ConnectedComponentInfo(BaseModel):
    component_id: int
    node_count: int
    edge_count: int
    sample_nodes: list[str] = Field(default_factory=list)
    kinds: dict[str, int] = Field(default_factory=dict)


class WinnerMatchCandidate(BaseModel):
    tender_winner_id: str
    tender_winner_name: str
    candidate_node_id: Optional[str] = None
    candidate_node_name: Optional[str] = None
    candidate_node_kind: Optional[str] = None
    match_method: str  # 'exact_id', 'exact_name', 'fuzzy_name', 'none'
    match_status: str  # 'verified_id_match', 'exact_name_candidate', 'fuzzy_candidate', 'unmatched'
    confidence_score: float = 0.0
    notes: str = ""
    is_verified: bool = False


class SavedInvestigationCreate(BaseModel):
    tender_id: str
    status: str = "open"  # open, under_review, completed
    priority: str = "medium"  # low, medium, high
    analyst_notes: str = ""
    tags: Optional[str] = ""


class SavedInvestigation(SavedInvestigationCreate):
    id: int
    created_at: str
    updated_at: str


class InvestigationDetail(BaseModel):
    tender: TenderDetail
    flags: list[FlagResult]
    winner_match: Optional[WinnerMatchCandidate] = None
    entity_neighborhood: Optional[GraphNeighborhood] = None
    saved_record: Optional[SavedInvestigation] = None
    disclaimer: str


class RuleDefinition(BaseModel):
    rule_id: str
    name: str
    description: str
    threshold: Any
    category: str
    is_screening_heuristic: bool = True


class SummaryMetrics(BaseModel):
    total_tenders: int
    unique_buyers: int
    unique_winners: int
    flagged_tenders_count: int
    flagged_tenders_percentage: float
    total_flags_triggered: int
    rule_breakdown: dict[str, int]
    entities_indexed: int
    relationships_indexed: int
    connected_components_count: int
    api_status: str = "healthy"
    data_source: str = "local_database_csv"
    disclaimer: str


class DataQualityReport(BaseModel):
    tenders_count: int
    nodes_count: int
    edges_count: int
    tenders_null_counts: dict[str, int]
    nodes_null_counts: dict[str, int]
    edges_null_counts: dict[str, int]
    duplicate_tender_ids: int
    duplicate_node_ids: int
    missing_edge_nodes: int
    warnings: list[str] = Field(default_factory=list)
