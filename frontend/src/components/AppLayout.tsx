import { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { TELAS_ESPECTADOR, useAuth } from '@/hooks/useAuth';
import { useMenuLateralAberto } from '@/hooks/useMenuLateral';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { BarraInferior } from '@/components/BarraInferior';
import { AcoesRapidasProvider } from '@/components/acoes/AcoesRapidas';
import { cn } from '@/lib/utils';

export function AppLayout() {
    const { token, isEspectador } = useAuth();
    const { pathname } = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const menuAberto = useMenuLateralAberto();

    if (!token) return <Navigate to="/login" replace />;
    // Espectador: só a agenda e os serviços
    if (isEspectador && !TELAS_ESPECTADOR.some((t) => pathname.startsWith(t))) return <Navigate to="/agenda" replace />;

    return (
        <AcoesRapidasProvider>
            <div className="flex h-dvh overflow-hidden bg-[hsl(var(--background))] lg:gap-4 lg:p-4">
                {/* Computador: menu em ilhas, contraído (só ícones) ou aberto */}
                <aside
                    className={cn(
                        'hidden shrink-0 flex-col gap-3 transition-[width] duration-200 ease-out lg:flex',
                        menuAberto ? 'w-60' : 'w-[4.5rem]',
                    )}
                >
                    <Marca contraida={!menuAberto} />
                    <Sidebar onNavigate={() => { }} contraido={!menuAberto} />
                </aside>

                {/* Celular: menu por cima, com os nomes */}
                {sidebarOpen && (
                    <div className="fixed inset-0 z-40 lg:hidden">
                        <div className="fundo-folha absolute inset-0 bg-[hsl(var(--overlay)/0.45)]" onClick={() => setSidebarOpen(false)} />
                        <aside className="relative z-50 flex h-full w-72 max-w-[85vw] flex-col gap-3 overflow-y-auto bg-[hsl(var(--background))] p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-flutuante">
                            <Marca />
                            <Sidebar onNavigate={() => setSidebarOpen(false)} />
                        </aside>
                    </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col lg:gap-4">
                    <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
                    {/* Embaixo, espaço para a barra de atalhos do celular */}
                    <main className="flex-1 overflow-y-auto px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-4 scrollbar-thin lg:px-1 lg:pb-6 lg:pt-0">
                        <div className="mx-auto w-full max-w-[1400px]">
                            <Outlet />
                        </div>
                    </main>
                </div>
                <BarraInferior />
            </div>
        </AcoesRapidasProvider>
    );
}

/** Marca do estúdio no topo do menu. */
function Marca({ contraida = false }: { contraida?: boolean }) {
    return (
        <div className={cn('flex h-14 shrink-0 items-center gap-3', contraida ? 'justify-center' : 'px-2')}>
            <img src="/logo-ts.png" alt="" className="h-11 w-8 object-contain" />
            {!contraida && <span className="truncate text-lg font-bold tracking-tight text-[hsl(var(--primary))]">Studio ERP</span>}
        </div>
    );
}
