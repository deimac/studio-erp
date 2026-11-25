import { useEffect, useState } from 'react';
import { trpc } from '@/services/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { ImageUpload } from '@/components/ImageUpload';
import { ListEditor } from '@/components/ui/list-editor';
import { resolveImageUrl } from '@/lib/media';
import { maskMoney } from '@/lib/masks';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TecnicasSelect } from '@/components/TecnicasSelect';
import { ProtocoloForm } from '@/components/ProtocoloForm';

/**
 * Formulário do SERVIÇO: o que se vende e agenda (nome, duração, preço da sessão)
 * e os PACOTES dele (N sessões por um preço fechado). Opcionalmente o serviço
 * aparece no site dentro de um PROTOCOLO (só o admin decide).
 */

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

type PacoteLinha = { key: string; id?: number; sessoes: string; valor: string; ativo: boolean };

const SEP = ' – ';
const paraNumero = (v: string) => Number(v.replace(/\./g, '').replace(',', '.')) || 0;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const mascarar = (v: string | number) => {
    const n = Number(v);
    return Number.isFinite(n) ? maskMoney(String(Math.round(n * 100))) : '';
};
let seq = 0;
const novaChave = () => `n${++seq}`;

export function ServicoForm({
    servico,
    onSuccess,
    trigger,
    idProtocoloPadrao,
    variant,
    triggerClassName,
    abrirSinal,
    modo = 'dialog',
    open: openProp,
    onOpenChange,
    nomeInicial,
    semSite = false,
}: {
    servico?: Servico;
    /** Recebe o id do serviço salvo. */
    onSuccess?: (id: number) => void;
    trigger?: React.ReactNode;
    /** Ao criar dentro de um protocolo, já vem selecionado. */
    idProtocoloPadrao?: number;
    variant?: 'default' | 'ghost' | 'outline';
    /** Quando informado, o gatilho vira um botão simples com estas classes (ex.: linha inteira clicável). */
    triggerClassName?: string;
    /** Muda de valor (>0) para abrir por fora, ex.: botão + do rodapé. */
    abrirSinal?: number;
    /** 'painel': abre pela direita (por cima de outro formulário), controlado por `open`. */
    modo?: 'dialog' | 'painel';
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    nomeInicial?: string;
    /** Aberto de dentro da página do site: a página é escolhida lá, então esconde essa parte. */
    semSite?: boolean;
}) {
    const { toast } = useToast();
    const { isAdmin } = useAuth();
    const utils = trpc.useUtils();
    const [openLocal, setOpenLocal] = useState(false);
    const controlado = openProp !== undefined;
    const open = controlado ? openProp : openLocal;
    const setOpen = (v: boolean) => { if (!controlado) setOpenLocal(v); onOpenChange?.(v); };
    const [salvando, setSalvando] = useState(false);

    const [nomeCurto, setNomeCurto] = useState('');
    const [nomeVendas, setNomeVendas] = useState('');
    const [mostrarAvancado, setMostrarAvancado] = useState(false);
    /** Nome nas vendas digitado à mão (não é "Protocolo – Nome"). */
    const [nomeProprio, setNomeProprio] = useState(false);
    const [descricao, setDescricao] = useState('');
    const [imagemUrl, setImagemUrl] = useState('');
    const [duracao, setDuracao] = useState('60');
    const [valor, setValor] = useState('');
    const [geraCredito, setGeraCredito] = useState(true);
    const [ativo, setAtivo] = useState(true);
    const [tecnicaIds, setTecnicaIds] = useState<number[]>([]);
    const [noSite, setNoSite] = useState(false);
    const [idProtocolo, setIdProtocolo] = useState('');
    const [regioes, setRegioes] = useState<string[]>([]);
    const [ordem, setOrdem] = useState('0');
    const [pacotes, setPacotes] = useState<PacoteLinha[]>([]);
    const [removidos, setRemovidos] = useState<number[]>([]);

    const tecnicasQ = trpc.tecnicas.list.useQuery(undefined, { enabled: open });
    const protocolosQ = trpc.protocolos.list.useQuery(undefined, { enabled: open && isAdmin });
    const [novaPagina, setNovaPagina] = useState(false);
    const semPaginas = protocolosQ.isSuccess && (protocolosQ.data as any[]).length === 0;
    const pacotesQ = trpc.pacotes.list.useQuery({ apenasAtivos: false }, { enabled: false });

    const protocolo = noSite
        ? ((protocolosQ.data ?? []) as any[]).find((p) => String(p.id) === idProtocolo) as { nome: string } | undefined
        : undefined;
    /** Nome usado em vendas, agenda e financeiro. */
    const nomeGerado = protocolo && nomeCurto.trim() ? `${protocolo.nome}${SEP}${nomeCurto.trim()}` : nomeCurto.trim();
    const nomeFinal = (nomeProprio && nomeVendas.trim()) || nomeGerado;
    const precoSessao = paraNumero(valor);

    async function abrir() {
        setRemovidos([]);
        setMostrarAvancado(false);
        if (servico) {
            const curto = servico.nome_modalidade || servico.nome;
            setNomeCurto(curto);
            setDescricao(servico.descricao ?? '');
            setImagemUrl(resolveImageUrl(servico.imagem_url));
            setDuracao(String(servico.duracao_minutos));
            setValor(mascarar(servico.valor));
            setGeraCredito(servico.gera_credito);
            setAtivo(servico.ativo);
            setTecnicaIds(servico.tecnicas?.map((t) => t.id) ?? []);
            setNoSite(!!servico.id_protocolo);
            setIdProtocolo(servico.id_protocolo ? String(servico.id_protocolo) : '');
            setRegioes(servico.regioes ?? []);
            setOrdem(String(servico.ordem_modalidade ?? 0));
            setNomeVendas(servico.nome);
            // Mantém um nome nas vendas que foi escrito à mão
            const gerado = servico.id_protocolo ? servico.nome.endsWith(`${SEP}${curto}`) : servico.nome === curto;
            setNomeProprio(!gerado);
            setPacotes([]);
            setOpen(true);
            const lista = ((await pacotesQ.refetch()).data ?? []) as any[];
            setPacotes(
                lista
                    .filter((p) => p.id_servico === servico.id)
                    .sort((a, b) => a.quantidade_sessoes - b.quantidade_sessoes)
                    .map((p) => ({ key: `p${p.id}`, id: p.id, sessoes: String(p.quantidade_sessoes), valor: mascarar(p.valor_total), ativo: String(p.status).toLowerCase() === 'ativo' })),
            );
        } else {
            setNomeCurto(nomeInicial ?? '');
            setNomeVendas('');
            setNomeProprio(false);
            setDescricao('');
            setImagemUrl('');
            setDuracao('60');
            setValor('');
            setGeraCredito(true);
            setAtivo(true);
            setTecnicaIds([]);
            setNoSite(!!idProtocoloPadrao);
            setIdProtocolo(idProtocoloPadrao ? String(idProtocoloPadrao) : '');
            setRegioes([]);
            setOrdem('0');
            setPacotes([]);
            setOpen(true);
        }
    }

    function addPacote(sessoes?: number) {
        // Sugestão: 4 sessões com ~7% e 8 sessões com ~13% de desconto sobre a sessão avulsa
        const desconto = sessoes === 4 ? 0.9333 : sessoes === 8 ? 0.8667 : 1;
        const sugerido = sessoes && precoSessao ? Math.round(precoSessao * sessoes * desconto / 10) * 10 : 0;
        setPacotes((ps) => [...ps, { key: novaChave(), sessoes: sessoes ? String(sessoes) : '', valor: sugerido ? mascarar(sugerido) : '', ativo: true }]);
    }

    async function removerPacote(p: PacoteLinha) {
        if (p.id) {
            const vendido = await utils.client.vendas.hasVinculoPacote.query({ id_pacote: p.id });
            if (vendido) {
                toast({ title: 'Pacote já vendido', description: 'Ele não pode ser excluído; foi desativado (sai do site e de novas vendas).' });
                setPacotes((ps) => ps.map((x) => (x.key === p.key ? { ...x, ativo: false } : x)));
                return;
            }
            setRemovidos((r) => [...r, p.id!]);
        }
        setPacotes((ps) => ps.filter((x) => x.key !== p.key));
    }

    async function salvar(e: React.FormEvent) {
        e.preventDefault();
        if (nomeFinal.length < 2) return toast({ title: 'Informe o nome do serviço', variant: 'error' });
        if (isAdmin && noSite && !idProtocolo) return toast({ title: 'Escolha a página do site (protocolo) do serviço', variant: 'error' });
        if (!duracao || Number(duracao) < 1) return toast({ title: 'Informe a duração da sessão', variant: 'error' });
        if (precoSessao < 0.01) return toast({ title: 'Informe o preço da sessão', variant: 'error' });
        for (const p of pacotes) {
            if (!(Number(p.sessoes) >= 2)) return toast({ title: 'Pacote precisa ter 2 sessões ou mais', variant: 'error' });
            if (paraNumero(p.valor) < 0.01) return toast({ title: `Informe o preço do pacote de ${p.sessoes} sessões`, variant: 'error' });
        }

        const dados = {
            nome: nomeFinal,
            descricao: descricao.trim() || undefined,
            imagem_url: imagemUrl || undefined,
            duracao_minutos: Number(duracao),
            valor: precoSessao,
            gera_credito: geraCredito,
            ativo,
            tecnica_ids: tecnicaIds,
            // Campos do site só são enviados pelo admin
            ...(isAdmin
                ? {
                      id_protocolo: noSite && idProtocolo ? Number(idProtocolo) : null,
                      nome_modalidade: noSite ? nomeCurto.trim() || null : null,
                      regioes: noSite ? regioes.map((r) => r.trim()).filter(Boolean) : [],
                      ordem_modalidade: noSite ? Number(ordem) || 0 : 0,
                  }
                : {}),
        };

        setSalvando(true);
        try {
            const idServico = servico
                ? (await utils.client.servicos.update.mutate({ id: servico.id, ...dados }), servico.id)
                : (await utils.client.servicos.create.mutate(dados)).id;

            for (const id of removidos) await utils.client.pacotes.delete.mutate({ id });
            for (const p of pacotes) {
                const n = Number(p.sessoes);
                const pacote = {
                    nome: `${nomeFinal}${SEP}${n} sessões`,
                    id_servico: idServico,
                    quantidade_sessoes: n,
                    valor_total: paraNumero(p.valor),
                    status: p.ativo ? 'ativo' : 'inativo',
                };
                if (p.id) await utils.client.pacotes.update.mutate({ id: p.id, ...pacote });
                else await utils.client.pacotes.create.mutate(pacote);
            }

            utils.servicos.list.invalidate();
            utils.pacotes.list.invalidate();
            utils.protocolos.list.invalidate();
            setOpen(false);
            onSuccess?.(idServico);
        } catch (err: any) {
            toast({ title: err.message ?? 'Erro ao salvar', variant: 'error' });
        } finally {
            setSalvando(false);
        }
    }

    useEffect(() => {
        if (abrirSinal) abrir();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [abrirSinal]);

    // Aberto de fora (modo painel)
    useEffect(() => {
        if (controlado && openProp) abrir();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openProp]);

    const painel = modo === 'painel';
    const Raiz = painel ? Sheet : Dialog;
    const Conteudo = painel ? SheetContent : DialogContent;
    const Cabecalho = painel ? SheetHeader : DialogHeader;
    const Titulo = painel ? SheetTitle : DialogTitle;
    const Rodape = painel ? SheetFooter : DialogFooter;

    return (
        <>
            {abrirSinal !== undefined || painel ? null : triggerClassName ? (
                <button type="button" className={triggerClassName} onClick={abrir}>{trigger}</button>
            ) : (
                <Button size="sm" variant={variant ?? (servico ? 'ghost' : 'default')} onClick={abrir}>
                    {trigger ?? (servico ? 'Editar' : 'Novo serviço')}
                </Button>
            )}
            <Raiz open={open} onOpenChange={setOpen}>
                <Conteudo className={painel ? undefined : 'sm:max-w-xl'}>
                    <Cabecalho>
                        <Titulo>
                            {servico ? 'Editar serviço' : protocolo && idProtocoloPadrao ? `Novo serviço em ${protocolo.nome}` : 'Novo serviço'}
                        </Titulo>
                    </Cabecalho>

                    <form onSubmit={(e) => { e.stopPropagation(); salvar(e); }} className="space-y-5">
                        {servico?.id_profissional && (
                            <p className="rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-700">
                                Serviço próprio de <strong>{servico.profissional_nome ?? 'profissional'}</strong>.
                            </p>
                        )}

                        {/* O que se vende */}
                        <section className="space-y-3">
                            <div>
                                <Label>Nome *</Label>
                                <Input value={nomeCurto} onChange={(e) => setNomeCurto(e.target.value)} placeholder={protocolo ? 'Ex.: Pernas, Corpo Integral' : 'Ex.: Massagem relaxante'} />
                                {nomeFinal && nomeFinal !== nomeCurto.trim() && (
                                    <p className="mt-1 text-xs text-gray-500">Nas vendas e na agenda: <strong>{nomeFinal}</strong></p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Duração da sessão *</Label>
                                    <div className="relative">
                                        <Input type="number" inputMode="numeric" min={5} step={5} value={duracao} onChange={(e) => setDuracao(e.target.value)} className="pr-12" />
                                        <span className="pointer-events-none absolute right-3 top-2.5 text-sm text-gray-500">min</span>
                                    </div>
                                </div>
                                <div>
                                    <Label>Preço da sessão *</Label>
                                    <div className="relative">
                                        <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-gray-500">R$</span>
                                        <Input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(maskMoney(e.target.value))} placeholder="0,00" className="pl-9" />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Pacotes */}
                        <section className="space-y-2 rounded-lg border p-3">
                            <div className="flex items-baseline justify-between gap-2">
                                <p className="text-sm font-semibold">Pacotes</p>
                                <p className="text-xs text-gray-500">várias sessões por um preço fechado</p>
                            </div>
                            {pacotes.length === 0 && <p className="text-sm text-gray-500">Sem pacotes: o serviço é vendido só por sessão.</p>}
                            <ul className="space-y-2">
                                {pacotes.map((p) => {
                                    const n = Number(p.sessoes) || 0;
                                    const total = paraNumero(p.valor);
                                    const porSessao = n ? total / n : 0;
                                    const economia = precoSessao && n ? Math.round((1 - porSessao / precoSessao) * 100) : 0;
                                    return (
                                        <li key={p.key} className={cn('grid grid-cols-[5.5rem_1fr_auto] items-end gap-2', !p.ativo && 'opacity-60')}>
                                            <div>
                                                <Label className="text-xs">Sessões</Label>
                                                <Input type="number" inputMode="numeric" min={2} value={p.sessoes}
                                                    onChange={(e) => setPacotes((ps) => ps.map((x) => (x.key === p.key ? { ...x, sessoes: e.target.value } : x)))} />
                                            </div>
                                            <div>
                                                <Label className="text-xs">Preço total</Label>
                                                <div className="relative">
                                                    <span className="pointer-events-none absolute left-3 top-2.5 text-sm text-gray-500">R$</span>
                                                    <Input type="text" inputMode="decimal" value={p.valor} placeholder="0,00" className="pl-9"
                                                        onChange={(e) => setPacotes((ps) => ps.map((x) => (x.key === p.key ? { ...x, valor: maskMoney(e.target.value) } : x)))} />
                                                </div>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-10 w-10" aria-label={`Remover pacote de ${p.sessoes} sessões`} onClick={() => removerPacote(p)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                            <div className="col-span-3 -mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                                                <span className="tabular-nums">
                                                    {porSessao ? `sai a ${brl(porSessao)} por sessão` : ''}
                                                    {economia > 0 && <span className="text-emerald-700"> · {economia}% de desconto</span>}
                                                </span>
                                                <label className="flex items-center gap-1.5">
                                                    <input type="checkbox" checked={p.ativo} onChange={(e) => setPacotes((ps) => ps.map((x) => (x.key === p.key ? { ...x, ativo: e.target.checked } : x)))} />
                                                    Ativo
                                                </label>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="flex flex-wrap gap-2 pt-1">
                                {[4, 8].filter((n) => !pacotes.some((p) => Number(p.sessoes) === n)).map((n) => (
                                    <Button key={n} type="button" size="sm" variant="outline" onClick={() => addPacote(n)}>
                                        <Plus className="mr-1 h-3.5 w-3.5" /> {n} sessões
                                    </Button>
                                ))}
                                <Button type="button" size="sm" variant="ghost" onClick={() => addPacote()}>
                                    <Plus className="mr-1 h-3.5 w-3.5" /> Outro
                                </Button>
                            </div>
                        </section>

                        {/* Site: só o admin publica */}
                        {semSite ? null : isAdmin ? (
                            <section className="space-y-3 rounded-lg border border-dashed p-3">
                                <label className="flex cursor-pointer items-start gap-2 text-sm">
                                    <input type="checkbox" className="mt-0.5" checked={noSite} onChange={(e) => setNoSite(e.target.checked)} />
                                    <span>
                                        <span className="font-medium">Exibir no site</span>
                                        <span className="block text-xs text-gray-500">Desmarcado, o serviço fica só no sistema (vendas e agenda).</span>
                                    </span>
                                </label>
                                {noSite && (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
                                            <div>
                                                <Label>Página do site *</Label>
                                                <div className="mt-1 flex items-center gap-1">
                                                    <select aria-label="Página do site" className="h-10 w-full rounded-md border border-gray-200 bg-white px-2 text-sm"
                                                        value={idProtocolo} onChange={(e) => setIdProtocolo(e.target.value)}>
                                                        <option value="">{semPaginas ? 'Nenhuma página ainda' : 'Escolha…'}</option>
                                                        {((protocolosQ.data ?? []) as any[]).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                                    </select>
                                                    <Button type="button" size="sm" variant="outline" onClick={() => setNovaPagina(true)} aria-label="Criar nova página" title="Criar nova página">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div>
                                                <Label>Ordem</Label>
                                                <Input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <Label>Regiões / observações no site</Label>
                                            <ListEditor value={regioes} onChange={setRegioes} placeholder="Ex.: Pescoço e cervical." />
                                        </div>
                                    </>
                                )}
                            </section>
                        ) : (
                            <p className="text-xs text-gray-500">Seus serviços ficam só no sistema (vendas e agenda) e não aparecem no site.</p>
                        )}

                        <div className="flex flex-wrap items-center gap-6">
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded" />
                                Ativo
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={geraCredito} onChange={(e) => setGeraCredito(e.target.checked)} className="rounded" />
                                Gera crédito
                            </label>
                        </div>

                        {tecnicasQ.data && (
                            <div>
                                <Label>Técnicas</Label>
                                <div className="mt-1.5">
                                    <TecnicasSelect tecnicas={tecnicasQ.data as any[]} value={tecnicaIds} onChange={setTecnicaIds} />
                                </div>
                            </div>
                        )}

                        {/* Detalhes menos usados */}
                        <div className="rounded-lg border">
                            <button type="button" onClick={() => setMostrarAvancado((v) => !v)}
                                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-gray-600">
                                Descrição, imagem e nome nas vendas
                                <ChevronDown className={cn('h-4 w-4 transition-transform', mostrarAvancado && 'rotate-180')} />
                            </button>
                            {mostrarAvancado && (
                                <div className="space-y-3 border-t p-3">
                                    <div>
                                        <Label>Nome nas vendas e na agenda</Label>
                                        <Input value={nomeProprio ? nomeVendas : ''} placeholder={nomeGerado}
                                            onChange={(e) => { setNomeVendas(e.target.value); setNomeProprio(!!e.target.value.trim()); }} />
                                        <p className="mt-1 text-xs text-gray-500">Em branco, usa "{nomeGerado || 'o nome do serviço'}".</p>
                                    </div>
                                    <div>
                                        <Label>Descrição</Label>
                                        <Textarea rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label>Imagem</Label>
                                        <ImageUpload value={imagemUrl} onChange={setImagemUrl} />
                                    </div>
                                </div>
                            )}
                        </div>

                        <Rodape className="gap-2">
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
                        </Rodape>
                    </form>
                    {isAdmin && novaPagina && (
                        <ProtocoloForm modo="painel" open={novaPagina} onOpenChange={setNovaPagina}
                            onSuccess={(id) => {
                                utils.protocolos.list.invalidate();
                                if (id) setIdProtocolo(String(id));
                                toast({ title: 'Página criada e escolhida', variant: 'success' });
                            }} />
                    )}
                </Conteudo>
            </Raiz>
        </>
    );
}
