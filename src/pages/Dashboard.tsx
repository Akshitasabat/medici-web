import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileSearch,
  Network,
  RefreshCw,
  Scale,
  ShieldAlert,
} from 'lucide-react'
import { api } from '../api/client'
import type { MediciPage } from '../components/Navigation'
import type { SummaryMetrics, TenderListItem } from '../types'

interface DashboardProps {
  onNavigate: (page: MediciPage, tenderId?: string, entityId?: string) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const [summary, setSummary] = useState<SummaryMetrics | null>(null)
  const [flaggedTenders, setFlaggedTenders] = useState<TenderListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [sumRes, tendersRes] = await Promise.all([
        api.getSummary(),
        api.getTenders({ flagged_only: true, sort_by: 'flags', sort_order: 'desc', page_size: 5 }),
      ])
      setSummary(sumRes)
      setFlaggedTenders(tendersRes.items)
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Medici Web API')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  return (
    <div className="space-y-12">
      {/* Top Status & Overview Banner */}
      <section className="border-b border-[#4f3622]/40 pb-6 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs tracking-widest text-[#987f61] uppercase">
              Procurement Intelligence // Overview
            </span>
            <span className="text-[#987f61]">//</span>
            {error ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-rose-800 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                API Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Live Engine Connected
              </span>
            )}
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl mt-2 text-[#2f2116]">
            Auditable Procurement Intelligence.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4f3622]">
            Examine public contracts, audit single-bid competitions, test supplier concentration, and trace
            corporate ownership networks using transparent heuristics and graph theory.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 font-mono text-xs border border-[#4f3622]/40 hover:border-[#4f3622] bg-[#fff8e9] px-3 py-2 text-[#2f2116] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Engine</span>
          </button>
          <span className="font-mono text-xs border border-[#4f3622]/40 bg-[#2f2116] text-[#ffebd0] px-3 py-2">
            EVIDENCE SUITE v1.0
          </span>
        </div>
      </section>

      {/* Error Alert */}
      {error && (
        <div className="border border-rose-800/40 bg-rose-50 text-rose-900 p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-serif font-semibold text-sm">Backend Engine Unreachable</p>
              <p className="text-xs text-rose-800 mt-1">
                {error}. Please verify that the FastAPI backend is running via{' '}
                <code className="font-mono bg-rose-100 px-1 py-0.5">
                  .\.venv\Scripts\python.exe -m uvicorn backend.app:app --port 8001
                </code>
                .
              </p>
            </div>
          </div>
          <button
            onClick={loadDashboardData}
            className="border border-rose-800/40 hover:bg-rose-100 px-3 py-1 text-xs font-mono text-rose-900 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary Metrics Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <article className="border border-[#4f3622]/30 bg-[#fff8e9] p-5 relative overflow-hidden group hover:border-[#4f3622] transition-colors">
          <div className="flex justify-between items-start">
            <p className="font-mono text-xs tracking-wider text-[#987f61] uppercase">Tenders Analysed</p>
            <FileSearch className="w-5 h-5 text-[#987f61]" />
          </div>
          <p className="font-serif text-4xl mt-4 text-[#2f2116]">
            {loading ? '...' : summary ? summary.total_tenders.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-[#4f3622]/80 mt-2 font-mono">
            {summary ? `${summary.unique_buyers} contracting authorities` : 'Awaiting dataset connection'}
          </p>
        </article>

        {/* Metric 2 */}
        <article className="border border-[#4f3622]/30 bg-[#fff8e9] p-5 relative overflow-hidden group hover:border-[#4f3622] transition-colors">
          <div className="flex justify-between items-start">
            <p className="font-mono text-xs tracking-wider text-[#987f61] uppercase">Tenders Flagged</p>
            <AlertTriangle className="w-5 h-5 text-[#987f61]" />
          </div>
          <p className="font-serif text-4xl mt-4 text-[#2f2116]">
            {loading ? '...' : summary ? summary.flagged_tenders_count.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-[#4f3622]/80 mt-2 font-mono">
            {summary
              ? `${summary.flagged_tenders_percentage}% triggered >= 1 rule`
              : 'Based on transparent heuristics'}
          </p>
        </article>

        {/* Metric 3 */}
        <article className="border border-[#4f3622]/30 bg-[#fff8e9] p-5 relative overflow-hidden group hover:border-[#4f3622] transition-colors">
          <div className="flex justify-between items-start">
            <p className="font-mono text-xs tracking-wider text-[#987f61] uppercase">Evidence Flags</p>
            <Scale className="w-5 h-5 text-[#987f61]" />
          </div>
          <p className="font-serif text-4xl mt-4 text-[#2f2116]">
            {loading ? '...' : summary ? summary.total_flags_triggered.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-[#4f3622]/80 mt-2 font-mono">
            {summary ? `${Object.keys(summary.rule_breakdown).length} active rule classes` : 'Rule evaluations'}
          </p>
        </article>

        {/* Metric 4 */}
        <article className="border border-[#4f3622]/30 bg-[#fff8e9] p-5 relative overflow-hidden group hover:border-[#4f3622] transition-colors">
          <div className="flex justify-between items-start">
            <p className="font-mono text-xs tracking-wider text-[#987f61] uppercase">Entities Indexed</p>
            <Building2 className="w-5 h-5 text-[#987f61]" />
          </div>
          <p className="font-serif text-4xl mt-4 text-[#2f2116]">
            {loading ? '...' : summary ? summary.entities_indexed.toLocaleString() : '—'}
          </p>
          <p className="text-xs text-[#4f3622]/80 mt-2 font-mono">
            {summary
              ? `${summary.relationships_indexed} edges in NetworkX`
              : 'Ownership & officer network'}
          </p>
        </article>
      </section>

      {/* Rules Breakdown Section */}
      <section className="border border-[#4f3622]/30 bg-[#fff8e9] p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#4f3622]/20 gap-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-[#987f61]">Rule Detection Engine</p>
            <h2 className="font-serif text-2xl mt-1 text-[#2f2116]">Active Procurement Screening Rules</h2>
          </div>
          <span className="font-mono text-xs text-[#987f61]">
            Screening Heuristics // Explainable Evidence
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {summary &&
            Object.entries(summary.rule_breakdown).map(([ruleName, count]) => (
              <div
                key={ruleName}
                className="border border-[#4f3622]/20 p-4 bg-[#ffebd0]/30 hover:bg-[#ffebd0]/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif font-semibold text-sm text-[#2f2116]">{ruleName}</span>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#fee197]/60 text-[#2f2116] border border-[#987f61]/30">
                    {count} records
                  </span>
                </div>
                <p className="text-xs text-[#4f3622]/80 mt-2 leading-relaxed">
                  {ruleName === 'Single Bidder Contract' &&
                    'Identifies tenders where only a single bidder competed, reflecting limited competition.'}
                  {ruleName === 'High Buyer-Winner Concentration' &&
                    'Screening threshold: >=40% of buyer contracts won by the same supplier.'}
                  {ruleName === 'Compressed Bidding Window' &&
                    'Screening threshold: <=7 days between tender publication and deadline.'}
                  {ruleName === 'Newly Incorporated Winner' &&
                    'Screening threshold: supplier registered <=90 days before contract award.'}
                  {ruleName === 'Narrow Cover Bid Margin' &&
                    'Screening threshold: runner-up bid within 3% of the winning tender value.'}
                  {ruleName === 'Statutory Threshold Hugging' &&
                    'Screening threshold: tender value sits between 475,000 CU and 500,000 CU approval limit.'}
                </p>
              </div>
            ))}
        </div>
      </section>

      {/* Highest Priority Flagged Tenders Table */}
      <section className="border border-[#4f3622]/30 bg-[#fff8e9]">
        <div className="p-5 md:p-6 border-b border-[#4f3622]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs tracking-widest text-[#987f61] uppercase">Prioritized Queue</p>
            <h2 className="font-serif text-2xl mt-1 text-[#2f2116]">High Priority Flagged Tenders</h2>
          </div>
          <button
            onClick={() => onNavigate('tenders')}
            className="inline-flex items-center gap-1.5 font-serif text-sm text-[#2f2116] hover:text-[#987f61] font-semibold"
          >
            <span>View All Tenders</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#4f3622]/20 bg-[#ffebd0]/40 font-mono text-xs text-[#987f61]">
                <th className="py-3 px-4">Tender ID</th>
                <th className="py-3 px-4">Buyer</th>
                <th className="py-3 px-4">Winner</th>
                <th className="py-3 px-4 text-right">Value (CU)</th>
                <th className="py-3 px-4 text-center">Bidders</th>
                <th className="py-3 px-4">Triggered Rules</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4f3622]/10">
              {flaggedTenders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#4f3622]/70 font-mono text-xs">
                    {loading ? 'Loading flagged tenders...' : 'No flagged records found.'}
                  </td>
                </tr>
              ) : (
                flaggedTenders.map((t) => (
                  <tr key={t.tender_id} className="hover:bg-[#ffebd0]/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#2f2116]">{t.tender_id}</td>
                    <td className="py-3 px-4 text-[#2f2116] max-w-[200px] truncate" title={t.buyer}>
                      {t.buyer}
                    </td>
                    <td className="py-3 px-4 text-[#4f3622] max-w-[200px] truncate" title={t.winner_name || ''}>
                      {t.winner_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[#2f2116]">
                      {t.value ? t.value.toLocaleString(undefined, { minimumFractionDigits: 0 }) : '—'}
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
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {t.triggered_rules.map((r) => (
                          <span
                            key={r}
                            className="inline-block text-[11px] font-mono px-2 py-0.5 bg-[#fee197]/50 text-[#2f2116] border border-[#987f61]/30"
                          >
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onNavigate('investigations', t.tender_id)}
                        className="inline-flex items-center gap-1 font-serif text-xs px-3 py-1.5 bg-[#2f2116] text-[#fee197] hover:bg-[#4f3622] transition-colors"
                      >
                        <span>Investigate</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Navigation Workspaces Directory */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => onNavigate('tenders')}
          className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 cursor-pointer hover:border-[#4f3622] hover:bg-[#fff8e9]/90 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full border border-[#987f61] bg-[#ffebd0] text-[#2f2116] group-hover:border-[#fee197] transition-colors">
            <FileSearch className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl mt-4 text-[#2f2116] group-hover:text-[#987f61] transition-colors flex items-center justify-between">
            <span>Tender Explorer</span>
            <ArrowRight className="w-4 h-4 text-[#987f61]" />
          </h3>
          <p className="text-xs leading-relaxed text-[#4f3622] mt-2">
            Search 1,500 procurement records by title, buyer, winner, procedure, and red flag categories.
          </p>
        </div>

        <div
          onClick={() => onNavigate('network')}
          className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 cursor-pointer hover:border-[#4f3622] hover:bg-[#fff8e9]/90 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full border border-[#987f61] bg-[#ffebd0] text-[#2f2116] group-hover:border-[#fee197] transition-colors">
            <Network className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl mt-4 text-[#2f2116] group-hover:text-[#987f61] transition-colors flex items-center justify-between">
            <span>Entity Network</span>
            <ArrowRight className="w-4 h-4 text-[#987f61]" />
          </h3>
          <p className="text-xs leading-relaxed text-[#4f3622] mt-2">
            Explore 350 entities and 247 relationships. Traverse multi-hop paths and detect offshore holding hubs.
          </p>
        </div>

        <div
          onClick={() => onNavigate('investigations')}
          className="border border-[#4f3622]/30 bg-[#fff8e9] p-6 cursor-pointer hover:border-[#4f3622] hover:bg-[#fff8e9]/90 transition-all group"
        >
          <div className="w-10 h-10 flex items-center justify-center rounded-full border border-[#987f61] bg-[#ffebd0] text-[#2f2116] group-hover:border-[#fee197] transition-colors">
            <Scale className="w-5 h-5" />
          </div>
          <h3 className="font-serif text-xl mt-4 text-[#2f2116] group-hover:text-[#987f61] transition-colors flex items-center justify-between">
            <span>Investigation Workspace</span>
            <ArrowRight className="w-4 h-4 text-[#987f61]" />
          </h3>
          <p className="text-xs leading-relaxed text-[#4f3622] mt-2">
            Deep dive into specific tenders, examine auditable evidence, and record persistent analyst findings.
          </p>
        </div>
      </section>

      {/* Methodology Disclaimer Card */}
      <footer className="border border-[#4f3622]/20 bg-[#fff8e9]/50 p-5 text-xs text-[#4f3622] leading-relaxed flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-[#987f61] shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-[#2f2116]">Investigative Methodology & Disclaimer</p>
          <p className="mt-1">
            Flags identify records for further review. They are screening heuristics and not proof of misconduct
            or corruption. Limited competition, repeated awards, or short submission periods may result from
            legitimate market constraints or specialized requirements. Always verify findings against official
            source documentation.
          </p>
        </div>
      </footer>
    </div>
  )
}
