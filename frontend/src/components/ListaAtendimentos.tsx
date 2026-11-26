import { trpc } from '@/services/trpc';
import { diaISO } from '@/lib/datas';
import { dataISO, paraDate } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { useEscopo } from '@/hooks/useEscopo';
import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

const fmtTime = (t: string | null) => t?.slice(0, 5) ?? '';

/** "Hoje", "Amanhã" ou null. */
function diaRelativo(iso: string) {
    const hoje = new Date();
    if (iso === dataISO(hoje)) return 'Hoje';
    if (iso === dataISO(addDays(hoje, 1))) return 'Amanhã';
    return null;
}

/** Data em formato de folhinha de calendário: dia da semana, dia grande e mês. */
function Folhinha({ data, className }: { data: string; className?: string }) {
    const iso = diaISO(data) ?? '';
    if (!iso) return null;
    const d = paraDate(iso);
    const rel = diaRelativo(iso);
    return (
        <div className={cn(
            'flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border text-center',
            rel ? 'border-[hsl(var(--primary)/0.4)] bg-[hsl(var(--primary)/0.06)]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))]',
            className,
        )}>
            <span className={cn('w-full py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                rel ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]')}>
                {rel ?? format(d, 'EEE', { locale: ptBR }).replace('.', '').slice(0, 3)}
            </span>
            <span className="pt-0.5 text-xl font-bold leading-none tabular-nums">{format(d, 'd')}</span>
            <span className="pb-1 text-[11px] text-[hsl(var(--muted-foreground))]">{format(d, 'MMM', { locale: ptBR }).replace('.', '')}</span>
        </div>
    );
}

/**
 * Lista de atendimentos usada na tela Atendimentos e no Dashboard:
 * cartões no celular, tabela no computador, com Realizar / Faltou / Cancelar.
 */
export function ListaAtendimentos({ atendimentos, carregando, vazio = 'Nenhum atendimento.' }: {
    atendimentos: any[] | undefined;
    carregando: boolean;
    vazio?: string;
}) {
    // Na visão de um profissional só (Só meu / profissional logado) não repete quem atende
    const { valor } = useEscopo();
    const mostrarProfissional = valor !== 'MEU';
    const colunas = mostrarProfissional ? 6 : 5;
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
                        <li key={a.id} className="space-y-3 p-4">
                            <div className="flex gap-3">
                                <Folhinha data={a.data} />
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-lg font-bold leading-tight tabular-nums">
                                            {fmtTime(a.hora_inicio)}
                                            <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]"> até {fmtTime(a.hora_fim)}</span>
                                        </p>
                                        <Badge variant={cfg.variant} className="shrink-0 gap-1">
                                            <Icon className="h-3 w-3" />
                                            {cfg.label}
                                        </Badge>
                                    </div>
                                    <p className="truncate font-semibold">{a.pessoa_nome}</p>
                                    <p className="truncate text-sm text-gray-600">
                                        {a.servico_nome ?? a.pacote_nome ?? 'Serviço'}
                                        {mostrarProfissional && ` · ${a.profissional_nome}`}
                                    </p>
                                </div>
                            </div>
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
                            {mostrarProfissional && <TableHead className="hidden lg:table-cell">Profissional</TableHead>}
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {carregando && (
                            <TableRow><TableCell colSpan={colunas} className="py-8 text-center text-gray-400">Carregando…</TableCell></TableRow>
                        )}
                        {!carregando && atendimentos?.length === 0 && (
                            <TableRow><TableCell colSpan={colunas} className="py-8 text-center text-gray-400">{vazio}</TableCell></TableRow>
                        )}
                        {atendimentos?.map((a) => {
                            const cfg = statusAtendimento[a.status] ?? statusAtendimento.AGENDADO;
                            const Icon = cfg.icon;
                            return (
                                <TableRow key={a.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Folhinha data={a.data} />
                                            <div className="whitespace-nowrap">
                                                <p className="text-base font-bold tabular-nums">{fmtTime(a.hora_inicio)}</p>
                                                <p className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">até {fmtTime(a.hora_fim)}</p>
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
                                        ) : null}
                                    </TableCell>
                                    {mostrarProfissional && <TableCell className="hidden lg:table-cell">{a.profissional_nome}</TableCell>}
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
