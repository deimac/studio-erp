import { useEffect, useMemo, useRef, useState } from 'react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Check, CircleDollarSign, Package, PenLine, Plus, Repeat, Search, Trash2, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { minutos, somarMinutos } from '@/lib/agenda';
import { maskMoney } from '@/lib/masks';
import { TelefoneInput } from '@/components/TelefoneInput';

/**
 * Agendamento:
 * 1. cliente (o resto só libera depois dele);
 * 2. "Já comprado": sessões que o cliente tem (marca as que usa agora);
 * 3. "Adicionar serviço": o que for escolhido é vendido agora
 *    (serviço, pacote ou "Serviço sem cadastro" com descrição e valor);
 * 4. horário (início, duração, fim) e pagamento do que foi vendido.
 */

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
    /** Itens de venda já usados pelo atendimento. */
    itens_ids?: number[];
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

type Novo = {
    chave: number;
    tipo: 'servico' | 'pacote' | 'livre';
    id_servico?: number;
    id_pacote?: number;
    /** Serviço da sessão (para duração e nomes). */
    id_servico_sessao?: number | null;
    nome: string;
    sessoes: number;
    duracao: string;
    valor: string;
};
type Pagamento = { chave: number; id_forma: string; valor: string; parcelas: string; pago: boolean };

const selectCls = 'w-full rounded-md border border-[hsl(var(--input))] bg-white px-3 py-2 text-sm disabled:opacity-60';
const paraCentavos = (m: string) => Math.round(Number(m.replace(/\./g, '').replace(',', '.') || 0) * 100);
const mascara = (c: number) => (c > 0 ? maskMoney(String(c)) : '');
const brl = (c: number) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
let seq = 0;
const chave = () => ++seq;

