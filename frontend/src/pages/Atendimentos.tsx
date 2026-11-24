import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useEscopo } from '@/hooks/useEscopo';
import { trpc } from '@/services/trpc';
import { AtendimentoForm } from '@/components/AtendimentoForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ListaAtendimentos, statusAtendimento } from '@/components/ListaAtendimentos';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Search, Calendar, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export default function Atendimentos() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

    const { escopo } = useEscopo();
    const atendQ = trpc.atendimentos.list.useQuery({ ...(statusFilter ? { status: statusFilter as any } : {}), escopo });

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
                    <div className="hidden gap-4 sm:grid sm:grid-cols-3 lg:grid-cols-5">
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
                            {Object.entries(statusAtendimento).map(([k, v]) => (
                                <Button key={k} variant={statusFilter === k ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(k)}>
                                    {v.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            <ListaAtendimentos atendimentos={filtered} carregando={atendQ.isLoading} />
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
