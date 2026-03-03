import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { trpc } from '@/services/trpc';
import App from '@/App';
import '@/styles/globals.css';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TRPC_URL = API_URL ? `${API_URL}/trpc` : '/trpc';

function Root() {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        retry: false,
                        refetchOnWindowFocus: false,
                        staleTime: 1000 * 60 * 5, // 5 min cache for public catalog
                    },
                },
            }),
    );

    const [trpcClient] = useState(() =>
        // @ts-ignore - tRPC type inference issue with router collision warnings
        trpc.createClient({
            links: [
                httpBatchLink({
                    url: TRPC_URL,
                }),
            ],
        }),
    );

    return (
        // @ts-ignore - tRPC Provider type inference issue
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
            {/* @ts-ignore - tRPC Provider type inference issue */}
        </trpc.Provider>
    );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>,
);
