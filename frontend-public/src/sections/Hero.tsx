import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ProtocoloResumo, SiteConfig } from '@/lib/catalogo';
import { iconeProtocolo } from '@/lib/icons';
import { imagemProtocolo, imagemReserva, resolveImageUrl } from '@/lib/media';
import { formatDuracoes } from '@/lib/format';

export default function Hero({ protocolos, config }: { protocolos?: ProtocoloResumo[]; config: SiteConfig }) {
    const [l1, ...resto] = (config.hero_titulo || 'Seu bem-estar\ncomeça aqui.').split(/\n|\|/);
    const destaque = (protocolos ?? []).slice(0, 3);
    const heroImg = resolveImageUrl(config.hero_imagem_url) || '/images/site/hero.jpg?v=3';

    return (
        <section className="hero">
            <div>
                <h1>{l1.trim()}{resto.length > 0 && <span>{resto.join(' ').trim()}</span>}</h1>
                <p className="lead">{config.hero_subtitulo || 'Massoterapia e estética em Maringá, com protocolos personalizados para leveza, alívio e relaxamento profundo.'}</p>
                <div className="classes">
                    <div className="h"><b>Protocolos em destaque</b>{protocolos && <span className="tag">{protocolos.length} opções</span>}</div>
                    {!protocolos && [0, 1, 2].map((i) => <div key={i} className="row"><span className="ico skel" /><span className="skel" style={{ height: 14, borderRadius: 8 }} /></div>)}
                    {destaque.map((p) => {
                        const Icone = iconeProtocolo(p.icone);
                        return (
                            <Link key={p.id} className="row" to={`/protocolos/${p.slug}`}>
                                <span className="ico"><Icone /></span>
                                <span><b>{p.nome}</b>{p.subtitulo && <small>{p.subtitulo}</small>}</span>
                                <span className="min">{formatDuracoes(p.duracoes)}</span>
                                <span className="circle-btn" aria-hidden="true"><ArrowRight /></span>
                                <span className="peek" aria-hidden="true"><img src={imagemProtocolo(p)} alt="" loading="lazy" onError={imagemReserva} /></span>
                            </Link>
                        );
                    })}
                    <Link className="all" to="/#protocolos">Ver todos os protocolos</Link>
                </div>
            </div>
            <div className="visual">
                <img src={heroImg} alt="Massagem corporal com óleo aquecido" fetchPriority="high" />
                <p className="hero-quote">Em meio à correria da vida, <em>abrace um momento de tranquilidade.</em></p>
            </div>
        </section>
    );
}
