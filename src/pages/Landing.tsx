import { useState } from 'react'
import { ArrowRight, ChevronDown, Compass } from 'lucide-react'
import type { MediciPage } from '../components/Navigation'

interface LandingProps {
  onNavigate: (page: MediciPage) => void
}

export default function Landing({ onNavigate }: LandingProps) {
  const [videoError, setVideoError] = useState(false)

  return (
    <section className="relative min-h-[75vh] md:min-h-[82vh] overflow-hidden bg-[#2f2116] text-[#ffebd0] border-b border-[#4f3622]">
      {/* Video Background or Fallback */}
      {!videoError ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          src="/assets/rse/landing.mp4"
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoError(true)}
          aria-hidden="true"
        />
      ) : (
        <div
          className="absolute inset-0 bg-cad-grid-dark bg-[#241911] opacity-70"
          aria-hidden="true"
        />
      )}

      {/* Renaissance Dark Walnut Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#2f2116] via-[#2f2116]/80 to-[#2f2116]/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#2f2116] via-transparent to-black/20" />

      {/* Hero Content */}
      <div className="relative z-10 flex min-h-[75vh] md:min-h-[82vh] max-w-[1400px] mx-auto flex-col justify-center px-6 py-16 md:px-12">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 border border-[#987f61]/40 bg-[#fff8e9]/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.25em] text-[#fee197]">
            <Compass className="w-3.5 h-3.5 text-[#fee197]" />
            <span>Public Procurement Intelligence</span>
          </div>

          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl leading-[1.08] tracking-tight text-[#fff8e9]">
            Follow the money.
            <br />
            <span className="text-[#fee197] italic font-normal">Trace the connections.</span>
          </h1>

          <p className="max-w-xl text-base sm:text-lg leading-relaxed text-[#ffebd0]/85 font-sans">
            Explore public tenders, uncover unusual procurement patterns, and investigate documented
            relationships between entities across corporate registries and contracting authorities.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-4">
            <button
              onClick={() => onNavigate('investigations')}
              className="inline-flex items-center gap-2 bg-[#fee197] text-[#2f2116] hover:bg-[#ffeec2] px-6 py-3 font-serif font-semibold text-sm tracking-wide shadow-md hover:shadow-lg transition-all"
            >
              <span>Start an investigation</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('tenders')}
              className="inline-flex items-center gap-2 border border-[#987f61] text-[#ffebd0] hover:text-[#fee197] hover:border-[#fee197] hover:bg-[#fff8e9]/5 px-6 py-3 font-serif text-sm tracking-wide transition-all"
            >
              <span>Explore tenders</span>
            </button>
          </div>

          <div className="pt-6 flex items-center gap-6 text-xs text-[#987f61] font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Evidence Engine
            </span>
            <span>//</span>
            <span>1,500 Tenders Indexed</span>
            <span>//</span>
            <span>NetworkX Graph Traversal</span>
          </div>
        </div>

        {/* Restrained Scroll Cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1 text-[#987f61] opacity-75 hover:opacity-100 transition-opacity">
          <span className="font-mono text-[10px] uppercase tracking-widest">Explore System</span>
          <ChevronDown className="w-4 h-4 animate-bounce" />
        </div>
      </div>
    </section>
  )
}
