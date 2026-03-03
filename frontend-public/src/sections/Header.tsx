import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';

const WHATSAPP_URL = 'https://wa.me/5543998468294?text=Ol%C3%A1%2C%20gostaria%20de%20agendar%20uma%20sess%C3%A3o';

const NAV_ITEMS = [
    { label: 'Início', href: '#inicio' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Resultados', href: '#resultados' },
    { label: 'Serviços', href: '#servicos' },
    { label: 'Depoimentos', href: '#depoimentos' },
    { label: 'FAQ', href: '#faq' },
];

export default function Header() {
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 60);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // Lock body scroll when mobile menu open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    return (
        <header
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-navy/92 backdrop-blur-md border-b border-gold/15'
                : 'bg-transparent'
                }`}
        >
            <div className="container-page flex h-20 items-center justify-between">
                {/* Logo */}
                <a href="#inicio" className="flex items-center gap-3 group">
                </a>

                {/* Desktop nav */}
                <nav className="hidden lg:flex items-center gap-8">
                    {NAV_ITEMS.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            className="text-sm font-medium tracking-wide text-text-light/70 transition-colors duration-200 hover:text-gold"
                        >
                            {item.label}
                        </a>
                    ))}
                    <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center justify-center rounded-md border-2 border-gold bg-gold px-8 py-3 text-sm font-semibold tracking-wide text-navy whitespace-nowrap transition-all duration-200 hover:bg-gold-light hover:border-gold-light"
                    >
                        Agendar Sessão
                    </a>
                </nav>

                {/* Mobile hamburger */}
                <button
                    className="lg:hidden p-2 text-text-light/80 hover:text-gold transition-colors"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Menu"
                >
                    {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile menu */}
            <div
                className={`lg:hidden fixed inset-0 top-20 z-40 bg-navy/96 backdrop-blur-lg transition-all duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <nav className="flex flex-col items-center gap-6 pt-12">
                    {NAV_ITEMS.map((item) => (
                        <a
                            key={item.href}
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            className="text-lg font-serif font-medium tracking-wide text-text-light/80 transition-colors duration-200 hover:text-gold"
                        >
                            {item.label}
                        </a>
                    ))}
                    <a
                        href={WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMobileOpen(false)}
                        className="mt-4 inline-flex items-center justify-center rounded-md border-2 border-gold bg-gold px-10 py-3.5 text-base font-semibold tracking-wide text-navy whitespace-nowrap transition-all duration-200 hover:bg-gold-light hover:border-gold-light"
                    >
                        Agendar Sessão
                    </a>
                </nav>
            </div>
        </header>
    );
}
