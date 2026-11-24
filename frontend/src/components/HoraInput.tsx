import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
    /** "HH:MM" ou vazio. */
    value: string;
    onChange: (v: string) => void;
    'aria-label'?: string;
    /** Intervalo da lista (min). */
    passo?: number;
    /** Faixa da lista. */
    de?: string;
    ate?: string;
    className?: string;
};

/** "930" → "09:30", "1745" → "17:45"; inválido → null. */
function normalizar(texto: string): string | null {
    const d = texto.replace(/\D/g, '');
    if (!d) return null;
    let h: number, m: number;
    if (d.length <= 2) { h = Number(d); m = 0; }
    else if (d.length === 3) { h = Number(d.slice(0, 1)); m = Number(d.slice(1)); }
    else { h = Number(d.slice(0, 2)); m = Number(d.slice(2, 4)); }
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Máscara enquanto digita: só números, ":" depois da hora. */
function mascarar(texto: string) {
    const d = texto.replace(/\D/g, '').slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

/**
 * Horário digitado (ex.: 0930 → 09:30) ou escolhido numa lista de 15 em 15 min.
 * Substitui o seletor nativo, que no celular mostra todos os minutos.
 */
export function HoraInput({ value, onChange, passo = 15, de = '06:00', ate = '22:00', className, ...rest }: Props) {
    const [texto, setTexto] = useState(value);
    const [aberto, setAberto] = useState(false);
    const caixaRef = useRef<HTMLDivElement>(null);
    const listaRef = useRef<HTMLUListElement>(null);

    useEffect(() => setTexto(value), [value]);

    useEffect(() => {
        if (!aberto) return;
        const fechar = (e: MouseEvent | TouchEvent) => { if (!caixaRef.current?.contains(e.target as Node)) setAberto(false); };
        document.addEventListener('mousedown', fechar);
        document.addEventListener('touchstart', fechar);
        // Rola até o horário atual (ou o mais próximo)
        requestAnimationFrame(() => {
            const alvo = listaRef.current?.querySelector('[data-perto="1"]') as HTMLElement | null;
            alvo?.scrollIntoView({ block: 'center' });
        });
        return () => { document.removeEventListener('mousedown', fechar); document.removeEventListener('touchstart', fechar); };
    }, [aberto]);

    const opcoes = useMemo(() => {
        const [hi, mi] = de.split(':').map(Number);
        const [hf, mf] = ate.split(':').map(Number);
        const lista: string[] = [];
        for (let t = hi * 60 + mi; t <= hf * 60 + mf; t += passo) lista.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
        return lista;
    }, [de, ate, passo]);
    const perto = useMemo(() => {
        if (!value) return '';
        const [h, m] = value.split(':').map(Number);
        const alvo = h * 60 + m;
        return opcoes.reduce((melhor, o) => {
            const [oh, om] = o.split(':').map(Number);
            const [bh, bm] = melhor.split(':').map(Number);
            return Math.abs(oh * 60 + om - alvo) < Math.abs(bh * 60 + bm - alvo) ? o : melhor;
        }, opcoes[0] ?? '');
    }, [value, opcoes]);

    function confirmar() {
        const n = normalizar(texto);
        if (n) { setTexto(n); if (n !== value) onChange(n); }
        else setTexto(value);
    }

    return (
        <div ref={caixaRef} className={cn('relative', className)}>
            <div className="flex h-10 w-full items-center rounded-md border border-[hsl(var(--input))] bg-white focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]">
                <input
                    type="text"
                    inputMode="numeric"
                    placeholder="--:--"
                    aria-label={rest['aria-label']}
                    className="min-w-0 flex-1 bg-transparent px-3 text-sm tabular-nums outline-none"
                    value={texto}
                    onChange={(e) => setTexto(mascarar(e.target.value))}
                    onBlur={confirmar}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar(); setAberto(false); } }}
                />
                <button type="button" aria-label="Escolher horário" onClick={() => setAberto((v) => !v)}
                    className="flex h-full shrink-0 items-center px-2.5 text-[hsl(var(--muted-foreground))]">
                    <Clock className="h-4 w-4" />
                </button>
            </div>
            {aberto && (
                <ul ref={listaRef} className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-white py-1 shadow-lg">
                    {opcoes.map((o) => (
                        <li key={o}>
                            <button type="button" data-perto={o === perto ? '1' : undefined}
                                onClick={() => { setTexto(o); onChange(o); setAberto(false); }}
                                className={cn('block w-full px-3 py-2 text-left text-sm tabular-nums hover:bg-[hsl(var(--accent))]', o === value && 'bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]')}>
                                {o}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
