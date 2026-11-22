import { MessageCircle } from 'lucide-react';
import type { ProtocoloResumo } from '@/lib/catalogo';
import ProtocoloTile from '@/components/ProtocoloTile';
import { useReveal } from '@/lib/useReveal';
import { whatsappUrl } from '@/lib/whatsapp';

const AREAS = ['ta', 'tb', 'tc', 'td', 'te', 'tf'];

export default function Protocolos({ protocolos }: { protocolos?: ProtocoloResumo[] }) {
    const ref = useReveal<HTMLElement>();
    const lista = protocolos ?? [];
    const bento = lista.length === 6; // layout editorial só fecha com 6; senão grade regular
    return (
        <section className="services reveal" id="protocolos" ref={ref}>
            <div className="sh">
                <div><span className="eyebrow">O que oferecemos</span><h2>Massoterapia &amp; Estética<br /><em>nossos protocolos</em></h2></div>
                <p>Protocolos pensados para cada necessidade do seu corpo, do alívio de tensões ao relaxamento profundo.</p>
            </div>
            <div className={`bento${bento ? '' : ' auto'}`}>
                {!protocolos && AREAS.map((a) => <div key={a} className={`tile skel ${a}`} />)}
                {lista.map((p, i) => (
                    <ProtocoloTile key={p.id} p={p} num={i + 1} area={bento ? AREAS[i] : undefined}
                        seal={p.permite_vale_presente ? 'Vale-presente' : i === 0 ? 'Mais procurado' : undefined} />
                ))}
                {protocolos && (
                    <a className="tile help tg" href={whatsappUrl({})} target="_blank" rel="noreferrer">
                        <span className="mono" aria-hidden="true" />
                        <span className="txt"><b>Não sabe qual escolher?</b><small>Conte o que você sente pelo WhatsApp e eu indico o protocolo ideal para você.</small></span>
                        <span className="go" aria-hidden="true"><MessageCircle /></span>
                    </a>
                )}
            </div>
        </section>
    );
}
