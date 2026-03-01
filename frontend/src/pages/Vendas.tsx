import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { VendaForm } from '@/components/VendaForm';
import { VendaDetail } from '@/components/VendaDetail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Trash2, Lock, ChevronDown, ChevronUp, Sparkles, Package } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';

const fmt = (v: string | number) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (v: string | Date | null | undefined) => {
    if (!v) return '–';
    // Normaliza para string yyyy-mm-dd
    let s: string;
    if (v instanceof Date) {
        s = v.toISOString().split('T')[0];
    } else {
        s = String(v).split('T')[0]; // remove parte T... de ISO strings
    }
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(v);
};

export default function Vendas() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'' | 'ATIVA' | 'ENCERRADA'>('');

    const vendasQ = trpc.vendas.list.useQuery(
        statusFilter ? { status: statusFilter as 'ATIVA' | 'ENCERRADA' } : undefined,
    );

    /* ── Detalhe (expandir linha) ── */
    const [expandedId, setExpandedId] = useState<number | null>(null);

    /* ── Encerrar ── */
    const [encerrarId, setEncerrarId] = useState<number | null>(null);
    const [motivo, setMotivo] = useState('');
    const encerrarMut = trpc.vendas.encerrar.useMutation({
        onSuccess: () => {
            toast({ title: 'Venda encerrada', variant: 'success' });
            utils.vendas.list.invalidate();
            setEncerrarId(null);
            setMotivo('');
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    /* ── Excluir ── */
    const deleteMut = trpc.vendas.delete.useMutation({
        onSuccess: () => {
            toast({ title: 'Venda excluída', variant: 'success' });
            utils.vendas.list.invalidate();
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    const filtered = vendasQ.data?.filter(
        (v) =>
            !search ||
            (v.pessoa_nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (v.servico_nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (v.pacote_nome ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold tracking-tight">Vendas</h2>
                <VendaForm
                    onSuccess={() => {
                        utils.vendas.list.invalidate();
                        toast({ title: 'Venda lançada!', variant: 'success' });
                    }}
                />
            </div>

            {/* Filtros */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar cliente, serviço ou pacote…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {(['', 'ATIVA', 'ENCERRADA'] as const).map((s) => (
                        <Button
                            key={s}
                            variant={statusFilter === s ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter(s)}
                        >
                            {s || 'Todas'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Tabela */}
            <Card>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-16">Cód.</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="hidden md:table-cell">Pacote / Serviço</TableHead>
                                <TableHead className="hidden lg:table-cell">Sessões</TableHead>
                                <TableHead className="hidden lg:table-cell">Data Venda</TableHead>
                                <TableHead className="hidden md:table-cell">Forma Pgto</TableHead>
                                <TableHead className="hidden sm:table-cell">Valor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="flex justify-end items-center ml-16">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {vendasQ.isLoading && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                                        Carregando…
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                                        Nenhuma venda encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered?.map((v) => {
                                const realizadas = v.sessoes_realizadas ?? 0;
                                const total = v.quantidade_sessoes ?? 0;
                                const pct = total > 0 ? Math.round((realizadas / total) * 100) : 0;
                                return (
                                    <>
                                        <TableRow
                                            key={v.id}
                                            className="cursor-pointer hover:bg-[hsl(var(--muted))]/50"
                                            onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                                        >
                                            <TableCell className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                                                {v.id}
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-medium">{v.pessoa_nome}</span>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <div className="flex items-center gap-2">
                                                    {v.pacote_nome ? (
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-600">
                                                            <Package className="h-3.5 w-3.5" />
                                                        </span>
                                                    ) : v.servico_nome ? (
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                                                            <Sparkles className="h-3.5 w-3.5" />
                                                        </span>
                                                    ) : null}
                                                    <span>{v.pacote_nome ?? v.servico_nome ?? '–'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                <div className="flex items-center gap-2 min-w-[120px]">
                                                    <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct > 0 ? 'bg-blue-500' : 'bg-gray-300'
                                                                }`}
                                                            style={{ width: `${Math.min(pct, 100)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-[hsl(var(--muted-foreground))] whitespace-nowrap">
                                                        {realizadas}/{total}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden lg:table-cell">
                                                {fmtDate(v.data_venda)}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-sm">
                                                {v.forma_pagamento_nome}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell font-medium">
                                                {fmt(v.valor)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={v.status === 'ATIVA' ? 'success' : 'secondary'}>
                                                    {v.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div
                                                    className="flex justify-end items-center gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {v.status === 'ATIVA' && v.canDelete && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={async () => {
                                                                const ok = await confirm({
                                                                    title: 'Excluir venda',
                                                                    description: 'Excluir esta venda e todas as parcelas? Essa ação não pode ser desfeita.',
                                                                    confirmLabel: 'Excluir',
                                                                    variant: 'danger',
                                                                });
                                                                if (ok) deleteMut.mutate({ id: v.id });
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {v.status === 'ATIVA' && v.canClose && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-xs"
                                                            onClick={() => setEncerrarId(v.id)}
                                                        >
                                                            <Lock className="mr-1 h-3.5 w-3.5" />
                                                            Encerrar
                                                        </Button>
                                                    )}
                                                    <span className="ml-1 text-[hsl(var(--muted-foreground))]" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                                                        {expandedId === v.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                    </span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                        {expandedId === v.id && (
                                            <TableRow key={`detail-${v.id}`}>
                                                <TableCell colSpan={9} className="p-0">
                                                    <VendaDetail venda={v} />
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modal: Encerrar Venda */}
            <Dialog open={!!encerrarId} onOpenChange={(open) => !open && setEncerrarId(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Encerrar Venda</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Parcelas não pagas serão canceladas. Informe o motivo do encerramento.
                        </p>
                        <div className="space-y-1.5">
                            <Label>Motivo do Encerramento</Label>
                            <Textarea
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                rows={3}
                                placeholder="Descreva o motivo…"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEncerrarId(null)}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() =>
                                encerrarId &&
                                encerrarMut.mutate({
                                    id: encerrarId,
                                    motivo_encerramento: motivo,
                                })
                            }
                            disabled={!motivo.trim() || encerrarMut.isPending}
                        >
                            {encerrarMut.isPending ? 'Encerrando…' : 'Encerrar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
