import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/services/trpc';
import { AuthProvider } from '@/hooks/useAuth';
import { ToastProvider } from '@/hooks/useToast';
import { ConfirmProvider } from '@/components/ui/confirm-delete-dialog';
import App from '@/App';
import '@/styles/globals.css';

function Root() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: { retry: false, refetchOnWindowFocus: false },
                },
            }),
    );

    const [trpcClient] = useState(() =>
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: '/trpc',
                    headers() {
                        const token = localStorage.getItem('studio_erp_token');
                        return token ? { Authorization: `Bearer ${token}` } : {};
                    },
                }),
            ],
        }),
    );

    return (
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
        </trpc.Provider>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
);
