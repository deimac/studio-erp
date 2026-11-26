import { cn } from '@/lib/utils';

export type PillOption<T extends string> = { value: T; label: React.ReactNode; title?: string };

/**
 * Filtros/segmentos em pílula ("Todas · Ativa · Encerrada").
 * `solta`: pílulas separadas (filtros). Padrão: trilho único (segmento, uma escolha).
 */
export function PillGroup<T extends string>({
    options,
    value,
    onChange,
    label,
    solta,
    size = 'md',
    className,
}: {
    options: PillOption<T>[];
    value: T;
    onChange: (v: T) => void;
    label: string;
    solta?: boolean;
    size?: 'sm' | 'md';
    className?: string;
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                'inline-flex max-w-full items-center gap-1 overflow-x-auto',
                !solta && 'rounded-xl bg-[hsl(var(--muted))] p-1',
                className,
            )}
        >
            {options.map((o) => {
                const ativo = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        title={o.title}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.25)]',
                            size === 'sm' ? 'h-8 rounded-lg px-3 text-xs' : 'h-9 rounded-lg px-4 text-sm',
                            solta && 'rounded-xl',
                            solta && !ativo && 'border border-[hsl(var(--border))] bg-[hsl(var(--card))]',
                            ativo
                                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_4px_12px_-6px_hsl(var(--primary)/0.6)]'
                                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]',
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}
