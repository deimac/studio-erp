import { useMemo } from 'react';
import { dataISO } from '@/lib/agenda';
import { cn } from '@/lib/utils';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Faixa seg–dom para trocar de dia no celular; o ponto indica dia com atendimento e o número laranja, feriado. */
export function FaixaSemana({ data, onData, atendimentos, feriados }: { data: Date; onData: (d: Date) => void; atendimentos: { data: string; status: string }[]; feriados?: Map<string, string[]> }) {
    const dia = dataISO(data);
    const hoje = dataISO(new Date());
    const semana = useMemo(() => {
        const base = new Date(data);
        base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(base);
            d.setDate(base.getDate() + i);
            const iso = dataISO(d);
            return { d, iso, qtd: atendimentos.filter((a) => a.data === iso && a.status !== 'CANCELADO').length };
        });
    }, [data, atendimentos]);

    return (
        <div className="grid grid-cols-7 gap-1">
            {semana.map(({ d, iso, qtd }) => {
                const ativo = iso === dia;
                return (
                    <button key={iso} type="button" onClick={() => onData(d)} aria-label={`${DIAS[d.getDay()]} ${d.getDate()}, ${qtd} atendimentos${feriados?.has(iso) ? `, feriado: ${feriados.get(iso)!.join(', ')}` : ''}`}
                        className={cn('flex flex-col items-center rounded-xl py-1.5 transition-colors',
                            ativo ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : iso === hoje ? 'bg-[hsl(var(--primary))]/10' : 'hover:bg-[hsl(var(--accent))]')}>
                        <span className={cn('text-[11px]', ativo ? 'text-[hsl(var(--primary-foreground))]/80' : 'text-[hsl(var(--muted-foreground))]')}>{DIAS[d.getDay()]}</span>
                        <span className={cn('text-base font-semibold tabular-nums', !ativo && feriados?.has(iso) && 'text-amber-600')}>{d.getDate()}</span>
                        <span className={cn('mt-0.5 h-1.5 w-1.5 rounded-full', qtd ? (ativo ? 'bg-[hsl(var(--card))]' : 'bg-[hsl(var(--primary))]') : 'bg-transparent')} />
                    </button>
                );
            })}
        </div>
    );
}
