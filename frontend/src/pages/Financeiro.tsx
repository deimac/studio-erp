import { useState, useMemo, useRef } from 'react';
import { trpc } from '@/services/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, DollarSign, TrendingUp, CreditCard, CalendarDays, AlertCircle, Clock, CheckCircle, Sparkles, Package } from 'lucide-react';
import { ReceitaDespesaForm } from '@/components/ReceitaDespesaForm';
import { useToast } from '@/hooks/useToast';
import { maskMoney, unmaskMoney } from '@/lib/masks';

export default function Financeiro() {
    const { toast } = useToast();
    const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('RECEITA');
    const [idPessoa, setIdPessoa] = useState<number | undefined>();
    const [situacao, setSituacao] = useState<'TODOS' | 'PAGO' | 'NAO_PAGO'>('TODOS');
    const [dataType, setDataType] = useState<'VENCIMENTO' | 'PAGAMENTO'>('VENCIMENTO');
    const [presetData, setPresetData] = useState<string | undefined>();
    const [presetMenuOpen, setPresetMenuOpen] = useState(false);
    const [dataInicio, setDataInicio] = useState<string>('');
    const [dataFim, setDataFim] = useState<string>('');
    const [search, setSearch] = useState('');

    // Modal de pagamento
    const [pgtoOpen, setPgtoOpen] = useState(false);
    const [pgtoId, setPgtoId] = useState<number | null>(null);
    const [pgtoValorParcela, setPgtoValorParcela] = useState(0);
    const [pgtoData, setPgtoData] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [pgtoParcial, setPgtoParcial] = useState(false);
    const [pgtoValorPago, setPgtoValorPago] = useState('');
    const [pgtoNovoVenc, setPgtoNovoVenc] = useState('');
    const pgtoFoiRemocaoRef = useRef(false);

    // Queries
    const pessoasQ = trpc.pessoas.list.useQuery();
    const finQ = trpc.financeiro.listWithDetails.useQuery(
        {
            tipo,
            id_pessoa: idPessoa,
            situacao,
            dataType,
            dataInicio: dataInicio || undefined,
            dataFim: dataFim || undefined,
        },
        { enabled: !!(tipo) }
    );

    // Utilitários
    const fmt = (v: string | number | null) =>
        v == null ? 'R$ 0,00' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const fmtDate = (d: string | Date | null) => {
        if (!d) return '–';
        // Normaliza para string yyyy-mm-dd (sem usar new Date() para evitar problemas de timezone)
        let s: string;
        if (d instanceof Date) {
            s = d.toISOString().split('T')[0];
        } else {
            s = String(d).split('T')[0]; // remove parte T... de ISO strings
        }
        const parts = s.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return String(d);
    };

    // Gera data local no formato YYYY-MM-DD (sem problemas de timezone)
    const getLocalDateString = (date: Date = new Date()) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Determina situação do vencimento: ATRASADO | VENCE_HOJE | EM_DIA
    const getSituacaoVencimento = (dataVencimento: string | Date | null, dataPagamento: string | Date | null) => {
        // Já pago = em dia
        if (dataPagamento) return 'EM_DIA';
        if (!dataVencimento) return 'EM_DIA';

        const hoje = getLocalDateString();
        const venc = typeof dataVencimento === 'string'
            ? dataVencimento.split('T')[0]
            : dataVencimento.toISOString().split('T')[0];

        if (venc < hoje) return 'ATRASADO';
        if (venc === hoje) return 'VENCE_HOJE';
        return 'EM_DIA';
    };

    // Status display para coluna de pagamento (similar ao VendaDetail)
    const pagamentoDisplayStatus = (dataPagamento: string | Date | null, dataVencimento: string | Date | null) => {
        if (dataPagamento) {
            return { label: fmtDate(dataPagamento), color: 'text-green-600 font-medium' };
        }
        const hoje = getLocalDateString();
        const venc = dataVencimento
            ? typeof dataVencimento === 'string'
                ? dataVencimento.split('T')[0]
                : dataVencimento.toISOString().split('T')[0]
            : null;
        if (venc && venc < hoje) {
            return { label: 'Em atraso', color: 'text-red-500 font-medium' };
        }
        return { label: 'Em aberto', color: 'text-yellow-600 font-medium' };
    };

    // Aplicar preset de datas
    const aplicarPreset = (preset: string) => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        let inicio: Date;
        let fim: Date = new Date(hoje);

        switch (preset) {
            case 'hoje':
                inicio = new Date(hoje);
                break;
            case 'semana':
                const dia = hoje.getDay();
                const diff = dia === 0 ? -6 : 1 - dia; // Segunda-feira desta semana
                inicio = new Date(hoje);
                inicio.setDate(inicio.getDate() + diff);
                break;
            case '30dias':
                inicio = new Date(hoje);
                inicio.setDate(inicio.getDate() - 30);
                break;
            case '2meses':
                inicio = new Date(hoje);
                inicio.setMonth(inicio.getMonth() - 2);
                break;
            case '3meses':
                inicio = new Date(hoje);
                inicio.setMonth(inicio.getMonth() - 3);
                break;
            case 'proximo2m':
                inicio = new Date(hoje);
                fim = new Date(hoje);
                fim.setMonth(fim.getMonth() + 2);
                break;
            case 'proximo3m':
                inicio = new Date(hoje);
                fim = new Date(hoje);
                fim.setMonth(fim.getMonth() + 3);
                break;
            case 'limpar':
                setDataInicio('');
                setDataFim('');
                setPresetData(undefined);
                return;
            default:
                return;
        }

        const dataInicioStr = getLocalDateString(inicio);
        const dataFimStr = getLocalDateString(fim);

        setDataInicio(dataInicioStr);
        setDataFim(dataFimStr);
        setPresetData(preset);
    };

    const toDayTimestamp = (value: string | Date | null | undefined) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        return date.getTime();
    };

    const inicioTs = dataInicio ? toDayTimestamp(`${dataInicio}T00:00:00`) : null;
    const fimTs = dataFim ? toDayTimestamp(`${dataFim}T00:00:00`) : null;

    // Filtrar e ordenar dados (mais antigos -> mais novos)
    const filtered = useMemo(() => {
        return (finQ.data ?? [])
            .filter((f: any) => {
                const matchesSearch = !search || (f.cliente_nome ?? '').toLowerCase().includes(search.toLowerCase());
                if (!matchesSearch) return false;

                if (inicioTs === null && fimTs === null) return true;

                const dateToCheck = dataType === 'PAGAMENTO' ? f.data_pagamento : f.data_vencimento;
                const registroTs = toDayTimestamp(dateToCheck);
                if (registroTs === null) return false;

                if (inicioTs !== null && registroTs < inicioTs) return false;
                if (fimTs !== null && registroTs > fimTs) return false;
                return true;
            })
            .sort((a: any, b: any) => {
                const dataA = toDayTimestamp(a.data_vencimento) ?? Number.MAX_SAFE_INTEGER;
                const dataB = toDayTimestamp(b.data_vencimento) ?? Number.MAX_SAFE_INTEGER;
                return dataA - dataB;
            });
    }, [finQ.data, search, dataType, inicioTs, fimTs]);

    // Cálculos resumidos
    const totalGeral = filtered.reduce((s, f) => s + Number(f.valor), 0);
    const totalPago = filtered.filter((f) => f.data_pagamento).reduce((s, f) => s + Number(f.valor), 0);
    const totalPendente = filtered.filter((f) => !f.data_pagamento).reduce((s, f) => s + Number(f.valor), 0);

    // Cálculos de situação de vencimento (apenas não pagos)
    const situacaoStats = useMemo(() => {
        const pendentes = filtered.filter((f) => !f.data_pagamento);
        return {
            atrasados: pendentes.filter((f) => getSituacaoVencimento(f.data_vencimento, f.data_pagamento) === 'ATRASADO').length,
            venceHoje: pendentes.filter((f) => getSituacaoVencimento(f.data_vencimento, f.data_pagamento) === 'VENCE_HOJE').length,
            emDia: pendentes.filter((f) => getSituacaoVencimento(f.data_vencimento, f.data_pagamento) === 'EM_DIA').length,
        };
    }, [filtered]);

    const updateParcelaMut = trpc.financeiro.updateParcela.useMutation({
        onSuccess: () => {
            finQ.refetch();
            if (pgtoFoiRemocaoRef.current) {
                toast({ title: 'Pagamento removido com sucesso', variant: 'success' });
                pgtoFoiRemocaoRef.current = false;
            } else {
                toast({ title: 'Parcela atualizada', variant: 'success' });
            }
        },
        onError: (e) => toast({ title: 'Erro ao atualizar', description: e.message, variant: 'error' }),
    });

    const { mutateAsync: atualizarValorParcelaPrincipalMutateAsync } = trpc.financeiro.atualizarValorParcelaPrincipal.useMutation();
    const { mutateAsync: removerParcelaFilhaMutateAsync } = trpc.financeiro.removerParcelaFilha.useMutation();

    const handleTogglePago = async (parcelaId: number, newChecked: boolean) => {
        console.log('[handleTogglePago] parcelaId:', parcelaId, 'newChecked:', newChecked);
        if (newChecked) {
            // Marcar como pago: APENAS abrir modal (sem registrar nada ainda)
            setPgtoId(parcelaId);
            const registroAtual = filtered.find((f) => f.id === parcelaId);
            if (registroAtual) {
                setPgtoValorParcela(Number(registroAtual.valor));
                setPgtoData(getLocalDateString()); // Data de hoje como padrão
                setPgtoParcial(false);
                setPgtoValorPago('');
                setPgtoNovoVenc('');
                setPgtoOpen(true);
            }
        } else {
            // Desmarcar como pago: remover pagamento e restaurar valor original
            pgtoFoiRemocaoRef.current = true;
            try {
                console.log('[handleTogglePago] Iniciando remoção de pagamento...');
                // 1. Atualizar valor da parcela principal (soma todas as filhas)
                await atualizarValorParcelaPrincipalMutateAsync({ id_financeiro: parcelaId });
                console.log('[handleTogglePago] Valor atualizado');
                // 2. Remover parcelas filhas
                await removerParcelaFilhaMutateAsync({ id_financeiro: parcelaId });
                console.log('[handleTogglePago] Filhas removidas');
                // 3. Remover data de pagamento
                await updateParcelaMut.mutateAsync({ id: parcelaId, data_pagamento: undefined as any });
                console.log('[handleTogglePago] Pagamento removido com sucesso');
            } catch (err: any) {
                console.error('[handleTogglePago] Erro:', err);
                toast({ title: 'Erro ao remover pagamento', description: err?.message || 'Erro desconhecido', variant: 'error' });
                pgtoFoiRemocaoRef.current = false;
            }
        }
    };

    const submitPgto = async () => {
        if (!pgtoId || !pgtoData) return;

        // Validar se a data de pagamento não é maior que hoje
        const hoje = getLocalDateString();
        if (pgtoData > hoje) {
            toast({ title: 'Data inválida', description: 'A data de pagamento não pode ser maior que hoje.', variant: 'error' });
            return;
        }

        try {
            // Registrar pagamento com a data selecionada no modal
            await updateParcelaMut.mutateAsync({
                id: pgtoId,
                data_pagamento: pgtoData,
                parcial: pgtoParcial,
                valor_pago: pgtoParcial ? unmaskMoney(pgtoValorPago) : undefined,
                novo_vencimento: pgtoParcial ? pgtoNovoVenc : undefined,
            });
            setPgtoOpen(false);
        } catch (err) {
            // Erro já é tratado pela mutation
        }
    };

    const valorRestante = pgtoParcial
        ? Math.max(0, pgtoValorParcela - unmaskMoney(pgtoValorPago))
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold tracking-tight">Financeiro</h2>
                <ReceitaDespesaForm onSuccess={() => finQ.refetch()} />
            </div>

            {finQ.isLoading && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 text-sm text-blue-600">
                        ⏳ Carregando dados...
                    </CardContent>
                </Card>
            )}

            {!finQ.isLoading && !finQ.isError && (finQ.data?.length ?? 0) === 0 && (
                <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4 text-sm">
                        <p className="font-bold text-yellow-700">⚠️ Nenhum dado encontrado</p>
                        <p className="text-yellow-600">Tipo: {tipo} | Unidade: {pessoasQ.data?.[0]?.id_unidade || 'carregando...'}</p>
                    </CardContent>
                </Card>
            )}

            {/* Summary cards */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <DollarSign className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Total</p>
                            <p className="text-lg font-bold text-blue-600">{fmt(totalGeral)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">{tipo === 'RECEITA' ? 'Recebido' : 'Pago'}</p>
                            <p className="text-lg font-bold text-green-600">{fmt(totalPago)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">{tipo === 'RECEITA' ? 'A Receber' : 'A Pagar'}</p>
                            <p className="text-lg font-bold text-amber-600">{fmt(totalPendente)}</p>
                        </div>
                    </CardContent>
                </Card>
                {/* Status de vencimento (apenas pendentes) */}
                <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                            <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-red-500">Atrasados</p>
                            <p className="text-lg font-bold text-red-600">{situacaoStats.atrasados}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-yellow-200 bg-yellow-50/50">
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600">
                            <Clock className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-yellow-600">Vence hoje</p>
                            <p className="text-lg font-bold text-yellow-600">{situacaoStats.venceHoje}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50/50">
                    <CardContent className="flex items-center gap-3 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                            <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-green-500">Em dia</p>
                            <p className="text-lg font-bold text-green-600">{situacaoStats.emDia}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tipo selector */}
            <div className="flex gap-2">
                <Button variant={tipo === 'RECEITA' ? 'default' : 'outline'} onClick={() => { setTipo('RECEITA'); setIdPessoa(undefined); }}>Receitas</Button>
                <Button variant={tipo === 'DESPESA' ? 'default' : 'outline'} onClick={() => { setTipo('DESPESA'); setIdPessoa(undefined); }}>Despesas</Button>
            </div>

            {/* Filtros compactos */}
            <Card className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Situação */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Situação:</span>
                        {[
                            { value: 'TODOS', label: 'Todos' },
                            { value: 'PAGO', label: 'Pago' },
                            { value: 'NAO_PAGO', label: 'Não pago' },
                        ].map((sit) => (
                            <Button key={sit.value} size="sm" variant={situacao === sit.value ? 'default' : 'outline'} className="h-7 px-2 text-xs" onClick={() => setSituacao(sit.value as any)}>
                                {sit.label}
                            </Button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-gray-200" />

                    {/* Tipo de Data */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">Data:</span>
                        {[
                            { value: 'VENCIMENTO', label: 'Venc.' },
                            { value: 'PAGAMENTO', label: 'Pgto' },
                        ].map((dt) => (
                            <Button key={dt.value} size="sm" variant={dataType === dt.value ? 'default' : 'outline'} className="h-7 px-2 text-xs" onClick={() => setDataType(dt.value as any)}>
                                {dt.label}
                            </Button>
                        ))}
                    </div>

                    <div className="h-6 w-px bg-gray-200" />

                    {/* Intervalo de datas */}
                    <div className="flex items-center gap-1.5">
                        <Input type="date" aria-label="Data inicial" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-7 w-[130px] text-xs px-2" />
                        <span className="text-gray-400">–</span>
                        <Input type="date" aria-label="Data final" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-7 w-[130px] text-xs px-2" />
                        <div className="relative">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                title="Selecionar preset de período"
                                onClick={() => setPresetMenuOpen((prev) => !prev)}
                            >
                                <CalendarDays className="h-3.5 w-3.5" />
                            </Button>

                            {presetMenuOpen && (
                                <div className="absolute right-0 mt-2 z-20 w-48 rounded-md border bg-white p-1 shadow-sm">
                                    {[
                                        { value: 'hoje', label: 'Hoje' },
                                        { value: 'semana', label: 'Esta semana' },
                                        { value: '30dias', label: 'Últimos 30 dias' },
                                        { value: '2meses', label: 'Últimos 2 meses' },
                                        { value: '3meses', label: 'Últimos 3 meses' },
                                        { value: 'proximo2m', label: 'Próximos 2 meses' },
                                        { value: 'proximo3m', label: 'Próximos 3 meses' },
                                        { value: 'limpar', label: 'Limpar datas' },
                                    ].map((item) => (
                                        <Button
                                            key={item.value}
                                            type="button"
                                            variant={presetData === item.value ? 'default' : 'ghost'}
                                            size="sm"
                                            className="w-full justify-start h-7 text-xs"
                                            onClick={() => {
                                                aplicarPreset(item.value);
                                                setPresetMenuOpen(false);
                                            }}
                                        >
                                            {item.label}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-6 w-px bg-gray-200" />

                    {/* Busca */}
                    <div className="relative flex-1 min-w-[180px] max-w-[250px]">
                        <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-gray-400" />
                        <Input placeholder={`Buscar ${tipo === 'RECEITA' ? 'cliente' : 'fornecedor'}...`} className="h-7 pl-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                </div>
            </Card>

            {/* Tabela */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{tipo === 'RECEITA' ? 'Cliente' : 'Fornecedor'}</TableHead>
                                <TableHead className="hidden sm:table-cell">Descrição</TableHead>
                                <TableHead>Forma Pgto</TableHead>
                                <TableHead className="hidden lg:table-cell">Lançamento</TableHead>
                                <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                                <TableHead>Pagamento</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead className="text-center">Pago</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {finQ.isLoading && (<TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">Carregando…</TableCell></TableRow>)}
                            {filtered.length === 0 && (<TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">Nenhum lançamento.</TableCell></TableRow>)}
                            {filtered.map((f: any) => {
                                const situacao = getSituacaoVencimento(f.data_vencimento, f.data_pagamento);
                                const vencimentoClass = situacao === 'ATRASADO'
                                    ? 'bg-red-100 text-red-700 px-2 py-0.5 rounded'
                                    : situacao === 'VENCE_HOJE'
                                        ? 'bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded'
                                        : '';
                                return (
                                    <TableRow key={f.id}>
                                        <TableCell className="font-medium">{f.cliente_nome}</TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            {f.pacote_nome || f.servico_nome ? (
                                                <div className="flex items-center gap-2">
                                                    {f.pacote_nome ? (
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-purple-100 text-purple-600">
                                                            <Package className="h-3.5 w-3.5" />
                                                        </span>
                                                    ) : f.servico_nome ? (
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                                                            <Sparkles className="h-3.5 w-3.5" />
                                                        </span>
                                                    ) : null}
                                                    <span className="text-sm">{f.pacote_nome ?? f.servico_nome}</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-gray-600">{f.descricao || '–'}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <p className="font-medium">{f.forma_pagamento_nome || '–'}</p>
                                                {f.quantidade_parcelas && f.quantidade_parcelas > 1 && <p className="text-xs text-gray-400">Parcela {f.parcela} de {f.quantidade_parcelas}</p>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">{fmtDate(f.data_lancamento)}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <span className={vencimentoClass}>{fmtDate(f.data_vencimento)}</span>
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const pgtStatus = pagamentoDisplayStatus(f.data_pagamento, f.data_vencimento);
                                                return <span className={pgtStatus.color}>{pgtStatus.label}</span>;
                                            })()}
                                        </TableCell>
                                        <TableCell className="font-medium">{fmt(f.valor)}</TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={!!f.data_pagamento}
                                                disabled={updateParcelaMut.isPending}
                                                onCheckedChange={(checked: boolean) => handleTogglePago(f.id, checked)}
                                                aria-label="Marcar como pago"
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Modal de Pagamento */}
            <Dialog open={pgtoOpen} onOpenChange={setPgtoOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Registrar Pagamento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-[hsl(var(--muted-foreground))]">
                            Valor da parcela: <strong>{fmt(pgtoValorParcela)}</strong>
                        </p>

                        <div className="space-y-1.5">
                            <Label>Data de Pagamento</Label>
                            <Input
                                type="date"
                                value={pgtoData}
                                max={getLocalDateString()}
                                onChange={(e) => setPgtoData(e.target.value)}
                            />
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={pgtoParcial}
                                onChange={(e) => setPgtoParcial(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300"
                            />
                            <span className="text-sm">Realizar pagamento parcial</span>
                        </label>

                        {pgtoParcial && (
                            <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 p-3">
                                <div className="space-y-1.5">
                                    <Label>Valor Pago (R$)</Label>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0,00"
                                        value={pgtoValorPago}
                                        onChange={(e) => setPgtoValorPago(maskMoney(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                        Valor Restante:{' '}
                                    </span>
                                    <strong className="text-sm">{fmt(valorRestante)}</strong>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Novo Vencimento</Label>
                                    <Input
                                        type="date"
                                        min={getLocalDateString()}
                                        value={pgtoNovoVenc}
                                        onChange={(e) => setPgtoNovoVenc(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setPgtoOpen(false);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={submitPgto}
                            disabled={
                                updateParcelaMut.isPending ||
                                !pgtoData ||
                                (pgtoParcial && (!pgtoValorPago || !pgtoNovoVenc || unmaskMoney(pgtoValorPago) <= 0))
                            }
                        >
                            {updateParcelaMut.isPending ? 'Registrando…' : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                    {updateParcelaMut.isError && (
                        <p className="text-sm text-red-500 mt-2">{updateParcelaMut.error.message}</p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
