import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, type View, type SlotInfo } from 'react-big-calendar';
import withDragAndDrop, { type EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '@/styles/agenda.css';
import { addDays, endOfMonth, endOfWeek, format, getDay, parse, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, BellRing, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { trpc } from '@/services/trpc';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/components/ui/confirm-delete-dialog';
import { Button } from '@/components/ui/button';
import { AgendamentoForm, type AgendamentoInicial } from '@/components/agenda/AgendamentoForm';
import { AgendamentoDetalhe, nomesAtendimento, type EventoAgenda } from '@/components/agenda/AgendamentoDetalhe';
import { BloqueioForm } from '@/components/agenda/BloqueioForm';
import { ExpedienteDialog } from '@/components/agenda/ExpedienteDialog';
import { LembretesDialog } from '@/components/agenda/LembretesDialog';
import { AgendaLista } from '@/components/agenda/AgendaLista';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useEscopo } from '@/hooks/useEscopo';
import { FaixaSemana } from '@/components/agenda/FaixaSemana';
import { STATUS_ABERTOS, STATUS_INFO, corPadrao, dataISO, horaHHMM, minutos, paraDate, type StatusAtendimento } from '@/lib/agenda';
import { cn } from '@/lib/utils';

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
    getDay,
    locales: { 'pt-BR': ptBR },
});

type Recurso = { id: number; titulo: string; cor: string };
type Evento = {
    id: string;
    title: string;
    start: Date;
    end: Date;
    resourceId?: number;
    tipo: 'atendimento' | 'bloqueio';
    atendimento?: EventoAgenda;
    bloqueio?: { id: number; motivo: string | null; id_profissional: number | null; id_sala: number | null };
    cor: string;
};

const DnDCalendar = withDragAndDrop<Evento, Recurso>(Calendar as any);

const VIEWS: { id: View; label: string }[] = [
    { id: 'day', label: 'Dia' },
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Mês' },
    { id: 'agenda', label: 'Lista' },
];

const MENSAGENS = {
    date: 'Data', time: 'Hora', event: 'Atendimento', allDay: 'Dia todo', week: 'Semana', work_week: 'Semana útil',
    day: 'Dia', month: 'Mês', previous: 'Anterior', next: 'Próximo', yesterday: 'Ontem', tomorrow: 'Amanhã',
    today: 'Hoje', agenda: 'Lista', noEventsInRange: 'Nenhum atendimento neste período.',
    showMore: (total: number) => `+${total} mais`,
};

function periodo(view: View, data: Date): [Date, Date] {
    if (view === 'day') return [data, data];
    if (view === 'week') return [startOfWeek(data, { weekStartsOn: 1 }), endOfWeek(data, { weekStartsOn: 1 })];
    if (view === 'month') return [startOfWeek(startOfMonth(data), { weekStartsOn: 1 }), endOfWeek(endOfMonth(data), { weekStartsOn: 1 })];
    return [data, addDays(data, 30)];
}

function tituloPeriodo(view: View, data: Date) {
    if (view === 'day') return format(data, "EEEE, d 'de' MMMM", { locale: ptBR });
    if (view === 'month') return format(data, "MMMM 'de' yyyy", { locale: ptBR });
    const [a, b] = periodo(view, data);
    return `${format(a, 'd MMM', { locale: ptBR })} – ${format(b, "d MMM yyyy", { locale: ptBR })}`;
}

