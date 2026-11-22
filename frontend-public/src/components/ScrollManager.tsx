import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Rola para o topo a cada página e até a âncora (#secao) quando ela existir — inclusive vinda de outra rota. */
export default function ScrollManager() {
    const { pathname, hash } = useLocation();
    useEffect(() => {
        if (!hash) { window.scrollTo(0, 0); return; }
        let tentativas = 0;
        const id = window.setInterval(() => {
            const el = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (el || ++tentativas > 40) {
                window.clearInterval(id);
                el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 50);
        return () => window.clearInterval(id);
    }, [pathname, hash]);
    return null;
}
