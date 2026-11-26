import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
    return (
        <input
            type={type}
            className={cn(
                'flex h-11 w-full rounded-xl px-3.5 py-2 sm:h-10 border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-sm transition-[border-color,box-shadow] placeholder:text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground)/0.45)] focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.15)] disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            ref={ref}
            {...props}
        />
    );
});
Input.displayName = 'Input';

export { Input };
