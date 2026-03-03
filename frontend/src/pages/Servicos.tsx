import { useState, useRef } from 'react';
import { trpc } from '@/services/trpc';
import { ServicoForm } from '@/components/ServicoForm';
import { PacoteForm } from '@/components/PacoteForm';
import { Badge } from '@/components/ui/badge';
import { SquarePen, Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { hasVendasVinculadasPacote } from '@/services/hasVendasVinculadasPacote';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

function resolveImageUrl(url?: string | null) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return API_URL ? `${API_URL}${url}` : url;
    return API_URL ? `${API_URL}/${url}` : `/${url}`;
}

export default function Servicos() {
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();
    const trpcClient = utils.client;
    const [search, setSearch] = useState('');
    const servicosQ = trpc.servicos.list.useQuery(search ? { search } : undefined);
    const pacotesQ = trpc.pacotes.list.useQuery();

    const deletePacoteMut = trpc.pacotes.delete.useMutation({
        onSuccess: () => {
            utils.pacotes.list.invalidate();
            toast({ title: 'Pacote removido!', variant: 'success' });
        },
        onError: (error) => {
            toast({ title: 'Erro ao remover pacote', description: error.message, variant: 'error' });
        },
    });

    const fmt = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const handleServicoSaved = () => {
        utils.servicos.list.invalidate();
        toast({ title: 'Serviço salvo!', variant: 'success' });
    };

    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [novoPacoteServicoId, setNovoPacoteServicoId] = useState<number | null>(null);
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold tracking-tight">Serviços</h2>
                <ServicoForm onSuccess={handleServicoSaved} />
            </div>

            {/* Técnicas panel */}
            <TecnicasPanel />

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar serviço…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        {/* Modal de novo pacote */}
                        {novoPacoteServicoId && (
                            <PacoteForm
                                onSuccess={() => {
                                    setNovoPacoteServicoId(null);
                                    utils.pacotes.list.invalidate();
                                }}
                                pacote={undefined}
                            />
                        )}
                        <TableHeader>
                            <TableRow>
                                <TableHead>Serviço</TableHead>
                                {/* <TableHead className="hidden lg:table-cell">Técnicas</TableHead> */}
                                <TableHead>Duração</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead className="hidden sm:table-cell">Crédito</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {servicosQ.isLoading && (
                                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Carregando…</TableCell></TableRow>
                            )}
                            {servicosQ.data?.length === 0 && (
                                <TableRow><TableCell colSpan={7} className="text-center text-gray-400 py-8">Nenhum serviço.</TableCell></TableRow>
                            )}
                            {servicosQ.data?.map((s) => {
                                const pacotesDoServico = pacotesQ.data?.filter(p => p.id_servico === s.id) || [];
                                return (
                                    <>
                                        <TableRow
                                            key={s.id}
                                            className={expandedId === s.id ? 'bg-[hsl(var(--muted))]/50' : ''}
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {s.imagem_url ? (
                                                        <img src={resolveImageUrl(s.imagem_url)} alt={s.nome} className="h-10 w-10 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--muted-foreground))]">
                                                            {s.nome[0]}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium">{s.nome}</p>
                                                        {s.descricao && <p className="max-w-[200px] truncate text-xs text-gray-400">{s.descricao}</p>}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            {/* Coluna técnicas removida, agora só no painel expansível */}
                                            <TableCell>{s.duracao_minutos} min</TableCell>
                                            <TableCell className="font-medium">{fmt(s.valor)}</TableCell>
                                            <TableCell className="hidden sm:table-cell">{s.gera_credito ? 'Sim' : 'Não'}</TableCell>
                                            <TableCell>
                                                <Badge variant={s.ativo ? 'success' : 'destructive'}>{s.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                <ServicoForm
                                                    servico={s}
                                                    onSuccess={handleServicoSaved}
                                                    trigger={<SquarePen className="w-4 h-4 text-blue-600" />}
                                                />
                                            </TableCell>
                                        </TableRow>
                                        {expandedId === s.id && (
                                            <tr>
                                                <td colSpan={7} className="bg-[hsl(var(--muted))]/30 px-8 py-4 border-t">
                                                    <div className="flex flex-col gap-2 text-sm">
                                                        <div>
                                                            {s.tecnicas?.length ? (
                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                    {s.tecnicas.map((t: { id: number; nome: string }) => <Badge key={t.id} variant="secondary" className="text-xs">{t.nome}</Badge>)}
                                                                </div>
                                                            ) : <span className="text-gray-400">–</span>}
                                                            <div className="w-full border-b border-gray-200 my-3" />
                                                            <div className="flex items-center gap-2 mb-0">
                                                                <Package className="h-5 w-5 text-blue-600" strokeWidth={2} />
                                                                <span className="font-semibold text-blue-700 text-sm">Pacotes</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-col gap-2">
                                                            <div className="relative min-h-[80px]">
                                                                <div className="flex flex-wrap gap-2 items-start">
                                                                    {pacotesDoServico.length > 0 ? (
                                                                        pacotesDoServico.map((p) => (
                                                                            <div key={p.id} className="rounded-lg border bg-white p-3 shadow-sm flex flex-col gap-2 text-xs sm:text-sm max-w-[220px] min-w-[180px]">
                                                                                <div className="font-bold text-primary text-sm mb-1">{p.nome}</div>
                                                                                {p.descricao && <div className="text-gray-500 mb-1">{p.descricao}</div>}
                                                                                <div><b>Sessões:</b> {p.quantidade_sessoes}</div>
                                                                                <div><b>Valor R$:</b> {fmt(p.valor_total)}</div>
                                                                                <div><b>Status:</b> <Badge variant={p.status === 'ATIVO' ? 'success' : 'destructive'}>{p.status === 'ATIVO' ? 'Ativo' : 'Inativo'}</Badge></div>
                                                                                <div className="flex gap-1 justify-center mt-2">
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
                                                                                        onSuccess={() => {
                                                                                            utils.pacotes.list.invalidate();
                                                                                        }}
                                                                                        trigger={<SquarePen className="h-4 w-4 text-blue-600" />}
                                                                                    />
                                                                                    <Button
                                                                                        variant="ghost"
                                                                                        size="icon"
                                                                                        className="h-8 w-8 p-0 flex items-center justify-center"
                                                                                        title="Excluir pacote"
                                                                                        onClick={async () => {
                                                                                            const hasVendas = await hasVendasVinculadasPacote(p.id, trpcClient);
                                                                                            if (hasVendas) {
                                                                                                toast({
                                                                                                    title: 'Não é possível excluir',
                                                                                                    description: 'Este pacote possui vendas vinculadas.',
                                                                                                    variant: 'error',
                                                                                                });
                                                                                                return;
                                                                                            }
                                                                                            const ok = await confirm({
                                                                                                title: 'Excluir pacote',
                                                                                                description: `Tem certeza que deseja excluir o pacote "${p.nome}"? Essa ação não pode ser desfeita.`,
                                                                                                confirmLabel: 'Excluir',
                                                                                                variant: 'danger',
                                                                                            });
                                                                                            if (ok) {
                                                                                                deletePacoteMut.mutate({ id: p.id });
                                                                                            }
                                                                                        }}
                                                                                    >
                                                                                        <Trash2 className="h-4 w-4 text-red-600" />
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : <span className="text-gray-400">Nenhum pacote vinculado</span>}
                                                                </div>
                                                                <div className="absolute right-2 bottom-2">
                                                                    <PacoteForm
                                                                        onSuccess={() => {
                                                                            setNovoPacoteServicoId(null);
                                                                            utils.pacotes.list.invalidate();
                                                                        }}
                                                                        pacote={undefined}
                                                                        idServico={s.id}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
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
