import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { maskMoney } from '@/lib/masks';

type Props = { onSuccess: () => void };

export function ReceitaDespesaForm({ onSuccess }: Props) {
    const [open, setOpen] = useState(false);

    /* selects com busca */
    const pessoasQ = trpc.pessoas.list.useQuery();
    const formasQ = trpc.formasPagamento.list.useQuery();
    const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('RECEITA');
    const categoriasQ = trpc.receitasDespesas.listCategorias.useQuery({ tipo });

    /* campos do formulário */
    const [idPessoa, setIdPessoa] = useState('');
    const [descricao, setDescricao] = useState('');
    const [valor, setValor] = useState('');
    const [idCategoria, setIdCategoria] = useState('');
    const [observacao, setObservacao] = useState('');

    /* bloco pagamento */
    const [idFormaPagamento, setIdFormaPagamento] = useState('');
    const [parcelas, setParcelas] = useState('1');
    const hoje = new Date().toISOString().split('T')[0];
    const [dataLancamento, setDataLancamento] = useState(hoje);
    const [dataPrimVenc, setDataPrimVenc] = useState(hoje);

    /* pesquisa nos selects */
    const [pessoaSearch, setPessoaSearch] = useState('');

    const createMut = trpc.receitasDespesas.create.useMutation({
        onSuccess: () => {
            onSuccess();
            resetForm();
            setOpen(false);
        },
    });

    function resetForm() {
        setTipo('RECEITA');
        setIdPessoa('');
        setDescricao('');
        setValor('');
        setIdCategoria('');
        setObservacao('');
        setIdFormaPagamento('');
        setParcelas('1');
        setDataLancamento(hoje);
        setDataPrimVenc(hoje);
        setPessoaSearch('');
    }

    function handleSubmit() {
        // Converter valor mascarado (1.234,56) para número
        const valorNumerico = Number(valor.replace(/\./g, '').replace(',', '.'));

        createMut.mutate({
            id_pessoa: Number(idPessoa),
            tipo,
            descricao: descricao.trim(),
            valor: valorNumerico,
            data_lancamento: dataLancamento,
            data_primeiro_vencimento: dataPrimVenc,
            id_forma_pagamento: Number(idFormaPagamento),
            id_categoria: Number(idCategoria),
            quantidade_parcelas: Number(parcelas),
            observacao: observacao || undefined,
        });
    }

    // Filtrar pessoas por tipo
    const filteredPessoas = pessoasQ.data?.filter((p: any) => {
        const matchSearch = !pessoaSearch || p.nome.toLowerCase().includes(pessoaSearch.toLowerCase());
        const matchTipo = tipo === 'RECEITA' ? p.tipo === 'CLIENTE' : p.tipo === 'FORNECEDOR';
        return matchSearch && matchTipo;
    });

    // Converter valor mascarado para validação
    const valorNumerico = Number(valor.replace(/\./g, '').replace(',', '.')) || 0;

    const isValid =
        idPessoa &&
        descricao.trim() &&
        idCategoria &&
        idFormaPagamento &&
        valorNumerico > 0 &&
        Number(parcelas) > 0 &&
        dataLancamento &&
        dataPrimVenc;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Novo Lançamento
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Novo Lançamento</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* ───── Botões Receita/Despesa ───── */}
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant={tipo === 'RECEITA' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                                setTipo('RECEITA');
                                setIdPessoa('');
                            }}
                        >
                            Receita
                        </Button>
                        <Button
                            type="button"
                            variant={tipo === 'DESPESA' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                                setTipo('DESPESA');
                                setIdPessoa('');
                            }}
                        >
                            Despesa
                        </Button>
                    </div>

                    {/* ───── Bloco: Dados do Lançamento ───── */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                            Dados do Lançamento
                        </h3>

                        {/* Pessoa */}
                        <div className="space-y-1.5">
                            <Label>{tipo === 'RECEITA' ? 'Cliente' : 'Fornecedor'}</Label>
                            <Select value={idPessoa} onValueChange={setIdPessoa}>
                                <SelectTrigger>
                                    <SelectValue placeholder={`Selecione o ${tipo === 'RECEITA' ? 'cliente' : 'fornecedor'}`} />
                                </SelectTrigger>
                                <SelectContent>
                                    <div className="p-2">
                                        <Input
                                            placeholder="Buscar…"
                                            value={pessoaSearch}
                                            onChange={(e) => setPessoaSearch(e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                    {filteredPessoas?.map((p: any) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Descrição */}
                        <div className="space-y-1.5">
                            <Label>Descrição</Label>
                            <Input
                                type="text"
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Descrição do lançamento"
                            />
                        </div>

                        {/* Categoria e Valor */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Categoria</Label>
                                <Select value={idCategoria} onValueChange={setIdCategoria}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(categoriasQ.data as any[])?.map((c: any) => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                                {c.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Valor (R$)</Label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={valor}
                                    onChange={(e) => setValor(maskMoney(e.target.value))}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Observação</Label>
                            <Textarea
                                value={observacao}
                                onChange={(e) => setObservacao(e.target.value)}
                                placeholder="Opcional"
                                rows={2}
                            />
                        </div>
                    </div>

                    {/* ───── Bloco: Pagamento (container destacado) ───── */}
                    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                            Pagamento
                        </h3>

                        <div className="space-y-1.5">
                            <Label>Forma de Pagamento</Label>
                            <Select value={idFormaPagamento} onValueChange={setIdFormaPagamento}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(formasQ.data as any[])
                                        ?.filter((f) => f.ativo !== false)
                                        .map((f: any) => (
                                            <SelectItem key={f.id} value={String(f.id)}>
                                                {f.nome}
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label>Nº de Parcelas</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={parcelas}
                                    onChange={(e) => setParcelas(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Data do Lançamento</Label>
                                <Input
                                    type="date"
                                    max={hoje}
                                    value={dataLancamento}
                                    onChange={(e) => {
                                        setDataLancamento(e.target.value);
                                        if (dataPrimVenc < e.target.value) setDataPrimVenc(e.target.value);
                                    }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>1º Vencimento</Label>
                                <Input
                                    type="date"
                                    min={dataLancamento}
                                    value={dataPrimVenc}
                                    onChange={(e) => setDataPrimVenc(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={!isValid || createMut.isPending}>
                        {createMut.isPending ? 'Lançando…' : 'Lançar'}
                    </Button>
                </DialogFooter>

                {createMut.isError && (
                    <p className="text-sm text-red-500 mt-2">{createMut.error.message}</p>
                )}
            </DialogContent>
        </Dialog>
    );
}
