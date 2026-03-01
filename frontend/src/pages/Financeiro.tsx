import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search, DollarSign, TrendingUp, CreditCard } from 'lucide-react';

export default function Financeiro() {
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

    const finQ = trpc.financeiro.list.useQuery(
        statusFilter ? { status: statusFilter as any } : undefined,
    );

    const fmt = (v: string | number | null) =>
        v == null ? 'R$ 0,00' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const fmtDate = (d: string | Date | null) => {
        if (!d) return '–';
        return new Date(d).toLocaleDateString('pt-BR');
    };

    const statusDisplay = (f: { status: string; data_pagamento: string | Date | null; data_vencimento: string | Date | null }) => {
        if (f.data_pagamento) return { label: fmtDate(f.data_pagamento), variant: 'success' as const };
        if (f.status === 'CANCELADO') return { label: 'Cancelada', variant: 'destructive' as const };
        const venc = new Date(f.data_vencimento as string);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (venc < hoje) return { label: 'Em atraso', variant: 'destructive' as const };
        return { label: 'Em aberto', variant: 'outline' as const };
    };

    const filtered = finQ.data?.filter((f) =>
        !search ||
        (f.pessoa_nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (f.forma_pagamento_nome ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    // Summaries
    const totalGeral = filtered?.reduce((s, f) => s + Number(f.valor), 0) ?? 0;
    const totalPago = filtered?.filter((f) => f.data_pagamento).reduce((s, f) => s + Number(f.valor), 0) ?? 0;
    const totalPendente = filtered?.filter((f) => f.status === 'PENDENTE').reduce((s, f) => s + Number(f.valor), 0) ?? 0;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Financeiro</h2>

            {/* Summary cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Total</p>
                            <p className="text-lg font-bold text-blue-600">{fmt(totalGeral)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Recebido</p>
                            <p className="text-lg font-bold text-green-600">{fmt(totalPago)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">A Receber</p>
                            <p className="text-lg font-bold text-amber-600">{fmt(totalPendente)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Buscar pessoa…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <div className="flex gap-2 flex-wrap">
                    <Button variant={!statusFilter ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(undefined)}>Todos</Button>
                    {['PENDENTE', 'PAGO', 'CANCELADO'].map((s) => (
                        <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
                            {s}
                        </Button>
                    ))}
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pessoa</TableHead>
                                <TableHead>Parcela</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead className="hidden sm:table-cell">Forma Pgto</TableHead>
                                <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {finQ.isLoading && (
                                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Carregando…</TableCell></TableRow>
                            )}
                            {filtered?.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Nenhum lançamento.</TableCell></TableRow>
                            )}
                            {filtered?.map((f) => {
                                const st = statusDisplay(f);
                                return (
                                    <TableRow key={f.id}>
                                        <TableCell className="font-medium">{f.pessoa_nome}</TableCell>
                                        <TableCell>{f.parcela ?? '–'}</TableCell>
                                        <TableCell className="font-medium">{fmt(f.valor)}</TableCell>
                                        <TableCell className="hidden sm:table-cell">{f.forma_pagamento_nome ?? '–'}</TableCell>
                                        <TableCell className="hidden md:table-cell">{fmtDate(f.data_vencimento)}</TableCell>
                                        <TableCell>
                                            <Badge variant={st.variant}>{st.label}</Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
