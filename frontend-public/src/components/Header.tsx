import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Instagram, Menu, MessageCircle, X } from 'lucide-react';
import Brand from './Brand';
import { useContato, useWhatsapp } from '@/lib/contato';

const LINKS = [
    { to: '/', label: 'Início' },
    { to: '/#protocolos', label: 'Protocolos' },
    { to: '/#resultados', label: 'Resultados' },
    { to: '/#sobre', label: 'Sobre' },
    { to: '/#vale-presente', label: 'Vale-presente' },
    { to: '/#contato', label: 'Contato' },
];

export default function Header() {
    const whatsappUrl = useWhatsapp();
    const { instagramUrl } = useContato();
    const [open, setOpen] = useState(false);
    const { pathname, hash, key } = useLocation();
    const menuRef = useRef<HTMLButtonElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const aberto = useRef(false);
    useEffect(() => setOpen(false), [pathname, hash, key]);
    useEffect(() => {
        if (open) closeRef.current?.focus();
        else if (aberto.current) menuRef.current?.focus({ preventScroll: true });
        aberto.current = open;
    }, [open]);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const ativo = (to: string) => (to === '/' ? pathname === '/' && !hash : `/${hash}` === to || (to === '/#protocolos' && pathname.startsWith('/protocolos')));

    return (
        <header className="nav">
            <Brand />
            <nav className="links" aria-label="Principal">
                {LINKS.map((l) => <Link key={l.to} to={l.to} className={ativo(l.to) ? 'on' : ''}>{l.label}</Link>)}
            </nav>
            <div className="right">
                {instagramUrl && <a className="circle-btn soc" href={instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram"><Instagram /></a>}
                <a className="circle-btn soc" href={whatsappUrl({})} target="_blank" rel="noreferrer" aria-label="WhatsApp"><MessageCircle /></a>
                <a className="pill" href={whatsappUrl({})} target="_blank" rel="noreferrer">Agendar</a>
                <button ref={menuRef} className="circle-btn menu-btn" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
            </div>
            <div className={`drawer${open ? ' open' : ''}`} onClick={() => setOpen(false)} aria-hidden={!open}>
                <div className="panel" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
                    <button ref={closeRef} className="circle-btn close" aria-label="Fechar menu" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}><X /></button>
                    {LINKS.map((l) => <Link key={l.to} className="lk" to={l.to} tabIndex={open ? 0 : -1}>{l.label}</Link>)}
                    <a className="pill" href={whatsappUrl({})} target="_blank" rel="noreferrer" tabIndex={open ? 0 : -1}>Agendar pelo WhatsApp</a>
                </div>
            </div>
        </header>
    );
}
