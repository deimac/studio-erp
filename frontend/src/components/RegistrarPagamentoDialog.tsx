import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { maskMoney, unmaskMoney } from '@/lib/masks';
import { cn } from '@/lib/utils';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * Registrar pagamento de uma parcela (Financeiro e detalhe da venda).
 * O estado fica em quem usa; aqui só a tela: valor em destaque, "pagou tudo"
 * ou "pagou uma parte", data, e no parcial quanto pagou e quando vence o resto.
 */
export function RegistrarPagamentoDialog(p: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    valor: number;
    /** Linha de apoio: cliente, serviço, parcela. */
    detalhe?: string;
    data: string;
    onData: (v: string) => void;
    dataMax?: string;
    parcial: boolean;
    onParcial: (v: boolean) => void;
    valorPago: string;
    onValorPago: (v: string) => void;
    novoVenc: string;
    onNovoVenc: (v: string) => void;
    novoVencMin?: string;
    /** Forma de pagamento (só onde dá para trocar). */
    forma?: { opcoes: { id: number; nome: string }[]; valor: string; onChange: (v: string) => void; obrigatoria: boolean };
    salvando: boolean;
    erro?: string;
    onConfirmar: () => void;
    onCancelar: () => void;
}) {
    const pago = unmaskMoney(p.valorPago);
    const falta = Math.max(0, p.valor - pago);
    const invalido =
        p.salvando ||
        !p.data ||
        (!!p.forma?.obrigatoria && !p.forma.valor) ||
        (p.parcial && (pago <= 0 || pago >= p.valor || !p.novoVenc));

    return (
        <Dialog open={p.open} onOpenChange={p.onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Registrar pagamento</DialogTitle>
                </DialogHeader>

                <div className="min-w-0 space-y-5">
                    {/* Valor em destaque */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Valor da parcela</p>
                        <p className="text-2xl font-bold tabular-nums text-emerald-800">{brl(p.valor)}</p>
                        {p.detalhe && <p className="mt-0.5 truncate text-sm text-emerald-900/70">{p.detalhe}</p>}
                    </div>

                    {/* Tudo ou parte */}
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-[hsl(var(--muted))] p-1" role="radiogroup" aria-label="Quanto foi pago">
                        {[
                            { v: false, label: 'Pagou tudo' },
                            { v: true, label: 'Pagou uma parte' },
                        ].map((o) => (
                            <button
                                key={o.label}
                                type="button"
                                role="radio"
                                aria-checked={p.parcial === o.v}
                                onClick={() => p.onParcial(o.v)}
                                className={cn(
                                    'h-10 rounded-md text-sm font-medium transition-colors',
                                    p.parcial === o.v ? 'bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm' : 'text-[hsl(var(--muted-foreground))]',
                                )}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>

                    {p.parcial && (
                        <div className="space-y-3 rounded-lg border border-[hsl(var(--border))] p-3">
                            <div className="space-y-1.5">
                                <Label>Quanto pagou</Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[hsl(var(--muted-foreground))]">R$</span>
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        placeholder="0,00"
                                        className="pl-9 text-base font-semibold tabular-nums"
                                        value={p.valorPago}
                                        onChange={(e) => p.onValorPago(maskMoney(e.target.value))}
                                    />
                                </div>
                                {pago >= p.valor && pago > 0 && (
                                    <p className="text-xs text-amber-700">Esse valor paga a parcela toda: use "Pagou tudo".</p>
                                )}
                            </div>
                            <div className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-sm">
                                <span className="text-amber-800">Fica faltando</span>
                                <strong className="tabular-nums text-amber-900">{brl(falta)}</strong>
                            </div>
                            <div className="min-w-0 space-y-1.5">
                                <Label>Vencimento do que falta</Label>
                                <Input type="date" className="min-w-0" min={p.novoVencMin} value={p.novoVenc} onChange={(e) => p.onNovoVenc(e.target.value)} />
                            </div>
                        </div>
                    )}

                    <div className={cn('grid gap-4', p.forma && 'sm:grid-cols-2')}>
                        {p.forma && (
                            <div className="min-w-0 space-y-1.5">
                                <Label>Pago com</Label>
                                <select
                                    aria-label="Forma de pagamento"
                                    className="h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm"
                                    value={p.forma.valor}
                                    onChange={(e) => p.forma!.onChange(e.target.value)}
                                >
                                    <option value="">{p.forma.obrigatoria ? 'Escolha…' : 'Manter a combinada'}</option>
                                    {p.forma.opcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="min-w-0 space-y-1.5">
                            <Label>Pago em</Label>
                            <Input type="date" className="min-w-0" max={p.dataMax} value={p.data} onChange={(e) => p.onData(e.target.value)} />
                        </div>
                    </div>

                    {p.erro && <p className="text-sm text-red-600">{p.erro}</p>}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={p.onCancelar}>Cancelar</Button>
                    <Button type="button" onClick={p.onConfirmar} disabled={invalido}>
                        {p.salvando ? 'Registrando…' : p.parcial ? `Registrar ${brl(pago)}` : 'Confirmar pagamento'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
