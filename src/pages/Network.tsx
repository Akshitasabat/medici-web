import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react'
import { api } from '../api/client'
import type { MediciPage } from '../components/Navigation'
import type { ConnectedComponentInfo, EntityNode, GraphNeighborhood, GraphPathResponse } from '../types'

interface NetworkPageProps {
  initialEntityId?: string
  onNavigate: (page: MediciPage, tenderId?: string, entityId?: string) => void
}

const KIND_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  company: { bg: '#4f3622', border: '#987f61', text: '#fff8e9' },
  officer: { bg: '#987f61', border: '#fee197', text: '#2f2116' },
  official: { bg: '#fee197', border: '#4f3622', text: '#2f2116' },
  offshore_entity: { bg: '#b8755b', border: '#fee197', text: '#fff8e9' },
  address: { bg: '#9da991', border: '#4f3622', text: '#2f2116' },
  buyer: { bg: '#fff8e9', border: '#4f3622', text: '#2f2116' },
  unknown: { bg: '#666', border: '#999', text: '#fff' },
}

export default function Network({ initialEntityId = 'C091', onNavigate }: NetworkPageProps) {
  const [selectedEntityId, setSelectedEntityId] = useState<string>(initialEntityId)
  const [neighborhood, setNeighborhood] = useState<GraphNeighborhood | null>(null)
  const [loading, setLoading] = useState(false)
  const [hops, setHops] = useState<number>(1)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<EntityNode[]>([])
  const [activeTab, setActiveTab] = useState<'graph' | 'path' | 'components'>('graph')

  // Shortest Path state
  const [pathSource, setPathSource] = useState('C091')
  const [pathTarget, setPathTarget] = useState('P115')
  const [pathResult, setPathResult] = useState<GraphPathResponse | null>(null)
  const [pathLoading, setPathLoading] = useState(false)

  // Components state
  const [components, setComponents] = useState<ConnectedComponentInfo[]>([])

  // Graph Canvas Pan & Zoom
  const [zoom, setZoom] = useState(1.0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })

  const loadEntityNeighborhood = async (entityId: string, currentHops: number = hops) => {
    setLoading(true)
    try {
      const data = await api.getEntityNeighborhood(entityId, currentHops, 35)
      setNeighborhood(data)
      setSelectedEntityId(entityId)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEntityNeighborhood(selectedEntityId, hops)
  }, [hops])

  const handleEntitySearch = async (q: string) => {
    setSearch(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    try {
      const res = await api.getEntities({ search: q.trim(), page_size: 8 })
      setSearchResults(res.items)
    } catch (err) {
      console.error(err)
    }
  }

  const handleFindPath = async () => {
    if (!pathSource.trim() || !pathTarget.trim()) return
    setPathLoading(true)
    try {
      const res = await api.getShortestPath(pathSource.trim(), pathTarget.trim())
      setPathResult(res)
    } catch (err) {
      console.error(err)
    } finally {
      setPathLoading(false)
    }
  }

  const loadComponents = async () => {
    try {
      const res = await api.getConnectedComponents(2, 12)
      setComponents(res)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    if (activeTab === 'components' && components.length === 0) {
      loadComponents()
    }
  }, [activeTab])

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    })
  }

  const handleMouseUp = () => {
    isDragging.current = false
  }

  const resetView = () => {
    setZoom(1.0)
    setPan({ x: 0, y: 0 })
  }

  // Calculate layout coordinates for SVG rendering
  const nodes = neighborhood?.nodes || []
  const edges = neighborhood?.edges || []
  const centerNode = neighborhood?.center_node

  // Simple deterministic circular layout around center
  const width = 800
  const height = 520
  const centerX = width / 2
  const centerY = height / 2

  const nodePositions: Record<string, { x: number; y: number }> = {}

  if (centerNode) {
    nodePositions[centerNode.node_id] = { x: centerX, y: centerY }
    const otherNodes = nodes.filter((n) => n.node_id !== centerNode.node_id)
    const count = otherNodes.length
    const radius = count > 12 ? 220 : 180

    otherNodes.forEach((node, idx) => {
      const angle = (idx / (count || 1)) * 2 * Math.PI
      nodePositions[node.node_id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      }
    })
  }

  const selectedNodeData = nodes.find((n) => n.node_id === selectedEntityId) || centerNode

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="border-b border-[#4f3622]/40 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-[#987f61] uppercase">
            Network Intelligence // Ownership Graph
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mt-2 text-[#2f2116]">
            Entity Ownership Network.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4f3622]">
            Traverse documented corporate registries, directors, and offshore holding structures. Identify
            common beneficial owners, shared addresses, and PEP linkages using NetworkX.
          </p>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 border border-[#4f3622]/30 bg-[#fff8e9] p-1 text-xs font-mono">
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'graph' ? 'bg-[#2f2116] text-[#fee197] font-bold' : 'text-[#4f3622] hover:bg-[#ffebd0]'
            }`}
          >
            Ego Graph
          </button>
          <button
            onClick={() => setActiveTab('path')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'path' ? 'bg-[#2f2116] text-[#fee197] font-bold' : 'text-[#4f3622] hover:bg-[#ffebd0]'
            }`}
          >
            Path Finder
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`px-3 py-1.5 transition-colors ${
              activeTab === 'components' ? 'bg-[#2f2116] text-[#fee197] font-bold' : 'text-[#4f3622] hover:bg-[#ffebd0]'
            }`}
          >
            Components
          </button>
        </div>
      </section>

      {/* Main Workspace Layout */}
      {activeTab === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Visual Graph Area (3 Cols) */}
          <div className="lg:col-span-3 border border-[#4f3622]/30 bg-[#fff8e9] flex flex-col overflow-hidden relative min-h-[580px]">
            {/* Top Toolbar */}
            <div className="p-3 border-b border-[#4f3622]/20 bg-[#ffebd0]/40 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-[#987f61] uppercase tracking-wider">Hops Radius:</span>
                <button
                  onClick={() => setHops(1)}
                  className={`px-2.5 py-1 border border-[#4f3622]/30 ${
                    hops === 1 ? 'bg-[#2f2116] text-[#fee197] font-bold' : 'bg-[#fff8e9] text-[#2f2116]'
                  }`}
                >
                  1 Hop (Direct)
                </button>
                <button
                  onClick={() => setHops(2)}
                  className={`px-2.5 py-1 border border-[#4f3622]/30 ${
                    hops === 2 ? 'bg-[#2f2116] text-[#fee197] font-bold' : 'bg-[#fff8e9] text-[#2f2116]'
                  }`}
                >
                  2 Hops (Extended)
                </button>
              </div>

              {/* Quick Search */}
              <div className="relative w-64">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => handleEntitySearch(e.target.value)}
                  placeholder="Focus entity ID or name..."
                  className="w-full bg-[#fff8e9] border border-[#4f3622]/30 px-3 py-1 text-xs text-[#2f2116] focus:outline-none"
                />
                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#fff8e9] border border-[#4f3622] shadow-lg z-30 max-h-48 overflow-y-auto">
                    {searchResults.map((ent) => (
                      <button
                        key={ent.node_id}
                        onClick={() => {
                          loadEntityNeighborhood(ent.node_id)
                          setSearch('')
                          setSearchResults([])
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#fee197]/30 text-xs border-b border-[#4f3622]/10 flex items-center justify-between"
                      >
                        <span className="font-serif font-semibold text-[#2f2116] truncate">{ent.name}</span>
                        <span className="font-mono text-[10px] text-[#987f61]">{ent.kind}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom((z) => Math.min(2.0, z + 0.15))}
                  className="p-1.5 border border-[#4f3622]/30 bg-[#fff8e9] hover:bg-[#ffebd0]"
                  title="Zoom In"
                >
                  <Plus className="w-3.5 h-3.5 text-[#2f2116]" />
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
                  className="p-1.5 border border-[#4f3622]/30 bg-[#fff8e9] hover:bg-[#ffebd0]"
                  title="Zoom Out"
                >
                  <Minus className="w-3.5 h-3.5 text-[#2f2116]" />
                </button>
                <button
                  onClick={resetView}
                  className="p-1.5 border border-[#4f3622]/30 bg-[#fff8e9] hover:bg-[#ffebd0]"
                  title="Reset Pan & Zoom"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#2f2116]" />
                </button>
              </div>
            </div>

            {/* Interactive SVG Canvas */}
            <div
              className="flex-1 w-full relative overflow-hidden bg-cad-grid-light cursor-grab active:cursor-grabbing select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#fff8e9]/60 backdrop-blur-xs">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#2f2116]">
                    <RefreshCw className="w-4 h-4 animate-spin text-[#987f61]" />
                    <span>Extracting NetworkX neighborhood...</span>
                  </div>
                </div>
              )}

              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${height}`}
                className="w-full h-full min-h-[500px]"
              >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                  {/* Edges */}
                  {edges.map((edge) => {
                    const p1 = nodePositions[edge.start_id]
                    const p2 = nodePositions[edge.end_id]
                    if (!p1 || !p2) return null

                    const midX = (p1.x + p2.x) / 2
                    const midY = (p1.y + p2.y) / 2

                    return (
                      <g key={edge.edge_id}>
                        <line
                          x1={p1.x}
                          y1={p1.y}
                          x2={p2.x}
                          y2={p2.y}
                          stroke="#987f61"
                          strokeWidth="1.5"
                          strokeDasharray={edge.rel_type === 'relative_of' ? '4 3' : undefined}
                          opacity="0.65"
                        />
                        {/* Edge Label Badge */}
                        <rect
                          x={midX - 35}
                          y={midY - 8}
                          width="70"
                          height="16"
                          fill="#fff8e9"
                          stroke="#4f3622"
                          strokeWidth="0.5"
                          rx="2"
                        />
                        <text
                          x={midX}
                          y={midY + 3}
                          textAnchor="middle"
                          fill="#4f3622"
                          fontSize="8"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {edge.rel_type.replace(/_/g, ' ')}
                        </text>
                      </g>
                    )
                  })}

                  {/* Nodes */}
                  {nodes.map((node) => {
                    const pos = nodePositions[node.node_id]
                    if (!pos) return null

                    const isCenter = node.node_id === centerNode?.node_id
                    const isSelected = node.node_id === selectedEntityId
                    const colors = KIND_COLORS[node.kind] || KIND_COLORS.unknown
                    const isPep = node.flagged_status === 'PEP'

                    return (
                      <g
                        key={node.node_id}
                        transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedEntityId(node.node_id)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          loadEntityNeighborhood(node.node_id)
                        }}
                        className="cursor-pointer group"
                      >
                        {/* Glow for selection or PEP */}
                        {isPep && (
                          <circle r="34" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="3 3" />
                        )}
                        {isSelected && !isPep && (
                          <circle r="32" fill="none" stroke="#fee197" strokeWidth="3" opacity="0.9" />
                        )}

                        {/* Node Body */}
                        <circle
                          r={isCenter ? '24' : '20'}
                          fill={colors.bg}
                          stroke={isSelected ? '#fee197' : colors.border}
                          strokeWidth={isSelected ? '2.5' : '1.5'}
                        />

                        {/* Node Label */}
                        <text
                          y={isCenter ? '36' : '32'}
                          textAnchor="middle"
                          fill="#2f2116"
                          fontSize="10"
                          fontWeight="600"
                          fontFamily="Georgia, serif"
                          className="pointer-events-none"
                        >
                          {node.name.length > 20 ? `${node.name.slice(0, 18)}...` : node.name}
                        </text>

                        <text
                          y={isCenter ? '46' : '42'}
                          textAnchor="middle"
                          fill="#987f61"
                          fontSize="8"
                          fontFamily="JetBrains Mono, monospace"
                          className="pointer-events-none"
                        >
                          {node.node_id} // {node.kind}
                        </text>

                        {/* PEP Badge */}
                        {isPep && (
                          <g transform="translate(14, -14)">
                            <rect x="-12" y="-7" width="24" height="14" fill="#dc2626" rx="2" />
                            <text
                              textAnchor="middle"
                              y="3"
                              fill="#fff"
                              fontSize="8"
                              fontWeight="bold"
                              fontFamily="JetBrains Mono, monospace"
                            >
                              PEP
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                </g>
              </svg>

              {/* Canvas Legend */}
              <div className="absolute bottom-3 left-3 bg-[#fff8e9]/90 border border-[#4f3622]/30 p-2.5 text-[10px] font-mono space-y-1 shadow-sm">
                <span className="font-bold block uppercase tracking-wider text-[#987f61]">Entity Legend:</span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#4f3622]" /> Company
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#987f61]" /> Officer / Person
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#b8755b]" /> Offshore Entity
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fee197] border border-[#4f3622]" /> Official
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#9da991]" /> Address Hub
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full border border-red-500 bg-red-100" /> PEP Flag
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel: Selected Entity Profile (1 Col) */}
          <div className="border border-[#4f3622]/30 bg-[#fff8e9] p-5 space-y-5">
            {selectedNodeData ? (
              <>
                <div className="border-b border-[#4f3622]/20 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase px-2 py-0.5 bg-[#ffebd0] text-[#2f2116] border border-[#4f3622]/20">
                      {selectedNodeData.kind}
                    </span>
                    {selectedNodeData.flagged_status === 'PEP' && (
                      <span className="font-mono text-xs px-2 py-0.5 bg-red-600 text-white font-bold">
                        PEP RECORDED
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-2xl mt-3 text-[#2f2116]">{selectedNodeData.name}</h3>
                  <p className="font-mono text-xs text-[#987f61] mt-1">Node ID: {selectedNodeData.node_id}</p>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-[#987f61] block text-[10px] uppercase">Jurisdiction</span>
                    <span className="text-[#2f2116]">{selectedNodeData.jurisdiction || 'Domestic / Home'}</span>
                  </div>
                  <div>
                    <span className="text-[#987f61] block text-[10px] uppercase">Registration Date</span>
                    <span className="text-[#2f2116]">{selectedNodeData.reg_date || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[#987f61] block text-[10px] uppercase">Network Degree</span>
                    <span className="text-[#2f2116]">{selectedNodeData.degree || '—'} recorded connections</span>
                  </div>
                  <div>
                    <span className="text-[#987f61] block text-[10px] uppercase">Source Provenance</span>
                    <span className="text-[#2f2116]">{selectedNodeData.source || 'ownership_nodes.csv'}</span>
                  </div>
                </div>

                {/* Direct Connections */}
                <div className="pt-3 border-t border-[#4f3622]/20 space-y-2">
                  <span className="font-mono text-xs text-[#987f61] uppercase tracking-wider block">
                    Recorded Relations ({edges.filter((e) => e.start_id === selectedEntityId || e.end_id === selectedEntityId).length})
                  </span>
                  <div className="max-h-48 overflow-y-auto divide-y divide-[#4f3622]/10 text-xs font-mono">
                    {edges
                      .filter((e) => e.start_id === selectedEntityId || e.end_id === selectedEntityId)
                      .map((e) => {
                        const targetId = e.start_id === selectedEntityId ? e.end_id : e.start_id
                        const targetNode = nodes.find((n) => n.node_id === targetId)
                        return (
                          <div
                            key={e.edge_id}
                            onClick={() => setSelectedEntityId(targetId)}
                            className="py-1.5 cursor-pointer hover:bg-[#ffebd0] px-1 transition-colors flex items-center justify-between"
                          >
                            <span className="text-[#2f2116] font-serif truncate max-w-[130px]">
                              {targetNode?.name || targetId}
                            </span>
                            <span className="text-[#987f61] text-[10px]">{e.rel_type}</span>
                          </div>
                        )
                      })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#4f3622]/20 space-y-2">
                  <button
                    onClick={() => loadEntityNeighborhood(selectedEntityId)}
                    className="w-full py-2 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] font-serif text-xs font-semibold tracking-wide transition-colors"
                  >
                    Recenter Graph on Entity
                  </button>
                  <button
                    onClick={() => {
                      setPathSource(selectedEntityId)
                      setActiveTab('path')
                    }}
                    className="w-full py-2 border border-[#4f3622]/30 text-[#2f2116] hover:bg-[#ffebd0] font-serif text-xs transition-colors"
                  >
                    Find Connection Path
                  </button>
                  <button
                    onClick={() => onNavigate('tenders')}
                    className="w-full py-2 border border-[#4f3622]/30 text-[#4f3622] hover:bg-[#ffebd0] font-serif text-xs transition-colors"
                  >
                    Explore Related Tenders
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs font-mono text-[#987f61] py-8 text-center">
                Select an entity node in the graph to inspect its registry profile.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Path Finder Tab */}
      {activeTab === 'path' && (
        <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 space-y-6">
          <div className="border-b border-[#4f3622]/20 pb-4">
            <h2 className="font-serif text-2xl text-[#2f2116]">Shortest Connection Path Algorithm</h2>
            <p className="text-xs text-[#4f3622] mt-1">
              Traverse the NetworkX ownership multi-graph to calculate recorded corporate and personal paths
              between any two indexed entities.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
            <div>
              <label className="block text-[#987f61] uppercase text-[10px] mb-1">Source Entity ID</label>
              <input
                type="text"
                value={pathSource}
                onChange={(e) => setPathSource(e.target.value)}
                placeholder="e.g. C091 (Karst Ridge)"
                className="w-full bg-[#ffebd0]/30 border border-[#4f3622]/30 p-2 text-sm text-[#2f2116]"
              />
            </div>
            <div>
              <label className="block text-[#987f61] uppercase text-[10px] mb-1">Target Entity ID</label>
              <input
                type="text"
                value={pathTarget}
                onChange={(e) => setPathTarget(e.target.value)}
                placeholder="e.g. P115 (Dmitri Vass)"
                className="w-full bg-[#ffebd0]/30 border border-[#4f3622]/30 p-2 text-sm text-[#2f2116]"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleFindPath}
                disabled={pathLoading}
                className="w-full py-2.5 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] font-serif font-semibold text-sm transition-colors"
              >
                {pathLoading ? 'Traversing Graph...' : 'Trace Path'}
              </button>
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#987f61]">
            <span>Try documented benchmark leads:</span>
            <button
              onClick={() => {
                setPathSource('C091')
                setPathTarget('P115')
              }}
              className="px-2 py-0.5 border border-[#4f3622]/20 hover:bg-[#ffebd0]"
            >
              Karst Ridge (C091) → PEP Dmitri Vass (P115)
            </button>
            <button
              onClick={() => {
                setPathSource('C094')
                setPathTarget('C097')
              }}
              className="px-2 py-0.5 border border-[#4f3622]/20 hover:bg-[#ffebd0]"
            >
              Bid-Rigging Ring (C094 → C097)
            </button>
            <button
              onClick={() => {
                setPathSource('C091')
                setPathTarget('C100')
              }}
              className="px-2 py-0.5 border border-[#4f3622]/20 hover:bg-[#ffebd0]"
            >
              Karst Ridge (C091) → Shell Co Novaterra (C100)
            </button>
          </div>

          {/* Path Result Display */}
          {pathResult && (
            <div className="border border-[#4f3622]/30 p-6 bg-[#ffebd0]/30 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-serif font-semibold text-base text-[#2f2116]">
                  {pathResult.path_found ? (
                    <span className="text-emerald-800">Connection Path Found ({pathResult.hops} Hops)</span>
                  ) : (
                    <span className="text-rose-800">No Connection Path Found</span>
                  )}
                </span>
                <span className="font-mono text-xs text-[#987f61]">{pathResult.message}</span>
              </div>

              {pathResult.path_found && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center gap-3">
                    {pathResult.nodes.map((node, idx) => (
                      <div key={node.node_id} className="flex items-center gap-2">
                        <div
                          onClick={() => {
                            setSelectedEntityId(node.node_id)
                            setActiveTab('graph')
                            loadEntityNeighborhood(node.node_id)
                          }}
                          className="border border-[#4f3622] bg-[#fff8e9] p-3 text-xs cursor-pointer hover:border-[#fee197] hover:shadow-md transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] uppercase text-[#987f61]">{node.kind}</span>
                            {node.flagged_status === 'PEP' && (
                              <span className="text-[9px] bg-red-600 text-white px-1 font-bold">PEP</span>
                            )}
                          </div>
                          <p className="font-serif font-bold text-sm text-[#2f2116] mt-0.5">{node.name}</p>
                          <p className="font-mono text-[10px] text-[#987f61]">{node.node_id}</p>
                        </div>

                        {idx < pathResult.nodes.length - 1 && (
                          <div className="flex flex-col items-center text-xs font-mono text-[#987f61] px-1">
                            <ArrowRight className="w-4 h-4 text-[#4f3622]" />
                            <span className="text-[10px]">
                              {pathResult.edges[idx]?.rel_type.replace(/_/g, ' ') || 'connected'}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-[#4f3622] italic pt-2">
                    Click any entity card along the trail to open its ego network in the interactive graph.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Components Explorer Tab */}
      {activeTab === 'components' && (
        <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 space-y-6">
          <div className="border-b border-[#4f3622]/20 pb-4">
            <h2 className="font-serif text-2xl text-[#2f2116]">Connected Component Analysis</h2>
            <p className="text-xs text-[#4f3622] mt-1">
              NetworkX identifies disjoint clusters within the ownership graph. Large clusters frequently
              represent interlinked corporate families, joint directorships, or shared registration hubs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {components.map((comp) => (
              <div
                key={comp.component_id}
                className="border border-[#4f3622]/20 p-5 bg-[#ffebd0]/20 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#2f2116]">
                    CLUSTER #{comp.component_id}
                  </span>
                  <span className="font-mono text-xs px-2 py-0.5 bg-[#fee197]/70 text-[#2f2116]">
                    {comp.node_count} nodes // {comp.edge_count} edges
                  </span>
                </div>

                <div className="text-xs font-mono space-y-1 text-[#4f3622]">
                  <span className="text-[#987f61] block text-[10px] uppercase">Entity Composition:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(comp.kinds).map(([k, count]) => (
                      <span key={k} className="px-1.5 py-0.5 bg-[#fff8e9] border border-[#4f3622]/20">
                        {count} {k}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-xs font-mono space-y-1 text-[#4f3622]">
                  <span className="text-[#987f61] block text-[10px] uppercase">Sample Entities:</span>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5">
                    {comp.sample_nodes.map((s, i) => (
                      <li key={i} className="truncate" title={s}>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    const firstId = comp.sample_nodes[0]?.match(/\(([^)]+)\)/)?.[1]
                    if (firstId) {
                      loadEntityNeighborhood(firstId, 2)
                      setActiveTab('graph')
                    }
                  }}
                  className="w-full mt-2 py-1.5 text-xs font-serif border border-[#4f3622]/30 hover:bg-[#fff8e9] transition-colors"
                >
                  Inspect Cluster in Graph
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
