import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
    PanelLeftClose,
    PanelLeftOpen,
    type LucideIcon,
} from 'lucide-react';
import { InstalarNoCelularDialog } from '@/components/instalar/InstalarNoCelularDialog';
import { useAtrasadas } from '@/components/BarraInferior';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePWA } from '@/hooks/usePWA';
import { alternarMenuLateral } from '@/hooks/useMenuLateral';
import { cn } from '@/lib/utils';

type Link = { to: string; label: string; icon: LucideIcon; adminOnly?: boolean };

/** O menu em grupos ("ilhas"), do que mais se usa no dia para o que menos se usa. */
const GRUPOS: { titulo: string; links: Link[] }[] = [
    {
        titulo: 'Dia a dia',
        links: [
            { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { to: '/agenda', label: 'Agenda', icon: CalendarDays },
            { to: '/atendimentos', label: 'Atendimentos', icon: CalendarCheck },
        ],
    },
    {
        titulo: 'Cadastros',
        links: [
            { to: '/pessoas', label: 'Pessoas', icon: Users },
            { to: '/servicos', label: 'Serviços', icon: Scissors },
        ],
    },
    {
        titulo: 'Dinheiro',
        links: [
            { to: '/vendas', label: 'Vendas', icon: ShoppingCart },
            { to: '/financeiro', label: 'Financeiro', icon: DollarSign },
        ],
    },
];

type Props = {
    onNavigate: () => void;
    /** Só ícones (menu contraído do computador). */
    contraido?: boolean;
};

const ilhaCls = 'rounded-[1.75rem] border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-2 shadow-painel';

export function Sidebar({ onNavigate, contraido = false }: Props) {
    const { isAdmin } = useAuth();
    const { instalado } = usePWA();
    const isMobile = useIsMobile();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [qrAberto, setQrAberto] = useState(false);
    const atrasadas = useAtrasadas(true);

    // Celular: abre a página com o passo a passo. Computador: QR code para abrir no celular.
    const instalarNoCelular = () => {
        if (isMobile) {
            onNavigate();
            navigate('/instalar');
        } else {
            setQrAberto(true);
        }
    };

    const itemCls = (ativo: boolean) =>
        cn(
            'group/item relative flex items-center rounded-full text-sm font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.25)]',
            contraido ? 'h-12 w-12 justify-center' : 'h-11 gap-3 px-3.5',
            ativo
                ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_8px_18px_-8px_hsl(var(--primary)/0.7)]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]',
        );

    /** Nome do item ao passar o mouse, quando o menu está contraído. */
    const etiqueta = (texto: string) =>
        contraido && (
            <span
                role="presentation"
                className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-full bg-[hsl(var(--foreground))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--background))] opacity-0 shadow-flutuante transition-opacity duration-150 group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
            >
                {texto}
            </span>
        );

    const item = (link: Link) => {
        if (link.adminOnly && !isAdmin) return null;
        const Icon = link.icon;
        const aviso = link.to === '/financeiro' && atrasadas > 0;
        return (
            <NavLink
                key={link.to}
                to={link.to}
                onClick={onNavigate}
                aria-label={contraido ? link.label : undefined}
                className={({ isActive }) => itemCls(isActive || (link.to === '/dashboard' && pathname === '/'))}
            >
                <span className="relative">
                    <Icon className="h-5 w-5 shrink-0" />
                    {aviso && (
                        <span
                            aria-label={`${atrasadas} a receber atrasada${atrasadas > 1 ? 's' : ''}`}
                            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--destructive))] ring-2 ring-[hsl(var(--card))]"
                        />
                    )}
                </span>
                {!contraido && <span className="truncate">{link.label}</span>}
                {!contraido && aviso && (
                    <span className="ml-auto rounded-full bg-[hsl(var(--destructive))] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--destructive-foreground))]">
                        {atrasadas > 9 ? '9+' : atrasadas}
                    </span>
                )}
                {etiqueta(link.label)}
            </NavLink>
        );
    };

    const botaoCls = cn(itemCls(false), 'w-full');

    return (
        <nav aria-label="Menu" className={cn('flex h-full flex-col gap-3', contraido ? 'items-center' : '')}>
            {GRUPOS.map((g) => {
                const grupoAtivo = g.links.some((l) => pathname.startsWith(l.to) || (l.to === '/dashboard' && pathname === '/'));
                return (
                    <div key={g.titulo} className={cn(ilhaCls, 'flex flex-col gap-1', contraido ? 'items-center' : 'w-full')}>
                        {!contraido && (
                            <p className={cn(
                                'flex items-center gap-2 px-3.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider',
                                grupoAtivo ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]',
                            )}>
                                {grupoAtivo && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" aria-hidden />}
                                {g.titulo}
                            </p>
                        )}
                        {g.links.map(item)}
                    </div>
                );
            })}

            <div className={cn(ilhaCls, 'mt-auto flex flex-col gap-1', contraido ? 'items-center' : 'w-full')}>
                {item({ to: '/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true })}
                {!instalado && (
                    <button type="button" onClick={instalarNoCelular} aria-label={contraido ? 'Instalar no celular' : undefined}
                        className={contraido ? itemCls(false) : botaoCls}>
                        <Smartphone className="h-5 w-5 shrink-0" />
                        {!contraido && <span className="truncate">Instalar no celular</span>}
                        {etiqueta('Instalar no celular')}
                    </button>
                )}
                {!isMobile && (
                    <button type="button" onClick={alternarMenuLateral}
                        aria-label={contraido ? 'Abrir menu' : undefined} aria-expanded={!contraido}
                        className={contraido ? itemCls(false) : botaoCls}>
                        {contraido ? <PanelLeftOpen className="h-5 w-5 shrink-0" /> : <PanelLeftClose className="h-5 w-5 shrink-0" />}
                        {!contraido && <span className="truncate">Recolher menu</span>}
                        {etiqueta('Abrir menu')}
                    </button>
                )}
            </div>
            <InstalarNoCelularDialog open={qrAberto} onOpenChange={setQrAberto} />
        </nav>
    );
}
