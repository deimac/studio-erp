import { useEffect, useMemo, useState } from 'react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Check, Repeat, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { somarMinutos } from '@/lib/agenda';

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
    const [fimManual, setFimManual] = useState(false);
    const [servicosSel, setServicosSel] = useState<number[]>([]);
    const [idVenda, setIdVenda] = useState<number | null>(null);
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
        setFimManual(!!inicial.id || (!!inicial.hora_fim && !inicial.servicos));
        setServicosSel(inicial.servicos ?? []);
        setIdVenda(inicial.id_venda ?? null);
        setObservacoes(inicial.observacoes ?? '');
        setRepetir(false);
        setQtdRepeticoes(4);
        setIntervaloSemanas(1);
        setAplicarProximas(false);
        setConflito(null);
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    const clientesQ = trpc.pessoas.listClientes.useQuery(undefined, { enabled: open && !editando });
    const profsQ = trpc.agenda.profissionais.list.useQuery(undefined, { enabled: open });
    const salasQ = trpc.agenda.salas.list.useQuery(undefined, { enabled: open });
    const servicosQ = trpc.servicos.list.useQuery(undefined, { enabled: open });
    const servProfQ = trpc.agenda.profissionais.servicos.useQuery({ id_profissional: idProf }, { enabled: open && !!idProf });
    const vendasQ = trpc.agenda.vendasDoCliente.useQuery({ id_pessoa: idPessoa ?? 0, id_profissional: idProf }, { enabled: open && !!idPessoa });

    const servicosDisponiveis = useMemo(() => {
        // Serviço próprio só serve para o dono; os da clínica seguem a lista "serviços que executa"
        const prof = ((profsQ.data ?? []) as any[]).find((p) => p.id === idProf);
        const usaClinica = !prof || prof.perfil === 'ADMIN' || prof.ve_servicos_clinica;
        const todos = ((servicosQ.data ?? []) as any[]).filter((s) => (s.id_profissional == null && usaClinica) || s.id_profissional === idProf);
        const permitidos = (servProfQ.data ?? []) as number[];
        if (!permitidos.length) return todos;
        return todos.filter((s) => s.id_profissional === idProf || permitidos.includes(s.id) || servicosSel.includes(s.id));
    }, [servicosQ.data, servProfQ.data, servicosSel, idProf, profsQ.data]);

    const duracaoTotal = useMemo(() => {
        const todos = (servicosQ.data ?? []) as any[];
        return servicosSel.reduce((s, id) => s + (todos.find((x) => x.id === id)?.duracao_minutos ?? 0), 0);
    }, [servicosSel, servicosQ.data]);

    // fim automático = início + soma das durações
    useEffect(() => {
        if (!fimManual && horaInicio && duracaoTotal > 0) setHoraFim(somarMinutos(horaInicio, duracaoTotal));
    }, [horaInicio, duracaoTotal, fimManual]);

    const duracaoSugestao = duracaoTotal || 60;
    const livresQ = trpc.agenda.disponibilidade.useQuery(
        { id_profissional: idProf, data, duracao: duracaoSugestao, id_sala: idSala, ignorarId: inicial.id },
        { enabled: open && !!idProf && /^\d{4}-\d{2}-\d{2}$/.test(data) },
    );

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
        if (!servicosSel.length) return toast({ title: 'Escolha ao menos um serviço', variant: 'error' });
        if (!data || !horaInicio) return toast({ title: 'Informe data e horário', variant: 'error' });
        const base = {
            id_profissional: idProf,
            id_sala: idSala,
            data,
            hora_inicio: horaInicio,
            hora_fim: horaFim || undefined,
            servicos: servicosSel,
            id_venda: idVenda,
            forcar,
        };
        if (editando) {
            atualizarMut.mutate({ id: inicial.id, ...base, observacoes: observacoes.trim() || null, aplicarProximas });
        } else {
            criarMut.mutate({
                ...base,
                id_pessoa: idPessoa,
                observacoes: observacoes.trim() || undefined,
                recorrencia: repetir ? { quantidade: qtdRepeticoes, intervalo_semanas: intervaloSemanas } : undefined,
            });
        }
    }

    const toggleServico = (id: number) =>
        setServicosSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

    const vendas = (vendasQ.data ?? []) as any[];
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
                                    <button type="button" className="text-xs text-[hsl(var(--primary))] hover:underline" onClick={() => { setIdPessoa(null); setIdVenda(null); }}>
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

                    {/* Serviços */}
                    <div className="space-y-1.5">
                        <Label>Serviços * {duracaoTotal > 0 && <span className="font-normal text-[hsl(var(--muted-foreground))]">· {duracaoTotal} min</span>}</Label>
                        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-[hsl(var(--input))] p-2">
                            {servicosDisponiveis.map((s: any) => {
                                const ativo = servicosSel.includes(s.id);
                                return (
                                    <button key={s.id} type="button" onClick={() => toggleServico(s.id)}
                                        className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                                            ativo ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))]')}>
                                        {ativo && <Check className="h-3 w-3" />}
                                        {s.nome}{s.nome_modalidade && !s.nome.includes(s.nome_modalidade) ? ` · ${s.nome_modalidade}` : ''}
                                        <span className={ativo ? 'text-white/80' : 'text-[hsl(var(--muted-foreground))]'}>{s.duracao_minutos}′</span>
                                    </button>
                                );
                            })}
                            {!servicosDisponiveis.length && <span className="text-xs text-[hsl(var(--muted-foreground))]">Nenhum serviço ativo</span>}
                        </div>
                    </div>

                    {/* Data e hora */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label>Data *</Label>
                            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Início *</Label>
                            <Input type="time" step={300} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Fim</Label>
                            <Input type="time" step={300} value={horaFim} onChange={(e) => { setHoraFim(e.target.value); setFimManual(true); }} />
                        </div>
                    </div>
                    {data && (
                        <div className="space-y-1">
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Horários livres ({duracaoSugestao} min){livresQ.isLoading ? '…' : ':'}
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {((livresQ.data ?? []) as string[]).map((h) => (
                                    <button key={h} type="button" onClick={() => setHoraInicio(h)}
                                        className={cn('rounded border px-2 py-0.5 text-xs', h === horaInicio ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white' : 'hover:bg-[hsl(var(--accent))]')}>
                                        {h}
                                    </button>
                                ))}
                                {livresQ.data && !(livresQ.data as string[]).length && (
                                    <span className="text-xs text-amber-600">Sem horários livres no expediente deste dia</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Venda / pacote */}
                    {idPessoa && (
                        <div className="space-y-1.5">
                            <Label>Vincular a venda/pacote</Label>
                            <select aria-label="Venda" className={selectCls} value={idVenda ?? ''}
                                onChange={(e) => {
                                    const v = e.target.value ? Number(e.target.value) : null;
                                    setIdVenda(v);
                                    const venda = vendas.find((x) => x.id === v);
                                    if (venda?.id_servico && !servicosSel.length) setServicosSel([venda.id_servico]);
                                }}>
                                <option value="">Avulso (sem venda)</option>
                                {inicial.id_venda && !vendas.some((v) => v.id === inicial.id_venda) && (
                                    <option value={inicial.id_venda}>Venda #{inicial.id_venda} (atual)</option>
                                )}
                                {vendas.map((v) => (
                                    <option key={v.id} value={v.id}>{v.rotulo} — {v.restantes} de {v.quantidade_sessoes} sessões restantes</option>
                                ))}
                            </select>
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
        </Dialog>
    );
}
