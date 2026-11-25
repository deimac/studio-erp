import { useEffect, useRef, useState } from 'react';
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEMANA = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Props = {
    /** Data em foco na agenda. */
    data: Date;
    onData: (d: Date) => void;
    /** Texto do botão (o período que está na tela). */
    titulo: string;
    /** Na visão Mês só se escolhe o mês. */
    soMes?: boolean;
    className?: string;
};

/**
 * Escolha de data pelo título da agenda: dia, mês ou ano.
 * Só muda a data — a forma de ver (Dia/Semana/Mês/Lista) fica como está.
 */
export function SeletorData({ data, onData, titulo, soMes, className }: Props) {
    const [aberto, setAberto] = useState(false);
    const [modo, setModo] = useState<'dias' | 'meses'>('dias');
    const [mesVisto, setMesVisto] = useState(() => startOfMonth(data));
    const caixa = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!aberto) return;
        setMesVisto(startOfMonth(data));
        setModo(soMes ? 'meses' : 'dias');
        const fora = (e: PointerEvent) => { if (!caixa.current?.contains(e.target as Node)) setAberto(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setAberto(false); } };
        document.addEventListener('pointerdown', fora);
        document.addEventListener('keydown', esc, true);
        return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc, true); };
    }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

    const escolher = (d: Date) => { onData(d); setAberto(false); };
    const hoje = new Date();

    const dias: Date[] = [];
    for (let d = startOfWeek(mesVisto, { weekStartsOn: 1 }); d <= endOfWeek(endOfMonth(mesVisto), { weekStartsOn: 1 }); d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) dias.push(d);

    const seta = 'flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-[hsl(var(--accent))]';

    return (
        <div ref={caixa} className={cn('relative min-w-0', className)}>
            <button type="button" aria-haspopup="dialog" aria-expanded={aberto} aria-label={`${titulo}. Escolher data`}
                onClick={() => setAberto((v) => !v)}
                className="inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-lg font-semibold hover:bg-[hsl(var(--accent))]">
                <span className="truncate">{maiuscula(titulo)}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', aberto && 'rotate-180')} />
            </button>

            {aberto && (
                <div role="dialog" aria-label="Escolher data"
                    className="absolute left-1/2 top-full z-50 mt-1 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 md:left-0 md:translate-x-0 rounded-xl border bg-white p-3 shadow-lg">
                    <div className="mb-2 flex items-center justify-between">
                        <button type="button" aria-label={modo === 'dias' ? 'Mês anterior' : 'Ano anterior'} className={seta}
                            onClick={() => setMesVisto((m) => addMonths(m, modo === 'dias' ? -1 : -12))}><ChevronLeft className="h-4 w-4" /></button>
                        {modo === 'dias' ? (
                            <button type="button" onClick={() => setModo('meses')} className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-[hsl(var(--accent))]">
                                {maiuscula(format(mesVisto, "MMMM 'de' yyyy", { locale: ptBR }))}
                            </button>
                        ) : (
                            <span className="text-sm font-semibold tabular-nums">{mesVisto.getFullYear()}</span>
                        )}
                        <button type="button" aria-label={modo === 'dias' ? 'Próximo mês' : 'Próximo ano'} className={seta}
                            onClick={() => setMesVisto((m) => addMonths(m, modo === 'dias' ? 1 : 12))}><ChevronRight className="h-4 w-4" /></button>
                    </div>

                    {modo === 'dias' ? (
                        <div className="grid grid-cols-7 gap-0.5 text-center">
                            {SEMANA.map((s) => <span key={s} className="py-1 text-[11px] text-[hsl(var(--muted-foreground))]">{s}</span>)}
                            {dias.map((d) => {
                                const escolhido = isSameDay(d, data);
                                return (
                                    <button key={d.toISOString()} type="button" onClick={() => escolher(d)}
                                        className={cn('h-9 rounded-md text-sm tabular-nums',
                                            !isSameMonth(d, mesVisto) && 'text-gray-300',
                                            escolhido ? 'bg-[hsl(var(--primary))] font-semibold text-white'
                                                : isSameDay(d, hoje) ? 'font-semibold text-[hsl(var(--primary))] ring-1 ring-inset ring-[hsl(var(--primary))]'
                                                : 'hover:bg-[hsl(var(--accent))]')}>
                                        {d.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-1.5">
                            {MESES.map((m, i) => {
                                const alvo = new Date(mesVisto.getFullYear(), i, 1);
                                const escolhido = isSameMonth(alvo, data);
                                return (
                                    <button key={m} type="button"
                                        onClick={() => {
                                            if (soMes) return escolher(alvo);
                                            setMesVisto(alvo);
                                            setModo('dias');
                                        }}
                                        className={cn('h-10 rounded-md text-sm capitalize',
                                            escolhido ? 'bg-[hsl(var(--primary))] font-semibold text-white'
                                                : isSameMonth(alvo, hoje) ? 'font-semibold text-[hsl(var(--primary))] ring-1 ring-inset ring-[hsl(var(--primary))]'
                                                : 'hover:bg-[hsl(var(--accent))]')}>
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <div className="mt-2 border-t pt-2 text-center">
                        <button type="button" onClick={() => escolher(new Date())} className="rounded-md px-3 py-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]">
                            Hoje
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
