import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { BarraInferior } from '@/components/BarraInferior';
import { AcoesRapidasProvider } from '@/components/acoes/AcoesRapidas';

export function AppLayout() {
    const { token } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (!token) return <Navigate to="/login" replace />;

    return (
        <AcoesRapidasProvider>
            <div className="flex h-screen flex-col overflow-hidden">
                <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />

                <div className="flex flex-1 overflow-hidden">
                    {/* Desktop sidebar */}
                    <aside className="hidden w-[var(--sidebar-width)] shrink-0 border-r border-[hsl(var(--border))] bg-white lg:block">
                        <Sidebar onNavigate={() => { }} />
                    </aside>

                    {/* Mobile overlay */}
                    {sidebarOpen && (
                        <div className="fixed inset-0 z-40 lg:hidden">
                            <div
                                className="absolute inset-0 bg-black/40"
                                onClick={() => setSidebarOpen(false)}
                            />
                            <aside className="relative z-50 h-full w-[var(--sidebar-width)] border-r border-[hsl(var(--border))] bg-white shadow-xl">
                                <Sidebar onNavigate={() => setSidebarOpen(false)} />
                            </aside>
                        </div>
                    )}

                    {/* Embaixo, espaço para a barra de atalhos do celular */}
                    <main className="flex-1 overflow-y-auto bg-[hsl(var(--background))] p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] scrollbar-thin lg:p-6">
                        <Outlet />
                    </main>
                </div>
                <BarraInferior />
            </div>
        </AcoesRapidasProvider>
    );
}
