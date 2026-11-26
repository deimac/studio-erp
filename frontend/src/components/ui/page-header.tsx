import * as React from 'react';
import { cn } from '@/lib/utils';

/** Topo de cada tela: título, frase de apoio e as ações principais à direita. */
export function PageHeader({
    title,
    description,
    actions,
    className,
}: {
    title: React.ReactNode;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3', className)}>
            <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-balance sm:text-2xl">{title}</h2>
                {description && <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    );
}
