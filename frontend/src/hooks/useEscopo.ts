import { useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Visão do admin no modo Clínica: "GERAL" (tudo) ou "MEU" (só o que é dele).
 * Profissional, e o admin no modo "cada um cuida do seu", não escolhem:
 * o backend sempre mostra só o dele (retorna undefined).
 */
export type Escopo = 'GERAL' | 'MEU';

const CHAVE = 'studio_erp_escopo';
const ouvintes = new Set<() => void>();

function ler(): Escopo {
    try {
        return localStorage.getItem(CHAVE) === 'MEU' ? 'MEU' : 'GERAL';
    } catch {
        return 'GERAL';
    }
}

export function definirEscopo(e: Escopo) {
    try {
        localStorage.setItem(CHAVE, e);
    } catch {
        /* sem storage: vale só nesta sessão */
    }
    ouvintes.forEach((f) => f());
}

function assinar(f: () => void) {
    ouvintes.add(f);
    return () => ouvintes.delete(f);
}

/** Escopo atual para enviar às listas (undefined para quem não escolhe). */
export function useEscopo(): { escopo: Escopo | undefined; valor: Escopo; podeEscolher: boolean } {
    const { veTudo } = useAuth();
    const lido = useSyncExternalStore(assinar, ler, ler);
    const valor: Escopo = veTudo ? lido : 'MEU';
    return { escopo: veTudo ? valor : undefined, valor, podeEscolher: veTudo };
}
