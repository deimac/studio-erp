import { useState } from 'react';
import { useEscopo } from '@/hooks/useEscopo';
import { trpc } from '@/services/trpc';
import { diaISO } from '@/lib/datas';
import { cn } from '@/lib/utils';
import { AtendimentoForm } from '@/components/AtendimentoForm';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ListaAtendimentos } from '@/components/ListaAtendimentos';
import { Search, CalendarCheck, CalendarDays, LayoutList, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

const ABERTOS = ['AGENDADO', 'CONFIRMADO'];

/** Filtros do cabeçalho: cada um mostra quantos atendimentos tem e filtra a lista ao tocar. */
const FILTROS = [
    { chave: 'TODOS', label: 'Todos', icon: LayoutList, teste: (_a: any, _h: string) => true, cor: 'text-slate-700', fundo: 'bg-slate-100', ativo: 'border-slate-400 bg-slate-50 ring-slate-300' },
    { chave: 'HOJE', label: 'Hoje', icon: CalendarDays, teste: (a: any, h: string) => diaISO(a.data) === h && a.status !== 'CANCELADO', cor: 'text-violet-600', fundo: 'bg-violet-100', ativo: 'border-violet-400 bg-violet-50 ring-violet-300' },
    { chave: 'ABERTOS', label: 'Agendados', icon: Clock, teste: (a: any) => ABERTOS.includes(a.status), cor: 'text-blue-600', fundo: 'bg-blue-100', ativo: 'border-blue-400 bg-blue-50 ring-blue-300' },
    { chave: 'REALIZADO', label: 'Realizados', icon: CheckCircle, teste: (a: any) => a.status === 'REALIZADO', cor: 'text-green-600', fundo: 'bg-green-100', ativo: 'border-green-400 bg-green-50 ring-green-300' },
    { chave: 'FALTOU', label: 'Faltas', icon: AlertCircle, teste: (a: any) => a.status === 'FALTOU', cor: 'text-amber-600', fundo: 'bg-amber-100', ativo: 'border-amber-400 bg-amber-50 ring-amber-300' },
    { chave: 'CANCELADO', label: 'Cancelados', icon: XCircle, teste: (a: any) => a.status === 'CANCELADO', cor: 'text-red-600', fundo: 'bg-red-100', ativo: 'border-red-400 bg-red-50 ring-red-300' },
] as const;

const hojeISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function Atendimentos() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [search, setSearch] = useState('');
    const [filtro, setFiltro] = useState<(typeof FILTROS)[number]['chave']>('TODOS');

    const { escopo } = useEscopo();
    const atendQ = trpc.atendimentos.list.useQuery({ escopo });
    const todos: any[] = atendQ.data ?? [];

    const hoje = hojeISO();
    const contagem = (f: (typeof FILTROS)[number]) => todos.filter((a) => f.teste(a, hoje)).length;
    const filtroAtual = FILTROS.find((f) => f.chave === filtro)!;

    // Detalhes que complementam os números
    const realizados = todos.filter((a) => a.status === 'REALIZADO').length;
    const faltas = todos.filter((a) => a.status === 'FALTOU').length;
    const detalhe: Partial<Record<(typeof FILTROS)[number]['chave'], string>> = {
        HOJE: (() => {
            const n = todos.filter((a) => diaISO(a.data) === hoje && ABERTOS.includes(a.status)).length;
            return n ? `${n} a fazer` : 'nada pendente';
        })(),
        FALTOU: realizados + faltas ? `${Math.round((faltas / (realizados + faltas)) * 100)}% dos atendidos` : undefined,
    };

    const termo = search.trim().toLowerCase();
    const filtered = atendQ.data && todos.filter((a) =>
        filtroAtual.teste(a, hoje) &&
        (!termo ||
            (a.pessoa_nome ?? '').toLowerCase().includes(termo) ||
            (a.profissional_nome ?? '').toLowerCase().includes(termo) ||
            (a.servico_nome ?? '').toLowerCase().includes(termo) ||
            (a.pacote_nome ?? '').toLowerCase().includes(termo)),
    );

    // Resumo do dia para o subtítulo
    const agora = new Date().toTimeString().slice(0, 5);
    const abertosHoje = todos
        .filter((a) => diaISO(a.data) === hoje && ABERTOS.includes(a.status))
        .sort((x, y) => String(x.hora_inicio).localeCompare(String(y.hora_inicio)));
    const proximo = abertosHoje.find((a) => String(a.hora_inicio).slice(0, 5) >= agora);
    const resumo = atendQ.isLoading
        ? 'Carregando…'
        : abertosHoje.length === 0
            ? 'Nenhum atendimento para hoje'
            : `${abertosHoje.length} para hoje` + (proximo ? ` · próximo às ${String(proximo.hora_inicio).slice(0, 5)} com ${String(proximo.pessoa_nome ?? '').split(' ')[0]}` : '');

    return (
        <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-gradient-to-br from-[hsl(var(--primary)/0.10)] via-white to-white shadow-sm">
                <div className="space-y-4 p-4 sm:p-6">
                    {/* Título + ação */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary)/0.3)] sm:h-12 sm:w-12">
                            <CalendarCheck className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Atendimentos</h2>
                            <p className="line-clamp-2 text-sm text-[hsl(var(--muted-foreground))] sm:truncate">{resumo}</p>
                        </div>
                        <div className="shrink-0">
                            <AtendimentoForm onSuccess={() => { utils.atendimentos.list.invalidate(); toast({ title: 'Atendimento agendado!', variant: 'success' }); }} />
                        </div>
                    </div>

                    {/* Busca */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Buscar cliente, profissional ou serviço…"
                            className="h-11 rounded-xl bg-white pl-9 sm:max-w-md"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Situações: contam e filtram */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
                        {FILTROS.map((f) => {
                            const Icon = f.icon;
                            const sel = filtro === f.chave;
                            return (
                                <button
                                    key={f.chave}
                                    type="button"
                                    onClick={() => setFiltro(f.chave)}
                                    aria-pressed={sel}
                                    className={cn(
                                        'flex min-w-0 items-center gap-3 rounded-xl border bg-white p-3 text-left transition-all',
                                        sel ? cn('ring-2', f.ativo) : 'border-[hsl(var(--border))] hover:border-gray-300 hover:shadow-sm',
                                    )}
                                >
                                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', f.fundo, f.cor)}>
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">{f.label}</span>
                                        <span className={cn('block text-xl font-bold leading-tight tabular-nums', f.cor)}>
                                            {atendQ.isLoading ? '–' : contagem(f)}
                                        </span>
                                        {!atendQ.isLoading && detalhe[f.chave] && (
                                            <span className="block truncate text-[11px] text-[hsl(var(--muted-foreground))]">{detalhe[f.chave]}</span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <Card>
                <CardContent className="p-0">
                    <ListaAtendimentos
                        atendimentos={filtered}
                        carregando={atendQ.isLoading}
                        vazio={termo || filtro !== 'TODOS' ? 'Nenhum atendimento com esse filtro.' : 'Nenhum atendimento.'}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
