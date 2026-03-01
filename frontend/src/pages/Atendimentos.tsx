import { useState, useEffect } from 'react';
import { trpc } from '@/services/trpc';
import { AtendimentoForm } from '@/components/AtendimentoForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { useAuth } from '@/hooks/useAuth';

const statusConfig: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' | 'outline'; icon: typeof Calendar }> = {
    AGENDADO: { label: 'Agendado', variant: 'default', icon: Calendar },
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
        (a.servico_nome ?? '').toLowerCase().includes(search.toLowerCase()),
    );

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
                                                <TableCell className="hidden md:table-cell">{a.servico_nome ?? '–'}</TableCell>
                                                <TableCell className="hidden lg:table-cell">{a.profissional_nome}</TableCell>
                                                <TableCell>
                                                    <Badge variant={cfg.variant} className="gap-1">
                                                        <Icon className="h-3 w-3" />
                                                        {cfg.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {a.status === 'AGENDADO' && (
                                                        <div className="flex justify-end gap-1">
                                                            <Button variant="ghost" size="sm" className="text-xs text-green-600" disabled={realizarMut.isPending}
                                                                onClick={() => realizarMut.mutate({ id: a.id })}>
                                                                Realizar
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="text-xs text-amber-600" disabled={faltouMut.isPending}
                                                                onClick={() => faltouMut.mutate({ id: a.id })}>
                                                                Faltou
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="text-xs text-red-600" disabled={cancelarMut.isPending}
                                                                onClick={() => handleCancelClick(a.id)}>
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
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const agendaQ = trpc.atendimentos.agendaListar.useQuery();
    const criarSlots = trpc.atendimentos.agendaCriarSlots.useMutation({
        onSuccess: () => { utils.atendimentos.agendaListar.invalidate(); toast({ title: 'Agenda configurada!', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    const [horaInicio, setHoraInicio] = useState('08:00');
    const [horaFim, setHoraFim] = useState('18:00');
    const [intervalo, setIntervalo] = useState<15 | 30 | 60>(30);

    const cfg = agendaQ.data?.[0];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-semibold">Configuração da Agenda</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {cfg && (
                    <div className="rounded-lg bg-blue-50 p-4 text-sm">
                        <p><strong>Configuração atual:</strong></p>
                        <p className="flex items-center gap-2 mt-1">
                            <Clock className="h-4 w-4" />
                            {(cfg.hora_inicio as string)?.slice(0, 5)} às {(cfg.hora_fim as string)?.slice(0, 5)} • Intervalo: {cfg.intervalo_minutos} min
                        </p>
                    </div>
                )}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        criarSlots.mutate({ hora_inicio: horaInicio, hora_fim: horaFim, intervalo_minutos: intervalo });
                    }}
                    className="grid gap-4 sm:grid-cols-4 items-end"
                >
                    <div>
                        <label className="text-xs font-medium text-gray-500">Hora Início</label>
                        <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500">Hora Fim</label>
                        <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-500">Intervalo (min)</label>
                        <select
                            aria-label="Intervalo"
                            className="w-full rounded-md border px-3 py-2 text-sm"
                            value={intervalo}
                            onChange={(e) => setIntervalo(Number(e.target.value) as 15 | 30 | 60)}
                        >
                            <option value={15}>15</option>
                            <option value={30}>30</option>
                            <option value={60}>60</option>
                        </select>
                    </div>
                    <Button type="submit" disabled={criarSlots.isPending}>
                        {criarSlots.isPending ? 'Salvando…' : 'Salvar Agenda'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
