import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { definirEscopo, useEscopo } from '@/hooks/useEscopo';
import { cn } from '@/lib/utils';
import { LayoutGrid, LogOut, Menu as MenuIcon, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { definirTema, useTema, type Estilo, type Modo } from '@/hooks/useTema';
import { Button } from '@/components/ui/button';
import { PillGroup } from '@/components/ui/pill-group';
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
    cn('flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs font-medium transition-colors',
        ativo ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm ring-1 ring-[hsl(var(--border))]'
            : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]');

/** Escolha de aparência dentro do menu da conta */
function Aparencia() {
    const tema = useTema();
    return (
        <div className="space-y-2 px-3 py-3">
            <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Aparência</p>
            <div className="flex gap-1 rounded-full bg-[hsl(var(--muted))] p-1" role="radiogroup" aria-label="Cores">
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
            <div className="flex gap-1 rounded-full bg-[hsl(var(--muted))] p-1" role="radiogroup" aria-label="Claro ou escuro">
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

const itemCls = 'flex cursor-pointer items-center gap-2.5 rounded-full px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-[hsl(var(--accent))]';

export function Header({ onMenuToggle }: Props) {
    const { user, isAdmin, isEspectador, logout } = useAuth();
    const { valor: escopo, podeEscolher } = useEscopo();
    const navigate = useNavigate();
    const [barraAberta, setBarraAberta] = useState(false);

    const tema = useTema();
    const escuroAgora = tema.modo === 'escuro' || (tema.modo === 'auto' && document.documentElement.classList.contains('dark'));

    return (
        <header className="relative z-30 mx-3 mt-[max(0.75rem,env(safe-area-inset-top))] flex h-14 shrink-0 items-center justify-between gap-3 rounded-full border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] pl-2 pr-2 shadow-painel lg:mx-0 lg:mt-0 lg:h-16 lg:pl-3">
            <div className="flex min-w-0 items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle} aria-label="Abrir menu">
                    <MenuIcon className="h-5 w-5" />
                </Button>
                <h1 className="truncate text-lg font-bold tracking-tight text-[hsl(var(--primary))] lg:hidden">Studio ERP</h1>
                <p className="hidden truncate pl-3 text-sm font-medium text-[hsl(var(--muted-foreground))] first-letter:uppercase lg:block">
                    {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            <div className="flex items-center gap-2">
                {podeEscolher && (
                    <PillGroup label="O que as listas mostram" size="sm" className="hidden sm:inline-flex"
                        value={escopo} onChange={definirEscopo}
                        options={[{ value: 'GERAL', label: 'Geral' }, { value: 'MEU', label: 'Só meu' }]} />
                )}

                {/* Claro/escuro sempre à mão (as cores Clássico/Rosé ficam no menu da conta) */}
                <div role="radiogroup" aria-label="Claro ou escuro" className="hidden items-center gap-0.5 rounded-full bg-[hsl(var(--muted))] p-1 sm:flex">
                    {([['claro', Sun, 'Tema claro'], ['escuro', Moon, 'Tema escuro']] as const).map(([m, Icone, nome]) => {
                        const ativo = (m === 'escuro') === escuroAgora;
                        return (
                            <button key={m} type="button" role="radio" aria-checked={ativo} aria-label={nome} title={nome}
                                onClick={() => definirTema({ modo: m })}
                                className={cn('flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.25)]',
                                    ativo ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))] shadow-painel' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
                                <Icone className="h-4 w-4" />
                            </button>
                        );
                    })}
                </div>

                <Menu.Root>
                    <Menu.Trigger asChild>
                        <button type="button" aria-label="Minha conta"
                            className="flex items-center gap-2 rounded-full p-0.5 outline-none transition-colors hover:bg-[hsl(var(--accent))] focus-visible:ring-4 focus-visible:ring-[hsl(var(--ring)/0.25)] sm:pl-3">
                            <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{user?.nome || user?.email}</span>
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
                                {iniciais(user?.nome || user?.email)}
                            </span>
                        </button>
                    </Menu.Trigger>
                    <Menu.Portal>
                        <Menu.Content align="end" sideOffset={10}
                            className="z-50 w-72 rounded-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2 shadow-flutuante">
                            <div className="flex items-center gap-3 rounded-2xl bg-[hsl(var(--muted))] px-3 py-3">
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))]">
                                    {iniciais(user?.nome || user?.email)}
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold">{user?.nome || user?.email}</p>
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{user ? ROTULO_PERFIL[user.perfil] : ''}</p>
                                </div>
                            </div>
                            {podeEscolher && (
                                <div className="px-3 pt-3 sm:hidden">
                                    <p className="mb-2 text-xs font-semibold text-[hsl(var(--muted-foreground))]">As listas mostram</p>
                                    <PillGroup label="O que as listas mostram" size="sm" className="w-full [&>button]:flex-1"
                                        value={escopo} onChange={definirEscopo}
                                        options={[{ value: 'GERAL', label: 'Geral' }, { value: 'MEU', label: 'Só meu' }]} />
                                </div>
                            )}
                            <Aparencia />
                            <Menu.Separator className="mx-2 my-1 h-px bg-[hsl(var(--border))]" />
                            {isAdmin && (
                                <Menu.Item className={itemCls} onSelect={() => navigate('/configuracoes')}>
                                    <Settings className="h-4 w-4" /> Configurações
                                </Menu.Item>
                            )}
                            {!isEspectador && (
                                <Menu.Item className={cn(itemCls, 'lg:hidden')} onSelect={() => setBarraAberta(true)}>
                                    <LayoutGrid className="h-4 w-4" /> Barra do celular
                                </Menu.Item>
                            )}
                            <Menu.Item className={cn(itemCls, 'text-red-600 data-[highlighted]:bg-red-50')} onSelect={logout}>
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
