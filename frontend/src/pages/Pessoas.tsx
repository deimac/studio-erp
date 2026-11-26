import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { PillGroup } from '@/components/ui/pill-group';
import { useEscopo } from '@/hooks/useEscopo';
import { trpc } from '@/services/trpc';
import { PessoaForm } from '@/components/PessoaForm';
import { useAcoesDaTela, useAcoesRapidas } from '@/components/acoes/AcoesRapidas';
import { UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table';
import { Search, Users, Trash2, SquarePen } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { hasVendasVinculadas } from '@/services/hasVendasVinculadas';
import { formatarTelefone, linkTelefone } from '@/lib/telefone';

const FILTRO_LABEL: Record<string, string> = { '': 'Todos', CLIENTE: 'Clientes', FORNECEDOR: 'Fornecedores', AMBOS: 'Ambos' };

const tipoBadge = (t: string) => {
    switch (t) {
        case 'CLIENTE': return 'success';
        case 'FORNECEDOR': return 'secondary';
        case 'AMBOS': return 'outline';
        default: return 'outline';
    }
};

export default function Pessoas() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const trpcClient = utils.client;
    const [search, setSearch] = useState('');
    const [tipoFilter, setTipoFilter] = useState('');
    const confirm = useConfirm();

    const { escopo } = useEscopo();
    const pessoasQ = trpc.pessoas.list.useQuery({ ...(tipoFilter ? { tipo: tipoFilter as any } : {}), escopo });

    const deleteMut = trpc.pessoas.delete.useMutation({
        onSuccess: () => {
            utils.pessoas.list.invalidate();
            toast({ title: 'Pessoa removida', variant: 'success' });
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    const filtered = pessoasQ.data?.filter(
        (p) =>
            !search ||
            p.nome.toLowerCase().includes(search.toLowerCase()) ||
            (p.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (p.cpf_cnpj ?? '').includes(search) ||
            (p.telefone ?? '').replace(/\D/g, '').includes(search.replace(/\D/g, '') || '§'),
    );

    async function removerPessoa(p: { id: number; nome: string }) {
        const hasVendas = await hasVendasVinculadas(p.id, trpcClient);
        if (hasVendas) {
            toast({ title: 'Não é possível excluir', description: 'Esta pessoa possui vendas vinculadas.', variant: 'error' });
            return;
        }
        const ok = await confirm({
            title: 'Remover pessoa',
            description: `Tem certeza que deseja remover "${p.nome}"? Essa ação não pode ser desfeita.`,
            confirmLabel: 'Remover',
            variant: 'danger',
        });
        if (ok) deleteMut.mutate({ id: p.id });
    }

    const { abrirForm } = useAcoesRapidas();
    useAcoesDaTela([{ id: 'pessoa', label: 'Nova pessoa', icone: UserPlus, onSelect: () => abrirForm('pessoa') }]);

    return (
        <div className="space-y-6">
            <PageHeader title="Pessoas" description="Clientes e fornecedores do estúdio."
                actions={<PessoaForm onSuccess={() => { utils.pessoas.list.invalidate(); toast({ title: 'Pessoa criada!', variant: 'success' }); }} />} />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar nome, e-mail, CPF/CNPJ…"
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                {/* Celular: os 4 filtros dividem a largura em vez de passar da tela */}
                <PillGroup label="Tipo de pessoa" value={tipoFilter} onChange={setTipoFilter}
                    className="w-full sm:w-auto [&>button]:flex-1 [&>button]:px-2 sm:[&>button]:px-4"
                    options={['', 'CLIENTE', 'FORNECEDOR', 'AMBOS'].map((t) => ({ value: t, label: FILTRO_LABEL[t] }))} />
            </div>

            {/* Celular: cartões */}
            <Card className="md:hidden">
                <ul className="divide-y">
                    {pessoasQ.isLoading && <li className="py-8 text-center text-gray-400">Carregando…</li>}
                    {filtered?.length === 0 && <li className="py-8 text-center text-gray-400">Nenhuma pessoa encontrada.</li>}
                    {filtered?.map((p) => (
                        <li key={p.id} className="flex items-center gap-3 p-4">
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">{p.nome}</p>
                                <p className="flex flex-wrap items-center gap-x-2 text-sm text-gray-500">
                                    {p.telefone ? <a href={linkTelefone(p.telefone)} className="tabular-nums text-[hsl(var(--primary))]">{formatarTelefone(p.telefone)}</a> : 'Sem telefone'}
                                    <Badge variant={tipoBadge(p.tipo)} className="text-[10px]">{p.tipo}</Badge>
                                    {p.status !== 'ATIVO' && <Badge variant="destructive" className="text-[10px]">{p.status}</Badge>}
                                </p>
                            </div>
                            <PessoaForm
                                editData={p as any}
                                onSuccess={() => {
                                    utils.pessoas.list.invalidate();
                                    toast({ title: 'Pessoa atualizada', variant: 'success' });
                                }}
                                trigger={<SquarePen className="h-5 w-5 text-blue-600" />}
                            />
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-red-500" aria-label={`Remover ${p.nome}`} onClick={() => removerPessoa(p)}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </li>
                    ))}
                </ul>
            </Card>

            <Card className="hidden overflow-hidden md:block">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead className="hidden md:table-cell">CPF/CNPJ</TableHead>
                                <TableHead className="hidden sm:table-cell">Telefone</TableHead>
                                <TableHead className="hidden lg:table-cell">E-mail</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pessoasQ.isLoading && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                                        Carregando…
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                                        Nenhuma pessoa encontrada.
                                    </TableCell>
                                </TableRow>
                            )}
                            {filtered?.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-500">
                                                <Users className="h-4 w-4" />
                                            </div>
                                            <span className="font-medium">{p.nome}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                        {p.cpf_cnpj || ''}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        {p.telefone ? formatarTelefone(p.telefone) : ''}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {p.email || ''}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={tipoBadge(p.tipo)}>{p.tipo}</Badge>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={p.status === 'ATIVO' ? 'success' : 'destructive'}>
                                            {p.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            <PessoaForm
                                                editData={p as any}
                                                onSuccess={() => {
                                                    utils.pessoas.list.invalidate();
                                                    toast({ title: 'Pessoa atualizada', variant: 'success' });
                                                }}
                                                trigger={<SquarePen className="w-4 h-4 text-blue-600" />}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-xs text-red-500 hover:text-red-700"
                                                onClick={() => removerPessoa(p)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
