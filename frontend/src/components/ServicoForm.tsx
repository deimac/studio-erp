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
import { useAuth } from '@/hooks/useAuth';

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
    id_profissional?: number | null;
    profissional_nome?: string | null;
};

export function ServicoForm({
    servico,
    onSuccess,
    trigger,
    idProtocoloPadrao,
    variant,
}: {
    servico?: Servico;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
    /** Ao criar dentro de um protocolo, já vem selecionado. */
    idProtocoloPadrao?: number;
    variant?: 'default' | 'ghost' | 'outline';
}) {
    const { toast } = useToast();
    const { isAdmin } = useAuth();
    const [open, setOpen] = useState(false);
    /** Só o admin decide o que vai para o site (exige um protocolo). */
    const [noSite, setNoSite] = useState(false);
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
            setNoSite(!!servico.id_protocolo);
        } else {
            setNome(''); setDescricao(''); setImagemUrl(''); setDuracao('60'); setValor(''); setGeraCredito(true); setAtivo(true); setTecnicaIds([]);
            setIdProtocolo(idProtocoloPadrao ? String(idProtocoloPadrao) : ''); setNomeModalidade(''); setRegioes([]); setOrdemModalidade('0');
            setNoSite(!!idProtocoloPadrao);
        }
        setOpen(true);
    }

    const protocoloSelecionado = noSite
        ? (protocolosQ.data?.find((p: any) => String(p.id) === idProtocolo) as { nome: string } | undefined)
        : undefined;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        // Dentro de um protocolo, o nome usado em vendas/financeiro pode ser gerado: "Protocolo – Modalidade"
        let nomeFinal = nome.trim();
        if (!nomeFinal && protocoloSelecionado && nomeModalidade.trim()) {
            nomeFinal = `${protocoloSelecionado.nome} – ${nomeModalidade.trim()}`;
        }
        if (isAdmin && noSite && !idProtocolo) {
            toast({ title: 'Escolha o protocolo onde o serviço aparece no site', variant: 'error' });
            return;
        }
        if (!nomeFinal) {
            toast({ title: 'Informe o nome do serviço', variant: 'error' });
            return;
        }
        if (nomeFinal.length < 2) {
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
            nome: nomeFinal,
            descricao: descricao.trim() || undefined,
            imagem_url: imagemUrl || undefined,
            duracao_minutos: Number(duracao),
            valor: valorNumerico,
            gera_credito: geraCredito,
            ativo,
            tecnica_ids: tecnicaIds,
            // Campos do site só são enviados pelo admin
            ...(isAdmin
                ? {
                      id_protocolo: noSite && idProtocolo ? Number(idProtocolo) : null,
                      nome_modalidade: noSite ? nomeModalidade.trim() || null : null,
                      regioes: noSite ? regioes.map((r) => r.trim()).filter(Boolean) : [],
                      ordem_modalidade: noSite ? Number(ordemModalidade) || 0 : 0,
                  }
                : {}),
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
            <Button size="sm" variant={variant ?? (servico ? 'ghost' : 'default')} onClick={handleOpen}>
                {trigger ?? (servico ? 'Editar' : 'Novo Serviço')}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-full max-w-xl px-6">
                    <DialogHeader>
                        <DialogTitle>
                            {servico ? 'Editar Serviço' : protocoloSelecionado && idProtocoloPadrao ? `Nova modalidade — ${protocoloSelecionado.nome}` : 'Novo Serviço'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 min-h-[400px] max-h-[80vh] overflow-y-auto pr-1">
                        {servico?.id_profissional && (
                            <p className="rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-700">
                                Serviço próprio de <strong>{servico.profissional_nome ?? 'profissional'}</strong>{isAdmin ? '' : ' (seu)'}.
                            </p>
                        )}

                        {/* Site público: só o admin publica */}
                        {isAdmin ? (
                        <div className="rounded-lg border border-dashed p-3 space-y-3">
                            <label className="flex cursor-pointer items-start gap-2 text-sm">
                                <input type="checkbox" className="mt-0.5 rounded" checked={noSite} onChange={(e) => setNoSite(e.target.checked)} />
                                <span>
                                    <span className="font-medium">Exibir no site</span>
                                    <span className="block text-xs text-gray-500">Desmarcado, o serviço fica só no sistema (vendas e agenda).</span>
                                </span>
                            </label>
                            {noSite && (<>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <Label>Protocolo (página no site) *</Label>
                                    <select
                                        className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                                        value={idProtocolo}
                                        onChange={(e) => setIdProtocolo(e.target.value)}
                                    >
                                        <option value="">Escolha o protocolo…</option>
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
                            </>)}
                        </div>
                        ) : (
                            <p className="text-xs text-gray-500">Seus serviços ficam só no sistema (vendas e agenda) e não aparecem no site.</p>
                        )}

                        <div className="px-1">
                            <Label>Nome nas vendas{protocoloSelecionado ? '' : ' *'}</Label>
                            <Input
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder={protocoloSelecionado && nomeModalidade ? `${protocoloSelecionado.nome} – ${nomeModalidade}` : ''}
                            />
                            {protocoloSelecionado && <p className="mt-1 text-xs text-gray-400">Em branco, usa "Protocolo – Modalidade".</p>}
                        </div>
                        <div className="px-1">
                            <Label>Descrição</Label>
                            <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                        </div>

                        <div>
                            <Label>Imagem</Label>
                            <ImageUpload value={imagemUrl} onChange={setImagemUrl} />
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
