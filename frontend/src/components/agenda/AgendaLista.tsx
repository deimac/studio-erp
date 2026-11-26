import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, ChevronRight } from 'lucide-react';
import { dataISO, paraDate } from '@/lib/agenda';
import { cn } from '@/lib/utils';
import { CartaoAtendimento } from './CartaoAtendimento';
import type { EventoAgenda } from './AgendamentoDetalhe';

/**
 * Semana e Lista no celular: atendimentos agrupados por dia, com os mesmos
 * cartões da agenda do dia. Na semana todos os dias aparecem (dia livre vira
 * uma linha curta para abrir o dia); na lista só os dias com algo marcado.
 */

type Bloqueio = { id: number; id_profissional: number | null; inicio: string; fim: string; motivo: string | null };
type Prof = { id: number; nome: string };

type Props = {
    de: Date;
    ate: Date;
    mostrarVazios: boolean;
    atendimentos: EventoAgenda[];
    bloqueios: Bloqueio[];
    profissionais: Prof[];
    visiveis: Prof[];
    carregando: boolean;
    onAbrir: (e: EventoAgenda) => void;
    onDia: (d: Date) => void;
    onBloqueio: (b: Bloqueio) => void;
};

export function AgendaLista(p: Props) {
    const hoje = dataISO(new Date());
    const visiveisIds = new Set(p.visiveis.map((v) => v.id));
    const muitosProfs = p.visiveis.length > 1;

    const dias: string[] = [];
    for (let d = p.de, fim = dataISO(p.ate); dataISO(d) <= fim; d = addDays(d, 1)) dias.push(dataISO(d));

    const grupos = dias
        .map((iso) => ({
            iso,
            atendimentos: p.atendimentos
                .filter((a) => a.data === iso && a.status !== 'CANCELADO')
                .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)),
            bloqueios: p.bloqueios.filter(
                (b) => (b.id_profissional == null || visiveisIds.has(b.id_profissional)) && b.inicio.slice(0, 10) <= iso && b.fim.slice(0, 10) >= iso,
            ),
        }))
        .filter((g) => p.mostrarVazios || g.atendimentos.length || g.bloqueios.length);

    const total = grupos.reduce((n, g) => n + g.atendimentos.length, 0);

    return (
        <div className="space-y-4 pb-24">
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
                {p.carregando ? 'Carregando…' : total === 0 ? 'Nenhum atendimento no período.' : `${total} atendimento${total > 1 ? 's' : ''}`}
            </p>

            {grupos.map((g) => {
                const d = paraDate(g.iso);
                const t = format(d, "EEEE, d 'de' MMM", { locale: ptBR });
                const vazio = !g.atendimentos.length && !g.bloqueios.length;
                return (
                    <section key={g.iso} className="space-y-2">
                        <button type="button" onClick={() => p.onDia(d)}
                            className={cn('flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left active:bg-[hsl(var(--accent))]',
                                g.iso < hoje && 'opacity-60')}>
                            <span className={cn('text-sm font-semibold', g.iso === hoje && 'text-[hsl(var(--primary))]')}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                                {g.iso === hoje && ' · hoje'}
                            </span>
                            <span className="ml-auto flex items-center gap-1 text-xs text-[hsl(var(--muted-foreground))]">
                                {vazio ? 'Livre' : g.atendimentos.length ? `${g.atendimentos.length} atend.` : ''}
                                <ChevronRight className="h-4 w-4" />
                            </span>
                        </button>

                        {g.bloqueios.map((b) => {
                            const nome = b.id_profissional != null ? p.profissionais.find((x) => x.id === b.id_profissional)?.nome.split(' ')[0] : 'Clínica';
                            const [di, hi] = b.inicio.split(' ');
                            const [df, hf] = b.fim.split(' ');
                            const faixa = di === g.iso && df === g.iso ? `${hi.slice(0, 5)}–${hf.slice(0, 5)}` : di === g.iso ? `a partir de ${hi.slice(0, 5)}` : df === g.iso ? `até ${hf.slice(0, 5)}` : 'dia todo';
                            return (
                                <button key={`b${b.id}`} type="button" onClick={() => p.onBloqueio(b)}
                                    className="agenda-legenda-bloqueio flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm">
                                    <Ban className="h-4 w-4 shrink-0" />
                                    <span className="min-w-0 flex-1 truncate">{b.motivo || 'Bloqueado'} · {nome}</span>
                                    <span className="shrink-0 text-xs tabular-nums">{faixa}</span>
                                </button>
                            );
                        })}

                        {g.atendimentos.length > 0 && (
                            <ol className="space-y-2">
                                {g.atendimentos.map((a) => (
                                    <CartaoAtendimento key={a.id} a={a} mostrarProfissional={muitosProfs} onAbrir={p.onAbrir} />
                                ))}
                            </ol>
                        )}
                    </section>
                );
            })}
        </div>
    );
}
