import { useEffect, useState } from 'react'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  RefreshCw,
  Search,
  X,
} from 'lucide-react'
import { api } from '../api/client'
import type { MediciPage } from '../components/Navigation'
import type { TenderDetail, TenderListItem } from '../types'

interface TendersPageProps {
  onNavigate: (page: MediciPage, tenderId?: string, entityId?: string) => void
}

export default function Tenders({ onNavigate }: TendersPageProps) {
  const [tenders, setTenders] = useState<TenderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // Filters
  const [search, setSearch] = useState('')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [category, setCategory] = useState('all')
  const [procedure, setProcedure] = useState('all')
  const [sortBy, setSortBy] = useState('tender_id')
  const [sortOrder, setSortOrder] = useState('asc')

  // Loading & State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selected Tender Detail Slideover/Modal
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null)
  const [selectedTender, setSelectedTender] = useState<TenderDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchTendersList = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getTenders({
        search: search.trim(),
        category: category !== 'all' ? category : undefined,
        procedure: procedure !== 'all' ? procedure : undefined,
        flagged_only: flaggedOnly,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        page_size: pageSize,
      })
      setTenders(res.items)
      setTotal(res.total)
      setTotalPages(res.total_pages)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tenders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTendersList()
  }, [page, flaggedOnly, category, procedure, sortBy, sortOrder])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchTendersList()
  }

  const handleSortToggle = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const openDetail = async (tenderId: string) => {
    setSelectedTenderId(tenderId)
    setDetailLoading(true)
    try {
      const detail = await api.getTender(tenderId)
      setSelectedTender(detail)
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setSelectedTenderId(null)
    setSelectedTender(null)
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <section className="border-b border-[#4f3622]/40 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-widest text-[#987f61] uppercase">
            Procurement Explorer // Tender Repository
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mt-2 text-[#2f2116]">
            Public Tender Audits.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4f3622]">
            Search and inspect 1,500 public procurement contracts. Filter by screening red flags, examine bidder
            competition, and audit single-bid or repeat-winner concentration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setPage(1)
              fetchTendersList()
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 font-mono text-xs border border-[#4f3622]/40 hover:border-[#4f3622] bg-[#fff8e9] px-3 py-2 text-[#2f2116] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <span className="font-mono text-xs border border-[#4f3622]/40 bg-[#fff8e9] px-3 py-2 text-[#2f2116]">
            {total} Tenders Matched
          </span>
        </div>
      </section>

      {/* Search and Filters Bar */}
      <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-4 sm:p-5 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#987f61] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by tender ID (e.g. T00502), title, buyer name, or supplier..."
              className="w-full bg-[#ffebd0]/30 border border-[#4f3622]/30 pl-9 pr-4 py-2 text-sm text-[#2f2116] placeholder-[#987f61]/70 focus:outline-none focus:border-[#4f3622]"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] font-serif text-sm font-semibold transition-colors shrink-0"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
              className="px-3 py-2 border border-[#4f3622]/30 text-xs font-mono text-[#4f3622] hover:bg-[#ffebd0]"
            >
              Clear
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#4f3622]/15 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Flagged Switch */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={flaggedOnly}
                onChange={(e) => {
                  setFlaggedOnly(e.target.checked)
                  setPage(1)
                }}
                className="rounded border-[#4f3622] text-[#2f2116] focus:ring-0"
              />
              <span
                className={`font-mono text-xs px-2 py-0.5 border ${
                  flaggedOnly
                    ? 'bg-[#fee197] text-[#2f2116] border-[#4f3622] font-bold'
                    : 'bg-[#ffebd0]/40 text-[#4f3622] border-[#4f3622]/30'
                }`}
              >
                Only Flagged Records
              </span>
            </label>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-[#987f61]">Category:</span>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value)
                  setPage(1)
                }}
                className="bg-[#ffebd0]/30 border border-[#4f3622]/30 px-2 py-1 text-xs text-[#2f2116] focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="roads">Roads</option>
                <option value="school_buildings">School Buildings</option>
                <option value="waste">Waste</option>
                <option value="health_supplies">Health Supplies</option>
                <option value="it_services">IT Services</option>
                <option value="water">Water</option>
                <option value="specialised_lab_equipment">Specialised Lab Equipment</option>
              </select>
            </div>

            {/* Procedure Filter */}
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-[#987f61]">Procedure:</span>
              <select
                value={procedure}
                onChange={(e) => {
                  setProcedure(e.target.value)
                  setPage(1)
                }}
                className="bg-[#ffebd0]/30 border border-[#4f3622]/30 px-2 py-1 text-xs text-[#2f2116] focus:outline-none"
              >
                <option value="all">All Procedures</option>
                <option value="open">Open</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-mono text-[#987f61]">
            Showing page {page} of {totalPages} ({total} records)
          </div>
        </div>
      </section>

      {/* Error Banner */}
      {error && (
        <div className="border border-rose-800/40 bg-rose-50 text-rose-900 p-4 text-xs font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchTendersList} className="underline hover:no-underline">
            Retry
          </button>
        </div>
      )}

      {/* Tenders Table */}
      <section className="border border-[#4f3622]/30 bg-[#fff8e9] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#4f3622]/20 bg-[#ffebd0]/50 font-mono text-xs text-[#987f61]">
                <th
                  onClick={() => handleSortToggle('tender_id')}
                  className="py-3 px-4 cursor-pointer hover:text-[#2f2116] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>ID</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Buyer / Title</th>
                <th className="py-3 px-4">Winner</th>
                <th
                  onClick={() => handleSortToggle('value')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-[#2f2116] select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Value (CU)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('n_bidders')}
                  className="py-3 px-4 text-center cursor-pointer hover:text-[#2f2116] select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Bidders</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('date')}
                  className="py-3 px-4 cursor-pointer hover:text-[#2f2116] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Award Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSortToggle('flags')}
                  className="py-3 px-4 cursor-pointer hover:text-[#2f2116] select-none"
                >
                  <div className="flex items-center gap-1">
                    <span>Red Flags</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4f3622]/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#4f3622]/70 font-mono text-xs">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#987f61]" />
                    Loading tender records from repository...
                  </td>
                </tr>
              ) : tenders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#4f3622]/70 font-mono text-xs">
                    No matching tender records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                tenders.map((t) => (
                  <tr key={t.tender_id} className="hover:bg-[#ffebd0]/35 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#2f2116]">{t.tender_id}</td>
                    <td className="py-3 px-4">
                      <div className="font-serif font-semibold text-[#2f2116] max-w-[260px] truncate">
                        {t.title}
                      </div>
                      <div className="text-xs text-[#987f61] max-w-[260px] truncate">{t.buyer}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-sans text-xs text-[#2f2116] max-w-[200px] truncate block">
                        {t.winner_name || '—'}
                      </span>
                      {t.winner_company_id && (
                        <span className="font-mono text-[11px] text-[#987f61]">({t.winner_company_id})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-[#2f2116]">
                      {t.value !== null && t.value !== undefined
                        ? t.value.toLocaleString(undefined, { minimumFractionDigits: 0 })
                        : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold ${
                          t.n_bidders === 1
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'text-[#4f3622]'
                        }`}
                      >
                        {t.n_bidders ?? '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#4f3622]">{t.award_date || '—'}</td>
                    <td className="py-3 px-4">
                      {t.flag_count > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {t.triggered_rules.map((r) => (
                            <span
                              key={r}
                              className="inline-block text-[10px] font-mono px-1.5 py-0.5 bg-[#fee197]/60 text-[#2f2116] border border-[#987f61]/30 font-medium"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="font-mono text-[11px] text-[#987f61]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetail(t.tender_id)}
                          className="p-1.5 text-[#4f3622] hover:text-[#2f2116] hover:bg-[#ffebd0] border border-transparent hover:border-[#4f3622]/30 transition-colors"
                          title="Quick View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onNavigate('investigations', t.tender_id)}
                          className="px-2.5 py-1 text-xs font-serif font-semibold bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] transition-colors"
                          title="Open Full Investigation"
                        >
                          Investigate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-[#4f3622]/20 bg-[#ffebd0]/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          <div className="text-[#987f61]">
            Page {page} of {totalPages} // Total: {total} records
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#4f3622]/30 bg-[#fff8e9] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ffebd0] transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-[#4f3622]/30 bg-[#fff8e9] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#ffebd0] transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>

      {/* Tender Detail Slideover Modal */}
      {selectedTenderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#fff8e9] border border-[#4f3622] shadow-2xl p-6 sm:p-8 space-y-6">
            <button
              onClick={closeDetail}
              className="absolute top-5 right-5 p-1.5 text-[#4f3622] hover:text-[#2f2116] hover:bg-[#ffebd0] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {detailLoading || !selectedTender ? (
              <div className="py-16 text-center font-mono text-sm text-[#987f61]">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                Loading detailed tender audit...
              </div>
            ) : (
              <>
                <div className="border-b border-[#4f3622]/30 pb-4 pr-10">
                  <div className="flex items-center gap-2 font-mono text-xs text-[#987f61]">
                    <span>TENDER AUDIT // {selectedTender.tender_id}</span>
                    <span>//</span>
                    <span className="uppercase">{selectedTender.category}</span>
                  </div>
                  <h2 className="font-serif text-2xl sm:text-3xl mt-2 text-[#2f2116]">
                    {selectedTender.title}
                  </h2>
                  <p className="text-xs text-[#4f3622] mt-1">{selectedTender.buyer}</p>
                </div>

                {/* Key Audit Attributes */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                    <span className="text-[#987f61] block text-[10px] uppercase">Award Value</span>
                    <span className="text-base font-bold text-[#2f2116]">
                      {selectedTender.value
                        ? `${selectedTender.value.toLocaleString()} ${selectedTender.currency}`
                        : '—'}
                    </span>
                  </div>
                  <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                    <span className="text-[#987f61] block text-[10px] uppercase">Bidders</span>
                    <span className="text-base font-bold text-[#2f2116]">
                      {selectedTender.n_bidders ?? '—'}
                    </span>
                  </div>
                  <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                    <span className="text-[#987f61] block text-[10px] uppercase">Bidding Window</span>
                    <span className="text-base font-bold text-[#2f2116]">
                      {selectedTender.bidding_window_days !== null
                        ? `${selectedTender.bidding_window_days} days`
                        : '—'}
                    </span>
                  </div>
                  <div className="border border-[#4f3622]/20 p-3 bg-[#ffebd0]/30">
                    <span className="text-[#987f61] block text-[10px] uppercase">Winner Age at Award</span>
                    <span className="text-base font-bold text-[#2f2116]">
                      {selectedTender.winner_age_at_award_days !== null
                        ? `${selectedTender.winner_age_at_award_days} days`
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Dates & Timeline */}
                <div className="border border-[#4f3622]/20 p-4 bg-[#ffebd0]/20 space-y-2 text-xs">
                  <span className="font-mono text-[10px] uppercase text-[#987f61] tracking-wider block">
                    Procurement Timeline
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono">
                    <div>
                      <span className="text-[#987f61]">Published:</span> {selectedTender.publish_date || '—'}
                    </div>
                    <div>
                      <span className="text-[#987f61]">Deadline:</span> {selectedTender.deadline || '—'}
                    </div>
                    <div>
                      <span className="text-[#987f61]">Awarded:</span> {selectedTender.award_date || '—'}
                    </div>
                  </div>
                </div>

                {/* Second Bid / Runner Up */}
                {selectedTender.second_bid_value && selectedTender.value && (
                  <div className="border border-[#4f3622]/20 p-4 bg-[#ffebd0]/20 text-xs">
                    <span className="font-mono text-[10px] uppercase text-[#987f61] tracking-wider block">
                      Runner-up Comparison
                    </span>
                    <p className="mt-1 font-mono text-[#2f2116]">
                      Second Bid:{' '}
                      <span className="font-bold">
                        {selectedTender.second_bid_value.toLocaleString()} {selectedTender.currency}
                      </span>{' '}
                      (Margin:{' '}
                      {(
                        ((selectedTender.second_bid_value - selectedTender.value) / selectedTender.value) *
                        100
                      ).toFixed(2)}
                      %)
                    </p>
                  </div>
                )}

                {/* Bidders Recorded */}
                <div className="border border-[#4f3622]/20 p-4 bg-[#ffebd0]/20 space-y-2">
                  <span className="font-mono text-[10px] uppercase text-[#987f61] tracking-wider block">
                    Recorded Participating Bidders ({selectedTender.bidder_names.length})
                  </span>
                  <ul className="divide-y divide-[#4f3622]/10 text-xs font-mono">
                    {selectedTender.bidder_names.map((name, idx) => {
                      const bid = selectedTender.bidder_ids[idx]
                      const isWinner = bid === selectedTender.winner_company_id
                      return (
                        <li key={idx} className="py-1.5 flex items-center justify-between">
                          <span className={isWinner ? 'font-bold text-[#2f2116]' : 'text-[#4f3622]'}>
                            {name} {isWinner && <span className="text-amber-800">[WINNER]</span>}
                          </span>
                          <span className="text-[#987f61]">{bid}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>

                {/* Triggered Red Flags with Exact Evidence */}
                <div className="space-y-3">
                  <span className="font-mono text-xs uppercase tracking-wider text-[#987f61] block">
                    Triggered Red Flags & Auditable Evidence ({selectedTender.flags.length})
                  </span>
                  {selectedTender.flags.length === 0 ? (
                    <p className="text-xs text-emerald-800 font-mono">
                      No red flags triggered for this contract under current screening thresholds.
                    </p>
                  ) : (
                    selectedTender.flags.map((flag) => (
                      <div
                        key={flag.rule_id}
                        className="border border-[#4f3622]/30 p-4 bg-[#fee197]/25 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-serif font-bold text-sm text-[#2f2116]">{flag.rule_name}</span>
                          <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-[#2f2116] text-[#fee197]">
                            {flag.rule_id}
                          </span>
                        </div>
                        <p className="text-[#2f2116] leading-relaxed">{flag.explanation}</p>
                        <div className="bg-[#ffebd0]/70 p-2 font-mono text-[11px] text-[#4f3622] border border-[#4f3622]/20">
                          <span className="font-bold block text-[10px] text-[#987f61] uppercase">
                            Recorded Evidence Values:
                          </span>
                          <pre className="whitespace-pre-wrap mt-1">
                            {JSON.stringify(flag.evidence, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-[#4f3622]/30 flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={closeDetail}
                    className="px-4 py-2 border border-[#4f3622]/40 text-xs font-mono text-[#2f2116] hover:bg-[#ffebd0]"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      closeDetail()
                      onNavigate('investigations', selectedTender.tender_id)
                    }}
                    className="px-6 py-2 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] font-serif font-semibold text-sm inline-flex items-center gap-2 shadow-md transition-all"
                  >
                    <span>Open in Investigation Workspace</span>
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
