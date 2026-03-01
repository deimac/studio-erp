import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { PacoteForm } from '@/components/PacoteForm';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Search, Package } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export default function Pacotes() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [search, setSearch] = useState('');
    const pacotesQ = trpc.pacotes.list.useQuery();

    const fmt = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const statusColor = (s: string) => {
        if (s === 'ATIVO') return 'success';
        if (s === 'INATIVO') return 'destructive';
        return 'secondary';
    };

    const filtered = pacotesQ.data?.filter((p) =>
        !search || p.nome.toLowerCase().includes(search.toLowerCase()) || (p.servico_nome ?? '').toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-bold tracking-tight">Pacotes</h2>
                <PacoteForm onSuccess={() => { utils.pacotes.list.invalidate(); toast({ title: 'Pacote salvo!', variant: 'success' }); }} />
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar pacote ou serviço…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pacote</TableHead>
                                <TableHead className="hidden md:table-cell">Serviço</TableHead>
                                <TableHead>Sessões</TableHead>
                                <TableHead>Valor Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pacotesQ.isLoading && (
                                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Carregando…</TableCell></TableRow>
                            )}
                            {filtered?.length === 0 && (
                                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">Nenhum pacote.</TableCell></TableRow>
                            )}
                            {filtered?.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-500">
                                                <Package className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="font-medium">{p.nome}</p>
                                                {p.descricao && <p className="max-w-[200px] truncate text-xs text-gray-400">{p.descricao}</p>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{p.servico_nome ?? '–'}</TableCell>
                                    <TableCell>{p.quantidade_sessoes}</TableCell>
                                    <TableCell className="font-medium">{fmt(p.valor_total)}</TableCell>
                                    <TableCell>
                                        <Badge variant={statusColor(p.status ?? 'ATIVO')}>{p.status ?? 'ATIVO'}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <PacoteForm pacote={{ ...p, status: p.status ?? 'ATIVO' }} onSuccess={() => { utils.pacotes.list.invalidate(); toast({ title: 'Pacote atualizado', variant: 'success' }); }} />
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
