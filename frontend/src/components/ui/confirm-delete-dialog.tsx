import { useState, useCallback, createContext, useContext, useRef } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/* ───────── Componente standalone ───────── */

type ConfirmDeleteProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    loading?: boolean;
    onConfirm: () => void;
    variant?: 'danger' | 'warning';
};

export function ConfirmDeleteDialog({
    open,
    onOpenChange,
    title = 'Confirmar exclusão',
    description = 'Tem certeza que deseja excluir? Essa ação não pode ser desfeita.',
    confirmLabel = 'Excluir',
    cancelLabel = 'Cancelar',
    loading = false,
    onConfirm,
    variant = 'danger',
}: ConfirmDeleteProps) {
    const iconBg = variant === 'danger' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600';
    const btnVariant = variant === 'danger' ? 'destructive' : 'default';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-base">{title}</DialogTitle>
                            <p className="mt-1 text-sm text-gray-500">{description}</p>
                        </div>
                    </div>
                </DialogHeader>
                <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={btnVariant}
                        onClick={() => {
                            onConfirm();
                            if (!loading) onOpenChange(false);
                        }}
                        disabled={loading}
                    >
                        {loading ? 'Aguarde…' : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ───────── Hook imperativo useConfirm() ───────── */

type ConfirmOptions = {
    title?: string;
    description?: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning';
};

type ConfirmFn = (options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
    const fn = useContext(ConfirmContext);
    if (!fn) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>');
    return fn;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
    const resolveRef = useRef<((v: boolean) => void) | null>(null);

    const confirm: ConfirmFn = useCallback((options = {}) => {
        return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
            setState({ ...options, open: true });
        });
    }, []);

    function handleClose(confirmed: boolean) {
        setState(null);
        resolveRef.current?.(confirmed);
        resolveRef.current = null;
    }

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {state?.open && (
                <ConfirmDeleteDialog
                    open
                    onOpenChange={(open) => { if (!open) handleClose(false); }}
                    title={state.title}
                    description={state.description}
                    confirmLabel={state.confirmLabel}
                    variant={state.variant}
                    onConfirm={() => handleClose(true)}
                />
            )}
        </ConfirmContext.Provider>
    );
}
