import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { ProtocoloResumo } from '@/lib/catalogo';
import { useReveal } from '@/lib/useReveal';
import { formatDuracoes } from '@/lib/format';
import { imagemProtocolo } from '@/lib/media';
import { whatsappUrl } from '@/lib/whatsapp';

// Depoimentos ILUSTRATIVOS — substituir por depoimentos reais (ver PRODUCT.md).
const DEPOIMENTOS = [
    { texto: 'Saí completamente renovada, sem aquela tensão que carregava há meses. Um cuidado em cada detalhe.', autor: 'Cliente do Método TS' },
    { texto: 'Fiz a drenagem e me senti muito mais leve já na primeira sessão. O ambiente é lindo e acolhedor.', autor: 'Cliente da Drenagem Linfática' },
    { texto: 'Ganhei o Ritual de Pausa de presente e foi a melhor tarde do mês. Saí outra pessoa.', autor: 'Cliente do Ritual de Pausa' },
];

export default function ValePresente({ protocolo }: { protocolo?: ProtocoloResumo }) {
    const ref = useReveal<HTMLElement>();
    const [i, setI] = useState(0);
    const d = DEPOIMENTOS[i];
    const mover = (n: number) => setI((i + n + DEPOIMENTOS.length) % DEPOIMENTOS.length);
    return (
        <section className="offer reveal" id="vale-presente" ref={ref}>
            <div>
                <span className="eyebrow">Vale-presente</span>
                <h2>Presenteie com uma<br /><em>pausa de verdade</em></h2>
                <ul className="checks">
                    {protocolo && <li><i><Check /></i>{protocolo.nome}{protocolo.duracoes.length ? ` · ${formatDuracoes(protocolo.duracoes)}` : ''}</li>}
                    <li><i><Check /></i>Chá, escalda-pés e massagens</li>
                    <li><i><Check /></i>Vale enviado pelo WhatsApp</li>
                </ul>
                <a className="pill" href={whatsappUrl({ protocolo: protocolo?.nome, valePresente: true })} target="_blank" rel="noreferrer">Quero presentear<ArrowRight /></a>
            </div>
            <div className="portrait"><img src={protocolo?.imagem_url ? imagemProtocolo(protocolo) : '/images/site/vale-presente.jpg'} alt="" loading="lazy" /></div>
            <figure className="quote" aria-live="polite">
                <span className="illus">depoimento ilustrativo</span>
                <div className="q" aria-hidden="true">“</div>
                <p>{d.texto}</p>
                <small>— {d.autor}</small>
                <span className="arrows">
                    <button className="circle-btn" aria-label="Depoimento anterior" onClick={() => mover(-1)}><ArrowLeft /></button>
                    <button className="circle-btn" aria-label="Próximo depoimento" onClick={() => mover(1)}><ArrowRight /></button>
                </span>
            </figure>
        </section>
    );
}
