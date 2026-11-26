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
import { MapPin, SquarePen, Trash2 } from 'lucide-react';
import { TelefoneInput } from '@/components/TelefoneInput';
import { ImageUpload } from '@/components/ImageUpload';
import { Label } from '@/components/ui/label';
import { ExpedienteDialog } from '@/components/agenda/ExpedienteDialog';
import { PALETA, corPadrao } from '@/lib/agenda';
import { CalendarDays } from 'lucide-react';
import { PersonalizarBarra } from '@/components/acoes/PersonalizarBarra';

export default function Configuracoes() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold tracking-tight">Configurações</h2>
            <Tabs defaultValue="formas">
                {/* Celular: as abas quebram em linhas em vez de passar da tela */}
                <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:inline-flex sm:w-auto">
                    <TabsTrigger value="formas">Formas de Pagamento</TabsTrigger>
                    <TabsTrigger value="unidades">Unidades</TabsTrigger>
                    <TabsTrigger value="categorias">Categorias</TabsTrigger>
                    <TabsTrigger value="usuarios">Profissionais</TabsTrigger>
                    <TabsTrigger value="agenda">Agenda</TabsTrigger>
                    <TabsTrigger value="site">Site</TabsTrigger>
                    <TabsTrigger value="barra">Barra do celular</TabsTrigger>
                </TabsList>

                <TabsContent value="formas" className="mt-4">
                    <FormasPagamentoPanel />
                </TabsContent>
                <TabsContent value="site" className="mt-4 space-y-4">
                    <SitePanel />
                    <RodapePanel />
                </TabsContent>
                <TabsContent value="unidades" className="mt-4">
                    <UnidadesPanel />
                </TabsContent>
                <TabsContent value="categorias" className="mt-4">
                    <CategoriasReceitasDespesasPanel />
                </TabsContent>
                <TabsContent value="usuarios" className="mt-4 space-y-4">
                    <ModoTrabalhoPanel />
                    <ProfissionaisPanel />
                </TabsContent>
                <TabsContent value="agenda" className="mt-4 space-y-4">
                    <AgendaRegrasPanel />
                    <FeriadosPanel />
                </TabsContent>
                <TabsContent value="barra" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3"><CardTitle className="text-base">Barra de atalhos do celular</CardTitle></CardHeader>
                        <CardContent><PersonalizarBarra /></CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}

/* ===== Como vocês trabalham (visão do admin) ===== */
const OPCOES_MODO = [
    {
        id: 'CLINICA',
        titulo: 'Clínica',
        texto: 'O administrador acompanha as vendas, os clientes, os serviços e o financeiro de todos os profissionais.',
    },
    {
        id: 'INDIVIDUAL',
        titulo: 'Cada profissional cuida do seu',
        texto: 'A agenda é dividida: os horários das outras aparecem só como "Ocupado". Vendas, clientes, serviços e financeiro ficam separados, inclusive para o administrador.',
    },
] as const;

function ModoTrabalhoPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const modoQ = trpc.unidades.modoTrabalho.useQuery();
    const salvarMut = trpc.unidades.salvarModoTrabalho.useMutation({
        onSuccess: async () => {
            // Tudo muda de visão: recarrega as telas com o novo modo
            await utils.invalidate();
            toast({ title: 'Forma de trabalho salva', variant: 'success' });
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const modo = salvarMut.isPending ? salvarMut.variables?.modo : modoQ.data;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Como vocês trabalham</CardTitle>
                <p className="text-sm text-gray-500">Define o que o administrador vê dos outros profissionais. As configurações e o site continuam com o administrador.</p>
            </CardHeader>
            <CardContent className="space-y-2">
                {OPCOES_MODO.map((o) => (
                    <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${modo === o.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : ''}`}>
                        <input type="radio" name="modo_trabalho" className="mt-1" checked={modo === o.id}
                            disabled={!modoQ.data || salvarMut.isPending}
                            onChange={() => salvarMut.mutate({ modo: o.id })} />
                        <span>
                            <span className="block text-sm font-medium">{o.titulo}</span>
                            <span className="block text-xs text-gray-500">{o.texto}</span>
                        </span>
                    </label>
                ))}
            </CardContent>
        </Card>
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
    const [contatoDe, setContatoDe] = useState<Unidade | null>(null);

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
                            <TableHead className="hidden sm:table-cell">No site</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {unidsQ.data?.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">{u.nome}</TableCell>
                                <TableCell className="hidden text-sm text-gray-500 sm:table-cell">
                                    {u.endereco || u.whatsapp
                                        ? [u.endereco, u.cidade].filter(Boolean).join(' · ') || 'Só WhatsApp'
                                        : <button type="button" className="text-[hsl(var(--primary))] underline-offset-2 hover:underline" onClick={() => setContatoDe(u)}>Preencher endereço</button>}
                                </TableCell>
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
                                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0" title="Endereço e WhatsApp" onClick={() => setContatoDe(u)}>
                                        <MapPin className="w-4 h-4 text-blue-600" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateMut.mutate({ id: u.id, ativo: !u.ativo })}>
                                        {u.ativo ? 'Desativar' : 'Ativar'}
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {unidsQ.data?.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-6">Nenhuma unidade.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <ContatoUnidadeDialog unidade={contatoDe} onClose={() => setContatoDe(null)} />
        </Card>
    );
}

type Unidade = { id: number; nome: string; endereco: string | null; bairro: string | null; cidade: string | null; whatsapp: string | null };

/** Endereço e WhatsApp da unidade: aparecem no rodapé do site e nos botões "Agendar". */
function ContatoUnidadeDialog({ unidade, onClose }: { unidade: Unidade | null; onClose: () => void }) {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const [form, setForm] = useState({ endereco: '', bairro: '', cidade: '', whatsapp: '' });
    const [aberta, setAberta] = useState<number | null>(null);
    if (unidade && aberta !== unidade.id) {
        setAberta(unidade.id);
        setForm({ endereco: unidade.endereco ?? '', bairro: unidade.bairro ?? '', cidade: unidade.cidade ?? '', whatsapp: unidade.whatsapp ?? '' });
    }
    const fechar = () => { setAberta(null); onClose(); };
    const salvarMut = trpc.unidades.update.useMutation({
        onSuccess: () => { utils.unidades.list.invalidate(); toast({ title: 'Contato salvo. Já aparece no site.', variant: 'success' }); fechar(); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const campo = (k: keyof typeof form) => ({ value: form[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value })) });

    return (
        <Dialog open={!!unidade} onOpenChange={(v) => !v && fechar()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Endereço e WhatsApp · {unidade?.nome}</DialogTitle>
                    <p className="text-sm text-gray-500">Aparecem no rodapé do site. O WhatsApp é para onde vão os botões "Agendar".</p>
                </DialogHeader>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (unidade) salvarMut.mutate({ id: unidade.id, ...form }); }}>
                    <div className="space-y-1.5">
                        <Label htmlFor="un-end">Rua e número</Label>
                        <Input id="un-end" placeholder="R. das Flores, 123" {...campo('endereco')} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="un-bairro">Bairro</Label>
                            <Input id="un-bairro" {...campo('bairro')} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="un-cidade">Cidade</Label>
                            <Input id="un-cidade" placeholder="Maringá – PR" {...campo('cidade')} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="un-whats">WhatsApp</Label>
                        <TelefoneInput id="un-whats" value={form.whatsapp} onChange={(v) => setForm((f) => ({ ...f, whatsapp: v }))} />
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={fechar}>Cancelar</Button>
                        <Button type="submit" disabled={salvarMut.isPending}>{salvarMut.isPending ? 'Salvando…' : 'Salvar'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
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
    const agendaProfsQ = trpc.agenda.profissionais.list.useQuery();
    const [agendaDe, setAgendaDe] = useState<any>(null);
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
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
                <CardTitle className="text-sm">Profissionais / Usuários</CardTitle>
                <Button size="sm" onClick={() => setOpen(true)}>Novo Profissional</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead className="hidden sm:table-cell">Email</TableHead>
                            <TableHead className="hidden sm:table-cell">Perfil</TableHead>
                            <TableHead className="hidden sm:table-cell">Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {usersQ.data?.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell className="font-medium">
                                    {u.nome}
                                    {/* Celular: perfil e status embaixo do nome (as colunas somem) */}
                                    <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                                        <Badge variant={u.perfil === 'ADMIN' ? 'default' : 'secondary'}>{u.perfil}</Badge>
                                        <Badge variant={u.ativo ? 'success' : 'destructive'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-gray-400">{u.email}</TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <Badge variant={u.perfil === 'ADMIN' ? 'default' : 'secondary'}>{u.perfil}</Badge>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                    <Badge variant={u.ativo ? 'success' : 'destructive'}>{u.ativo ? 'Ativo' : 'Inativo'}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end">
                                    {u.ativo && (
                                        <Button variant="ghost" size="sm" className="text-xs" onClick={() => setAgendaDe(((agendaProfsQ.data ?? []) as any[]).find((p) => p.id === u.id) ?? { id: u.id, nome: u.nome })}>
                                            <CalendarDays className="mr-1 h-3.5 w-3.5" /> Agenda
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateMut.mutate({ id: u.id, ativo: !u.ativo })}>
                                        {u.ativo ? 'Desativar' : 'Ativar'}
                                    </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>

            <ExpedienteDialog open={!!agendaDe} onOpenChange={(v) => !v && setAgendaDe(null)} profissional={agendaDe} admin />

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

/* ━━━ Site público: imagens e textos globais ━━━ */
function SitePanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const configQ = trpc.siteConfig.getAll.useQuery();
    const setMut = trpc.siteConfig.set.useMutation({
        onSuccess: () => { utils.siteConfig.getAll.invalidate(); toast({ title: 'Site atualizado!', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const cfg = (configQ.data ?? {}) as Record<string, string>;
    const [titulo, setTitulo] = useState<string | null>(null);
    const [subtitulo, setSubtitulo] = useState<string | null>(null);

    const salvar = (chave: string, valor: string) => setMut.mutate({ chave: chave as any, valor: valor || null });

    return (
        <Card>
            <CardHeader><CardTitle className="text-base">Site público</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <Label>Imagem principal (topo do site)</Label>
                        <ImageUpload value={cfg.hero_imagem_url} onChange={(url) => salvar('hero_imagem_url', url)} hint="Vertical (4:5), alta qualidade • Máx. 5 MB" />
                    </div>
                    <div>
                        <Label>Imagem da seção Sobre</Label>
                        <ImageUpload value={cfg.sobre_imagem_url} onChange={(url) => salvar('sobre_imagem_url', url)} hint="Vertical (4:5) • Máx. 5 MB" />
                    </div>
                </div>
                <div className="space-y-3">
                    <div>
                        <Label>Título do topo (opcional)</Label>
                        <Input value={titulo ?? cfg.hero_titulo ?? ''} onChange={(e) => setTitulo(e.target.value)} placeholder="Deixe vazio para usar o texto padrão" />
                    </div>
                    <div>
                        <Label>Subtítulo do topo (opcional)</Label>
                        <Input value={subtitulo ?? cfg.hero_subtitulo ?? ''} onChange={(e) => setSubtitulo(e.target.value)} />
                    </div>
                    <Button
                        size="sm"
                        disabled={setMut.isPending}
                        onClick={() => {
                            if (titulo !== null) salvar('hero_titulo', titulo.trim());
                            if (subtitulo !== null) salvar('hero_subtitulo', subtitulo.trim());
                        }}
                    >
                        Salvar textos
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

/** Instagram e textos do rodapé: um só para a clínica. Endereço e WhatsApp ficam em cada unidade. */
const CAMPOS_MARCA = [
    { chave: 'instagram', label: 'Instagram', placeholder: 'seu_perfil', dica: 'Só o nome do perfil, sem @.' },
    { chave: 'nome_mensagem', label: 'Nome nas mensagens do WhatsApp', placeholder: 'Ana', dica: 'A mensagem pronta começa com "Olá, Ana!".' },
    { chave: 'rodape_texto', label: 'Frase do rodapé', placeholder: 'Massoterapia e estética…', dica: '' },
    { chave: 'rodape_assinatura', label: 'Nome no fim da página', placeholder: 'Clínica Exemplo · Estética', dica: 'Aparece depois do ©.' },
] as const;

function RodapePanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const configQ = trpc.siteConfig.getAll.useQuery();
    const cfg = (configQ.data ?? {}) as Record<string, string>;
    const [editado, setEditado] = useState<Record<string, string>>({});
    const setMut = trpc.siteConfig.set.useMutation({ onError: (e) => toast({ title: e.message, variant: 'error' }) });

    async function salvar() {
        for (const [chave, valor] of Object.entries(editado)) {
            const limpo = chave === 'instagram' ? valor.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '') : valor.trim();
            await setMut.mutateAsync({ chave: chave as any, valor: limpo || null });
        }
        setEditado({});
        utils.siteConfig.getAll.invalidate();
        toast({ title: 'Rodapé atualizado!', variant: 'success' });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Rodapé e redes sociais</CardTitle>
                <p className="text-sm text-gray-500">Endereço e WhatsApp ficam em Configurações → Unidades.</p>
            </CardHeader>
            <CardContent className="space-y-4">
                {CAMPOS_MARCA.map((c) => (
                    <div key={c.chave} className="space-y-1.5">
                        <Label htmlFor={`marca-${c.chave}`}>{c.label}</Label>
                        <Input id={`marca-${c.chave}`} placeholder={c.placeholder}
                            value={editado[c.chave] ?? cfg[c.chave] ?? ''}
                            onChange={(e) => setEditado((m) => ({ ...m, [c.chave]: e.target.value }))} />
                        {c.dica && <p className="text-xs text-gray-500">{c.dica}</p>}
                    </div>
                ))}
                <Button size="sm" disabled={setMut.isPending || !Object.keys(editado).length} onClick={salvar}>
                    {setMut.isPending ? 'Salvando…' : 'Salvar rodapé'}
                </Button>
            </CardContent>
        </Card>
    );
}

/* ===== Salas / macas (recursos compartilhados da agenda) ===== */
function SalasPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const salasQ = trpc.agenda.salas.list.useQuery({ incluirInativas: true });
    const [editId, setEditId] = useState<number | null>(null);
    const [nome, setNome] = useState('');
    const [cor, setCor] = useState(PALETA[0]);

    const ok = (msg: string) => () => { utils.agenda.salas.list.invalidate(); setEditId(null); setNome(''); toast({ title: msg, variant: 'success' }); };
    const erro = (e: { message: string }) => toast({ title: e.message, variant: 'error' });
    const createMut = trpc.agenda.salas.create.useMutation({ onSuccess: ok('Sala criada'), onError: erro });
    const updateMut = trpc.agenda.salas.update.useMutation({ onSuccess: ok('Sala atualizada'), onError: erro });
    const deleteMut = trpc.agenda.salas.delete.useMutation({ onSuccess: ok('Sala excluída'), onError: erro });

    const salas = (salasQ.data ?? []) as { id: number; nome: string; cor: string | null; ativo: boolean }[];

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm">Salas e macas</CardTitle>
                <p className="text-xs text-gray-500">Dois profissionais não podem usar a mesma sala no mesmo horário.</p>
            </CardHeader>
            <CardContent className="space-y-4">
                <form
                    className="flex flex-wrap items-end gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!nome.trim()) return;
                        if (editId) updateMut.mutate({ id: editId, nome: nome.trim(), cor });
                        else createMut.mutate({ nome: nome.trim(), cor, ordem: salas.length });
                    }}
                >
                    <div className="min-w-48 flex-1 space-y-1.5">
                        <Label>Nome</Label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Sala 1, Maca de drenagem…" />
                    </div>
                    <div className="flex gap-1 pb-2">
                        {PALETA.slice(0, 6).map((c) => (
                            <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setCor(c)}
                                className={`h-6 w-6 rounded-full ring-offset-2 ${cor === c ? 'ring-2 ring-[hsl(var(--foreground))]' : ''}`} style={{ background: c }} />
                        ))}
                    </div>
                    <Button type="submit" size="sm" disabled={createMut.isPending || updateMut.isPending}>{editId ? 'Salvar' : 'Adicionar'}</Button>
                    {editId && <Button type="button" size="sm" variant="ghost" onClick={() => { setEditId(null); setNome(''); }}>Cancelar</Button>}
                </form>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Sala</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {salas.map((s) => (
                            <TableRow key={s.id}>
                                <TableCell className="font-medium">
                                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: corPadrao(s.id, s.cor) }} />
                                    {s.nome}
                                </TableCell>
                                <TableCell><Badge variant={s.ativo ? 'success' : 'secondary'}>{s.ativo ? 'Ativa' : 'Inativa'}</Badge></TableCell>
                                <TableCell className="space-x-1 text-right">
                                    <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => { setEditId(s.id); setNome(s.nome); setCor(s.cor ?? PALETA[0]); }}>
                                        <SquarePen className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => updateMut.mutate({ id: s.id, ativo: !s.ativo })}>
                                        {s.ativo ? 'Desativar' : 'Ativar'}
                                    </Button>
                                    <Button variant="ghost" size="sm" aria-label="Excluir" className="text-red-500" onClick={() => deleteMut.mutate({ id: s.id })}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {!salasQ.isLoading && !salas.length && (
                            <TableRow><TableCell colSpan={3} className="py-6 text-center text-gray-400">Nenhuma sala cadastrada. Sem salas, só o profissional é verificado no conflito.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

/* ===== Agenda: regra de falta ===== */
const OPCOES_FALTA = [
    { id: 'PERGUNTAR', titulo: 'Perguntar na hora', texto: 'Ao marcar "faltou", o sistema pergunta se desconta a sessão do pacote.' },
    { id: 'DESCONTAR', titulo: 'Descontar a sessão', texto: 'Faltou sem avisar, a sessão do pacote é usada. Só o cancelamento devolve.' },
    { id: 'DEVOLVER', titulo: 'Devolver a sessão', texto: 'A falta não consome a sessão: ela volta para o saldo do cliente.' },
] as const;

function AgendaRegrasPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const regraQ = trpc.agenda.profissionais.regraFalta.useQuery({});
    const [regra, setRegra] = useState<string>('PERGUNTAR');
    const [porProfissional, setPorProfissional] = useState(false);
    const [carregado, setCarregado] = useState(false);
    if (regraQ.data && !carregado) {
        setRegra((regraQ.data as any).clinica);
        setPorProfissional((regraQ.data as any).porProfissional);
        setCarregado(true);
    }
    const salvarMut = trpc.agenda.profissionais.salvarRegraFaltaClinica.useMutation({
        onSuccess: () => { utils.agenda.profissionais.regraFalta.invalidate(); toast({ title: 'Regra de falta salva', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Quando o cliente falta</CardTitle>
                <p className="text-sm text-gray-500">O que acontece com a sessão do pacote quando o cliente não vem e não avisa.</p>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    {OPCOES_FALTA.map((o) => (
                        <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${regra === o.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5' : ''}`}>
                            <input type="radio" name="falta_regra" className="mt-1" checked={regra === o.id} onChange={() => setRegra(o.id)} />
                            <span>
                                <span className="block text-sm font-medium">{o.titulo}</span>
                                <span className="block text-xs text-gray-500">{o.texto}</span>
                            </span>
                        </label>
                    ))}
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-medium">Quem decide</p>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input type="radio" name="falta_quem" className="mt-1" checked={!porProfissional} onChange={() => setPorProfissional(false)} />
                        <span>Regra da clínica <span className="block text-xs text-gray-500">Vale para todos os profissionais.</span></span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <input type="radio" name="falta_quem" className="mt-1" checked={porProfissional} onChange={() => setPorProfissional(true)} />
                        <span>Cada profissional define a sua <span className="block text-xs text-gray-500">Cada um escolhe em "Meu expediente", na Agenda. Quem não escolher segue a regra acima.</span></span>
                    </label>
                </div>
                <Button onClick={() => salvarMut.mutate({ falta_regra: regra as any, falta_por_profissional: porProfissional })} disabled={salvarMut.isPending}>
                    {salvarMut.isPending ? 'Salvando…' : 'Salvar'}
                </Button>
            </CardContent>
        </Card>
    );
}

