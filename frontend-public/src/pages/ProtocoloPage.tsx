import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Clock, Gift, HandHeart, Info, ListChecks, MessageCircle, Sparkles, Wallet } from 'lucide-react';
import { useProtocolo, useProtocolos, type Modalidade, type ProtocoloDetalhe } from '@/lib/catalogo';
import { iconeProtocolo } from '@/lib/icons';
import { imagemProtocolo, imagemReserva } from '@/lib/media';
import { calcularEconomia, formatBRL, formatDuracoes } from '@/lib/format';
import { whatsappUrl } from '@/lib/whatsapp';
import { useReveal } from '@/lib/useReveal';
import ProtocoloTile from '@/components/ProtocoloTile';
import NotFound from './NotFound';

function ModalidadeCard({ p, m }: { p: ProtocoloDetalhe; m: Modalidade }) {
    const unica = p.modalidades.length === 1;
    const nome = m.nome_modalidade || (unica ? 'Sessão' : m.nome);
    const modalidadeMsg = m.nome_modalidade || (unica ? undefined : m.nome);
    const avulso = Number(m.valor);
    const pacotes = [...m.pacotes].sort((a, b) => a.quantidade_sessoes - b.quantidade_sessoes);
    return (
        <article className="mod">
            <div className="top">
                <div>
                    <h3>{nome}</h3>
                    <span className="dur"><Clock />{m.duracao_minutos} minutos</span>
                </div>
                <div className="price"><small>sessão avulsa</small><b>{formatBRL(avulso)}</b></div>
            </div>
            {m.regioes.length > 0 && <div className="regs">{m.regioes.map((r) => <span key={r}>{r.replace(/\.$/, '')}</span>)}</div>}
            {pacotes.length > 0 && (
                <div className="packs">
                    {pacotes.map((pk) => {
                        const total = Number(pk.valor_total);
                        const economia = calcularEconomia(avulso, pk.quantidade_sessoes, total);
                        return (
                            <a key={pk.id} className="pack" target="_blank" rel="noreferrer"
                                href={whatsappUrl({ protocolo: modalidadeMsg && !m.nome_modalidade ? undefined : p.nome, modalidade: modalidadeMsg, pacote: { sessoes: pk.quantidade_sessoes } })}>
                                <b>Pacote {pk.quantidade_sessoes} sessões</b>
                                <span className="tot">{formatBRL(total)}</span>
                                <small>{formatBRL(total / pk.quantidade_sessoes)} por sessão</small>
                                {economia ? <span className="save">economize {formatBRL(economia)}</span> : <span />}
                            </a>
                        );
                    })}
                </div>
            )}
            <a className="pill" target="_blank" rel="noreferrer" href={whatsappUrl({ protocolo: modalidadeMsg && !m.nome_modalidade ? undefined : p.nome, modalidade: modalidadeMsg })}>
                Agendar {m.nome_modalidade ? nome.toLowerCase() : 'sessão'}<ArrowRight />
            </a>
        </article>
    );
}

function Lista({ titulo, itens, icone: Icone }: { titulo: string; itens: string[]; icone: typeof Check }) {
    return (
        <div className="lcard">
            <h2><span className="ic"><Icone /></span>{titulo}</h2>
            <ul>{itens.map((t) => <li key={t}><i><Check /></i>{t}</li>)}</ul>
        </div>
    );
}