export default function Agenda() {
    const { user, isAdmin } = useAuth();
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();

    const mobile = useIsMobile();
    const [view, setView] = useState<View>(() => (window.innerWidth < 768 ? 'day' : 'week'));
    const [data, setData] = useState(new Date());
    const [colunas, setColunas] = useState<'profissional' | 'sala'>('profissional');
    const [selProfsEscolhidos, setSelProfs] = useState<number[]>([]);
    // Admin em "Só meu": mostra só a agenda dele (a chave fica no cabeçalho)
    const { escopo } = useEscopo();
    const soMeu = escopo === 'MEU' && !!user?.id;
    const selProfs = soMeu ? [user!.id] : selProfsEscolhidos;

    const [form, setForm] = useState<{ open: boolean; inicial: AgendamentoInicial }>({ open: false, inicial: {} });
    const [detalhe, setDetalhe] = useState<EventoAgenda | null>(null);
    const [bloqueio, setBloqueio] = useState<{ open: boolean; inicial?: any }>({ open: false });
    const [expediente, setExpediente] = useState(false);
    const [lembretes, setLembretes] = useState(false);
    /** Posição otimista enquanto o servidor confirma um arrastar/redimensionar. */
    const [movendo, setMovendo] = useState<Record<number, { start: Date; end: Date; resourceId?: number }>>({});

    // No celular o "Dia" busca a semana inteira para a faixa de dias mostrar os pontos
    const [de, ate] = mobile && view === 'day' ? periodo('week', data) : periodo(view, data);
    const profsQ = trpc.agenda.profissionais.list.useQuery();
    const salasQ = trpc.agenda.salas.list.useQuery();
    const eventosQ = trpc.agenda.eventos.useQuery({
        de: dataISO(de),
        ate: dataISO(ate),
        profissionais: selProfs.length ? selProfs : undefined,
    });

    const profissionais = (profsQ.data ?? []) as { id: number; nome: string; cor: string | null; telefone: string | null; intervalo_agenda_min: number }[];
    const salas = (salasQ.data ?? []) as { id: number; nome: string; cor: string | null }[];
    const corProf = useCallback((id: number) => corPadrao(id, profissionais.find((p) => p.id === id)?.cor), [profissionais]);
    const eu = profissionais.find((p) => p.id === user?.id);

    const profsVisiveis = selProfs.length ? profissionais.filter((p) => selProfs.includes(p.id)) : profissionais;
    const usarRecursos = view === 'day' && profsVisiveis.length > 1;
    const recursos: Recurso[] | undefined = !usarRecursos
        ? undefined
        : colunas === 'profissional'
          ? profsVisiveis.map((p) => ({ id: p.id, titulo: p.nome, cor: corPadrao(p.id, p.cor) }))
          : [...salas.map((s) => ({ id: s.id, titulo: s.nome, cor: corPadrao(s.id, s.cor) })), { id: 0, titulo: 'Sem sala', cor: '#94a3b8' }];

    const dados = eventosQ.data as { atendimentos: EventoAgenda[]; bloqueios: any[]; horarios: any[] } | undefined;

    const eventos: Evento[] = useMemo(
        () =>
            (dados?.atendimentos ?? []).map((a) => {
                const m = movendo[a.id];
                return {
                    id: `a${a.id}`,
                    title: a.restrito ? 'Ocupado' : a.pessoa_nome,
                    start: m?.start ?? paraDate(a.data, a.hora_inicio),
                    end: m?.end ?? paraDate(a.data, a.hora_fim),
                    resourceId: m?.resourceId ?? (colunas === 'profissional' ? a.id_profissional : a.id_sala ?? 0),
                    tipo: 'atendimento',
                    atendimento: a,
                    cor: corProf(a.id_profissional),
                };
            }),
        [dados, movendo, colunas, corProf],
    );

    // Bloqueios viram eventos de fundo, quebrados por dia e replicados nas colunas a que se aplicam
    const fundos: Evento[] = useMemo(() => {
        const lista: Evento[] = [];
        for (const b of dados?.bloqueios ?? []) {
            const ini = new Date(b.inicio.replace(' ', 'T'));
            const fim = new Date(b.fim.replace(' ', 'T'));
            const geral = b.id_profissional == null && b.id_sala == null;
            let alvos: (number | undefined)[] = [undefined];
            if (usarRecursos && recursos) {
                if (geral) alvos = recursos.map((r) => r.id);
                else if (colunas === 'profissional' && b.id_profissional != null) alvos = [b.id_profissional];
                else if (colunas === 'sala' && b.id_sala != null) alvos = [b.id_sala];
                else continue;
            } else if (b.id_profissional != null && selProfs.length && !selProfs.includes(b.id_profissional)) continue;
            const nomeAlvo = b.id_profissional != null ? profissionais.find((p) => p.id === b.id_profissional)?.nome
                : b.id_sala != null ? salas.find((s) => s.id === b.id_sala)?.nome : 'Clínica';
            for (let d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()); d < fim; d = addDays(d, 1)) {
                const s = d < ini ? ini : d;
                const fimDia = addDays(d, 1);
                const e = fim < fimDia ? fim : new Date(fimDia.getTime() - 60_000);
                if (e <= s) continue;
                for (const r of alvos) {
                    lista.push({
                        id: `b${b.id}-${dataISO(d)}-${r ?? ''}`,
                        title: `${b.motivo || 'Bloqueado'}${!usarRecursos ? ` · ${nomeAlvo}` : ''}`,
                        start: s,
                        end: e,
                        resourceId: r,
                        tipo: 'bloqueio',
                        bloqueio: b,
                        cor: '#94a3b8',
                    });
                }
            }
        }
        return lista;
    }, [dados, usarRecursos, recursos, colunas, selProfs, profissionais, salas]);

    // expediente por profissional: dia_semana -> [inicio, fim][]
    const expedientes = useMemo(() => {
        const m = new Map<number, Map<number, [number, number][]>>();
        for (const h of dados?.horarios ?? []) {
            const porDia = m.get(h.id_profissional) ?? new Map();
            const l = porDia.get(h.dia_semana) ?? [];
            l.push([minutos(h.hora_inicio), minutos(h.hora_fim)]);
            porDia.set(h.dia_semana, l);
            m.set(h.id_profissional, porDia);
        }
        return m;
    }, [dados]);

    const [minHora, maxHora] = useMemo(() => {
        let ini = 8 * 60;
        let fim = 19 * 60;
        for (const h of dados?.horarios ?? []) {
            ini = Math.min(ini, minutos(h.hora_inicio));
            fim = Math.max(fim, minutos(h.hora_fim));
        }
        for (const a of dados?.atendimentos ?? []) {
            ini = Math.min(ini, minutos(a.hora_inicio));
            fim = Math.max(fim, minutos(a.hora_fim));
        }
        const base = new Date(2000, 0, 1);
        return [
            new Date(base.getTime() + Math.floor(ini / 60) * 3_600_000),
            new Date(base.getTime() + Math.min(24 * 60 - 1, Math.ceil(fim / 60) * 60) * 60_000),
        ];
    }, [dados]);

    const trabalhando = useCallback(
        (idProf: number, d: Date) => {
            const periodos = expedientes.get(idProf)?.get(d.getDay()) ?? [];
            const m = d.getHours() * 60 + d.getMinutes();
            return periodos.some(([i, f]) => m >= i && m < f);
        },
        [expedientes],
    );

    const slotPropGetter = useCallback(
        (d: Date, resourceId?: number | string) => {
            let aberto: boolean;
            if (usarRecursos && colunas === 'profissional' && resourceId != null) aberto = trabalhando(Number(resourceId), d);
            else aberto = profsVisiveis.some((p) => trabalhando(p.id, d));
            return aberto ? {} : { className: 'rbc-fora-expediente' };
        },
        [usarRecursos, colunas, trabalhando, profsVisiveis],
    );

    const atualizarMut = trpc.agenda.atualizar.useMutation();

    const podeMexer = (e: Evento) =>
        e.tipo === 'atendimento' && !!e.atendimento && !e.atendimento.restrito && STATUS_ABERTOS.includes(e.atendimento.status);

    async function mover({ event, start, end, resourceId }: EventInteractionArgs<Evento>) {
        if (!podeMexer(event)) return;
        const a = event.atendimento!;
        const s = new Date(start);
        const e = new Date(end);
        if (dataISO(s) !== dataISO(new Date(e.getTime() - 1))) return toast({ title: 'O atendimento precisa terminar no mesmo dia', variant: 'error' });
        const rid = resourceId != null ? Number(resourceId) : undefined;
        setMovendo((m) => ({ ...m, [a.id]: { start: s, end: e, resourceId: rid ?? event.resourceId } }));
        try {
            await atualizarMut.mutateAsync({
                id: a.id,
                data: dataISO(s),
                hora_inicio: horaHHMM(s),
                hora_fim: horaHHMM(e),
                ...(usarRecursos && rid != null && colunas === 'profissional' && rid !== a.id_profissional ? { id_profissional: rid } : {}),
                ...(usarRecursos && rid != null && colunas === 'sala' && rid !== (a.id_sala ?? 0) ? { id_sala: rid || null } : {}),
            });
            await utils.agenda.eventos.invalidate();
            toast({ title: 'Agendamento movido', variant: 'success' });
        } catch (err: any) {
            toast({ title: 'Não foi possível mover', description: err.message, variant: 'error' });
        } finally {
            setMovendo((m) => {
                const n = { ...m };
                delete n[a.id];
                return n;
            });
        }
    }

    function novoNoSlot(slot: SlotInfo) {
        const s = slot.start as Date;
        const e = slot.end as Date;
        const rid = (slot as any).resourceId as number | undefined;
        const diaInteiro = view === 'month' || (e.getTime() - s.getTime()) % 86_400_000 === 0 && s.getHours() === 0;
        const idProf = usarRecursos && colunas === 'profissional' && rid ? rid : selProfs.length === 1 ? selProfs[0] : user?.id;
        if (!isAdmin && idProf !== user?.id) return toast({ title: 'Você só pode agendar na sua própria agenda' });
        const duracao = (e.getTime() - s.getTime()) / 60_000;
        setForm({
            open: true,
            inicial: {
                data: dataISO(s),
                hora_inicio: diaInteiro ? undefined : horaHHMM(s),
                hora_fim: !diaInteiro && duracao > (eu?.intervalo_agenda_min ?? 30) ? horaHHMM(e) : undefined,
                id_profissional: idProf,
                id_sala: usarRecursos && colunas === 'sala' && rid ? rid : null,
            },
        });
    }

    const removerBloqueio = trpc.agenda.bloqueios.delete.useMutation({
        onSuccess: () => { utils.agenda.eventos.invalidate(); toast({ title: 'Bloqueio removido', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    async function selecionar(e: Evento) {
        if (e.tipo === 'atendimento') return setDetalhe(e.atendimento!);
        return perguntarRemoverBloqueio(e.bloqueio!);
    }

    async function perguntarRemoverBloqueio(b: { id: number; motivo: string | null; id_profissional: number | null }) {
        if (!isAdmin && b.id_profissional !== user?.id) return;
        const ok = await confirm({
            title: 'Remover bloqueio?',
            description: `${b.motivo || 'Bloqueio'} — o horário volta a ficar disponível para agendamento.`,
            confirmLabel: 'Remover',
            variant: 'warning',
        });
        if (ok) removerBloqueio.mutate({ id: b.id });
    }

    function navegar(dir: -1 | 0 | 1) {
        if (dir === 0) return setData(new Date());
        const passo = view === 'day' ? 1 : view === 'week' ? 7 : view === 'agenda' ? 30 : 0;
        if (passo) setData((d) => addDays(d, dir * passo));
        else setData((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
    }

    // teclado: ← → navegam, T = hoje
    useEffect(() => {
        const h = (ev: KeyboardEvent) => {
            const alvo = ev.target as HTMLElement;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || document.querySelector('[role="dialog"]')) return;
            if (ev.key === 'ArrowLeft') navegar(-1);
            else if (ev.key === 'ArrowRight') navegar(1);
            else if (ev.key.toLowerCase() === 't') navegar(0);
        };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    });

    const passoMin = Math.min(...profsVisiveis.map((p) => p.intervalo_agenda_min ?? 30), 30);

    const novoAgendamento = (hora?: string) =>
        setForm({ open: true, inicial: { data: dataISO(data), hora_inicio: hora, id_profissional: selProfs.length === 1 && isAdmin ? selProfs[0] : user?.id } });

    const chipsProfissionais = (
        <>
            <button type="button" onClick={() => setSelProfs([])}
                className={cn('shrink-0 rounded-full border px-3 py-1.5', !selProfs.length ? 'border-gray-900 bg-gray-900 text-white' : 'hover:bg-[hsl(var(--accent))]')}>
                Todos
            </button>
            {profissionais.map((p) => {
                const ativo = selProfs.includes(p.id);
                const cor = corPadrao(p.id, p.cor);
                return (
                    <button key={p.id} type="button"
                        onClick={() => setSelProfs((s) => (ativo ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                        className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors', ativo ? 'text-white' : 'hover:bg-[hsl(var(--accent))]')}
                        style={ativo ? { background: cor, borderColor: cor } : undefined}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ativo ? '#fff' : cor }} />
                        {p.nome.split(' ')[0]}
                    </button>
                );
            })}
        </>
    );

    const dialogos = (
        <>
            <AgendamentoForm open={form.open} onOpenChange={(v) => setForm((f) => ({ ...f, open: v }))} inicial={form.inicial} />
            <AgendamentoDetalhe
                evento={detalhe}
                onOpenChange={(v) => !v && setDetalhe(null)}
                onEditar={(e) => {
                    setDetalhe(null);
                    setForm({
                        open: true,
                        inicial: {
                            id: e.id,
                            id_recorrencia: e.id_recorrencia,
                            id_pessoa: e.id_pessoa,
                            pessoa_nome: e.pessoa_nome,
                            id_profissional: e.id_profissional,
                            id_sala: e.id_sala,
                            data: e.data,
                            hora_inicio: e.hora_inicio,
                            hora_fim: e.hora_fim,
                            servicos: e.servicos.map((s) => s.id),
                            id_venda: e.id_venda,
                            id_venda_item: e.id_venda_item,
                            venda_rotulo: e.venda_rotulo,
                            itens_ids: e.itens_ids ? String(e.itens_ids).split(',').map(Number) : [],
                            titulo_extra: e.titulo_extra,
                            duracao_extra: e.duracao_extra,
                            id_venda_extra: e.id_venda_extra,
                            observacoes: e.observacoes,
                        },
                    });
                }}
            />
            <BloqueioForm open={bloqueio.open} onOpenChange={(v) => setBloqueio((b) => ({ ...b, open: v }))} inicial={bloqueio.inicial} />
            <ExpedienteDialog open={expediente} onOpenChange={setExpediente} profissional={eu ?? null} admin={isAdmin} />
            <LembretesDialog open={lembretes} onOpenChange={setLembretes} />
        </>
    );

    const calendario = (
        <DnDCalendar
            localizer={localizer}
            culture="pt-BR"
            messages={MENSAGENS}
            toolbar={false}
            view={view}
            onView={setView}
            views={['day', 'week', 'month', 'agenda']}
            date={data}
            onNavigate={(d) => setData(d)}
            events={eventos}
            backgroundEvents={fundos}
            resources={recursos}
            resourceIdAccessor={(r) => r.id}
            resourceTitleAccessor={(r) => r.titulo}
            min={minHora}
            max={maxHora}
            step={passoMin <= 15 ? passoMin : 15}
            timeslots={passoMin <= 15 ? Math.round(60 / passoMin) : 4}
            scrollToTime={new Date(2000, 0, 1, Math.max(minHora.getHours(), new Date().getHours() - 1))}
            selectable
            longPressThreshold={250}
            onSelectSlot={novoNoSlot}
            onSelectEvent={(e) => selecionar(e)}
            onEventDrop={mover}
            onEventResize={mover}
            draggableAccessor={podeMexer}
            resizableAccessor={podeMexer}
            resizable
            popup
            dayLayoutAlgorithm="no-overlap"
            slotPropGetter={slotPropGetter as any}
            formats={{
                timeGutterFormat: 'HH:mm',
                eventTimeRangeFormat: ({ start, end }) => `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`,
                agendaTimeRangeFormat: ({ start, end }) => `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`,
                dayFormat: (d) => format(d, 'EEE dd/MM', { locale: ptBR }),
                agendaDateFormat: (d) => format(d, "EEE, dd/MM", { locale: ptBR }),
            }}
            eventPropGetter={(e) => {
                if (e.tipo === 'bloqueio') return { className: 'evt-bloqueio' };
                const a = e.atendimento!;
                const restrito = a.restrito;
                return {
                    className: cn('evt-atendimento', `evt-${a.status.toLowerCase()}`, restrito && 'evt-restrito'),
                    style: { '--evt-cor': restrito ? '#94a3b8' : e.cor } as React.CSSProperties,
                };
            }}
            components={{
                event: ({ event }: { event: Evento }) => {
                    if (event.tipo === 'bloqueio') return <span className="text-[11px] font-medium">{event.title}</span>;
                    const a = event.atendimento!;
                    return (
                        <div className="leading-tight">
                            <div className="flex items-center gap-1">
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_INFO[a.status as StatusAtendimento].ponto)} />
                                <span className="truncate font-semibold">{event.title}</span>
                            </div>
                            {!a.restrito && nomesAtendimento(a) && (
                                <div className="truncate opacity-80">{nomesAtendimento(a)}</div>
                            )}
                            {view !== 'day' && <div className="truncate opacity-70">{a.profissional_nome.split(' ')[0]}{a.sala_nome ? ` · ${a.sala_nome}` : ''}</div>}
                        </div>
                    );
                },
            }}
        />
    );

    if (mobile) {
        const t = view === 'day' ? format(data, "EEEE, d 'de' MMM", { locale: ptBR }) : tituloPeriodo(view, data);
        const titulo = t.charAt(0).toUpperCase() + t.slice(1);
        return (
            <div className="flex flex-col gap-3">
                {/* Navegação do dia */}
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Anterior" onClick={() => navegar(-1)}><ChevronLeft className="h-5 w-5" /></Button>
                    <label className="relative min-w-0 flex-1 text-center">
                        <span className="block truncate text-lg font-semibold">{titulo}</span>
                        <input type="date" aria-label="Escolher data" value={dataISO(data)}
                            onChange={(e) => e.target.value && setData(paraDate(e.target.value))}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                    </label>
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Próximo" onClick={() => navegar(1)}><ChevronRight className="h-5 w-5" /></Button>
                    {dataISO(data) !== dataISO(new Date()) && (
                        <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => navegar(0)}>Hoje</Button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border p-0.5">
                        {([['day', 'Dia'], ['week', 'Sem.'], ['month', 'Mês'], ['agenda', 'Lista']] as [View, string][]).map(([v, rotulo]) => (
                            <button key={v} type="button" onClick={() => setView(v)} aria-label={v === 'week' ? 'Semana' : undefined}
                                className={cn('rounded-md px-2.5 py-1.5 text-sm', view === v ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))]')}>
                                {rotulo}
                            </button>
                        ))}
                    </div>
                    <div className="ml-auto flex">
                        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Lembretes por WhatsApp" onClick={() => setLembretes(true)}><BellRing className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Bloquear horário" onClick={() => setBloqueio({ open: true, inicial: { data: dataISO(data) } })}><Ban className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Meu expediente" onClick={() => setExpediente(true)} disabled={!eu}><Clock className="h-5 w-5" /></Button>
                    </div>
                </div>

                {profissionais.length > 1 && !soMeu && (
                    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm scrollbar-thin">{chipsProfissionais}</div>
                )}

                {view === 'day' ? (
                    <div className="space-y-2">
                        <FaixaSemana data={data} onData={setData} atendimentos={dados?.atendimentos ?? []} />
                        <div className={cn('agenda-studio h-[68vh] min-h-[420px] rounded-lg border bg-white', eventosQ.isFetching && 'opacity-90')}>
                            {calendario}
                        </div>
                    </div>
                ) : view === 'week' || view === 'agenda' ? (
                    <AgendaLista
                        de={de}
                        ate={ate}
                        mostrarVazios={view === 'week'}
                        atendimentos={dados?.atendimentos ?? []}
                        bloqueios={dados?.bloqueios ?? []}
                        profissionais={profissionais}
                        visiveis={profsVisiveis}
                        carregando={eventosQ.isLoading}
                        onAbrir={setDetalhe}
                        onDia={(d) => { setData(d); setView('day'); }}
                        onBloqueio={perguntarRemoverBloqueio}
                    />
                ) : (
                    <div className="agenda-studio h-[70vh] rounded-lg border bg-white">
                        <DnDCalendar
                            localizer={localizer}
                            culture="pt-BR"
                            messages={MENSAGENS}
                            toolbar={false}
                            view="month"
                            views={['month']}
                            date={data}
                            onNavigate={(d) => setData(d)}
                            events={eventos}
                            selectable
                            longPressThreshold={250}
                            onSelectSlot={(slot) => { setData(slot.start as Date); setView('day'); }}
                            onSelectEvent={(e) => { setData(e.start); setView('day'); }}
                            onDrillDown={(d) => { setData(d); setView('day'); }}
                            onView={() => undefined}
                            draggableAccessor={() => false}
                            eventPropGetter={(e) => ({
                                className: cn('evt-atendimento', e.atendimento && `evt-${e.atendimento.status.toLowerCase()}`, e.atendimento?.restrito && 'evt-restrito'),
                                style: { '--evt-cor': e.atendimento?.restrito ? '#94a3b8' : e.cor } as React.CSSProperties,
                            })}
                        />
                    </div>
                )}

                {/* Agendar: ao alcance do polegar */}
                <button type="button" onClick={() => novoAgendamento()} aria-label="Novo agendamento"
                    className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--primary))] text-white shadow-[0_8px_24px_-6px_rgb(37_99_235/0.55)] active:scale-95">
                    <Plus className="h-6 w-6" />
                </button>

                {dialogos}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-3">
            {/* Barra superior */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => navegar(0)}>Hoje</Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Anterior" onClick={() => navegar(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Próximo" onClick={() => navegar(1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
                <h2 className="min-w-0 flex-1 truncate text-lg font-semibold capitalize">{tituloPeriodo(view, data)}</h2>

                <div className="flex rounded-md border p-0.5">
                    {VIEWS.map((v) => (
                        <button key={v.id} type="button" onClick={() => setView(v.id)}
                            className={cn('rounded px-3 py-1 text-sm', view === v.id ? 'bg-[hsl(var(--primary))] text-white' : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]')}>
                            {v.label}
                        </button>
                    ))}
                </div>
                <Button size="sm" onClick={() => setForm({ open: true, inicial: { data: dataISO(data), id_profissional: selProfs.length === 1 && isAdmin ? selProfs[0] : user?.id } })}>
                    <Plus className="mr-1 h-4 w-4" /> Agendar
                </Button>
            </div>

            {/* Filtros e ações secundárias */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
                {!soMeu && chipsProfissionais}

                {view === 'day' && salas.length > 0 && (
                    <div className="ml-2 flex items-center gap-1 rounded-md border p-0.5 text-xs">
                        <span className="px-1.5 text-[hsl(var(--muted-foreground))]">Colunas:</span>
                        {(['profissional', 'sala'] as const).map((c) => (
                            <button key={c} type="button" onClick={() => setColunas(c)}
                                className={cn('rounded px-2 py-0.5 capitalize', colunas === c ? 'bg-[hsl(var(--secondary))] font-medium' : 'text-[hsl(var(--muted-foreground))]')}>
                                {c === 'profissional' ? 'Profissionais' : 'Salas'}
                            </button>
                        ))}
                    </div>
                )}

                <div className="ml-auto flex flex-wrap gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setLembretes(true)}><BellRing className="mr-1.5 h-4 w-4" /> Lembretes</Button>
                    <Button variant="ghost" size="sm" onClick={() => setBloqueio({ open: true, inicial: { data: dataISO(data) } })}><Ban className="mr-1.5 h-4 w-4" /> Bloquear</Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpediente(true)} disabled={!eu}><Clock className="mr-1.5 h-4 w-4" /> Meu expediente</Button>
                </div>
            </div>

            {/* Calendário */}
            <div className={cn('agenda-studio min-h-[560px] flex-1 rounded-lg border bg-white', eventosQ.isFetching && 'opacity-90')}>
                {calendario}
            </div>

            {/* Legenda */}
            <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                {(Object.keys(STATUS_INFO) as StatusAtendimento[]).filter((s) => s !== 'CANCELADO').map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', STATUS_INFO[s].ponto)} />{STATUS_INFO[s].label}</span>
                ))}
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm agenda-legenda-fora" /> Fora do expediente</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm agenda-legenda-bloqueio" /> Bloqueado</span>
            </div>

            {dialogos}
        </div>
    );
}
