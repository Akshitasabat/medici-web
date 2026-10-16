/**
 * Medici Web TypeScript Definitions
 */

export interface FlagResult {
  rule_id: string
  rule_name: string
  triggered: boolean
  explanation: string
  evidence: Record<string, any>
  threshold?: any
  calculated_value?: any
  severity: 'screening_lead' | 'review_advisory'
}

export interface TenderListItem {
  tender_id: string
  buyer_id: string
  buyer: string
  category: string
  title: string
  procedure: string
  publish_date?: string | null
  deadline?: string | null
  award_date?: string | null
  n_bidders?: number | null
  winner_company_id?: string | null
  winner_name?: string | null
  value?: number | null
  currency: string
  flag_count: number
  triggered_rules: string[]
}

export interface TenderDetail extends TenderListItem {
  bidder_ids: string[]
  bidder_names: string[]
  second_bid_value?: number | null
  winner_reg_date?: string | null
  flags: FlagResult[]
  bidding_window_days?: number | null
  award_window_days?: number | null
  winner_age_at_award_days?: number | null
}

export interface TenderPaginationResponse {
  items: TenderListItem[]
  total: number
  page: number
  page_size: number
  total_pages: number
  flagged_only: boolean
}

export interface EntityNode {
  node_id: string
  name: string
  kind: string
  jurisdiction?: string | null
  reg_date?: string | null
  flagged_status?: string | null
  source?: string | null
  degree?: number
}

export interface EntityEdge {
  edge_id: string
  start_id: string
  end_id: string
  rel_type: string
  since?: string | null
}

export interface GraphNeighborhood {
  center_node: EntityNode
  nodes: EntityNode[]
  edges: EntityEdge[]
  total_nodes: number
  total_edges: number
}

export interface GraphPathResponse {
  source_id: string
  target_id: string
  path_found: boolean
  node_path: string[]
  nodes: EntityNode[]
  edges: EntityEdge[]
  hops: number
  message?: string | null
}

export interface ConnectedComponentInfo {
  component_id: number
  node_count: number
  edge_count: number
  sample_nodes: string[]
  kinds: Record<string, number>
}

export interface WinnerMatchCandidate {
  tender_winner_id: string
  tender_winner_name: string
  candidate_node_id?: string | null
  candidate_node_name?: string | null
  candidate_node_kind?: string | null
  match_method: 'exact_id' | 'exact_name' | 'fuzzy_name' | 'none'
  match_status: 'verified_id_match' | 'exact_name_candidate' | 'fuzzy_candidate' | 'unmatched'
  confidence_score: number
  notes: string
  is_verified: boolean
}

export interface SavedInvestigation {
  id?: number
  tender_id: string
  status: 'open' | 'under_review' | 'completed'
  priority: 'low' | 'medium' | 'high'
  analyst_notes: string
  tags?: string
  created_at: string
  updated_at: string
}

export interface InvestigationDetail {
  tender: TenderDetail
  flags: FlagResult[]
  winner_match?: WinnerMatchCandidate | null
  entity_neighborhood?: GraphNeighborhood | null
  saved_record?: SavedInvestigation | null
  disclaimer: string
}

export interface RuleDefinition {
  rule_id: string
  name: string
  description: string
  threshold: any
  category: string
  is_screening_heuristic: boolean
}

export interface SummaryMetrics {
  total_tenders: number
  unique_buyers: number
  unique_winners: number
  flagged_tenders_count: number
  flagged_tenders_percentage: number
  total_flags_triggered: number
  rule_breakdown: Record<string, number>
  entities_indexed: number
  relationships_indexed: number
  connected_components_count: number
  api_status: string
  data_source: string
  disclaimer: string
}
