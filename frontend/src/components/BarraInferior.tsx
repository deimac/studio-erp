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
                    'flex min-w-0 flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] font-medium',
                    isActive ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))]',
                )}>
                <span className="relative">
                    <Icone className="h-[22px] w-[22px]" />
                    {id === 'inicio' && atrasadas > 0 && (
                        <span aria-label={`${atrasadas} a receber atrasada${atrasadas > 1 ? 's' : ''}`}
                            className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
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
            className="fixed inset-x-0 bottom-0 z-30 border-t border-[hsl(var(--border))] bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
            <div className="mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
                {ids.slice(0, 2).map(item)}
                <div className="flex items-start justify-center">
                    <button type="button" aria-label="Ações rápidas"
                        onClick={() => { navigator.vibrate?.(10); abrirPainel(); }}
                        className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[hsl(var(--primary))] text-white shadow-[0_6px_16px_-4px_rgb(37_99_235/0.5)] active:scale-95">
                        <Plus className="h-7 w-7" />
                    </button>
                </div>
                {ids.slice(2, 4).map(item)}
            </div>
        </nav>
    );
}

/** Contas a receber vencidas antes de hoje (mesma consulta do Início, divide o cache). */
function useAtrasadas(ativo: boolean) {
    const { escopo } = useEscopo();
    const hojeISO = isoLocal(new Date());
    const q = trpc.financeiro.listWithDetails.useQuery(
        { tipo: 'RECEITA', situacao: 'NAO_PAGO', dataType: 'VENCIMENTO', dataFim: hojeISO, escopo },
        { refetchInterval: 60_000, enabled: ativo },
    );
    return ((q.data ?? []) as any[]).filter((c) => c.status !== 'CANCELADO' && (diaISO(c.data_vencimento) ?? '') < hojeISO).length;
}
