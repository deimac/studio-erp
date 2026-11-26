import * as React from 'react';
import { cn } from '@/lib/utils';

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
        <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('[&_tr]:border-0 [&_tr:hover]:bg-transparent [&_th]:bg-[hsl(var(--muted))] [&_th:first-child]:rounded-l-xl [&_th:last-child]:rounded-r-xl', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b border-[hsl(var(--border))]/70 transition-colors hover:bg-[hsl(var(--accent))]/60', className)} {...props} />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
    <th ref={ref} className={cn('h-10 px-2 text-left align-middle text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))] sm:px-4', className)} {...props} />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-2 py-3.5 align-middle tabular-nums sm:px-4', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
