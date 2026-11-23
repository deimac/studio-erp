import { useMemo } from 'react';
import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';
import { Ban, Check, CheckCheck, MessageCircle, Plus } from 'lucide-react';
import { STATUS_ABERTOS, STATUS_INFO, corPadrao, dataISO, minutos, paraDate, type StatusAtendimento } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import type { EventoAgenda } from './AgendamentoDetalhe';

/**
 * Agenda do dia para o celular: faixa da semana + lista cronológica com
 * atendimentos (ações rápidas), bloqueios e horários livres (toque para agendar).
 */

type Bloqueio = { id: number; id_profissional: number | null; id_sala: number | null; inicio: string; fim: string; motivo: string | null };
type Horario = { id_profissional: number; dia_semana: number; hora_inicio: string; hora_fim: string };
type Prof = { id: number; nome: string; cor: string | null };

type Props = {
    data: Date;
    onData: (d: Date) => void;
    atendimentos: EventoAgenda[];
    bloqueios: Bloqueio[];
    horarios: Horario[];
    profissionais: Prof[];
    /** Profissionais visíveis (filtro). */
    visiveis: Prof[];
    /** Profissional de referência para os horários livres. */
    idReferencia: number | undefined;
    carregando: boolean;
    onAbrir: (e: EventoAgenda) => void;
    onNovo: (hora?: string) => void;
    onBloqueio: (b: Bloqueio) => void;
};

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MIN_LIVRE = 30;

