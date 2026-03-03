import { useState, useRef } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/useToast';

export function AtendimentoForm({ onSuccess }: { onSuccess?: () => void }) {
    // Alerta customizado para data inválida
    // Validação só com toast, sem alert JS
    function validarDataSelecionada(value: string) {
        const hoje = new Date().toISOString().split('T')[0];
        if (value < hoje) {
            toast({
                title: 'Data inválida',
                description: 'Selecione uma data igual ou maior que hoje.',
                variant: 'error',
            });
            return false;
        }
        return true;
    }
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [idCliente, setIdCliente] = useState<string>('');
    const [clienteSearch, setClienteSearch] = useState('');
    const [idVenda, setIdVenda] = useState<number | ''>('');
    const [idProfissional, setIdProfissional] = useState<number | ''>('');
    const [data, setData] = useState('');
    const dataRef = useRef<HTMLInputElement>(null);
    const [horaInicio, setHoraInicio] = useState('');
    const [horaFim, setHoraFim] = useState('');
    const [observacoes, setObservacoes] = useState('');

    const pessoasQ = trpc.pessoas.list.useQuery();
    const vendasQ = trpc.vendas.list.useQuery({ status: 'ATIVA' });
    const profissionaisQ = trpc.usuarios.list.useQuery();

    const createMut = trpc.atendimentos.create.useMutation({
        onSuccess: () => { setOpen(false); resetForm(); onSuccess?.(); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function resetForm() {
        setIdCliente(''); setClienteSearch(''); setIdVenda(''); setIdProfissional(''); setData(''); setHoraInicio(''); setHoraFim(''); setObservacoes('');
    }

    // Filtrar clientes pela busca
    const filteredClientes = pessoasQ.data?.filter((p: any) => {
        const matchSearch = !clienteSearch || p.nome.toLowerCase().includes(clienteSearch.toLowerCase());
        return matchSearch && p.tipo === 'CLIENTE';
    });

    // Filtrar vendas pelo cliente selecionado
    const filteredVendas = vendasQ.data?.filter((v: any) => {
        if (!idCliente) return true;
        return v.id_pessoa === Number(idCliente);
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!idVenda) {
            toast({ title: 'Selecione uma venda', variant: 'error' });
            return;
        }
        if (!validarDataSelecionada(data)) {
            setData('');
            setTimeout(() => {
                dataRef.current?.focus();
            }, 0);
            return;
        }
        if (!horaInicio) {
            toast({ title: 'Informe a hora de início', variant: 'error' });
            return;
        }
        if (!horaFim) {
            toast({ title: 'Informe a hora de fim', variant: 'error' });
            return;
        }
        createMut.mutate({
            id_venda: Number(idVenda),
            id_profissional: idProfissional ? Number(idProfissional) : undefined,
            data,
            hora_inicio: horaInicio,
            hora_fim: horaFim,
            observacoes: observacoes.trim() || undefined,
        });
    }

    // Removida lógica JS do campo horaInicio/horaFim

    return (
        <>
            <Button size="sm" onClick={() => { resetForm(); setOpen(true); }}>Novo Atendimento</Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Agendar Atendimento</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Cliente (filtro) */}
                        <div className="space-y-1.5">
                            <Label>Cliente</Label>
                            <Select value={idCliente} onValueChange={(v) => { setIdCliente(v); setIdVenda(''); }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrar por cliente…" />
                                </SelectTrigger>
                                <SelectContent>
                                    <div className="p-2">
                                        <Input
                                            placeholder="Buscar…"
                                            value={clienteSearch}
                                            onChange={(e) => setClienteSearch(e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                    {filteredClientes?.map((p: any) => (
                                        <SelectItem key={p.id} value={String(p.id)}>
                                            {p.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Venda */}
                        <div>
                            <Label>Venda *</Label>
                            <select aria-label="Venda" className="w-full rounded-md border px-3 py-2 text-sm" value={idVenda}
                                onChange={(e) => setIdVenda(e.target.value ? Number(e.target.value) : '')}>
                                <option value="">Selecionar…</option>
                                {filteredVendas?.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.pessoa_nome} – {v.servico_nome ?? v.pacote_nome ?? '?'} ({v.quantidade_sessoes} sessões)
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label>Profissional</Label>
                            <select aria-label="Profissional" className="w-full rounded-md border px-3 py-2 text-sm" value={idProfissional}
                                onChange={(e) => setIdProfissional(e.target.value ? Number(e.target.value) : '')}>
                                <option value="">Eu mesmo (padrão)</option>
                                {profissionaisQ.data?.filter((u) => u.ativo && u.perfil === 'PROFISSIONAL').map((u) => (
                                    <option key={u.id} value={u.id}>{u.nome}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <Label>Data *</Label>
                            <Input
                                type="date"
                                value={data}
                                onChange={(e) => setData(e.target.value)}
                                ref={dataRef}
                            />
                        </div>

                        <div className="grid gap-4 grid-cols-2">
                            <div>
                                <Label>Hora Início *</Label>
                                <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                            </div>
                            <div>
                                <Label>Hora Fim *</Label>
                                <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                            </div>
                        </div>

                        <div>
                            <Label>Observações</Label>
                            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={createMut.isPending}>
                                {createMut.isPending ? 'Agendando…' : 'Agendar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
