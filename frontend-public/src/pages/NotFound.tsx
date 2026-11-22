import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function NotFound({ titulo = 'Página não encontrada', texto = 'O endereço pode ter mudado. Veja os protocolos disponíveis na página inicial.' }: { titulo?: string; texto?: string }) {
    useEffect(() => { document.title = `${titulo} — Tayna Santos`; }, [titulo]);
    return (
        <section className="nf">
            <span className="mono" aria-hidden="true" />
            <h1>{titulo}</h1>
            <p>{texto}</p>
            <Link className="pill" to="/#protocolos">Ver protocolos<ArrowRight /></Link>
        </section>
    );
}
