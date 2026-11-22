import { useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ListEditor } from '@/components/ui/list-editor';
import { ImageUpload } from '@/components/ImageUpload';
import { useToast } from '@/hooks/useToast';

export type Protocolo = {
    id: number;
    nome: string;
    slug: string;
    subtitulo: string | null;
    descricao: string | null;
    inclui: string[];
    beneficios: string[];
    aviso: string | null;
    frase_final: string | null;
    icone: string | null;
    imagem_url: string | null;
    ordem: number;
    permite_vale_presente: boolean;
    ativo: boolean;
    servicos?: { id: number; nome: string; nome_modalidade: string | null }[];
};

/** Ícones disponíveis no site (nomes do lucide-react). */
export const ICONES_PROTOCOLO = ['Sparkles', 'Feather', 'HandHeart', 'Droplets', 'Flower2', 'Leaf', 'Heart', 'Sun', 'Moon', 'Gem'];

export function ProtocoloForm({ protocolo, onSuccess }: { protocolo?: Protocolo; onSuccess?: () => void }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [f, setF] = useState(() => vazio());

    function vazio() {
        return {
            nome: '', slug: '', subtitulo: '', descricao: '', inclui: [] as string[], beneficios: [] as string[],
            aviso: '', frase_final: '', icone: 'Sparkles', imagem_url: '', permite_vale_presente: false, ativo: true,
        };
    }

    const set = <K extends keyof ReturnType<typeof vazio>>(k: K, v: ReturnType<typeof vazio>[K]) => setF((prev) => ({ ...prev, [k]: v }));

    const opts = {
        onSuccess: () => { setOpen(false); onSuccess?.(); },
        onError: (e: any) => toast({ title: e.message, variant: 'error' as const }),
    };
    const createMut = trpc.protocolos.create.useMutation(opts);
    const updateMut = trpc.protocolos.update.useMutation(opts);

    function handleOpen() {
        setF(protocolo ? {
            nome: protocolo.nome, slug: protocolo.slug, subtitulo: protocolo.subtitulo ?? '', descricao: protocolo.descricao ?? '',
            inclui: protocolo.inclui, beneficios: protocolo.beneficios, aviso: protocolo.aviso ?? '', frase_final: protocolo.frase_final ?? '',
            icone: protocolo.icone ?? 'Sparkles', imagem_url: protocolo.imagem_url ?? '',
            permite_vale_presente: protocolo.permite_vale_presente, ativo: protocolo.ativo,
        } : vazio());
        setOpen(true);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (f.nome.trim().length < 2) {
            toast({ title: 'Informe o nome do protocolo', variant: 'error' });
            return;
        }
        const limpa = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
        const data = {
            nome: f.nome.trim(),
            slug: f.slug.trim() || undefined,
            subtitulo: f.subtitulo.trim() || null,
            descricao: f.descricao.trim() || null,
            inclui: limpa(f.inclui),
            beneficios: limpa(f.beneficios),
            aviso: f.aviso.trim() || null,
            frase_final: f.frase_final.trim() || null,
            icone: f.icone || null,
            imagem_url: f.imagem_url || null,
            permite_vale_presente: f.permite_vale_presente,
            ativo: f.ativo,
        };
        if (protocolo) updateMut.mutate({ id: protocolo.id, ...data });
        else createMut.mutate(data);
    }

    const isPending = createMut.isPending || updateMut.isPending;

    return (
        <>
            <Button size="sm" variant={protocolo ? 'ghost' : 'default'} onClick={handleOpen}>
                {protocolo ? 'Editar' : 'Novo Protocolo'}
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-full max-w-2xl px-6">
                    <DialogHeader>
                        <DialogTitle>{protocolo ? 'Editar Protocolo' : 'Novo Protocolo'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto px-1 pr-2">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <Label>Nome *</Label>
                                <Input value={f.nome} onChange={(e) => set('nome', e.target.value)} autoFocus />
                            </div>
                            <div>
                                <Label>Endereço no site</Label>
                                <Input value={f.slug} onChange={(e) => set('slug', e.target.value)} placeholder="gerado a partir do nome" />
                                <p className="mt-1 text-xs text-gray-400">/protocolos/{f.slug || '…'}</p>
                            </div>
                        </div>
                        <div>
                            <Label>Subtítulo</Label>
                            <Input value={f.subtitulo} onChange={(e) => set('subtitulo', e.target.value)} placeholder="Ex.: Leveza, conforto e cuidado individualizado." />
                        </div>
                        <div>
                            <Label>Descrição</Label>
                            <Textarea rows={5} value={f.descricao} onChange={(e) => set('descricao', e.target.value)} />
                            <p className="mt-1 text-xs text-gray-400">Deixe uma linha em branco para separar parágrafos.</p>
                        </div>
                        <div>
                            <Label>Imagem principal</Label>
                            <ImageUpload value={f.imagem_url} onChange={(url) => set('imagem_url', url)} hint="Vertical (4:5) fica melhor • Máx. 5 MB" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label>O que inclui</Label>
                                <ListEditor value={f.inclui} onChange={(v) => set('inclui', v)} />
                            </div>
                            <div>
                                <Label>Benefícios</Label>
                                <ListEditor value={f.beneficios} onChange={(v) => set('beneficios', v)} />
                            </div>
                        </div>
                        <div>
                            <Label>Aviso legal</Label>
                            <Textarea rows={3} value={f.aviso} onChange={(e) => set('aviso', e.target.value)} />
                        </div>
                        <div>
                            <Label>Frase final</Label>
                            <Input value={f.frase_final} onChange={(e) => set('frase_final', e.target.value)} />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <Label>Ícone</Label>
                                <select
                                    className="mt-1 h-9 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                                    value={f.icone}
                                    onChange={(e) => set('icone', e.target.value)}
                                >
                                    {ICONES_PROTOCOLO.map((i) => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col justify-end gap-2 pb-1">
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={f.permite_vale_presente} onChange={(e) => set('permite_vale_presente', e.target.checked)} />
                                    Disponível como vale-presente
                                </label>
                                <label className="flex items-center gap-2 text-sm">
                                    <input type="checkbox" checked={f.ativo} onChange={(e) => set('ativo', e.target.checked)} />
                                    Ativo (aparece no site)
                                </label>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            Modalidades, preços e pacotes são os <strong>Serviços</strong> vinculados a este protocolo (menu Serviços → campo "Protocolo").
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? 'Salvando…' : 'Salvar'}</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
