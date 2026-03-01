import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';

export default function Configuracoes() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Configurações</h2>
            <Tabs defaultValue="formas">
                <TabsList>
                    <TabsTrigger value="formas">Formas de Pagamento</TabsTrigger>
                    <TabsTrigger value="unidades">Unidades</TabsTrigger>
                    <TabsTrigger value="usuarios">Profissionais</TabsTrigger>
                </TabsList>

                <TabsContent value="formas" className="mt-4">
                    <FormasPagamentoPanel />
                </TabsContent>
                <TabsContent value="unidades" className="mt-4">
                    <UnidadesPanel />
                </TabsContent>
                <TabsContent value="usuarios" className="mt-4">
                    <ProfissionaisPanel />
                </TabsContent>
            </Tabs>
        </div>
    );
}

/* ===== Formas de Pagamento ===== */
function FormasPagamentoPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const formasQ = trpc.formasPagamento.list.useQuery();

    const createMut = trpc.formasPagamento.create.useMutation({
        onSuccess: () => { setNome(''); setDescricao(''); utils.formasPagamento.list.invalidate(); toast({ title: 'Forma criada', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.formasPagamento.update.useMutation({
        onSuccess: () => { utils.formasPagamento.list.invalidate(); toast({ title: 'Atualizado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Formas de Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <form
                    onSubmit={(e) => { e.preventDefault(); if (!nome.trim()) return; createMut.mutate({ nome: nome.trim(), descricao: descricao.trim() || undefined }); }}
                    className="flex flex-wrap items-end gap-2"
                >
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs text-gray-500">Nome</label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: PIX, Cartão, Dinheiro" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs text-gray-500">Descrição (opcional)</label>
                        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                    </div>
                    <Button type="submit" size="sm" disabled={createMut.isPending}>Adicionar</Button>
                </form>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {formasQ.data?.map((f) => (
                            <TableRow key={f.id}>
                                <TableCell className="font-medium">{f.nome}</TableCell>
                                <TableCell className="hidden sm:table-cell text-gray-400">{f.descricao ?? '–'}</TableCell>
                                <TableCell>
                                    <Badge variant={f.ativo ? 'success' : 'destructive'}>{f.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                                        const novoNome = prompt('Nome:', f.nome);
                                        if (novoNome && novoNome !== f.nome) updateMut.mutate({ id: f.id, nome: novoNome });
                                    }}>Editar</Button>
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateMut.mutate({ id: f.id, ativo: !f.ativo })}>
                                        {f.ativo ? 'Desativar' : 'Ativar'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {formasQ.data?.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-6">Nenhuma forma cadastrada.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

/* ===== Unidades ===== */
function UnidadesPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [nome, setNome] = useState('');
    const unidsQ = trpc.unidades.list.useQuery();

    const createMut = trpc.unidades.create.useMutation({
        onSuccess: () => { setNome(''); utils.unidades.list.invalidate(); toast({ title: 'Unidade criada', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.unidades.update.useMutation({
        onSuccess: () => { utils.unidades.list.invalidate(); toast({ title: 'Atualizado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Unidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <form
                    onSubmit={(e) => { e.preventDefault(); if (!nome.trim()) return; createMut.mutate({ nome: nome.trim() }); }}
                    className="flex items-end gap-2"
                >
                    <div className="flex-1 max-w-sm">
                        <label className="text-xs text-gray-500">Nova Unidade</label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da unidade" />
                    </div>
                    <Button type="submit" size="sm" disabled={createMut.isPending}>Adicionar</Button>
                </form>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {unidsQ.data?.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.nome}</TableCell>
                                <TableCell>
                                    <Badge variant={u.ativo ? 'success' : 'destructive'}>{u.ativo ? 'Ativa' : 'Inativa'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                                        const n = prompt('Nome:', u.nome);
                                        if (n && n !== u.nome) updateMut.mutate({ id: u.id, nome: n });
                                    }}>Editar</Button>
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateMut.mutate({ id: u.id, ativo: !u.ativo })}>
                                        {u.ativo ? 'Desativar' : 'Ativar'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {unidsQ.data?.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-6">Nenhuma unidade.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

/* ===== Profissionais ===== */
function ProfissionaisPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [open, setOpen] = useState(false);
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');

    const usersQ = trpc.usuarios.list.useQuery();
    const createMut = trpc.usuarios.createProfissional.useMutation({
        onSuccess: () => { setOpen(false); setNome(''); setEmail(''); setSenha(''); utils.usuarios.list.invalidate(); toast({ title: 'Profissional criado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.usuarios.update.useMutation({
        onSuccess: () => { utils.usuarios.list.invalidate(); toast({ title: 'Atualizado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">Profissionais / Usuários</CardTitle>
                <Button size="sm" onClick={() => setOpen(true)}>Novo Profissional</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="hidden sm:table-cell">Email</TableHead>
                            <TableHead>Perfil</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {usersQ.data?.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.nome}</TableCell>
                                <TableCell className="hidden sm:table-cell text-gray-400">{u.email}</TableCell>
                                <TableCell>
                                    <Badge variant={u.perfil === 'ADMIN' ? 'default' : 'secondary'}>{u.perfil}</Badge>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={u.ativo ? 'success' : 'destructive'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateMut.mutate({ id: u.id, ativo: !u.ativo })}>
                                        {u.ativo ? 'Desativar' : 'Ativar'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Novo Profissional</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => { e.preventDefault(); createMut.mutate({ nome, email, senha }); }}
                        className="space-y-4"
                    >
                        <div>
                            <label className="text-xs font-medium text-gray-500">Nome</label>
                            <Input required value={nome} onChange={(e) => setNome(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">Email</label>
                            <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500">Senha</label>
                            <Input required type="password" minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={createMut.isPending}>
                                {createMut.isPending ? 'Criando…' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
