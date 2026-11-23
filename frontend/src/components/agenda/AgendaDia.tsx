import { useMemo } from 'react';
import { Ban, Plus } from 'lucide-react';
import { dataISO, minutos } from '@/lib/agenda';
import { CartaoAtendimento } from './CartaoAtendimento';
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
                    return <CartaoAtendimento key={it.a.id} a={it.a} mostrarProfissional={muitosProfs} onAbrir={p.onAbrir} />;
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

