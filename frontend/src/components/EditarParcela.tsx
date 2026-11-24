import { useEffect, useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil } from 'lucide-react';
import { maskMoney, unmaskMoney } from '@/lib/masks';
import { VendaForm } from '@/components/VendaForm';

/**
 * Editar um lançamento do Financeiro: vencimento, valor e forma de pagamento.
 * Se o lançamento é de uma venda, dá para abrir a venda inteira.
 */

type Lancamento = {
    id: number;
    id_venda: number | null;
    cliente_nome: string;
    descricao?: string | null;
    pacote_nome?: string | null;
    servico_nome?: string | null;
    parcela: number;
    quantidade_parcelas: number | null;
    valor: string | number;
    data_vencimento: string | Date;
    data_pagamento: string | Date | null;
    id_forma_pagamento: number | null;
    status: string;
};

type Props = { lancamento: Lancamento | null; onClose: () => void; onSaved: () => void };

const soData = (d: string | Date) => (d instanceof Date ? d.toISOString() : String(d)).split('T')[0];
const paraMascara = (v: string | number) => maskMoney(String(Math.round(Number(v) * 100)));

export function EditarParcela({ lancamento, onClose, onSaved }: Props) {
    const formasQ = trpc.formasPagamento.list.useQuery(undefined, { enabled: !!lancamento });
    const [vencimento, setVencimento] = useState('');
    const [valor, setValor] = useState('');
    const [forma, setForma] = useState('');
    const [vendaAberta, setVendaAberta] = useState<number | null>(null);

    useEffect(() => {
        if (!lancamento) return;
        setVencimento(soData(lancamento.data_vencimento));
        setValor(paraMascara(lancamento.valor));
        setForma(lancamento.id_forma_pagamento ? String(lancamento.id_forma_pagamento) : '');
        salvarMut.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lancamento?.id]);

    const salvarMut = trpc.financeiro.editarParcela.useMutation({
        onSuccess: () => {
            onSaved();
            onClose();
        },
    });

    const pago = !!lancamento?.data_pagamento;
    const cancelado = lancamento?.status === 'CANCELADO';
    const formas = ((formasQ.data ?? []) as any[]).filter((f) => f.ativo !== false || String(f.id) === forma);
    const nome = lancamento ? lancamento.pacote_nome ?? lancamento.servico_nome ?? lancamento.descricao ?? '' : '';
    const valido = !!vencimento && unmaskMoney(valor) > 0;

    return (
        <>
            <Dialog open={!!lancamento} onOpenChange={(v) => { if (!v) onClose(); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Editar lançamento</DialogTitle>
                    </DialogHeader>
                    {lancamento && (
                        <div className="space-y-4">
                            <div>
                                <p className="font-semibold">{lancamento.cliente_nome}</p>
                                <p className="text-sm text-gray-600">
                                    {nome}
                                    {(lancamento.quantidade_parcelas ?? 1) > 1 ? ` · parcela ${lancamento.parcela} de ${lancamento.quantidade_parcelas}` : ''}
                                </p>
                            </div>

                            {cancelado ? (
                                <p className="rounded-md bg-gray-100 px-3 py-2 text-sm text-gray-600">Este lançamento foi cancelado e não pode ser editado.</p>
                            ) : (
                                <>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="ep-venc">Vencimento</Label>
                                        <Input id="ep-venc" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="ep-valor">Valor (R$)</Label>
                                        <Input id="ep-valor" inputMode="decimal" value={valor} disabled={pago}
                                            onChange={(e) => setValor(maskMoney(e.target.value))} />
                                        {pago && <p className="text-xs text-gray-500">Já foi pago. Para mudar o valor, desmarque “Pago” antes.</p>}
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="ep-forma">Forma de pagamento</Label>
                                        <select id="ep-forma" className="h-10 w-full rounded-md border bg-white px-3 text-sm" value={forma}
                                            onChange={(e) => setForma(e.target.value)}>
                                            <option value="">{lancamento.id_venda ? 'A definir' : 'Escolha…'}</option>
                                            {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                        </select>
                                    </div>
                                </>
                            )}

                            {lancamento.id_venda && (
                                <button type="button" onClick={() => { setVendaAberta(lancamento.id_venda); onClose(); }}
                                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
                                    <Pencil className="h-3.5 w-3.5" /> Editar a venda inteira (cliente, itens, parcelas)
                                </button>
                            )}

                            {salvarMut.isError && <p className="text-sm text-red-600">{salvarMut.error.message}</p>}
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={onClose}>Cancelar</Button>
                        {!cancelado && (
                            <Button disabled={!valido || salvarMut.isPending}
                                onClick={() => lancamento && salvarMut.mutate({
                                    id: lancamento.id,
                                    data_vencimento: vencimento,
                                    valor: unmaskMoney(valor),
                                    id_forma_pagamento: forma ? Number(forma) : null,
                                })}>
                                {salvarMut.isPending ? 'Salvando…' : 'Salvar'}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {vendaAberta && (
                <VendaForm
                    idVenda={vendaAberta}
                    open
                    onOpenChange={(v) => { if (!v) setVendaAberta(null); }}
                    onSuccess={() => { setVendaAberta(null); onSaved(); }}
                />
            )}
        </>
    );
}
