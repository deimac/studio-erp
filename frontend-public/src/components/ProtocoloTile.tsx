import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ProtocoloResumo } from '@/lib/catalogo';
import { imagemProtocolo, imagemReserva } from '@/lib/media';
import { formatBRL, formatDuracoes } from '@/lib/format';

export default function ProtocoloTile({ p, num, area, seal }: { p: ProtocoloResumo; num?: number; area?: string; seal?: string }) {
    const duracao = formatDuracoes(p.duracoes);
    const prefixo = p.a_partir_de != null ? (p.duracoes.length > 1 ? 'a partir de' : duracao) : duracao;
    const preco = p.a_partir_de != null ? formatBRL(p.a_partir_de) : null;
    const meta = prefixo || preco;
    return (
        <Link className={`tile ${area ?? ''}`} to={`/protocolos/${p.slug}`}>
            <img src={imagemProtocolo(p)} alt="" loading="lazy" onError={imagemReserva} />
            <span className="txt">
                {num != null && <span className="num">{String(num).padStart(2, '0')}</span>}
                <b>{p.nome}</b>
                {p.subtitulo && <small>{p.subtitulo}</small>}
            </span>
            {seal && <span className="seal">{seal}</span>}
            {meta && <span className="meta">{prefixo && <small>{prefixo}</small>}{preco && <b>{preco}</b>}</span>}
            <span className="go" aria-hidden="true"><ArrowRight /></span>
        </Link>
    );
}
