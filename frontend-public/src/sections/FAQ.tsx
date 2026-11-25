import { MessageCircle, Plus } from 'lucide-react';
import { useReveal } from '@/lib/useReveal';
import { useWhatsapp } from '@/lib/contato';

const PERGUNTAS = [
    { p: 'Como faço para agendar?', r: 'Pelo WhatsApp. Você me conta o que procura, eu indico o protocolo e encontramos juntas o melhor horário. O atendimento é individual e com hora marcada.' },
    { p: 'Qual protocolo é ideal para mim?', r: 'Depende do que você sente e do que busca: leveza, alívio de tensões, cuidado com o lipedema ou relaxamento. Antes da primeira sessão faço uma avaliação para escolher a técnica certa.' },
    { p: 'Quanto tempo dura cada sessão?', r: 'Entre 60 e 90 minutos, conforme o protocolo e a modalidade. O Ritual de Pausa tem 80 minutos. A duração de cada opção aparece na página do protocolo.' },
    { p: 'Os pacotes têm desconto?', r: 'Sim. Os pacotes de 4 e 8 sessões saem mais em conta que as sessões avulsas, e a economia aparece na página de cada protocolo.' },
    { p: 'Existe alguma contraindicação?', r: 'Sim, alguns casos pedem cuidado, como gestação, processos inflamatórios agudos ou pós-operatório recente. Por isso faço uma avaliação prévia. Os protocolos são complementares e não substituem acompanhamento médico.' },
    { p: 'Quais as formas de pagamento?', r: 'Dinheiro, PIX, cartão de débito e crédito, com pagamento no dia da sessão.' },
    { p: 'Posso remarcar minha sessão?', r: 'Pode, sim. Peço só que avise com pelo menos 24 horas de antecedência.' },
];

export default function FAQ() {
    const whatsappUrl = useWhatsapp();
    const ref = useReveal<HTMLElement>();
    return (
        <section className="faq reveal" id="faq" ref={ref}>
            <div className="intro">
                <span className="eyebrow">Dúvidas frequentes</span>
                <h2>Antes da sua<br /><em>primeira sessão</em></h2>
                <p>Separei as perguntas que mais recebo. Se a sua não estiver aqui, é só me chamar.</p>
                <a className="pill ghost" href={whatsappUrl({})} target="_blank" rel="noreferrer"><MessageCircle />Perguntar no WhatsApp</a>
            </div>
            <div>
                {PERGUNTAS.map((q, i) => (
                    <details key={q.p} open={i === 0}>
                        <summary><span className="n">{String(i + 1).padStart(2, '0')}</span>{q.p}<span className="plus" aria-hidden="true"><Plus /></span></summary>
                        <p>{q.r}</p>
                    </details>
                ))}
            </div>
        </section>
    );
}
