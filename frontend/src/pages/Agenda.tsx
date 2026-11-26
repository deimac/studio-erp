import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Calendar, dateFnsLocalizer, type View, type SlotInfo } from 'react-big-calendar';
import withDragAndDrop, { type EventInteractionArgs } from 'react-big-calendar/lib/addons/dragAndDrop';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import '@/styles/agenda.css';
import { addDays, endOfMonth, endOfWeek, format, getDay, parse, startOfMonth, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, BellRing, CalendarPlus, ChevronLeft, ChevronRight, Clock, Lock, PartyPopper, Plus } from 'lucide-react';
import { useAcoesDaTela } from '@/components/acoes/AcoesRapidas';
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
import { layoutIgual } from '@/lib/layoutAgenda';
import { SeletorData } from '@/components/agenda/SeletorData';
import { STATUS_ABERTOS, STATUS_INFO, corPadrao, dataISO, hojeISO, horaHHMM, minutos, paraDate, type StatusAtendimento } from '@/lib/agenda';
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
    tipo: 'atendimento' | 'bloqueio' | 'feriado';
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

const DIA_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

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

const OCUPAM = ['AGENDADO', 'CONFIRMADO', 'REALIZADO'];

export default function Agenda() {
    const { user, isAdmin, veTudo, isEspectador } = useAuth();
    // Espectador: só olha a agenda compartilhada (não marca, não move, não bloqueia)
    const soVer = isEspectador;
    const { toast } = useToast();
    const confirm = useConfirm();
    const utils = trpc.useUtils();

    const mobile = useIsMobile();
    const [view, setView] = useState<View>(() => (window.innerWidth < 768 ? 'day' : 'week'));
    const [data, setData] = useState(new Date());
    const [colunas, setColunas] = useState<'profissional' | 'sala'>('profissional');
    // Abre sempre na agenda de quem está logado; "Todos" mostra todo mundo
    const [selProfsEscolhidos, setSelProfs] = useState<number[]>(() => (user?.id && !isEspectador ? [user.id] : []));
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
    // Quem divide o mesmo espaço: um atendimento de qualquer um ocupa o horário de todos
    const compartilhados = useMemo(
        () => new Set(((profsQ.data ?? []) as { id: number; agenda_compartilhada?: boolean }[]).filter((p) => p.agenda_compartilhada).map((p) => p.id)),
        [profsQ.data],
    );

    const profsVisiveis = selProfs.length ? profissionais.filter((p) => selProfs.includes(p.id)) : profissionais;
    // Colunas por profissional/sala no Dia: só para quem vê tudo; os demais veem uma agenda só (espaço compartilhado)
    const usarRecursos = view === 'day' && profsVisiveis.length > 1 && veTudo;
    const recursos: Recurso[] | undefined = !usarRecursos
        ? undefined
        : colunas === 'profissional'
          ? profsVisiveis.map((p) => ({ id: p.id, titulo: p.nome, cor: corPadrao(p.id, p.cor) }))
          : [...salas.map((s) => ({ id: s.id, titulo: s.nome, cor: corPadrao(s.id, s.cor) })), { id: 0, titulo: 'Sem sala', cor: '#94a3b8' }];

    const dados = eventosQ.data as { atendimentos: EventoAgenda[]; bloqueios: any[]; horarios: any[]; feriados?: { data: string; nome: string; tipo: string }[] } | undefined;

    // Feriados: só aviso (nome no dia), não bloqueiam a agenda
    const feriadosPorDia = useMemo(() => {
        const m = new Map<string, string[]>();
        for (const f of dados?.feriados ?? []) m.set(f.data, [...(m.get(f.data) ?? []), f.nome]);
        return m;
    }, [dados]);
    const diaFeriadoProp = useCallback((d: Date) => (feriadosPorDia.has(dataISO(d)) ? { className: 'dia-feriado' } : {}), [feriadosPorDia]);
    /** Mês: número do dia com o feriado na mesma linha (não ocupa espaço dos atendimentos). */
    const CabecalhoDataMes = useCallback(
        ({ date, label, onDrillDown }: { date: Date; label: string; onDrillDown: () => void }) => {
            const nomes = feriadosPorDia.get(dataISO(date));
            const hoje = dataISO(date) === dataISO(new Date());
            return (
                <div className="cab-mes" title={nomes ? `Feriado: ${nomes.join(' · ')}` : undefined}>
                    {nomes && (
                        <span className="cab-mes-feriado">
                            <PartyPopper className="h-3 w-3 shrink-0" />
                            {!mobile && <span className="truncate">{nomes.join(' · ')}</span>}
                        </span>
                    )}
                    <button type="button" onClick={onDrillDown} className={cn('cab-mes-num', hoje && 'cab-hoje', !hoje && nomes && 'cab-mes-num-feriado')}>{label}</button>
                </div>
            );
        },
        [feriadosPorDia, mobile],
    );

    const eventos: Evento[] = useMemo(
        () =>
            (dados?.atendimentos ?? []).flatMap((a) => {
                const m = movendo[a.id];
                const ev: Evento = {
                    id: `a${a.id}`,
                    title: a.restrito ? `Ocupado · ${a.profissional_nome.split(' ')[0]}` : a.pessoa_nome,
                    start: m?.start ?? paraDate(a.data, a.hora_inicio),
                    end: m?.end ?? paraDate(a.data, a.hora_fim),
                    resourceId: m?.resourceId ?? (colunas === 'profissional' ? a.id_profissional : a.id_sala ?? 0),
                    tipo: 'atendimento',
                    atendimento: a,
                    cor: corProf(a.id_profissional),
                };
                // Colega fora do filtro com colunas por profissional: o espaço é o mesmo, ocupa todas as colunas
                if (a.de_colega && usarRecursos && colunas === 'profissional' && recursos)
                    return recursos.map((r) => ({ ...ev, id: `${ev.id}-${r.id}`, resourceId: r.id }));
                return [ev];
            }),
        [dados, movendo, colunas, corProf, usarRecursos, recursos],
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
                        title: `Bloqueado${b.motivo ? ` · ${b.motivo}` : ''}${!usarRecursos && profsVisiveis.length !== 1 ? ` (${nomeAlvo})` : ''}`,
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
    }, [dados, usarRecursos, recursos, colunas, selProfs, profissionais, salas, profsVisiveis.length]);

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
            // Quem não vê tudo agenda para si: o fundo segue o próprio expediente
            else if (!veTudo && !soVer && user) aberto = trabalhando(user.id, d);
            else aberto = profsVisiveis.some((p) => trabalhando(p.id, d));
            return aberto ? {} : { className: 'rbc-fora-expediente' };
        },
        [usarRecursos, colunas, trabalhando, profsVisiveis, veTudo, soVer, user],
    );

    const atualizarMut = trpc.agenda.atualizar.useMutation();

    const podeMexer = (e: Evento) =>
        !soVer && e.tipo === 'atendimento' && !!e.atendimento && !e.atendimento.restrito && STATUS_ABERTOS.includes(e.atendimento.status);

    async function mover({ event, start, end, resourceId }: EventInteractionArgs<Evento>) {
        if (!podeMexer(event)) return;
        const a = event.atendimento!;
        const s = new Date(start);
        const e = new Date(end);
        if (dataISO(s) !== dataISO(new Date(e.getTime() - 1))) return toast({ title: 'O atendimento precisa terminar no mesmo dia', variant: 'error' });
        if (dataISO(s) !== a.data && dataISO(s) < hojeISO()) return toast({ title: 'Não é possível mudar para uma data que já passou', variant: 'error' });
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

    // Um clique num bloqueio dispara o evento e a seleção do horário: avisa uma vez só
    const ultimoAviso = useRef(0);
    function avisarBloqueado() {
        if (Date.now() - ultimoAviso.current < 1000) return;
        ultimoAviso.current = Date.now();
        toast({ title: 'Horário bloqueado', description: 'Para liberar, abra o dia e toque em "Liberar" no aviso vermelho acima da agenda.' });
    }

    function avisarForaExpediente() {
        if (Date.now() - ultimoAviso.current < 1000) return;
        ultimoAviso.current = Date.now();
        toast({ title: 'Fora do expediente', description: 'Para atender neste horário, ajuste o horário de atendimento em "Meu expediente".' });
    }

    function novoNoSlot(slot: SlotInfo) {
        if (soVer) return;
        const s = slot.start as Date;
        const e = slot.end as Date;
        const rid = (slot as any).resourceId as number | undefined;
        const diaInteiro = view === 'month' || (e.getTime() - s.getTime()) % 86_400_000 === 0 && s.getHours() === 0;
        if (dataISO(s) < hojeISO()) return toast({ title: 'Não é possível agendar em uma data que já passou' });
        // Quem não vê tudo agenda sempre para si
        const idProf = !veTudo ? user?.id : usarRecursos && colunas === 'profissional' && rid ? rid : selProfs.length === 1 ? selProfs[0] : user?.id;
        // Horário bloqueado: não abre o agendamento
        if (!diaInteiro) {
            const fimSlot = e.getTime() > s.getTime() ? e : new Date(s.getTime() + 15 * 60_000);
            // Bloqueado se cair num bloqueio que está na tela nesta coluna (o que a pessoa vê listrado)
            // ou num bloqueio de quem vai receber o agendamento
            const naTela = fundos.some((f) => {
                const fi = new Date(f.start as Date).getTime();
                const ff = new Date(f.end as Date).getTime();
                return fi < fimSlot.getTime() && ff > s.getTime() && (f.resourceId == null || rid == null || f.resourceId === rid);
            });
            const doProfissional = (dados?.bloqueios ?? []).some((b) => {
                const bi = new Date(String(b.inicio).replace(' ', 'T'));
                const bf = new Date(String(b.fim).replace(' ', 'T'));
                if (!(bi < fimSlot && bf > s)) return false;
                if (b.id_profissional == null && b.id_sala == null) return true;
                if (usarRecursos && colunas === 'sala') return b.id_sala != null && b.id_sala === rid;
                return b.id_profissional != null && b.id_profissional === idProf;
            });
            const bloqueado = naTela || doProfissional;
            if (bloqueado) return avisarBloqueado();
            // Ocupado: atendimento do mesmo profissional ou de um colega que divide o espaço
            const ocupante = (dados?.atendimentos ?? []).find((a) => {
                if (!OCUPAM.includes(a.status)) return false;
                const ai = paraDate(a.data, a.hora_inicio).getTime();
                const af = paraDate(a.data, a.hora_fim).getTime();
                if (!(ai < fimSlot.getTime() && af > s.getTime())) return false;
                return a.id_profissional === idProf || a.restrito || (compartilhados.has(a.id_profissional) && idProf != null && compartilhados.has(idProf));
            });
            if (ocupante) return toast({ title: 'Horário ocupado', description: `${ocupante.profissional_nome.split(' ')[0]} já tem atendimento das ${ocupante.hora_inicio} às ${ocupante.hora_fim}.` });
            // Fora do expediente: o que aparece cinza na tela, ou fora do horário de quem vai atender
            const foraNaTela = (slotPropGetter(s, rid) as { className?: string }).className === 'rbc-fora-expediente';
            const foraDoProfissional = idProf != null && expedientes.has(idProf) && !trabalhando(idProf, s);
            if (foraNaTela || foraDoProfissional) return avisarForaExpediente();
        }
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

    // Visão dia: tocar (ou segurar) num horário vazio abre o agendamento.
    // No computador o clique já é tratado pela seleção do calendário. No celular o dedo cai na
    // camada transparente dos atendimentos, por cima das linhas, então o horário é achado pela
    // posição do toque (cada linha carrega a hora em data-hora).
    const novoNoSlotRef = useRef(novoNoSlot);
    novoNoSlotRef.current = novoNoSlot;
    const toque = useRef<{ x: number; y: number; moveu: boolean } | null>(null);
    const SlotComHora = useMemo(
        () =>
            function SlotComHora({ children, value, resource }: { children?: ReactNode; value: Date; resource?: number | string }) {
                if (!isValidElement(children)) return <>{children}</>;
                return cloneElement(children as ReactElement<any>, { 'data-hora': value.getTime(), 'data-recurso': resource ?? '' });
            },
        [],
    );
    const toqueNoDia = {
        onTouchStart: (ev: React.TouchEvent) => {
            const t = ev.touches[0];
            toque.current = ev.touches.length === 1 ? { x: t.clientX, y: t.clientY, moveu: false } : null;
        },
        onTouchMove: (ev: React.TouchEvent) => {
            const t = ev.touches[0];
            if (toque.current && Math.hypot(t.clientX - toque.current.x, t.clientY - toque.current.y) > 10) toque.current.moveu = true;
        },
        onTouchEnd: (ev: React.TouchEvent) => {
            const ini = toque.current;
            toque.current = null;
            if (!ini || ini.moveu) return;
            const alvo = ev.target as HTMLElement;
            if (alvo.closest('.rbc-event, .rbc-background-event')) return;
            const coluna = alvo.closest('.rbc-day-slot');
            if (!coluna) return;
            const linha = [...coluna.querySelectorAll<HTMLElement>('.rbc-time-slot[data-hora]')].find((el) => {
                const r = el.getBoundingClientRect();
                return ini.y >= r.top && ini.y < r.bottom;
            });
            if (!linha) return;
            ev.preventDefault(); // evita o clique "fantasma" depois do toque
            const inicio = new Date(Number(linha.dataset.hora));
            const recurso = linha.dataset.recurso ? Number(linha.dataset.recurso) : undefined;
            novoNoSlotRef.current({ start: inicio, end: new Date(inicio.getTime() + 15 * 60_000), slots: [inicio], action: 'click', resourceId: recurso } as SlotInfo);
        },
    };

    const removerBloqueio = trpc.agenda.bloqueios.delete.useMutation({
        onSuccess: () => { utils.agenda.eventos.invalidate(); toast({ title: 'Bloqueio removido', variant: 'success' }); },
        onError: (e) => toast({ title: e.message, variant: 'error' }),
    });

    async function selecionar(e: Evento) {
        if (e.tipo === 'atendimento' && e.atendimento?.restrito) return toast({ title: 'Horário ocupado', description: 'Outro atendimento já usa o espaço neste horário.' });
        if (e.tipo === 'atendimento') return setDetalhe(e.atendimento!);
        if (e.tipo === 'feriado') { setData(e.start); return setView('day'); }
        // Bloqueio no calendário não abre nada; para liberar, usa o aviso vermelho acima da agenda (visão Dia)
        return avisarBloqueado();
    }

    async function perguntarRemoverBloqueio(b: { id: number; motivo: string | null; id_profissional: number | null }) {
        if (soVer || (!isAdmin && b.id_profissional !== user?.id)) return;
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
        setForm({ open: true, inicial: { data: dataISO(data), hora_inicio: hora, id_profissional: selProfs.length === 1 && veTudo ? selProfs[0] : user?.id } });

    // Painel do + do rodapé: o que dá para fazer nesta tela
    useAcoesDaTela(soVer ? [] : [
        { id: 'agendamento', label: 'Novo agendamento neste dia', icone: CalendarPlus, onSelect: () => novoAgendamento() },
        { id: 'bloquear', label: 'Bloquear horário', icone: Ban, onSelect: () => setBloqueio({ open: true, inicial: { data: dataISO(data) } }) },
        { id: 'expediente', label: 'Meu expediente', icone: Clock, onSelect: () => setExpediente(true), disabled: !eu },
        { id: 'lembretes', label: 'Lembretes por WhatsApp', icone: BellRing, onSelect: () => setLembretes(true) },
    ]);

    const chipsProfissionais = (
        <>
            <button type="button" onClick={() => setSelProfs([])}
                className={cn('shrink-0 rounded-xl border px-4 py-1.5 font-medium', !selProfs.length ? 'border-[hsl(var(--foreground))] bg-[hsl(var(--foreground))] text-[hsl(var(--background))]' : 'hover:bg-[hsl(var(--accent))]')}>
                Todos
            </button>
            {profissionais.map((p) => {
                const ativo = selProfs.includes(p.id);
                const cor = corPadrao(p.id, p.cor);
                return (
                    <button key={p.id} type="button"
                        onClick={() => setSelProfs((s) => (ativo ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                        className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-4 py-1.5 font-medium transition-colors', ativo ? 'text-white' : 'hover:bg-[hsl(var(--accent))]')}
                        style={ativo ? { background: cor, borderColor: cor } : undefined}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: ativo ? '#fff' : cor }} />
                        {p.nome.split(' ')[0]}
                    </button>
                );
            })}
        </>
    );

    // Visão Dia com um profissional: diz o horário de atendimento e os bloqueios do dia
    const DIA_NOME = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    const profAviso = view === 'day' && profsVisiveis.length === 1 ? profsVisiveis[0] : null;
    const nomesFeriado = view === 'day' ? feriadosPorDia.get(dataISO(data)) : undefined;
    const linhaFeriado = nomesFeriado && (
        <p className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-sm font-medium text-amber-800">
            <PartyPopper className="h-4 w-4 shrink-0" /> Feriado: {nomesFeriado.join(' · ')}
        </p>
    );
    const avisoDia = (() => {
        if (!profAviso || !dados) return linhaFeriado ? <div className="space-y-1 text-sm">{linhaFeriado}</div> : null;
        const porDia = expedientes.get(profAviso.id);
        const dia = data.getDay();
        const nome = profAviso.nome.split(' ')[0];
        const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        const periodos = [...(porDia?.get(dia) ?? [])].sort((a, b) => a[0] - b[0]);
        const fimDeSemana = dia === 0 || dia === 6;
        const expediente = !porDia
            ? null
            : periodos.length
              ? `${nome} atende ${periodos.map(([i, f]) => `das ${hhmm(i)} às ${hhmm(f)}`).join(' e ')} ${fimDeSemana ? 'neste' : 'nesta'} ${DIA_NOME[dia]}`
              : `${nome} não atende ${fimDeSemana ? 'aos' : 'às'} ${DIA_NOME[dia]}s`;
        const iso = dataISO(data);
        const doDia = (dados.bloqueios ?? []).filter((b) => (b.id_profissional == null || b.id_profissional === profAviso.id)
            && b.inicio.slice(0, 10) <= iso && b.fim.slice(0, 10) >= iso);
        if (!expediente && !doDia.length && !linhaFeriado) return null;
        return (
            <div className="space-y-1 text-sm">
                {linhaFeriado}
                {expediente && (
                    <p className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
                        <Clock className="h-4 w-4 shrink-0" /> {expediente}
                    </p>
                )}
                {doDia.map((b) => (
                    <button key={b.id} type="button" onClick={() => perguntarRemoverBloqueio(b)}
                        className="flex w-full items-center gap-1.5 rounded-lg bg-[hsl(var(--agenda-bloqueio-faixa))] px-2.5 py-1.5 text-left font-medium text-[hsl(var(--background))]">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">Bloqueado{b.motivo ? `: ${b.motivo}` : ''} · {b.inicio.slice(0, 10) === b.fim.slice(0, 10) ? `${b.inicio.slice(11, 16)}–${b.fim.slice(11, 16)}` : `até ${b.fim.slice(8, 10)}/${b.fim.slice(5, 7)}`}</span>
                        <span className="shrink-0 text-xs font-semibold underline underline-offset-2">Liberar</span>
                    </button>
                ))}
            </div>
        );
    })();

    const legendaFundo = (
        <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm border agenda-legenda-fora" /> Fora do expediente</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-4 rounded-sm agenda-legenda-bloqueio" /> Bloqueado</span>
            <span className="inline-flex items-center gap-1.5 text-amber-700"><PartyPopper className="h-3.5 w-3.5" /> Feriado</span>
        </div>
    );

    const dialogos = (
        <>
            {!soVer && <AgendamentoForm open={form.open} onOpenChange={(v) => setForm((f) => ({ ...f, open: v }))} inicial={form.inicial} />}
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
            {!soVer && (
                <>
                    <BloqueioForm open={bloqueio.open} onOpenChange={(v) => setBloqueio((b) => ({ ...b, open: v }))} inicial={bloqueio.inicial} />
                    <ExpedienteDialog open={expediente} onOpenChange={setExpediente} profissional={eu ?? null} admin={isAdmin} />
                    <LembretesDialog open={lembretes} onOpenChange={setLembretes} />
                </>
            )}
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
            events={view === 'month' ? [...eventos, ...fundos] : eventos}
            backgroundEvents={view === 'month' ? undefined : fundos}
            resources={recursos}
            resourceIdAccessor={(r) => r.id}
            resourceTitleAccessor={(r) => r.titulo}
            min={minHora}
            max={maxHora}
            step={passoMin <= 15 ? passoMin : 15}
            timeslots={passoMin <= 15 ? Math.round(60 / passoMin) : 4}
            scrollToTime={new Date(2000, 0, 1, Math.max(minHora.getHours(), new Date().getHours() - 1))}
            selectable={view === 'day' && !soVer}
            longPressThreshold={250}
            onSelectSlot={novoNoSlot}
            onSelectEvent={(e) => selecionar(e)}
            onEventDrop={mover}
            onEventResize={mover}
            draggableAccessor={podeMexer}
            resizableAccessor={podeMexer}
            resizable
            popup
            dayLayoutAlgorithm={layoutIgual as any}
            slotPropGetter={slotPropGetter as any}
            dayPropGetter={view === 'month' ? diaFeriadoProp : undefined}
            formats={{
                timeGutterFormat: 'HH:mm',
                eventTimeRangeFormat: ({ start, end }) => `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`,
                agendaTimeRangeFormat: ({ start, end }) => `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`,
                dayFormat: (d) => mobile ? `${DIA_CURTO[d.getDay()]} ${d.getDate()}` : format(d, 'EEE dd/MM', { locale: ptBR }),
                agendaDateFormat: (d) => format(d, "EEE, dd/MM", { locale: ptBR }),
            }}
            eventPropGetter={(e) => {
                if (e.tipo === 'bloqueio') return { className: 'evt-bloqueio' };
                if (e.tipo === 'feriado') return { className: 'evt-feriado' };
                const a = e.atendimento!;
                const restrito = a.restrito;
                return {
                    className: cn('evt-atendimento', `evt-${a.status.toLowerCase()}`, restrito && 'evt-restrito'),
                    style: { '--evt-cor': restrito ? '#94a3b8' : e.cor } as React.CSSProperties,
                };
            }}
            components={{
                ...(view === 'day' ? { timeSlotWrapper: SlotComHora as any } : {}),
                week: {
                    header: ({ date }: { date: Date }) => {
                        const nomes = feriadosPorDia.get(dataISO(date));
                        const hoje = dataISO(date) === dataISO(new Date());
                        return (
                            <span title={nomes?.join(' · ')} className="cab-dia">
                                <span className={cn('cab-dia-semana', nomes && 'text-amber-700')}>{DIA_CURTO[date.getDay()]}</span>
                                <span className={cn('cab-dia-num', hoje && 'cab-hoje', !hoje && nomes && 'text-amber-600')}>{date.getDate()}</span>
                                {nomes && !mobile && <span className="cab-feriado">{nomes.join(' · ')}</span>}
                            </span>
                        );
                    },
                } as any,
                month: {
                    header: ({ date }: { date: Date }) => <span className="cab-dia-semana">{DIA_CURTO[date.getDay()]}</span>,
                    dateHeader: CabecalhoDataMes,
                } as any,
                event: ({ event }: { event: Evento }) => {
                    if (event.tipo === 'bloqueio') return <span className="inline-flex items-center gap-1 text-[11px] font-semibold"><Lock className="h-3 w-3 shrink-0" />{event.title}</span>;
                    if (event.tipo === 'feriado') return <span className="inline-flex items-center gap-1 truncate text-[11px] font-semibold"><PartyPopper className="h-3 w-3 shrink-0" />{event.title}</span>;
                    const a = event.atendimento!;
                    if (mobile && view === 'week') return <div className="truncate font-semibold leading-tight">{event.title.split(' ')[0]}</div>;
                    return (
                        <div className="leading-tight">
                            <div className="flex items-center gap-1">
                                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_INFO[a.status as StatusAtendimento].ponto)} />
                                <span className="truncate font-semibold">{event.title}</span>
                            </div>
                            {!a.restrito && nomesAtendimento(a) && (
                                <div className="truncate opacity-80">{nomesAtendimento(a)}</div>
                            )}
                            {view !== 'day' && profsVisiveis.length !== 1 && <div className="truncate opacity-70">{a.profissional_nome.split(' ')[0]}{a.sala_nome ? ` · ${a.sala_nome}` : ''}</div>}
                        </div>
                    );
                },
            }}
        />
    );

    if (mobile) {
        const t = view === 'day' ? `${DIA_CURTO[data.getDay()]}, ${format(data, "d 'de' MMM", { locale: ptBR })}` : view === 'month' ? format(data, "MMM 'de' yyyy", { locale: ptBR }) : tituloPeriodo(view, data);
        const titulo = t.charAt(0).toUpperCase() + t.slice(1);
        return (
            <div className="flex flex-col gap-3">
                {/* Navegação do dia */}
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Anterior" onClick={() => navegar(-1)}><ChevronLeft className="h-5 w-5" /></Button>
                    <SeletorData className="flex flex-1 justify-center" data={data} onData={setData} titulo={titulo} soMes={view === 'month'} />
                    <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Próximo" onClick={() => navegar(1)}><ChevronRight className="h-5 w-5" /></Button>
                    {dataISO(data) !== dataISO(new Date()) && (
                        <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => navegar(0)}>Hoje</Button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <div role="group" aria-label="Como ver a agenda" className="flex rounded-xl bg-[hsl(var(--muted))] p-1">
                        {([['day', 'Dia'], ['week', 'Sem.'], ['month', 'Mês'], ['agenda', 'Lista']] as [View, string][]).map(([v, rotulo]) => (
                            <button key={v} type="button" onClick={() => setView(v)} aria-label={v === 'week' ? 'Semana' : undefined}
                                className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', view === v ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_4px_12px_-6px_hsl(var(--primary)/0.6)]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
                                {rotulo}
                            </button>
                        ))}
                    </div>
                    {!soVer && (
                        <div className="ml-auto flex">
                            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Lembretes por WhatsApp" onClick={() => setLembretes(true)}><BellRing className="h-5 w-5" /></Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Bloquear horário" onClick={() => setBloqueio({ open: true, inicial: { data: dataISO(data) } })}><Ban className="h-5 w-5" /></Button>
                            <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Meu expediente" onClick={() => setExpediente(true)} disabled={!eu}><Clock className="h-5 w-5" /></Button>
                        </div>
                    )}
                </div>

                {profissionais.length > 1 && !soMeu && (
                    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm scrollbar-thin">{chipsProfissionais}</div>
                )}

                {view === 'day' ? (
                    <div className="space-y-2">
                        <FaixaSemana data={data} onData={setData} atendimentos={dados?.atendimentos ?? []} feriados={feriadosPorDia} />
                        {avisoDia}
                        <div className={cn('agenda-studio agenda-dia-movel h-[68vh] min-h-[420px] rounded-3xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-2 shadow-painel', eventosQ.isFetching && 'opacity-90')} {...toqueNoDia}>
                            {calendario}
                        </div>
                        {legendaFundo}
                    </div>
                ) : view === 'week' ? (
                    <div className="space-y-2">
                        <div className={cn('agenda-studio agenda-compacta h-[72vh] min-h-[440px] rounded-3xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-2 shadow-painel', eventosQ.isFetching && 'opacity-90')}>
                            {calendario}
                        </div>
                        {legendaFundo}
                    </div>
                ) : view === 'agenda' ? (
                    <AgendaLista
                        de={de}
                        ate={ate}
                        mostrarVazios={false}
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
                    <div className="agenda-studio h-[70vh] rounded-3xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-2 shadow-painel">
                        <DnDCalendar
                            localizer={localizer}
                            culture="pt-BR"
                            messages={MENSAGENS}
                            toolbar={false}
                            view="month"
                            views={['month']}
                            date={data}
                            onNavigate={(d) => setData(d)}
                            events={[...eventos, ...fundos]}
                            selectable
                            longPressThreshold={250}
                            onSelectSlot={(slot) => { setData(slot.start as Date); setView('day'); }}
                            dayPropGetter={diaFeriadoProp}
                            onSelectEvent={(e) => { setData(e.start); setView('day'); }}
                            onDrillDown={(d) => { setData(d); setView('day'); }}
                            onView={() => undefined}
                            draggableAccessor={() => false}
                            components={{
                                month: { header: ({ date }: { date: Date }) => <span className="cab-dia-semana">{DIA_CURTO[date.getDay()]}</span>, dateHeader: CabecalhoDataMes } as any,
                                event: ({ event }: { event: Evento }) => event.tipo === 'bloqueio'
                                ? <span className="inline-flex items-center gap-0.5"><Lock className="h-3 w-3 shrink-0" />Bloq.</span>
                                : event.tipo === 'feriado'
                                  ? <span className="inline-flex items-center gap-0.5"><PartyPopper className="h-3 w-3 shrink-0" />{event.title}</span>
                                  : <span>{event.title}</span> }}
                            eventPropGetter={(e) => e.tipo === 'bloqueio' ? { className: 'evt-bloqueio-mes' } : e.tipo === 'feriado' ? { className: 'evt-feriado' } : ({
                                className: cn('evt-atendimento', e.atendimento && `evt-${e.atendimento.status.toLowerCase()}`, e.atendimento?.restrito && 'evt-restrito'),
                                style: { '--evt-cor': e.atendimento?.restrito ? '#94a3b8' : e.cor } as React.CSSProperties,
                            })}
                        />
                    </div>
                )}

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
                <SeletorData data={data} onData={setData} titulo={tituloPeriodo(view, data)} soMes={view === 'month'} />
                <div className="flex-1" />

                <div role="group" aria-label="Como ver a agenda" className="flex rounded-xl bg-[hsl(var(--muted))] p-1">
                    {VIEWS.map((v) => (
                        <button key={v.id} type="button" onClick={() => setView(v.id)}
                            className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors', view === v.id ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_4px_12px_-6px_hsl(var(--primary)/0.6)]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]')}>
                            {v.label}
                        </button>
                    ))}
                </div>
                {!soVer && (
                    <Button size="sm" onClick={() => setForm({ open: true, inicial: { data: dataISO(data), id_profissional: selProfs.length === 1 && veTudo ? selProfs[0] : user?.id } })}>
                        <Plus className="mr-1 h-4 w-4" /> Agendar
                    </Button>
                )}
            </div>

            {/* Filtros e ações secundárias */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
                {!soMeu && chipsProfissionais}

                {view === 'day' && salas.length > 0 && (
                    <div className="ml-2 flex items-center gap-1 rounded-xl bg-[hsl(var(--muted))] p-1 text-xs">
                        <span className="px-1.5 text-[hsl(var(--muted-foreground))]">Colunas:</span>
                        {(['profissional', 'sala'] as const).map((c) => (
                            <button key={c} type="button" onClick={() => setColunas(c)}
                                className={cn('rounded-lg px-2.5 py-1 capitalize', colunas === c ? 'bg-[hsl(var(--card))] font-medium shadow-painel' : 'text-[hsl(var(--muted-foreground))]')}>
                                {c === 'profissional' ? 'Profissionais' : 'Salas'}
                            </button>
                        ))}
                    </div>
                )}

                {!soVer && (
                    <div className="ml-auto flex flex-wrap gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setLembretes(true)}><BellRing className="mr-1.5 h-4 w-4" /> Lembretes</Button>
                        <Button variant="ghost" size="sm" onClick={() => setBloqueio({ open: true, inicial: { data: dataISO(data) } })}><Ban className="mr-1.5 h-4 w-4" /> Bloquear</Button>
                        <Button variant="ghost" size="sm" onClick={() => setExpediente(true)} disabled={!eu}><Clock className="mr-1.5 h-4 w-4" /> Meu expediente</Button>
                    </div>
                )}
            </div>

            {avisoDia}

            {/* Calendário (na Lista, os mesmos cartões do celular) */}
            {view === 'agenda' ? (
                <AgendaLista
                    de={de}
                    ate={ate}
                    mostrarVazios={false}
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
                <div className={cn('agenda-studio agenda-desktop min-h-[560px] flex-1 rounded-3xl border border-[hsl(var(--border))]/70 bg-[hsl(var(--card))] p-2 shadow-painel', eventosQ.isFetching && 'opacity-90')} {...(view === 'day' ? toqueNoDia : {})}>
                    {calendario}
                </div>
            )}

            {/* Legenda */}
            <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--muted-foreground))]">
                {(Object.keys(STATUS_INFO) as StatusAtendimento[]).filter((s) => s !== 'CANCELADO').map((s) => (
                    <span key={s} className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', STATUS_INFO[s].ponto)} />{STATUS_INFO[s].label}</span>
                ))}
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm agenda-legenda-fora" /> Fora do expediente</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm agenda-legenda-bloqueio" /> Bloqueado</span>
                <span className="inline-flex items-center gap-1.5 text-amber-700"><PartyPopper className="h-3.5 w-3.5" /> Feriado</span>
            </div>

            {dialogos}
        </div>
    );
}
