import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

const VIDEOS = [
    {
        src: '/images/massagem01.mp4',
        poster: '/images/resultado_1_thumb.jpg',
        label: 'Massagem Modeladora',
    },
    {
        src: '/images/massagem02.mp4',
        poster: '/images/resultado_2_thumb.jpg',
        label: 'Drenagem Linfática',
    },
    {
        src: '/images/massagem03.mp4',
        poster: '/images/resultado_3_thumb.jpg',
        label: 'Massagem Modeladora',
    },
];

function ReelCard({ src, poster, label }: { src: string; poster: string; label: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(true);

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
            v.play();
            setPlaying(true);
        } else {
            v.pause();
            setPlaying(false);
        }
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
        setMuted(v.muted);
    };

    return (
        <div className="reel-card" onClick={togglePlay}>
            <video
                ref={videoRef}
                src={src}
                poster={poster}
                muted
                playsInline
                loop
                preload="metadata"
                className="reel-video"
            />

            {/* Gradiente inferior */}
            <div className="reel-gradient" />

            {/* Label */}
            <p className="reel-label">{label}</p>

            {/* Botão mute */}
            <button className="reel-mute-btn" onClick={toggleMute} aria-label="Mudo">
                {muted
                    ? <VolumeX style={{ width: '16px', height: '16px' }} />
                    : <Volume2 style={{ width: '16px', height: '16px' }} />
                }
            </button>

            {/* Botão play central (visível quando pausado) */}
            {!playing && (
                <div className="reel-play-overlay">
                    <div className="reel-play-btn">
                        <Play style={{ width: '28px', height: '28px', marginLeft: '3px' }} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default function Resultados() {
    return (
        <section id="resultados" className="relative section-pad bg-section-navy">
            <div className="container-page">

                {/* Cabeçalho */}
                <div className="reel-header animate-fade-in-up">
                    <p className="eyebrow text-gold-accent mb-4">Na prática</p>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-text-light">
                        Veja os resultados
                    </h2>
                    <p className="reel-subtitle">
                        Momentos reais de cuidado e transformação no estúdio
                    </p>
                </div>

                {/* Separador */}
                <div className="hairline-section-wrap">
                    <div className="hairline-gold" />
                </div>

                {/* Grid de reels */}
                <div className="reel-grid">
                    {VIDEOS.map((v, i) => (
                        <ReelCard key={i} {...v} />
                    ))}
                </div>

            </div>
        </section>
    );
}
