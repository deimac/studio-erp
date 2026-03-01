import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';

type Pacote = {
    id: number;
    nome: string;
    descricao?: string | null;
    id_servico?: number | null;
    quantidade_sessoes: number;
    valor_total: string | number;
    status?: string | null;
};

export function PacoteForm({
    pacote,
    onSuccess,
    idServico,
    trigger,
}: {
    pacote?: Pacote;
    onSuccess?: () => void;
    idServico?: number;
    trigger?: React.ReactNode;
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [nome, setNome] = useState('');
    const nomeInputRef = useRef<HTMLInputElement>(null);
    const [descricao, setDescricao] = useState('');
    const [servicoId, setServicoId] = useState<number | ''>('');
    const [qtdSessoes, setQtdSessoes] = useState('1');
    const [valorTotal, setValorTotal] = useState('');
    const [status, setStatus] = useState('ATIVO');

    const servicosQ = trpc.servicos.list.useQuery();

    const createMut = trpc.pacotes.create.useMutation({
        onSuccess: () => { setOpen(false); onSuccess?.(); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.pacotes.update.useMutation({
        onSuccess: () => { setOpen(false); onSuccess?.(); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function handleOpen() {
        if (pacote) {
            setNome(pacote.nome);
            setDescricao(pacote.descricao ?? '');
            setServicoId(pacote.id_servico ?? '');
            setQtdSessoes(String(pacote.quantidade_sessoes));
            setValorTotal(String(pacote.valor_total));
            setStatus(pacote.status ?? 'ATIVO');
        } else {
            setNome('');
            setDescricao('');
            setServicoId(idServico ?? '');
            setQtdSessoes('1');
            setValorTotal('');
            setStatus('ATIVO');
        }
        setOpen(true);
    }
    // Foca o input quando o Dialog abrir, posicionando o cursor ao final sem selecionar o texto
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                if (nomeInputRef.current) {
                    nomeInputRef.current.focus();
                    const len = nomeInputRef.current.value.length;
                    nomeInputRef.current.setSelectionRange(len, len);
                }
            }, 100);
        }
    }, [open]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const data = {
            nome: nome.trim(),
            descricao: descricao.trim() || undefined,
            id_servico: servicoId ? Number(servicoId) : undefined,
            quantidade_sessoes: Number(qtdSessoes),
            valor_total: Number(valorTotal),
            status,
        };
        if (pacote) {
            updateMut.mutate({ id: pacote.id, ...data });
        } else {
            createMut.mutate(data);
        }
    }

    const isPending = createMut.isPending || updateMut.isPending;

    return (
        <>
            <Button size="sm" variant={pacote ? 'ghost' : 'default'} onClick={handleOpen}>
                {trigger ?? (pacote ? 'Editar' : 'Novo Pacote')}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{pacote ? 'Editar Pacote' : 'Novo Pacote'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label>Nome *</Label>
                            <Input required minLength={2} value={nome} onChange={(e) => setNome(e.target.value)} ref={nomeInputRef} />
                        </div>
                        <div>
                            <Label>Descrição</Label>
                            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                        </div>
                        <div>
                            <Label>Serviço</Label>
                            <select aria-label="Serviço" className="w-full rounded-md border px-3 py-2 text-sm" value={servicoId} onChange={(e) => setServicoId(e.target.value ? Number(e.target.value) : '')}>
                                <option value="">Selecionar serviço (opcional)</option>
                                {servicosQ.data?.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        </div>
                        <div className="grid gap-4 grid-cols-2">
                            <div>
                                <Label>Qtd. Sessões *</Label>
                                <Input required type="number" min={1} value={qtdSessoes} onChange={(e) => setQtdSessoes(e.target.value)} />
                            </div>
                            <div>
                                <Label>Valor Total (R$) *</Label>
                                <Input required type="number" step="0.01" min="0.01" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <Label>Status</Label>
                            <select aria-label="Status" className="w-full rounded-md border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="ATIVO">Ativo</option>
                                <option value="INATIVO">Inativo</option>
                            </select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? 'Salvando…' : 'Salvar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
