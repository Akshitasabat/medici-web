"""FastAPI Application for Medici Web Public Procurement Intelligence."""
from contextlib import asynccontextmanager
import logging
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from backend.config import DISCLAIMER_TEXT
from backend.models.schemas import (
    ConnectedComponentInfo,
    DataQualityReport,
    EntityNode,
    GraphNeighborhood,
    GraphPathResponse,
    InvestigationDetail,
    RuleDefinition,
    SavedInvestigation,
    SavedInvestigationCreate,
    SummaryMetrics,
    TenderDetail,
    TenderPaginationResponse,
)
from backend.services.data_loader import DataLoader
from backend.services.entity_matching import EntityMatcher
from backend.services.flagging_engine import FlaggingEngine
from backend.services.graph_engine import GraphEngine
from backend.services.persistence import InvestigationStore
from backend.services.tender_analysis import TenderService

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("medici_web")

# Service Singletons
loader = DataLoader()
flagging_engine = FlaggingEngine()
graph_engine = GraphEngine()
matcher = EntityMatcher()
store = InvestigationStore()
tender_service = TenderService(
    loader=loader,
    flagging_engine=flagging_engine,
    graph_engine=graph_engine,
    matcher=matcher,
    store=store,
)


# Initialize singletons at import time so TestClient and CLI runs are populated immediately
tender_service.initialize()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup initialization of procurement datasets, graph, and rule cache."""
    if not tender_service._flags_cache:
        logger.info("Initializing Medici Web backend services...")
        tender_service.initialize()
        logger.info("Medici Web backend ready.")
    yield


app = FastAPI(
    title="Medici Web API",
    description="Public procurement intelligence and ownership network investigation platform",
    version="1.0.0",
    lifespan=lifespan,
)

# Enable CORS for local Vite development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
@app.get("/api/rse/health")
@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "medici_web_api",
        "disclaimer": DISCLAIMER_TEXT,
    }


@app.get("/api/summary", response_model=SummaryMetrics)
def get_summary():
    """Get high-level computed metrics on tenders, flags, and ownership graph."""
    return tender_service.get_summary()


@app.get("/api/data-quality", response_model=DataQualityReport)
def get_data_quality():
    """Get dataset schema validation and null audit metrics."""
    return loader.get_quality_report()


@app.get("/api/rules", response_model=list[RuleDefinition])
def get_rules():
    """List explainable procurement screening rules and active thresholds."""
    return flagging_engine.get_rules_metadata()


@app.get("/api/tenders", response_model=TenderPaginationResponse)
def list_tenders(
    search: str = Query("", description="Search term for ID, title, buyer, or winner"),
    category: Optional[str] = Query(None, description="Filter by tender category"),
    buyer_id: Optional[str] = Query(None, description="Filter by buyer ID"),
    procedure: Optional[str] = Query(None, description="Filter by procurement procedure"),
    flagged_only: bool = Query(False, description="Filter only tenders triggering >= 1 rule"),
    sort_by: str = Query("tender_id", description="Sort field: tender_id, value, flags, date, n_bidders"),
    sort_order: str = Query("asc", description="Sort direction: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
):
    """Browse tenders with filtering, searching, sorting, and pagination."""
    return tender_service.get_tenders_paginated(
        search=search,
        category=category,
        buyer_id=buyer_id,
        procedure=procedure,
        flagged_only=flagged_only,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )


@app.get("/api/tenders/{tender_id}", response_model=TenderDetail)
def get_tender(tender_id: str):
    """Fetch complete tender record, bidders, computed dates, and triggered flags."""
    detail = tender_service.get_tender_detail(tender_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tender '{tender_id}' not found.")
    return detail


@app.get("/api/tenders/{tender_id}/flags")
def get_tender_flags(tender_id: str):
    """Fetch red flags and exact underlying evidence for a tender."""
    detail = tender_service.get_tender_detail(tender_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tender '{tender_id}' not found.")
    return {
        "tender_id": detail.tender_id,
        "flag_count": len(detail.flags),
        "flags": detail.flags,
        "disclaimer": DISCLAIMER_TEXT,
    }


@app.get("/api/entities")
def list_entities(
    search: str = Query("", description="Search by name or node ID"),
    kind: Optional[str] = Query(None, description="Filter by entity kind (company, officer, address, buyer, etc.)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """Search and browse entities from the ownership graph."""
    offset = (page - 1) * page_size
    items, total = graph_engine.search_nodes(query=search, kind=kind, limit=page_size, offset=offset)
    total_pages = max(1, (total + page_size - 1) // page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@app.get("/api/entities/{entity_id}", response_model=EntityNode)
def get_entity(entity_id: str):
    """Fetch details of a single entity node."""
    node = graph_engine.get_node(entity_id)
    if not node:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Entity '{entity_id}' not found.")
    return node


@app.get("/api/entities/{entity_id}/connections")
def get_entity_connections(entity_id: str):
    """Fetch direct edges connected to an entity."""
    neighborhood = graph_engine.get_neighborhood(entity_id, hops=1, max_nodes=50)
    if not neighborhood:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Entity '{entity_id}' not found.")
    return {
        "entity_id": entity_id,
        "connections_count": len(neighborhood.edges),
        "edges": neighborhood.edges,
        "connected_nodes": neighborhood.nodes,
    }


@app.get("/api/entities/{entity_id}/neighborhood", response_model=GraphNeighborhood)
def get_entity_neighborhood(
    entity_id: str,
    hops: int = Query(1, ge=1, le=3, description="Number of hops to traverse"),
    max_nodes: int = Query(35, ge=5, le=100, description="Max nodes to return"),
):
    """Extract bounded subgraph ego-network around an entity for interactive graph exploration."""
    neighborhood = graph_engine.get_neighborhood(entity_id, hops=hops, max_nodes=max_nodes)
    if not neighborhood:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Entity '{entity_id}' not found.")
    return neighborhood


@app.get("/api/graph/path", response_model=GraphPathResponse)
def get_shortest_path(
    source_id: str = Query(..., description="Start entity ID"),
    target_id: str = Query(..., description="Target entity ID"),
):
    """Calculate the shortest recorded relationship path between two entities using NetworkX."""
    return graph_engine.find_shortest_path(source_id=source_id, target_id=target_id)


@app.get("/api/graph/components", response_model=list[ConnectedComponentInfo])
def get_components(
    min_size: int = Query(2, ge=2, description="Minimum component size"),
    limit: int = Query(15, ge=1, le=50, description="Max components to return"),
):
    """Analyze connected components in the ownership graph."""
    return graph_engine.get_connected_components(min_size=min_size, limit=limit)


@app.get("/api/graph/stats")
def get_graph_stats():
    """Structural statistics of the entire ownership network."""
    return graph_engine.get_graph_stats()


@app.get("/api/investigations/{tender_id}", response_model=InvestigationDetail)
def get_investigation_workspace(tender_id: str):
    """Unified investigation workspace combining tender record, evidence, winner matching, and graph neighborhood."""
    bundle = tender_service.get_investigation_bundle(tender_id)
    if not bundle:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tender '{tender_id}' not found.")
    return bundle


@app.get("/api/saved-investigations", response_model=list[SavedInvestigation])
def list_saved_investigations(status: Optional[str] = Query(None)):
    """List persistent investigations and analyst notes."""
    return store.list_investigations(status=status)


@app.post("/api/saved-investigations", response_model=SavedInvestigation)
def save_investigation(record: SavedInvestigationCreate):
    """Save or update analyst investigation notes and triage status in SQLite."""
    # Ensure tender exists
    detail = tender_service.get_tender_detail(record.tender_id)
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Tender '{record.tender_id}' not found.")
    return store.save_investigation(record)


@app.put("/api/saved-investigations/{tender_id}", response_model=SavedInvestigation)
def update_saved_investigation(tender_id: str, record: SavedInvestigationCreate):
    """Update analyst notes for a tender."""
    if tender_id != record.tender_id:
        record.tender_id = tender_id
    return store.save_investigation(record)


@app.delete("/api/saved-investigations/{tender_id}")
def delete_saved_investigation(tender_id: str):
    """Delete an analyst investigation record."""
    deleted = store.delete_investigation(tender_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation record not found.")
    return {"status": "deleted", "tender_id": tender_id}
