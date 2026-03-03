import { useState, useRef } from 'react';
import { trpc } from '@/services/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/useToast';
import { SquarePen, Trash2 } from 'lucide-react';

export default function Configuracoes() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Configurações</h2>
            <Tabs defaultValue="formas">
                <TabsList>
                    <TabsTrigger value="formas">Formas de Pagamento</TabsTrigger>
                    <TabsTrigger value="unidades">Unidades</TabsTrigger>
                    <TabsTrigger value="categorias">Categorias</TabsTrigger>
                    <TabsTrigger value="usuarios">Profissionais</TabsTrigger>
                </TabsList>

                <TabsContent value="formas" className="mt-4">
                    <FormasPagamentoPanel />
                </TabsContent>
                <TabsContent value="unidades" className="mt-4">
                    <UnidadesPanel />
                </TabsContent>
                <TabsContent value="categorias" className="mt-4">
                    <CategoriasReceitasDespesasPanel />
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
    const [editId, setEditId] = useState<number | null>(null);
    const [nome, setNome] = useState('');
    const nomeInputRef = useRef<HTMLInputElement>(null);
    const formasQ = trpc.formasPagamento.list.useQuery();

    const createMut = trpc.formasPagamento.create.useMutation({
        onSuccess: () => { setNome(''); utils.formasPagamento.list.invalidate(); toast({ title: 'Forma criada', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.formasPagamento.update.useMutation({
        onSuccess: () => { setEditId(null); setNome(''); utils.formasPagamento.list.invalidate(); toast({ title: 'Atualizado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Formas de Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!nome.trim()) return;
                        if (editId) {
                            updateMut.mutate({ id: editId, nome: nome.trim() });
                        } else {
                            createMut.mutate({ nome: nome.trim() });
                        }
                    }}
                    className="flex items-end gap-2"
                >
                    <div className="flex-1 max-w-sm">
                        <label className="text-xs text-gray-500">Nome</label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: PIX, Cartão, Dinheiro" ref={nomeInputRef} />
                    </div>
                    {editId ? (
                        <>
                            <Button type="button" size="sm" variant="outline" onClick={() => { setEditId(null); setNome(''); }}>Cancelar</Button>
                            <Button type="submit" size="sm" disabled={updateMut.isPending}>
                                {updateMut.isPending ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </>
                    ) : (
                        <Button type="submit" size="sm" disabled={createMut.isPending}>Adicionar</Button>
                    )}
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
                        {formasQ.data?.map((f) => (
                            <TableRow key={f.id}>
                                <TableCell className="font-medium">{f.nome}</TableCell>
                                <TableCell>
                                    <Badge variant={f.ativo ? 'success' : 'destructive'}>{f.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0" title="Editar" onClick={() => {
                                        setEditId(f.id);
                                        setNome(f.nome);
                                        setTimeout(() => {
                                            if (nomeInputRef.current) {
                                                nomeInputRef.current.focus();
                                                const len = f.nome.length;
                                                nomeInputRef.current.setSelectionRange(len, len);
                                            }
                                        }, 100);
                                    }}>
                                        <SquarePen className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateMut.mutate({ id: f.id, ativo: !f.ativo })}>
                                        {f.ativo ? 'Desativar' : 'Ativar'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {formasQ.data?.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-6">Nenhuma forma cadastrada.</TableCell></TableRow>
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
    const [editId, setEditId] = useState<number | null>(null);
    const [nome, setNome] = useState('');
    const nomeInputRef = useRef<HTMLInputElement>(null);
    const unidsQ = trpc.unidades.list.useQuery();

    const createMut = trpc.unidades.create.useMutation({
        onSuccess: () => { setNome(''); utils.unidades.list.invalidate(); toast({ title: 'Unidade criada', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.unidades.update.useMutation({
        onSuccess: () => { setEditId(null); setNome(''); utils.unidades.list.invalidate(); toast({ title: 'Atualizado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Unidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!nome.trim()) return;
                        if (editId) {
                            updateMut.mutate({ id: editId, nome: nome.trim() });
                        } else {
                            createMut.mutate({ nome: nome.trim() });
                        }
                    }}
                    className="flex items-end gap-2"
                >
                    <div className="flex-1 max-w-sm">
                        <label className="text-xs text-gray-500">Nova Unidade</label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da unidade" ref={nomeInputRef} />
                    </div>
                    {editId ? (
                        <>
                            <Button type="button" size="sm" variant="outline" onClick={() => { setEditId(null); setNome(''); }}>Cancelar</Button>
                            <Button type="submit" size="sm" disabled={updateMut.isPending}>
                                {updateMut.isPending ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </>
                    ) : (
                        <Button type="submit" size="sm" disabled={createMut.isPending}>Adicionar</Button>
                    )}
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0" title="Editar" onClick={() => {
                                        setEditId(u.id);
                                        setNome(u.nome);
                                        setTimeout(() => {
                                            if (nomeInputRef.current) {
                                                nomeInputRef.current.focus();
                                                const len = u.nome.length;
                                                nomeInputRef.current.setSelectionRange(len, len);
                                            }
                                        }, 100);
                                    }}>
                                        <SquarePen className="w-4 h-4 text-blue-600" />
                                    </Button>
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

/* ===== Categorias Receitas/Despesas ===== */
function CategoriasReceitasDespesasPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [editId, setEditId] = useState<number | null>(null);
    const [nome, setNome] = useState('');
    const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('RECEITA');
    const nomeInputRef = useRef<HTMLInputElement>(null);
    const categoriasQ = trpc.receitasDespesas.listCategorias.useQuery();

    const createMut = trpc.receitasDespesas.createCategoria.useMutation({
        onSuccess: () => { setNome(''); setTipo('RECEITA'); utils.receitasDespesas.listCategorias.invalidate(); toast({ title: 'Categoria criada', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.receitasDespesas.updateCategoria.useMutation({
        onSuccess: () => { setEditId(null); setNome(''); setTipo('RECEITA'); utils.receitasDespesas.listCategorias.invalidate(); toast({ title: 'Atualizado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const deleteMut = trpc.receitasDespesas.deleteCategoria.useMutation({
        onSuccess: () => { utils.receitasDespesas.listCategorias.invalidate(); toast({ title: 'Categoria removida', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Categorias Receitas/Despesas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!nome.trim()) return;
                        if (editId) {
                            updateMut.mutate({ id: editId, nome: nome.trim(), tipo });
                        } else {
                            createMut.mutate({ nome: nome.trim(), tipo });
                        }
                    }}
                    className="space-y-3"
                >
                    <div className="flex-1 max-w-sm">
                        <label className="text-xs text-gray-500">Nome da Categoria</label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da categoria" ref={nomeInputRef} />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 block mb-2">Tipo</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="tipo" value="RECEITA" checked={tipo === 'RECEITA'} onChange={() => setTipo('RECEITA')} className="w-4 h-4" />
                                <span className="text-sm">Receita</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="tipo" value="DESPESA" checked={tipo === 'DESPESA'} onChange={() => setTipo('DESPESA')} className="w-4 h-4" />
                                <span className="text-sm">Despesa</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {editId ? (
                            <>
                                <Button type="button" size="sm" variant="outline" onClick={() => { setEditId(null); setNome(''); setTipo('RECEITA'); }}>Cancelar</Button>
                                <Button type="submit" size="sm" disabled={updateMut.isPending}>
                                    {updateMut.isPending ? 'Salvando…' : 'Salvar'}
                                </Button>
                            </>
                        ) : (
                            <Button type="submit" size="sm" disabled={createMut.isPending}>Adicionar</Button>
                        )}
                    </div>
                </form>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {categoriasQ.data?.map((cat: any) => (
                            <TableRow key={cat.id}>
                                <TableCell className="font-medium">{cat.nome}</TableCell>
                                <TableCell><Badge variant={cat.tipo === 'RECEITA' ? 'success' : 'destructive'}>{cat.tipo}</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0" title="Editar" onClick={() => {
                                        setEditId(cat.id);
                                        setNome(cat.nome);
                                        setTipo(cat.tipo);
                                        setTimeout(() => {
                                            if (nomeInputRef.current) {
                                                nomeInputRef.current.focus();
                                                const len = cat.nome.length;
                                                nomeInputRef.current.setSelectionRange(len, len);
                                            }
                                        }, 100);
                                    }}>
                                        <SquarePen className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0" title="Excluir" onClick={() => {
                                        if (window.confirm(`Excluir "${cat.nome}"?`)) {
                                            deleteMut.mutate({ id: cat.id });
                                        }
                                    }}>
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {categoriasQ.data?.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-6">Nenhuma categoria cadastrada.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
