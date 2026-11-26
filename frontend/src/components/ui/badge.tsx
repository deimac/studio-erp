import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none transition-colors focus:outline-none',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]',
                secondary: 'border-transparent bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]',
                destructive: 'border-transparent bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]',
                outline: 'text-[hsl(var(--foreground))]',
                success: 'border-transparent bg-green-100 text-green-800',
                warning: 'border-transparent bg-yellow-100 text-yellow-800',
            },
        },
        defaultVariants: { variant: 'default' },
    }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