function Conteudo({ p }: { p: ProtocoloDetalhe }) {
    const { data: todos } = useProtocolos();
    const refMods = useReveal<HTMLElement>();
    const Icone = iconeProtocolo(p.icone);
    const valores = p.modalidades.map((m) => Number(m.valor)).filter((v) => v > 0);
    const aPartir = valores.length ? Math.min(...valores) : null;
    const duracoes = formatDuracoes(p.modalidades.map((m) => m.duracao_minutos));
    const temPacotes = p.modalidades.some((m) => m.pacotes.length > 0);
    const paragrafos = (p.descricao ?? '').split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
    const outros = (todos ?? []).filter((o) => o.slug !== p.slug).slice(0, 3);
    const ctaPrincipal = p.permite_vale_presente
        ? { href: whatsappUrl({ protocolo: p.nome, valePresente: true }), label: 'Quero presentear', icon: Gift }
        : { href: whatsappUrl({ protocolo: p.nome }), label: 'Agendar pelo WhatsApp', icon: ArrowRight };
    const CtaIcon = ctaPrincipal.icon;

    return (
        <>
            <nav className="crumbs" aria-label="Você está em">
                <Link to="/">Início</Link><ChevronRight /><Link to="/#protocolos">Protocolos</Link><ChevronRight /><span aria-current="page">{p.nome}</span>
            </nav>

            <section className="p-hero">
                <div className="txt">
                    <span className="ic-lg"><Icone /></span>
                    <span className="eyebrow">Protocolo</span>
                    <h1>{p.nome}</h1>
                    {p.subtitulo && <p className="sub">{p.subtitulo}</p>}
                    <div className="facts">
                        {duracoes && <span className="fact"><Clock />{duracoes}</span>}
                        {aPartir != null && <span className="fact"><Wallet />a partir de <b>{formatBRL(aPartir)}</b></span>}
                        {p.modalidades.length > 1 && <span className="fact"><ListChecks />{p.modalidades.length} modalidades</span>}
                        {p.permite_vale_presente && <span className="fact"><Gift />Disponível como vale-presente</span>}
                    </div>
                    <div className="ctas">
                        <a className="pill" href={ctaPrincipal.href} target="_blank" rel="noreferrer">{ctaPrincipal.label}<CtaIcon /></a>
                        {p.modalidades.length > 0 && <a className="pill ghost" href="#valores">Ver valores</a>}
                    </div>
                </div>
                <div className="visual">
                    <img src={imagemProtocolo(p)} alt={p.nome} fetchPriority="high" onError={imagemReserva} />
                    {aPartir != null && <span className="glass price-chip"><small>a partir de</small><b>{formatBRL(aPartir)}</b></span>}
                </div>
            </section>

            {(paragrafos.length > 0 || p.inclui.length > 0 || p.beneficios.length > 0) && (
                <section className="p-body">
                    <div>
                        {paragrafos.length > 0 && <div className="prose">{paragrafos.map((t, i) => <p key={i}>{t}</p>)}</div>}
                        {(p.inclui.length > 0 || p.beneficios.length > 0) && (
                            <div className={`lists${p.inclui.length && p.beneficios.length ? '' : ' single'}`}>
                                {p.inclui.length > 0 && <Lista titulo="O que inclui" itens={p.inclui} icone={ListChecks} />}
                                {p.beneficios.length > 0 && <Lista titulo="Benefícios" itens={p.beneficios} icone={Sparkles} />}
                            </div>
                        )}
                    </div>
                    <aside className="aside">
                        <span className="mono" aria-hidden="true" />
                        <span className="eyebrow">Sua sessão</span>
                        <h2>Um cuidado só seu</h2>
                        <ul>
                            <li><HandHeart />Atendimento individual, com hora marcada</li>
                            <li><Info />Avaliação prévia antes de começar</li>
                            <li><Wallet />Pagamento no dia: PIX, cartão ou dinheiro</li>
                        </ul>
                        <a className="pill" href={ctaPrincipal.href} target="_blank" rel="noreferrer"><MessageCircle />{ctaPrincipal.label}</a>
                    </aside>
                </section>
            )}

            {p.modalidades.length > 0 && (
                <section className="mods reveal" id="valores" ref={refMods}>
                    <div className="sh">
                        <div><span className="eyebrow">Valores</span><h2>{p.modalidades.length > 1 ? <>Escolha a sua<br /><em>modalidade</em></> : <>Sessão e<br /><em>{temPacotes ? 'pacotes' : 'valor'}</em></>}</h2></div>
                        {temPacotes && <p>Nos pacotes, cada sessão sai mais em conta. Toque em um pacote para falar comigo pelo WhatsApp.</p>}
                    </div>
                    <div className="mod-grid">{p.modalidades.map((m) => <ModalidadeCard key={m.id} p={p} m={m} />)}</div>
                </section>
            )}

            {p.aviso && (
                <div className="notice" role="note">
                    <span className="ic"><Info /></span>
                    <div><b>Importante</b><p>{p.aviso}</p></div>
                </div>
            )}

            {p.frase_final && (
                <div className="closing"><span className="mono" aria-hidden="true" /><p>{p.frase_final}</p></div>
            )}

            {outros.length > 0 && (
                <section className="others">
                    <div className="sh"><div><span className="eyebrow">Continue explorando</span><h2>Outros <em>protocolos</em></h2></div></div>
                    <div className="grid3">{outros.map((o) => <ProtocoloTile key={o.id} p={o} />)}</div>
                </section>
            )}
        </>
    );
}

export default function ProtocoloPage() {
    const { slug = '' } = useParams();
    const { data, isLoading, isError } = useProtocolo(slug);
    useEffect(() => { if (data) document.title = `${data.nome} — Tayna Santos`; }, [data]);

    if (isLoading) {
        return (
            <section className="p-hero" aria-busy="true">
                <div className="txt"><span className="ic-lg skel" /><div className="skel" style={{ height: 60, borderRadius: 16, width: '80%' }} /></div>
                <div className="visual skel" />
            </section>
        );
    }
    if (isError) return <NotFound titulo="Não foi possível carregar" texto="Verifique sua conexão e tente novamente em instantes." />;
    if (!data) return <NotFound titulo="Protocolo não encontrado" />;
    return <Conteudo key={data.slug} p={data} />;
}
