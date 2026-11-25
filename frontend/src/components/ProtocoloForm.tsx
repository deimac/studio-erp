import { useEffect, useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { ListEditor } from '@/components/ui/list-editor';
import { ImageUpload } from '@/components/ImageUpload';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { Droplets, Feather, Flower2, Gem, HandHeart, Heart, Leaf, Moon, Sparkles, Sun, type LucideIcon } from 'lucide-react';

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
export const ICONES_PROTOCOLO = ['Sparkles', 'Feather', 'HandHeart', 'Droplets', 'Flower2', 'Leaf', 'Heart', 'Sun', 'Moon', 'Gem'] as const;

const ICONES_INFO: Record<(typeof ICONES_PROTOCOLO)[number], { Icone: LucideIcon; rotulo: string }> = {
    Sparkles: { Icone: Sparkles, rotulo: 'Brilho' },
    Feather: { Icone: Feather, rotulo: 'Pena' },
    HandHeart: { Icone: HandHeart, rotulo: 'Mão com coração' },
    Droplets: { Icone: Droplets, rotulo: 'Gotas' },
    Flower2: { Icone: Flower2, rotulo: 'Flor' },
    Leaf: { Icone: Leaf, rotulo: 'Folha' },
    Heart: { Icone: Heart, rotulo: 'Coração' },
    Sun: { Icone: Sun, rotulo: 'Sol' },
    Moon: { Icone: Moon, rotulo: 'Lua' },
    Gem: { Icone: Gem, rotulo: 'Joia' },
};

type Props = {
    protocolo?: Protocolo;
    /** Recebe o id da página salva (na criação, o id novo). */
    onSuccess?: (id: number) => void;
    trigger?: React.ReactNode;
    /** 'painel': abre pela direita, sem botão próprio, controlado por `open`. */
    modo?: 'dialog' | 'painel';
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    nomeInicial?: string;
};

export function ProtocoloForm({ protocolo, onSuccess, trigger, modo = 'dialog', open: openProp, onOpenChange, nomeInicial }: Props) {
    const { toast } = useToast();
    const [openLocal, setOpenLocal] = useState(false);
    const controlado = openProp !== undefined;
    const open = controlado ? openProp : openLocal;
    const setOpen = (v: boolean) => { if (!controlado) setOpenLocal(v); onOpenChange?.(v); };
    const [f, setF] = useState(() => vazio());

    function vazio() {
        return {
            nome: '', slug: '', subtitulo: '', descricao: '', inclui: [] as string[], beneficios: [] as string[],
            aviso: '', frase_final: '', icone: 'Sparkles', imagem_url: '', permite_vale_presente: false, ativo: true,
        };
    }

    const set = <K extends keyof ReturnType<typeof vazio>>(k: K, v: ReturnType<typeof vazio>[K]) => setF((prev) => ({ ...prev, [k]: v }));

    const opts = {
        onSuccess: (r: { id?: number } | { ok: boolean }) => {
            setOpen(false);
            onSuccess?.(protocolo?.id ?? ('id' in r ? r.id ?? 0 : 0));
        },
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
        } : { ...vazio(), nome: nomeInicial ?? '' });
        setOpen(true);
    }

    // Aberto de fora (modo painel): começa com os dados certos
    useEffect(() => {
        if (controlado && openProp) handleOpen();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openProp]);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (f.nome.trim().length < 2) {
            toast({ title: 'Informe o nome da página', variant: 'error' });
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

    const painel = modo === 'painel';
    const Raiz = painel ? Sheet : Dialog;
    const Conteudo = painel ? SheetContent : DialogContent;
    const Cabecalho = painel ? SheetHeader : DialogHeader;
    const Titulo = painel ? SheetTitle : DialogTitle;
    const Rodape = painel ? SheetFooter : DialogFooter;

    return (
        <>
            {!painel && (
                <Button size="sm" variant={protocolo ? 'ghost' : 'outline'} onClick={handleOpen}>
                    {trigger ?? (protocolo ? 'Editar página' : 'Nova página do site')}
                </Button>
            )}
            <Raiz open={open} onOpenChange={setOpen}>
                <Conteudo className={painel ? undefined : 'sm:max-w-2xl'}>
                    <Cabecalho>
                        <Titulo>{protocolo ? `Página do site: ${protocolo.nome}` : 'Nova página do site'}</Titulo>
                    </Cabecalho>
                    <form onSubmit={(e) => { e.stopPropagation(); handleSubmit(e); }} className={cn('space-y-4 px-1 pr-2', !painel && 'max-h-[75vh] overflow-y-auto')}>
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
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <Label>Ícone</Label>
                                <div role="radiogroup" aria-label="Ícone" className="mt-1.5 grid grid-cols-5 gap-2">
                                    {ICONES_PROTOCOLO.map((nome) => {
                                        const { Icone, rotulo } = ICONES_INFO[nome];
                                        const ativo = f.icone === nome;
                                        return (
                                            <button key={nome} type="button" role="radio" aria-checked={ativo} aria-label={rotulo} title={rotulo}
                                                onClick={() => set('icone', nome)}
                                                className={cn('flex aspect-square items-center justify-center rounded-lg border transition-colors',
                                                    ativo ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] ring-1 ring-[hsl(var(--primary))]' : 'text-gray-600 hover:bg-gray-50')}>
                                                <Icone className="h-5 w-5" />
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="mt-1 text-xs text-gray-500">{ICONES_INFO[f.icone as keyof typeof ICONES_INFO]?.rotulo ?? ''}</p>
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
                        {!painel && (
                            <p className="text-xs text-gray-500">
                                Serviços, preços e pacotes ficam logo abaixo da página, na tela de Serviços (botão "+ Serviço").
                            </p>
                        )}
                        <Rodape>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? 'Salvando…' : 'Salvar'}</Button>
                        </Rodape>
                    </form>
                </Conteudo>
            </Raiz>
        </>
    );
}
