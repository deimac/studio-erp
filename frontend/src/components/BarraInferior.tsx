import { NavLink } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useEscopo } from '@/hooks/useEscopo';
import { diaISO } from '@/lib/datas';
import { ATALHOS, useBarra, type AtalhoId } from '@/lib/barra';
import { useAcoesRapidas } from '@/components/acoes/AcoesRapidas';
import { cn } from '@/lib/utils';

const isoLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Celular e tablet: atalhos no rodapé (escolhidos pelo usuário) com o + no meio. */
export function BarraInferior() {
    const { isAdmin } = useAuth();
    const ids = useBarra(isAdmin);
    const { abrirPainel } = useAcoesRapidas();
    const atrasadas = useAtrasadas(ids.includes('inicio'));

    const item = (id: AtalhoId) => {
        const a = ATALHOS.find((x) => x.id === id)!;
        const Icone = a.icone;
        return (
            <NavLink key={id} to={a.to} end={a.to === '/'}
                className={({ isActive }) => cn(
                    'group flex min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                    isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]',
                )}>
                <span className="relative flex h-8 w-12 items-center justify-center rounded-full transition-colors group-aria-[current=page]:bg-[hsl(var(--primary))] group-aria-[current=page]:text-[hsl(var(--primary-foreground))]">
                    <Icone className="h-5 w-5" />
                    {id === 'inicio' && atrasadas > 0 && (
                        <span aria-label={`${atrasadas} a receber atrasada${atrasadas > 1 ? 's' : ''}`}
                            className="absolute -right-0.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[hsl(var(--destructive))] px-1 text-[10px] font-bold leading-none text-[hsl(var(--destructive-foreground))]">
                            {atrasadas > 9 ? '9+' : atrasadas}
                        </span>
                    )}
                </span>
                <span className="w-full truncate text-center">{a.label}</span>
            </NavLink>
        );
    };

    return (
        <nav aria-label="Atalhos"
            className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg rounded-full border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] shadow-flutuante lg:hidden">
            <div className="grid h-16 grid-cols-5 px-1">
                {ids.slice(0, 2).map(item)}
                <div className="flex items-center justify-center">
                    <button type="button" aria-label="Ações rápidas"
                        onClick={() => { navigator.vibrate?.(10); abrirPainel(); }}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_6px_16px_-4px_hsl(var(--primary)/0.5)] active:scale-95">
                        <Plus className="h-6 w-6" />
                    </button>
                </div>
                {ids.slice(2, 4).map(item)}
            </div>
        </nav>
    );
}

/** Contas a receber vencidas antes de hoje (mesma consulta do Início, divide o cache). */
export function useAtrasadas(ativo: boolean) {
    const { escopo } = useEscopo();
    const hojeISO = isoLocal(new Date());
    const q = trpc.financeiro.listWithDetails.useQuery(
        { tipo: 'RECEITA', situacao: 'NAO_PAGO', dataType: 'VENCIMENTO', dataFim: hojeISO, escopo },
        { refetchInterval: 60_000, enabled: ativo },
    );
    return ((q.data ?? []) as any[]).filter((c) => c.status !== 'CANCELADO' && (diaISO(c.data_vencimento) ?? '') < hojeISO).length;
}
