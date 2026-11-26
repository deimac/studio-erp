import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { definirEscopo, useEscopo } from '@/hooks/useEscopo';
import { cn } from '@/lib/utils';
import { LayoutGrid, LogOut, Menu as MenuIcon, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { definirTema, useTema, type Estilo, type Modo } from '@/hooks/useTema';
import { Button } from '@/components/ui/button';
import { PersonalizarBarraDialog } from '@/components/acoes/PersonalizarBarra';

type Props = { onMenuToggle: () => void };

const iniciais = (nome?: string | null) =>
    (nome ?? '?').trim().split(/\s+/).filter(Boolean).map((p) => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase() || '?';

const MODOS: { v: Modo; label: string; Icone: typeof Sun }[] = [
    { v: 'claro', label: 'Claro', Icone: Sun },
    { v: 'escuro', label: 'Escuro', Icone: Moon },
    { v: 'auto', label: 'Auto', Icone: Monitor },
];
const ESTILOS: { v: Estilo; label: string; cores: [string, string] }[] = [
    { v: 'classico', label: 'Clássico', cores: ['#2563eb', '#e2e8f0'] },
    { v: 'rose', label: 'Rosé', cores: ['#8a5359', '#efe6dc'] },
];
const segCls = (ativo: boolean) =>
    cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
        ativo ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--border))]'
            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]');

/** Escolha de aparência dentro do menu da conta */
function Aparencia() {
    const tema = useTema();
    return (
        <div className="space-y-2 px-3 py-2">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Aparência</p>
            <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1" role="radiogroup" aria-label="Cores">
                {ESTILOS.map((e) => (
                    <button key={e.v} type="button" role="radio" aria-checked={tema.estilo === e.v}
                        className={segCls(tema.estilo === e.v)} onClick={() => definirTema({ estilo: e.v })}>
                        <span className="flex -space-x-1" aria-hidden>
                            <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: e.cores[0] }} />
                            <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: e.cores[1] }} />
                        </span>
                        {e.label}
                    </button>
                ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-[hsl(var(--muted))] p-1" role="radiogroup" aria-label="Claro ou escuro">
                {MODOS.map(({ v, label, Icone }) => (
                    <button key={v} type="button" role="radio" aria-checked={tema.modo === v}
                        title={v === 'auto' ? 'Segue o tema do celular/computador' : undefined} aria-label={label}
                        className={segCls(tema.modo === v)} onClick={() => definirTema({ modo: v })}>
                        <Icone className="h-3.5 w-3.5" /> {label}
                    </button>
                ))}
            </div>
        </div>
    );
}

const itemCls = 'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-[hsl(var(--accent))]';

export function Header({ onMenuToggle }: Props) {
    const { user, isAdmin, logout } = useAuth();
    const { valor: escopo, podeEscolher } = useEscopo();
    const navigate = useNavigate();
    const [barraAberta, setBarraAberta] = useState(false);

    return (
        <header className="sticky top-0 z-30 flex h-[var(--header-height)] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 lg:px-6">
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
                                className={cn('rounded px-2.5 py-1', escopo === e ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]')}>
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
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
                                {iniciais(user?.nome || user?.email)}
                            </span>
                        </button>
                    </Menu.Trigger>
                    <Menu.Portal>
                        <Menu.Content align="end" sideOffset={8}
                            className="z-50 w-64 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 shadow-lg">
                            <div className="px-3 py-2">
                                <p className="truncate text-sm font-semibold">{user?.nome || user?.email}</p>
                                <span className="mt-1 inline-block rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-semibold uppercase text-[hsl(var(--primary-foreground))]">{user?.perfil}</span>
                            </div>
                            <Menu.Separator className="my-1 h-px bg-[hsl(var(--border))]" />
                            <Aparencia />
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
