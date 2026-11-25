import { ArrowRight, GraduationCap, HeartHandshake, Sparkles } from 'lucide-react';
import { useReveal } from '@/lib/useReveal';
import { resolveImageUrl } from '@/lib/media';
import { useWhatsapp } from '@/lib/contato';

const CREDS = [
    { icone: Sparkles, titulo: 'Técnica em Estética', texto: 'Formação profissional em técnicas estéticas avançadas.' },
    { icone: GraduationCap, titulo: 'Biomedicina', texto: 'Cursando, com foco em estética avançada.' },
    { icone: HeartHandshake, titulo: 'Paixão pelo cuidado', texto: 'Cada sessão pensada para o seu corpo e o seu momento.' },
];

export default function Sobre({ imagem }: { imagem?: string }) {
    const whatsappUrl = useWhatsapp();
    const ref = useReveal<HTMLElement>();
    return (
        <section className="about reveal" id="sobre" ref={ref}>
            <div className="ph-wrap">
                <div className="ph"><img src={resolveImageUrl(imagem) || '/images/tayna_sobre.png'} alt="Tayna Santos, massoterapeuta" loading="lazy" /></div>
                <div className="badge"><b>4+</b><span>anos de<br />massoterapia</span></div>
            </div>
            <div className="txt">
                <span className="eyebrow">Sobre mim</span>
                <h2>Olá, eu sou a <em>Tayna</em>.</h2>
                <p>Sou massoterapeuta em Maringá e apaixonada por cuidar das pessoas. Há mais de 4 anos ofereço momentos de bem-estar, alívio e autoestima, com protocolos que respeitam o tempo e as necessidades de cada corpo.</p>
                <div className="creds">
                    {CREDS.map(({ icone: Icone, titulo, texto }) => (
                        <div className="cred" key={titulo}><span className="ic"><Icone /></span><b>{titulo}</b><small>{texto}</small></div>
                    ))}
                </div>
                <a className="pill" href={whatsappUrl({})} target="_blank" rel="noreferrer">Conversar com a Tayna<ArrowRight /></a>
            </div>
        </section>
    );
}
