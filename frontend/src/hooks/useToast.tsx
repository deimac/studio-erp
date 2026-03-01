import React, { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ToastVariant = 'success' | 'error' | 'default';
type ToastItem = { id: number; title: string; description?: string; variant: ToastVariant; exiting?: boolean };

type ToastCtx = {
    toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 250);
    }, []);

    const toast = useCallback(
        (opts: { title: string; description?: string; variant?: ToastVariant }) => {
            const id = ++toastId;
            setToasts((prev) => [...prev, { id, title: opts.title, description: opts.description, variant: opts.variant ?? 'default' }]);
            setTimeout(() => dismiss(id), 4000);
        },
        [dismiss],
    );

    const variantClass = (v: ToastVariant) => {
        switch (v) {
            case 'success': return 'border-green-500 bg-green-50 text-green-900';
            case 'error': return 'border-red-500 bg-red-50 text-red-900';
            default: return 'border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))]';
        }
    };

    return (
        <Ctx.Provider value={{ toast }}>
            {children}
            {createPortal(
                <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className={`pointer-events-auto flex min-w-[280px] max-w-sm items-start gap-3 rounded-lg border p-3 shadow-lg ${variantClass(t.variant)} ${t.exiting ? 'toast-exit' : 'toast-enter'}`}
                        >
                            <div className="flex-1">
                                <p className="text-sm font-semibold">{t.title}</p>
                                {t.description && <p className="mt-0.5 text-xs opacity-80">{t.description}</p>}
                            </div>
                            <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-60 hover:opacity-100" title="Fechar notificação" aria-label="Fechar notificação">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>,
                document.body,
            )}
        </Ctx.Provider>
    );
}

export function useToast() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
    return ctx;
}
