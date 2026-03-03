import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { PessoaForm } from '@/components/PessoaForm';
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

    const pessoasQ = trpc.pessoas.list.useQuery(
        tipoFilter ? { tipo: tipoFilter as any } : undefined,
    );

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
            (p.telefone ?? '').includes(search),
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold tracking-tight">Pessoas</h2>
                <PessoaForm
                    onSuccess={() => {
                        utils.pessoas.list.invalidate();
                        toast({ title: 'Pessoa criada!', variant: 'success' });
                    }}
                />
            </div>

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
                <div className="flex gap-2">
                    {['', 'CLIENTE', 'FORNECEDOR', 'AMBOS'].map((t) => (
                        <Button
                            key={t}
                            variant={tipoFilter === t ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTipoFilter(t)}
                        >
                            {t || 'Todos'}
                        </Button>
                    ))}
                </div>
            </div>

            <Card>
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
                                        {p.cpf_cnpj || '–'}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell">
                                        {p.telefone || '–'}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {p.email || '–'}
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
                                                onClick={async () => {
                                                    const hasVendas = await hasVendasVinculadas(p.id, trpcClient);
                                                    if (hasVendas) {
                                                        toast({
                                                            title: 'Não é possível excluir',
                                                            description: 'Esta pessoa possui vendas vinculadas.',
                                                            variant: 'error',
                                                        });
                                                        return;
                                                    }
                                                    const ok = await confirm({
                                                        title: 'Remover pessoa',
                                                        description: `Tem certeza que deseja remover "${p.nome}"? Essa ação não pode ser desfeita.`,
                                                        confirmLabel: 'Remover',
                                                        variant: 'danger',
                                                    });
                                                    if (ok) {
                                                        deleteMut.mutate({ id: p.id });
                                                        toast({
                                                            title: 'Pessoa sem vendas',
                                                            description: 'Removendo pessoa sem vendas vinculadas.',
                                                            variant: 'success',
                                                        });
                                                    }
                                                }}
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
