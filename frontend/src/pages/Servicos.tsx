import { useState, useRef, useSyncExternalStore } from 'react';
import { trpc } from '@/services/trpc';
import { ServicoForm } from '@/components/ServicoForm';
import { ProtocoloForm, type Protocolo } from '@/components/ProtocoloForm';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Check, ChevronRight, ExternalLink, Globe, SquarePen, Trash2, Package, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { resolveImageUrl } from '@/lib/media';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { useAcoesDaTela } from '@/components/acoes/AcoesRapidas';
import { Scissors } from 'lucide-react';

const SITE_URL = 'https://tsmassoterapeuta.com.br';
const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type ServicoItem = NonNullable<ReturnType<typeof trpc.servicos.list.useQuery>['data']>[number];
type Pacote = { id: number; id_servico: number | null; quantidade_sessoes: number; valor_total: string | number; status: string | null };
type Aba = 'servicos' | 'paginas' | 'tecnicas';
type Filtro = 'todos' | 'site' | 'sistema' | 'inativos';

// Aba escolhida fica lembrada neste navegador
const CHAVE_ABA = 'servicos.aba';
const ouvintes = new Set<() => void>();
function lerAba(): Aba {
    try { const v = localStorage.getItem(CHAVE_ABA); return v === 'paginas' || v === 'tecnicas' ? v : 'servicos'; } catch { return 'servicos'; }
}
function gravarAba(a: Aba) {
    try { localStorage.setItem(CHAVE_ABA, a); } catch { /* sem armazenamento */ }
    ouvintes.forEach((f) => f());
}

/**
 * Serviços em três abas:
 * - Serviços: todos juntos numa lista (o que se vende e agenda), com a página do site como etiqueta;
 * - Páginas do site (admin): as vitrines do site;
 * - Técnicas: etiquetas dos serviços.
 */
