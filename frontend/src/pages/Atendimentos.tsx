import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { trpc } from '@/services/trpc';
import { AtendimentoForm } from '@/components/AtendimentoForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Calendar, Clock, CheckCircle, XCircle, AlertCircle, Sparkles, Package } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { useAuth } from '@/hooks/useAuth';

const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' | 'outline'; icon: typeof Calendar }> = {
    AGENDADO: { label: 'Agendado', variant: 'default', icon: Calendar },
    CONFIRMADO: { label: 'Confirmado', variant: 'success', icon: CheckCircle },
    REALIZADO: { label: 'Realizado', variant: 'success', icon: CheckCircle },
    CANCELADO: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
    FALTOU: { label: 'Faltou', variant: 'secondary', icon: AlertCircle },
};

export default function Atendimentos() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
    const { user } = useAuth();
    const utils = trpc.useUtils();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

    const atendQ = trpc.atendimentos.list.useQuery(statusFilter ? { status: statusFilter as any } : undefined);

    const realizarMut = trpc.atendimentos.marcarRealizado.useMutation({
        onSuccess: () => { utils.atendimentos.list.invalidate(); utils.vendas.list.invalidate(); toast({ title: 'Atendimento realizado!', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const cancelarMut = trpc.atendimentos.cancelar.useMutation({
        onSuccess: () => { utils.atendimentos.list.invalidate(); toast({ title: 'Atendimento cancelado' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const faltouMut = trpc.atendimentos.marcarFaltou.useMutation({
        onSuccess: () => { utils.atendimentos.list.invalidate(); toast({ title: 'Marcado como falta' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    const filtered = atendQ.data?.filter((a) =>
        !search ||
        (a.pessoa_nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.profissional_nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.servico_nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (a.pacote_nome ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    // Stats para os cards informativos
    const stats = {
        total: atendQ.data?.length ?? 0,
        agendados: atendQ.data?.filter((a) => a.status === 'AGENDADO' || a.status === 'CONFIRMADO').length ?? 0,
        realizados: atendQ.data?.filter((a) => a.status === 'REALIZADO').length ?? 0,
        cancelados: atendQ.data?.filter((a) => a.status === 'CANCELADO').length ?? 0,
        faltas: atendQ.data?.filter((a) => a.status === 'FALTOU').length ?? 0,
    };

    const fmtDate = (d: string | Date | null) => {
        if (!d) return '–';
        const dt = new Date(d);
        return dt.toLocaleDateString('pt-BR');
    };
    const fmtTime = (t: string | null) => t?.slice(0, 5) ?? '–';

    const handleCancelClick = async (id: number) => {
        const ok = await confirm({
            title: 'Cancelar atendimento?',
            description: 'Tem certeza que deseja cancelar este atendimento? Essa ação não pode ser desfeita.',
            confirmLabel: 'Cancelar',
            variant: 'warning',
        });
        if (ok) cancelarMut.mutate({ id });
    };

    return (
        <div className="space-y-6">
            <Tabs defaultValue="atendimentos">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <TabsList>
                        <TabsTrigger value="atendimentos">Atendimentos</TabsTrigger>
                        <TabsTrigger value="agenda">Agenda</TabsTrigger>
                    </TabsList>
                    <AtendimentoForm onSuccess={() => { utils.atendimentos.list.invalidate(); toast({ title: 'Atendimento agendado!', variant: 'success' }); }} />
                </div>

                <TabsContent value="atendimentos" className="space-y-4 mt-4">
                    {/* Cards informativos */}
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                        <Card>
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">Total</p>
                                    <p className="text-lg font-bold text-blue-600">{stats.total}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-blue-200 bg-blue-50/50">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-blue-500">Agendados</p>
                                    <p className="text-lg font-bold text-blue-600">{stats.agendados}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-green-200 bg-green-50/50">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                                    <CheckCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-green-500">Realizados</p>
                                    <p className="text-lg font-bold text-green-600">{stats.realizados}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-amber-200 bg-amber-50/50">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                                    <AlertCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-amber-500">Faltas</p>
                                    <p className="text-lg font-bold text-amber-600">{stats.faltas}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-red-200 bg-red-50/50">
                            <CardContent className="flex items-center gap-3 p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                                    <XCircle className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-red-500">Cancelados</p>
                                    <p className="text-lg font-bold text-red-600">{stats.cancelados}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative max-w-sm flex-1">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input placeholder="Buscar cliente, profissional ou serviço…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <div className="flex gap-2 flex-wrap">
                            <Button variant={!statusFilter ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(undefined)}>Todos</Button>
                            {Object.entries(statusConfig).map(([k, v]) => (
                                <Button key={k} variant={statusFilter === k ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(k)}>
                                    {v.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data / Hora</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="hidden md:table-cell">Serviço</TableHead>
                                        <TableHead className="hidden lg:table-cell">Profissional</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {atendQ.isLoading && (
                                        <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Carregando…</TableCell></TableRow>
                                    )}
                                    {filtered?.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Nenhum atendimento.</TableCell></TableRow>
                                    )}
                                    {filtered?.map((a) => {
                                        const cfg = statusConfig[a.status] ?? statusConfig.AGENDADO;
                                        const Icon = cfg.icon;
                                        return (
                                            <TableRow key={a.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-gray-400" />
                                                        <div>
                                                            <p className="font-medium">{fmtDate(a.data)}</p>
                                                            <p className="text-xs text-gray-400">{fmtTime(a.hora_inicio)} – {fmtTime(a.hora_fim)}</p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium">{a.pessoa_nome}</TableCell>
                                                <TableCell className="hidden md:table-cell">
                                                    {a.servico_nome ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center justify-center rounded bg-amber-100 p-1">
                                                                <Sparkles className="h-3 w-3 text-amber-600" />
                                                            </span>
                                                            <span>{a.servico_nome}</span>
                                                        </div>
                                                    ) : a.pacote_nome ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="inline-flex items-center justify-center rounded bg-purple-100 p-1">
                                                                <Package className="h-3 w-3 text-purple-600" />
                                                            </span>
                                                            <span>{a.pacote_nome}</span>
                                                        </div>
                                                    ) : '–'}
                                                </TableCell>
                                                <TableCell className="hidden lg:table-cell">{a.profissional_nome}</TableCell>
                                                <TableCell>
                                                    <Badge variant={cfg.variant} className="gap-1">
                                                        <Icon className="h-3 w-3" />
                                                        {cfg.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {(a.status === 'AGENDADO' || a.status === 'CONFIRMADO') && (
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 gap-1"
                                                                disabled={realizarMut.isPending}
                                                                onClick={() => realizarMut.mutate({ id: a.id })}
                                                            >
                                                                <CheckCircle className="h-3.5 w-3.5" />
                                                                Realizar
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 gap-1"
                                                                disabled={faltouMut.isPending}
                                                                onClick={() => faltouMut.mutate({ id: a.id })}
                                                            >
                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                                Faltou
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                                                                disabled={cancelarMut.isPending}
                                                                onClick={() => handleCancelClick(a.id)}
                                                            >
                                                                <XCircle className="h-3.5 w-3.5" />
                                                                Cancelar
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="agenda" className="mt-4">
                    <AgendaPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function AgendaPanel() {
    return (
        <Card>
            <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="font-semibold">A agenda agora tem tela própria</p>
                    <p className="text-sm text-gray-500">Calendário por dia/semana/mês, expediente semanal, bloqueios, salas e lembretes por WhatsApp.</p>
                </div>
                <Button asChild><Link to="/agenda"><Calendar className="mr-2 h-4 w-4" /> Abrir agenda</Link></Button>
            </CardContent>
        </Card>
    );
}
