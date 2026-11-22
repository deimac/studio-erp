import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Volume2, VolumeX } from 'lucide-react';
import { useReveal } from '@/lib/useReveal';
import { whatsappUrl } from '@/lib/whatsapp';

const VIDEOS = [
    { src: '/images/massagem01.mp4', poster: '/images/site/video-01.jpg', chip: 'Modeladora', titulo: 'Método TS', texto: 'Contorno e firmeza' },
    { src: '/images/massagem02.mp4', poster: '/images/site/video-02.jpg', chip: 'Drenagem', titulo: 'Drenagem Linfática', texto: 'Leveza e menos inchaço' },
    { src: '/images/massagem03.mp4', poster: '/images/site/video-03.jpg', chip: 'Resultado', titulo: 'Ao final da sessão', texto: 'Corpo desinchado' },
];

function Reel({ v }: { v: (typeof VIDEOS)[number] }) {
    const ref = useRef<HTMLVideoElement>(null);
    const [on, setOn] = useState(false);
    const [mudo, setMudo] = useState(true);
    useEffect(() => { if (ref.current) ref.current.muted = mudo; }, [mudo]);
    const hover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
    const play = () => { ref.current?.play().then(() => setOn(true), () => setOn(false)); setOn(true); };
    const stop = () => { ref.current?.pause(); setMudo(true); setOn(false); };
    return (
        <figure className={`reel${on ? ' on' : ''}`} tabIndex={0} role="button" aria-label={`Assistir: ${v.titulo}`}
            onMouseEnter={hover ? play : undefined} onMouseLeave={hover ? stop : undefined} onClick={() => (on ? stop() : play())}
            onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); on ? stop() : play(); } }}>
            <video ref={ref} src={v.src} poster={v.poster} muted loop playsInline preload="none" />
            <span className="chip">{v.chip}</span>
            <span className="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z" /></svg></span>
            <button className="snd" aria-label={mudo ? 'Ativar som' : 'Desativar som'} tabIndex={on ? 0 : -1}
                onClick={(e) => { e.stopPropagation(); setMudo((m) => !m); }}>{mudo ? <VolumeX /> : <Volume2 />}</button>
            <figcaption><b>{v.titulo}</b><small>{v.texto}</small></figcaption>
        </figure>
    );
}

export default function Resultados() {
    const ref = useReveal<HTMLElement>();
    return (
        <section className="results reveal" id="resultados" ref={ref}>
            <div className="sh">
                <div><span className="eyebrow">Resultados na prática</span><h2>O cuidado,<br /><em>em movimento.</em></h2></div>
                <p>Trechos reais de atendimentos no estúdio. Passe o mouse ou toque para assistir.</p>
            </div>
            <div className="reels">
                {VIDEOS.map((v) => <Reel key={v.src} v={v} />)}
                <div className="rside">
                    <div><div className="big">+ leveza</div><p>Cada protocolo começa com uma avaliação, para escolher a técnica certa para o seu corpo.</p></div>
                    <div>
                        <a className="pill" href={whatsappUrl({})} target="_blank" rel="noreferrer">Quero agendar<ArrowRight /></a>
                        <p className="fine">Resultados variam de pessoa para pessoa. Os protocolos não substituem acompanhamento médico.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
