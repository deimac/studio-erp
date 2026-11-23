import { useState, useRef } from 'react';
import { trpc } from '@/services/trpc';
import { ServicoForm } from '@/components/ServicoForm';
import { ProtocoloForm, type Protocolo } from '@/components/ProtocoloForm';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Check, ChevronDown, ExternalLink, Layers, SquarePen, Trash2, Package, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { resolveImageUrl } from '@/lib/media';
import { useAuth } from '@/hooks/useAuth';

const SITE_URL = 'https://tsmassoterapeuta.com.br';
const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type ServicoItem = NonNullable<ReturnType<typeof trpc.servicos.list.useQuery>['data']>[number];

/**
 * Serviços. Protocolo = página do site (vitrine); serviço = o que se vende e
 * agenda (duração + preço da sessão); pacote = N sessões do serviço por um preço
 * fechado. Pacotes são editados dentro do formulário do serviço.
 */
export default function Servicos() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const { user } = useAuth();
    const isAdmin = user?.perfil === 'ADMIN';
    const utils = trpc.useUtils();
    const [search, setSearch] = useState('');
    const [verInativos, setVerInativos] = useState(false);
    const servicosQ = trpc.servicos.list.useQuery({ apenasAtivos: false });
    const pacotesQ = trpc.pacotes.list.useQuery({ apenasAtivos: false });
    const protocolosQ = trpc.protocolos.list.useQuery();
    const protocolos = (protocolosQ.data ?? []) as Protocolo[];

    const invalidarProtocolos = () => utils.protocolos.list.invalidate();
    const handleServicoSaved = () => toast({ title: 'Serviço salvo', variant: 'success' });
    const handleProtocoloSaved = () => {
        invalidarProtocolos();
        toast({ title: 'Página do site salva', variant: 'success' });
    };

    const reorderMut = trpc.protocolos.reorder.useMutation({ onSuccess: invalidarProtocolos });
    const deleteProtocoloMut = trpc.protocolos.delete.useMutation({
        onSuccess: () => {
            invalidarProtocolos();
            utils.servicos.list.invalidate();
            toast({ title: 'Página do site removida', variant: 'success' });
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function mover(i: number, delta: number) {
        const ids = protocolos.map((p) => p.id);
        const j = i + delta;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
        reorderMut.mutate({ ids });
    }

    const termo = search.trim().toLowerCase();
    const todos = (servicosQ.data ?? []) as ServicoItem[];
    const casa = (s: ServicoItem) =>
        !termo || s.nome.toLowerCase().includes(termo) || (s.nome_modalidade ?? '').toLowerCase().includes(termo);
    const visivel = (s: ServicoItem) => (verInativos || s.ativo) && casa(s);
    const inativos = todos.filter((s) => !s.ativo).length;

    const pacotesPorServico = new Map<number, Pacote[]>();
    for (const p of (pacotesQ.data ?? []) as Pacote[]) {
        if (!p.id_servico) continue;
        const l = pacotesPorServico.get(p.id_servico) ?? [];
        l.push(p);
        pacotesPorServico.set(p.id_servico, l);
    }

    const idsProtocolos = new Set(protocolos.map((p) => p.id));
    const semSite = todos.filter((s) => (!s.id_protocolo || !idsProtocolos.has(s.id_protocolo)) && visivel(s));
    // Fora do site: serviços da clínica e serviços próprios de cada profissional
    const avulsos = semSite.filter((s) => !s.id_profissional);
    const proprios = semSite.filter((s) => !!s.id_profissional);
    const donos: [number, string][] = [...new Map<number, string>(proprios.map((s) => [s.id_profissional as number, s.profissional_nome as string])).entries()]
        .sort((a, b) => (a[0] === user?.id ? -1 : b[0] === user?.id ? 1 : (a[1] ?? '').localeCompare(b[1] ?? '')));
    const carregando = servicosQ.isLoading || protocolosQ.isLoading;

    const lista = (servs: ServicoItem[]) => (
        <ServicosLista servicos={servs} pacotesPorServico={pacotesPorServico} verInativos={verInativos} onSaved={handleServicoSaved} />
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Serviços</h2>
                    <p className="max-w-2xl text-sm text-gray-500">
                        {isAdmin
                            ? 'Cada bloco é uma página do site com os serviços que ela mostra. Serviço é o que se vende e agenda; pacote é um conjunto de sessões com preço fechado.'
                            : 'Serviço é o que você vende e agenda; pacote é um conjunto de sessões com preço fechado.'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isAdmin && <ProtocoloForm onSuccess={handleProtocoloSaved} trigger="Nova página do site" />}
                    <ServicoForm onSuccess={handleServicoSaved} trigger={isAdmin ? undefined : 'Novo serviço meu'} />
                </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 sm:max-w-sm">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Buscar serviço…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                {inativos > 0 && (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={verInativos} onChange={(e) => setVerInativos(e.target.checked)} />
                        Mostrar inativos ({inativos})
                    </label>
                )}
            </div>

            {carregando && <p className="py-8 text-center text-gray-400">Carregando…</p>}

            {!carregando &&
                protocolos.map((p, i) => {
                    const protocoloCasa = !termo || p.nome.toLowerCase().includes(termo);
                    const servs = todos.filter((s) => s.id_protocolo === p.id && (verInativos || s.ativo) && (protocoloCasa || casa(s)));
                    if (termo && !protocoloCasa && servs.length === 0) return null;
                    if (!isAdmin && servs.length === 0) return null;
                    return (
                        <Card key={p.id} className="overflow-hidden">
                            {/* Página do site */}
                            <div className={`flex gap-3 border-b bg-[hsl(var(--muted))]/40 p-4 ${p.ativo ? '' : 'opacity-75'}`}>
                                {p.imagem_url ? (
                                    <img src={resolveImageUrl(p.imagem_url)} alt="" className="h-16 w-14 shrink-0 rounded-lg object-cover" />
                                ) : (
                                    <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg bg-white text-[10px] text-gray-400">sem foto</div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <h3 className="text-base font-semibold">{p.nome}</h3>
                                        <Badge variant={p.ativo ? 'success' : 'warning'}>{p.ativo ? 'No site' : 'Fora do site'}</Badge>
                                        {p.permite_vale_presente && <Badge variant="secondary">Vale-presente</Badge>}
                                    </div>
                                    {p.subtitulo && <p className="text-sm italic text-gray-500">{p.subtitulo}</p>}
                                    <div className="mt-2 flex flex-wrap items-center gap-1">
                                        <a href={`${SITE_URL}/protocolos/${p.slug}`} target="_blank" rel="noopener noreferrer"
                                            className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-gray-600 hover:bg-white">
                                            <ExternalLink className="h-3.5 w-3.5" /> Ver no site
                                        </a>
                                        {isAdmin && (
                                            <ProtocoloForm
                                                protocolo={p}
                                                onSuccess={handleProtocoloSaved}
                                                trigger={<><SquarePen className="mr-1 h-3.5 w-3.5 text-blue-600" /> Editar página</>}
                                            />
                                        )}
                                    </div>
                                </div>
                                {isAdmin && !termo && (
                                    <div className="flex shrink-0 flex-col items-center gap-0.5">
                                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir no site" disabled={i === 0 || reorderMut.isPending} onClick={() => mover(i, -1)}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Descer no site" disabled={i === protocolos.length - 1 || reorderMut.isPending} onClick={() => mover(i, 1)}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon" variant="ghost" className="h-8 w-8" aria-label={`Excluir página ${p.nome}`} title="Excluir página do site"
                                            onClick={async () => {
                                                const ok = await confirm({
                                                    title: 'Excluir página do site',
                                                    description: `Excluir "${p.nome}"? A página sai do site. Os serviços continuam no sistema, com vendas e pacotes intactos.`,
                                                    confirmLabel: 'Excluir',
                                                    variant: 'danger',
                                                });
                                                if (ok) deleteProtocoloMut.mutate({ id: p.id });
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Serviços da página */}
                            <div className="flex items-center justify-between px-4 pt-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Serviços</p>
                                {isAdmin && (
                                    <ServicoForm idProtocoloPadrao={p.id} onSuccess={handleServicoSaved} variant="ghost"
                                        trigger={<><Plus className="mr-1 h-4 w-4" /> Serviço</>} />
                                )}
                            </div>
                            {servs.length === 0 ? (
                                <p className="px-4 pb-4 pt-2 text-sm text-amber-700">
                                    Nenhum serviço: a página aparece no site sem preço e não pode ser vendida.
                                </p>
                            ) : (
                                lista(servs)
                            )}
                        </Card>
                    );
                })}

            {!carregando && avulsos.length > 0 && (
                <Card>
                    <CardHeader className="p-4 pb-0">
                        <CardTitle className="text-base">Serviços só no sistema</CardTitle>
                        <p className="text-sm text-gray-500">
                            Vendidos e agendados normalmente, mas não aparecem no site.{isAdmin ? ' Para levar ao site, edite e marque "Exibir no site".' : ''}
                        </p>
                    </CardHeader>
                    {lista(avulsos)}
                </Card>
            )}

            {!carregando && donos.map(([idDono, nomeDono]) => (
                <Card key={idDono} className="border-violet-200">
                    <CardHeader className="p-4 pb-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">{idDono === user?.id ? 'Meus serviços' : `Serviços de ${nomeDono}`}</CardTitle>
                            <Badge variant="outline">Só no sistema</Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                            {idDono === user?.id ? 'Você vende e agenda estes serviços. Colegas não os veem.' : 'Serviços próprios do profissional: só ele vende e agenda.'}
                        </p>
                    </CardHeader>
                    {lista(proprios.filter((s) => s.id_profissional === idDono))}
                </Card>
            ))}

            {!carregando && !isAdmin && !donos.length && !termo && (
                <Card className="border-dashed">
                    <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="font-medium">Você ainda não tem serviços próprios</p>
                            <p className="text-sm text-gray-500">Cadastre os serviços que você vende e agenda, com os pacotes. Eles ficam só no sistema.</p>
                        </div>
                        <ServicoForm onSuccess={handleServicoSaved} trigger="Cadastrar serviço" />
                    </CardContent>
                </Card>
            )}

            {!carregando && termo && semSite.length === 0 && !protocolos.some((p) => p.nome.toLowerCase().includes(termo) || todos.some((s) => s.id_protocolo === p.id && casa(s))) && (
                <p className="py-8 text-center text-gray-400">Nada encontrado.</p>
            )}

            <TecnicasPanel servicos={todos} />
        </div>
    );
}

type Pacote = { id: number; id_servico: number | null; quantidade_sessoes: number; valor_total: string | number; status: string | null };

/** Linhas de serviço: nome, duração, preço da sessão e os pacotes. */
function ServicosLista({
    servicos,
    pacotesPorServico,
    verInativos,
    onSaved,
}: {
    servicos: ServicoItem[];
    pacotesPorServico: Map<number, Pacote[]>;
    verInativos: boolean;
    onSaved: () => void;
}) {
    const { user } = useAuth();
    const podeEditar = (s: ServicoItem) => user?.perfil === 'ADMIN' || (s.id_profissional != null && s.id_profissional === user?.id);
    const ordenados = [...servicos].sort((a, b) => (a.ordem_modalidade ?? 0) - (b.ordem_modalidade ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR'));

    return (
        <ul className="divide-y">
            {ordenados.map((s) => {
                const titulo = s.nome_modalidade || s.nome;
                const pacotes = (pacotesPorServico.get(s.id) ?? [])
                    .filter((p) => verInativos || String(p.status).toLowerCase() === 'ativo')
                    .sort((a, b) => a.quantidade_sessoes - b.quantidade_sessoes);
                return (
                    <li key={s.id} className={`flex items-start gap-3 px-4 py-3 ${s.ativo ? '' : 'opacity-60'}`}>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <p className="font-medium">{titulo}</p>
                                <p className="text-sm tabular-nums text-gray-600">
                                    {s.duracao_minutos} min · {fmt(s.valor)}
                                </p>
                                {!s.ativo && <Badge variant="destructive">Inativo</Badge>}
                            </div>
                            {pacotes.length > 0 ? (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {pacotes.map((p) => {
                                        const ativo = String(p.status).toLowerCase() === 'ativo';
                                        return (
                                            <span key={p.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs tabular-nums ${ativo ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-gray-200 bg-gray-50 text-gray-500 line-through'}`}>
                                                <Package className="h-3 w-3" />
                                                {p.quantidade_sessoes} sessões · {fmt(p.valor_total)}
                                            </span>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="mt-1 text-xs text-gray-400">Só sessão avulsa</p>
                            )}
                        </div>
                        {podeEditar(s) && (
                            <ServicoForm servico={s as any} onSuccess={onSaved} trigger={<SquarePen className="h-4 w-4 text-blue-600" />} />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function TecnicasPanel({ servicos }: { servicos: ServicoItem[] }) {
    const { user } = useAuth();
    const podeEditarTecnica = (t: any) => user?.perfil === 'ADMIN' || (t.id_profissional != null && t.id_profissional === user?.id);
    const utils = trpc.useUtils();
    const { toast } = useToast();
    const confirm = useConfirm();
    const [aberto, setAberto] = useState(false);
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
            <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                aria-expanded={aberto}
                className="flex w-full items-center gap-3 rounded-xl px-5 py-4 text-left transition-colors hover:bg-[hsl(var(--muted))]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]">
                    <Layers className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">Técnicas</span>
                        <span className="rounded-full bg-[hsl(var(--muted))] px-2 py-0.5 text-xs font-medium tabular-nums text-gray-600">{lista.length}</span>
                    </span>
                    <span className="block text-xs text-gray-500">Etiquetas dos serviços, mostradas no site. Renomear aqui muda em todos os serviços.</span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <CardContent className="space-y-4 border-t px-5 pb-5 pt-4">
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
