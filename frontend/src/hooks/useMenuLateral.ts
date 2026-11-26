import { useSyncExternalStore } from 'react';

/** Menu lateral do computador: contraído (só ícones) ou aberto (com nomes). Fica salvo neste aparelho. */
const CHAVE = 'studio_erp_menu_aberto';
const ouvintes = new Set<() => void>();
let aberto = localStorage.getItem(CHAVE) === '1';

export function alternarMenuLateral() {
    aberto = !aberto;
    localStorage.setItem(CHAVE, aberto ? '1' : '0');
    ouvintes.forEach((f) => f());
}

export function useMenuLateralAberto() {
    return useSyncExternalStore(
        (f) => {
            ouvintes.add(f);
            return () => ouvintes.delete(f);
        },
        () => aberto,
    );
}
