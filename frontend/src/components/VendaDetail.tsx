import { useState, useRef } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';
import { maskMoney, unmaskMoney } from '@/lib/masks';

/* ── helpers ─── */
const fmt = (v: string | number) =>
    Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (v: string | Date | null | undefined) => {
    if (!v) return '–';
    // Normaliza para string yyyy-mm-dd
    let s: string;
    if (v instanceof Date) {
        s = v.toISOString().split('T')[0];
    } else {
        s = String(v).split('T')[0]; // remove parte T... de ISO strings
    }
    const parts = s.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return String(v);
};

function parcelaDisplayStatus(
    dataPagamento: string | null | undefined,
    dataVencimento: string | null | undefined,
    status: string,
) {
    if (status === 'CANCELADO') return { label: 'Cancelada', color: 'text-gray-400 line-through' };
    if (dataPagamento) return { label: fmtDate(dataPagamento), color: 'text-green-600 font-medium' };
    const hoje = new Date().toISOString().split('T')[0];
    if (dataVencimento && dataVencimento < hoje) return { label: 'Em atraso', color: 'text-red-500 font-medium' };
    return { label: 'Em aberto', color: 'text-yellow-600 font-medium' };
}

/* ── types (inferred from queries) ─── */
type VendaRow = {
    id: number;
    pessoa_nome: string | null;
    servico_nome: string | null;
    pacote_nome: string | null;
    valor: string;
    data_venda: any;
    status: string;
    observacao: string | null;
    quantidade_sessoes: number;
    forma_pagamento_nome: string | null;
    [key: string]: any;
};

type Props = {
    venda: VendaRow;
};