/* ===== Feriados da cidade (os nacionais entram sozinhos) ===== */
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function FeriadosPanel() {
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const listaQ = trpc.agenda.feriados.list.useQuery();
    const [nome, setNome] = useState('');
    const [data, setData] = useState('');
    const [todoAno, setTodoAno] = useState(true);
    const aoMudar = () => { utils.agenda.feriados.list.invalidate(); utils.agenda.eventos.invalidate(); };
    const criar = trpc.agenda.feriados.create.useMutation({
        onSuccess: () => { aoMudar(); setNome(''); setData(''); toast({ title: 'Feriado adicionado', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const remover = trpc.agenda.feriados.delete.useMutation({
        onSuccess: () => { aoMudar(); toast({ title: 'Feriado removido', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const lista = (listaQ.data ?? []) as { id: number; dia: number; mes: number; ano: number | null; nome: string }[];

    function adicionar(e: React.FormEvent) {
        e.preventDefault();
        if (nome.trim().length < 2) return toast({ title: 'Escreva o nome do feriado', variant: 'error' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return toast({ title: 'Escolha a data', variant: 'error' });
        const [ano, mes, dia] = data.split('-').map(Number);
        criar.mutate({ nome: nome.trim(), dia, mes, ano: todoAno ? null : ano });
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Feriados da cidade</CardTitle>
                <p className="text-sm text-gray-500">
                    Os feriados nacionais (Natal, Carnaval, Sexta-feira Santa…) já aparecem sozinhos na agenda.
                    Aqui entram os da cidade e do estado. Eles só avisam: dá para agendar normalmente.
                </p>
            </CardHeader>
            <CardContent className="space-y-4">
                {lista.length > 0 && (
                    <ul className="divide-y rounded-lg border">
                        {lista.map((f) => (
                            <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <span className="w-16 shrink-0 font-medium tabular-nums">{String(f.dia).padStart(2, '0')} {MESES_CURTOS[f.mes - 1]}</span>
                                <span className="min-w-0 flex-1">{f.nome}</span>
                                <span className="shrink-0 text-xs text-gray-500">{f.ano ? `só em ${f.ano}` : 'todo ano'}</span>
                                <button type="button" aria-label={`Remover ${f.nome}`} onClick={() => remover.mutate({ id: f.id })}
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                <form onSubmit={adicionar} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                    <div className="space-y-1.5">
                        <Label>Nome</Label>
                        <Input placeholder="Ex.: Padroeira da cidade" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Data</Label>
                        <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                    </div>
                    <label className="flex cursor-pointer items-center gap-2 text-sm sm:order-last sm:col-span-3">
                        <input type="checkbox" className="h-4 w-4" checked={todoAno} onChange={(e) => setTodoAno(e.target.checked)} /> Repete todo ano
                    </label>
                    <Button type="submit" disabled={criar.isPending}>Adicionar</Button>
                </form>
            </CardContent>
        </Card>
    );
}
