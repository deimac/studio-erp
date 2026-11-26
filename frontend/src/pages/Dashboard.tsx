import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/services/trpc';
import { dataBR, diaISO } from '@/lib/datas';
import { useEscopo } from '@/hooks/useEscopo';
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAcoesRapidas } from '@/components/acoes/AcoesRapidas';
import { Badge } from '@/components/ui/badge';
import { ListaAtendimentos } from '@/components/ListaAtendimentos';
import { CalendarCheck, CalendarPlus, Users, UserPlus, ShoppingCart, Clock, ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const isoLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Quantos dias à frente o painel "A pagar" mostra. */
const DIAS_A_PAGAR = 7;

export default function Dashboard() {
    const { user } = useAuth();
    const hoje = new Date();
    const hojeISO = isoLocal(hoje);
    const limitePagar = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + DIAS_A_PAGAR));
    const { escopo } = useEscopo();

    const atendimentosQ = trpc.atendimentos.list.useQuery({ de: hojeISO, escopo }, { refetchInterval: 30_000 });
    const proximos = atendimentosQ.data?.filter((a: any) => a.status === 'AGENDADO' || a.status === 'CONFIRMADO');
    const deHoje = proximos?.filter((a: any) => diaISO(a.data) === hojeISO).length ?? 0;
    // Lista do painel: só hoje e amanhã, para não ficar comprida
    const amanhaISO = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1));
    const hojeEAmanha = proximos?.filter((a: any) => (diaISO(a.data) ?? '') <= amanhaISO);

    const pessoasList = trpc.pessoas.list.useQuery({ escopo });
    const vendasList = trpc.vendas.list.useQuery({ status: 'ATIVA', escopo });

    // Contas em aberto: a receber até hoje (inclui atrasadas) e a pagar nos próximos dias
    const receberQ = trpc.financeiro.listWithDetails.useQuery(
        { tipo: 'RECEITA', situacao: 'NAO_PAGO', dataType: 'VENCIMENTO', dataFim: hojeISO, escopo },
        { refetchInterval: 60_000 },
    );
    const pagarQ = trpc.financeiro.listWithDetails.useQuery(
        { tipo: 'DESPESA', situacao: 'NAO_PAGO', dataType: 'VENCIMENTO', dataFim: limitePagar, escopo },
        { refetchInterval: 60_000 },
    );

    const primeiroNome = (user?.nome || '').split(' ')[0] || user?.email || '';
    const { abrirForm } = useAcoesRapidas();

    return (
        <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-4 lg:space-y-5">
                {/* Boas-vindas, resumo do dia e atalhos */}
                <Card className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Olá, {primeiroNome}</h2>
                            <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
                                {atendimentosQ.isLoading ? 'Resumo geral do estúdio' : deHoje === 0 ? 'Nenhum atendimento marcado para hoje.' : `Você tem ${deHoje} atendimento${deHoje > 1 ? 's' : ''} hoje.`}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => abrirForm('agendamento')}><CalendarPlus className="h-4 w-4" /> Agendar</Button>
                            <Button size="sm" variant="outline" onClick={() => abrirForm('venda')}><ShoppingCart className="h-4 w-4" /> Nova venda</Button>
                            <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => abrirForm('pessoa')}><UserPlus className="h-4 w-4" /> Novo cliente</Button>
                        </div>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                        <MiniStat rotulo="Hoje" valor={atendimentosQ.isLoading ? 0 : deHoje} icone={<CalendarCheck />} tom="bg-blue-100 text-blue-700" to="/atendimentos" />
                        <MiniStat rotulo="Pessoas" valor={pessoasList.data?.length ?? 0} icone={<Users />} tom="bg-emerald-100 text-emerald-700" to="/pessoas" />
                        <MiniStat rotulo="Vendas ativas" valor={vendasList.data?.length ?? 0} icone={<ShoppingCart />} tom="bg-amber-100 text-amber-700" to="/vendas" />
                    </div>
                </Card>

                {/* Próximos atendimentos — mesma lista da tela Atendimentos */}
                <Card className="overflow-hidden">
                    <CardHeader actions={
                        <Button asChild size="sm" variant="outline">
                            <Link to="/atendimentos"><span className="hidden sm:inline">Ver todos</span><span className="sm:hidden">Todos</span> <ChevronRight className="h-4 w-4" /></Link>
                        </Button>
                    }>
                        <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 shrink-0 text-[hsl(var(--primary))]" /> <span className="truncate">Hoje e amanhã</span></CardTitle>
                    </CardHeader>
                    <ListaAtendimentos
                        atendimentos={hojeEAmanha}
                        carregando={atendimentosQ.isLoading}
                        vazio="Nenhum atendimento para hoje ou amanhã."
                    />
                </Card>

                {/* Contas */}
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
                    <PainelContas
                        titulo="A receber hoje"
                        subtitulo="Vencendo hoje e atrasadas"
                        icone={<ArrowDownCircle />}
                        tom="bg-emerald-100 text-emerald-700"
                        corTotal="text-emerald-700"
                        contas={receberQ.data}
                        carregando={receberQ.isLoading}
                        hojeISO={hojeISO}
                        vazio="Nada a receber hoje."
                    />
                    <PainelContas
                        titulo="A pagar"
                        subtitulo={`Atrasadas e próximos ${DIAS_A_PAGAR} dias`}
                        icone={<ArrowUpCircle />}
                        tom="bg-red-100 text-red-700"
                        corTotal="text-red-700"
                        contas={pagarQ.data}
                        carregando={pagarQ.isLoading}
                        hojeISO={hojeISO}
                        vazio={`Nenhuma conta a pagar nos próximos ${DIAS_A_PAGAR} dias.`}
                    />
                </div>
            </div>

            {/* Coluna da semana: dias em círculos e o que tem em cada um */}
            <SemanaResumo atendimentos={proximos} carregando={atendimentosQ.isLoading} />
        </div>
    );
}

