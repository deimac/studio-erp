import { useEffect, useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { SeletorBusca } from '@/components/TecnicasSelect';
import { ServicoForm } from '@/components/ServicoForm';
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
    tecnicas_ocultas?: number[];
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
    const [servicoIds, setServicoIds] = useState<number[]>([]);
    const [ocultas, setOcultas] = useState<number[]>([]);
    const [novoServico, setNovoServico] = useState<string | null>(null);
    const utils = trpc.useUtils();
    const servicosQ = trpc.servicos.list.useQuery({ apenasAtivos: false }, { enabled: open });
    const paginasQ = trpc.protocolos.list.useQuery(undefined, { enabled: open });
    type ItemServico = { id: number; nome: string; tipo?: string };
    const servicosDaPagina = servicoIds
        .map((id) => ((servicosQ.data ?? []) as any[]).find((s) => s.id === id))
        .filter(Boolean) as { id: number; nome: string; nome_modalidade?: string | null; tecnicas?: ItemServico[] }[];
    /** Técnicas e benefícios marcados nos serviços desta página (sem repetir, na ordem do cadastro, como no site). */
    const tecnicasDosServicos = servicosDaPagina
        .flatMap((s) => s.tecnicas ?? [])
        .filter((t, i, l) => l.findIndex((x) => x.id === t.id) === i)
        .sort((a, b) => a.id - b.id);
    /**
     * Com mais de um serviço, separa os itens por serviço: o que está em todos
     * fica junto em "Todos os serviços"; o resto, sob o(s) serviço(s) que o têm.
     */
    function agruparPorServico(itens: ItemServico[]) {
        if (servicosDaPagina.length < 2) return [{ titulo: null as string | null, itens }];
        const nomeCurto = (s: (typeof servicosDaPagina)[number]) => s.nome_modalidade || s.nome;
        const grupos = new Map<string, { titulo: string; itens: ItemServico[] }>();
        for (const t of itens) {
            const donos = servicosDaPagina.filter((s) => (s.tecnicas ?? []).some((x) => x.id === t.id));
            const chave = donos.map((s) => s.id).join(',');
            const titulo = donos.length === servicosDaPagina.length ? 'Todos os serviços' : donos.map(nomeCurto).join(' e ');
            if (!grupos.has(chave)) grupos.set(chave, { titulo, itens: [] });
            grupos.get(chave)!.itens.push(t);
        }
        // "Todos os serviços" primeiro, depois na ordem dos serviços
        return [...grupos.entries()]
            .sort(([a], [b]) => (b.split(',').length - a.split(',').length) || (servicoIds.indexOf(Number(a.split(',')[0])) - servicoIds.indexOf(Number(b.split(',')[0]))))
            .map(([, g]) => g);
    }
    const nomePagina = (id: number | null) => ((paginasQ.data ?? []) as any[]).find((p) => p.id === id)?.nome as string | undefined;

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
        setServicoIds(protocolo?.servicos?.map((s) => s.id) ?? []);
        setOcultas(protocolo?.tecnicas_ocultas ?? []);
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
        const data = {
            nome: f.nome.trim(),
            slug: f.slug.trim() || undefined,
            subtitulo: f.subtitulo.trim() || null,
            descricao: f.descricao.trim() || null,
            aviso: f.aviso.trim() || null,
            frase_final: f.frase_final.trim() || null,
            icone: f.icone || null,
            imagem_url: f.imagem_url || null,
            permite_vale_presente: f.permite_vale_presente,
            ativo: f.ativo,
            servico_ids: servicoIds,
            // Só manda quando a lista de serviços carregou (senão perderia as desmarcadas)
            tecnicas_ocultas: servicosQ.data ? ocultas.filter((id) => tecnicasDosServicos.some((t) => t.id === id)) : undefined,
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
                        <div>
                            <Label>Serviços nesta página</Label>
                            <p className="mb-1.5 text-xs text-gray-500">Os preços e pacotes deles aparecem abaixo da página, no site.</p>
                            <SeletorBusca
                                itens={((servicosQ.data ?? []) as any[]).map((s) => ({ id: s.id, nome: s.nome, id_protocolo: s.id_protocolo }))}
                                value={servicoIds} onChange={setServicoIds}
                                rotuloEscolher="Adicionar serviço" placeholder="Buscar serviço…" vazio="Nenhum serviço com esse nome."
                                detalhe={(s: any) => (s.id_protocolo && s.id_protocolo !== protocolo?.id && !servicoIds.includes(s.id) ? `em ${nomePagina(s.id_protocolo) ?? 'outra página'}` : undefined)}
                                onNovo={(nome) => setNovoServico(nome)} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {([['TECNICA', 'Técnicas aplicadas', 'técnicas'], ['BENEFICIO', 'Benefícios', 'benefícios']] as const).map(([tipo, titulo, nomeTipo]) => {
                                const itens = tecnicasDosServicos.filter((t) => (t.tipo ?? 'TECNICA') === tipo);
                                return (
                                    <div key={tipo}>
                                        <Label>{titulo}</Label>
                                        {itens.length > 0 ? (
                                            <div className="mt-1 space-y-1">
                                                {agruparPorServico(itens).map((g) => (
                                                    <div key={g.titulo ?? 'todos'} className={cn(g.titulo && 'pt-1')}>
                                                        {g.titulo && <p className="px-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{g.titulo}</p>}
                                                        {g.itens.map((t) => (
                                                            <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-gray-50">
                                                                <input type="checkbox" checked={!ocultas.includes(t.id)}
                                                                    onChange={(e) => setOcultas((l) => (e.target.checked ? l.filter((x) => x !== t.id) : [...l, t.id]))} />
                                                                {t.nome}
                                                            </label>
                                                        ))}
                                                    </div>
                                                ))}
                                                <p className="px-1 text-xs text-gray-500">Vêm dos serviços desta página. Desmarque o que não quer mostrar.</p>
                                            </div>
                                        ) : (
                                            <p className="mt-1 text-xs text-gray-500">Marque {nomeTipo} nos serviços desta página para aparecerem aqui.</p>
                                        )}
                                    </div>
                                );
                            })}
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
                        <Rodape>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? 'Salvando…' : 'Salvar'}</Button>
                        </Rodape>
                    </form>
                    {novoServico !== null && (
                        <ServicoForm modo="painel" semSite open nomeInicial={novoServico}
                            onOpenChange={(v) => { if (!v) setNovoServico(null); }}
                            onSuccess={(id) => { utils.servicos.list.invalidate(); setServicoIds((l) => [...l, id]); }} />
                    )}
                </Conteudo>
            </Raiz>
        </>
    );
}
