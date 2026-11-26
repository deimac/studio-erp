import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
    return (
        <textarea
            className={cn(
                'flex min-h-[88px] w-full rounded-xl px-3.5 py-2.5 border border-[hsl(var(--input))] bg-[hsl(var(--card))] text-sm transition-[border-color,box-shadow] placeholder:text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--muted-foreground)/0.45)] focus-visible:outline-none focus-visible:border-[hsl(var(--ring))] focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.15)] disabled:cursor-not-allowed disabled:opacity-50',
                className
            )}
            ref={ref}
            {...props}
        />
    );
});
Textarea.displayName = 'Textarea';

export { Textarea };
