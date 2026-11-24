import { trpc } from '@/services/trpc';
import { CalendarCheck, CalendarDays, DollarSign, LayoutDashboard, Scissors, Settings, ShoppingCart, Users, type LucideIcon } from 'lucide-react';

/** Atalhos que podem ir para a barra de baixo do celular (4 lugares, 2 de cada lado do +). */
export type AtalhoId = 'inicio' | 'agenda' | 'clientes' | 'vendas' | 'atendimentos' | 'financeiro' | 'servicos' | 'configuracoes';

export const ATALHOS: { id: AtalhoId; label: string; to: string; icone: LucideIcon; adminOnly?: boolean }[] = [
    { id: 'inicio', label: 'Dashboard', to: '/', icone: LayoutDashboard },
    { id: 'agenda', label: 'Agenda', to: '/agenda', icone: CalendarDays },
    { id: 'clientes', label: 'Clientes', to: '/pessoas', icone: Users },
    { id: 'vendas', label: 'Vendas', to: '/vendas', icone: ShoppingCart },
    { id: 'atendimentos', label: 'Atendimentos', to: '/atendimentos', icone: CalendarCheck },
    { id: 'financeiro', label: 'Financeiro', to: '/financeiro', icone: DollarSign },
    { id: 'servicos', label: 'Serviços', to: '/servicos', icone: Scissors },
    { id: 'configuracoes', label: 'Configurações', to: '/configuracoes', icone: Settings, adminOnly: true },
];

export const LUGARES = 4;
export const PADRAO: AtalhoId[] = ['inicio', 'agenda', 'clientes', 'vendas'];

/** Os 4 atalhos da barra de quem está logado (salvos no cadastro; padrão até mudar). */
export function useBarra(isAdmin: boolean): AtalhoId[] {
    const q = trpc.usuarios.meusAtalhos.useQuery(undefined, { staleTime: Infinity });
    const validos = new Set(ATALHOS.filter((a) => isAdmin || !a.adminOnly).map((a) => a.id));
    const ids = (q.data ?? []).filter((x): x is AtalhoId => validos.has(x as AtalhoId));
    return ids.length === LUGARES ? ids : PADRAO;
}

export function useSalvarBarra() {
    const utils = trpc.useUtils();
    return trpc.usuarios.salvarMeusAtalhos.useMutation({
        onSuccess: (_r, v) => utils.usuarios.meusAtalhos.setData(undefined, v.ids),
    });
}
