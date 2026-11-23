import { useSyncExternalStore } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * Visão do admin: "GERAL" (tudo) ou "MEU" (só o que é dele).
 * Profissional não escolhe: o backend sempre mostra só o dele (retorna undefined).
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

/** Escopo atual para enviar às listas (undefined para profissional). */
export function useEscopo(): { escopo: Escopo | undefined; valor: Escopo; isAdmin: boolean } {
    const { isAdmin } = useAuth();
    const valor = useSyncExternalStore(assinar, ler, ler);
    return { escopo: isAdmin ? valor : undefined, valor, isAdmin };
}
