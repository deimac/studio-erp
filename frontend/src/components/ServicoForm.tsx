import { useState, useRef, useCallback } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { Upload, ImagePlus } from 'lucide-react';
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
    const [uploading, setUploading] = useState(false);
    const [dragging, setDragging] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const tecnicasQ = trpc.tecnicas.list.useQuery();

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
            setImagemUrl(servico.imagem_url ?? '');
            setDuracao(String(servico.duracao_minutos));
            setValor(formatAmountToMask(servico.valor));
            setGeraCredito(servico.gera_credito);
            setAtivo(servico.ativo);
            setTecnicaIds(servico.tecnicas?.map((t) => t.id) ?? []);
        } else {
            setNome(''); setDescricao(''); setImagemUrl(''); setDuracao('60'); setValor(''); setGeraCredito(true); setAtivo(true); setTecnicaIds([]);
        }
        setOpen(true);
    }

    async function handleUpload(file: File) {
        if (!file.type.startsWith('image/')) {
            toast({ title: 'Apenas imagens são permitidas', variant: 'error' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast({ title: 'Imagem deve ter no máximo 5 MB', variant: 'error' });
            return;
        }
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: fd,
                headers: { Authorization: `Bearer ${localStorage.getItem('studio_erp_token')}` },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error ?? 'Upload falhou');
            }
            const data = await res.json();
            setImagemUrl(data.url);
            toast({ title: 'Imagem enviada!', variant: 'success' });
        } catch (e: any) {
            toast({ title: e?.message ?? 'Erro ao enviar imagem', variant: 'error' });
        } finally {
            setUploading(false);
        }
    }

    const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
    const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(false); }, []);
    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    }, []);

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

                        {/* Image upload with drag & drop */}
                        <div>
                            <Label>Imagem</Label>
                            <div
                                className={`mt-1 rounded-lg border-2 border-dashed p-4 transition-colors text-center cursor-pointer ${dragging
                                    ? 'border-[hsl(var(--primary))] bg-blue-50'
                                    : imagemUrl
                                        ? 'border-transparent bg-gray-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                onClick={() => !uploading && fileRef.current?.click()}
                            >
                                {imagemUrl ? (
                                    <div className="flex items-center gap-4">
                                        <img src={imagemUrl} alt="Preview" className="h-20 w-20 rounded-lg object-cover border shadow-sm" />
                                        <div className="flex flex-col gap-1 text-left">
                                            <p className="text-sm font-medium text-gray-700">Imagem selecionada</p>
                                            <p className="text-xs text-gray-400">Clique ou arraste para trocar</p>
                                            <Button
                                                type="button" size="sm" variant="ghost"
                                                className="text-xs text-red-500 w-fit px-0 h-auto"
                                                onClick={(e) => { e.stopPropagation(); setImagemUrl(''); }}
                                            >
                                                Remover imagem
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 py-2">
                                        {uploading ? (
                                            <>
                                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-[hsl(var(--primary))]" />
                                                <p className="text-sm text-gray-500">Enviando…</p>
                                            </>
                                        ) : (
                                            <>
                                                <ImagePlus className="h-8 w-8 text-gray-300" />
                                                <p className="text-sm text-gray-500">Arraste uma imagem aqui ou <span className="text-[hsl(var(--primary))] font-medium">clique para selecionar</span></p>
                                                <p className="text-xs text-gray-400">PNG, JPG ou WEBP • Máx. 5 MB</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Upload de imagem"
                                onChange={(e) => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }} />
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
