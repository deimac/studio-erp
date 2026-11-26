import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/services/trpc';
import { AuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/hooks/useToast';
import { ConfirmProvider } from '@/components/ui/confirm-delete-dialog';
import App from '@/App';
import '@fontsource-variable/manrope';
import '@/styles/globals.css';

const TOKEN_KEY = 'studio_erp_token';
const USER_KEY = 'studio_erp_user';

/** Login vencido ou inválido: limpa e volta para a tela de entrada, em vez de mostrar telas vazias. */
function sairSeSessaoExpirou(error: unknown) {
    const code = (error as { data?: { code?: string } } | null)?.data?.code;
    if (code !== 'UNAUTHORIZED' || !localStorage.getItem(TOKEN_KEY)) return;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.replace('/login');
}

// Ao abrir o app, já descarta um login vencido (antes de qualquer tela carregar)
(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
        }
    } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }
})();

const API_URL =(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TRPC_URL = API_URL ? `${API_URL}/trpc` : '/trpc';

function Root() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                queryCache: new QueryCache({ onError: sairSeSessaoExpirou }),
                mutationCache: new MutationCache({ onError: sairSeSessaoExpirou }),
                defaultOptions: {
                    queries: { retry: false, refetchOnWindowFocus: false },
                },
            }),
    );

    const [trpcClient] = useState(() =>
        // @ts-ignore - tRPC type inference issue with router collision warnings
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: TRPC_URL,
                    headers() {
                        const token = localStorage.getItem(TOKEN_KEY);
                        return token ? { Authorization: `Bearer ${token}` } : {};
                    },
                }),
            ],
        }),
    );

    return (
        // @ts-ignore - tRPC Provider type inference issue
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <ToastProvider>
                        <ConfirmProvider>
                            <App />
                        </ConfirmProvider>
                    </ToastProvider>
                </AuthProvider>
            </QueryClientProvider>
            {/* @ts-ignore - tRPC Provider type inference issue */}
        </trpc.Provider>
    );
}

// App instalável: registra o service worker só na versão publicada; em desenvolvimento remove
// qualquer um antigo para não servir código velho.
if ('serviceWorker' in navigator) {
    if (import.meta.env.PROD) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {});
        });
    } else {
        navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
);
