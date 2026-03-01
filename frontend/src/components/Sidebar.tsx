import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
    LayoutDashboard,
    Users,
    Scissors,
    Package,
    ShoppingCart,
    CalendarCheck,
    DollarSign,
    Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = { onNavigate: () => void };

const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/pessoas', label: 'Pessoas', icon: Users },
    { to: '/servicos', label: 'Serviços', icon: Scissors },
    { to: '/pacotes', label: 'Pacotes', icon: Package },
    { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
    { to: '/atendimentos', label: 'Atendimentos', icon: CalendarCheck },
    { to: '/financeiro', label: 'Financeiro', icon: DollarSign, adminOnly: true },
    { to: '/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
];

export function Sidebar({ onNavigate }: Props) {
    const { isAdmin } = useAuth();

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
        </nav>
    );
}
