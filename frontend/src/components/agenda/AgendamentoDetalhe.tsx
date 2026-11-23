import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CalendarClock, CheckCircle2, DoorOpen, MessageCircle, Package, Pencil, Repeat, UserX, XCircle } from 'lucide-react';
import { STATUS_ABERTOS, STATUS_INFO, corPadrao, dataBR, type StatusAtendimento } from '@/lib/agenda';
import { cn } from '@/lib/utils';

export type EventoAgenda = {
    id: number;
    data: string;
    hora_inicio: string;
    hora_fim: string;
    status: StatusAtendimento;
    id_profissional: number;
    profissional_nome: string;
    profissional_cor: string | null;
    id_sala: number | null;
    sala_nome: string | null;
    id_pessoa: number;
    pessoa_nome: string;
    pessoa_telefone: string | null;
    id_venda: number | null;
    venda_rotulo: string | null;
    id_recorrencia: number | null;
    observacoes: string | null;
    confirmado_em: string | null;
    lembrete_enviado_em: string | null;
    restrito: boolean;
    servicos: { id: number; nome: string; duracao: number }[];
};

type Props = {
    evento: EventoAgenda | null;
    onOpenChange: (v: boolean) => void;
    onEditar: (e: EventoAgenda) => void;
};

export function AgendamentoDetalhe({ evento, onOpenChange, onEditar }: Props) {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [cancelando, setCancelando] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [cancelarSerie, setCancelarSerie] = useState(false);

    const statusMut = trpc.agenda.alterarStatus.useMutation({
        onSuccess: (r: any, vars: any) => {
            utils.agenda.eventos.invalidate();
            utils.atendimentos.list.invalidate();
            utils.vendas.list.invalidate();
            const label = STATUS_INFO[vars.status as StatusAtendimento].label.toLowerCase();
            toast({ title: r.atualizados > 1 ? `${r.atualizados} atendimentos: ${label}` : `Atendimento ${label}`, variant: 'success' });
            setCancelando(false);
            onOpenChange(false);
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const lembreteMut = trpc.agenda.marcarLembreteEnviado.useMutation({
        onSuccess: () => utils.agenda.eventos.invalidate(),
    });

    const aberto = !!evento;
    const podeAgir = evento && !evento.restrito && STATUS_ABERTOS.includes(evento.status);
    const tipoMsg = evento?.status === 'CONFIRMADO' ? 'LEMBRETE' : 'CONFIRMACAO';
    const waQ = trpc.agenda.whatsapp.useQuery(
        { id: evento?.id ?? 0, tipo: tipoMsg },
        { enabled: aberto && !evento?.restrito && !!evento?.pessoa_telefone },
    );

    if (!evento) return null;
    const info = STATUS_INFO[evento.status];

    function abrirWhatsApp() {
        const link = (waQ.data as any)?.link;
        if (!link) return toast({ title: 'Cliente sem telefone válido', variant: 'error' });
        window.open(link, '_blank', 'noopener');
        lembreteMut.mutate({ id: evento!.id });
    }

    return (
        <Dialog open={aberto} onOpenChange={(v) => { if (!v) { setCancelando(false); setMotivo(''); setCancelarSerie(false); } onOpenChange(v); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium', info.classe)}>{info.label}</span>
                        {evento.id_recorrencia && <span className="inline-flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]"><Repeat className="h-3 w-3" /> série</span>}
                    </div>
                    <DialogTitle className="pt-1">{evento.restrito ? 'Horário ocupado' : evento.pessoa_nome}</DialogTitle>
                </DialogHeader>

                <dl className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                        {dataBR(evento.data)}, {evento.hora_inicio}–{evento.hora_fim}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: corPadrao(evento.id_profissional, evento.profissional_cor) }} />
                        {evento.profissional_nome}
                    </div>
                    {evento.sala_nome && (
                        <div className="flex items-center gap-2"><DoorOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> {evento.sala_nome}</div>
                    )}
                    {!evento.restrito && (
                        <>
                            {evento.servicos.length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {evento.servicos.map((s) => (
                                        <span key={s.id} className="rounded-full bg-[hsl(var(--secondary))] px-2 py-0.5 text-xs">{s.nome} · {s.duracao}′</span>
                                    ))}
                                </div>
                            )}
                            {evento.venda_rotulo && (
                                <div className="flex items-center gap-2"><Package className="h-4 w-4 text-[hsl(var(--muted-foreground))]" /> {evento.venda_rotulo}</div>
                            )}
                            {evento.pessoa_telefone && <div className="text-[hsl(var(--muted-foreground))]">Tel.: {evento.pessoa_telefone}</div>}
                            {evento.observacoes && <p className="rounded-md bg-[hsl(var(--muted))] p-2 text-[hsl(var(--muted-foreground))]">{evento.observacoes}</p>}
                            {evento.lembrete_enviado_em && (
                                <p className="text-xs text-emerald-700">WhatsApp enviado em {new Date(evento.lembrete_enviado_em).toLocaleString('pt-BR')}</p>
                            )}
                        </>
                    )}
                </dl>

                {cancelando && (
                    <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                        <input className="w-full rounded-md border px-2 py-1.5" placeholder="Motivo (opcional)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                        {evento.id_recorrencia && (
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={cancelarSerie} onChange={(e) => setCancelarSerie(e.target.checked)} />
                                Cancelar também as próximas sessões da série
                            </label>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setCancelando(false)}>Voltar</Button>
                            <Button size="sm" variant="destructive" disabled={statusMut.isPending}
                                onClick={() => statusMut.mutate({ id: evento.id, status: 'CANCELADO', motivo: motivo.trim() || undefined, aplicarProximas: cancelarSerie })}>
                                Confirmar cancelamento
                            </Button>
                        </div>
                    </div>
                )}

                {podeAgir && !cancelando && (
                    <DialogFooter className="flex-wrap gap-2 sm:justify-start sm:space-x-0">
                        {evento.pessoa_telefone && (
                            <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={abrirWhatsApp} disabled={!waQ.data}>
                                <MessageCircle className="mr-1.5 h-4 w-4" /> {tipoMsg === 'LEMBRETE' ? 'Lembrete' : 'Confirmar'} no WhatsApp
                            </Button>
                        )}
                        {evento.status === 'AGENDADO' && (
                            <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: evento.id, status: 'CONFIRMADO' })} disabled={statusMut.isPending}>
                                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Cliente confirmou
                            </Button>
                        )}
                        <Button size="sm" onClick={() => statusMut.mutate({ id: evento.id, status: 'REALIZADO' })} disabled={statusMut.isPending}>
                            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Realizado
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => statusMut.mutate({ id: evento.id, status: 'FALTOU' })} disabled={statusMut.isPending}>
                            <UserX className="mr-1.5 h-4 w-4" /> Faltou
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onEditar(evento)}>
                            <Pencil className="mr-1.5 h-4 w-4" /> Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setCancelando(true)}>
                            <XCircle className="mr-1.5 h-4 w-4" /> Cancelar
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
