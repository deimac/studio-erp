import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/services/trpc';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, Package, Plus, Search, X } from 'lucide-react';
import { maskMoney } from '@/lib/masks';
import { cn } from '@/lib/utils';

/**
 * Venda rápida a partir do agendamento: um pacote ou sessão para o cliente,
 * já com cliente e profissional definidos. Combinar formas de pagamento fica
 * em "Dividir em outra forma".
 */

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    idPessoa: number;
    pessoaNome: string;
    idProfissional: number;
    onCreated: (idVenda: number) => void;
};

type Escolha = { id_servico?: number; id_pacote?: number; nome: string; pacote: boolean };
type Pagamento = { chave: number; id_forma: string; valor: string; parcelas: string; pago: boolean };

const hojeISO = () => new Date().toISOString().split('T')[0];
const paraCentavos = (m: string) => Math.round(Number(m.replace(/\./g, '').replace(',', '.') || 0) * 100);
const mascara = (c: number) => (c > 0 ? maskMoney(String(c)) : '');
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const selectCls = 'h-10 w-full rounded-md border bg-white px-2 text-sm';

export function VendaRapida({ open, onOpenChange, idPessoa, pessoaNome, idProfissional, onCreated }: Props) {
    const { toast } = useToast();
    const servicosQ = trpc.servicos.list.useQuery(undefined, { enabled: open });
    const pacotesQ = trpc.pacotes.list.useQuery(undefined, { enabled: open });
    const formasQ = trpc.formasPagamento.list.useQuery(undefined, { enabled: open });
    const profsQ = trpc.agenda.profissionais.list.useQuery(undefined, { enabled: open });

    const [busca, setBusca] = useState('');
    const [escolha, setEscolha] = useState<Escolha | null>(null);
    const [sessoes, setSessoes] = useState('1');
    const [valor, setValor] = useState('');
    const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);

    useEffect(() => {
        if (!open) return;
        setBusca('');
        setEscolha(null);
        setSessoes('1');
        setValor('');
        setPagamentos([]);
    }, [open]);

    // Só o que o profissional pode vender (próprios + clínica, se liberado)
    const prof = ((profsQ.data ?? []) as any[]).find((p) => p.id === idProfissional);
    const usaClinica = !prof || prof.perfil === 'ADMIN' || prof.ve_servicos_clinica;
    const serve = (dono: number | null | undefined) => (dono == null && usaClinica) || dono === idProfissional;
    const donoServico = new Map(((servicosQ.data ?? []) as any[]).map((s) => [s.id, s.id_profissional]));
    const catalogo = useMemo(() => {
        const termo = busca.trim().toLowerCase();
        const lista = [
            ...((pacotesQ.data ?? []) as any[])
                .filter((p) => String(p.status).toLowerCase() === 'ativo' && serve(donoServico.get(p.id_servico) ?? null))
                .map((p) => ({ chave: `p${p.id}`, id_pacote: p.id as number, id_servico: undefined, nome: p.nome as string, sessoes: Number(p.quantidade_sessoes), centavos: Math.round(Number(p.valor_total) * 100), pacote: true })),
            ...((servicosQ.data ?? []) as any[])
                .filter((s) => s.ativo !== false && serve(s.id_profissional))
                .map((s) => ({ chave: `s${s.id}`, id_servico: s.id as number, id_pacote: undefined, nome: s.nome as string, sessoes: 1, centavos: Math.round(Number(s.valor) * 100), pacote: false })),
        ];
        return lista.filter((x) => !termo || x.nome.toLowerCase().includes(termo));
    }, [busca, servicosQ.data, pacotesQ.data, profsQ.data]); // eslint-disable-line react-hooks/exhaustive-deps

    const formas = ((formasQ.data ?? []) as any[]).filter((f) => f.ativo !== false);
    const total = paraCentavos(valor);
    const pago = pagamentos.reduce((t, p) => t + paraCentavos(p.valor), 0);
    const falta = total - pago;

    function escolher(x: (typeof catalogo)[number]) {
        setEscolha({ id_servico: x.id_servico, id_pacote: x.id_pacote, nome: x.nome, pacote: x.pacote });
        setSessoes(String(x.sessoes));
        setValor(mascara(x.centavos));
        setPagamentos([{ chave: Date.now(), id_forma: formas[0] ? String(formas[0].id) : '', valor: mascara(x.centavos), parcelas: '1', pago: false }]);
    }
    function mudarValor(v: string) {
        const m = maskMoney(v);
        setValor(m);
        setPagamentos((ps) => (ps.length === 1 ? [{ ...ps[0], valor: m }] : ps));
    }
    const alterar = (chave: number, patch: Partial<Pagamento>) =>
        setPagamentos((ps) => ps.map((p) => (p.chave === chave ? { ...p, ...patch, ...(patch.parcelas && patch.parcelas !== '1' ? { pago: false } : {}) } : p)));

    const createMut = trpc.vendas.create.useMutation({
        onSuccess: (r: any) => {
            toast({ title: 'Venda lançada', variant: 'success' });
            onCreated(r.id);
            onOpenChange(false);
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function lancar() {
        if (!escolha) return;
        const hoje = hojeISO();
        createMut.mutate({
            id_pessoa: idPessoa,
            id_profissional: idProfissional,
            data_venda: hoje,
            itens: [{ id_servico: escolha.id_servico, id_pacote: escolha.id_pacote, quantidade_sessoes: Number(sessoes) || 1, valor: total / 100 }],
            pagamentos: pagamentos.map((p) => ({
                id_forma_pagamento: Number(p.id_forma),
                valor: paraCentavos(p.valor) / 100,
                parcelas: Number(p.parcelas) || 1,
                primeiro_vencimento: hoje,
                pago: p.pago && p.parcelas === '1',
            })),
        });
    }

    const valido = !!escolha && total > 0 && Number(sessoes) > 0 && falta === 0 && pagamentos.every((p) => p.id_forma && paraCentavos(p.valor) > 0 && Number(p.parcelas) > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Vender para {pessoaNome.split(' ')[0]}</DialogTitle>
                </DialogHeader>

                <div className="space-y-5">
                    {!escolha ? (
                        <div className="rounded-lg border">
                            <div className="flex items-center gap-2 border-b px-3">
                                <Search className="h-4 w-4 shrink-0 text-gray-400" />
                                <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pacote ou serviço…"
                                    className="h-10 w-full bg-transparent text-sm outline-none" />
                            </div>
                            <ul className="max-h-64 overflow-y-auto py-1">
                                {catalogo.map((x) => (
                                    <li key={x.chave}>
                                        <button type="button" onClick={() => escolher(x)}
                                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]">
                                            {x.pacote ? <Package className="h-4 w-4 shrink-0 text-blue-600" /> : <span className="w-4 shrink-0" />}
                                            <span className="min-w-0 flex-1">{x.nome}</span>
                                            <span className="shrink-0 text-xs tabular-nums text-gray-500">{x.pacote ? `${x.sessoes} sessões · ` : ''}{brl(x.centavos)}</span>
                                        </button>
                                    </li>
                                ))}
                                {!catalogo.length && <li className="px-3 py-3 text-sm text-gray-500">Nada com esse nome.</li>}
                            </ul>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3 rounded-lg border p-3">
                                <div className="flex items-start gap-2">
                                    {escolha.pacote && <Package className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />}
                                    <p className="min-w-0 flex-1 text-sm font-medium">{escolha.nome}</p>
                                    <button type="button" onClick={() => setEscolha(null)} className="text-xs text-[hsl(var(--primary))] hover:underline">trocar</button>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="space-y-1 text-xs text-gray-500">
                                        Sessões
                                        <Input type="number" min={1} inputMode="numeric" value={sessoes} onChange={(e) => setSessoes(e.target.value)} />
                                    </label>
                                    <label className="space-y-1 text-xs text-gray-500">
                                        Valor (R$)
                                        <Input inputMode="decimal" value={valor} onChange={(e) => mudarValor(e.target.value)} />
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label>Pagamento</Label>
                                {pagamentos.map((p) => (
                                    <div key={p.chave} className="space-y-2 rounded-lg border p-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <select aria-label="Forma de pagamento" className={cn(selectCls, 'col-span-2 sm:col-span-1')} value={p.id_forma}
                                                onChange={(e) => alterar(p.chave, { id_forma: e.target.value })}>
                                                <option value="">Forma…</option>
                                                {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                            </select>
                                            <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                                                <Input type="number" min={1} max={48} inputMode="numeric" aria-label="Parcelas" className="w-16" value={p.parcelas}
                                                    onChange={(e) => alterar(p.chave, { parcelas: e.target.value })} />
                                                <span className="text-sm text-gray-500">{p.parcelas === '1' ? 'à vista' : 'parcelas'}</span>
                                                {pagamentos.length > 1 && (
                                                    <Input inputMode="decimal" aria-label="Valor desta forma" value={p.valor}
                                                        onChange={(e) => alterar(p.chave, { valor: maskMoney(e.target.value) })} />
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            {p.parcelas === '1' ? (
                                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                                    <input type="checkbox" checked={p.pago} onChange={(e) => alterar(p.chave, { pago: e.target.checked })} />
                                                    Já recebido
                                                </label>
                                            ) : (
                                                <span className="text-xs text-gray-500">
                                                    {p.parcelas}x de {brl(Math.floor(paraCentavos(p.valor) / (Number(p.parcelas) || 1)))}, 1ª hoje
                                                </span>
                                            )}
                                            {pagamentos.length > 1 && (
                                                <button type="button" className="text-xs text-red-600 hover:underline"
                                                    onClick={() => setPagamentos((ps) => ps.filter((x) => x.chave !== p.chave))}>Tirar</button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <button type="button" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline"
                                        onClick={() => setPagamentos((ps) => [...ps, { chave: Date.now(), id_forma: '', valor: mascara(Math.max(falta, 0)), parcelas: '1', pago: false }])}>
                                        <Plus className="h-4 w-4" /> Dividir em outra forma
                                    </button>
                                    {pagamentos.length > 1 && (
                                        <span className={cn('inline-flex items-center gap-1 text-sm font-medium tabular-nums', falta === 0 ? 'text-emerald-700' : 'text-amber-700')}>
                                            {falta === 0 ? <><Check className="h-4 w-4" /> Fecha o total</> : falta > 0 ? `Falta ${brl(falta)}` : `Passou ${brl(-falta)}`}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="mr-1 h-4 w-4 sm:hidden" /> Cancelar
                    </Button>
                    <Button type="button" disabled={!valido || createMut.isPending} onClick={lancar}>
                        {createMut.isPending ? 'Lançando…' : total > 0 ? `Lançar ${brl(total)}` : 'Lançar venda'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
