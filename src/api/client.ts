/**
 * Medici Web API Client
 */
import type {
  ConnectedComponentInfo,
  EntityNode,
  GraphNeighborhood,
  GraphPathResponse,
  InvestigationDetail,
  RuleDefinition,
  SavedInvestigation,
  SummaryMetrics,
  TenderDetail,
  TenderPaginationResponse,
} from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${endpoint}`
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`API Error ${res.status} (${res.statusText}): ${errorText || 'Unknown error'}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  // Health
  checkHealth: async () => request<{ status: string; service: string; disclaimer: string }>('/api/health'),

  // Summary Metrics
  getSummary: async () => request<SummaryMetrics>('/api/summary'),

  // Rules Metadata
  getRules: async () => request<RuleDefinition[]>('/api/rules'),

  // Tenders List & Search
  getTenders: async (params?: {
    search?: string
    category?: string
    buyer_id?: string
    procedure?: string
    flagged_only?: boolean
    sort_by?: string
    sort_order?: string
    page?: number
    page_size?: number
  }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    if (params?.buyer_id) q.set('buyer_id', params.buyer_id)
    if (params?.procedure) q.set('procedure', params.procedure)
    if (params?.flagged_only !== undefined) q.set('flagged_only', String(params.flagged_only))
    if (params?.sort_by) q.set('sort_by', params.sort_by)
    if (params?.sort_order) q.set('sort_order', params.sort_order)
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))

    const queryStr = q.toString() ? `?${q.toString()}` : ''
    return request<TenderPaginationResponse>(`/api/tenders${queryStr}`)
  },

  // Single Tender Detail
  getTender: async (tenderId: string) => request<TenderDetail>(`/api/tenders/${encodeURIComponent(tenderId)}`),

  // Entities Search
  getEntities: async (params?: { search?: string; kind?: string; page?: number; page_size?: number }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.kind) q.set('kind', params.kind)
    if (params?.page) q.set('page', String(params.page))
    if (params?.page_size) q.set('page_size', String(params.page_size))

    const queryStr = q.toString() ? `?${q.toString()}` : ''
    return request<{ items: EntityNode[]; total: number; page: number; page_size: number; total_pages: number }>(
      `/api/entities${queryStr}`
    )
  },

  // Single Entity Detail
  getEntity: async (entityId: string) => request<EntityNode>(`/api/entities/${encodeURIComponent(entityId)}`),

  // Entity Neighborhood Subgraph
  getEntityNeighborhood: async (entityId: string, hops: number = 1, maxNodes: number = 35) =>
    request<GraphNeighborhood>(
      `/api/entities/${encodeURIComponent(entityId)}/neighborhood?hops=${hops}&max_nodes=${maxNodes}`
    ),

  // Shortest Relationship Path
  getShortestPath: async (sourceId: string, targetId: string) =>
    request<GraphPathResponse>(
      `/api/graph/path?source_id=${encodeURIComponent(sourceId)}&target_id=${encodeURIComponent(targetId)}`
    ),

  // Connected Components
  getConnectedComponents: async (minSize: number = 2, limit: number = 15) =>
    request<ConnectedComponentInfo[]>(`/api/graph/components?min_size=${minSize}&limit=${limit}`),

  // Unified Investigation Workspace
  getInvestigation: async (tenderId: string) =>
    request<InvestigationDetail>(`/api/investigations/${encodeURIComponent(tenderId)}`),

  // Saved Investigations Persistence
  getSavedInvestigations: async (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : ''
    return request<SavedInvestigation[]>(`/api/saved-investigations${q}`)
  },

  saveInvestigation: async (record: {
    tender_id: string
    status: 'open' | 'under_review' | 'completed'
    priority: 'low' | 'medium' | 'high'
    analyst_notes: string
    tags?: string
  }) =>
    request<SavedInvestigation>('/api/saved-investigations', {
      method: 'POST',
      body: JSON.stringify(record),
    }),

  deleteSavedInvestigation: async (tenderId: string) =>
    request<{ status: string; tender_id: string }>(`/api/saved-investigations/${encodeURIComponent(tenderId)}`, {
      method: 'DELETE',
    }),
}
