import { useSyncExternalStore } from 'react';

const CONSULTA = '(max-width: 767px)';

function assinar(f: () => void) {
    const mq = window.matchMedia(CONSULTA);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
}

/** Tela de celular (até 767px). */
export function useIsMobile() {
    return useSyncExternalStore(assinar, () => window.matchMedia(CONSULTA).matches, () => false);
}
