import * as React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Número de resumo: ícone num círculo, rótulo e valor.
 * `tom` pinta o círculo do ícone (ex.: 'bg-green-100 text-green-700'); o cartão fica neutro.
 * `to` deixa o número clicável, levando à tela correspondente.
 */
export function Stat({
    label,
    value,
    icon,
    tom = 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]',
    detalhe,
    to,
    className,
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    icon?: React.ReactNode;
    tom?: string;
    detalhe?: React.ReactNode;
    to?: string;
    className?: string;
}) {
    const corpo = (
        <>
            {icon && (
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full [&_svg]:h-5 [&_svg]:w-5', tom)}>
                    {icon}
                </span>
            )}
            <span className="w-full min-w-0">
                <span className="block truncate text-xs font-medium text-[hsl(var(--muted-foreground))]">{label}</span>
                <span className="block truncate text-lg font-bold tabular-nums leading-tight sm:text-xl">{value}</span>
                {detalhe && <span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{detalhe}</span>}
            </span>
        </>
    );
    const cls = cn(
        'flex min-w-0 flex-col items-start gap-2.5 rounded-3xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-4 shadow-painel sm:flex-row sm:items-center sm:gap-3',
        to && 'transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-flutuante focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.25)]',
        className,
    );
    return to ? <Link to={to} className={cls}>{corpo}</Link> : <div className={cls}>{corpo}</div>;
}