function MiniStat({ rotulo, valor, icone, tom, to }: { rotulo: string; valor: number; icone: React.ReactNode; tom: string; to: string }) {
    return (
        <Link to={to} className="flex min-w-0 flex-col items-start gap-2 rounded-2xl bg-[hsl(var(--muted))] p-3 transition-colors hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.25)] sm:flex-row sm:items-center sm:gap-3 sm:p-4">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full [&_svg]:h-[18px] [&_svg]:w-[18px] sm:h-11 sm:w-11', tom)}>{icone}</span>
            <span className="min-w-0">
                <span className="block text-xl font-bold leading-tight tabular-nums sm:text-2xl">{valor}</span>
                <span className="block truncate text-xs font-medium text-[hsl(var(--muted-foreground))]">{rotulo}</span>
            </span>
        </Link>
    );
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Semana atual em círculos (hoje em destaque) e os atendimentos do dia escolhido. */
function SemanaResumo({ atendimentos, carregando }: { atendimentos: any[] | undefined; carregando: boolean }) {
    const hojeISO = isoLocal(new Date());
    const [semana, setSemana] = useState(0);
    const [escolhido, setEscolhido] = useState(hojeISO);
    const dias = useMemo(() => {
        const base = new Date();
        base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + semana * 7);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
            const iso = isoLocal(d);
            return { d, iso, qtd: (atendimentos ?? []).filter((a) => diaISO(a.data) === iso).length };
        });
    }, [semana, atendimentos]);
    const doDia = (atendimentos ?? [])
        .filter((a) => diaISO(a.data) === escolhido)
        .sort((a, b) => String(a.hora_inicio).localeCompare(String(b.hora_inicio)));
    const meio = dias[3].d;

    return (
        <Card className="h-fit p-5 sm:p-6 xl:sticky xl:top-0">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold capitalize">{MESES[meio.getMonth()]} {meio.getFullYear()}</h3>
                <div className="flex gap-1.5">
                    <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Semana anterior" onClick={() => setSemana((s) => s - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" className="h-9 w-9" aria-label="Próxima semana" onClick={() => setSemana((s) => s + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1">
                {dias.map(({ d, iso, qtd }) => {
                    const ativo = iso === escolhido;
                    const hoje = iso === hojeISO;
                    return (
                        <button key={iso} type="button" onClick={() => setEscolhido(iso)} aria-pressed={ativo}
                            aria-label={`${DIAS[d.getDay()]} ${d.getDate()}${hoje ? ', hoje' : ''}, ${qtd} atendimento${qtd === 1 ? '' : 's'}`}
                            className="group flex flex-col items-center gap-1.5 rounded-2xl py-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.25)]">
                            <span className="text-[11px] font-medium text-[hsl(var(--muted-foreground))]">{DIAS[d.getDay()]}</span>
                            <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors',
                                ativo ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_6px_14px_-6px_hsl(var(--primary)/0.7)]'
                                    : hoje ? 'ring-2 ring-[hsl(var(--primary))] text-[hsl(var(--foreground))]'
                                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] group-hover:bg-[hsl(var(--accent))]')}>
                                {d.getDate()}
                            </span>
                            <span className={cn('h-1.5 w-1.5 rounded-full', qtd ? 'bg-[hsl(var(--primary))]' : 'bg-transparent')} />
                        </button>
                    );
                })}
            </div>

            <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
                <p className="mb-3 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
                    {escolhido === hojeISO ? 'Hoje' : dataBR(escolhido)} · {doDia.length} atendimento{doDia.length === 1 ? '' : 's'}
                </p>
                {carregando && <p className="py-4 text-center text-sm text-[hsl(var(--muted-foreground))]">Carregando…</p>}
                {!carregando && doDia.length === 0 && (
                    <p className="rounded-2xl bg-[hsl(var(--muted))] px-4 py-5 text-center text-sm text-[hsl(var(--muted-foreground))]">
                        {escolhido < hojeISO ? 'Dia que já passou.' : 'Dia livre.'}
                    </p>
                )}
                <ul className="space-y-2">
                    {doDia.map((a) => (
                        <li key={a.id}>
                            <Link to="/agenda" className="flex items-center gap-3 rounded-2xl bg-[hsl(var(--muted))] p-3 transition-colors hover:bg-[hsl(var(--accent))]">
                                <span className="flex h-10 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[hsl(var(--card))] text-xs font-bold tabular-nums">
                                    {String(a.hora_inicio ?? '').slice(0, 5)}
                                </span>
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-semibold">{a.pessoa_nome}</span>
                                    <span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">
                                        {a.servico_nome ?? a.pacote_nome ?? 'Serviço'}{a.profissional_nome ? ` · ${a.profissional_nome}` : ''}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            </div>
        </Card>
    );
}

function PainelContas({ titulo, subtitulo, icone, tom, corTotal, contas, carregando, hojeISO, vazio }: {
    titulo: string;
    subtitulo: string;
    icone: React.ReactNode;
    tom: string;
    corTotal: string;
    contas: any[] | undefined;
    carregando: boolean;
    hojeISO: string;
    vazio: string;
}) {
    const lista = (contas ?? [])
        .filter((c) => c.status !== 'CANCELADO')
        .sort((a, b) => (diaISO(a.data_vencimento) ?? '').localeCompare(diaISO(b.data_vencimento) ?? ''));
    const total = lista.reduce((s, c) => s + Number(c.valor), 0);
    const atrasadas = lista.filter((c) => (diaISO(c.data_vencimento) ?? '') < hojeISO).length;

    return (
        <Card className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 p-5">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-5 [&_svg]:w-5', tom)}>{icone}</span>
                <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">{titulo}</h3>
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">{subtitulo}</p>
                </div>
                <div className="shrink-0 text-right">
                    <p className={cn('text-lg font-bold tabular-nums', corTotal)}>{moeda(carregando ? 0 : total)}</p>
                    {atrasadas > 0 && <p className="text-xs font-medium text-red-600">{atrasadas} atrasada{atrasadas > 1 ? 's' : ''}</p>}
                </div>
            </div>
            <CardContent className="flex-1 p-0">
                {carregando && <p className="mx-5 rounded-2xl bg-[hsl(var(--muted))] py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">Carregando…</p>}
                {!carregando && lista.length === 0 && <p className="mx-5 rounded-2xl bg-[hsl(var(--muted))] py-6 text-center text-sm text-[hsl(var(--muted-foreground))]">{vazio}</p>}
                <ul className="max-h-80 space-y-1.5 overflow-y-auto px-3">
                    {lista.map((c) => {
                        const venc = diaISO(c.data_vencimento) ?? '';
                        const atrasada = venc < hojeISO;
                        const descricao = c.descricao ?? c.servico_nome ?? c.pacote_nome ?? (c.id_venda ? `Venda #${c.id_venda}` : '');
                        const parcela = (c.quantidade_parcelas ?? 1) > 1 ? ` · parcela ${c.parcela}/${c.quantidade_parcelas}` : '';
                        return (
                            <li key={c.id} className="flex items-center justify-between gap-3 rounded-2xl px-2 py-2.5 hover:bg-[hsl(var(--muted))]">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{c.cliente_nome}</p>
                                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                                        {descricao}{parcela}{c.forma_pagamento_nome ? ` · ${c.forma_pagamento_nome}` : ''}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold tabular-nums">{moeda(Number(c.valor))}</p>
                                    {atrasada ? (
                                        <Badge variant="destructive" className="whitespace-nowrap text-[11px]">Atrasada · {dataBR(venc)}</Badge>
                                    ) : venc === hojeISO ? (
                                        <Badge variant="secondary" className="whitespace-nowrap text-[11px]">Vence hoje</Badge>
                                    ) : (
                                        <p className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{dataBR(venc)}</p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
            <div className="p-4 pt-3">
                <Button asChild variant="secondary" className="w-full">
                    <Link to="/financeiro">Abrir financeiro <ChevronRight className="h-4 w-4" /></Link>
                </Button>
            </div>
        </Card>
    );
}
