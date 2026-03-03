import { useState } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';

/**
 * PLACEHOLDER: Substitua pelos depoimentos reais.
 * Cada item: { nome, texto, avaliacao (1–5) }
 */
const DEPOIMENTOS = [
    {
        nome: 'Ana Carolina Mendes',
        texto: 'Foi a melhor experiência que já tive. A Tayna tem um toque incrível e sabe exatamente onde trabalhar. Saí completamente renovada, sem aquela tensão que carregava há meses. Com certeza voltarei!',
        avaliacao: 5,
    },
    {
        nome: 'Juliana Ferreira',
        texto: 'Fiz a drenagem linfática e os resultados foram além do que esperava. Além de reduzir o inchaço, me senti muito mais leve e energizada. O ambiente do estúdio é lindo e acolhedor. Super recomendo!',
        avaliacao: 5,
    },
    {
        nome: 'Mariana Souza',
        texto: 'A massagem modeladora transformou minha autoestima. Em apenas 4 sessões já vi diferença visível no contorno. A Tayna é extremamente profissional e atenciosa com cada detalhe do tratamento.',
        avaliacao: 5,
    },
    {
        nome: 'Fernanda Lima',
        texto: 'Comecei as sessões para aliviar a ansiedade e foi uma descoberta incrível. O relaxamento profundo da Tayna é algo que não consigo descrever em palavras. Durmo muito melhor desde que comecei o tratamento.',
        avaliacao: 5,
    },
    {
        nome: 'Patrícia Rodrigues',
        texto: 'Indico de olhos fechados! Tenho dores crônicas nas costas há anos e depois das sessões com o Método Tayna Santos finalmente consegui alívio de verdade. Ela realmente entende o corpo e trata cada cliente de forma única.',
        avaliacao: 5,
    },
];

function StarRating({ count }: { count: number }) {
    return (
        <div className="dep-stars">
            {Array.from({ length: 5 }).map((_, i) => (
                <svg
                    key={i}
                    className={i < count ? 'dep-star' : 'dep-star-empty'}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    );
}

export default function Depoimentos() {
    const [current, setCurrent] = useState(0);
    const total = DEPOIMENTOS.length;

    const prev = () => setCurrent((c) => (c === 0 ? total - 1 : c - 1));
    const next = () => setCurrent((c) => (c === total - 1 ? 0 : c + 1));

    const dep = DEPOIMENTOS[current];

    return (
        <section
            id="depoimentos"
            className="relative section-pad bg-section-offwhite"
        >
            <div className="container-page">
                {/* Cabeçalho */}
                <div className="text-center animate-fade-in-up">
                    <p className="eyebrow mb-4 text-gold-accent">Depoimentos</p>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-on-light">
                        O que nossos clientes dizem
                    </h2>
                    <p className="dep-subtitle">
                        Experiências reais de transformação e bem-estar
                    </p>
                </div>

                {/* Espaço garantido entre header e card */}
                <div className="hairline-section-wrap">
                    <div className="hairline-dark" />
                </div>

                {/* Card */}
                <div className="dep-card-wrap">
                    <div className="dep-card">
                        <Quote className="dep-icon" size={32} strokeWidth={1.5} />

                        <blockquote className="dep-quote">
                            “{dep.texto}”
                        </blockquote>

                        <StarRating count={dep.avaliacao} />
                        <p className="dep-author">{dep.nome}</p>
                    </div>
                </div>

                {/* Navegação */}
                {total > 1 && (
                    <div className="dep-nav">
                        <button onClick={prev} className="dep-nav-btn" aria-label="Anterior">
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex gap-2">
                            {DEPOIMENTOS.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setCurrent(i)}
                                    className={`dep-dot ${i === current ? 'dep-dot-active' : 'dep-dot-inactive'}`}
                                    aria-label={`Depoimento ${i + 1}`}
                                />
                            ))}
                        </div>

                        <button onClick={next} className="dep-nav-btn" aria-label="Próximo">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
        </section>
    );
}
