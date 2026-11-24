import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Check, Package, Plus, Repeat, ShoppingBag, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SeletorBusca } from '@/components/TecnicasSelect';
import { minutos, somarMinutos } from '@/lib/agenda';
import { maskMoney } from '@/lib/masks';
import { VendaRapida } from './VendaRapida';

export type AgendamentoInicial = {
    /** Presente = edição */
    id?: number;
    id_recorrencia?: number | null;
    id_pessoa?: number;
    pessoa_nome?: string;
    id_profissional?: number;
    id_sala?: number | null;
    data?: string;
    hora_inicio?: string;
    hora_fim?: string;
    servicos?: number[];
    id_venda?: number | null;
    id_venda_item?: number | null;
    venda_rotulo?: string | null;
    titulo_extra?: string | null;
    duracao_extra?: number | null;
    id_venda_extra?: number | null;
    observacoes?: string | null;
};

type Props = {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    inicial: AgendamentoInicial;
    onSalvo?: () => void;
};

const selectCls = 'w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm disabled:opacity-60';

export function AgendamentoForm({ open, onOpenChange, inicial, onSalvo }: Props) {
    const { user, isAdmin } = useAuth();
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const editando = !!inicial.id;

    const [idPessoa, setIdPessoa] = useState<number | null>(null);
    const [pessoaNome, setPessoaNome] = useState('');
    const [busca, setBusca] = useState('');
    const [novoCliente, setNovoCliente] = useState<{ nome: string; telefone: string } | null>(null);
    const [idProf, setIdProf] = useState<number>(user?.id ?? 0);
    const [idSala, setIdSala] = useState<number | null>(null);
    const [data, setData] = useState('');
    const [horaInicio, setHoraInicio] = useState('');
    const [horaFim, setHoraFim] = useState('');
    const [servicosSel, setServicosSel] = useState<number[]>([]);
    const [idVenda, setIdVenda] = useState<number | null>(null);
    const [observacoes, setObservacoes] = useState('');
    const [repetir, setRepetir] = useState(false);
    const [qtdRepeticoes, setQtdRepeticoes] = useState(4);
    const [intervaloSemanas, setIntervaloSemanas] = useState(1);
    const [aplicarProximas, setAplicarProximas] = useState(false);
    const [conflito, setConflito] = useState<string | null>(null);
    /** Duração do atendimento (min); "manual" quando a pessoa escolheu ou mexeu no fim. */
    const [duracao, setDuracao] = useState(60);
    const [duracaoManual, setDuracaoManual] = useState(false);
    const [verLivres, setVerLivres] = useState(false);
    /** Atendimento livre (sem cadastro): avaliação, retoque… */
    const [extra, setExtra] = useState<{ titulo: string; duracao: string; valor: string; id_forma: string; pago: boolean } | null>(null);
    const [vendaTocada, setVendaTocada] = useState(false);
    const [vendaRapida, setVendaRapida] = useState(false);
    const [vendaNova, setVendaNova] = useState<number | null>(null);

    useEffect(() => {
        if (!open) return;
        setIdPessoa(inicial.id_pessoa ?? null);
        setPessoaNome(inicial.pessoa_nome ?? '');
        setBusca('');
        setNovoCliente(null);
        setIdProf(inicial.id_profissional ?? user?.id ?? 0);
        setIdSala(inicial.id_sala ?? null);
        setData(inicial.data ?? '');
        setHoraInicio(inicial.hora_inicio ?? '');
        setHoraFim(inicial.hora_fim ?? '');
        setServicosSel(inicial.servicos ?? []);
        setIdVenda(inicial.id_venda_item ?? null);
        setObservacoes(inicial.observacoes ?? '');
        setRepetir(false);
        setQtdRepeticoes(4);
        setIntervaloSemanas(1);
        setAplicarProximas(false);
        setConflito(null);
        const durInicial = inicial.hora_inicio && inicial.hora_fim ? minutos(inicial.hora_fim) - minutos(inicial.hora_inicio) : 0;
        setDuracao(durInicial > 0 ? durInicial : 60);
        setDuracaoManual(durInicial > 0 && (!!inicial.id || !inicial.servicos));
        setVerLivres(false);
        setExtra(inicial.titulo_extra ? { titulo: inicial.titulo_extra, duracao: String(inicial.duracao_extra ?? ''), valor: '', id_forma: '', pago: false } : null);
        setVendaTocada(!!inicial.id);
        setVendaRapida(false);
        setVendaNova(null);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const clientesQ = trpc.pessoas.listClientes.useQuery(undefined, { enabled: open && !editando });
    const profsQ = trpc.agenda.profissionais.list.useQuery(undefined, { enabled: open });
    const salasQ = trpc.agenda.salas.list.useQuery(undefined, { enabled: open });
    const servicosQ = trpc.servicos.list.useQuery(undefined, { enabled: open });
    const servProfQ = trpc.agenda.profissionais.servicos.useQuery({ id_profissional: idProf }, { enabled: open && !!idProf });
    const vendasQ = trpc.agenda.vendasDoCliente.useQuery({ id_pessoa: idPessoa ?? 0, id_profissional: idProf }, { enabled: open && !!idPessoa });
    const formasQ = trpc.formasPagamento.list.useQuery(undefined, { enabled: open && !!extra });

    const servicosDisponiveis = useMemo(() => {
        // Serviço próprio só serve para o dono; os da clínica seguem a lista "serviços que executa"
        const prof = ((profsQ.data ?? []) as any[]).find((p) => p.id === idProf);
        const usaClinica = !prof || prof.perfil === 'ADMIN' || prof.ve_servicos_clinica;
        const todos = ((servicosQ.data ?? []) as any[]).filter((s) => (s.id_profissional == null && usaClinica) || s.id_profissional === idProf);
        const permitidos = (servProfQ.data ?? []) as number[];
        if (!permitidos.length) return todos;
        return todos.filter((s) => s.id_profissional === idProf || permitidos.includes(s.id) || servicosSel.includes(s.id));
    }, [servicosQ.data, servProfQ.data, servicosSel, idProf, profsQ.data]);

    const duracaoServicos = useMemo(() => {
        const todos = (servicosQ.data ?? []) as any[];
        return servicosSel.reduce((s, id) => s + (todos.find((x) => x.id === id)?.duracao_minutos ?? 0), 0);
    }, [servicosSel, servicosQ.data]);
    const duracaoPadrao = duracaoServicos + (extra ? Number(extra.duracao) || 0 : 0);

    // Duração vem dos serviços até a pessoa escolher outra
    useEffect(() => {
        if (!duracaoManual && duracaoPadrao > 0) setDuracao(duracaoPadrao);
    }, [duracaoPadrao, duracaoManual]);
    // Fim = início + duração
    useEffect(() => {
        if (horaInicio && duracao > 0) setHoraFim(somarMinutos(horaInicio, duracao));
    }, [horaInicio, duracao]);

    const livresQ = trpc.agenda.disponibilidade.useQuery(
        { id_profissional: idProf, data, duracao: duracao || 60, id_sala: idSala, ignorarId: inicial.id },
        { enabled: open && verLivres && !!idProf && /^\d{4}-\d{2}-\d{2}$/.test(data) },
    );

    const vendas = (vendasQ.data ?? []) as any[];
    function escolherItem(item: any | null) {
        setVendaTocada(true);
        setIdVenda(item ? item.id : null);
        if (item?.id_servico) setServicosSel([item.id_servico]);
    }
    // Cliente com um só pacote/sessão com saldo: já vem marcado
    useEffect(() => {
        if (!open || vendaTocada || !idPessoa || !vendasQ.data) return;
        if (vendas.length === 1) escolherItem(vendas[0]);
        else setVendaTocada(true);
    }, [vendasQ.data, idPessoa, open]); // eslint-disable-line react-hooks/exhaustive-deps
    // Depois da venda rápida: marca o item recém-vendido
    useEffect(() => {
        if (!vendaNova) return;
        const item = vendas.find((v) => v.id_venda === vendaNova);
        if (item) { escolherItem(item); setVendaNova(null); }
    }, [vendasQ.data, vendaNova]); // eslint-disable-line react-hooks/exhaustive-deps

    const clientesFiltrados = useMemo(() => {
        const q = busca.trim().toLowerCase();
        const lista = (clientesQ.data ?? []) as { id: number; nome: string }[];
        return (q ? lista.filter((c) => c.nome.toLowerCase().includes(q)) : lista).slice(0, 8);
    }, [busca, clientesQ.data]);

    const clienteRapidoMut = trpc.agenda.clienteRapido.useMutation({
        onSuccess: (c: any) => {
            setIdPessoa(c.id);
            setPessoaNome(c.nome);
            setNovoCliente(null);
            utils.pessoas.listClientes.invalidate();
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    const aoSalvar = (msg: string) => {
        utils.agenda.eventos.invalidate();
        utils.atendimentos.list.invalidate();
        utils.vendas.list.invalidate();
        toast({ title: msg, variant: 'success' });
        onOpenChange(false);
        onSalvo?.();
    };
    const aoErro = (e: { message: string; data?: { code?: string } | null }) => {
        if (e.data?.code === 'CONFLICT') setConflito(e.message);
        else toast({ title: e.message, variant: 'error' });
    };

    const criarMut = trpc.agenda.criar.useMutation({
        onSuccess: (r: any) => {
            if (r.puladas?.length) {
                toast({
                    title: `${r.ids.length} agendado(s), ${r.puladas.length} pulado(s) por conflito`,
                    description: r.puladas.map((p: any) => `${p.data.split('-').reverse().join('/')}: ${p.motivo}`).join('\n'),
                });
                utils.agenda.eventos.invalidate();
                onOpenChange(false);
                onSalvo?.();
            } else aoSalvar(r.ids.length > 1 ? `${r.ids.length} sessões agendadas` : 'Agendado!');
        },
        onError: aoErro,
    });
    const atualizarMut = trpc.agenda.atualizar.useMutation({
        onSuccess: () => aoSalvar('Agendamento atualizado'),
        onError: aoErro,
    });
    const salvando = criarMut.isPending || atualizarMut.isPending;

    function salvar(forcar = false) {
        setConflito(null);
        if (!editando && !idPessoa) return toast({ title: 'Selecione o cliente', variant: 'error' });
        if (!servicosSel.length && !extra) return toast({ title: 'Escolha um serviço ou descreva o atendimento', variant: 'error' });
        if (extra && extra.titulo.trim().length < 2) return toast({ title: 'Dê um nome ao atendimento (ex.: Avaliação)', variant: 'error' });
        const valorExtra = extra ? Number(extra.valor.replace(/\./g, '').replace(',', '.')) || 0 : 0;
        if (extra && valorExtra > 0 && !extra.id_forma) return toast({ title: 'Escolha a forma de pagamento do atendimento', variant: 'error' });
        if (!data || !horaInicio) return toast({ title: 'Informe data e horário', variant: 'error' });
        const extraPayload = extra
            ? {
                  titulo: extra.titulo.trim(),
                  duracao: Number(extra.duracao) || Math.max(duracao - duracaoServicos, 5),
                  valor: valorExtra || undefined,
                  id_forma_pagamento: valorExtra > 0 ? Number(extra.id_forma) : undefined,
                  pago: valorExtra > 0 ? extra.pago : undefined,
              }
            : undefined;
        const base = {
            id_profissional: idProf,
            id_sala: idSala,
            data,
            hora_inicio: horaInicio,
            hora_fim: horaFim || undefined,
            servicos: servicosSel,
            id_venda_item: idVenda,
            forcar,
        };
        if (editando) {
            atualizarMut.mutate({ id: inicial.id, ...base, extra: extraPayload ?? (inicial.titulo_extra ? null : undefined), observacoes: observacoes.trim() || null, aplicarProximas });
        } else {
            criarMut.mutate({
                ...base,
                extra: extraPayload,
                id_pessoa: idPessoa,
                observacoes: observacoes.trim() || undefined,
                recorrencia: repetir ? { quantidade: qtdRepeticoes, intervalo_semanas: intervaloSemanas } : undefined,
            });
        }
    }

    // Salas só aparecem se cadastradas (studio com um espaço usa a agenda compartilhada)
    const temSalas = ((salasQ.data ?? []) as any[]).length > 0;
    const podeForcar = isAdmin && conflito && /expediente/i.test(conflito) && !/ocupad|bloquead/i.test(conflito);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editando ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle>
                </DialogHeader>

                <form
                    className="space-y-4"
                    onSubmit={(e) => {
                        e.preventDefault();
                        salvar();
                    }}
                >
                    {/* Cliente */}
                    <div className="space-y-1.5">
                        <Label>Cliente *</Label>
                        {idPessoa ? (
                            <div className="flex items-center justify-between rounded-md border border-[hsl(var(--input))] px-3 py-2 text-sm">
                                <span className="font-medium">{pessoaNome}</span>
                                {!editando && (
                                    <button type="button" className="text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => { setIdPessoa(null); setIdVenda(null); setVendaTocada(false); }}>
                                        trocar
                                    </button>
                                )}
                            </div>
                        ) : novoCliente ? (
                            <div className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_160px_auto]">
                                <Input autoFocus placeholder="Nome do cliente" value={novoCliente.nome} onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} />
                                <Input placeholder="WhatsApp" value={novoCliente.telefone} onChange={(e) => setNovoCliente({ ...novoCliente, telefone: e.target.value })} />
                                <div className="flex gap-1">
                                    <Button type="button" size="sm" disabled={novoCliente.nome.trim().length < 2 || clienteRapidoMut.isPending}
                                        onClick={() => clienteRapidoMut.mutate({ nome: novoCliente.nome.trim(), telefone: novoCliente.telefone.trim() || undefined })}>
                                        Salvar
                                    </Button>
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setNovoCliente(null)}>Voltar</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <Input placeholder="Buscar cliente pelo nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                                {busca && (
                                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                                        {clientesFiltrados.map((c) => (
                                            <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-[hsl(var(--accent))]"
                                                onClick={() => { setIdPessoa(c.id); setPessoaNome(c.nome); setBusca(''); }}>
                                                {c.nome}
                                            </button>
                                        ))}
                                        <button type="button" className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]"
                                            onClick={() => setNovoCliente({ nome: busca, telefone: '' })}>
                                            <UserPlus className="h-4 w-4" /> Cadastrar "{busca}"
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className={cn('grid gap-4', temSalas && 'sm:grid-cols-2')}>
                        <div className="space-y-1.5">
                            <Label>Profissional *</Label>
                            <select aria-label="Profissional" className={selectCls} value={idProf} disabled={!isAdmin}
                                onChange={(e) => setIdProf(Number(e.target.value))}>
                                {((profsQ.data ?? []) as any[]).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                            </select>
                        </div>
                        {temSalas && <div className="space-y-1.5">
                            <Label>Sala / maca</Label>
                            <select aria-label="Sala" className={selectCls} value={idSala ?? ''}
                                onChange={(e) => setIdSala(e.target.value ? Number(e.target.value) : null)}>
                                <option value="">Sem sala</option>
                                {((salasQ.data ?? []) as any[]).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                            </select>
                        </div>}
                    </div>

                    {/* Sessões que o cliente já tem */}
                    {idPessoa && (
                        <div className="space-y-2">
                            <Label>Sessões do cliente</Label>
                            {vendasQ.isLoading ? (
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Carregando…</p>
                            ) : (
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {inicial.id_venda_item && !vendas.some((v) => v.id === inicial.id_venda_item) && (
                                        <CartaoOpcao ativo={idVenda === inicial.id_venda_item} onClick={() => { setVendaTocada(true); setIdVenda(inicial.id_venda_item!); }}
                                            titulo={inicial.venda_rotulo ?? 'Venda atual'} detalhe="sessão deste agendamento" pacote />
                                    )}
                                    {vendas.map((v) => (
                                        <CartaoOpcao key={v.id} ativo={idVenda === v.id} onClick={() => escolherItem(v)}
                                            titulo={v.rotulo} detalhe={`${v.restantes} de ${v.quantidade_sessoes} ${v.quantidade_sessoes === 1 ? 'sessão restante' : 'sessões restantes'}`} pacote />
                                    ))}
                                    <CartaoOpcao ativo={idVenda == null} onClick={() => escolherItem(null)}
                                        titulo="Sessão avulsa" detalhe={vendas.length ? 'não usa o pacote' : 'cliente sem pacote com saldo'} />
                                </div>
                            )}
                            <button type="button" onClick={() => setVendaRapida(true)}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(var(--primary))] hover:underline">
                                <ShoppingBag className="h-4 w-4" /> Vender pacote ou sessão
                            </button>
                        </div>
                    )}

                    {/* Serviços */}
                    <div className="space-y-1.5">
                        <Label>Serviço *</Label>
                        {servicosDisponiveis.length ? (
                            <SeletorBusca
                                itens={servicosDisponiveis.map((x: any) => ({ id: x.id, nome: x.nome, duracao: x.duracao_minutos }))}
                                value={servicosSel}
                                onChange={setServicosSel}
                                rotuloEscolher="Escolher serviço"
                                placeholder="Buscar serviço…"
                                vazio="Nenhum serviço com esse nome."
                                detalhe={(x: any) => `${x.duracao} min`}
                                fecharAoEscolher
                            />
                        ) : (
                            !extra && <p className="text-sm text-[hsl(var(--muted-foreground))]">Nenhum serviço ativo para este profissional.</p>
                        )}

                        {/* Atendimento livre */}
                        {extra ? (
                            <div className="space-y-3 rounded-lg border p-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">Atendimento sem cadastro</p>
                                    <button type="button" aria-label="Tirar atendimento sem cadastro" onClick={() => setExtra(null)} className="p-1 text-[hsl(var(--muted-foreground))]">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <Input placeholder="Nome (ex.: Avaliação, Retoque)" value={extra.titulo} maxLength={120}
                                    onChange={(e) => setExtra({ ...extra, titulo: e.target.value })} />
                                <div className="grid grid-cols-2 gap-3">
                                    <label className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                                        Duração (min)
                                        <Input type="number" min={5} inputMode="numeric" value={extra.duracao}
                                            onChange={(e) => { setExtra({ ...extra, duracao: e.target.value }); setDuracaoManual(false); }} />
                                    </label>
                                    <label className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                                        Valor (vazio = sem cobrança)
                                        <Input inputMode="decimal" placeholder="0,00" value={extra.valor}
                                            disabled={!!inicial.id_venda_extra}
                                            onChange={(e) => setExtra({ ...extra, valor: maskMoney(e.target.value) })} />
                                    </label>
                                </div>
                                {inicial.id_venda_extra ? (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Já cobrado: a venda está em Vendas.</p>
                                ) : extra.valor && (
                                    <div className="grid grid-cols-2 items-end gap-3">
                                        <label className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                                            Forma de pagamento
                                            <select aria-label="Forma de pagamento" className={selectCls} value={extra.id_forma}
                                                onChange={(e) => setExtra({ ...extra, id_forma: e.target.value })}>
                                                <option value="">Escolha…</option>
                                                {((formasQ.data ?? []) as any[]).filter((f) => f.ativo !== false).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                            </select>
                                        </label>
                                        <label className="flex h-10 cursor-pointer items-center gap-2 text-sm">
                                            <input type="checkbox" checked={extra.pago} onChange={(e) => setExtra({ ...extra, pago: e.target.checked })} />
                                            Já recebido
                                        </label>
                                        <p className="col-span-2 text-xs text-[hsl(var(--muted-foreground))]">Ao salvar, vira uma venda deste cliente.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <button type="button" onClick={() => setExtra({ titulo: '', duracao: '30', valor: '', id_forma: '', pago: false })}
                                className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                                <Plus className="h-4 w-4" /> Outro atendimento (sem cadastro)
                            </button>
                        )}
                    </div>

                    {/* Data, início, duração e fim */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1.5 sm:col-span-1">
                            <Label>Data *</Label>
                            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-4 sm:col-span-1">
                            <div className="space-y-1.5">
                                <Label>Início *</Label>
                                <Input type="time" step={300} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Fim</Label>
                                <Input type="time" step={300} value={horaFim}
                                    onChange={(e) => {
                                        setHoraFim(e.target.value);
                                        if (horaInicio && e.target.value) {
                                            const d = minutos(e.target.value) - minutos(horaInicio);
                                            if (d > 0) { setDuracao(d); setDuracaoManual(true); }
                                        }
                                    }} />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Duração <span className="font-normal text-[hsl(var(--muted-foreground))]">· {duracao} min{duracaoPadrao > 0 && duracao !== duracaoPadrao ? ` (padrão ${duracaoPadrao})` : ''}</span></Label>
                        <div className="flex flex-wrap items-center gap-1.5">
                            {[30, 45, 60, 75, 90, 120].map((m) => (
                                <button key={m} type="button" onClick={() => { setDuracao(m); setDuracaoManual(true); }}
                                    className={cn('h-9 rounded-full border px-3 text-sm tabular-nums transition-colors',
                                        duracao === m ? 'border-transparent bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))]')}>
                                    {m}
                                </button>
                            ))}
                            <Input type="number" min={5} max={600} step={5} aria-label="Outra duração em minutos" className="h-9 w-20"
                                value={[30, 45, 60, 75, 90, 120].includes(duracao) ? '' : duracao} placeholder="outra"
                                onChange={(e) => { const v = Number(e.target.value); if (v > 0) { setDuracao(v); setDuracaoManual(true); } }} />
                        </div>
                    </div>
                    {data && (
                        <div className="space-y-1.5">
                            <button type="button" onClick={() => setVerLivres((v) => !v)} className="text-sm text-[hsl(var(--primary))] hover:underline">
                                {verLivres ? 'Esconder horários livres' : 'Ver horários livres'}
                            </button>
                            {verLivres && (
                                <div className="flex flex-wrap gap-1">
                                    {livresQ.isLoading && <span className="text-xs text-[hsl(var(--muted-foreground))]">Carregando…</span>}
                                    {((livresQ.data ?? []) as string[]).map((h) => (
                                        <button key={h} type="button" onClick={() => setHoraInicio(h)}
                                            className={cn('rounded border px-2 py-1 text-xs', h === horaInicio ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))]')}>
                                            {h}
                                        </button>
                                    ))}
                                    {livresQ.data && !(livresQ.data as string[]).length && (
                                        <span className="text-xs text-amber-600">Sem horários livres de {duracao} min no expediente deste dia</span>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Recorrência */}
                    {!editando ? (
                        <div className="rounded-md border border-[hsl(var(--input))] p-3">
                            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                                <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
                                <Repeat className="h-4 w-4" /> Repetir este horário
                            </label>
                            {repetir && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                                    <select aria-label="Frequência" className="rounded-md border px-2 py-1.5" value={intervaloSemanas} onChange={(e) => setIntervaloSemanas(Number(e.target.value))}>
                                        <option value={1}>Toda semana</option>
                                        <option value={2}>A cada 2 semanas</option>
                                        <option value={3}>A cada 3 semanas</option>
                                        <option value={4}>A cada 4 semanas</option>
                                    </select>
                                    <span>total de</span>
                                    <Input type="number" min={2} max={52} className="h-9 w-20" value={qtdRepeticoes} onChange={(e) => setQtdRepeticoes(Math.max(2, Math.min(52, Number(e.target.value) || 2)))} />
                                    <span>sessões</span>
                                    <p className="w-full text-xs text-[hsl(var(--muted-foreground))]">Datas com conflito são puladas e informadas no final.</p>
                                </div>
                            )}
                        </div>
                    ) : inicial.id_recorrencia ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input type="checkbox" checked={aplicarProximas} onChange={(e) => setAplicarProximas(e.target.checked)} />
                            Aplicar também às próximas sessões desta série
                        </label>
                    ) : null}

                    <div className="space-y-1.5">
                        <Label>Observações</Label>
                        <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                    </div>

                    {conflito && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="flex-1">
                                <p className="font-medium">Não foi possível agendar</p>
                                <p>{conflito}</p>
                            </div>
                            {podeForcar && (
                                <Button type="button" size="sm" variant="outline" onClick={() => salvar(true)} disabled={salvando}>
                                    Agendar mesmo assim
                                </Button>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Agendar'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
            {idPessoa && (
                <VendaRapida open={vendaRapida} onOpenChange={setVendaRapida} idPessoa={idPessoa} pessoaNome={pessoaNome} idProfissional={idProf}
                    onCreated={(id) => { setVendaNova(id); utils.agenda.vendasDoCliente.invalidate(); }} />
            )}
        </Dialog>
    );
}

/** Opção tocável: item de venda do cliente ou "sessão avulsa". */
function CartaoOpcao({ ativo, onClick, titulo, detalhe, pacote }: { ativo: boolean; onClick: () => void; titulo: string; detalhe: string; pacote?: boolean }) {
    return (
        <button type="button" onClick={onClick} aria-pressed={ativo}
            className={cn('flex items-start gap-2 rounded-lg border p-3 text-left transition-colors',
                ativo ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 ring-1 ring-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--accent))]')}>
            {pacote ? <Package className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /> : <span className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{titulo}</span>
                <span className="block text-xs text-[hsl(var(--muted-foreground))]">{detalhe}</span>
            </span>
            {ativo && <Check className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />}
        </button>
    );
}
