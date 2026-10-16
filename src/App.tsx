import { useState } from 'react'
import { Navigation, type MediciPage } from './components/Navigation'
import Dashboard from './pages/Dashboard'
import Investigations from './pages/Investigations'
import Landing from './pages/Landing'
import Network from './pages/Network'
import Tenders from './pages/Tenders'

export default function App() {
  const [activePage, setActivePage] = useState<MediciPage>('dashboard')
  const [targetTenderId, setTargetTenderId] = useState<string>('T00502')
  const [targetEntityId, setTargetEntityId] = useState<string>('C091')

  const handleNavigate = (page: MediciPage, tenderId?: string, entityId?: string) => {
    if (tenderId) {
      setTargetTenderId(tenderId)
    }
    if (entityId) {
      setTargetEntityId(entityId)
    }
    setActivePage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#ffebd0] text-[#2f2116] flex flex-col selection:bg-[#fee197] selection:text-[#2f2116]">
      {/* Sticky Renaissance Header */}
      <Navigation activePage={activePage} onNavigate={handleNavigate} />

      {/* Cinematic Hero on Entry / Dashboard Page */}
      {activePage === 'dashboard' && <Landing onNavigate={handleNavigate} />}

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 md:p-10">
        {activePage === 'dashboard' && <Dashboard onNavigate={handleNavigate} />}

        {activePage === 'tenders' && <Tenders onNavigate={handleNavigate} />}

        {activePage === 'network' && (
          <Network initialEntityId={targetEntityId} onNavigate={handleNavigate} />
        )}

        {activePage === 'investigations' && (
          <Investigations initialTenderId={targetTenderId} onNavigate={handleNavigate} />
        )}
      </main>

      {/* Renaissance Footer */}
      <footer className="border-t border-[#4f3622] bg-[#241911] text-[#ffebd0]/80 py-8 px-6 text-center font-mono text-xs space-y-2">
        <div className="flex flex-wrap items-center justify-center gap-4 text-[#fee197]/90">
          <span>MEDICI WEB</span>
          <span>//</span>
          <span>EVIDENCE-LED PROCUREMENT INVESTIGATION</span>
          <span>//</span>
          <span>RENAISSANCE ARCHITECTURAL SUITE</span>
        </div>
        <p className="text-[11px] text-[#ffebd0]/50 max-w-2xl mx-auto">
          Flags identify records for further review. They are screening heuristics and not proof of misconduct
          or corruption. Powered by transparent heuristics, NetworkX graph intelligence, and SQLite persistence.
        </p>
      </footer>
    </div>
  )
}
