import { useState } from 'react';
import { Check } from 'lucide-react';
import { trpc } from '@/services/trpc';

const WHATSAPP_NUMBER = '5543998468294';

function buildWhatsAppUrl(serviceName: string, pacoteName?: string) {
    const msg = pacoteName
        ? `Olá, gostaria de agendar o pacote ${pacoteName} do serviço ${serviceName}`
        : `Olá, gostaria de agendar uma sessão de ${serviceName}`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function formatCurrency(value: string | number) {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Pacote = {
    id: number;
    nome: string;
    descricao: string | null;
    quantidade_sessoes: number;
    valor_total: string;
};

type Servico = {
    id: number;
    nome: string;
    descricao: string | null;
    imagem_url: string | null;
    duracao_minutos: number;
    valor: string;
    tecnicas: Array<{ id: number; nome: string }>;
    pacotes: Pacote[];
};

function ServiceCard({ servico }: { servico: Servico }) {
    const tecnicas = (servico.tecnicas ?? []).slice(0, 5);

    const pacoteEspecial = (servico.pacotes ?? [])
        .slice()
        .sort((a, b) => b.quantidade_sessoes - a.quantidade_sessoes)[0];

    const [imgLoaded, setImgLoaded] = useState(false);

    return (
        <div className="sc-card">
            {/* ── Imagem ── */}
            <div className="sc-img">
                {servico.imagem_url ? (
                    <img
                        src={servico.imagem_url}
                        alt={servico.nome}
                        className={imgLoaded ? 'opacity-100' : 'opacity-0'}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => setImgLoaded(true)}
                    />
                ) : (
                    <div className="sc-img-placeholder">
                        {servico.nome[0]}
                    </div>
                )}
            </div>

            {/* ── Conteúdo ── */}
            <div className="sc-body">

                <h3 className="sc-title">{servico.nome}</h3>

                {servico.descricao && (
                    <p className="sc-desc line-clamp-3">{servico.descricao}</p>
                )}

                {tecnicas.length > 0 && (
                    <ul className="sc-list">
                        {tecnicas.map((t) => (
                            <li key={t.id} className="sc-list-item">
                                <Check className="sc-list-icon" strokeWidth={2.5} />
                                <span>{t.nome}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {/* ── Rodapé ── */}
                <div className="sc-footer">

                    <div className="sc-separator" />

                    <div className="sc-meta">
                        <div>
                            <p className="sc-meta-label">DURAÇÃO</p>
                            <p className="sc-meta-value">{servico.duracao_minutos} minutos</p>
                        </div>
                        <div className="sc-meta-right">
                            <p className="sc-meta-label">INVESTIMENTO</p>
                            <p className="sc-meta-value-gold">{formatCurrency(servico.valor)}</p>
                        </div>
                    </div>

                    {pacoteEspecial && (
                        <div className="sc-package">
                            <div className="sc-package-inner">
                                <p className="sc-package-label">PACOTE ESPECIAL</p>
                                <p className="sc-package-value">
                                    {pacoteEspecial.quantidade_sessoes} sessões por {formatCurrency(pacoteEspecial.valor_total)}
                                </p>
                            </div>
                        </div>
                    )}

                    <a
                        href={buildWhatsAppUrl(servico.nome, pacoteEspecial?.nome)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="sc-btn"
                    >
                        Agendar Sessão
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function Servicos() {
    const catalogoQ = trpc.public.listServicosComPacotes.useQuery();
    const servicos = (catalogoQ.data ?? []) as unknown as Servico[];

    return (
        <section id="servicos" className="relative section-pad bg-section-navy">
            <div className="container-page">
                {/* Cabeçalho */}
                <div className="relative z-10 animate-fade-in-up">
                    <p className="eyebrow text-gold mb-5">MEUS SERVIÇOS</p>
                    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-semibold text-text-light leading-[1.05]">
                            Experiências Terapêuticas
                            <span className="block text-gold">Personalizadas</span>
                        </h2>
                        <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-md">
                            Cada serviço é cuidadosamente desenvolvido para proporcionar bem-estar, alívio e transformação.
                        </p>
                    </div>
                </div>

                {/* Linha separadora com espaço generoso */}
                <div className="hairline-section-wrap">
                    <div className="hairline-gold" />
                </div>

                {catalogoQ.isLoading && (
                    <div className="flex justify-center py-16">
                        <div className="w-8 h-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                    </div>
                )}

                {!catalogoQ.isLoading && servicos.length > 0 && (
                    <div className="relative z-0 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
                        {servicos.map((s) => (
                            <ServiceCard key={s.id} servico={s} />
                        ))}
                    </div>
                )}

                {!catalogoQ.isLoading && servicos.length === 0 && (
                    <p className="text-center text-text-muted py-16">
                        Nenhum serviço disponível no momento.
                    </p>
                )}
            </div>
        </section>
    );
}
