import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// O Chrome avisa (beforeinstallprompt) logo ao abrir a página, antes da tela de instalação montar.
// Guardamos o aviso aqui, fora do React, para o botão "Instalar agora" funcionar em qualquer tela.
let aviso: BeforeInstallPromptEvent | null = null;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        aviso = e as BeforeInstallPromptEvent;
        avisar();
    });
    window.addEventListener('appinstalled', () => {
        aviso = null;
        avisar();
    });
}

const estaInstalado = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true);

export const ehIPhone = () =>
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Estado da instalação do app no celular. */
export function usePWA() {
    const [, forcar] = useState(0);
    const [instalado, setInstalado] = useState(estaInstalado);

    useEffect(() => {
        const f = () => {
            forcar((n) => n + 1);
            setInstalado(estaInstalado());
        };
        ouvintes.add(f);
        return () => {
            ouvintes.delete(f);
        };
    }, []);

    const instalar = async () => {
        if (!aviso) return false;
        await aviso.prompt();
        const { outcome } = await aviso.userChoice;
        if (outcome === 'accepted') {
            aviso = null;
            setInstalado(true);
            return true;
        }
        return false;
    };

    return { instalado, podeInstalar: !!aviso, isIOS: ehIPhone(), instalar };
}
