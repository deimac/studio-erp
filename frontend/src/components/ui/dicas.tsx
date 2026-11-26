import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

/**
 * Dicas (tooltips) do admin inteiro, no lugar da dica nativa do navegador.
 *
 * Aparece ao passar o mouse ou focar pelo teclado em:
 *  - qualquer elemento com `title` ou `data-dica` (o `title` vira `data-dica`
 *    para a dica nativa não aparecer junto);
 *  - botões e links só com ícone que têm `aria-label` (mostra o nome do botão).
 * Para não mostrar num elemento: `data-sem-dica`.
 * No toque (celular) não aparece.
 */
const ALVO = '[title],[data-dica],button[aria-label],a[aria-label],[role="radio"][aria-label]';
const ATRASO_MS = 300;

type Dica = { texto: string; x: number; y: number; embaixo: boolean };

function textoDaDica(el: HTMLElement): string | null {
    if (el.closest('[data-sem-dica]')) return null;
    const title = el.getAttribute('title');
    if (title) {
        el.setAttribute('data-dica', title);
        el.removeAttribute('title');
    }
    const dica = el.getAttribute('data-dica');
    if (dica) return dica;
    // Botão/link só com ícone: o nome dele
    const rotulo = el.getAttribute('aria-label');
    if (rotulo && !(el.textContent ?? '').trim()) return rotulo;
    return null;
}

export function Dicas() {
    const [dica, setDica] = useState<Dica | null>(null);
    const timer = useRef<number | undefined>(undefined);
    const atual = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const esconder = () => {
            window.clearTimeout(timer.current);
            atual.current = null;
            setDica(null);
        };

        const mostrar = (el: HTMLElement, imediato: boolean) => {
            const texto = textoDaDica(el);
            if (!texto) return esconder();
            if (atual.current === el) return;
            window.clearTimeout(timer.current);
            atual.current = el;
            timer.current = window.setTimeout(() => {
                if (atual.current !== el || !el.isConnected) return;
                const r = el.getBoundingClientRect();
                const embaixo = r.top < 48;
                setDica({ texto, x: r.left + r.width / 2, y: embaixo ? r.bottom + 8 : r.top - 8, embaixo });
            }, imediato ? 0 : ATRASO_MS);
        };

        const aoPassar = (e: PointerEvent) => {
            if (e.pointerType !== 'mouse') return;
            const el = (e.target as HTMLElement | null)?.closest?.(ALVO) as HTMLElement | null;
            if (el) mostrar(el, false);
            else if (atual.current) esconder();
        };
        const aoSair = (e: PointerEvent) => {
            if (!atual.current) return;
            const para = e.relatedTarget as Node | null;
            if (!para || !atual.current.contains(para)) esconder();
        };
        const aoFocar = (e: FocusEvent) => {
            const el = (e.target as HTMLElement | null)?.closest?.(ALVO) as HTMLElement | null;
            if (el && el.matches(':focus-visible')) mostrar(el, true);
        };

        document.addEventListener('pointerover', aoPassar);
        document.addEventListener('pointerout', aoSair);
        document.addEventListener('pointerdown', esconder, true);
        document.addEventListener('focusin', aoFocar);
        document.addEventListener('focusout', esconder);
        const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && esconder();
        document.addEventListener('keydown', aoTeclar);
        window.addEventListener('scroll', esconder, true);
        window.addEventListener('resize', esconder);
        return () => {
            document.removeEventListener('pointerover', aoPassar);
            document.removeEventListener('pointerout', aoSair);
            document.removeEventListener('pointerdown', esconder, true);
            document.removeEventListener('focusin', aoFocar);
            document.removeEventListener('focusout', esconder);
            document.removeEventListener('keydown', aoTeclar);
            window.removeEventListener('scroll', esconder, true);
            window.removeEventListener('resize', esconder);
            window.clearTimeout(timer.current);
        };
    }, []);

    return <BalaoDica dica={dica} />;
}

function BalaoDica({ dica }: { dica: Dica | null }) {
    const ref = useRef<HTMLDivElement>(null);
    const [desloc, setDesloc] = useState(0);

    // Não deixa a dica sair pela lateral da tela
    useEffect(() => {
        const el = ref.current;
        if (!el || !dica) return;
        const r = el.getBoundingClientRect();
        const margem = 8;
        const centro = r.left - desloc;
        let d = 0;
        if (centro < margem) d = margem - centro;
        else if (centro + r.width > window.innerWidth - margem) d = window.innerWidth - margem - (centro + r.width);
        if (d !== desloc) setDesloc(d);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dica]);

    if (!dica) return null;
    return createPortal(
        <div
            ref={ref}
            role="tooltip"
            style={{ left: dica.x + desloc, top: dica.y }}
            className={cn(
                'dica pointer-events-none fixed z-[200] max-w-60 -translate-x-1/2 rounded-2xl bg-[hsl(var(--foreground))] px-3 py-1.5 text-center text-xs font-semibold leading-snug text-[hsl(var(--background))] shadow-flutuante',
                dica.embaixo ? 'dica-embaixo' : '-translate-y-full',
            )}
        >
            {dica.texto}
        </div>,
        document.body,
    );
}
