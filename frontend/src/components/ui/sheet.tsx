import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ehCelular, useTecladoNoRodape } from '@/components/ui/dialog';

/**
 * Painel lateral: abre da direita para a esquerda, por cima de outro modal.
 * No celular ocupa a tela inteira.
 */
const Sheet = DialogPrimitive.Root;

const SheetContent = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, onOpenAutoFocus, onFocus, ...props }, ref) => {
    const teclado = useTecladoNoRodape();
    return (
        <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fundo-folha fixed inset-0 z-[60] bg-[hsl(var(--overlay)/0.45)]" />
            <DialogPrimitive.Content
                ref={ref}
                style={teclado > 0 ? { ...style, bottom: teclado } : style}
                onOpenAutoFocus={(e) => {
                    onOpenAutoFocus?.(e);
                    if (!e.defaultPrevented && ehCelular()) e.preventDefault();
                }}
                onFocus={(e) => {
                    onFocus?.(e);
                    const alvo = e.target as HTMLElement;
                    if (ehCelular() && /^(INPUT|TEXTAREA|SELECT)$/.test(alvo.tagName)) {
                        setTimeout(() => alvo.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
                    }
                }}
                className={cn(
                    'painel-lateral fixed inset-0 z-[60] flex w-full flex-col gap-5 overflow-y-auto overflow-x-hidden bg-[hsl(var(--background))] px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-xl',
                    'sm:left-auto sm:max-w-xl sm:border-l sm:border-[hsl(var(--border))]',
                    className
                )}
                {...props}
            >
                {children}
                <DialogPrimitive.Close className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full opacity-70 hover:opacity-100 sm:right-4 sm:top-4 sm:h-auto sm:w-auto">
                    <X className="h-5 w-5 sm:h-4 sm:w-4" />
                    <span className="sr-only">Fechar</span>
                </DialogPrimitive.Close>
            </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
    );
});
SheetContent.displayName = 'SheetContent';

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col space-y-1.5 pr-8', className)} {...props} />
);

const SheetTitle = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
));
SheetTitle.displayName = 'SheetTitle';

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2', className)} {...props} />
);

export { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter };
