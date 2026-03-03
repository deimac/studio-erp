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

export function VendaForm({ onSuccess }: Props) {
    const [open, setOpen] = useState(false);

    /* selects com busca */
    const pessoasQ = trpc.pessoas.listClientes.useQuery();
    const servicosQ = trpc.servicos.list.useQuery();
    const pacotesQ = trpc.pacotes.list.useQuery();
    const formasQ = trpc.formasPagamento.list.useQuery();

    /* campos do formulário */
    const [tipoItem, setTipoItem] = useState<'servico' | 'pacote'>('servico');
    const [idPessoa, setIdPessoa] = useState('');
    const [idServico, setIdServico] = useState('');
    const [idPacote, setIdPacote] = useState('');
    const [sessoes, setSessoes] = useState('1');
    const [valor, setValor] = useState('');
    const [observacao, setObservacao] = useState('');

    /* bloco pagamento */
    const [idFormaPagamento, setIdFormaPagamento] = useState('');
    const [parcelas, setParcelas] = useState('1');
    const hoje = new Date().toISOString().split('T')[0];
    const [dataVenda, setDataVenda] = useState(hoje);
    const [dataPrimVenc, setDataPrimVenc] = useState(hoje);

    /* pesquisa nos selects */
    const [pessoaSearch, setPessoaSearch] = useState('');
    const [servicoSearch, setServicoSearch] = useState('');
    const [pacoteSearch, setPacoteSearch] = useState('');

    const createMut = trpc.vendas.create.useMutation({
        onSuccess: () => {
            onSuccess();
            resetForm();
            setOpen(false);
        },
    });

    function resetForm() {
        setIdPessoa('');
        setIdServico('');
        setIdPacote('');
        setSessoes('1');
        setValor('');
        setObservacao('');
        setIdFormaPagamento('');
        setParcelas('1');
        setDataVenda(hoje);
        setDataPrimVenc(hoje);
        setTipoItem('servico');
        setPessoaSearch('');
        setServicoSearch('');
        setPacoteSearch('');
    }

    function formatAmountToMask(value: string | number) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '';
        const cents = Math.round(amount * 100);
        return maskMoney(String(cents));
    }

    /* Auto-preencher ao escolher pacote ou serviço */
    function onSelectServico(id: string) {
        setIdServico(id);
        setIdPacote('');
        const srv = servicosQ.data?.find((s: any) => String(s.id) === id);
        if (srv) {
            setValor(formatAmountToMask(srv.valor));
            setSessoes('1');
        }
    }

    function onSelectPacote(id: string) {
        setIdPacote(id);
        setIdServico('');
        const pkt = pacotesQ.data?.find((p: any) => String(p.id) === id);
        if (pkt) {
            setValor(formatAmountToMask(pkt.valor_total));
            setSessoes(String(pkt.quantidade_sessoes));
        }
    }

    function handleSubmit() {
        // Converter valor mascarado (1.234,56) para número
        const valorNumerico = Number(valor.replace(/\./g, '').replace(',', '.'));

        createMut.mutate({
            id_pessoa: Number(idPessoa),
            id_servico: tipoItem === 'servico' ? Number(idServico) : undefined,
            id_pacote: tipoItem === 'pacote' ? Number(idPacote) : undefined,
            id_forma_pagamento: Number(idFormaPagamento),
            quantidade_sessoes: Number(sessoes),
            valor: valorNumerico,
            data_venda: dataVenda,
            data_primeiro_vencimento: dataPrimVenc,
            quantidade_parcelas: Number(parcelas),
            observacao: observacao || undefined,
        });
    }

    const filteredPessoas = pessoasQ.data?.filter(
        (p) => !pessoaSearch || p.nome.toLowerCase().includes(pessoaSearch.toLowerCase()),
    );
    const filteredServicos = (servicosQ.data as any[])?.filter(
        (s) =>
            s.ativo !== false &&
            (!servicoSearch || s.nome.toLowerCase().includes(servicoSearch.toLowerCase())),
    );
    const filteredPacotes = (pacotesQ.data as any[])?.filter(
        (p) =>
            (!pacoteSearch || p.nome.toLowerCase().includes(pacoteSearch.toLowerCase())),
    );

    // Converter valor mascarado para validação
    const valorNumerico = Number(valor.replace(/\./g, '').replace(',', '.')) || 0;

    const isValid =
        idPessoa &&
        (tipoItem === 'servico' ? idServico : idPacote) &&
        idFormaPagamento &&
        Number(sessoes) > 0 &&
        valorNumerico > 0 &&
        Number(parcelas) > 0 &&
        dataVenda &&
        dataPrimVenc;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Nova Venda
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nova Venda</DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* ───── Bloco: Dados da Venda ───── */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                            Dados da Venda
                        </h3>

                        {/* Cliente */}
                        <div className="space-y-1.5">
                            <Label>Cliente</Label>
                            <Select value={idPessoa} onValueChange={setIdPessoa}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o cliente" />
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
                                    {filteredPessoas?.map((p) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Tipo do item (serviço ou pacote) */}
                        <div className="space-y-1.5">
                            <Label>Tipo</Label>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={tipoItem === 'servico' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setTipoItem('servico');
                                        setIdPacote('');
                                    }}
                                >
                                    Serviço
                                </Button>
                                <Button
                                    type="button"
                                    variant={tipoItem === 'pacote' ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setTipoItem('pacote');
                                        setIdServico('');
                                    }}
                                >
                                    Pacote
                                </Button>
                            </div>
                        </div>

                        {tipoItem === 'servico' ? (
                            <div className="space-y-1.5">
                                <Label>Serviço</Label>
                                <Select value={idServico} onValueChange={onSelectServico}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o serviço" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="p-2">
                                            <Input
                                                placeholder="Buscar…"
                                                value={servicoSearch}
                                                onChange={(e) => setServicoSearch(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        {filteredServicos?.map((s: any) => (
                                            <SelectItem key={s.id} value={String(s.id)}>
                                                {s.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                <Label>Pacote</Label>
                                <Select value={idPacote} onValueChange={onSelectPacote}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o pacote" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <div className="p-2">
                                            <Input
                                                placeholder="Buscar…"
                                                value={pacoteSearch}
                                                onChange={(e) => setPacoteSearch(e.target.value)}
                                                className="h-8"
                                            />
                                        </div>
                                        {filteredPacotes?.map((p: any) => (
                                            <SelectItem key={p.id} value={String(p.id)}>
                                                {p.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Sessões</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={sessoes}
                                    onChange={(e) => setSessoes(e.target.value)}
                                />
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
                                <Label>Data da Venda</Label>
                                <Input
                                    type="date"
                                    max={hoje}
                                    value={dataVenda}
                                    onChange={(e) => {
                                        setDataVenda(e.target.value);
                                        if (dataPrimVenc < e.target.value) setDataPrimVenc(e.target.value);
                                    }}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>1º Vencimento</Label>
                                <Input
                                    type="date"
                                    min={dataVenda}
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
                        {createMut.isPending ? 'Lançando…' : 'Lançar Venda'}
                    </Button>
                </DialogFooter>

                {createMut.isError && (
                    <p className="text-sm text-red-500 mt-2">{createMut.error.message}</p>
                )}
            </DialogContent>
        </Dialog>
    );
}
