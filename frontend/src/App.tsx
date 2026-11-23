import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Pessoas from '@/pages/Pessoas';
import Servicos from '@/pages/Servicos';
import Vendas from '@/pages/Vendas';
import Atendimentos from '@/pages/Atendimentos';
import Agenda from '@/pages/Agenda';
import Financeiro from '@/pages/Financeiro';
import Configuracoes from '@/pages/Configuracoes';

function ProtectedRoute({ children, adminOnly = false }: { children?: React.ReactNode; adminOnly?: boolean }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (adminOnly && user.perfil !== 'ADMIN') return <Navigate to="/" replace />;
    return children ? <>{children}</> : <Outlet />;
}

function AdminRoute() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    if (user.perfil !== 'ADMIN') return <Navigate to="/" replace />;
    return <Outlet />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<AppLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="pessoas" element={<Pessoas />} />
                    <Route path="servicos" element={<Servicos />} />
                    <Route path="protocolos" element={<Navigate to="/servicos" replace />} />
                    <Route path="vendas" element={<Vendas />} />
                    <Route path="agenda" element={<Agenda />} />
                    <Route path="atendimentos" element={<Atendimentos />} />
                    <Route path="financeiro" element={<Financeiro />} />
                    <Route element={<AdminRoute />}>
                        <Route path="configuracoes" element={<Configuracoes />} />
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