export function VendaDetail({ venda }: Props) {
    const { mutateAsync: atualizarValorParcelaPrincipalMutateAsync } = trpc.vendas.atualizarValorParcelaPrincipal.useMutation();
    const { mutateAsync: removerParcelaFilhaMutateAsync } = trpc.vendas.removerParcelaFilha.useMutation();
    const { toast } = useToast();
    const utils = trpc.useUtils();

    /* ── Observação ── */
    const [obs, setObs] = useState(venda.observacao ?? '');
    const updateObsMut = trpc.vendas.updateObservacao.useMutation({
        onSuccess: () => {
            toast({ title: 'Observação salva', variant: 'success' });
            utils.vendas.list.invalidate();
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    /* ── Parcelas ── */
    const parcelasQ = trpc.vendas.listParcelas.useQuery({ id_venda: venda.id });

    /* ── Atendimentos ── */
    const atendQ = trpc.vendas.listAtendimentos.useQuery({ id_venda: venda.id });

    /* ── Pagamento modal ── */
    const [pgtoOpen, setPgtoOpen] = useState(false);
    const [pgtoId, setPgtoId] = useState<number | null>(null);
    const [pgtoValorParcela, setPgtoValorParcela] = useState(0);
    const [pgtoData, setPgtoData] = useState(new Date().toISOString().split('T')[0]);
    const [pgtoParcial, setPgtoParcial] = useState(false);
    const [pgtoValorPago, setPgtoValorPago] = useState('');
    const [pgtoNovoVenc, setPgtoNovoVenc] = useState('');
    const pgtoFoiRemocaoRef = useRef(false);

    const pgtoMut = trpc.vendas.registrarPagamento.useMutation({
        onSuccess: () => {
            if (pgtoFoiRemocaoRef.current) {
                toast({ title: 'Pagamento removido com sucesso', variant: 'success' });
                pgtoFoiRemocaoRef.current = false;
            }
            parcelasQ.refetch();
            utils.vendas.list.invalidate();
            setPgtoOpen(false);
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function openPgto(parcelaId: number, valor: number) {
        setPgtoId(parcelaId);
        setPgtoValorParcela(valor);
        setPgtoData(new Date().toISOString().split('T')[0]);
        setPgtoParcial(false);
        setPgtoValorPago('');
        setPgtoNovoVenc('');
        setPgtoOpen(true);
    }

    function toYyyyMmDd(val: unknown): string {
        if (val == null) return '';
        if (val instanceof Date) return val.toISOString().split('T')[0];
        const s = String(val);
        return s.includes('T') ? s.split('T')[0] : s;
    }

    function submitPgto() {
        if (!pgtoId) return;
        const dataVendaStr = toYyyyMmDd(venda.data_venda);
        if (dataVendaStr && pgtoData && pgtoData < dataVendaStr) {
            toast({
                title: 'A data de pagamento não pode ser menor que a data da venda',
                variant: 'error',
            });
            return;
        }
        pgtoMut.mutate({
            id_financeiro: pgtoId,
            data_pagamento: pgtoData,
            parcial: pgtoParcial,
            valor_pago: pgtoParcial ? unmaskMoney(pgtoValorPago) : undefined,
            novo_vencimento: pgtoParcial ? pgtoNovoVenc : undefined,
        });
    }

    const valorRestante = pgtoParcial
        ? Math.max(0, pgtoValorParcela - unmaskMoney(pgtoValorPago))
        : 0;

    /* Sessões realizadas (contagem de atendimentos REALIZADO) */
    const sessoesRealizadas =
        atendQ.data?.filter((a) => a.status === 'REALIZADO').length ?? 0;

    return (
        <>
            <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-6 py-4">
                <Tabs defaultValue="financeiro">
                    <TabsList className="w-full">
                        <TabsTrigger value="observacoes" className="flex-1">
                            Observações
                        </TabsTrigger>
                        <TabsTrigger value="financeiro" className="flex-1">
                            Financeiro
                        </TabsTrigger>
                        <TabsTrigger value="atendimentos" className="flex-1">
                            Atendimentos
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Tab: Observações ── */}
                    <TabsContent value="observacoes">
                        <div className="space-y-3 p-2">
                            <Textarea
                                value={obs}
                                onChange={(e) => setObs(e.target.value)}
                                rows={4}
                                placeholder="Nenhuma observação"
                            />
                            <Button
                                size="sm"
                                onClick={() =>
                                    updateObsMut.mutate({
                                        id: venda.id,
                                        observacao: obs || null,
                                    })
                                }
                                disabled={updateObsMut.isPending}
                            >
                                {updateObsMut.isPending ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </div>
                    </TabsContent>

                    {/* ── Tab: Financeiro ── */}
                    <TabsContent value="financeiro">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Parcela</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Vencimento</TableHead>
                                    <TableHead>Data Pagamento</TableHead>
                                    <TableHead className="text-center">Pago</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {parcelasQ.isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                                            Carregando…
                                        </TableCell>
                                    </TableRow>
                                )}
                                {parcelasQ.data?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-gray-400 py-6">
                                            Nenhuma parcela
                                        </TableCell>
                                    </TableRow>
                                )}
                                {parcelasQ.data?.map((p) => {
                                    const display = parcelaDisplayStatus(
                                        p.data_pagamento,
                                        p.data_vencimento,
                                        p.status,
                                    );
                                    const isPaid = !!p.data_pagamento && p.status !== 'CANCELADO';
                                    const canToggle = p.status !== 'CANCELADO';
                                    return (
                                        <TableRow key={p.id}>
                                            <TableCell className="font-medium">{p.parcela}</TableCell>
                                            <TableCell>{fmt(p.valor)}</TableCell>
                                            <TableCell>{fmtDate(p.data_vencimento)}</TableCell>
                                            <TableCell>
                                                <span className={display.color}>{display.label}</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={isPaid}
                                                        disabled={!canToggle || pgtoMut.isPending}
                                                        onCheckedChange={async (checked: boolean) => {
                                                            if (checked) {
                                                                // 1. Set payment date and update grid
                                                                await pgtoMut.mutateAsync({
                                                                    id_financeiro: p.id,
                                                                    data_pagamento: new Date().toISOString().split('T')[0],
                                                                    parcial: false,
                                                                });
                                                                // 2. Open modal with today's date
                                                                setPgtoId(p.id);
                                                                setPgtoValorParcela(Number(p.valor));
                                                                setPgtoData(new Date().toISOString().split('T')[0]);
                                                                setPgtoParcial(false);
                                                                setPgtoValorPago('');
                                                                setPgtoNovoVenc('');
                                                                setPgtoOpen(true);
                                                            } else {
                                                                pgtoFoiRemocaoRef.current = true;
                                                                await pgtoMut.mutateAsync({
                                                                    id_financeiro: p.id,
                                                                    data_pagamento: null,
                                                                    parcial: false,
                                                                });
                                                                // Atualizar valor da parcela principal
                                                                await atualizarValorParcelaPrincipalMutateAsync({
                                                                    id_venda: venda.id,
                                                                    parcela: p.parcela,
                                                                    id_financeiro: p.id,
                                                                });
                                                                // Remover filhas
                                                                await removerParcelaFilhaMutateAsync({
                                                                    id_venda: venda.id,
                                                                    parcela: p.parcela,
                                                                    id_financeiro: p.id,
                                                                });
                                                                await parcelasQ.refetch();
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TabsContent>

                    {/* ── Tab: Atendimentos ── */}
                    <TabsContent value="atendimentos">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Horário</TableHead>
                                    <TableHead>Profissional</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {atendQ.isLoading && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                                            Carregando…
                                        </TableCell>
                                    </TableRow>
                                )}
                                {atendQ.data?.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-gray-400 py-6">
                                            Nenhum agendamento
                                        </TableCell>
                                    </TableRow>
                                )}
                                {atendQ.data?.map((a) => (
                                    <TableRow key={a.id}>
                                        <TableCell>{fmtDate(a.data)}</TableCell>
                                        <TableCell>
                                            {a.hora_inicio?.slice(0, 5)} – {a.hora_fim?.slice(0, 5)}
                                        </TableCell>
                                        <TableCell>{a.profissional_nome}</TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    a.status === 'REALIZADO'
                                                        ? 'success'
                                                        : a.status === 'CANCELADO' || a.status === 'FALTOU'
                                                            ? 'destructive'
                                                            : 'outline'
                                                }
                                            >
                                                {a.status}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TabsContent>
                </Tabs>
            </div>

            {/* ── Modal: Registrar Pagamento ── */}
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
                                        min={new Date().toISOString().split('T')[0]}
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
                                // revert switch and remove payment date
                                if (pgtoId) {
                                    pgtoMut.mutate({
                                        id_financeiro: pgtoId,
                                        data_pagamento: null,
                                        parcial: false,
                                    });
                                }
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={submitPgto}
                            disabled={
                                pgtoMut.isPending ||
                                !pgtoData ||
                                (pgtoParcial && (!pgtoValorPago || !pgtoNovoVenc || unmaskMoney(pgtoValorPago) <= 0))
                            }
                        >
                            {pgtoMut.isPending ? 'Registrando…' : 'Confirmar'}
                        </Button>
                    </DialogFooter>
                    {pgtoMut.isError && (
                        <p className="text-sm text-red-500 mt-2">{pgtoMut.error.message}</p>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
