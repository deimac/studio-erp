import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * PLACEHOLDER: Substitua pelas perguntas reais.
 */
const FAQ_ITEMS = [
    {
        pergunta: 'Como funciona o agendamento?',
        resposta:
            'O agendamento é simples e rápido! Você pode entrar em contato através do WhatsApp. Respondo rapidamente e encontramos o melhor horário para sua sessão.',
    },
    {
        pergunta: 'Qual a duração de cada sessão?',
        resposta:
            'Todas as sessões têm duração de 90 minutos. Este tempo é cuidadosamente planejado para proporcionar um tratamento completo e eficaz, permitindo que você relaxe completamente e obtenha os melhores resultados.',
    },
    {
        pergunta: 'Preciso de quantas sessões para ver resultados?',
        resposta:
            'Os resultados variam de acordo com cada pessoa e o tipo de tratamento. Muitos clientes relatam melhoras já na primeira sessão. Para resultados mais duradouros, recomendo um protocolo de 4 a 8 sessões, dependendo do objetivo.',
    },
    {
        pergunta: 'Qual a diferença entre os serviços oferecidos?',
        resposta:
            'Cada serviço tem um objetivo específico: o Método Tayna Santos foca em dores e tensões musculares; a Drenagem Linfática reduz inchaços e toxinas; a Massagem Modeladora trabalha contorno corporal; e o Relaxamento Profundo alivia estresse e ansiedade.',
    },
    {
        pergunta: 'Posso fazer mais de um tratamento na mesma sessão?',
        resposta:
            'Alguns tratamentos podem ser combinados para potencializar os resultados. Entre em contato para conversarmos sobre suas necessidades e criarmos um protocolo personalizado ideal para você.',
    },
    {
        pergunta: 'Quais são as formas de pagamento aceitas?',
        resposta:
            'Aceito pagamento em dinheiro, PIX, cartão de débito e crédito. O pagamento é realizado no dia da sessão. Para pacotes de múltiplas sessões, consulte condições especiais.',
    },
    {
        pergunta: 'Há contraindicações para os tratamentos?',
        resposta:
            'Alguns tratamentos têm contraindicações específicas, como gravidez, processos inflamatórios agudos ou pós-operatório recente. Durante a consulta inicial, avalio seu histórico de saúde para garantir a segurança e eficácia do tratamento.',
    },
    {
        pergunta: 'Posso cancelar ou remarcar minha sessão?',
        resposta:
            'Sim! Peço apenas que avise com pelo menos 24 horas de antecedência para que eu possa reorganizar minha agenda. Assim, consigo oferecer o horário para outro cliente que esteja aguardando.',
    },
];

function AccordionItem({
    pergunta,
    resposta,
    isOpen,
    onToggle,
}: {
    pergunta: string;
    resposta: string;
    isOpen: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="faq-item">
            <button onClick={onToggle} className="faq-question">
                <span>{pergunta}</span>
                <ChevronDown className={`faq-chevron ${isOpen ? 'open' : ''}`} />
            </button>
            <div className={`faq-answer ${isOpen ? 'open' : ''}`}>
                <p className="faq-answer-text">{resposta}</p>
            </div>
        </div>
    );
}

export default function FAQ() {
    const [openIdx, setOpenIdx] = useState<number | null>(0);

    return (
        <section id="faq" className="relative section-pad bg-section-navy">
            <div className="container-page">
                {/* Section header */}
                <div className="faq-header animate-fade-in-up">
                    <p className="eyebrow text-gold mb-4">Perguntas Frequentes</p>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-text-light">
                        Tire suas dúvidas
                    </h2>
                    <p className="faq-subtitle">
                        Respostas para as perguntas mais comuns sobre os tratamentos
                    </p>
                </div>

                {/* Accordion */}
                <div className="faq-accordion-wrap">
                    {FAQ_ITEMS.map((item, i) => (
                        <AccordionItem
                            key={i}
                            pergunta={item.pergunta}
                            resposta={item.resposta}
                            isOpen={openIdx === i}
                            onToggle={() => setOpenIdx(openIdx === i ? null : i)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
