import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function NotFound({ titulo = 'Página não encontrada' }: { titulo?: string }) {
    useEffect(() => { document.title = `${titulo} — Tayna Santos`; }, [titulo]);
    return (
        <section className="nf">
            <span className="mono" aria-hidden="true" />
            <h1>{titulo}</h1>
            <p>O endereço pode ter mudado. Veja os protocolos disponíveis na página inicial.</p>
            <Link className="pill" to="/#protocolos">Ver protocolos<ArrowRight /></Link>
        </section>
    );
}
