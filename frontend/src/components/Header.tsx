import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { definirEscopo, useEscopo } from '@/hooks/useEscopo';
import { cn } from '@/lib/utils';
import { LayoutGrid, LogOut, Menu as MenuIcon, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PersonalizarBarraDialog } from '@/components/acoes/PersonalizarBarra';

type Props = { onMenuToggle: () => void };

const iniciais = (nome?: string | null) =>
    (nome ?? '?').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase() || '?';

const itemCls = 'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-[hsl(var(--accent))]';

export function Header({ onMenuToggle }: Props) {
    const { user, isAdmin, logout } = useAuth();
    const { valor: escopo, podeEscolher } = useEscopo();
    const navigate = useNavigate();
    const [barraAberta, setBarraAberta] = useState(false);

    return (
        <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center justify-between border-b border-[hsl(var(--border))] bg-white px-4 lg:px-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle} aria-label="Abrir menu">
                    <MenuIcon className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-bold tracking-tight text-[hsl(var(--primary))]">
                    Studio ERP
                </h1>
            </div>

            <div className="flex items-center gap-3">
                {podeEscolher && (
                    <div className="flex rounded-md border p-0.5 text-xs" title="O que as listas mostram">
                        {(['GERAL', 'MEU'] as const).map((e) => (
                            <button key={e} type="button" onClick={() => definirEscopo(e)}
                                className={cn('rounded px-2.5 py-1', escopo === e ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]')}>
                                {e === 'GERAL' ? 'Geral' : 'Só meu'}
                            </button>
                        ))}
                    </div>
                )}

                <Menu.Root>
                    <Menu.Trigger asChild>
                        <button type="button" aria-label="Minha conta"
                            className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]">
                            <span className="hidden text-sm text-[hsl(var(--muted-foreground))] sm:inline">{user?.nome || user?.email}</span>
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-sm font-semibold text-white">
                                {iniciais(user?.nome || user?.email)}
                            </span>
                        </button>
                    </Menu.Trigger>
                    <Menu.Portal>
                        <Menu.Content align="end" sideOffset={8}
                            className="z-50 w-60 rounded-xl border border-[hsl(var(--border))] bg-white p-1.5 shadow-lg">
                            <div className="px-3 py-2">
                                <p className="truncate text-sm font-semibold">{user?.nome || user?.email}</p>
                                <span className="mt-1 inline-block rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">{user?.perfil}</span>
                            </div>
                            <Menu.Separator className="my-1 h-px bg-[hsl(var(--border))]" />
                            {isAdmin && (
                                <Menu.Item className={itemCls} onSelect={() => navigate('/configuracoes')}>
                                    <Settings className="h-4 w-4" /> Configurações
                                </Menu.Item>
                            )}
                            <Menu.Item className={cn(itemCls, 'lg:hidden')} onSelect={() => setBarraAberta(true)}>
                                <LayoutGrid className="h-4 w-4" /> Barra do celular
                            </Menu.Item>
                            <Menu.Separator className="my-1 h-px bg-[hsl(var(--border))]" />
                            <Menu.Item className={cn(itemCls, 'text-red-600')} onSelect={logout}>
                                <LogOut className="h-4 w-4" /> Sair
                            </Menu.Item>
                        </Menu.Content>
                    </Menu.Portal>
                </Menu.Root>
            </div>
            <PersonalizarBarraDialog open={barraAberta} onOpenChange={setBarraAberta} />
        </header>
    );
}
