import { Flower2, GraduationCap, HandHeart, Sparkles, type LucideIcon } from 'lucide-react';
import { useReveal } from '@/lib/useReveal';

const ITENS: { icone: LucideIcon; titulo: [string, string]; texto: string }[] = [
    { icone: Sparkles, titulo: ['Protocolos', 'autorais'], texto: 'O Método TS une drenagem, liberação miofascial e modeladora em uma sessão.' },
    { icone: Flower2, titulo: ['Ambiente', 'acolhedor'], texto: 'Música, aromas e iluminação pensados para você desacelerar.' },
    { icone: HandHeart, titulo: ['Atendimento', 'individual'], texto: 'Um horário reservado só para você, sem pressa e com atenção total.' },
    { icone: GraduationCap, titulo: ['Formação em', 'estética'], texto: 'Técnica em Estética e Biomedicina com foco em estética avançada.' },
];

function Card({ i }: { i: number }) {
    const { icone: Icone, titulo, texto } = ITENS[i];
    return (
        <div className="wcard">
            <div className="t"><span className="ic"><Icone /></span><h3>{titulo[0]}<br />{titulo[1]}</h3><span className="n">{String(i + 1).padStart(2, '0')}</span></div>
            <p>{texto}</p>
        </div>
    );
}

export default function PorQueEscolher() {
    const ref = useReveal<HTMLElement>();
    return (
        <section className="why reveal" ref={ref} aria-labelledby="why-t">
            <svg className="rings" viewBox="0 0 560 560" aria-hidden="true"><g fill="none" stroke="#DDD5CA" strokeWidth="1"><circle cx="280" cy="280" r="230" /><circle cx="280" cy="280" r="272" strokeDasharray="2 6" /></g><g fill="#B88A4A"><circle cx="117" cy="117" r="4" /><circle cx="443" cy="117" r="4" /><circle cx="117" cy="443" r="4" /><circle cx="443" cy="443" r="4" /></g></svg>
            <div className="wcol"><Card i={0} /><Card i={2} /></div>
            <div className="center"><span className="mono" aria-hidden="true" /><span className="eyebrow">Diferenciais</span><h2 id="why-t">Por que<br /><em>escolher?</em></h2></div>
            <div className="wcol"><Card i={1} /><Card i={3} /></div>
        </section>
    );
}
