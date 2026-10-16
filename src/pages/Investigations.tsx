import { useEffect, useState } from 'react'
import {
  BookmarkCheck,
  Building2,
  CheckCircle,
  ExternalLink,
  Network,
  RefreshCw,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { api } from '../api/client'
import type { MediciPage } from '../components/Navigation'
import type { InvestigationDetail, SavedInvestigation } from '../types'

interface InvestigationsProps {
  initialTenderId?: string
  onNavigate: (page: MediciPage, tenderId?: string, entityId?: string) => void
}

export default function Investigations({ initialTenderId = 'T00502', onNavigate }: InvestigationsProps) {
  const [activeTenderId, setActiveTenderId] = useState(initialTenderId)
  const [tenderInput, setTenderInput] = useState(initialTenderId)
  const [investigation, setInvestigation] = useState<InvestigationDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Analyst Triage State
  const [status, setStatus] = useState<'open' | 'under_review' | 'completed'>('open')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [analystNotes, setAnalystNotes] = useState('')
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Saved investigations drawer
  const [savedList, setSavedList] = useState<SavedInvestigation[]>([])
  const [showSavedList, setShowSavedList] = useState(false)

  const loadInvestigation = async (tenderId: string) => {
    setLoading(true)
    setError(null)
    setSaveSuccess(null)
    try {
      const data = await api.getInvestigation(tenderId.trim())
      setInvestigation(data)
      setActiveTenderId(tenderId.trim())
      setTenderInput(tenderId.trim())

      if (data.saved_record) {
        setStatus(data.saved_record.status)
        setPriority(data.saved_record.priority)
        setAnalystNotes(data.saved_record.analyst_notes || '')
      } else {
        setStatus('open')
        setPriority('medium')
        setAnalystNotes('')
      }
    } catch (err: any) {
      setError(err.message || 'Tender investigation could not be retrieved.')
    } finally {
      setLoading(false)
    }
  }

  const loadSavedList = async () => {
    try {
      const list = await api.getSavedInvestigations()
      setSavedList(list)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    loadInvestigation(activeTenderId)
    loadSavedList()
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tenderInput.trim()) {
      loadInvestigation(tenderInput.trim())
    }
  }

  const handleSaveInvestigation = async () => {
    if (!investigation) return
    setSaving(true)
    try {
      const saved = await api.saveInvestigation({
        tender_id: activeTenderId,
        status,
        priority,
        analyst_notes: analystNotes,
      })
      setSaveSuccess(`Investigation saved at ${new Date(saved.updated_at).toLocaleTimeString()}`)
      loadSavedList()
    } catch (err: any) {
      setError(err.message || 'Failed to save investigation notes.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSaved = async (tid: string) => {
    try {
      await api.deleteSavedInvestigation(tid)
      loadSavedList()
      if (tid === activeTenderId) {
        setStatus('open')
        setPriority('medium')
        setAnalystNotes('')
        setSaveSuccess(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-8">
      {/* Workspace Header */}
      <section className="border-b border-[#4f3622]/40 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-[#987f61] uppercase">
            Investigation Workspace // Case File
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mt-2 text-[#2f2116]">
            Procurement Dossier: {activeTenderId}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4f3622]">
            Examine the auditable evidence trail behind triggered screening flags, link the winning supplier to
            corporate ownership registries, and record persistent analyst findings in SQLite.
          </p>
        </div>

        {/* Quick Tender Search & Saved Drawer Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1 font-mono text-xs">
            <input
              type="text"
              value={tenderInput}
              onChange={(e) => setTenderInput(e.target.value)}
              placeholder="Tender ID (e.g. T00502)..."
              className="bg-[#fff8e9] border border-[#4f3622]/40 px-3 py-2 text-[#2f2116] w-36 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] font-semibold"
            >
              Load
            </button>
          </form>

          <button
            onClick={() => {
              setShowSavedList(!showSavedList)
              loadSavedList()
            }}
            className="inline-flex items-center gap-1.5 font-mono text-xs border border-[#4f3622]/40 bg-[#fff8e9] hover:bg-[#ffebd0] px-3 py-2 text-[#2f2116] transition-colors"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-[#987f61]" />
            <span>Saved Dossiers ({savedList.length})</span>
          </button>
        </div>
      </section>

      {/* Saved Investigations Slide-over Drawer */}
      {showSavedList && (
        <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#4f3622]/20 pb-3">
            <span className="font-serif font-bold text-lg text-[#2f2116]">
              Persistent Analyst Dossiers (SQLite Database)
            </span>
            <button
              onClick={() => setShowSavedList(false)}
              className="font-mono text-xs text-[#987f61] hover:text-[#2f2116]"
            >
              Close Drawer
            </button>
          </div>

          {savedList.length === 0 ? (
            <p className="text-xs font-mono text-[#987f61] py-4 text-center">
              No saved analyst investigations recorded yet. Review a tender below and click 'Save Investigation'.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedList.map((rec) => (
                <div
                  key={rec.tender_id}
                  className={`border p-3 space-y-2 text-xs font-mono transition-colors ${
                    rec.tender_id === activeTenderId
                      ? 'border-[#2f2116] bg-[#fee197]/20'
                      : 'border-[#4f3622]/20 bg-[#ffebd0]/30 hover:bg-[#ffebd0]/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#2f2116]">{rec.tender_id}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 uppercase ${
                        rec.priority === 'high'
                          ? 'bg-rose-200 text-rose-900 font-bold'
                          : rec.priority === 'medium'
                          ? 'bg-amber-200 text-amber-900'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {rec.priority} priority
                    </span>
                  </div>
                  <p className="font-sans text-xs text-[#4f3622] line-clamp-2">
                    {rec.analyst_notes || 'No analyst notes recorded.'}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-[#4f3622]/15 text-[10px] text-[#987f61]">
                    <span>Status: {rec.status}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          loadInvestigation(rec.tender_id)
                          setShowSavedList(false)
                        }}
                        className="underline hover:text-[#2f2116]"
                      >
                        Open Dossier
                      </button>
                      <button
                        onClick={() => handleDeleteSaved(rec.tender_id)}
                        className="text-rose-700 hover:text-rose-900"
                        title="Delete record"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Error alert */}
      {error && (
        <div className="border border-rose-800/40 bg-rose-50 text-rose-900 p-4 text-xs font-mono">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center font-mono text-sm text-[#987f61]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#2f2116]" />
          Compiling investigation dossier from tender records and NetworkX graph...
        </div>
      ) : investigation ? (
        <div className="space-y-8">
          {/* Section 1: Tender Overview Card */}
          <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-4 border-b border-[#4f3622]/20 gap-3">
              <div>
                <div className="flex items-center gap-2 font-mono text-xs text-[#987f61]">
                  <span>CONTRACT OVERVIEW</span>
                  <span>//</span>
                  <span className="uppercase">{investigation.tender.category}</span>
                  <span>//</span>
                  <span className="uppercase">{investigation.tender.procedure} PROCEDURE</span>
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl mt-1 text-[#2f2116]">
                  {investigation.tender.title}
                </h2>
                <p className="text-xs text-[#4f3622] mt-1">
                  Contracting Authority:{' '}
                  <span className="font-bold">{investigation.tender.buyer}</span> (ID:{' '}
                  {investigation.tender.buyer_id})
                </p>
              </div>

              <div className="text-right font-mono">
                <span className="text-xs text-[#987f61] block uppercase">Award Value</span>
                <span className="text-3xl font-serif font-bold text-[#2f2116]">
                  {investigation.tender.value
                    ? `${investigation.tender.value.toLocaleString()} ${investigation.tender.currency}`
                    : '—'}
                </span>
              </div>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-xs">
              <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                <span className="text-[#987f61] text-[10px] uppercase block">Bidders Participated</span>
                <span className="text-lg font-bold text-[#2f2116]">
                  {investigation.tender.n_bidders ?? '—'}
                </span>
                <span className="text-[10px] text-[#4f3622] block mt-0.5">
                  {investigation.tender.n_bidders === 1 ? 'Single-bid competition' : 'Multi-bid competition'}
                </span>
              </div>

              <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                <span className="text-[#987f61] text-[10px] uppercase block">Bidding Window</span>
                <span className="text-lg font-bold text-[#2f2116]">
                  {investigation.tender.bidding_window_days !== null
                    ? `${investigation.tender.bidding_window_days} Days`
                    : '—'}
                </span>
                <span className="text-[10px] text-[#4f3622] block mt-0.5">
                  Pub: {investigation.tender.publish_date}
                </span>
              </div>

              <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                <span className="text-[#987f61] text-[10px] uppercase block">Award Turnaround</span>
                <span className="text-lg font-bold text-[#2f2116]">
                  {investigation.tender.award_window_days !== null
                    ? `${investigation.tender.award_window_days} Days`
                    : '—'}
                </span>
                <span className="text-[10px] text-[#4f3622] block mt-0.5">
                  Award: {investigation.tender.award_date}
                </span>
              </div>

              <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                <span className="text-[#987f61] text-[10px] uppercase block">Winner Age at Award</span>
                <span className="text-lg font-bold text-[#2f2116]">
                  {investigation.tender.winner_age_at_award_days !== null
                    ? `${investigation.tender.winner_age_at_award_days} Days`
                    : '—'}
                </span>
                <span className="text-[10px] text-[#4f3622] block mt-0.5">
                  Inc: {investigation.tender.winner_reg_date || '—'}
                </span>
              </div>
            </div>
          </section>

          {/* Section 2: Evidence & Triggered Rules */}
          <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#4f3622]/20">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-800" />
                <h3 className="font-serif text-2xl text-[#2f2116]">
                  Screening Red Flags & Auditable Evidence ({investigation.flags.length})
                </h3>
              </div>
              <span className="font-mono text-xs text-[#987f61]">Transparent Heuristics</span>
            </div>

            {investigation.flags.length === 0 ? (
              <p className="text-xs text-emerald-800 font-mono py-4">
                No red flags triggered for this contract under current screening thresholds.
              </p>
            ) : (
              <div className="space-y-4">
                {investigation.flags.map((flag) => (
                  <div
                    key={flag.rule_id}
                    className="border border-[#4f3622]/30 p-5 bg-[#fee197]/20 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="font-serif font-bold text-lg text-[#2f2116]">{flag.rule_name}</span>
                      <span className="font-mono text-xs px-2.5 py-1 bg-[#2f2116] text-[#fee197] font-semibold self-start sm:self-auto">
                        {flag.rule_id}
                      </span>
                    </div>

                    <p className="text-sm text-[#2f2116] leading-relaxed">{flag.explanation}</p>

                    <div className="border border-[#4f3622]/20 bg-[#fff8e9] p-3 font-mono text-xs space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#987f61] block">
                        Record Evidence Data:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#4f3622]">
                        {Object.entries(flag.evidence).map(([key, val]) => (
                          <div key={key}>
                            <span className="text-[#987f61]">{key}:</span> {String(val)}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 3: Winner to Ownership Entity Matching */}
          <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#4f3622]/20">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#987f61]" />
                <h3 className="font-serif text-2xl text-[#2f2116]">Winner / Entity Registry Matching</h3>
              </div>
              <span className="font-mono text-xs text-[#987f61]">Corporate Entity Resolution</span>
            </div>

            {investigation.winner_match ? (
              <div className="border border-[#4f3622]/20 p-5 bg-[#ffebd0]/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-[#987f61] block">
                      Tender Winner Record
                    </span>
                    <p className="font-serif font-bold text-lg text-[#2f2116]">
                      {investigation.winner_match.tender_winner_name}
                    </p>
                    <p className="font-mono text-xs text-[#987f61]">
                      Winner Company ID: {investigation.winner_match.tender_winner_id}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <span
                      className={`inline-block font-mono text-xs px-3 py-1 font-bold ${
                        investigation.winner_match.match_status === 'verified_id_match'
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                          : investigation.winner_match.match_status === 'exact_name_candidate'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}
                    >
                      {investigation.winner_match.match_status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="font-mono text-[11px] text-[#987f61] block mt-1">
                      Match Method: {investigation.winner_match.match_method}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#fff8e9] border border-[#4f3622]/20 font-mono text-xs text-[#4f3622]">
                  <p>{investigation.winner_match.notes}</p>
                </div>

                {investigation.winner_match.candidate_node_id && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="font-mono text-xs text-[#987f61]">
                      Matched Registry Node: {investigation.winner_match.candidate_node_id} (
                      {investigation.winner_match.candidate_node_name})
                    </span>
                    <button
                      onClick={() =>
                        onNavigate('network', undefined, investigation.winner_match?.candidate_node_id || undefined)
                      }
                      className="inline-flex items-center gap-1.5 font-serif text-xs font-semibold px-4 py-2 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] transition-colors"
                    >
                      <span>Explore Node in Full Graph</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-mono text-[#987f61]">No winner entity matched for this tender.</p>
            )}
          </section>

          {/* Section 4: Matched Entity Ownership Neighborhood (Mini Graph) */}
          {investigation.entity_neighborhood && (
            <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#4f3622]/20">
                <div className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-[#987f61]" />
                  <h3 className="font-serif text-2xl text-[#2f2116]">
                    Ownership Relationships: {investigation.entity_neighborhood.center_node.name}
                  </h3>
                </div>
                <span className="font-mono text-xs text-[#987f61]">
                  {investigation.entity_neighborhood.total_nodes} Related Entities //{' '}
                  {investigation.entity_neighborhood.total_edges} Edges
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {investigation.entity_neighborhood.nodes.map((node) => {
                  const isCenter = node.node_id === investigation.entity_neighborhood?.center_node.node_id
                  const isPep = node.flagged_status === 'PEP'
                  return (
                    <div
                      key={node.node_id}
                      onClick={() => onNavigate('network', undefined, node.node_id)}
                      className={`border p-4 cursor-pointer hover:border-[#fee197] hover:shadow-md transition-all ${
                        isPep
                          ? 'border-red-500 bg-red-50/50'
                          : isCenter
                          ? 'border-[#2f2116] bg-[#fee197]/20 font-semibold'
                          : 'border-[#4f3622]/20 bg-[#ffebd0]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between font-mono text-[10px]">
                        <span className="uppercase text-[#987f61]">{node.kind}</span>
                        {isPep && (
                          <span className="bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">
                            PEP
                          </span>
                        )}
                        {isCenter && <span className="text-[#2f2116]">[TENDER WINNER]</span>}
                      </div>

                      <h4 className="font-serif text-base font-bold text-[#2f2116] mt-2 truncate">
                        {node.name}
                      </h4>

                      <div className="mt-2 text-xs font-mono text-[#4f3622] space-y-0.5">
                        <p>ID: {node.node_id}</p>
                        <p>Jurisdiction: {node.jurisdiction || 'Home'}</p>
                        <p>Inc Date: {node.reg_date || '—'}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="pt-2 text-xs font-mono text-[#987f61] flex items-center justify-between">
                <span>
                  Tip: Dmitri Vass (PEP) and offshore entity Calloway Holdings (BVI) appear in this supplier
                  chain.
                </span>
                <button
                  onClick={() =>
                    onNavigate('network', undefined, investigation.entity_neighborhood?.center_node.node_id)
                  }
                  className="underline hover:text-[#2f2116]"
                >
                  View Full Graph Traversal
                </button>
              </div>
            </section>
          )}

          {/* Section 5: Persistent Analyst Triage & Findings */}
          <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 space-y-5">
            <div className="border-b border-[#4f3622]/20 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-serif text-2xl text-[#2f2116]">Analyst Triage & Findings</h3>
                <p className="text-xs text-[#4f3622] mt-0.5">
                  Record findings, assign triage statuses, and persist records directly into the SQLite database.
                </p>
              </div>
              {saveSuccess && (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs text-emerald-800 bg-emerald-100 px-3 py-1 border border-emerald-300">
                  <CheckCircle className="w-3.5 h-3.5" />
                  {saveSuccess}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <label className="block text-[10px] uppercase text-[#987f61] mb-1">
                  Investigation Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full bg-[#ffebd0]/30 border border-[#4f3622]/30 p-2 text-sm text-[#2f2116] focus:outline-none"
                >
                  <option value="open">Open (Awaiting Review)</option>
                  <option value="under_review">Under Active Review</option>
                  <option value="completed">Completed / Escalated</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase text-[#987f61] mb-1">Priority Rating</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full bg-[#ffebd0]/30 border border-[#4f3622]/30 p-2 text-sm text-[#2f2116] focus:outline-none"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase text-[#987f61] mb-1">
                Analyst Investigation Notes & Evidence Log
              </label>
              <textarea
                value={analystNotes}
                onChange={(e) => setAnalystNotes(e.target.value)}
                rows={4}
                placeholder="Document your findings, verified beneficial ownership links, or procurement anomalies here..."
                className="w-full bg-[#ffebd0]/20 border border-[#4f3622]/30 p-3 text-sm text-[#2f2116] focus:outline-none font-sans"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="font-mono text-xs text-[#987f61]">
                Stored locally in SQLite: <code className="text-[#2f2116]">medici_investigations.db</code>
              </span>
              <button
                onClick={handleSaveInvestigation}
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] font-serif font-semibold text-sm transition-colors shadow-md"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Persisting...' : 'Save Investigation'}</span>
              </button>
            </div>
          </section>

          {/* Methodology Disclaimer */}
          <footer className="border border-[#4f3622]/20 bg-[#fff8e9]/50 p-4 text-xs text-[#4f3622] leading-relaxed">
            <span className="font-semibold text-[#2f2116]">Auditable Screening Notice: </span>
            {investigation.disclaimer}
          </footer>
        </div>
      ) : null}
    </div>
  )
}
