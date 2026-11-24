import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';
import { Check, CheckCheck, MessageCircle } from 'lucide-react';
import { STATUS_ABERTOS, STATUS_INFO, corPadrao, paraDate, type StatusAtendimento } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { nomesAtendimento, type EventoAgenda } from './AgendamentoDetalhe';

/** Cartão de atendimento do celular: horário, cliente, serviços e ações rápidas (WhatsApp, Confirmou/Realizado). */
export function CartaoAtendimento({ a, mostrarProfissional, onAbrir }: { a: EventoAgenda; mostrarProfissional: boolean; onAbrir: (e: EventoAgenda) => void }) {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const statusMut = trpc.agenda.alterarStatus.useMutation({
        onSuccess: (_r: any, v: any) => {
            utils.agenda.eventos.invalidate();
            toast({ title: v.status === 'CONFIRMADO' ? 'Presença confirmada' : 'Atendimento realizado', variant: 'success' });
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const lembreteMut = trpc.agenda.marcarLembreteEnviado.useMutation({ onSuccess: () => utils.agenda.eventos.invalidate() });

    async function whatsapp() {
        // Abre a janela já no toque (o celular bloqueia janelas abertas depois de esperar a rede)
        const janela = window.open('', '_blank');
        try {
            const r: any = await utils.client.agenda.whatsapp.query({ id: a.id, tipo: a.status === 'CONFIRMADO' ? 'LEMBRETE' : 'CONFIRMACAO' });
            if (!r.link) throw new Error('Cliente sem telefone válido');
            if (janela) janela.location.href = r.link;
            else window.location.href = r.link;
            lembreteMut.mutate({ id: a.id });
        } catch (e: any) {
            janela?.close();
            toast({ title: e.message, variant: 'error' });
        }
    }

    const cor = corPadrao(a.id_profissional, a.profissional_cor);
    const info = STATUS_INFO[a.status as StatusAtendimento];
    const aberto = !a.restrito && STATUS_ABERTOS.includes(a.status);
    const passou = paraDate(a.data, a.hora_fim) < new Date();
    const muitosProfs = mostrarProfissional;
    const p = { onAbrir };
    return (
        <li key={a.id} className={cn('flex gap-3', a.restrito && 'opacity-70')}>
            <div className="w-12 shrink-0 pt-3 text-right">
                <p className="text-sm font-semibold tabular-nums">{a.hora_inicio}</p>
                <p className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">{a.hora_fim}</p>
            </div>
            <div className={cn('min-w-0 flex-1 overflow-hidden rounded-xl border bg-white shadow-sm', a.restrito && 'evt-restrito')}
                style={{ borderColor: `color-mix(in srgb, ${cor} 35%, white)` }}>
                <button type="button" onClick={() => p.onAbrir(a)} className="block w-full px-3 py-2.5 text-left active:bg-[hsl(var(--accent))]">
                    <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate font-semibold">{a.restrito ? 'Ocupado' : a.pessoa_nome}</p>
                        {!a.restrito && (
                            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', info.classe)}>{info.label}</span>
                        )}
                    </div>
                    {!a.restrito && nomesAtendimento(a) && (
                        <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">{nomesAtendimento(a)}</p>
                    )}
                    {(muitosProfs || a.restrito) && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                            <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
                            {a.profissional_nome}
                        </p>
                    )}
                </button>
                {aberto && (
                    <div className="flex border-t text-sm">
                        {a.pessoa_telefone && (
                            <button type="button" onClick={whatsapp}
                                className="flex flex-1 items-center justify-center gap-1.5 py-2.5 font-medium text-emerald-700 active:bg-emerald-50">
                                <MessageCircle className="h-4 w-4" /> WhatsApp
                                {a.lembrete_enviado_em && <Check className="h-3.5 w-3.5" aria-label="já enviado" />}
                            </button>
                        )}
                        {a.status === 'AGENDADO' && !passou ? (
                            <button type="button" disabled={statusMut.isPending} onClick={() => statusMut.mutate({ id: a.id, status: 'CONFIRMADO' })}
                                className="flex flex-1 items-center justify-center gap-1.5 border-l py-2.5 font-medium active:bg-[hsl(var(--accent))]">
                                <Check className="h-4 w-4" /> Confirmou
                            </button>
                        ) : (
                            <button type="button" disabled={statusMut.isPending} onClick={() => statusMut.mutate({ id: a.id, status: 'REALIZADO' })}
                                className="flex flex-1 items-center justify-center gap-1.5 border-l py-2.5 font-medium text-[hsl(var(--primary))] active:bg-[hsl(var(--accent))]">
                                <CheckCheck className="h-4 w-4" /> Realizado
                            </button>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}