type Item =
    | { tipo: 'atendimento'; inicio: number; fim: number; a: EventoAgenda }
    | { tipo: 'bloqueio'; inicio: number; fim: number; b: Bloqueio }
    | { tipo: 'livre'; inicio: number; fim: number };

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function AgendaDia(p: Props) {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const dia = dataISO(p.data);
    const hoje = dataISO(new Date());

    // Semana (seg–dom) com quantidade de atendimentos por dia
    const semana = useMemo(() => {
        const base = new Date(p.data);
        const desloc = (base.getDay() + 6) % 7;
        base.setDate(base.getDate() - desloc);
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            const iso = dataISO(d);
            return { d, iso, qtd: p.atendimentos.filter((a) => a.data === iso && a.status !== 'CANCELADO').length };
        });
    }, [p.data, p.atendimentos]);

    const doDia = p.atendimentos
        .filter((a) => a.data === dia && a.status !== 'CANCELADO')
        .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

    const itens: Item[] = useMemo(() => {
        const lista: Item[] = doDia.map((a) => ({ tipo: 'atendimento' as const, inicio: minutos(a.hora_inicio), fim: minutos(a.hora_fim), a }));
        const visiveisIds = new Set(p.visiveis.map((v) => v.id));
        for (const b of p.bloqueios) {
            if (b.id_profissional != null && !visiveisIds.has(b.id_profissional)) continue;
            const [di, hi] = b.inicio.split(' ');
            const [df, hf] = b.fim.split(' ');
            if (dia < di || dia > df) continue;
            const inicio = dia === di ? minutos(hi) : 0;
            const fim = dia === df ? minutos(hf) : 24 * 60;
            if (fim > inicio) lista.push({ tipo: 'bloqueio', inicio, fim, b });
        }
        // Horários livres no expediente do profissional de referência
        if (p.idReferencia != null) {
            const ds = p.data.getDay();
            const periodos = p.horarios
                .filter((h) => h.id_profissional === p.idReferencia && h.dia_semana === ds)
                .map((h) => [minutos(h.hora_inicio), minutos(h.hora_fim)] as const)
                .sort((a, b) => a[0] - b[0]);
            const ocupados = lista.map((i) => [i.inicio, i.fim] as const).sort((a, b) => a[0] - b[0]);
            const agora = dia === hoje ? new Date().getHours() * 60 + new Date().getMinutes() : -1;
            for (const [ini, fim] of periodos) {
                let cursor = Math.max(ini, dia < hoje ? fim : agora > ini ? Math.ceil(agora / 30) * 30 : ini);
                for (const [oi, of] of ocupados) {
                    if (of <= cursor || oi >= fim) continue;
                    if (oi - cursor >= MIN_LIVRE) lista.push({ tipo: 'livre', inicio: cursor, fim: oi });
                    cursor = Math.max(cursor, of);
                }
                if (fim - cursor >= MIN_LIVRE) lista.push({ tipo: 'livre', inicio: cursor, fim });
            }
        }
        return lista.sort((a, b) => a.inicio - b.inicio || (a.tipo === 'livre' ? 1 : -1));
    }, [doDia, p.bloqueios, p.horarios, p.idReferencia, p.visiveis, dia, hoje, p.data]);

    const statusMut = trpc.agenda.alterarStatus.useMutation({
        onSuccess: (_r: any, v: any) => {
            utils.agenda.eventos.invalidate();
            toast({ title: v.status === 'CONFIRMADO' ? 'Presença confirmada' : 'Atendimento realizado', variant: 'success' });
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const lembreteMut = trpc.agenda.marcarLembreteEnviado.useMutation({ onSuccess: () => utils.agenda.eventos.invalidate() });

    async function whatsapp(a: EventoAgenda) {
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

    const confirmados = doDia.filter((a) => a.status === 'CONFIRMADO').length;
    const muitosProfs = p.visiveis.length > 1;

    return (
        <div className="space-y-3 pb-24">
            {/* Semana */}
            <div className="grid grid-cols-7 gap-1">
                {semana.map(({ d, iso, qtd }) => {
                    const ativo = iso === dia;
                    return (
                        <button key={iso} type="button" onClick={() => p.onData(d)} aria-label={`${DIAS[d.getDay()]} ${d.getDate()}, ${qtd} atendimentos`}
                            className={cn('flex flex-col items-center rounded-xl py-1.5 transition-colors',
                                ativo ? 'bg-[hsl(var(--primary))] text-white' : iso === hoje ? 'bg-[hsl(var(--primary))]/10' : 'hover:bg-[hsl(var(--accent))]')}>
                            <span className={cn('text-[11px]', ativo ? 'text-white/80' : 'text-[hsl(var(--muted-foreground))]')}>{DIAS[d.getDay()]}</span>
                            <span className="text-base font-semibold tabular-nums">{d.getDate()}</span>
                            <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', qtd ? (ativo ? 'bg-white' : 'bg-[hsl(var(--primary))]') : 'bg-transparent')} />
                        </button>
                    );
                })}
            </div>

            {/* Resumo */}
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {p.carregando ? 'Carregando…' : doDia.length === 0 ? 'Nenhum atendimento neste dia.'
                    : `${doDia.length} atendimento${doDia.length > 1 ? 's' : ''}${confirmados ? ` · ${confirmados} confirmado${confirmados > 1 ? 's' : ''}` : ''}`}
            </p>

            {/* Linha do tempo */}
            <ol className="space-y-2">
                {itens.map((it) => {
                    if (it.tipo === 'livre') {
                        return (
                            <li key={`l${it.inicio}`}>
                                <button type="button" onClick={() => p.onNovo(hhmm(it.inicio))}
                                    className="flex w-full items-center gap-3 rounded-xl border border-dashed px-3 py-2.5 text-left text-sm text-[hsl(var(--muted-foreground))] active:bg-[hsl(var(--accent))]">
                                    <span className="w-12 shrink-0 tabular-nums">{hhmm(it.inicio)}</span>
                                    <span className="flex-1">Livre até {hhmm(it.fim)}</span>
                                    <span className="inline-flex items-center gap-1 font-medium text-[hsl(var(--primary))]"><Plus className="h-4 w-4" /> Agendar</span>
                                </button>
                            </li>
                        );
                    }
                    if (it.tipo === 'bloqueio') {
                        const nome = it.b.id_profissional != null ? p.profissionais.find((x) => x.id === it.b.id_profissional)?.nome.split(' ')[0] : 'Clínica';
                        return (
                            <li key={`b${it.b.id}`}>
                                <button type="button" onClick={() => p.onBloqueio(it.b)}
                                    className="agenda-legenda-bloqueio flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-900">
                                    <span className="w-12 shrink-0 tabular-nums">{hhmm(it.inicio)}</span>
                                    <Ban className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 flex-1 truncate">{it.b.motivo || 'Bloqueado'} · {nome}</span>
                                    <span className="tabular-nums text-xs">até {hhmm(it.fim)}</span>
                                </button>
                            </li>
                        );
                    }
                    const a = it.a;
                    const cor = corPadrao(a.id_profissional, a.profissional_cor);
                    const info = STATUS_INFO[a.status as StatusAtendimento];
                    const aberto = !a.restrito && STATUS_ABERTOS.includes(a.status);
                    const passou = paraDate(a.data, a.hora_fim) < new Date();
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
                                    {!a.restrito && a.servicos.length > 0 && (
                                        <p className="truncate text-sm text-[hsl(var(--muted-foreground))]">{a.servicos.map((s) => s.nome).join(', ')}</p>
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
                                            <button type="button" onClick={() => whatsapp(a)}
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
                })}
            </ol>

            {!p.carregando && itens.length === 0 && (
                <button type="button" onClick={() => p.onNovo()}
                    className="w-full rounded-xl border border-dashed px-4 py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                    Dia livre. Toque para agendar.
                </button>
            )}
        </div>
    );
}

