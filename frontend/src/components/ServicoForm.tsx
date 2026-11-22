import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { ImageUpload } from '@/components/ImageUpload';
import { ListEditor } from '@/components/ui/list-editor';
import { resolveImageUrl } from '@/lib/media';
import { maskMoney } from '@/lib/masks';

type Servico = {
    id: number;
    nome: string;
    descricao?: string | null;
    imagem_url?: string | null;
    duracao_minutos: number;
    valor: string | number;
    gera_credito: boolean;
    ativo: boolean;
    tecnicas?: { id: number; nome: string }[];
    id_protocolo?: number | null;
    nome_modalidade?: string | null;
    regioes?: string[];
    ordem_modalidade?: number;
};

export function ServicoForm({
    servico,
    onSuccess,
    trigger,
}: {
    servico?: Servico;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [imagemUrl, setImagemUrl] = useState('');
    const [duracao, setDuracao] = useState('60');
    const [valor, setValor] = useState('');
    const [geraCredito, setGeraCredito] = useState(true);
    const [ativo, setAtivo] = useState(true);
    const [tecnicaIds, setTecnicaIds] = useState<number[]>([]);
    const [idProtocolo, setIdProtocolo] = useState('');
    const [nomeModalidade, setNomeModalidade] = useState('');
    const [regioes, setRegioes] = useState<string[]>([]);
    const [ordemModalidade, setOrdemModalidade] = useState('0');

    const tecnicasQ = trpc.tecnicas.list.useQuery();
    const protocolosQ = trpc.protocolos.list.useQuery(undefined, { enabled: open });

    const createMut = trpc.servicos.create.useMutation({
        onSuccess: () => { setOpen(false); onSuccess?.(); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });
    const updateMut = trpc.servicos.update.useMutation({
        onSuccess: () => { setOpen(false); onSuccess?.(); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function formatAmountToMask(value: string | number) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '';
        const cents = Math.round(amount * 100);
        return maskMoney(String(cents));
    }

    function handleOpen() {
        if (servico) {
            setNome(servico.nome);
            setDescricao(servico.descricao ?? '');
            setImagemUrl(resolveImageUrl(servico.imagem_url));
            setDuracao(String(servico.duracao_minutos));
            setValor(formatAmountToMask(servico.valor));
            setGeraCredito(servico.gera_credito);
            setAtivo(servico.ativo);
            setTecnicaIds(servico.tecnicas?.map((t) => t.id) ?? []);
            setIdProtocolo(servico.id_protocolo ? String(servico.id_protocolo) : '');
            setNomeModalidade(servico.nome_modalidade ?? '');
            setRegioes(servico.regioes ?? []);
            setOrdemModalidade(String(servico.ordem_modalidade ?? 0));
        } else {
            setNome(''); setDescricao(''); setImagemUrl(''); setDuracao('60'); setValor(''); setGeraCredito(true); setAtivo(true); setTecnicaIds([]);
            setIdProtocolo(''); setNomeModalidade(''); setRegioes([]); setOrdemModalidade('0');
        }
        setOpen(true);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!nome.trim()) {
            toast({ title: 'Informe o nome do serviço', variant: 'error' });
            return;
        }
        if (nome.trim().length < 2) {
            toast({ title: 'O nome deve ter pelo menos 2 caracteres', variant: 'error' });
            return;
        }
        if (!duracao || Number(duracao) < 1) {
            toast({ title: 'Informe uma duração válida (mínimo 1 minuto)', variant: 'error' });
            return;
        }
        const valorNumerico = Number(valor.replace(/\./g, '').replace(',', '.'));
        if (!valor || valorNumerico < 0.01) {
            toast({ title: 'Informe um valor válido (mínimo R$ 0,01)', variant: 'error' });
            return;
        }
        const data = {
            nome: nome.trim(),
            descricao: descricao.trim() || undefined,
            imagem_url: imagemUrl || undefined,
            duracao_minutos: Number(duracao),
            valor: valorNumerico,
            gera_credito: geraCredito,
            ativo,
            tecnica_ids: tecnicaIds,
            id_protocolo: idProtocolo ? Number(idProtocolo) : null,
            nome_modalidade: nomeModalidade.trim() || null,
            regioes: regioes.map((r) => r.trim()).filter(Boolean),
            ordem_modalidade: Number(ordemModalidade) || 0,
        };
        if (servico) {
            updateMut.mutate({ id: servico.id, ...data });
        } else {
            createMut.mutate(data);
        }
    }

    const isPending = createMut.isPending || updateMut.isPending;

    return (
        <>
            <Button size="sm" variant={servico ? 'ghost' : 'default'} onClick={handleOpen}>
                {trigger ?? (servico ? 'Editar' : 'Novo Serviço')}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-full max-w-xl px-6">
                    <DialogHeader>
                        <DialogTitle>{servico ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 min-h-[400px] max-h-[80vh] overflow-y-auto pr-1">
                        <div className="px-1">
                            <Label>Nome *</Label>
                            <Input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
                        </div>
                        <div className="px-1">
                            <Label>Descrição</Label>
                            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                        </div>

                        <div>
                            <Label>Imagem</Label>
                            <ImageUpload value={imagemUrl} onChange={setImagemUrl} />
                        </div>

                        {/* Modalidade de protocolo (site público) */}
                        <div className="rounded-lg border border-dashed p-3 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Site público — modalidade de protocolo</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <Label>Protocolo</Label>
                                    <select
                                        className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                                        value={idProtocolo}
                                        onChange={(e) => setIdProtocolo(e.target.value)}
                                    >
                                        <option value="">— Nenhum —</option>
                                        {protocolosQ.data?.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.nome}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <Label>Nome da modalidade</Label>
                                    <Input value={nomeModalidade} onChange={(e) => setNomeModalidade(e.target.value)} placeholder="Ex.: Pernas, Foco Regional" />
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                                <div>
                                    <Label>Regiões / observações</Label>
                                    <ListEditor value={regioes} onChange={setRegioes} placeholder="Ex.: Pescoço e cervical." />
                                </div>
                                <div>
                                    <Label>Ordem</Label>
                                    <Input type="number" value={ordemModalidade} onChange={(e) => setOrdemModalidade(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-4 grid-cols-2 px-1">
                            <div>
                                <Label>Duração (min) *</Label>
                                <Input type="number" value={duracao} onChange={(e) => setDuracao(e.target.value)} />
                            </div>
                            <div>
                                <Label>Valor (R$) *</Label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    value={valor}
                                    onChange={e => setValor(maskMoney(e.target.value))}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={geraCredito} onChange={(e) => setGeraCredito(e.target.checked)} className="rounded" />
                                Gera crédito
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded" />
                                Ativo
                            </label>
                        </div>

                        {/* Técnicas */}
                        {tecnicasQ.data && tecnicasQ.data.length > 0 && (
                            <div>
                                <Label>Técnicas</Label>
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {tecnicasQ.data.map((t) => {
                                        const checked = tecnicaIds.includes(t.id);
                                        return (
                                            <label key={t.id} className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm cursor-pointer transition-colors ${checked ? 'bg-[hsl(var(--primary))] text-white border-transparent' : 'hover:bg-gray-50'}`}>
                                                <input type="checkbox" className="sr-only" checked={checked}
                                                    onChange={() => setTecnicaIds((prev) => checked ? prev.filter((id) => id !== t.id) : [...prev, t.id])} />
                                                {t.nome}
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

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