export default function Servicos() {
    const { user } = useAuth();
    const isAdmin = user?.perfil === 'ADMIN';
    const abaSalva = useSyncExternalStore((f) => { ouvintes.add(f); return () => ouvintes.delete(f); }, lerAba);
    const aba: Aba = abaSalva === 'paginas' && !isAdmin ? 'servicos' : abaSalva;

    const servicosQ = trpc.servicos.list.useQuery({ apenasAtivos: false });
    const protocolosQ = trpc.protocolos.list.useQuery();
    const todos = (servicosQ.data ?? []) as ServicoItem[];
    const protocolos = (protocolosQ.data ?? []) as Protocolo[];

    const abas: { id: Aba; rotulo: string }[] = [
        { id: 'servicos', rotulo: 'Serviços' },
        ...(isAdmin ? [{ id: 'paginas' as Aba, rotulo: 'Páginas do site' }] : []),
        { id: 'tecnicas', rotulo: 'Técnicas' },
    ];

    return (
        <div className="space-y-5">
            <div>
                <h2 className="text-xl font-bold tracking-tight">Serviços</h2>
                <p className="text-sm text-gray-500">
                    {aba === 'servicos' && 'O que você vende e agenda, com preço da sessão e pacotes.'}
                    {aba === 'paginas' && 'As páginas que aparecem no site. Os preços vêm dos serviços ligados a cada página.'}
                    {aba === 'tecnicas' && 'Etiquetas que descrevem os serviços (aparecem no site).'}
                </p>
            </div>

            <div role="tablist" className="flex gap-1 border-b">
                {abas.map((a) => (
                    <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} onClick={() => gravarAba(a.id)}
                        className={cn('-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                            aba === a.id ? 'border-[hsl(var(--primary))] text-[hsl(var(--primary))]' : 'border-transparent text-gray-500 hover:text-gray-800')}>
                        {a.rotulo}
                    </button>
                ))}
            </div>

            {aba === 'servicos' && <AbaServicos todos={todos} protocolos={protocolos} carregando={servicosQ.isLoading || protocolosQ.isLoading} />}
            {aba === 'paginas' && <AbaPaginas todos={todos} protocolos={protocolos} carregando={protocolosQ.isLoading} />}
            {aba === 'tecnicas' && <TecnicasPanel servicos={todos} />}
        </div>
    );
}

function AbaServicos({ todos, protocolos, carregando }: { todos: ServicoItem[]; protocolos: Protocolo[]; carregando: boolean }) {
    const { toast } = useToast();
    const { user, veTudo } = useAuth();
    const isAdmin = user?.perfil === 'ADMIN';
    const [busca, setBusca] = useState('');
    const [filtro, setFiltro] = useState<Filtro>('todos');
    const pacotesQ = trpc.pacotes.list.useQuery({ apenasAtivos: false });

    const pacotesPorServico = new Map<number, Pacote[]>();
    for (const p of (pacotesQ.data ?? []) as Pacote[]) {
        if (!p.id_servico) continue;
        pacotesPorServico.set(p.id_servico, [...(pacotesPorServico.get(p.id_servico) ?? []), p]);
    }

    const paginaPorId = new Map(protocolos.map((p, i) => [p.id, { ...p, ordem: i }]));
    const pagina = (s: ServicoItem) => (s.id_protocolo ? paginaPorId.get(s.id_protocolo) : undefined);
    const termo = busca.trim().toLowerCase();

    const contagem = {
        todos: todos.filter((s) => s.ativo).length,
        site: todos.filter((s) => s.ativo && pagina(s)).length,
        sistema: todos.filter((s) => s.ativo && !pagina(s)).length,
        inativos: todos.filter((s) => !s.ativo).length,
    };

    const lista = todos
        .filter((s) => (filtro === 'inativos' ? !s.ativo : s.ativo))
        .filter((s) => filtro !== 'site' || pagina(s))
        .filter((s) => filtro !== 'sistema' || !pagina(s))
        .filter((s) => !termo || s.nome.toLowerCase().includes(termo) || (pagina(s)?.nome ?? '').toLowerCase().includes(termo))
        .sort((a, b) => {
            // Agrupados pela página do site (na ordem do site); depois os só no sistema
            const pa = pagina(a)?.ordem ?? 999, pb = pagina(b)?.ordem ?? 999;
            return pa - pb || (a.ordem_modalidade ?? 0) - (b.ordem_modalidade ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR');
        });

    // Sem dono = da clínica (do admin); do colega só no modo Clínica
    const podeEditar = (s: ServicoItem) => veTudo || (s.id_profissional == null ? isAdmin : s.id_profissional === user?.id);
    const salvo = () => toast({ title: 'Serviço salvo', variant: 'success' });
    // Botão + do rodapé (celular)
    const [novoSinal, setNovoSinal] = useState(0);
    useAcoesDaTela([{ id: 'servico', label: 'Novo serviço', icone: Scissors, onSelect: () => setNovoSinal((n) => n + 1) }]);

    const filtros: { id: Filtro; rotulo: string }[] = [
        { id: 'todos', rotulo: 'Todos' },
        { id: 'site', rotulo: 'No site' },
        { id: 'sistema', rotulo: 'Só no sistema' },
        ...(contagem.inativos ? [{ id: 'inativos' as Filtro, rotulo: 'Inativos' }] : []),
    ];

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Buscar serviço…" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
                <div className="sm:ml-auto">
                    <ServicoForm onSuccess={salvo} trigger={<><Plus className="mr-1 h-4 w-4" /> Novo serviço</>} variant="default" />
                    <ServicoForm onSuccess={salvo} abrirSinal={novoSinal} />
                </div>
            </div>

            {isAdmin && (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {filtros.map((f) => (
                        <button key={f.id} type="button" onClick={() => setFiltro(f.id)}
                            className={cn('shrink-0 rounded-full border px-3 py-1 text-sm transition-colors',
                                filtro === f.id ? 'border-transparent bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                            {f.rotulo} <span className="tabular-nums opacity-70">{contagem[f.id]}</span>
                        </button>
                    ))}
                </div>
            )}
            {!isAdmin && contagem.inativos > 0 && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={filtro === 'inativos'} onChange={(e) => setFiltro(e.target.checked ? 'inativos' : 'todos')} />
                    Ver só os inativos ({contagem.inativos})
                </label>
            )}

            {carregando ? (
                <p className="py-8 text-center text-gray-400">Carregando…</p>
            ) : lista.length === 0 ? (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium">{termo ? 'Nenhum serviço com esse nome' : 'Nenhum serviço aqui ainda'}</p>
                            <p className="text-sm text-gray-500">Cadastre o que você vende e agenda: duração, preço da sessão e pacotes.</p>
                        </div>
                        {!termo && <ServicoForm onSuccess={salvo} trigger="Cadastrar serviço" />}
                    </CardContent>
                </Card>
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y">
                        {lista.map((s) => {
                            const pg = pagina(s);
                            const pacotes = (pacotesPorServico.get(s.id) ?? [])
                                .filter((p) => filtro === 'inativos' || String(p.status).toLowerCase() === 'ativo')
                                .sort((a, b) => a.quantidade_sessoes - b.quantidade_sessoes);
                            const dono = s.id_profissional && s.id_profissional !== user?.id ? (s.profissional_nome as string | null)?.split(' ')[0] : null;
                            const conteudo = (
                                <>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                            <p className="font-medium">{s.nome}</p>
                                            <p className="text-sm tabular-nums text-gray-600">{s.duracao_minutos} min · {fmt(s.valor)}</p>
                                        </div>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            {pacotes.map((p) => (
                                                <span key={p.id} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs tabular-nums text-blue-800">
                                                    <Package className="h-3 w-3" /> {p.quantidade_sessoes} sessões · {fmt(p.valor_total)}
                                                </span>
                                            ))}
                                            {pg ? (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                                                    <Globe className="h-3 w-3" /> No site: {pg.nome}
                                                </span>
                                            ) : (
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Só no sistema</span>
                                            )}
                                            {dono && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-800">de {dono}</span>}
                                        </div>
                                    </div>
                                    {podeEditar(s) && <ChevronRight className="h-5 w-5 shrink-0 self-center text-gray-300" />}
                                </>
                            );
                            const classe = cn('flex w-full items-start gap-3 px-4 py-3 text-left', !s.ativo && 'opacity-60');
                            return (
                                <li key={s.id}>
                                    {podeEditar(s) ? (
                                        <ServicoForm servico={s as any} onSuccess={salvo} triggerClassName={cn(classe, 'hover:bg-gray-50 active:bg-gray-100')} trigger={conteudo} />
                                    ) : (
                                        <div className={classe}>{conteudo}</div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </Card>
            )}
        </div>
    );
}

function AbaPaginas({ todos, protocolos, carregando }: { todos: ServicoItem[]; protocolos: Protocolo[]; carregando: boolean }) {
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();
    const invalidar = () => utils.protocolos.list.invalidate();
    const salvo = () => { invalidar(); toast({ title: 'Página do site salva', variant: 'success' }); };
    const reorderMut = trpc.protocolos.reorder.useMutation({ onSuccess: invalidar });
    const deleteMut = trpc.protocolos.delete.useMutation({
        onSuccess: () => { invalidar(); utils.servicos.list.invalidate(); toast({ title: 'Página do site removida', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function mover(i: number, delta: number) {
        const ids = protocolos.map((p) => p.id);
        const j = i + delta;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        reorderMut.mutate({ ids });
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <ProtocoloForm onSuccess={salvo} trigger={<><Plus className="mr-1 h-4 w-4" /> Nova página</>} />
            </div>
            {carregando && <p className="py-8 text-center text-gray-400">Carregando…</p>}
            {!carregando && protocolos.length === 0 && (
                <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-gray-500">Nenhuma página no site ainda.</p>
            )}
            {protocolos.map((p, i) => {
                const servs = todos.filter((s) => s.id_protocolo === p.id && s.ativo);
                return (
                    <Card key={p.id} className={cn('flex gap-3 p-4', !p.ativo && 'opacity-75')}>
                        {p.imagem_url ? (
                            <img src={resolveImageUrl(p.imagem_url)} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
                        ) : (
                            <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[10px] text-gray-400">sem foto</div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <h3 className="text-base font-semibold">{p.nome}</h3>
                                <Badge variant={p.ativo ? 'success' : 'warning'}>{p.ativo ? 'No site' : 'Fora do site'}</Badge>
                                {p.permite_vale_presente && <Badge variant="secondary">Vale-presente</Badge>}
                            </div>
                            {p.subtitulo && <p className="text-sm italic text-gray-500">{p.subtitulo}</p>}
                            <p className={cn('mt-1 text-sm', servs.length ? 'text-gray-600' : 'text-amber-700')}>
                                {servs.length
                                    ? `Preços de: ${servs.map((s) => s.nome_modalidade || s.nome).join(', ')}`
                                    : 'Sem serviço ligado: aparece no site sem preço. Adicione serviços em Editar página.'}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                <a href={`${SITE_URL}/protocolos/${p.slug}`} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-gray-100">
                                    <ExternalLink className="h-3.5 w-3.5" /> Ver no site
                                </a>
                                <ProtocoloForm protocolo={p} onSuccess={salvo} trigger={<><SquarePen className="mr-1 h-3.5 w-3.5 text-blue-600" /> Editar página</>} />
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-center gap-0.5">
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir no site" title="Subir no site" disabled={i === 0 || reorderMut.isPending} onClick={() => mover(i, -1)}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Descer no site" title="Descer no site" disabled={i === protocolos.length - 1 || reorderMut.isPending} onClick={() => mover(i, 1)}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Excluir página ${p.nome}`} title="Excluir página do site"
                                onClick={async () => {
                                    const ok = await confirm({
                                        title: 'Excluir página do site',
                                        description: `Excluir "${p.nome}"? A página sai do site. Os serviços continuam no sistema, com vendas e pacotes intactos.`,
                                        confirmLabel: 'Excluir',
                                        variant: 'danger',
                                    });
                                    if (ok) deleteMut.mutate({ id: p.id });
                                }}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}

function TecnicasPanel({ servicos }: { servicos: ServicoItem[] }) {
    const { user, veTudo } = useAuth();
    const podeEditarTecnica = (t: any) => veTudo || (t.id_profissional == null ? user?.perfil === 'ADMIN' : t.id_profissional === user?.id);
    const utils = trpc.useUtils();
    const { toast } = useToast();
    const confirm = useConfirm();
    const aberto = true;
    const [nome, setNome] = useState('');
    const [editId, setEditId] = useState<number | null>(null);
    const [editNome, setEditNome] = useState('');
    const editRef = useRef<HTMLInputElement>(null);
    const tecnicasQ = trpc.tecnicas.list.useQuery();
    const invalidar = () => { utils.tecnicas.list.invalidate(); utils.servicos.list.invalidate(); };
    const createMut = trpc.tecnicas.create.useMutation({
        onSuccess: () => { setNome(''); invalidar(); toast({ title: 'Técnica adicionada', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.tecnicas.update.useMutation({
        onSuccess: () => { setEditId(null); invalidar(); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const deleteMut = trpc.tecnicas.delete.useMutation({
        onSuccess: () => { invalidar(); toast({ title: 'Técnica removida' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    // Quantos serviços usam cada técnica
    const uso = new Map<number, { ativos: number; inativos: number }>();
    for (const s of servicos) {
        for (const t of s.tecnicas ?? []) {
            const u = uso.get(t.id) ?? { ativos: 0, inativos: 0 };
            if (s.ativo) u.ativos += 1; else u.inativos += 1;
            uso.set(t.id, u);
        }
    }
    const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);
    const descreverUso = (u?: { ativos: number; inativos: number }) => {
        if (!u || (!u.ativos && !u.inativos)) return 'Sem uso';
        const partes = [];
        if (u.ativos) partes.push(plural(u.ativos, 'serviço', 'serviços'));
        if (u.inativos) partes.push(plural(u.inativos, 'inativo', 'inativos'));
        return partes.join(' · ');
    };

    const lista = [...(tecnicasQ.data ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    function iniciarEdicao(id: number, atual: string) {
        setEditId(id);
        setEditNome(atual);
        setTimeout(() => editRef.current?.select(), 0);
    }
    function salvarEdicao() {
        const novo = editNome.trim();
        const atual = lista.find((t) => t.id === editId);
        if (!editId || !novo || novo === atual?.nome) { setEditId(null); return; }
        updateMut.mutate({ id: editId, nome: novo });
    }

    return (
        <Card>
            {aberto && (
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const n = nome.trim();
                            if (!n) return;
                            if (lista.some((t) => t.nome.toLowerCase() === n.toLowerCase())) {
                                toast({ title: 'Essa técnica já existe', variant: 'error' });
                                return;
                            }
                            createMut.mutate({ nome: n });
                        }}
                        className="flex gap-2"
                    >
                        <Input placeholder="Nome da nova técnica" value={nome} onChange={(e) => setNome(e.target.value)} className="max-w-sm" aria-label="Nome da nova técnica" />
                        <Button type="submit" size="sm" className="h-9 shrink-0" disabled={createMut.isPending || !nome.trim()}>
                            <Plus className="mr-1 h-4 w-4" />
                            {createMut.isPending ? 'Adicionando…' : 'Adicionar'}
                        </Button>
                    </form>

                    {tecnicasQ.isLoading && <p className="text-sm text-gray-400">Carregando…</p>}
                    {!tecnicasQ.isLoading && lista.length === 0 && (
                        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-500">
                            Nenhuma técnica ainda. Adicione a primeira acima.
                        </p>
                    )}

                    {lista.length > 0 && (
                        <ul className="grid grid-cols-1 overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
                            {lista.map((t) => {
                                const u = uso.get(t.id);
                                const n = (u?.ativos ?? 0) + (u?.inativos ?? 0);
                                const editando = editId === t.id;
                                return (
                                    <li key={t.id} className="group -mb-px -mr-px flex min-h-[52px] min-w-0 items-center gap-2 border-b border-r px-3 py-2">
                                        {editando ? (
                                            <form className="flex flex-1 items-center gap-1" onSubmit={(e) => { e.preventDefault(); salvarEdicao(); }}>
                                                <Input
                                                    ref={editRef}
                                                    value={editNome}
                                                    onChange={(e) => setEditNome(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Escape') setEditId(null); }}
                                                    className="h-8 flex-1 text-sm"
                                                    aria-label={`Novo nome para ${t.nome}`}
                                                />
                                                <Button type="submit" size="icon" variant="ghost" className="h-8 w-8" aria-label="Salvar" disabled={updateMut.isPending}>
                                                    <Check className="h-4 w-4 text-green-600" />
                                                </Button>
                                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancelar" onClick={() => setEditId(null)}>
                                                    <X className="h-4 w-4 text-gray-500" />
                                                </Button>
                                            </form>
                                        ) : (
                                            <>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium" title={t.nome}>{t.nome}</p>
                                                    <p className={`text-xs tabular-nums ${u?.ativos ? 'text-gray-600' : 'text-gray-400'}`}>
                                                        {descreverUso(u)}
                                                    </p>
                                                </div>
                                                {podeEditarTecnica(t) && <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Renomear ${t.nome}`} title="Renomear" onClick={() => iniciarEdicao(t.id, t.nome)}>
                                                        <SquarePen className="h-4 w-4 text-blue-600" />
                                                    </Button>
                                                    <Button
                                                        size="icon" variant="ghost" className="h-8 w-8 disabled:opacity-30"
                                                        aria-label={n ? `${t.nome} está em uso e não pode ser removida` : `Remover ${t.nome}`}
                                                        title={n ? 'Em uso: remova dos serviços para poder excluir' : 'Remover'}
                                                        disabled={n > 0 || deleteMut.isPending}
                                                        onClick={async () => {
                                                            const ok = await confirm({
                                                                title: 'Remover técnica',
                                                                description: `Remover "${t.nome}"? Ela não está em nenhum serviço.`,
                                                                confirmLabel: 'Remover',
                                                                variant: 'danger',
                                                            });
                                                            if (ok) deleteMut.mutate({ id: t.id });
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>}
                                            </>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </CardContent>
            )}
        </Card>
    );
}
