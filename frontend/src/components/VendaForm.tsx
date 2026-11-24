import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Check, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { maskMoney } from '@/lib/masks';
import { cn } from '@/lib/utils';

/**
 * Nova venda: um ou mais itens (serviço avulso ou pacote) e uma ou mais formas
 * de pagamento (ex.: parte no Pix, resto no cartão em 3x). Os pagamentos
 * precisam fechar o total.
 *
 * Com `idVenda`, edita a venda: parcelas já pagas ficam como estão e os
 * pagamentos cobrem só o que falta receber.
 */

type Props = {
    onSuccess: () => void;
    /** Editar esta venda (a janela é controlada por open/onOpenChange, sem botão). */
    idVenda?: number;
    open?: boolean;
    onOpenChange?: (v: boolean) => void;
};

type ItemVenda = { chave: string; id?: number; usadas?: number; id_servico?: number; id_pacote?: number; nome: string; sessoes: string; valor: string; pacote: boolean };
type Pagamento = { chave: string; id_forma: string; valor: string; parcelas: string; vencimento: string; pago: boolean };

const hojeISO = () => new Date().toISOString().split('T')[0];
const paraCentavos = (mascara: string) => Math.round(Number(mascara.replace(/\./g, '').replace(',', '.') || 0) * 100);
const mascaraDeCentavos = (c: number) => (c > 0 ? maskMoney(String(c)) : '');
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let seq = 0;
const novaChave = () => `k${++seq}`;

