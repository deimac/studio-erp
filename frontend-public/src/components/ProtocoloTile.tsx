import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ProtocoloResumo } from '@/lib/catalogo';
import { imagemProtocolo } from '@/lib/media';
import { formatBRL, formatDuracoes } from '@/lib/format';

export default function ProtocoloTile({ p, num, area, seal }: { p: ProtocoloResumo; num?: number; area?: string; seal?: string }) {
    const duracao = formatDuracoes(p.duracoes);
    const meta = p.a_partir_de != null
        ? (p.duracoes.length > 1 ? `a partir de ${formatBRL(p.a_partir_de)}` : [duracao, formatBRL(p.a_partir_de)].filter(Boolean).join(' · '))
        : duracao;
    return (
        <Link className={`tile ${area ?? ''}`} to={`/protocolos/${p.slug}`}>
            <img src={imagemProtocolo(p)} alt="" loading="lazy" />
            <span className="txt">
                {num != null && <span className="num">{String(num).padStart(2, '0')}</span>}
                <b>{p.nome}</b>
                {p.subtitulo && <small>{p.subtitulo}</small>}
            </span>
            {seal && <span className="seal">{seal}</span>}
            {meta && <span className="meta">{meta}</span>}
            <span className="go" aria-hidden="true"><ArrowRight /></span>
        </Link>
    );
}
