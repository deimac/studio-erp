import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/services/trpc';
import { dataBR, diaISO } from '@/lib/datas';
import { useEscopo } from '@/hooks/useEscopo';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListaAtendimentos } from '@/components/ListaAtendimentos';
import { CalendarCheck, Users, ShoppingCart, Clock, ArrowDownCircle, ArrowUpCircle, ChevronRight } from 'lucide-react';
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

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    Bem-vindo, {user?.nome || user?.email}
                </h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Resumo geral do estúdio</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <DashCard
                    title="Atendimentos hoje"
                    curto="Hoje"
                    value={atendimentosQ.isLoading ? 0 : deHoje}
                    icon={<CalendarCheck className="h-5 w-5 text-blue-600" />}
                    to="/atendimentos"
                />
                <DashCard
                    title="Pessoas"
                    curto="Pessoas"
                    value={pessoasList.data?.length ?? 0}
                    icon={<Users className="h-5 w-5 text-emerald-600" />}
                    to="/pessoas"
                />
                <DashCard
                    title="Vendas ativas"
                    curto="Vendas"
                    value={vendasList.data?.length ?? 0}
                    icon={<ShoppingCart className="h-5 w-5 text-amber-600" />}
                    to="/vendas"
                />
            </div>

            {/* Contas */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <PainelContas
                    titulo="A receber hoje"
                    subtitulo="Vencendo hoje e atrasadas"
                    icone={<ArrowDownCircle className="h-5 w-5 text-emerald-600" />}
                    corTotal="text-emerald-700"
                    contas={receberQ.data}
                    carregando={receberQ.isLoading}
                    hojeISO={hojeISO}
                    vazio="Nada a receber hoje."
                />
                <PainelContas
                    titulo="A pagar"
                    subtitulo={`Atrasadas e próximos ${DIAS_A_PAGAR} dias`}
                    icone={<ArrowUpCircle className="h-5 w-5 text-red-600" />}
                    corTotal="text-red-700"
                    contas={pagarQ.data}
                    carregando={pagarQ.isLoading}
                    hojeISO={hojeISO}
                    vazio={`Nenhuma conta a pagar nos próximos ${DIAS_A_PAGAR} dias.`}
                />
            </div>

            {/* Próximos atendimentos — mesma lista da tela Atendimentos */}
            <Card>
                <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-4">
                    <Clock className="h-5 w-5 text-[hsl(var(--primary))]" />
                    <h3 className="font-semibold">Próximos atendimentos</h3>
                    <Link to="/atendimentos" className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-sm text-[hsl(var(--primary))] hover:underline">
                        Ver todos <ChevronRight className="h-4 w-4" />
                    </Link>
                </div>
                <CardContent className="p-0">
                    <ListaAtendimentos
                        atendimentos={proximos?.slice(0, 10)}
                        carregando={atendimentosQ.isLoading}
                        vazio="Nenhum atendimento agendado."
                    />
                </CardContent>
            </Card>
        </div>
    );
}

function PainelContas({ titulo, subtitulo, icone, corTotal, contas, carregando, hojeISO, vazio }: {
    titulo: string;
    subtitulo: string;
    icone: React.ReactNode;
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
        <Card className="flex flex-col">
            <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-4">
                {icone}
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
                {carregando && <p className="py-8 text-center text-sm text-gray-400">Carregando…</p>}
                {!carregando && lista.length === 0 && <p className="py-8 text-center text-sm text-gray-400">{vazio}</p>}
                <ul className="max-h-80 divide-y divide-[hsl(var(--border))] overflow-y-auto">
                    {lista.map((c) => {
                        const venc = diaISO(c.data_vencimento) ?? '';
                        const atrasada = venc < hojeISO;
                        const descricao = c.descricao ?? c.servico_nome ?? c.pacote_nome ?? (c.id_venda ? `Venda #${c.id_venda}` : '');
                        const parcela = (c.quantidade_parcelas ?? 1) > 1 ? ` · parcela ${c.parcela}/${c.quantidade_parcelas}` : '';
                        return (
                            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
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
            <Link to="/financeiro" className="flex items-center justify-center gap-1 border-t border-[hsl(var(--border))] py-2.5 text-sm text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]">
                Abrir financeiro <ChevronRight className="h-4 w-4" />
            </Link>
        </Card>
    );
}

function DashCard({ title, curto, value, icon, to }: { title: string; curto: string; value: string | number; icon: React.ReactNode; to: string }) {
    return (
        <Link to={to} className="min-w-0">
            <Card className="h-full cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md">
                {/* Celular: compacto, os três lado a lado */}
                <CardContent className="flex flex-col items-center gap-1 p-3 text-center sm:hidden">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[hsl(var(--muted))]">{icon}</div>
                    <p className="text-xl font-bold leading-tight">{value}</p>
                    <p className="w-full truncate text-[11px] font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{curto}</p>
                </CardContent>
                <CardContent className="hidden items-center gap-4 p-5 sm:flex">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{title}</p>
                        <p className="text-2xl font-bold">{value}</p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
