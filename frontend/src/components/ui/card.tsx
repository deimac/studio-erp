import * as React from 'react';
import { cn } from '@/lib/utils';

/** Painel: superfície arredondada que "flutua" sobre o fundo da página. */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            'rounded-3xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] text-[hsl(var(--card-foreground))] shadow-painel',
            className,
        )}
        {...props}
    />
));
Card.displayName = 'Card';

/**
 * Cabeçalho do painel. Com `actions`, título à esquerda e botões/filtros à direita.
 * Sem `actions`, funciona como antes (só um bloco com espaçamento).
 */
const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & { actions?: React.ReactNode }
>(({ className, actions, children, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            actions ? 'flex items-center justify-between gap-3 p-5 sm:p-6' : 'flex flex-col space-y-1.5 p-5 sm:p-6',
            className,
        )}
        {...props}
    >
        {actions ? <div className="min-w-0 flex-1 space-y-1">{children}</div> : children}
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-base font-semibold leading-snug tracking-tight', className)} {...props} />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-[hsl(var(--muted-foreground))]', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-5 pt-0 sm:p-6 sm:pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
