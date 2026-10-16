
import { useState } from 'react'
import { Menu, X, Scale } from 'lucide-react'

export type MediciPage =
    | 'dashboard'
    | 'tenders'
    | 'network'
    | 'investigations'

interface NavigationProps {
    activePage: MediciPage
    onNavigate: (page: MediciPage) => void
}

const navItems: { id: MediciPage; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'tenders', label: 'Tenders' },
    { id: 'network', label: 'Entity Network' },
    { id: 'investigations', label: 'Investigations' },
]

export function Navigation({
    activePage,
    onNavigate,
}: NavigationProps) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    const navigate = (page: MediciPage) => {
        onNavigate(page)
        setMobileMenuOpen(false)
    }

    return (
        <header className="sticky top-0 z-50 bg-[#2f2116] border-b border-[#4f3622] text-[#ffebd0] shadow-md">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <button
                    onClick={() => navigate('dashboard')}
                    className="flex items-center gap-3 text-left group"
                    aria-label="Go to Medici Web dashboard"
                >
                    <span className="w-10 h-10 flex items-center justify-center rounded-full border border-[#987f61] bg-[#fff8e9]/10 group-hover:border-[#fee197] transition-colors">
                        <Scale className="w-5 h-5 text-[#fee197]" />
                    </span>

                    <span className="flex flex-col">
                        <span className="font-serif text-lg tracking-wider text-[#fff8e9] font-semibold group-hover:text-[#fee197]">
                            MEDICI WEB
                        </span>
                        <span className="text-[10px] tracking-widest text-[#987f61] uppercase font-mono">
                            Public Procurement Intelligence
                        </span>
                    </span>
                </button>

                <nav className="hidden md:flex items-center space-x-1">
                    {navItems.map((item) => {
                        const active = activePage === item.id

                        return (
                            <button
                                key={item.id}
                                onClick={() => navigate(item.id)}
                                aria-current={active ? 'page' : undefined}
                                className={`px-4 py-2 font-serif text-sm tracking-wide transition-all border-b-2 ${active
                                    ? 'border-[#fee197] text-[#fee197] bg-[#fff8e9]/10 font-bold'
                                    : 'border-transparent text-[#ffebd0]/80 hover:text-[#fff8e9] hover:bg-[#fff8e9]/5'
                                    }`}
                            >
                                {item.label}
                            </button>
                        )
                    })}
                </nav>

                <div className="md:hidden">
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 text-[#ffebd0] hover:text-[#fee197]"
                        aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                        aria-expanded={mobileMenuOpen}
                    >
                        {mobileMenuOpen
                            ? <X className="w-6 h-6" />
                            : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {mobileMenuOpen && (
                <nav className="md:hidden bg-[#241911] border-b border-[#4f3622] px-4 py-3 space-y-2 font-serif text-sm">
                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => navigate(item.id)}
                            className={`w-full text-left px-3 py-2.5 rounded transition-colors ${activePage === item.id
                                ? 'bg-[#fee197]/20 text-[#fee197] font-semibold'
                                : 'text-[#ffebd0] hover:bg-[#fff8e9]/10'
                                }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
            )}
        </header>
    )
}
