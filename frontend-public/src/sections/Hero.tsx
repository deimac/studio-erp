import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Search, X } from 'lucide-react';
import type { ProtocoloResumo, SiteConfig } from '@/lib/catalogo';
import { iconeProtocolo } from '@/lib/icons';
import { imagemProtocolo, resolveImageUrl } from '@/lib/media';
import { formatDuracoes } from '@/lib/format';
import { whatsappUrl } from '@/lib/whatsapp';

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Busca({ protocolos }: { protocolos: ProtocoloResumo[] }) {
    const [q, setQ] = useState('');
    const [aberto, setAberto] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const achados = useMemo(() => {
        const t = sem(q.trim());
        if (!t) return [];
        return protocolos.filter((p) => sem(`${p.nome} ${p.subtitulo ?? ''}`).includes(t)).slice(0, 5);
    }, [q, protocolos]);

    return (
        <div className="glass search" ref={ref} onBlur={(e) => !ref.current?.contains(e.relatedTarget as Node) && setAberto(false)}>
            <label className="field">
                <Search aria-hidden="true" />
                <span className="sr-only">Buscar protocolo</span>
                <input
                    value={q}
                    onChange={(e) => { setQ(e.target.value); setAberto(true); }}
                    onFocus={() => setAberto(true)}
                    placeholder="Buscar protocolo, técnica ou região…"
                    autoComplete="off"
                />
                {q && <button type="button" aria-label="Limpar busca" onClick={() => setQ('')}><X /></button>}
            </label>
            {aberto && q.trim() && (
                <div className="results-list" role="listbox">
                    {achados.length ? achados.map((p) => {
                        const Icone = iconeProtocolo(p.icone);
                        return <Link key={p.id} to={`/protocolos/${p.slug}`}><Icone />{p.nome}</Link>;
                    }) : <span className="empty">Nada encontrado. Que tal perguntar pelo WhatsApp?</span>}
                </div>
            )}
        </div>
    );
}

export default function Hero({ protocolos, config }: { protocolos?: ProtocoloResumo[]; config: SiteConfig }) {
    const [l1, ...resto] = (config.hero_titulo || 'Seu bem-estar\ncomeça aqui.').split(/\n|\|/);
    const destaque = (protocolos ?? []).slice(0, 4);
    const heroImg = resolveImageUrl(config.hero_imagem_url) || '/images/site/hero.jpg';

    return (
        <section className="hero">
            <div>
                <h1>{l1.trim()}{resto.length > 0 && <span>{resto.join(' ').trim()}</span>}</h1>
                <p className="lead">{config.hero_subtitulo || 'Massoterapia e estética em Maringá, com protocolos personalizados para leveza, alívio e relaxamento profundo.'}</p>
                <div className="classes">
                    <div className="h"><b>Protocolos em destaque</b>{protocolos && <span className="tag">{protocolos.length} opções</span>}</div>
                    {!protocolos && [0, 1, 2, 3].map((i) => <div key={i} className="row"><span className="ico skel" /><span className="skel" style={{ height: 14, borderRadius: 8 }} /></div>)}
                    {destaque.map((p) => {
                        const Icone = iconeProtocolo(p.icone);
                        return (
                            <Link key={p.id} className="row" to={`/protocolos/${p.slug}`}>
                                <span className="ico"><Icone /></span>
                                <span><b>{p.nome}</b>{p.subtitulo && <small>{p.subtitulo}</small>}</span>
                                <span className="min">{formatDuracoes(p.duracoes)}</span>
                                <span className="circle-btn" aria-hidden="true"><ArrowRight /></span>
                                <span className="peek" aria-hidden="true"><img src={imagemProtocolo(p)} alt="" loading="lazy" /></span>
                            </Link>
                        );
                    })}
                    <Link className="all" to="/#protocolos">Ver todos os protocolos</Link>
                </div>
            </div>
            <div className="visual">
                <img src={heroImg} alt="Massagem corporal com óleo aquecido" fetchPriority="high" />
                {protocolos && protocolos.length > 0 && <Busca protocolos={protocolos} />}
                <a className="glass book" href={whatsappUrl({})} target="_blank" rel="noreferrer"><span className="i"><CalendarDays /></span>Agendar sessão</a>
            </div>
        </section>
    );
}
