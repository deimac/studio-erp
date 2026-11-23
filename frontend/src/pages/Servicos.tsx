import { Fragment, useState, useRef } from 'react';
import { trpc } from '@/services/trpc';
import { ServicoForm } from '@/components/ServicoForm';
import { PacoteForm } from '@/components/PacoteForm';
import { ProtocoloForm, type Protocolo } from '@/components/ProtocoloForm';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, ExternalLink, SquarePen, Trash2, Package, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { hasVendasVinculadasPacote } from '@/services/hasVendasVinculadasPacote';
import { resolveImageUrl } from '@/lib/media';
import { useAuth } from '@/hooks/useAuth';

const SITE_URL = 'https://tsmassoterapeuta.com.br';
const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type ServicoItem = NonNullable<ReturnType<typeof trpc.servicos.list.useQuery>['data']>[number];

/**
 * Serviços agrupados por protocolo. O protocolo guarda o conteúdo do site;
 * cada serviço dentro dele é uma modalidade (preço, duração, pacotes) usada em
 * vendas, atendimentos e financeiro.
 */
export default function Servicos() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const { user } = useAuth();
    const isAdmin = user?.perfil === 'ADMIN';
    const utils = trpc.useUtils();
    const [search, setSearch] = useState('');
    const servicosQ = trpc.servicos.list.useQuery();
    const protocolosQ = trpc.protocolos.list.useQuery();
    const protocolos = (protocolosQ.data ?? []) as Protocolo[];

    const invalidarProtocolos = () => {
        utils.protocolos.list.invalidate();
    };
    const handleServicoSaved = () => {
        utils.servicos.list.invalidate();
        invalidarProtocolos();
        toast({ title: 'Serviço salvo!', variant: 'success' });
    };
    const handleProtocoloSaved = () => {
        invalidarProtocolos();
        toast({ title: 'Protocolo salvo!', variant: 'success' });
    };

    const reorderMut = trpc.protocolos.reorder.useMutation({ onSuccess: invalidarProtocolos });
    const deleteProtocoloMut = trpc.protocolos.delete.useMutation({
        onSuccess: () => {
            invalidarProtocolos();
            utils.servicos.list.invalidate();
            toast({ title: 'Protocolo removido', variant: 'success' });
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
    const todos = servicosQ.data ?? [];
    const casa = (s: ServicoItem) =>
        !termo || s.nome.toLowerCase().includes(termo) || (s.nome_modalidade ?? '').toLowerCase().includes(termo);
    const idsProtocolos = new Set(protocolos.map((p) => p.id));
    const avulsos = todos.filter((s) => (!s.id_protocolo || !idsProtocolos.has(s.id_protocolo)) && casa(s));
    const carregando = servicosQ.isLoading || protocolosQ.isLoading;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight">Serviços</h2>
                    <p className="text-sm text-gray-500">
                        Cada protocolo agrupa suas modalidades. A modalidade é o serviço vendido: preço, duração e pacotes.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {isAdmin && <ProtocoloForm onSuccess={handleProtocoloSaved} />}
                    <ServicoForm onSuccess={handleServicoSaved} />
                </div>
            </div>

            <TecnicasPanel />

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar protocolo ou serviço…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {carregando && <p className="py-8 text-center text-gray-400">Carregando…</p>}

            {!carregando &&
                protocolos.map((p, i) => {
                    const protocoloCasa = !termo || p.nome.toLowerCase().includes(termo);
                    const modalidades = todos.filter((s) => s.id_protocolo === p.id && (protocoloCasa || casa(s)));
                    if (termo && !protocoloCasa && modalidades.length === 0) return null;
                    return (
                        <Card key={p.id} className={p.ativo ? '' : 'opacity-70'}>
                            <CardHeader className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                                {isAdmin && !termo && (
                                    <div className="flex items-center gap-1 sm:flex-col">
                                        <Button size="sm" variant="ghost" aria-label="Subir" disabled={i === 0 || reorderMut.isPending} onClick={() => mover(i, -1)}>
                                            <ArrowUp className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="ghost" aria-label="Descer" disabled={i === protocolos.length - 1 || reorderMut.isPending} onClick={() => mover(i, 1)}>
                                            <ArrowDown className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                                {p.imagem_url ? (
                                    <img src={resolveImageUrl(p.imagem_url)} alt={p.nome} className="h-16 w-14 shrink-0 rounded-lg object-cover" />
                                ) : (
                                    <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-xs text-gray-400">sem foto</div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle className="text-base">{p.nome}</CardTitle>
                                        <Badge variant="outline">Protocolo</Badge>
                                        {!p.ativo && <Badge variant="warning">Fora do site</Badge>}
                                        {p.permite_vale_presente && <Badge variant="secondary">Vale-presente</Badge>}
                                    </div>
                                    {p.subtitulo && <p className="text-sm italic text-gray-500">{p.subtitulo}</p>}
                                </div>
                                <div className="flex flex-wrap items-center gap-1 self-end sm:self-center">
                                    <a href={`${SITE_URL}/protocolos/${p.slug}`} target="_blank" rel="noopener noreferrer" aria-label="Ver no site" title="Ver no site">
                                        <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
                                    </a>
                                    {isAdmin && (
                                        <ProtocoloForm
                                            protocolo={p}
                                            onSuccess={handleProtocoloSaved}
                                            trigger={<><SquarePen className="mr-1 h-4 w-4 text-blue-600" /> Conteúdo do site</>}
                                        />
                                    )}
                                    <ServicoForm
                                        idProtocoloPadrao={p.id}
                                        onSuccess={handleServicoSaved}
                                        trigger={<><Plus className="mr-1 h-4 w-4" /> Modalidade</>}
                                        variant="outline"
                                    />
                                    {isAdmin && (
                                        <Button
                                            size="sm" variant="ghost" aria-label="Excluir protocolo" title="Excluir protocolo"
                                            onClick={async () => {
                                                const ok = await confirm({
                                                    title: 'Excluir protocolo',
                                                    description: `Excluir "${p.nome}"? Ele sai do site. As modalidades continuam como serviços avulsos, com vendas e pacotes intactos.`,
                                                    confirmLabel: 'Excluir',
                                                    variant: 'danger',
                                                });
                                                if (ok) deleteProtocoloMut.mutate({ id: p.id });
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {modalidades.length === 0 ? (
                                    <p className="border-t px-4 py-4 text-sm text-amber-600">
                                        Nenhuma modalidade. Sem modalidade o protocolo aparece no site sem preço e não pode ser vendido.
                                    </p>
                                ) : (
                                    <ServicosTabela servicos={modalidades} onSaved={handleServicoSaved} modoModalidade />
                                )}
                            </CardContent>
                        </Card>
                    );
                })}

            {!carregando && avulsos.length > 0 && (
                <Card>
                    <CardHeader className="p-4">
                        <CardTitle className="text-base">Serviços sem protocolo</CardTitle>
                        <p className="text-sm text-gray-500">
                            Vendáveis normalmente, mas não aparecem no site. Para levar ao site, edite e escolha um protocolo.
                        </p>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ServicosTabela servicos={avulsos} onSaved={handleServicoSaved} />
                    </CardContent>
                </Card>
            )}

            {!carregando && termo && avulsos.length === 0 && !protocolos.some((p) => p.nome.toLowerCase().includes(termo) || todos.some((s) => s.id_protocolo === p.id && casa(s))) && (
                <p className="py-8 text-center text-gray-400">Nada encontrado.</p>
            )}
        </div>
    );
}

function ServicosTabela({ servicos, onSaved, modoModalidade = false }: { servicos: ServicoItem[]; onSaved: () => void; modoModalidade?: boolean }) {
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();
    const trpcClient = utils.client;
    const pacotesQ = trpc.pacotes.list.useQuery();
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const deletePacoteMut = trpc.pacotes.delete.useMutation({
        onSuccess: () => {
            utils.pacotes.list.invalidate();
            toast({ title: 'Pacote removido!', variant: 'success' });
        },
        onError: (error) => {
            toast({ title: 'Erro ao remover pacote', description: error.message, variant: 'error' });
        },
    });

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{modoModalidade ? 'Modalidade' : 'Serviço'}</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="hidden sm:table-cell">Pacotes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {servicos.map((s) => {
                    const pacotesDoServico = pacotesQ.data?.filter((p) => p.id_servico === s.id) || [];
                    const titulo = modoModalidade && s.nome_modalidade ? s.nome_modalidade : s.nome;
                    return (
                        <Fragment key={s.id}>
                            <TableRow
                                className={expandedId === s.id ? 'bg-[hsl(var(--muted))]/50' : ''}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                            >
                                <TableCell>
                                    <div className="flex items-center gap-3">
                                        {!modoModalidade && (s.imagem_url ? (
                                            <img src={resolveImageUrl(s.imagem_url)} alt={s.nome} className="h-10 w-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--muted-foreground))]">
                                                {s.nome[0]}
                                            </div>
                                        ))}
                                        <div>
                                            <p className="font-medium">{titulo}</p>
                                            {modoModalidade && titulo !== s.nome && <p className="text-xs text-gray-400">Nas vendas: {s.nome}</p>}
                                            {!modoModalidade && s.descricao && <p className="max-w-[200px] truncate text-xs text-gray-400">{s.descricao}</p>}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{s.duracao_minutos} min</TableCell>
                                <TableCell className="font-medium">{fmt(s.valor)}</TableCell>
                                <TableCell className="hidden sm:table-cell">{pacotesDoServico.length || '–'}</TableCell>
                                <TableCell>
                                    <Badge variant={s.ativo ? 'success' : 'destructive'}>{s.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <ServicoForm servico={s} onSuccess={onSaved} trigger={<SquarePen className="h-4 w-4 text-blue-600" />} />
                                </TableCell>
                            </TableRow>
                            {expandedId === s.id && (
                                <tr>
                                    <td colSpan={6} className="border-t bg-[hsl(var(--muted))]/30 px-8 py-4">
                                        <div className="flex flex-col gap-2 text-sm">
                                            <div>
                                                {s.tecnicas?.length ? (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {s.tecnicas.map((t: { id: number; nome: string }) => <Badge key={t.id} variant="secondary" className="text-xs">{t.nome}</Badge>)}
                                                    </div>
                                                ) : <span className="text-gray-400">Sem técnicas</span>}
                                                {s.regioes?.length ? (
                                                    <p className="mt-2 text-xs text-gray-500">Regiões: {s.regioes.join(' · ')}</p>
                                                ) : null}
                                                <div className="my-3 w-full border-b border-gray-200" />
                                                <div className="mb-0 flex items-center gap-2">
                                                    <Package className="h-5 w-5 text-blue-600" strokeWidth={2} />
                                                    <span className="text-sm font-semibold text-blue-700">Pacotes</span>
                                                </div>
                                            </div>
                                            <div className="relative min-h-[80px]">
                                                <div className="flex flex-wrap items-start gap-2">
                                                    {pacotesDoServico.length > 0 ? (
                                                        pacotesDoServico.map((p) => (
                                                            <div key={p.id} className="flex min-w-[180px] max-w-[220px] flex-col gap-2 rounded-lg border bg-white p-3 text-xs shadow-sm sm:text-sm">
                                                                <div className="mb-1 text-sm font-bold text-primary">{p.nome}</div>
                                                                {p.descricao && <div className="mb-1 text-gray-500">{p.descricao}</div>}
                                                                <div><b>Sessões:</b> {p.quantidade_sessoes}</div>
                                                                <div><b>Valor R$:</b> {fmt(p.valor_total)}</div>
                                                                <div><b>Status:</b> <Badge variant={p.status === 'ATIVO' ? 'success' : 'destructive'}>{p.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Badge></div>
                                                                <div className="mt-2 flex justify-center gap-1">
                                                                    <PacoteForm
                                                                        pacote={{
                                                                            id: p.id,
                                                                            nome: p.nome,
                                                                            descricao: p.descricao,
                                                                            id_servico: p.id_servico,
                                                                            quantidade_sessoes: p.quantidade_sessoes,
                                                                            valor_total: p.valor_total,
                                                                            status: p.status ?? 'ATIVO',
                                                                        }}
                                                                        onSuccess={() => utils.pacotes.list.invalidate()}
                                                                        trigger={<SquarePen className="h-4 w-4 text-blue-600" />}
                                                                    />
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="flex h-8 w-8 items-center justify-center p-0"
                                                                        title="Excluir pacote"
                                                                        onClick={async () => {
                                                                            const hasVendas = await hasVendasVinculadasPacote(p.id, trpcClient);
                                                                            if (hasVendas) {
                                                                                toast({ title: 'Não é possível excluir', description: 'Este pacote possui vendas vinculadas.', variant: 'error' });
                                                                                return;
                                                                            }
                                                                            const ok = await confirm({
                                                                                title: 'Excluir pacote',
                                                                                description: `Tem certeza que deseja excluir o pacote "${p.nome}"? Essa ação não pode ser desfeita.`,
                                                                                confirmLabel: 'Excluir',
                                                                                variant: 'danger',
                                                                            });
                                                                            if (ok) deletePacoteMut.mutate({ id: p.id });
                                                                        }}
                                                                    >
                                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : <span className="text-gray-400">Nenhum pacote vinculado</span>}
                                                </div>
                                                <div className="absolute bottom-2 right-2">
                                                    <PacoteForm onSuccess={() => utils.pacotes.list.invalidate()} pacote={undefined} idServico={s.id} />
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </Fragment>
                    );
                })}
            </TableBody>
        </Table>
    );
}

function TecnicasPanel() {
    const utils = trpc.useUtils();
    const { toast } = useToast();
    const confirm = useConfirm();
    const [editId, setEditId] = useState<number | null>(null);
    const [editNome, setEditNome] = useState('');
    const [nome, setNome] = useState('');
    const nomeInputRef = useRef<HTMLInputElement>(null);
    const tecnicasQ = trpc.tecnicas.list.useQuery();
    const createMut = trpc.tecnicas.create.useMutation({
        onSuccess: () => { setNome(''); utils.tecnicas.list.invalidate(); toast({ title: 'Técnica criada', variant: 'success' }); },
    });
    const updateMut = trpc.tecnicas.update.useMutation({ onSuccess: () => { utils.tecnicas.list.invalidate(); } });
    const deleteMut = trpc.tecnicas.delete.useMutation({ onSuccess: () => { utils.tecnicas.list.invalidate(); toast({ title: 'Técnica removida' }); } });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Técnicas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!nome.trim()) return;
                        if (editId) {
                            updateMut.mutate({ id: editId, nome: nome.trim() });
                            setEditId(null);
                            setNome('');
                        } else {
                            createMut.mutate({ nome: nome.trim() });
                        }
                    }}
                    className="flex flex-wrap items-center gap-2"
                >
                    <Input placeholder="Nova técnica" value={nome} onChange={(e) => setNome(e.target.value)} className="max-w-xs" ref={nomeInputRef} />
                    {editId ? (
                        <>
                            <Button type="button" size="sm" variant="outline" onClick={() => { setEditId(null); setNome(''); }}>Cancelar</Button>
                            <Button type="submit" size="sm" disabled={updateMut.isPending}>
                                {updateMut.isPending ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </>
                    ) : (
                        <Button type="submit" size="sm" disabled={createMut.isPending}>
                            {createMut.isPending ? 'Salvando…' : 'Adicionar'}
                        </Button>
                    )}
                </form>
                <div className="flex flex-wrap gap-2">
                    {tecnicasQ.data?.map((t) => (
                        <div key={t.id} className="flex items-center rounded-full border bg-white px-3 py-1 text-sm shadow-sm">
                            <span className="mr-2">{t.nome}</span>
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={() => {
                                setEditId(t.id);
                                setEditNome(t.nome);
                                setNome(t.nome); // Preenche o input principal com o nome da técnica
                                setTimeout(() => {
                                    if (nomeInputRef.current) {
                                        nomeInputRef.current.focus();
                                        const len = t.nome.length;
                                        nomeInputRef.current.setSelectionRange(len, len);
                                    }
                                }, 100);
                            }}>
                                <SquarePen className="w-4 h-4 text-blue-600" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-xs" onClick={async () => {
                                const ok = await confirm({
                                    title: 'Remover técnica',
                                    description: `Tem certeza que deseja remover "${t.nome}"? Serviços vinculados perderão essa técnica.`,
                                    confirmLabel: 'Remover',
                                });
                                if (ok) deleteMut.mutate({ id: t.id });
                            }}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                    {tecnicasQ.data?.length === 0 && <p className="text-xs text-gray-400">Nenhuma técnica cadastrada.</p>}
                </div>
            </CardContent>
        </Card>
    );
}
