import { useEffect, useSyncExternalStore } from 'react';

/** Aparência do app: estilo de cores + claro/escuro. Fica salvo neste aparelho. */
export type Estilo = 'classico' | 'rose';
export type Modo = 'claro' | 'escuro' | 'auto';
export type Tema = { estilo: Estilo; modo: Modo };

const CHAVE = 'studio_erp_tema';
const PADRAO: Tema = { estilo: 'classico', modo: 'auto' };
const ouvintes = new Set<() => void>();
const escuroNoAparelho = window.matchMedia('(prefers-color-scheme: dark)');

function ler(): Tema {
    try {
        const t = JSON.parse(localStorage.getItem(CHAVE) || '{}');
        return {
            estilo: t.estilo === 'rose' ? 'rose' : 'classico',
            modo: t.modo === 'claro' || t.modo === 'escuro' ? t.modo : 'auto',
        };
    } catch {
        return PADRAO;
    }
}

let atual = ler();

/** Pinta o <html> com o tema (mesma lógica do script em index.html, que evita piscar ao abrir). */
function aplicar(t: Tema, suave = false) {
    const html = document.documentElement;
    const escuro = t.modo === 'escuro' || (t.modo === 'auto' && escuroNoAparelho.matches);
    if (suave) {
        html.classList.add('trocando-tema');
        window.setTimeout(() => html.classList.remove('trocando-tema'), 250);
    }
    html.dataset.estilo = t.estilo;
    html.classList.toggle('dark', escuro);
    // Cor da barra do celular acompanha o fundo
    const fundo = getComputedStyle(html).getPropertyValue('--background').trim();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `hsl(${fundo.replace(/ /g, ', ')})`);
}

export function definirTema(parcial: Partial<Tema>) {
    atual = { ...atual, ...parcial };
    localStorage.setItem(CHAVE, JSON.stringify(atual));
    aplicar(atual, true);
    ouvintes.forEach((f) => f());
}

escuroNoAparelho.addEventListener('change', () => {
    if (atual.modo === 'auto') aplicar(atual, true);
});

export function useTema(): Tema {
    const tema = useSyncExternalStore(
        (f) => {
            ouvintes.add(f);
            return () => ouvintes.delete(f);
        },
        () => atual,
    );
    useEffect(() => aplicar(atual), []);
    return tema;
}
