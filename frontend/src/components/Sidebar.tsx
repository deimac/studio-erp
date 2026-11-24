import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
    LayoutDashboard,
    Users,
    Scissors,
    ShoppingCart,
    CalendarCheck,
    CalendarDays,
    DollarSign,
    Settings,
    Smartphone,
} from 'lucide-react';
import { InstalarNoCelularDialog } from '@/components/instalar/InstalarNoCelularDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePWA } from '@/hooks/usePWA';
import { cn } from '@/lib/utils';

type Props = { onNavigate: () => void };

const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/pessoas', label: 'Pessoas', icon: Users },
    { to: '/servicos', label: 'Serviços', icon: Scissors },
    { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
    { to: '/agenda', label: 'Agenda', icon: CalendarDays },
    { to: '/atendimentos', label: 'Atendimentos', icon: CalendarCheck },
    { to: '/financeiro', label: 'Financeiro', icon: DollarSign },
    { to: '/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
];

export function Sidebar({ onNavigate }: Props) {
    const { isAdmin } = useAuth();
    const { instalado } = usePWA();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const [qrAberto, setQrAberto] = useState(false);

    // Celular: abre a página com o passo a passo. Computador: QR code para abrir no celular.
    const instalarNoCelular = () => {
        if (isMobile) {
            onNavigate();
            navigate('/instalar');
        } else {
            setQrAberto(true);
        }
    };

    return (
        <nav className="flex h-full flex-col gap-1 overflow-y-auto p-3 scrollbar-thin">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                Menu
            </p>
            {links.map((link) => {
                if (link.adminOnly && !isAdmin) return null;
                const Icon = link.icon;
                return (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                            cn(
                                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                                isActive
                                    ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
                            )
                        }
                    >
                        <Icon className="h-4 w-4 shrink-0" />
                        {link.label}
                    </NavLink>
                );
            })}

            {!instalado && (
                <button
                    type="button"
                    onClick={instalarNoCelular}
                    className="mt-auto flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
                >
                    <Smartphone className="h-4 w-4 shrink-0" />
                    Instalar no celular
                </button>
            )}
            <InstalarNoCelularDialog open={qrAberto} onOpenChange={setQrAberto} />
        </nav>
    );
}
