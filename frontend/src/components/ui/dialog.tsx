
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DialogOverlay = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn('fixed inset-0 z-50 bg-slate-900/30 data-[state=open]:animate-in data-[state=closed]:animate-out', className)}
        {...props}
    />
));
DialogOverlay.displayName = 'DialogOverlay';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;

const DialogPortal = DialogPrimitive.Portal;

const ehCelular = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;

/**
 * Celular: quanto o teclado (ou seletor de data) está cobrindo do rodapé.
 * A folha sobe junto para nenhum campo ficar escondido.
 */
function useTecladoNoRodape() {
    const [cobre, setCobre] = React.useState(0);
    React.useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const medir = () => setCobre(ehCelular() ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0);
        medir();
        vv.addEventListener('resize', medir);
        vv.addEventListener('scroll', medir);
        return () => {
            vv.removeEventListener('resize', medir);
            vv.removeEventListener('scroll', medir);
        };
    }, []);
    return cobre;
}

const DialogContent = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideOverlay?: boolean }
>(({ className, children, hideOverlay, style, onOpenAutoFocus, onFocus, ...props }, ref) => {
    const teclado = useTecladoNoRodape();
    return (
    <DialogPortal>
        {!hideOverlay && <DialogOverlay />}
        <DialogPrimitive.Content
            ref={ref}
            style={teclado > 0 ? { ...style, bottom: teclado, maxHeight: `calc(100dvh - ${teclado}px - 1rem)` } : style}
            onOpenAutoFocus={(e) => {
                onOpenAutoFocus?.(e);
                // No celular não abre já com o cursor num campo (o teclado/seletor cobriria a folha)
                if (!e.defaultPrevented && ehCelular()) e.preventDefault();
            }}
            onFocus={(e) => {
                onFocus?.(e);
                // Campo tocado no celular: rola até ele depois que o teclado abrir
                const alvo = e.target as HTMLElement;
                if (ehCelular() && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) {
                    setTimeout(() => alvo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
                }
            }}
            className={cn(
                // Celular: folha que sobe do rodapé; a partir de 640px: janela centralizada
                'fixed inset-x-0 bottom-0 z-50 mx-auto grid max-h-[92dvh] w-full gap-5 overflow-y-auto overflow-x-hidden rounded-t-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg',
                'sm:inset-x-auto sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:max-h-[90vh] sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg sm:p-6',
                className
            )}
            {...props}
        >
            {children}
            <DialogPrimitive.Close className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full opacity-70 hover:opacity-100 sm:right-4 sm:top-4 sm:h-auto sm:w-auto">
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
            </DialogPrimitive.Close>
        </DialogPrimitive.Content>
    </DialogPortal>
    );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogTitle = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogOverlay };
