import { useEffect, useMemo, useRef, useState } from 'react';
import type { CountryCode } from 'libphonenumber-js';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAISES, bandeira, formatarDigitando, lerTelefone, montarTelefone } from '@/lib/telefone';

type Props = {
    /** Valor salvo (internacional, ex.: +5511999990000) ou vazio. */
    value: string | null | undefined;
    onChange: (valor: string) => void;
    id?: string;
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
};

/**
 * Telefone com país: seletor (bandeira + código, com busca, Brasil padrão)
 * e número formatado enquanto digita. Devolve o número internacional.
 */
export function TelefoneInput({ value, onChange, id, placeholder, className, autoFocus }: Props) {
    const [pais, setPais] = useState<CountryCode>('BR');
    const [nacional, setNacional] = useState('');
    const [aberto, setAberto] = useState(false);
    const [busca, setBusca] = useState('');
    const caixaRef = useRef<HTMLDivElement>(null);
    const ultimoEmitido = useRef<string | null>(null);

    // Valor vindo de fora (edição): separa país e número
    useEffect(() => {
        if ((value ?? '') === (ultimoEmitido.current ?? '')) return;
        const n = lerTelefone(value);
        if (n) {
            setPais((n.country ?? 'BR') as CountryCode);
            setNacional(formatarDigitando((n.country ?? 'BR') as CountryCode, n.nationalNumber));
        } else {
            setNacional(value ?? '');
        }
        ultimoEmitido.current = value ?? '';
    }, [value]);

    useEffect(() => {
        if (!aberto) return;
        const fechar = (e: MouseEvent) => { if (!caixaRef.current?.contains(e.target as Node)) setAberto(false); };
        document.addEventListener('mousedown', fechar);
        return () => document.removeEventListener('mousedown', fechar);
    }, [aberto]);

    function emitir(p: CountryCode, texto: string) {
        const v = montarTelefone(p, texto);
        ultimoEmitido.current = v;
        onChange(v);
    }

    const atual = PAISES.find((x) => x.sigla === pais);
    const filtrados = useMemo(() => {
        const t = busca.trim().toLowerCase().replace(/^\+/, '');
        return t ? PAISES.filter((x) => x.nome.toLowerCase().includes(t) || x.codigo.startsWith(t) || x.sigla.toLowerCase() === t) : PAISES;
    }, [busca]);

    return (
        <div ref={caixaRef} className={cn('relative flex h-10 w-full rounded-md border border-[hsl(var(--input))] bg-white text-sm focus-within:ring-2 focus-within:ring-[hsl(var(--ring))]', className)}>
            <button type="button" aria-label={`País: ${atual?.nome}`} onClick={() => setAberto((v) => !v)}
                className="flex shrink-0 items-center gap-1 border-r px-2 tabular-nums">
                <span className="text-base leading-none">{bandeira(pais)}</span>
                <span className="text-[hsl(var(--muted-foreground))]">+{atual?.codigo}</span>
                <ChevronDown className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
            </button>
            <input
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                autoFocus={autoFocus}
                className="min-w-0 flex-1 bg-transparent px-3 outline-none"
                placeholder={placeholder ?? (pais === 'BR' ? '(11) 99999-0000' : 'Número')}
                value={nacional}
                onChange={(e) => {
                    const texto = formatarDigitando(pais, e.target.value.replace(/\D/g, ''));
                    setNacional(texto);
                    emitir(pais, texto);
                }}
            />
            {aberto && (
                <div className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border bg-white shadow-lg">
                    <div className="flex items-center gap-2 border-b px-3">
                        <Search className="h-4 w-4 shrink-0 text-gray-400" />
                        <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar país ou código"
                            className="h-10 w-full bg-transparent text-sm outline-none" />
                    </div>
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {filtrados.map((x) => (
                            <li key={x.sigla}>
                                <button type="button"
                                    onClick={() => { setPais(x.sigla); setAberto(false); setBusca(''); const t = formatarDigitando(x.sigla, nacional.replace(/\D/g, '')); setNacional(t); emitir(x.sigla, t); }}
                                    className={cn('flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[hsl(var(--accent))]', x.sigla === pais && 'bg-[hsl(var(--accent))]')}>
                                    <span className="text-base leading-none">{bandeira(x.sigla)}</span>
                                    <span className="min-w-0 flex-1 truncate">{x.nome}</span>
                                    <span className="shrink-0 tabular-nums text-gray-500">+{x.codigo}</span>
                                </button>
                            </li>
                        ))}
                        {!filtrados.length && <li className="px-3 py-3 text-sm text-gray-500">Nenhum país encontrado.</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}
