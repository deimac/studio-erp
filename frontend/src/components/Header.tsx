import { useAuth } from '@/hooks/useAuth';
import { LogOut, Menu, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = { onMenuToggle: () => void };

export function Header({ onMenuToggle }: Props) {
    const { user, logout } = useAuth();

    return (
        <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center justify-between border-b border-[hsl(var(--border))] bg-white px-4 lg:px-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle}>
                    <Menu className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-bold tracking-tight text-[hsl(var(--primary))]">
                    Studio ERP
                </h1>
            </div>

            <div className="flex items-center gap-3">
                <span className="hidden items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))] sm:flex">
                    <User className="h-4 w-4" />
                    {user?.nome || user?.email}
                    <span className="rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        {user?.perfil}
                    </span>
                </span>
                <Button variant="ghost" size="icon" onClick={logout} title="Sair">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
        </header>
    );
}