export function VendaForm({ onSuccess, idVenda, open: openProp, onOpenChange }: Props) {
    const editando = !!idVenda;
    const [openLocal, setOpenLocal] = useState(false);
    // Controlado por fora (edição ou o botão + do rodapé): sem botão próprio
    const controlado = editando || openProp !== undefined;
    const open = controlado ? !!openProp : openLocal;
    const setOpen = (v: boolean) => (controlado ? onOpenChange?.(v) : setOpenLocal(v));
    // Só no modo Clínica o admin lança venda em nome de outro profissional
    const { user, veTudo: escolheVendedor } = useAuth();
    const [vendedor, setVendedor] = useState<number>(user?.id ?? 0);
    const profsQ = trpc.agenda.profissionais.list.useQuery(undefined, { enabled: open && escolheVendedor });

    const pessoasQ = trpc.pessoas.listClientes.useQuery(undefined, { enabled: open });
    const servicosQ = trpc.servicos.list.useQuery(undefined, { enabled: open });
    const pacotesQ = trpc.pacotes.list.useQuery(undefined, { enabled: open });
    const formasQ = trpc.formasPagamento.list.useQuery(undefined, { enabled: open });

    const [idPessoa, setIdPessoa] = useState('');
    const [pessoaSearch, setPessoaSearch] = useState('');
    const [dataVenda, setDataVenda] = useState(hojeISO());
    const [observacao, setObservacao] = useState('');
    const [itens, setItens] = useState<ItemVenda[]>([]);
    const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [busca, setBusca] = useState('');
    /** Na edição, só refaz as parcelas em aberto se mexerem no pagamento. */
    const [pagamentosMexidos, setPagamentosMexidos] = useState(false);
    const [recebidoCentavos, setRecebidoCentavos] = useState(0);
    const [carregado, setCarregado] = useState(false);

    const vendaQ = trpc.vendas.getById.useQuery({ id: idVenda ?? 0 }, { enabled: editando && open });
    const parcelasQ = trpc.vendas.listParcelas.useQuery({ id_venda: idVenda ?? 0 }, { enabled: editando && open });

    // Preenche o formulário com a venda (uma vez por abertura)
    useEffect(() => {
        if (!editando || !open || carregado || !vendaQ.data || !parcelasQ.data) return;
        const v = vendaQ.data as any;
        const ps = parcelasQ.data as any[];
        setIdPessoa(String(v.id_pessoa));
        setDataVenda(String(v.data_venda).split('T')[0]);
        setObservacao(v.observacao ?? '');
        if (v.id_profissional) setVendedor(v.id_profissional);
        setItens((v.itens as any[]).map((i) => ({
            chave: novaChave(), id: i.id, usadas: i.usadas, id_servico: i.id_servico ?? undefined, id_pacote: i.id_pacote ?? undefined,
            nome: i.rotulo ?? 'Item', sessoes: String(i.quantidade_sessoes), valor: mascaraDeCentavos(Math.round(Number(i.valor) * 100)), pacote: !!i.id_pacote,
        })));
        setRecebidoCentavos(ps.filter((p) => p.status === 'PAGO').reduce((t, p) => t + Math.round(Number(p.valor) * 100), 0));
        // Parcelas em aberto agrupadas por forma: "Cartão 3x de R$ 100 a partir de …"
        const grupos = new Map<string, Pagamento & { n: number }>();
        for (const p of ps.filter((x) => x.status === 'PENDENTE')) {
            const forma = p.id_forma_pagamento ? String(p.id_forma_pagamento) : '';
            const venc = String(p.data_vencimento).split('T')[0];
            const g = grupos.get(forma);
            const c = Math.round(Number(p.valor) * 100);
            if (!g) grupos.set(forma, { chave: novaChave(), id_forma: forma, valor: String(c), parcelas: '1', vencimento: venc, pago: false, n: 1 });
            else grupos.set(forma, { ...g, valor: String(Number(g.valor) + c), n: g.n + 1, vencimento: venc < g.vencimento ? venc : g.vencimento });
        }
        setPagamentos([...grupos.values()].map(({ n, ...g }) => ({ ...g, parcelas: String(n), valor: mascaraDeCentavos(Number(g.valor)) })));
        setPagamentosMexidos(false);
        setCarregado(true);
    }, [editando, open, carregado, vendaQ.data, parcelasQ.data]);

    const aoSalvar = () => {
        onSuccess();
        resetForm();
        setOpen(false);
    };
    const createMut = trpc.vendas.create.useMutation({ onSuccess: aoSalvar });
    const updateMut = trpc.vendas.update.useMutation({ onSuccess: aoSalvar });
    const salvarMut = editando ? updateMut : createMut;

    function resetForm() {
        setIdPessoa('');
        setPessoaSearch('');
        setDataVenda(hojeISO());
        setObservacao('');
        setItens([]);
        setPagamentos([]);
        setBuscando(false);
        setBusca('');
        setPagamentosMexidos(false);
        setRecebidoCentavos(0);
        setCarregado(false);
        createMut.reset();
        updateMut.reset();
    }

    // Serviço próprio de um profissional só pode ser vendido por ele
    const profVendedor = ((profsQ.data ?? []) as any[]).find((p) => p.id === vendedor);
    const vendedorUsaClinica = !escolheVendedor || !profVendedor || profVendedor.perfil === 'ADMIN' || profVendedor.ve_servicos_clinica;
    const servicoDoVendedor = (dono: number | null | undefined) => (dono == null && vendedorUsaClinica) || dono === vendedor;
    const servicos = ((servicosQ.data ?? []) as any[]).filter((s) => s.ativo !== false && servicoDoVendedor(s.id_profissional));
    const donoServico = new Map(((servicosQ.data ?? []) as any[]).map((s) => [s.id, s.id_profissional]));
    const pacotes = ((pacotesQ.data ?? []) as any[]).filter(
        (p) => String(p.status).toLowerCase() === 'ativo' && servicoDoVendedor(donoServico.get(p.id_servico) ?? null),
    );

    /** Catálogo para a busca: serviços (sessão avulsa) e pacotes. */
    const catalogo = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        const lista = [
            ...servicos.map((s) => ({ chave: `s${s.id}`, id_servico: s.id as number, id_pacote: undefined as number | undefined, nome: s.nome as string, sessoes: 1, centavos: Math.round(Number(s.valor) * 100), pacote: false })),
            ...pacotes.map((p) => ({ chave: `p${p.id}`, id_servico: undefined as number | undefined, id_pacote: p.id as number, nome: p.nome as string, sessoes: Number(p.quantidade_sessoes), centavos: Math.round(Number(p.valor_total) * 100), pacote: true })),
        ];
        return lista.filter((x) => !termo || x.nome.toLowerCase().includes(termo)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }, [busca, servicos, pacotes]);

    const totalCentavos = itens.reduce((t, i) => t + paraCentavos(i.valor), 0);
    const pagoCentavos = pagamentos.reduce((t, p) => t + paraCentavos(p.valor), 0);
    const falta = totalCentavos - recebidoCentavos - pagoCentavos;

    /** Com um pagamento só, ele acompanha o total da venda (menos o já recebido). */
    function ajustarPagamentoUnico(novoTotal: number) {
        setPagamentos((ps) => {
            if (ps.length !== 1) return ps;
            setPagamentosMexidos(true);
            return [{ ...ps[0], valor: mascaraDeCentavos(novoTotal - recebidoCentavos) }];
        });
    }

    function adicionarItem(x: (typeof catalogo)[number]) {
        const novo: ItemVenda = {
            chave: novaChave(), id_servico: x.id_servico, id_pacote: x.id_pacote, nome: x.nome,
            sessoes: String(x.sessoes), valor: mascaraDeCentavos(x.centavos), pacote: x.pacote,
        };
        setItens((l) => [...l, novo]);
        const novoTotal = totalCentavos + x.centavos;
        if (!pagamentos.length) {
            const forma = ((formasQ.data ?? []) as any[]).find((f) => f.ativo !== false);
            setPagamentos([{ chave: novaChave(), id_forma: forma ? String(forma.id) : '', valor: mascaraDeCentavos(novoTotal - recebidoCentavos), parcelas: '1', vencimento: dataVenda, pago: false }]);
            setPagamentosMexidos(true);
        } else ajustarPagamentoUnico(novoTotal);
        setBuscando(false);
        setBusca('');
    }

    function alterarItem(chave: string, campo: 'sessoes' | 'valor', valor: string) {
        const lista = itens.map((i) => (i.chave === chave ? { ...i, [campo]: campo === 'valor' ? maskMoney(valor) : valor } : i));
        setItens(lista);
        if (campo === 'valor') ajustarPagamentoUnico(lista.reduce((t, i) => t + paraCentavos(i.valor), 0));
    }

    function removerItem(chave: string) {
        const lista = itens.filter((i) => i.chave !== chave);
        setItens(lista);
        if (!lista.length) { setPagamentos([]); setPagamentosMexidos(true); }
        else ajustarPagamentoUnico(lista.reduce((t, i) => t + paraCentavos(i.valor), 0));
    }

    function alterarPagamento(chave: string, patch: Partial<Pagamento>) {
        setPagamentosMexidos(true);
        setPagamentos((ps) => ps.map((p) => (p.chave === chave ? { ...p, ...patch, ...(patch.parcelas && patch.parcelas !== '1' ? { pago: false } : {}) } : p)));
    }

    function outraForma() {
        setPagamentosMexidos(true);
        setPagamentos((ps) => [...ps, { chave: novaChave(), id_forma: '', valor: mascaraDeCentavos(Math.max(falta, 0)), parcelas: '1', vencimento: dataVenda, pago: false }]);
    }

    function handleSubmit() {
        const pags = pagamentos.map((p) => ({
            id_forma_pagamento: Number(p.id_forma),
            valor: paraCentavos(p.valor) / 100,
            parcelas: Number(p.parcelas) || 1,
            primeiro_vencimento: p.vencimento,
            pago: p.pago && p.parcelas === '1',
        }));
        if (editando) {
            updateMut.mutate({
                id: idVenda!,
                id_pessoa: Number(idPessoa),
                itens: itens.map((i) => ({
                    id: i.id,
                    id_servico: i.id ? undefined : i.id_servico,
                    id_pacote: i.id ? undefined : i.id_pacote,
                    quantidade_sessoes: Number(i.sessoes),
                    valor: paraCentavos(i.valor) / 100,
                })),
                pagamentos: pagamentosMexidos ? pags : undefined,
                data_venda: dataVenda,
                observacao: observacao || null,
                ...(escolheVendedor ? { id_profissional: vendedor } : {}),
            });
            return;
        }
        createMut.mutate({
            id_pessoa: Number(idPessoa),
            itens: itens.map((i) => ({
                id_servico: i.id_servico,
                id_pacote: i.id_pacote,
                quantidade_sessoes: Number(i.sessoes),
                valor: paraCentavos(i.valor) / 100,
            })),
            pagamentos: pagamentos.map((p) => ({
                id_forma_pagamento: Number(p.id_forma),
                valor: paraCentavos(p.valor) / 100,
                parcelas: Number(p.parcelas) || 1,
                primeiro_vencimento: p.vencimento,
                pago: p.pago && p.parcelas === '1',
            })),
            data_venda: dataVenda,
            observacao: observacao || undefined,
            ...(escolheVendedor ? { id_profissional: vendedor } : {}),
        });
    }

    const filteredPessoas = pessoasQ.data?.filter((p) => !pessoaSearch || p.nome.toLowerCase().includes(pessoaSearch.toLowerCase()));
    const formas = ((formasQ.data ?? []) as any[]).filter((f) => f.ativo !== false);

    const isValid =
        !!idPessoa &&
        itens.length > 0 &&
        itens.every((i) => Number(i.sessoes) > 0 && paraCentavos(i.valor) > 0) &&
        (editando ? pagamentos.length > 0 || totalCentavos === recebidoCentavos : pagamentos.length > 0) &&
        (!pagamentosMexidos && editando ||
            pagamentos.every((p) => p.id_forma && paraCentavos(p.valor) > 0 && Number(p.parcelas) > 0 && p.vencimento >= dataVenda)) &&
        itens.every((i) => !i.usadas || Number(i.sessoes) >= i.usadas) &&
        falta === 0 &&
        !!dataVenda;

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            {!controlado && (
                <DialogTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Nova Venda
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editando ? 'Editar venda' : 'Nova venda'}</DialogTitle>
                </DialogHeader>

                {editando && !carregado ? (
                    <p className="py-8 text-center text-sm text-gray-500">Carregando a venda…</p>
                ) : (<>

                <div className="space-y-6">
                    {/* Cliente e data */}
                    <div className="space-y-4">
                        {escolheVendedor && (
                            <div className="space-y-1.5">
                                <Label>Vendido por</Label>
                                <select aria-label="Vendido por" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={vendedor}
                                    onChange={(e) => { setVendedor(Number(e.target.value)); if (!editando) { setItens([]); setPagamentos([]); } }}>
                                    {((profsQ.data ?? []) as any[]).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_170px]">
                            <div className="space-y-1.5">
                                <Label>Cliente</Label>
                                <Select value={idPessoa} onValueChange={setIdPessoa}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o cliente" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="p-2">
                                            <Input placeholder="Buscar…" value={pessoaSearch} onChange={(e) => setPessoaSearch(e.target.value)} className="h-8" />
                                        </div>
                                        {filteredPessoas?.map((p) => (
                                            <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Data da venda</Label>
                                <Input type="date" max={hojeISO()} value={dataVenda}
                                    onChange={(e) => {
                                        const d = e.target.value;
                                        setDataVenda(d);
                                        setPagamentos((ps) => ps.map((p) => (p.vencimento < d ? { ...p, vencimento: d } : p)));
                                    }} />
                            </div>
                        </div>
                    </div>

                    {/* Itens */}
                    <section className="space-y-2">
                        <h3 className="text-sm font-semibold">O que foi vendido</h3>
                        {itens.length > 0 && (
                            <ul className="divide-y rounded-lg border">
                                {itens.map((i) => (
                                    <li key={i.chave} className="space-y-2 p-3">
                                        <div className="flex items-start gap-2">
                                            {i.pacote && <Package className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                                            <p className="min-w-0 flex-1 text-sm font-medium">{i.nome}</p>
                                            {i.usadas ? (
                                                <span className="shrink-0 text-xs text-gray-500">{i.usadas} {i.usadas === 1 ? 'sessão usada' : 'sessões usadas'}</span>
                                            ) : (
                                                <button type="button" aria-label={`Tirar ${i.nome}`} onClick={() => removerItem(i.chave)}
                                                    className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="space-y-1 text-xs text-gray-500">
                                                Sessões
                                                <Input type="number" min={Math.max(1, i.usadas ?? 0)} inputMode="numeric" value={i.sessoes} onChange={(e) => alterarItem(i.chave, 'sessoes', e.target.value)} />
                                            </label>
                                            <label className="space-y-1 text-xs text-gray-500">
                                                Valor (R$)
                                                <Input inputMode="decimal" value={i.valor} placeholder="0,00" onChange={(e) => alterarItem(i.chave, 'valor', e.target.value)} />
                                            </label>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {buscando ? (
                            <div className="rounded-lg border">
                                <div className="flex items-center gap-2 border-b px-3">
                                    <Search className="h-4 w-4 shrink-0 text-gray-400" />
                                    <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar serviço ou pacote…"
                                        className="h-10 w-full bg-transparent text-sm outline-none" />
                                    <button type="button" aria-label="Fechar busca" onClick={() => { setBuscando(false); setBusca(''); }} className="p-1 text-gray-400">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <ul className="max-h-56 overflow-y-auto py-1">
                                    {catalogo.map((x) => (
                                        <li key={x.chave}>
                                            <button type="button" onClick={() => adicionarItem(x)}
                                                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]">
                                                {x.pacote ? <Package className="h-4 w-4 shrink-0 text-blue-600" /> : <span className="w-4 shrink-0" />}
                                                <span className="min-w-0 flex-1">{x.nome}</span>
                                                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                                                    {x.pacote ? `${x.sessoes} sessões · ` : ''}{brl(x.centavos)}
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                    {!catalogo.length && <li className="px-3 py-3 text-sm text-gray-500">Nada com esse nome.</li>}
                                </ul>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setBuscando(true)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-gray-600 hover:bg-[hsl(var(--accent))]">
                                <Plus className="h-4 w-4" /> {itens.length ? 'Adicionar outro item' : 'Adicionar serviço ou pacote'}
                            </button>
                        )}

                        {itens.length > 0 && (
                            <div className="flex items-baseline justify-between border-t pt-2">
                                <span className="text-sm text-gray-500">Total da venda</span>
                                <span className="text-lg font-semibold tabular-nums">{brl(totalCentavos)}</span>
                            </div>
                        )}
                    </section>

                    {/* Pagamento */}
                    {itens.length > 0 && (
                        <section className="space-y-3 rounded-lg border bg-[hsl(var(--muted))]/30 p-3 sm:p-4">
                            <h3 className="text-sm font-semibold">{recebidoCentavos > 0 ? 'Como o cliente vai pagar o resto' : 'Como o cliente vai pagar'}</h3>
                            {recebidoCentavos > 0 && (
                                <p className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                    <Check className="h-4 w-4 shrink-0" /> Já recebido: <strong className="tabular-nums">{brl(recebidoCentavos)}</strong> (não muda)
                                </p>
                            )}
                            {pagamentos.map((p, idx) => (
                                <div key={p.chave} className="space-y-3 rounded-lg border bg-white p-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="col-span-2 space-y-1 text-xs text-gray-500 sm:col-span-1">
                                            Forma
                                            <select aria-label="Forma de pagamento" className="h-10 w-full rounded-md border bg-white px-2 text-sm text-gray-900" value={p.id_forma}
                                                onChange={(e) => alterarPagamento(p.chave, { id_forma: e.target.value })}>
                                                <option value="">Escolha…</option>
                                                {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                            </select>
                                        </label>
                                        <label className="col-span-2 space-y-1 text-xs text-gray-500 sm:col-span-1">
                                            Valor (R$)
                                            <Input inputMode="decimal" value={p.valor} placeholder="0,00" onChange={(e) => alterarPagamento(p.chave, { valor: maskMoney(e.target.value) })} />
                                        </label>
                                        <label className="space-y-1 text-xs text-gray-500">
                                            Parcelas
                                            <Input type="number" min={1} max={48} inputMode="numeric" value={p.parcelas} onChange={(e) => alterarPagamento(p.chave, { parcelas: e.target.value })} />
                                        </label>
                                        <label className="space-y-1 text-xs text-gray-500">
                                            {Number(p.parcelas) > 1 ? '1º vencimento' : 'Vencimento'}
                                            <Input type="date" min={dataVenda} value={p.vencimento} onChange={(e) => alterarPagamento(p.chave, { vencimento: e.target.value })} />
                                        </label>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        {p.parcelas === '1' ? (
                                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                                <input type="checkbox" checked={p.pago} onChange={(e) => alterarPagamento(p.chave, { pago: e.target.checked })} />
                                                Já recebido
                                            </label>
                                        ) : (
                                            <span className="text-xs text-gray-500">
                                                {Number(p.parcelas) || 1}x de {brl(Math.floor(paraCentavos(p.valor) / (Number(p.parcelas) || 1)))}
                                            </span>
                                        )}
                                        {pagamentos.length > 1 && (
                                            <button type="button" onClick={() => setPagamentos((ps) => ps.filter((x) => x.chave !== p.chave))}
                                                className="text-xs text-red-600 hover:underline" aria-label={`Tirar pagamento ${idx + 1}`}>
                                                Tirar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <button type="button" onClick={outraForma}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-[hsl(var(--accent))]">
                                    <Plus className="h-4 w-4" /> Outra forma de pagamento
                                </button>
                                <span className={cn('inline-flex items-center gap-1 text-sm font-medium tabular-nums', falta === 0 ? 'text-emerald-700' : 'text-amber-700')}>
                                    {falta === 0 ? <><Check className="h-4 w-4" /> Pagamento fecha o total</>
                                        : falta > 0 ? `Falta ${brl(falta)}` : `Passou ${brl(-falta)} do total`}
                                </span>
                            </div>
                        </section>
                    )}

                    <div className="space-y-1.5">
                        <Label>Observação</Label>
                        <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" rows={2} />
                    </div>
                </div>

                {salvarMut.isError && <p className="text-sm text-red-600">{salvarMut.error.message}</p>}
                </>)}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={!isValid || salvarMut.isPending}>
                        {editando
                            ? (salvarMut.isPending ? 'Salvando…' : 'Salvar alterações')
                            : (salvarMut.isPending ? 'Lançando…' : 'Lançar venda')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