export function AgendamentoForm({ open, onOpenChange, inicial, onSalvo }: Props) {
    const { user, isAdmin } = useAuth();
    const { toast } = useToast();
    const utils = trpc.useUtils();
    const editando = !!inicial.id;

    const [idPessoa, setIdPessoa] = useState<number | null>(null);
    const [pessoaNome, setPessoaNome] = useState('');
    const [busca, setBusca] = useState('');
    const [novoCliente, setNovoCliente] = useState<{ nome: string; telefone: string } | null>(null);
    const nomeNovoRef = useRef<HTMLInputElement>(null);
    const [idProf, setIdProf] = useState<number>(user?.id ?? 0);
    const [idSala, setIdSala] = useState<number | null>(null);
    const [data, setData] = useState('');
    const [horaInicio, setHoraInicio] = useState('');
    const [horaFim, setHoraFim] = useState('');
    const [duracao, setDuracao] = useState(60);
    const [duracaoManual, setDuracaoManual] = useState(false);
    const [verLivres, setVerLivres] = useState(false);
    /** Itens já comprados usados nesta sessão. */
    const [usarItens, setUsarItens] = useState<number[]>([]);
    const [itensTocados, setItensTocados] = useState(false);
    /** Serviços da sessão sem venda (agendamentos antigos). */
    const [servicosAvulsos, setServicosAvulsos] = useState<number[]>([]);
    /** Serviço sem cadastro já salvo (edição). */
    const [livreSalvo, setLivreSalvo] = useState<{ titulo: string; duracao: string } | null>(null);
    const [novos, setNovos] = useState<Novo[]>([]);
    const [buscando, setBuscando] = useState(false);
    const [buscaServico, setBuscaServico] = useState('');
    const [pagarAgora, setPagarAgora] = useState(false);
    const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
    const [observacoes, setObservacoes] = useState('');
    const [repetir, setRepetir] = useState(false);
    const [qtdRepeticoes, setQtdRepeticoes] = useState(4);
    const [intervaloSemanas, setIntervaloSemanas] = useState(1);
    const [aplicarProximas, setAplicarProximas] = useState(false);
    const [conflito, setConflito] = useState<string | null>(null);

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
        const durInicial = inicial.hora_inicio && inicial.hora_fim ? minutos(inicial.hora_fim) - minutos(inicial.hora_inicio) : 0;
        setDuracao(durInicial > 0 ? durInicial : 60);
        setDuracaoManual(durInicial > 0);
        setVerLivres(false);
        const itens = inicial.itens_ids?.length ? inicial.itens_ids : inicial.id_venda_item ? [inicial.id_venda_item] : [];
        setUsarItens(itens);
        setItensTocados(editando);
        setServicosAvulsos(editando ? inicial.servicos ?? [] : []);
        setLivreSalvo(inicial.titulo_extra ? { titulo: inicial.titulo_extra, duracao: String(inicial.duracao_extra ?? '') } : null);
        setNovos([]);
        setBuscando(false);
        setBuscaServico('');
        setPagarAgora(false);
        setPagamentos([]);
        setObservacoes(inicial.observacoes ?? '');
        setRepetir(false);
        setQtdRepeticoes(4);
        setIntervaloSemanas(1);
        setAplicarProximas(false);
        setConflito(null);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cadastro rápido: cursor no fim do nome para completar
    useEffect(() => {
        if (!novoCliente) return;
        const el = nomeNovoRef.current;
        if (!el) return;
        el.focus();
        const fim = el.value.length;
        el.setSelectionRange(fim, fim);
    }, [novoCliente === null]); // eslint-disable-line react-hooks/exhaustive-deps

    const clientesQ = trpc.pessoas.listClientes.useQuery(undefined, { enabled: open && !editando });
    const profsQ = trpc.agenda.profissionais.list.useQuery(undefined, { enabled: open });
    const salasQ = trpc.agenda.salas.list.useQuery(undefined, { enabled: open });
    const servicosQ = trpc.servicos.list.useQuery(undefined, { enabled: open });
    const pacotesQ = trpc.pacotes.list.useQuery(undefined, { enabled: open });
    const formasQ = trpc.formasPagamento.list.useQuery(undefined, { enabled: open });
    const servProfQ = trpc.agenda.profissionais.servicos.useQuery({ id_profissional: idProf }, { enabled: open && !!idProf });
    const itensQ = trpc.agenda.vendasDoCliente.useQuery(
        { id_pessoa: idPessoa ?? 0, id_profissional: idProf, id_atendimento: inicial.id },
        { enabled: open && !!idPessoa },
    );

    const todosServicos = (servicosQ.data ?? []) as any[];
    const servicoPorId = useMemo(() => new Map(todosServicos.map((s) => [s.id, s])), [servicosQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
    const formas = ((formasQ.data ?? []) as any[]).filter((f) => f.ativo !== false);
    const itensCliente = (itensQ.data ?? []) as any[];

    // Serviços e pacotes que este profissional vende
    const catalogo = useMemo(() => {
        const prof = ((profsQ.data ?? []) as any[]).find((p) => p.id === idProf);
        const usaClinica = !prof || prof.perfil === 'ADMIN' || prof.ve_servicos_clinica;
        const permitidos = (servProfQ.data ?? []) as number[];
        const serve = (s: any) =>
            s && s.ativo !== false && ((s.id_profissional == null && usaClinica && (!permitidos.length || permitidos.includes(s.id))) || s.id_profissional === idProf);
        const termo = buscaServico.trim().toLowerCase();
        const lista = [
            ...((pacotesQ.data ?? []) as any[])
                .filter((p) => String(p.status).toLowerCase() === 'ativo' && serve(servicoPorId.get(p.id_servico)))
                .map((p) => {
                    const sv = servicoPorId.get(p.id_servico);
                    return { chave: `p${p.id}`, tipo: 'pacote' as const, id_servico: undefined as number | undefined, id_pacote: p.id as number | undefined, id_servico_sessao: p.id_servico as number, nome: p.nome as string, sessoes: Number(p.quantidade_sessoes), duracao: Number(sv?.duracao_minutos ?? 60), centavos: Math.round(Number(p.valor_total) * 100) };
                }),
            ...todosServicos
                .filter(serve)
                .map((s) => ({ chave: `s${s.id}`, tipo: 'servico' as const, id_servico: s.id as number | undefined, id_pacote: undefined as number | undefined, id_servico_sessao: s.id as number, nome: s.nome as string, sessoes: 1, duracao: Number(s.duracao_minutos), centavos: Math.round(Number(s.valor) * 100) })),
        ];
        return lista.filter((x) => !termo || x.nome.toLowerCase().includes(termo)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    }, [buscaServico, servicosQ.data, pacotesQ.data, profsQ.data, servProfQ.data, idProf, servicoPorId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cliente com um só item com saldo: já vem marcado (pode desmarcar)
    useEffect(() => {
        if (!open || itensTocados || !idPessoa || !itensQ.data) return;
        if (itensCliente.length === 1) setUsarItens([itensCliente[0].id]);
        setItensTocados(true);
    }, [itensQ.data, idPessoa, open]); // eslint-disable-line react-hooks/exhaustive-deps

    const temLivreNovo = novos.some((n) => n.tipo === 'livre');
    const nDatas = !editando && repetir ? qtdRepeticoes : 1;
    /** Total cobrado: avulso/sem cadastro × datas; pacote uma vez. */
    const totalVenda = novos.reduce((t, n) => t + paraCentavos(n.valor) * (n.tipo === 'pacote' ? 1 : nDatas), 0);

    // Serviços da sessão e duração padrão
    const servicosSessao = useMemo(() => {
        const ids = new Set<number>();
        for (const id of usarItens) {
            const it = itensCliente.find((x) => x.id === id);
            if (it?.id_servico) ids.add(it.id_servico);
        }
        for (const n of novos) if (n.id_servico_sessao) ids.add(n.id_servico_sessao);
        for (const id of servicosAvulsos) ids.add(id);
        return [...ids];
    }, [usarItens, novos, servicosAvulsos, itensQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
    const duracaoPadrao = useMemo(() => {
        let total = 0;
        for (const id of servicosSessao) total += Number(servicoPorId.get(id)?.duracao_minutos ?? itensCliente.find((x) => x.id_servico === id)?.duracao ?? 0);
        for (const n of novos) if (n.tipo === 'livre') total += Number(n.duracao) || 0;
        if (livreSalvo && !temLivreNovo) total += Number(livreSalvo.duracao) || 0;
        return total;
    }, [servicosSessao, novos, livreSalvo, servicoPorId, temLivreNovo]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!duracaoManual && duracaoPadrao > 0) setDuracao(duracaoPadrao);
    }, [duracaoPadrao, duracaoManual]);
    useEffect(() => {
        if (horaInicio && duracao > 0) setHoraFim(somarMinutos(horaInicio, duracao));
    }, [horaInicio, duracao]);

    // Pagamento acompanha o total enquanto há uma forma só
    useEffect(() => {
        setPagamentos((ps) => (ps.length === 1 ? [{ ...ps[0], valor: mascara(totalVenda) }] : ps));
    }, [totalVenda]);
    const pagoC = pagamentos.reduce((t, p) => t + paraCentavos(p.valor), 0);
    const falta = totalVenda - pagoC;

    const livresQ = trpc.agenda.disponibilidade.useQuery(
        { id_profissional: idProf, data, duracao: duracao || 60, id_sala: idSala, ignorarId: inicial.id },
        { enabled: open && verLivres && !!idProf && /^\d{4}-\d{2}-\d{2}$/.test(data) },
    );

    const clientesFiltrados = useMemo(() => {
        const q = busca.trim().toLowerCase();
        const lista = (clientesQ.data ?? []) as { id: number; nome: string }[];
        return (q ? lista.filter((c) => c.nome.toLowerCase().includes(q)) : lista).slice(0, 8);
    }, [busca, clientesQ.data]);

    const clienteRapidoMut = trpc.agenda.clienteRapido.useMutation({
        onSuccess: (c: any) => {
            escolherCliente(c.id, c.nome);
            setNovoCliente(null);
            utils.pessoas.listClientes.invalidate();
        },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    function escolherCliente(id: number | null, nome = '') {
        setIdPessoa(id);
        setPessoaNome(nome);
        setBusca('');
        setUsarItens([]);
        setItensTocados(false);
    }

    function adicionarNovo(x: (typeof catalogo)[number] | 'livre') {
        if (x === 'livre') {
            setNovos((l) => [...l, { chave: chave(), tipo: 'livre', nome: '', sessoes: 1, duracao: '30', valor: '' }]);
        } else {
            setNovos((l) => [...l, { chave: chave(), tipo: x.tipo, id_servico: x.id_servico, id_pacote: x.id_pacote, id_servico_sessao: x.id_servico_sessao, nome: x.nome, sessoes: x.sessoes, duracao: String(x.duracao), valor: mascara(x.centavos) }]);
        }
        setDuracaoManual(false);
        setBuscando(false);
        setBuscaServico('');
    }
    const alterarNovo = (k: number, patch: Partial<Novo>) => setNovos((l) => l.map((n) => (n.chave === k ? { ...n, ...patch } : n)));
    const alterarPagamento = (k: number, patch: Partial<Pagamento>) =>
        setPagamentos((ps) => ps.map((p) => (p.chave === k ? { ...p, ...patch, ...(patch.parcelas && patch.parcelas !== '1' ? { pago: false } : {}) } : p)));

    const aoSalvar = (msg: string) => {
        utils.agenda.eventos.invalidate();
        utils.agenda.vendasDoCliente.invalidate();
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
    const atualizarMut = trpc.agenda.atualizar.useMutation({ onSuccess: () => aoSalvar('Agendamento atualizado'), onError: aoErro });
    const salvando = criarMut.isPending || atualizarMut.isPending;

    function salvar(forcar = false) {
        setConflito(null);
        if (!idPessoa) return toast({ title: 'Escolha o cliente', variant: 'error' });
        const livre = novos.find((n) => n.tipo === 'livre');
        if (livre && livre.nome.trim().length < 2) return toast({ title: 'Descreva o serviço sem cadastro (ex.: Avaliação)', variant: 'error' });
        if (!servicosSessao.length && !usarItens.length && !novos.length && !livreSalvo)
            return toast({ title: 'Marque uma sessão já comprada ou adicione um serviço', variant: 'error' });
        if (!data || !horaInicio) return toast({ title: 'Informe data e horário', variant: 'error' });
        if (novos.some((n) => n.tipo !== 'livre' && paraCentavos(n.valor) <= 0)) return toast({ title: 'Informe o valor dos serviços adicionados', variant: 'error' });
        const cobrados = novos.filter((n) => paraCentavos(n.valor) > 0);
        if (pagarAgora && cobrados.length) {
            if (falta !== 0) return toast({ title: falta > 0 ? `Falta ${brl(falta)} no pagamento` : 'O pagamento passou do total', variant: 'error' });
            if (pagamentos.some((p) => !p.id_forma)) return toast({ title: 'Escolha a forma de pagamento', variant: 'error' });
        }
        const venda = cobrados.length
            ? {
                  itens: cobrados.map((n) => ({
                      id_servico: n.id_servico,
                      id_pacote: n.id_pacote,
                      descricao: n.tipo === 'livre' ? n.nome.trim() : undefined,
                      valor: paraCentavos(n.valor) / 100,
                      sessoes: n.tipo === 'pacote' ? n.sessoes : undefined,
                  })),
                  pagamentos: pagarAgora
                      ? pagamentos.map((p) => ({ id_forma_pagamento: Number(p.id_forma), valor: paraCentavos(p.valor) / 100, parcelas: Number(p.parcelas) || 1, pago: p.pago && p.parcelas === '1' }))
                      : [],
              }
            : undefined;
        const tituloLivre = livre ? livre.nome.trim() : livreSalvo?.titulo.trim() || null;
        const duracaoLivre = livre ? Number(livre.duracao) || undefined : livreSalvo ? Number(livreSalvo.duracao) || undefined : undefined;
        const base = {
            id_profissional: idProf,
            id_sala: idSala,
            data,
            hora_inicio: horaInicio,
            hora_fim: horaFim || undefined,
            servicos: servicosSessao,
            usar_itens: usarItens,
            venda,
            duracao_livre: duracaoLivre,
            forcar,
        };
        if (editando) {
            atualizarMut.mutate({ id: inicial.id, ...base, titulo_livre: tituloLivre, observacoes: observacoes.trim() || null, aplicarProximas });
        } else {
            criarMut.mutate({
                ...base,
                titulo_livre: tituloLivre ?? undefined,
                id_pessoa: idPessoa,
                observacoes: observacoes.trim() || undefined,
                recorrencia: repetir ? { quantidade: qtdRepeticoes, intervalo_semanas: intervaloSemanas } : undefined,
            });
        }
    }

    const temSalas = ((salasQ.data ?? []) as any[]).length > 0;
    const podeForcar = isAdmin && conflito && /expediente/i.test(conflito) && !/ocupad|bloquead/i.test(conflito);
    const semCliente = !idPessoa;
    const itensAtuaisFora = editando && itensQ.data ? (inicial.itens_ids ?? []).filter((id) => !itensCliente.some((x) => x.id === id)) : [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editando ? 'Editar agendamento' : 'Novo agendamento'}</DialogTitle>
                </DialogHeader>

                <form className="min-w-0 space-y-6" onSubmit={(e) => { e.preventDefault(); salvar(); }}>
                    {/* 1. Cliente */}
                    <div className="space-y-1.5">
                        <Label>Cliente *</Label>
                        {idPessoa ? (
                            <div className="flex items-center justify-between rounded-md border border-[hsl(var(--input))] px-3 py-2 text-sm">
                                <span className="font-medium">{pessoaNome}</span>
                                {!editando && (
                                    <button type="button" className="text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => escolherCliente(null)}>trocar</button>
                                )}
                            </div>
                        ) : novoCliente ? (
                            <div className="space-y-2 rounded-md border border-dashed p-3">
                                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Novo cliente</p>
                                <Input ref={nomeNovoRef} placeholder="Nome completo" value={novoCliente.nome} onChange={(e) => setNovoCliente({ ...novoCliente, nome: e.target.value })} />
                                <TelefoneInput value={novoCliente.telefone} onChange={(v) => setNovoCliente((c) => (c ? { ...c, telefone: v } : c))} />
                                <div className="flex justify-end gap-2">
                                    <Button type="button" size="sm" variant="ghost" onClick={() => setNovoCliente(null)}>Voltar</Button>
                                    <Button type="button" size="sm" disabled={novoCliente.nome.trim().length < 2 || clienteRapidoMut.isPending}
                                        onClick={() => clienteRapidoMut.mutate({ nome: novoCliente.nome.trim(), telefone: novoCliente.telefone || undefined })}>
                                        Cadastrar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <Input placeholder="Buscar cliente pelo nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                                {busca && (
                                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border bg-white shadow-lg">
                                        {clientesFiltrados.map((c) => (
                                            <button key={c.id} type="button" className="block w-full px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]" onClick={() => escolherCliente(c.id, c.nome)}>
                                                {c.nome}
                                            </button>
                                        ))}
                                        <button type="button" className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-left text-sm text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]"
                                            onClick={() => setNovoCliente({ nome: busca, telefone: '' })}>
                                            <UserPlus className="h-4 w-4" /> Cadastrar "{busca}"
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {semCliente && <p className="rounded-md bg-[hsl(var(--muted))] px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">Escolha ou cadastre o cliente para continuar.</p>}

                    <fieldset disabled={semCliente} className={cn('min-w-0 space-y-6', semCliente && 'pointer-events-none opacity-40')}>
                        <div className={cn('grid gap-4', temSalas && 'sm:grid-cols-2')}>
                            <div className="space-y-1.5">
                                <Label>Profissional *</Label>
                                <select aria-label="Profissional" className={selectCls} value={idProf} disabled={!isAdmin || semCliente}
                                    onChange={(e) => { setIdProf(Number(e.target.value)); setNovos([]); setUsarItens([]); setItensTocados(false); }}>
                                    {((profsQ.data ?? []) as any[]).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                </select>
                            </div>
                            {temSalas && (
                                <div className="space-y-1.5">
                                    <Label>Sala / maca</Label>
                                    <select aria-label="Sala" className={selectCls} value={idSala ?? ''} onChange={(e) => setIdSala(e.target.value ? Number(e.target.value) : null)}>
                                        <option value="">Sem sala</option>
                                        {((salasQ.data ?? []) as any[]).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* 2. Já comprado */}
                        {idPessoa && (itensCliente.length > 0 || itensAtuaisFora.length > 0) && (
                            <div className="space-y-2">
                                <Label>Já comprado <span className="font-normal text-[hsl(var(--muted-foreground))]">· marque o que usa nesta sessão</span></Label>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {itensAtuaisFora.map((id) => (
                                        <CartaoItem key={id} ativo={usarItens.includes(id)} onClick={() => setUsarItens((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))}
                                            titulo={inicial.venda_rotulo ?? 'Item da venda'} linha1="usado neste agendamento" linha2="" />
                                    ))}
                                    {itensCliente.map((it) => {
                                        const ativo = usarItens.includes(it.id);
                                        const dataVenda = String(it.data_venda ?? '').slice(0, 10).split('-').reverse().join('/');
                                        return (
                                            <CartaoItem key={it.id} ativo={ativo} pacote={it.pacote} pagamento={it.pagamento}
                                                onClick={() => { setUsarItens((l) => (ativo ? l.filter((x) => x !== it.id) : [...l, it.id])); setDuracaoManual(false); }}
                                                titulo={it.rotulo}
                                                linha1={`Sessão de ${it.servico_nome ?? it.rotulo}${it.duracao ? ` · ${it.duracao} min` : ''}`}
                                                linha2={`${it.restantes} de ${it.quantidade_sessoes} ${it.quantidade_sessoes === 1 ? 'sessão restante' : 'sessões restantes'} · vendido em ${dataVenda}`} />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Serviços sem venda (agendamentos antigos) */}
                        {servicosAvulsos.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {servicosAvulsos.map((id) => (
                                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--secondary))] py-1 pl-3 pr-1 text-sm">
                                        {servicoPorId.get(id)?.nome ?? 'Serviço'}
                                        <button type="button" aria-label="Tirar" className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-black/5"
                                            onClick={() => { setServicosAvulsos((l) => l.filter((x) => x !== id)); setDuracaoManual(false); }}>
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                        {livreSalvo && !temLivreNovo && (
                            <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                                <PenLine className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                                <Input className="h-9 flex-1" value={livreSalvo.titulo} onChange={(e) => setLivreSalvo({ ...livreSalvo, titulo: e.target.value })} />
                                <button type="button" aria-label="Tirar serviço sem cadastro" onClick={() => setLivreSalvo(null)} className="p-1 text-[hsl(var(--muted-foreground))]"><X className="h-4 w-4" /></button>
                            </div>
                        )}

                        {/* 3. Adicionar serviço (vendido agora) */}
                        <div className="space-y-2">
                            <Label className="block">{novos.length ? 'Vendido agora' : 'Novo serviço (vendido agora)'}</Label>
                            {novos.length > 0 && (
                                <ul className="divide-y rounded-lg border">
                                    {novos.map((n) => (
                                        <li key={n.chave} className="space-y-2 p-3">
                                            <div className="flex items-start gap-2">
                                                {n.tipo === 'pacote' ? <Package className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /> : n.tipo === 'livre' ? <PenLine className="mt-2.5 h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" /> : <span className="h-4 w-4 shrink-0" />}
                                                {n.tipo === 'livre' ? (
                                                    <Input className="h-9 flex-1" placeholder="Nome (ex.: Avaliação)" maxLength={120} value={n.nome}
                                                        autoFocus onChange={(e) => alterarNovo(n.chave, { nome: e.target.value })} />
                                                ) : (
                                                    <p className="min-w-0 flex-1 text-sm font-medium">{n.nome}{n.tipo === 'pacote' ? ` · ${n.sessoes} sessões` : ''}</p>
                                                )}
                                                <button type="button" aria-label={`Tirar ${n.nome || 'serviço'}`} onClick={() => { setNovos((l) => l.filter((x) => x.chave !== n.chave)); setDuracaoManual(false); }}
                                                    className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 sm:pl-6">
                                                {n.tipo === 'livre' && (
                                                    <label className="space-y-1 text-xs text-[hsl(var(--muted-foreground))]">
                                                        Duração (min)
                                                        <Input type="number" min={5} inputMode="numeric" value={n.duracao} onChange={(e) => { alterarNovo(n.chave, { duracao: e.target.value }); setDuracaoManual(false); }} />
                                                    </label>
                                                )}
                                                <label className={cn('space-y-1 text-xs text-[hsl(var(--muted-foreground))]', n.tipo !== 'livre' && 'col-span-2 sm:col-span-1')}>
                                                    {n.tipo === 'pacote' ? 'Valor do pacote' : n.tipo === 'livre' ? 'Valor (opcional)' : 'Valor da sessão'}
                                                    <Input inputMode="decimal" placeholder="0,00" value={n.valor} onChange={(e) => alterarNovo(n.chave, { valor: maskMoney(e.target.value) })} />
                                                </label>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {buscando ? (
                                <div className="rounded-lg border">
                                    <div className="flex items-center gap-2 border-b px-3">
                                        <Search className="h-4 w-4 shrink-0 text-gray-400" />
                                        <input autoFocus value={buscaServico} onChange={(e) => setBuscaServico(e.target.value)} placeholder="Buscar serviço ou pacote…"
                                            className="h-10 w-full bg-transparent text-sm outline-none" />
                                        <button type="button" aria-label="Fechar busca" onClick={() => { setBuscando(false); setBuscaServico(''); }} className="p-1 text-gray-400"><X className="h-4 w-4" /></button>
                                    </div>
                                    <ul className="max-h-64 overflow-y-auto py-1">
                                        {!temLivreNovo && (
                                            <li>
                                                <button type="button" onClick={() => adicionarNovo('livre')}
                                                    className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left text-sm font-medium hover:bg-[hsl(var(--accent))]">
                                                    <PenLine className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" />
                                                    <span className="flex-1">Serviço sem cadastro</span>
                                                    <span className="text-xs font-normal text-gray-500">descrição e valor</span>
                                                </button>
                                            </li>
                                        )}
                                        {catalogo.map((x) => (
                                            <li key={x.chave}>
                                                <button type="button" onClick={() => adicionarNovo(x)}
                                                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-[hsl(var(--accent))]">
                                                    {x.tipo === 'pacote' ? <Package className="h-4 w-4 shrink-0 text-blue-600" /> : <span className="w-4 shrink-0" />}
                                                    <span className="min-w-0 flex-1">{x.nome}</span>
                                                    <span className="shrink-0 text-xs tabular-nums text-gray-500">{x.tipo === 'pacote' ? `${x.sessoes} sessões · ` : `${x.duracao} min · `}{brl(x.centavos)}</span>
                                                </button>
                                            </li>
                                        ))}
                                        {!catalogo.length && <li className="px-3 py-3 text-sm text-gray-500">Nenhum serviço com esse nome.</li>}
                                    </ul>
                                </div>
                            ) : (
                                <button type="button" onClick={() => setBuscando(true)}
                                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed px-3 py-1.5 text-sm text-gray-600 hover:bg-[hsl(var(--accent))]">
                                    <Plus className="h-4 w-4" /> {novos.length ? 'Adicionar outro' : 'Adicionar serviço'}
                                </button>
                            )}
                        </div>

                        {/* 4. Data, início, duração e fim */}
                        <div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4">
                            <div className="col-span-2 min-w-0 space-y-1.5 sm:col-span-1">
                                <Label>Data *</Label>
                                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                            </div>
                            <div className="col-span-2 grid min-w-0 grid-cols-2 gap-3 sm:col-span-1 sm:gap-4">
                                <div className="min-w-0 space-y-1.5">
                                    <Label>Início *</Label>
                                    <Input type="time" step={300} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                                </div>
                                <div className="min-w-0 space-y-1.5">
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
                            <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
                                {[30, 45, 60, 75, 90, 120].map((m) => (
                                    <button key={m} type="button" onClick={() => { setDuracao(m); setDuracaoManual(true); }}
                                        className={cn('h-9 rounded-full border px-3 text-sm tabular-nums transition-colors', duracao === m ? 'border-transparent bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))]')}>
                                        {m}
                                    </button>
                                ))}
                                <Input type="number" min={5} max={600} step={5} aria-label="Outra duração em minutos" className="col-span-2 h-9 sm:w-24"
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
                                        <p className="w-full text-xs text-[hsl(var(--muted-foreground))]">
                                            Datas com conflito são puladas. Serviço vendido agora conta uma sessão por data; pacote cobre as datas até acabar.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ) : inicial.id_recorrencia ? (
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <input type="checkbox" checked={aplicarProximas} onChange={(e) => setAplicarProximas(e.target.checked)} />
                                Aplicar também às próximas sessões desta série
                            </label>
                        ) : null}

                        {/* 5. Pagamento do que foi vendido agora */}
                        {totalVenda > 0 && (
                            <div className="space-y-3 rounded-lg border bg-[hsl(var(--muted))]/30 p-3">
                                <div className="flex items-baseline justify-between gap-2">
                                    <p className="text-sm font-semibold">Pagamento</p>
                                    <p className="text-right text-sm tabular-nums">
                                        Total <span className="text-base font-semibold">{brl(totalVenda)}</span>
                                        {nDatas > 1 && novos.some((n) => n.tipo !== 'pacote') && <span className="block text-xs text-[hsl(var(--muted-foreground))]">avulsos × {nDatas} datas</span>}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button" onClick={() => setPagarAgora(false)}
                                        className={cn('rounded-lg border px-3 py-2 text-sm', !pagarAgora ? 'border-[hsl(var(--primary))] bg-white font-medium ring-1 ring-[hsl(var(--primary))]' : 'bg-white')}>
                                        Receber depois
                                    </button>
                                    <button type="button"
                                        onClick={() => { setPagarAgora(true); if (!pagamentos.length) setPagamentos([{ chave: chave(), id_forma: formas[0] ? String(formas[0].id) : '', valor: mascara(totalVenda), parcelas: '1', pago: true }]); }}
                                        className={cn('rounded-lg border px-3 py-2 text-sm', pagarAgora ? 'border-[hsl(var(--primary))] bg-white font-medium ring-1 ring-[hsl(var(--primary))]' : 'bg-white')}>
                                        Informar agora
                                    </button>
                                </div>
                                {!pagarAgora ? (
                                    <p className="text-xs text-[hsl(var(--muted-foreground))]">Fica a receber em Vendas e Financeiro; a forma de pagamento é escolhida na baixa.</p>
                                ) : (
                                    <>
                                        {pagamentos.map((p) => (
                                            <div key={p.chave} className="space-y-2 rounded-lg border bg-white p-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <select aria-label="Forma de pagamento" className={cn(selectCls, 'col-span-2 sm:col-span-1')} value={p.id_forma} onChange={(e) => alterarPagamento(p.chave, { id_forma: e.target.value })}>
                                                        <option value="">Forma…</option>
                                                        {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                                    </select>
                                                    <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
                                                        <Input type="number" min={1} max={48} inputMode="numeric" aria-label="Parcelas" className="w-16" value={p.parcelas} onChange={(e) => alterarPagamento(p.chave, { parcelas: e.target.value })} />
                                                        <span className="text-sm text-gray-500">{p.parcelas === '1' ? 'à vista' : 'parcelas'}</span>
                                                        {pagamentos.length > 1 && (
                                                            <Input inputMode="decimal" aria-label="Valor desta forma" value={p.valor} onChange={(e) => alterarPagamento(p.chave, { valor: maskMoney(e.target.value) })} />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    {p.parcelas === '1' ? (
                                                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                                                            <input type="checkbox" checked={p.pago} onChange={(e) => alterarPagamento(p.chave, { pago: e.target.checked })} /> Já recebido
                                                        </label>
                                                    ) : (
                                                        <span className="text-xs text-gray-500">{p.parcelas}x de {brl(Math.floor(paraCentavos(p.valor) / (Number(p.parcelas) || 1)))}</span>
                                                    )}
                                                    {pagamentos.length > 1 && (
                                                        <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setPagamentos((ps) => ps.filter((x) => x.chave !== p.chave))}>Tirar</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <button type="button" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline"
                                                onClick={() => setPagamentos((ps) => [...ps, { chave: chave(), id_forma: '', valor: mascara(Math.max(falta, 0)), parcelas: '1', pago: false }])}>
                                                <Plus className="h-4 w-4" /> Dividir em outra forma
                                            </button>
                                            {pagamentos.length > 1 && (
                                                <span className={cn('inline-flex items-center gap-1 text-sm font-medium tabular-nums', falta === 0 ? 'text-emerald-700' : 'text-amber-700')}>
                                                    {falta === 0 ? <><Check className="h-4 w-4" /> Fecha o total</> : falta > 0 ? `Falta ${brl(falta)}` : `Passou ${brl(-falta)}`}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label>Observações</Label>
                            <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                        </div>
                    </fieldset>

                    {conflito && (
                        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="flex-1">
                                <p className="font-medium">Não foi possível agendar</p>
                                <p>{conflito}</p>
                            </div>
                            {podeForcar && (
                                <Button type="button" size="sm" variant="outline" onClick={() => salvar(true)} disabled={salvando}>Agendar mesmo assim</Button>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit" disabled={salvando || semCliente}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Agendar'}</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Item já comprado pelo cliente (marcável). */
const PAGAMENTO_INFO = {
    PAGO: { label: 'Pago', cor: 'text-emerald-600' },
    PENDENTE: { label: 'Pagamento pendente', cor: 'text-amber-500' },
    ATRASADO: { label: 'Pagamento em atraso', cor: 'text-red-600' },
} as const;

function CartaoItem({ ativo, onClick, titulo, linha1, linha2, pacote, pagamento }: { ativo: boolean; onClick: () => void; titulo: string; linha1: string; linha2: string; pacote?: boolean; pagamento?: keyof typeof PAGAMENTO_INFO | null }) {
    const pg = pagamento ? PAGAMENTO_INFO[pagamento] : null;
    return (
        <button type="button" onClick={onClick} aria-pressed={ativo}
            className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors',
                ativo ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 ring-1 ring-[hsl(var(--primary))]' : 'hover:bg-[hsl(var(--accent))]')}>
            <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border', ativo && 'border-transparent bg-[hsl(var(--primary))] text-white')}>
                {ativo && <Check className="h-3.5 w-3.5" />}
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                    {pacote && <Package className="h-3.5 w-3.5 shrink-0 text-blue-600" />}
                    <span className="min-w-0 flex-1 truncate">{titulo}</span>
                    {pg && (
                        <span className={cn('inline-flex shrink-0 items-center', pg.cor)} title={pg.label} aria-label={pg.label}>
                            <CircleDollarSign className="h-4 w-4" />
                        </span>
                    )}
                </span>
                {pg && pagamento !== 'PAGO' && <span className={cn('block text-xs font-medium', pg.cor)}>{pg.label}</span>}
                <span className="block text-xs text-[hsl(var(--foreground))]/80">{linha1}</span>
                {linha2 && <span className="block text-xs text-[hsl(var(--muted-foreground))]">{linha2}</span>}
            </span>
        </button>
    );
}
