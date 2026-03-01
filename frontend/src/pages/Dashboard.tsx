import { useAuth } from '@/hooks/useAuth';
import { trpc } from '@/services/trpc';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Users, ShoppingCart, DollarSign, Package, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const { user, isAdmin } = useAuth();
    const atendimentos = trpc.atendimentos.list.useQuery({ status: 'AGENDADO' }, { refetchInterval: 30_000 });
    const pessoasList = trpc.pessoas.list.useQuery(undefined);
    const vendasList = trpc.vendas.list.useQuery({ status: 'ATIVA' });

    const fmt = (v: string) => new Date(v).toLocaleDateString('pt-BR');
    const fmtTime = (v?: string | null) => (v ? v.slice(0, 5) : '–');

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold tracking-tight">
                    Bem-vindo, {user?.nome || user?.email}
                </h2>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Resumo geral do estúdio</p>
            </div>

            {/* Summary cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DashCard
                    title="Atendimentos agendados"
                    value={atendimentos.data?.length ?? '–'}
                    icon={<CalendarCheck className="h-5 w-5 text-blue-600" />}
                    to="/atendimentos"
                />
                <DashCard
                    title="Pessoas"
                    value={pessoasList.data?.length ?? '–'}
                    icon={<Users className="h-5 w-5 text-emerald-600" />}
                    to="/pessoas"
                />
                <DashCard
                    title="Vendas ativas"
                    value={vendasList.data?.length ?? '–'}
                    icon={<ShoppingCart className="h-5 w-5 text-amber-600" />}
                    to="/vendas"
                />
                {isAdmin && (
                    <DashCard
                        title="Financeiro"
                        value="→"
                        icon={<DollarSign className="h-5 w-5 text-violet-600" />}
                        to="/financeiro"
                    />
                )}
            </div>

            {/* Upcoming appointments */}
            <Card>
                <div className="flex items-center gap-3 border-b border-[hsl(var(--border))] p-4">
                    <Clock className="h-5 w-5 text-[hsl(var(--primary))]" />
                    <h3 className="font-semibold">Próximos atendimentos</h3>
                </div>
                <CardContent className="p-4">
                    {atendimentos.isLoading && <p className="py-4 text-center text-sm text-gray-400">Carregando…</p>}
                    {atendimentos.data?.length === 0 && (
                        <p className="py-4 text-center text-sm text-gray-400">Nenhum atendimento agendado.</p>
                    )}
                    <ul className="divide-y divide-[hsl(var(--border))]">
                        {atendimentos.data?.slice(0, 10).map((a) => (
                            <li key={a.id} className="flex items-center justify-between py-3">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                                        {a.id}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{a.pessoa_nome ?? `Venda #${a.id_venda}`}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                            {a.servico_nome ?? 'Serviço'} · Prof. {a.profissional_nome}
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="whitespace-nowrap">
                                    {fmt(a.data)} {fmtTime(a.hora_inicio)}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}

function DashCard({ title, value, icon, to }: { title: string; value: string | number; icon: React.ReactNode; to: string }) {
    return (
        <Link to={to}>
            <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5">
                <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))]">
                        {icon}
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-[hsl(var(--muted-foreground))]">{title}</p>
                        <p className="text-2xl font-bold">{value}</p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}
