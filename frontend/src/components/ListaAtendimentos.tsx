import { trpc } from '@/services/trpc';
import { dataBR } from '@/lib/datas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Calendar, CheckCircle, XCircle, AlertCircle, Sparkles, Package } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';

export const statusAtendimento: Record<string, { label: string; variant: 'default' | 'success' | 'destructive' | 'secondary' | 'outline'; icon: typeof Calendar }> = {
    AGENDADO: { label: 'Agendado', variant: 'default', icon: Calendar },
    CONFIRMADO: { label: 'Confirmado', variant: 'success', icon: CheckCircle },
    REALIZADO: { label: 'Realizado', variant: 'success', icon: CheckCircle },
    CANCELADO: { label: 'Cancelado', variant: 'destructive', icon: XCircle },
    FALTOU: { label: 'Faltou', variant: 'secondary', icon: AlertCircle },
};

const fmtTime = (t: string | null) => t?.slice(0, 5) ?? '–';

/**
 * Lista de atendimentos usada na tela Atendimentos e no Dashboard:
 * cartões no celular, tabela no computador, com Realizar / Faltou / Cancelar.
 */
export function ListaAtendimentos({ atendimentos, carregando, vazio = 'Nenhum atendimento.' }: {
    atendimentos: any[] | undefined;
    carregando: boolean;
    vazio?: string;
}) {
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();

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
        <>
            {/* Celular: cartões */}
            <ul className="divide-y md:hidden">
                {carregando && <li className="py-8 text-center text-gray-400">Carregando…</li>}
                {!carregando && atendimentos?.length === 0 && <li className="py-8 text-center text-gray-400">{vazio}</li>}
                {atendimentos?.map((a) => {
                    const cfg = statusAtendimento[a.status] ?? statusAtendimento.AGENDADO;
                    const Icon = cfg.icon;
                    const aberto = a.status === 'AGENDADO' || a.status === 'CONFIRMADO';
                    return (
                        <li key={a.id} className="space-y-2 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate font-semibold">{a.pessoa_nome}</p>
                                    <p className="text-sm tabular-nums text-gray-500">{dataBR(a.data)} · {fmtTime(a.hora_inicio)}–{fmtTime(a.hora_fim)}</p>
                                </div>
                                <Badge variant={cfg.variant} className="shrink-0 gap-1">
                                    <Icon className="h-3 w-3" />
                                    {cfg.label}
                                </Badge>
                            </div>
                            <p className="truncate text-sm text-gray-600">
                                {a.servico_nome ?? a.pacote_nome ?? 'Serviço'} · {a.profissional_nome}
                            </p>
                            {aberto && (
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    <Button variant="outline" size="sm" className="h-10 gap-1 text-green-700" disabled={realizarMut.isPending} onClick={() => realizarMut.mutate({ id: a.id })}>
                                        <CheckCircle className="h-4 w-4" /> Realizar
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-10 gap-1 text-amber-700" disabled={faltouMut.isPending} onClick={() => faltouMut.mutate({ id: a.id })}>
                                        <AlertCircle className="h-4 w-4" /> Faltou
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-10 gap-1 text-red-700" disabled={cancelarMut.isPending} onClick={() => handleCancelClick(a.id)}>
                                        <XCircle className="h-4 w-4" /> Cancelar
                                    </Button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>

            {/* Computador: tabela */}
            <div className="hidden md:block">
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
                        {carregando && (
                            <TableRow><TableCell colSpan={6} className="py-8 text-center text-gray-400">Carregando…</TableCell></TableRow>
                        )}
                        {!carregando && atendimentos?.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="py-8 text-center text-gray-400">{vazio}</TableCell></TableRow>
                        )}
                        {atendimentos?.map((a) => {
                            const cfg = statusAtendimento[a.status] ?? statusAtendimento.AGENDADO;
                            const Icon = cfg.icon;
                            return (
                                <TableRow key={a.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-gray-400" />
                                            <div>
                                                <p className="font-medium">{dataBR(a.data)}</p>
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
                                                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-green-600 hover:bg-green-50 hover:text-green-700"
                                                    disabled={realizarMut.isPending} onClick={() => realizarMut.mutate({ id: a.id })}>
                                                    <CheckCircle className="h-3.5 w-3.5" /> Realizar
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                                    disabled={faltouMut.isPending} onClick={() => faltouMut.mutate({ id: a.id })}>
                                                    <AlertCircle className="h-3.5 w-3.5" /> Faltou
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    disabled={cancelarMut.isPending} onClick={() => handleCancelClick(a.id)}>
                                                    <XCircle className="h-3.5 w-3.5" /> Cancelar
                                                </Button>
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
